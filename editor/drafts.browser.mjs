import assert from 'node:assert/strict';
import test from 'node:test';
import { chrome, withEditorBrowser } from './browserHarness.mjs';

const fixture = `import React from 'react';
import {createRoot} from 'react-dom/client';
import ProjectEditor from '../src/components/editor/ProjectEditor.tsx';
import '../src/components/editor/editor.css';
import {draftTestRepository} from './draftTestRepository.mjs';
import {createDraftStore} from './draftStorage.mjs';
import {parsePage,savePage} from './page.mjs';
const path='src/content/docs/library/report.mdx';
window.repo=await draftTestRepository({[path]:'---\\ntitle: Report\\ndescription: Keep\\n---\\n\\nOriginal text.'});
const previous=JSON.parse(localStorage.getItem('test-draft-git')||'null');
if(previous){
  for(const key of ['refs','commits','trees','objects'])window.repo[key].clear();
  window.repo.pulls=previous.pulls||[];
  for(const item of previous.refs)window.repo.refs.set(...item);
  for(const item of previous.commits)window.repo.commits.set(...item);
  for(const [key,value] of previous.trees)window.repo.trees.set(key,new Map(value));
  for(const [key,value] of previous.objects)window.repo.objects.set(key,new Uint8Array(value));
}
const persist=()=>localStorage.setItem('test-draft-git',JSON.stringify({refs:[...window.repo.refs],commits:[...window.repo.commits],trees:[...window.repo.trees].map(([key,value])=>[key,[...value]]),objects:[...window.repo.objects].map(([key,value])=>[key,[...value]]),pulls:window.repo.pulls}));
window.store=createDraftStore({request:window.repo.request});
window.loadId=crypto.randomUUID();
window.concurrentSave=async()=>{const file=await window.store.getContent('library','report.mdx');await savePage(window.store,'library','report.mdx',{...file,...parsePage(file.content),title:'Other editor'});persist()};
window.fetch=async(url,options={})=>{
 const parsed=new URL(String(url),location.origin),pathname=parsed.pathname;
 try{
  if(pathname.startsWith('/api/publication-status/'))return Response.json({autoMergeEnabled:true,mainDraft:false,website:window.deployed?{publication:'published',requestApplied:true}:{publication:'unavailable'}});
  if(pathname.startsWith('/api/publish/')&&(!options.method||options.method==='GET'))return Response.json(await window.store.getPublicationStatus('library','report.mdx'));
  if(pathname.startsWith('/api/publish/')&&Object.hasOwn(JSON.parse(options.body),'autoMerge'))return Response.json(await window.store.setPublicationAutoMerge({area:'library',filename:'report.mdx',...JSON.parse(options.body),enabled:JSON.parse(options.body).autoMerge}));
  if(pathname.startsWith('/api/publish/'))return Response.json(await (JSON.parse(options.body).prepare ? window.store.preparePublication({area:'library',filename:'report.mdx',head:JSON.parse(options.body).head}) : window.store.publishContent({area:'library',filename:'report.mdx',...JSON.parse(options.body)})));
  if(pathname==='/api/session')return Response.json({authenticated:true,login:localStorage.getItem('test-draft-login')||'first-editor',workspace:window.store.workspace});
  if(pathname==='/api/images'&&options.method==='POST'){const input=JSON.parse(options.body);return Response.json(await window.store.uploadImage({...input,bytes:Uint8Array.from(atob(input.content),char=>char.charCodeAt(0))}))}
  if(pathname==='/api/images')return Response.json(await window.store.listImages({area:parsed.searchParams.get('area'),filename:parsed.searchParams.get('filename')}));
  const match=pathname.match(/^\\/api\\/content\\/([^/]+)(?:\\/(.+))?$/);if(!match)throw new Error('Unexpected API '+pathname);
  const area=match[1],filename=match[2]&&decodeURIComponent(match[2]);
  if(!filename)return Response.json(await window.store.listContent(area));
  if(options.method==='PUT')return Response.json(await savePage(window.store,area,filename,JSON.parse(options.body)));
  const file=await window.store.getContent(area,filename);return Response.json({...file,...parsePage(file.content)});
 }catch(error){return Response.json({error:error.message},{status:error.status||500})}finally{persist()}
};
createRoot(document.getElementById('root')).render(React.createElement(ProjectEditor));`;
const options = { skip: chrome ? false : 'Chrome/Chromium is required.', timeout: 45_000 };
const title = `document.querySelector('.editor-fields input[required]')`;
const button = text => `[...document.querySelectorAll('button')].find(button=>button.textContent===${JSON.stringify(text)})`;
async function fill(browser, value) { await browser.evaluate(`${title}.focus();${title}.select()`); await browser.send('Input.insertText', {text:value}); }

