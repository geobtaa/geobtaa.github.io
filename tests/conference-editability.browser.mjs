import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import test from 'node:test';
import { withEditorBrowser, chrome } from '../editor/browserHarness.mjs';
import { parseContent } from '../editor/content.mjs';
import { splitBody } from '../src/components/editor/bodySegments.ts';
import { validateDocument } from '../editor/validateDocument.mjs';

const original = await readFile(new URL('../src/content/docs/conference/index.mdx', import.meta.url), 'utf8');
const parsed = parseContent(original);
const options = { skip: chrome || process.env.CI ? false : 'Chrome/Chromium required', timeout: 60_000 };
const fixture = `import React from 'react';
import {createRoot} from 'react-dom/client';
import ProjectEditor from '../src/components/editor/ProjectEditor.tsx';
import '../src/components/editor/editor.css';
window.record = ${JSON.stringify({ ...parsed, content: original, filename: 'index.mdx', sha: 'loaded', date: '', authors: [], tags: [], cover: null })};
window.writes = [];
window.fetch = async (url, options = {}) => {
  const path = new URL(String(url), location.origin).pathname;
  if (path === '/api/session') return Response.json({authenticated:true, login:'tester'});
  if (path === '/api/content/conference') return Response.json({branch:'custom-cms', entries:[{name:'index.mdx',path:'src/content/docs/conference/index.mdx',sha:window.record.sha}]});
  if (path === '/api/content/conference/index.mdx') {
    if (options.method === 'PUT') { const input = JSON.parse(options.body); window.writes.push(input); window.record = {...window.record, ...input, sha:'saved',commitSha:'saved'}; }
    return Response.json(window.record);
  }
  throw new Error('Unexpected API: '+path);
};
createRoot(document.getElementById('root')).render(React.createElement(ProjectEditor));`;

test('coordinator can edit Conference paragraphs, table cells, and list items, save, and reopen', options, async () => {
  await withEditorBrowser(fixture, async ({evaluate,waitFor,send}) => {
    await waitFor('!!document.querySelector(".dashboard-card")');
    await evaluate('[...document.querySelectorAll(".dashboard-card")].find(button=>button.textContent.includes("Conference")).click()');
    await waitFor('!!document.querySelector(".project-list button")');
    await evaluate('document.querySelector(".project-list button").click()');
    await waitFor('!!document.querySelector(".body-editor .tiptap table")');
    assert.equal(await evaluate('document.querySelectorAll(".block-row .protected-block").length'), 1);
    assert.ok(await evaluate('document.querySelector(".page-setup").textContent.includes("wrapper: ConferenceLanding")'));
    assert.ok(await evaluate('!!document.querySelector(".structured-link-button")'));
    for (const [needle, suffix] of [
      ['Give a talk, enter the map gallery, or simply join the conversation.', ' Everyone is welcome.'],
      ['Registration opens', ' (online)'],
      ['UAVs', ' and remote sensing'],
    ]) {
      await evaluate(`(() => {
        for (const element of document.querySelectorAll('.body-editor .tiptap')) {
          const editor = element.editor;
          let position;
          editor.state.doc.descendants((node, pos) => { if (node.type.name === 'paragraph' && node.textContent.includes(${JSON.stringify(needle)})) position = pos + node.nodeSize - 1; });
          if (position !== undefined) { window.activeConferenceEditor = editor; editor.commands.setTextSelection(position); editor.commands.focus(); return; }
        }
        throw new Error('Editable paragraph not found');
      })()`);
      await waitFor('document.activeElement === window.activeConferenceEditor.view.dom');
      await send('Input.insertText', {text:suffix});
    }
    await evaluate('document.querySelector(".top-save").click()');
    await waitFor('window.writes.length === 1 && document.querySelector(".top-save").disabled');
    const saved = await evaluate('window.writes[0].body');
    assert.match(saved,/Everyone is welcome/);
    assert.match(saved,/Registration opens \(online\)/);
    assert.match(saved,/UAVs and remote sensing/);
    await validateDocument(`---\ntitle: Conference\n---\n\n${saved}`, {filename:'index.mdx',originalBody:parsed.body});
    const protectedSources = body => splitBody(body).filter(segment=>segment.kind==='protected').map(segment=>segment.content);
    assert.deepEqual(protectedSources(saved),protectedSources(parsed.body));
    await evaluate('document.querySelector(".editor-navigation .back").click()');
    await waitFor('!!document.querySelector(".project-list button")');
    await evaluate('document.querySelector(".project-list button").click()');
    await waitFor('!!document.querySelector(".body-editor .tiptap table")');
    assert.ok(await evaluate('[...document.querySelectorAll(".body-editor .tiptap")].some(element=>element.textContent.includes("UAVs and remote sensing"))'));
    assert.equal(await evaluate('document.querySelectorAll(".block-row .protected-block").length'),1);
  });
});

test('MDX setup wrapper preserves the public Conference panels and responsive layout', options, async () => {
  await withEditorBrowser('', async ({evaluate,waitFor,send}) => {
    await waitFor('!!document.body');
    const origin = await evaluate('location.origin');
    await send('Page.navigate',{url:origin+'/conference/'});
    await waitFor('document.querySelectorAll(".conference-panel").length === 3');
    assert.equal(await evaluate('document.querySelectorAll(".conference-landing").length'),1);
    assert.ok(await evaluate('!!document.querySelector(".conference-landing__main table") && !!document.querySelector(".conference-landing__main ul")'));
    assert.equal(await evaluate('document.querySelector(".conference-landing__main .sl-link-button").getAttribute("href")'),'/conference/2026/#conference-recordings');
    for (const width of [1440,1024,390]) {
      await send('Emulation.setDeviceMetricsOverride',{width,height:1100,deviceScaleFactor:1,mobile:width<800});
      assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'),true);
      if(width===1440){
        const screenshot = await send('Page.captureScreenshot',{format:'png'});
        await writeFile('/tmp/geobtaa-conference-editable-desktop.png',Buffer.from(screenshot.data,'base64'));
      }
    }
  },{builtDirectory:'dist'});
});
