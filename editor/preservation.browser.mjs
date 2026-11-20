import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { chrome, withEditorBrowser } from './browserHarness.mjs';
import { parsePage } from './page.mjs';
import { splitBody } from '../src/components/editor/bodySegments.ts';

const examples = [
  { area: 'library', filename: 'geodata-collection-roadmap.mdx', marker: 'During the Groundwork Phase', raw: /- \[[x ]\][^\n]*/g },
  { area: 'library', filename: 'btaa-sdi-2019.mdx', marker: 'The next phase of the BTAA GDP', raw: /\[\^[^\]]+\]/g },
  { area: 'posts', filename: '2026-03-17-urban-base-layers-in-practice-philadelphia.mdx', marker: 'Philadelphia represents', raw: /<a href="[^"]+">[^<]+<\/a>/g },
];
const records = await Promise.all(examples.map(async entry => ({ ...entry, content: await readFile(new URL(`../src/content/docs/${entry.area}/${entry.filename}`, import.meta.url), 'utf8') })));
const fixture = `import React from 'react';
import { createRoot } from 'react-dom/client';
import ProjectEditor from '../src/components/editor/ProjectEditor.tsx';
import '../src/components/editor/editor.css';
import { parsePage, savePage } from './page.mjs';
import { saveBlog } from './blog.mjs';
window.records = Object.fromEntries(${JSON.stringify(records.map(({ area, filename, content }) => ({ area, filename, content })))}.map(record => [record.area+'/'+record.filename, {...record, sha:'loaded-'+record.filename}]));
window.writes=[]; window.confirm=()=>true;
const github = {
  async getContent(area, filename) { return window.records[area+'/'+filename]; },
  async saveContent({area, filename, content, sha}) {
    const current=window.records[area+'/'+filename];
    if (current.sha!==sha) throw Object.assign(new Error('Conflict'),{status:409});
    const saved={sha:'saved-'+(window.writes.length+1),commitSha:'test-commit',branch:'custom-cms'};
    window.records[area+'/'+filename]={...current,content,sha:saved.sha}; window.writes.push({area,filename,content}); return saved;
  }
};
window.fetch=async(url,options={})=>{
  const path=new URL(String(url),location.origin).pathname;
  if(path==='/api/session')return Response.json({authenticated:true,login:'tester',workspace:'test#preservation'});
  const match=path.match(/^\\/api\\/content\\/([^/]+)(?:\\/(.+))?$/);
  if(!match)return Response.json({error:'Not found'},{status:404});
  const area=match[1],filename=match[2]&&decodeURIComponent(match[2]);
  if(!filename)return Response.json({branch:'custom-cms',entries:Object.values(window.records).filter(record=>record.area===area).map(record=>({name:record.filename,path:area+'/'+record.filename,sha:record.sha}))});
  try {
    if(options.method==='PUT'){
      const input=JSON.parse(options.body);
      if(window.injectInvalid)input.body+='\\n\\nInvalid {a: 1}.';
      return Response.json(await (area==='posts'?saveBlog(github,filename,input):savePage(github,area,filename,input)));
    }
    const record=window.records[area+'/'+filename];return Response.json({...record,...parsePage(record.content)});
  }catch(error){return Response.json({error:error.message},{status:error.status||500});}
};
createRoot(document.getElementById('root')).render(React.createElement(ProjectEditor));`;