test('retained matching generations have no chip; newer editorial work shows Unpublished changes; authoritative opening distinguishes published content from newer saved work',options,async()=>{
  for(const later of [false,true]){
    const setup=`
    import {publicationTestClient} from './publicationTestHelpers.mjs';
    const saveTitle=async title=>{const file=await window.store.getContent('library','report.mdx');return savePage(window.store,'library','report.mdx',{...file,...parsePage(file.content),title});};
    const submit=async saved=>{await publicationTestClient({request:window.repo.request}).publishContent({area:'library',filename:'report.mdx',head:saved.head});return window.repo.pulls.at(-1);};
    const merge=async pr=>{const file=window.repo.filesAt(pr.head.sha).get(path);pr.merge_commit_sha=await window.repo.put(path,new TextDecoder().decode(window.repo.objects.get(file.sha)));pr.state='closed';pr.merged_at='2026-11-19T21:47:35Z';};
    await merge(await submit(await saveTitle('First generation')));
    const pr=await submit(await saveTitle('Selected revision'));
    ${later?"await saveTitle('Newer saved revision');":''}
    await merge(pr);persist();
    window.beforeRefs=JSON.stringify([...window.repo.refs]);
    `;
    const scenario=fixture.replace('window.store.listContent(area)','window.store.discoverContent(area)').replace("createRoot(document.getElementById('root'))",setup+"createRoot(document.getElementById('root'))");
    await withEditorBrowser(scenario,async browser=>{
      const {evaluate,waitFor}=browser;
      await waitFor('!!document.querySelector(".project-list button")');
      assert.deepEqual(await evaluate('[...document.querySelectorAll(".project-list .visibility-badge")].map(b=>b.textContent)'),later?['Unpublished changes']:[]);
      assert.equal(await evaluate('document.querySelector(".project-list").textContent.includes("Saved draft")'),false);
      await evaluate('document.querySelector(".project-list button").click()');await waitFor(`!!${title}`);
      assert.equal(await evaluate('document.querySelector(".top-save").disabled'),!later);
      assert.equal(await evaluate(`${title}.value`),later?'Newer saved revision':'Selected revision');
      assert.equal(await evaluate('document.querySelector(".top-save").disabled'),!later,'continuation saves stay available for preserved revisions');
      const text=await evaluate('document.body.textContent');
      if(later){assert.match(text,/Publishing…/);assert.doesNotMatch(text,/editing the current published page/);}
      else {assert.match(text,/Publishing…/);assert.doesNotMatch(text,/previous PR merged|no saved draft/);}
      assert.equal(await evaluate('JSON.stringify([...window.repo.refs])===window.beforeRefs'),true,'listing and opening never alter retained generations');
      assert.equal(await evaluate('document.querySelector(".publish-document").disabled'),true,'continuation still requires Save Draft');
      await fill(browser,'Browser-only change');
      await waitFor('!document.querySelector(".top-save").disabled');
      assert.equal(await evaluate('document.querySelector(".draft-status").textContent'),'Publishing…','earlier publication remains separate from newer edits');
    },{initialSearch:'?area=library'});
  }
});

test('real draft store saves, reloads under another account, and rejects a concurrent save while preserving the live form and undo', options, async () => {
  await withEditorBrowser(fixture, async browser => {
    const { evaluate, waitFor, send } = browser;
    await waitFor(`!!${title}`);
    const main = await evaluate('window.repo.refs.get("refs/heads/main")');
    await fill(browser, 'Shared draft');
    await evaluate('document.querySelector(".top-save").click()');
    await waitFor('document.querySelector(".top-save").disabled && document.querySelector(".top-save").textContent === "Save Draft"');
    assert.equal(await evaluate('document.querySelector(".message.error")?.textContent || ""'), '', 'post-save discovery refresh succeeds with GitHub prefix-relative refs');
    assert.equal(await evaluate('document.querySelector(".top-save").disabled'), true);
    const loadId = await evaluate('window.loadId');
    await evaluate('localStorage.setItem("test-draft-login","second-editor")');
    await send('Page.reload');
    await waitFor(`window.loadId!==${JSON.stringify(loadId)} && ${title}?.value==='Shared draft'`);
    assert.equal(await evaluate('localStorage.getItem("test-draft-login")'), 'second-editor');
    await fill(browser, 'My unsaved edits');
    await evaluate('window.liveEditor=document.querySelector(".tiptap");window.concurrentSave()');
    await evaluate('document.querySelector(".top-save").click()');
    await waitFor('document.querySelector(".message.error")?.textContent.includes("saved version changed")');
    assert.equal(await evaluate(`${title}.value`), 'My unsaved edits');
    assert.equal(await evaluate('document.querySelector(".tiptap")===window.liveEditor'), true);
    assert.equal(await evaluate('window.repo.refs.get("refs/heads/main")'), main);
    assert.match(await evaluate('window.store.getContent("library","report.mdx").then(file=>file.content)'), /Other editor/);
  }, { initialSearch:'?area=library&file=report.mdx' });
});