test('real documents survive native typing, Edit/Preview, failed validation, save and reopen twice', {
  skip: chrome ? false : 'Chrome/Chromium is required.', timeout: 90_000,
}, async () => {
  for (const example of records) {
    const original = parsePage(example.content).body;
    const protectedSource = splitBody(original, { mergeProtected: false }).filter(segment => segment.kind === 'protected').map(segment => segment.content);
    const mustKeep = [...original.matchAll(example.raw)].map(match => match[0]);
    await withEditorBrowser(fixture, async browser => {
      const { evaluate, waitFor, send } = browser;
      const findEditor = `[...document.querySelectorAll('.body-editor .rich-editor .tiptap')].find(element=>element.textContent.includes(${JSON.stringify(example.marker)}))`;
      await waitFor(`!!(${findEditor})`);
      for (let pass = 1; pass <= 2; pass++) {
        await evaluate(`(()=>{window.activeEditor=${findEditor}; const editor=window.activeEditor.editor; let position; editor.state.doc.descendants((node,pos)=>{if(node.type.name==='paragraph'&&node.textContent.includes(${JSON.stringify(example.marker)}))position=pos+node.nodeSize-1});editor.commands.setTextSelection(position);editor.commands.focus();})()`);
        await waitFor('document.activeElement===window.activeEditor');
        await send('Input.insertText', { text: ` Review edit ${pass}: {literal}.` });
        await waitFor('document.querySelector(".save-state").textContent==="Unsaved changes"');
        await evaluate('[...document.querySelectorAll(".editor-mode-toggle button")].find(button=>button.textContent==="Preview").click()');
        await waitFor('!!document.querySelector(".cms-preview")');
        assert.equal(await evaluate('document.querySelector("#document-edit").hidden'), true);
        assert.ok(await evaluate('document.querySelectorAll(".preview-protected").length>0'));
        await evaluate('[...document.querySelectorAll(".editor-mode-toggle button")].find(button=>button.textContent==="Edit").click()');
        assert.equal(await evaluate(`${findEditor}===window.activeEditor`), true, 'preview preserves the live editor');
        assert.equal(await evaluate('window.activeEditor.editor.can().undo()'), true);
        if (pass === 1) {
          await evaluate('window.injectInvalid=true;document.querySelector(".top-save").click()');
          await waitFor('document.querySelector(".message.error")?.textContent.includes("Invalid MDX") && !document.querySelector(".top-save").disabled');
          assert.equal(await evaluate('window.writes.length'), 0);
          assert.ok(await evaluate('window.activeEditor.textContent.includes("Review edit 1: {literal}.")'));
          await evaluate('window.injectInvalid=false');
        }
        await evaluate('document.querySelector(".top-save").click()');
        await waitFor(`window.writes.length===${pass} && document.querySelector('.save-state').textContent==='No unsaved changes'`);
        const saved = await evaluate('window.writes.at(-1).content');
        for (const raw of [...protectedSource, ...mustKeep]) assert.ok(parsePage(saved).body.includes(raw), `${example.filename}: lost ${raw.slice(0, 80)}`);
        await evaluate('document.querySelector(".editor-navigation .back").click()');
        await waitFor('!!document.querySelector(".project-list button")');
        await evaluate(`[...document.querySelectorAll('.project-list button')].find(button=>button.textContent.includes(${JSON.stringify(example.filename.replace(/\.mdx$/, ''))})).click()`);
        await waitFor(`!!(${findEditor})`);
        assert.ok(await evaluate(`${findEditor}.textContent.includes('Review edit ${pass}: {literal}.')`));
      }
    }, { initialSearch: `?area=${example.area}&file=${encodeURIComponent(example.filename)}` });
  }
});

test('table line breaks and literal expressions retain their content over repeated real-browser serialization', {
  skip: chrome ? false : 'Chrome/Chromium is required.', timeout: 30_000,
}, async () => {
  await withEditorBrowser(`import React from 'react';import {createRoot} from 'react-dom/client';import {useEditor,EditorContent} from '@tiptap/react';import {richTextEditorOptions} from '../src/components/editor/richTextEditor.ts';
function App(){const editor=useEditor({...richTextEditorOptions('| Header |\\n| --- |\\n| First<br />Second \\\\{literal\\\\} |',()=>{}),immediatelyRender:false});window.editor=editor;return React.createElement(EditorContent,{editor})}createRoot(document.getElementById('root')).render(React.createElement(App));`, async ({ evaluate, waitFor }) => {
    await waitFor('!!window.editor && !!document.querySelector("td")');
    for (let pass = 0; pass < 3; pass++) {
      assert.equal(await evaluate('document.querySelector("td").textContent'), 'FirstSecond {literal}');
      assert.equal(await evaluate('document.querySelectorAll("td br").length'), 1);
      const saved = await evaluate('window.editor.getMarkdown()');
      assert.match(saved, /<br \/>/);
      assert.ok(saved.includes('\\{literal\\}'));
      await evaluate(`window.editor.commands.setContent(${JSON.stringify(saved)},{contentType:'markdown'})`);
    }
  });
});