test('pending uploads stay in browser recovery and enter Git with the document only on Save Draft', options, async () => {
  await withEditorBrowser(fixture, async browser => {
    const { evaluate, waitFor, send } = browser;
    await waitFor(`!!${title}`);
    await evaluate(`document.querySelector('.tiptap').editor.commands.focus('end')`);
    // Use the actual picker upload UI so the pending asset is held in the form.
    await waitFor(`[...document.querySelectorAll('button')].some(button=>(button.getAttribute('aria-label')||button.textContent.trim())==='Image')`);
    await evaluate(`[...document.querySelectorAll('button')].find(button=>(button.getAttribute('aria-label')||button.textContent.trim())==='Image').click()`);
    await waitFor('!!document.querySelector(".image-picker input[type=file]")');
    await evaluate(`(()=>{const transfer=new DataTransfer();transfer.items.add(new File(['GIF89a'],'Map.gif',{type:'image/gif'}));const input=document.querySelector('.image-picker input[type=file]');input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    await waitFor(`document.querySelector('.image-picker input')?.value.includes('cms-')`);
    await evaluate(`const checkbox=document.querySelector('.image-picker input[type=checkbox]');checkbox.click();${button('Insert image')}.click()`);
    await waitFor('document.querySelector(".save-state").textContent==="Unsaved changes"');
    assert.equal(await evaluate('[...window.repo.refs.keys()].some(name=>name.startsWith("refs/heads/cms/drafts/"))'), false);
    await send('Page.enable'); browser.onEvent('Page.javascriptDialogOpening',()=>{void send('Page.handleJavaScriptDialog',{accept:true})});
    const loadId=await evaluate('window.loadId'); await send('Page.reload');
    await waitFor(`window.loadId!==${JSON.stringify(loadId)} && !!${button('Restore changes')}`);
    await evaluate(`${button('Restore changes')}.click()`);
    await waitFor('document.querySelector(".save-state").textContent==="Unsaved changes"');
    await evaluate('document.querySelector(".top-save").click()');
    await waitFor('document.querySelector(".top-save").disabled && document.querySelector(".top-save").textContent === "Save Draft"');
    assert.equal(await evaluate(`(()=>{const head=[...window.repo.refs].find(([name])=>name.startsWith('refs/heads/cms/drafts/'))[1];return [...window.repo.filesAt(head).keys()].filter(path=>path.startsWith('src/assets/images/')).length})()`),1);
  },{initialSearch:'?area=library&file=report.mdx'});
});

test('Publish is separate from Save Draft, requires a clean saved revision, and preserves the form on policy failure', options, async () => {
  await withEditorBrowser(fixture, async browser => {
    const { evaluate, waitFor } = browser;
    await waitFor(`!!${title}`);
    assert.equal(await evaluate('document.querySelector(".publish-document").disabled'), true);
    await fill(browser, 'Publication test');
    await evaluate('document.querySelector(".top-save").click()');
    await waitFor('document.querySelector(".top-save").disabled && document.querySelector(".top-save").textContent === "Save Draft"');
    assert.equal(await evaluate('window.repo.pulls.length'), 0, 'Save Draft never opens a PR');
    await evaluate('window.repo.protection={};document.querySelector(".publish-document").click()');
    await waitFor('document.querySelector("dialog")?.open');await evaluate('document.querySelector(".confirm-publication").click()');
    await waitFor('document.querySelector(".publication-heading")?.textContent==="Needs attention"');
    assert.match(await evaluate('document.querySelector(".publication-history").textContent'),/policy blocked/);
    assert.equal(await evaluate(`${title}.value`), 'Publication test');
    assert.equal(await evaluate('window.repo.pulls.length'), 0);
    await evaluate('window.repo.protection=undefined;document.querySelector(".publish-document").click()');
    await waitFor('document.querySelector("dialog")?.open');await evaluate('document.querySelector(".confirm-publication").click()');
    await waitFor('document.querySelector(".publication-status")?.dataset.state === "pr-open"');
    assert.equal(await evaluate('window.repo.pulls.length'), 1);
    await fill(browser, 'Unsaved newer text');
    assert.equal(await evaluate('document.querySelector(".publish-document").disabled'), true);
  }, {initialSearch:'?area=library&file=report.mdx'});
});

test('after manual merge, reopening and saving another edit works without branch instructions or losing unsaved browser recovery', options, async () => {
  await withEditorBrowser(fixture, async browser => {
    const {evaluate,waitFor,send}=browser;
    await waitFor(`!!${title}`);await fill(browser,'First round');
    await evaluate('document.querySelector(".top-save").click()');
    await waitFor('document.querySelector(".top-save").disabled && document.querySelector(".top-save").textContent === "Save Draft"');
    await evaluate('document.querySelector(".publish-document").click()');
    await waitFor('document.querySelector("dialog")?.open');await evaluate('document.querySelector(".confirm-publication").click()');
    await waitFor('window.repo.pulls[0]?.auto_merge===true && !document.querySelector(".editor-navigation .back").disabled');
    // Keep a browser-only edit made after submission but before the manual merge.
    await fill(browser,'Keep unsaved second round');
    await evaluate(`(async()=>{window.mergeSubmitted=async()=>{const pr=window.repo.pulls.at(-1),file=window.repo.filesAt(pr.head.sha).get('src/content/docs/library/report.mdx');const main=await window.repo.put('src/content/docs/library/report.mdx',new TextDecoder().decode(window.repo.objects.get(file.sha)));pr.state='closed';pr.merged_at='2026-11-19T12:00:00Z';pr.merge_commit_sha=main;};await window.mergeSubmitted();await window.fetch('/api/publish/library/report.mdx');window.dispatchEvent(new Event('pagehide'));})()`);
    await send('Page.enable'); browser.onEvent('Page.javascriptDialogOpening',()=>{void send('Page.handleJavaScriptDialog',{accept:true})});
    await send('Page.reload');
    await waitFor(`!!${title} && !!${button('Restore changes')}`);
    await waitFor('document.querySelector(".draft-status")?.textContent === "Publishing…"');
    assert.match(await evaluate('document.body.textContent'),/Publishing…/);
    const restore=await evaluate(`[...document.querySelectorAll('.recovery-notice button')].find(button=>button.textContent==='Restore changes'&&!button.disabled)?.textContent`);
    assert.ok(restore,'same saved source can restore pre-merge unsaved edits');
    await evaluate(`[...document.querySelectorAll('button')].find(button=>button.textContent===${JSON.stringify(restore)}).click()`);
    await waitFor(`${title}.value==='Keep unsaved second round'`);
    await evaluate('window.deployed=true;document.querySelector(".publication-history button").click()');
    await waitFor('document.querySelector(".publication-status").dataset.state==="merged"');
    await evaluate('document.querySelector(".top-save").click()');
    await waitFor('document.querySelector(".top-save").disabled && document.querySelector(".publish-document").disabled===false');
    await evaluate('document.querySelector(".publish-document").click()');
    await waitFor('document.querySelector("dialog")?.open');await evaluate('document.querySelector(".confirm-publication").click()');
    await waitFor('window.repo.pulls[1]?.auto_merge===true && !document.querySelector(".editor-navigation .back").disabled');
    assert.equal(await evaluate(`${title}.value`),'Keep unsaved second round');
    assert.equal(await evaluate('window.repo.pulls[0].state'),'closed');
    assert.equal(await evaluate('window.repo.pulls[1].state'),'open');
    assert.equal(await evaluate('document.body.textContent.includes("cycle-")'),false);
  },{initialSearch:'?area=library&file=report.mdx'});
});
