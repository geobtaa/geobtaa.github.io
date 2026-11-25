import assert from 'node:assert/strict';
import test from 'node:test';
import { answerLeaveDialog, chrome, withEditorBrowser } from './browserHarness.mjs';

const original = '---\ntitle: Original\ndate: 2026-11-09\ndraft: true\nauthors: [{name: Staff}]\ntags: [Maps]\ncustom: keep\n---\n\nEditable paragraph.\n\n<Unknown>Protected source.</Unknown>\n';
const fixture = `import React from 'react';
import { createRoot } from 'react-dom/client';
import ProjectEditor from '../src/components/editor/ProjectEditor.tsx';
import '../src/components/editor/editor.css';
import { parsePage, serializePage } from './page.mjs';
import { newBlog, postSlug } from './blog.mjs';
window.loadId = crypto.randomUUID(); window.requests = []; window.confirmCalls = 0; window.confirmMessages = []; window.allowLeave = false;
window.confirm = message => { window.confirmCalls++; window.confirmMessages.push(message); return window.allowLeave; };
if (!localStorage.getItem('test-repository')) localStorage.setItem('test-repository', JSON.stringify({ 'existing.mdx': { content: ${JSON.stringify(original)}, sha: 'base-1' } }));
window.readRepo = () => JSON.parse(localStorage.getItem('test-repository'));
window.changeServer = () => { const repo = window.readRepo(); repo['existing.mdx'] = { content: repo['existing.mdx'].content.replace('Original','Newer repository title'), sha: 'base-2' }; localStorage.setItem('test-repository',JSON.stringify(repo)); };
window.fetch = async (url, options = {}) => {
  const path = new URL(String(url), location.origin).pathname; window.requests.push({path, method:options.method||'GET'});
  if (path === '/api/session') return Response.json({ authenticated: true, login: localStorage.getItem('test-login') || 'tester', workspace: localStorage.getItem('test-workspace') || 'repo#staging' });
  const match = path.match(/^\\/api\\/content\\/posts(?:\\/(.+))?$/); if (!match) return Response.json({error:'Not found'}, {status:404});
  const filename = match[1] ? decodeURIComponent(match[1]) : '';
  const repo = window.readRepo();
  if (options.method === 'POST' || options.method === 'PUT') {
    if (window.failSave) return Response.json({error:'Save could not be confirmed.'}, {status:503});
    if (window.deferSave) await new Promise(resolve => { window.finishSave = resolve; });
    const input = JSON.parse(options.body); const name = filename || postSlug(input.title) + '.mdx';
    if ((!filename && repo[name]) || (filename && repo[name]?.sha !== input.sha)) return Response.json({error:'Conflict'}, {status:409});
    const content = filename ? serializePage(repo[name].content,input) : newBlog(input);
    repo[name] = { content, sha:'saved-' + crypto.randomUUID() }; localStorage.setItem('test-repository',JSON.stringify(repo));
    return Response.json({ filename:name, content, sha:repo[name].sha, commitSha:'saved-commit', ...parsePage(content) });
  }
  if (!filename) return Response.json({ branch:'custom-cms', entries:Object.entries(repo).map(([name,file])=>({name,path:'src/content/docs/posts/'+name,sha:file.sha})) });
  if (!repo[filename]) return Response.json({error:'Not found'}, {status:404});
  return Response.json({filename, ...repo[filename], ...parsePage(repo[filename].content)});
};
createRoot(document.getElementById('root')).render(React.createElement(ProjectEditor));`;
const options = { skip: chrome ? false : 'Chrome/Chromium is required.', timeout: 60_000 };
const title = `document.querySelector('.editor-fields input[required]')`;
const recoveryKeys = `[...Array(localStorage.length)].map((_,i)=>localStorage.key(i)).filter(key=>key.startsWith('geobtaa-editor-recovery:'))`;
async function fill(browser, value) { await browser.evaluate(`${title}.focus(); ${title}.select()`); await browser.send('Input.insertText', {text:value}); }
async function open(browser) {
  await browser.waitFor('!!document.querySelector(".dashboard-card")');
  await browser.evaluate('[...document.querySelectorAll(".dashboard-card")].find(button=>button.textContent.includes("Blog Posts")).click()');
  await browser.waitFor('!!document.querySelector(".project-list button")');
  await browser.evaluate('document.querySelector(".project-list button").click()');
  await browser.waitFor('!!document.querySelector(".editor-fields")');
}
const button = text => `[...document.querySelectorAll('button')].find(button=>button.textContent===${JSON.stringify(text)})`;
async function reload(browser) {
  const previous = await browser.evaluate('window.loadId');
  await browser.send('Page.reload');
  await browser.waitFor(`window.loadId && window.loadId !== ${JSON.stringify(previous)} && !!document.querySelector('.editor-fields')`);
}
async function allowNativeDialogs(browser) {
  await browser.send('Page.enable');
  const dialogs = [];
  browser.onEvent('Page.javascriptDialogOpening', event => { dialogs.push(event.type); void browser.send('Page.handleJavaScriptDialog', {accept:true}); });
  return dialogs;
}

test('routine recovery uses a list indicator and concise editor notice, without dashboard or listing panels', options, async () => {
  await withEditorBrowser(fixture, async browser => {
    const { evaluate, waitFor } = browser;
    await open(browser); await fill(browser, 'Routine unsaved work');
    await evaluate('document.querySelector(".editor-navigation .back").click()'); await answerLeaveDialog(browser);
    await waitFor('!!document.querySelector(".project-list")');
    await evaluate('document.querySelector(".editor-navigation .back").click()');
    await waitFor('!!document.querySelector(".dashboard-card")');
    assert.equal(await evaluate('document.querySelectorAll(".recovery-panel, .unsaved-documents, .recovery-options").length'), 0);
    assert.equal(await evaluate(`!!(${button('Find unsaved work')})`), false);
    await evaluate('[...document.querySelectorAll(".dashboard-card")].find(button => button.textContent.includes("Blog Posts")).click()');
    await waitFor('!!document.querySelector(".project-list .unsaved-indicator")');
    assert.equal(await evaluate('document.querySelector(".unsaved-indicator").textContent'), 'Unsaved edits');
    assert.equal(await evaluate('document.querySelectorAll(".recovery-panel, .unsaved-documents").length'), 0);
    await evaluate('document.querySelector(".project-list button").click()');
    await waitFor('!!document.querySelector(".recovery-notice")');
    assert.equal(await evaluate(`${title}.value`), 'Original', 'opening a list entry does not restore automatically');
    assert.equal(await evaluate('document.querySelector(".recovery-notice h2").textContent'), 'Unsaved changes available');
    assert.equal(await evaluate('document.querySelector(".recovery-notice p").textContent'), "You have changes from an earlier editing session that weren't saved to GitHub.");
    assert.deepEqual(await evaluate('[...document.querySelectorAll(".recovery-notice button")].map(button => button.textContent)'), ['Restore changes', 'Discard']);
    assert.equal(await evaluate('document.querySelectorAll(".recovery-notice time, .recovery-notice details, .recovery-notice select").length'), 0);
    await evaluate(`${button('Discard')}.click()`);
    assert.equal(await evaluate(`${recoveryKeys}.length`), 1, 'cancel preserves local work');
    await evaluate(`${button('Restore changes')}.click()`);
    await waitFor(`${title}.value === 'Routine unsaved work' && !document.querySelector('.top-save').disabled`);
    assert.match(await evaluate('document.querySelector(".message.success").textContent'), /restored changes.*not been confirmed saved/s);
    await evaluate('document.querySelector(".editor-navigation .back").click()'); await answerLeaveDialog(browser);
    await waitFor('!!document.querySelector(".project-list")');
    await evaluate('document.querySelector(".editor-navigation .back").click()');
    await open(browser);
    await evaluate(`window.allowLeave = true; ${button('Discard')}.click()`);
    await waitFor(`${recoveryKeys}.length === 0 && !document.querySelector('.recovery-notice')`);
    assert.equal(await evaluate(`${title}.value`), 'Original');
    assert.equal(await evaluate('window.readRepo()["existing.mdx"].sha'), 'base-1');
    assert.equal(await evaluate('window.requests.some(request => request.method !== "GET")'), false);
  });
});

for (const index of [0, 1]) test(`editor notice supports choosing divergent version ${index + 1}`, options, async () => {
  await withEditorBrowser(fixture, async browser => {
    const { evaluate, waitFor } = browser;
    await open(browser); await fill(browser, 'Latest work');
    await evaluate('document.querySelector(".editor-navigation .back").click()'); await answerLeaveDialog(browser);
    await waitFor('!!document.querySelector(".project-list")');
    await evaluate('document.querySelector(".editor-navigation .back").click()');
    await waitFor('!!document.querySelector(".dashboard-card")');
    await evaluate(`const key = ${recoveryKeys}[0]; const original = JSON.parse(localStorage.getItem(key));
      const older = { ...original, id: 'older-session', revision: 'older-revision', savedAt: '2000-01-01T00:00:00Z', fields: { ...original.fields, title: 'Older work' } };
      window.otherKey = key.slice(0, key.lastIndexOf(':') + 1) + older.id;
      localStorage.setItem(window.otherKey, JSON.stringify(older)); window.originalKey = key;`);
    await open(browser);
    assert.equal(await evaluate(`${title}.value`), 'Original');
    await evaluate(`${button('Restore changes')}.click()`);
    await waitFor('!!document.querySelector(".unsaved-versions")');
    assert.equal(await evaluate(`${title}.value`), 'Original', 'no divergent copy is silently applied');
    const other = await evaluate(`localStorage.getItem(${index ? 'window.originalKey' : 'window.otherKey'})`);
    await evaluate(`document.querySelectorAll('.unsaved-versions > ol > li')[${index}].querySelector('.recovery-copy-actions > button').click()`);
    await waitFor(`${title}.value === ${JSON.stringify(index ? 'Older work' : 'Latest work')} && !document.querySelector('.top-save').disabled`);
    assert.equal(await evaluate(`localStorage.getItem(${index ? 'window.originalKey' : 'window.otherKey'})`), other);
    assert.equal(await evaluate('window.requests.some(request => request.method !== "GET")'), false);
  });
});

test('browser Back/Forward follows editor screens, cancel restores URL and edits, and returning offers recovery', options, async () => {
  await withEditorBrowser(fixture, async browser => {
    await open(browser);
    assert.equal(await browser.evaluate('new URL(location.href).searchParams.get("file")'),'existing.mdx');
    await fill(browser,'Unsaved title');
    await browser.evaluate('document.querySelector(".rich-editor .tiptap").focus()'); await browser.send('Input.insertText',{text:'Unsaved body. '});
    await browser.evaluate('history.back()');
    await browser.waitFor('!!document.querySelector(".unsaved-changes-dialog[open]") && new URL(location.href).searchParams.get("file")==="existing.mdx"');
    await browser.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await browser.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await browser.waitFor('!document.querySelector(".unsaved-changes-dialog")');
    assert.equal(await browser.evaluate(`${title}.value`),'Unsaved title');
    await browser.evaluate('window.allowLeave=true; history.back()');
    await answerLeaveDialog(browser);
    await browser.waitFor('!!document.querySelector(".project-list") && !new URL(location.href).searchParams.has("file")');
    assert.ok(await browser.evaluate(`${recoveryKeys}.length > 0`));
    await browser.evaluate('history.forward()');
    await browser.waitFor(`!!(${button('Restore changes')})`);
    assert.equal(await browser.evaluate(`${title}.value`),'Original');
    await browser.evaluate(`${button('Restore changes')}.click()`);
    await browser.waitFor(`${title}.value==='Unsaved title' && !document.querySelector('.top-save').disabled`);
    assert.ok((await browser.evaluate('document.querySelector(".rich-editor .tiptap").textContent')).includes('Unsaved body.'));
    await browser.evaluate('document.querySelector(".top-save").click()');
    await browser.waitFor('document.querySelector(".top-save").disabled && document.querySelector(".top-save").textContent === "Save Draft"');
    assert.equal(await browser.evaluate(`${recoveryKeys}.length`),0);
    assert.ok((await browser.evaluate('window.readRepo()["existing.mdx"].content')).includes('<Unknown>Protected source.</Unknown>'));
  });
});

test('direct links reload to the same document; lifecycle backup recovers without GitHub writes and warnings stop after save', options, async () => {
  await withEditorBrowser(fixture, async browser => {
    const dialogs = await allowNativeDialogs(browser);
    await browser.waitFor('!!document.querySelector(".editor-fields")');
    await fill(browser,'Recovered after reload');
    // Reload before waiting for the debounce: beforeunload/pagehide flush it.
    await reload(browser);
    await browser.waitFor(`!!(${button('Restore changes')})`);
    assert.equal(await browser.evaluate(`${title}.value`),'Original');
    assert.equal(await browser.evaluate('window.readRepo()["existing.mdx"].sha'),'base-1');
    await browser.evaluate(`${button('Restore changes')}.click()`);
    await browser.waitFor(`${title}.value==='Recovered after reload' && !document.querySelector('.top-save').disabled`);
    await browser.evaluate('document.querySelector(".top-save").click()');
    await browser.waitFor('document.querySelector(".top-save").disabled && document.querySelector(".top-save").textContent === "Save Draft"');
    const dialogCount = dialogs.length;
    await reload(browser);
    assert.equal(await browser.evaluate(`${title}.value`),'Recovered after reload');
    assert.equal(await browser.evaluate(`${recoveryKeys}.length`),0);
    assert.equal(dialogs.length,dialogCount,'saved entries do not prompt on reload');
  }, {initialSearch:'?area=posts&file=existing.mdx'});
});

test('new drafts survive reload and failed saves; first successful save replaces the new-draft history entry', options, async () => {
  await withEditorBrowser(fixture, async browser => {
    await allowNativeDialogs(browser);
    await browser.waitFor('!!document.querySelector(".dashboard-card")');
    await browser.evaluate('[...document.querySelectorAll(".dashboard-card")].find(button=>button.textContent.includes("Blog Posts")).click()');
    await browser.waitFor('!!document.querySelector(".list-heading .primary")'); await browser.evaluate('document.querySelector(".list-heading .primary").click()');
    await browser.waitFor('!!document.querySelector(".editor-fields")');
    const draft = await browser.evaluate('new URL(location.href).searchParams.get("new")'); assert.ok(draft);
    await fill(browser,'New local draft');
    await browser.evaluate('window.failSave=true; document.querySelector(".top-save").click()');
    await browser.waitFor('!!document.querySelector(".message.error")');
    await reload(browser);
    assert.equal(await browser.evaluate('new URL(location.href).searchParams.get("new")'),draft);
    await browser.waitFor(`!!(${button('Restore changes')})`); await browser.evaluate(`${button('Restore changes')}.click()`);
    await browser.waitFor(`${title}.value==='New local draft' && !document.querySelector('.top-save').disabled`);
    await browser.evaluate('document.querySelector(".top-save").click()');
    await browser.waitFor('new URL(location.href).searchParams.get("file")==="new-local-draft.mdx"');
    assert.equal(await browser.evaluate('new URL(location.href).searchParams.has("new")'),false);
    assert.equal(await browser.evaluate(`${recoveryKeys}.length`),0);
    await browser.evaluate('history.back()'); await browser.waitFor('!!document.querySelector(".project-list")');
    assert.equal(await browser.evaluate('new URL(location.href).searchParams.get("area")'),'posts');
    await browser.evaluate('history.forward()'); await browser.waitFor('!!document.querySelector(".editor-fields")');
    assert.equal(await browser.evaluate(`${title}.value`),'New local draft');
  });
});

test('recovery checks the latest SHA at restore time and preserves stale copies for download', options, async () => {
  await withEditorBrowser(fixture, async browser => {
    await allowNativeDialogs(browser); await open(browser); await fill(browser,'Keep this recovery');
    await reload(browser); await browser.waitFor(`!!(${button('Restore changes')})`);
    await browser.evaluate('window.changeServer()');
    await browser.evaluate(`${button('Restore changes')}.click()`);
    await browser.waitFor(`${title}.value==='Newer repository title' && document.querySelector('.top-save').disabled`);
    assert.equal(await browser.evaluate(`!!(${button('Restore changes')})`),true);
    await browser.evaluate(`${button('Restore changes')}.click()`);
    assert.ok(await browser.evaluate(`${recoveryKeys}.length > 0`));
    await browser.evaluate(`window.downloaded=''; const originalCreate=URL.createObjectURL; URL.createObjectURL=blob=>{blob.text().then(text=>window.downloaded=text);return originalCreate(blob)}; HTMLAnchorElement.prototype.click=function(){}; [...document.querySelectorAll('.recovery-manager button')].find(button=>button.textContent==='Save backup file').click()`);
    await browser.waitFor('!!window.downloaded');
    assert.equal(JSON.parse(await browser.evaluate('window.downloaded')).fields.title,'Keep this recovery');
    assert.equal(await browser.evaluate('window.requests.some(request=>request.method==="PUT")'),false);
    await browser.evaluate(`window.allowLeave=true; ${button('Discard unsaved changes')}.click()`);
    await browser.waitFor(`${recoveryKeys}.length===0`);
    assert.equal(await browser.evaluate('window.readRepo()["existing.mdx"].sha'),'base-2');
  });
});

test('storage failure is visible, offers download, and retains the editor when leaving is canceled', options, async () => {
  await withEditorBrowser(fixture, async browser => {
    await open(browser);
    await browser.evaluate(`const save=Storage.prototype.setItem; Storage.prototype.setItem=function(key,value){if(key.startsWith('geobtaa-editor-recovery:'))throw new DOMException('Full','QuotaExceededError');return save.call(this,key,value)}`);
    await fill(browser,'Not backed up');
    await browser.waitFor('document.querySelector(".message.error")?.textContent.includes("Your unsaved changes could not be kept")');
    assert.ok((await browser.evaluate('document.querySelector(".recovery-status").textContent')).includes('unavailable'));
    assert.equal(await browser.evaluate(`${recoveryKeys}.length`),0);
    assert.ok(await browser.evaluate(`!!(${button('Download unsaved edits')})`));
    await browser.evaluate('history.back()');
    await browser.waitFor('!!document.querySelector(".unsaved-changes-dialog[open]") && new URL(location.href).searchParams.get("file")==="existing.mdx"');
    assert.match(await browser.evaluate('document.querySelector("#unsaved-changes-message").textContent'), /could not keep a recovery copy.*may be lost/);
    await answerLeaveDialog(browser, false);
    assert.equal(await browser.evaluate(`${title}.value`),'Not backed up');
  });
});

test('a deleted repository document retains its local copy without recreating or saving it', options, async () => {
  await withEditorBrowser(fixture, async browser => {
    await allowNativeDialogs(browser); await open(browser); await fill(browser,'Copy of deleted document');
    await browser.evaluate('localStorage.setItem("test-repository","{}")');
    const oldLoad = await browser.evaluate('window.loadId');
    await browser.send('Page.reload');
    await browser.waitFor(`window.loadId && window.loadId!==${JSON.stringify(oldLoad)} && !!(${button('Retry opening entry')})`);
    assert.equal(await browser.evaluate(`!!(${button('Find unsaved work')})`), false);
    assert.equal(await browser.evaluate(`!!(${button('Restore changes')})`),false);
    assert.ok(await browser.evaluate(`${recoveryKeys}.length>0`));
    assert.deepEqual(await browser.evaluate('window.readRepo()'),{});
  });
});

test('local copies are private to the signed-in account and workspace; navigation waits for a pending save', options, async () => {
  await withEditorBrowser(fixture, async browser => {
    await allowNativeDialogs(browser); await open(browser); await fill(browser,'Account one copy');
    await browser.evaluate('localStorage.setItem("test-login","another-user")'); await reload(browser);
    assert.equal(await browser.evaluate(`!!(${button('Restore changes')})`),false);
    assert.equal(await browser.evaluate(`${title}.value`),'Original');
    await browser.evaluate('localStorage.removeItem("test-login");localStorage.setItem("test-workspace","another-repo#branch")'); await reload(browser);
    assert.equal(await browser.evaluate(`!!(${button('Restore changes')})`),false);
    await browser.evaluate('localStorage.removeItem("test-workspace")'); await reload(browser); await browser.waitFor(`!!(${button('Restore changes')})`);
    await browser.evaluate(`${button('Restore changes')}.click()`); await browser.waitFor(`${title}.value==='Account one copy' && !document.querySelector('.top-save').disabled`);
    await browser.evaluate('window.deferSave=true; document.querySelector(".top-save").click()'); await browser.waitFor('!!window.finishSave');
    await browser.evaluate('history.back()');
    await browser.waitFor('new URL(location.href).searchParams.get("file")==="existing.mdx"');
    assert.equal(await browser.evaluate(`${title}.value`),'Account one copy');
    await browser.evaluate('window.finishSave()'); await browser.waitFor('document.querySelector(".top-save").disabled && document.querySelector(".top-save").textContent === "Save Draft"');
    assert.equal(await browser.evaluate(`${recoveryKeys}.length`),0);
  });
});

test('Save backup file in Recovery options downloads current unsaved work without a save or reload', options, async()=>{
 await withEditorBrowser(fixture,async browser=>{
  const {evaluate,waitFor}=browser;
  await open(browser);await fill(browser,'Current unsaved backup');
  await evaluate(`window.downloaded='';window.downloadName='';const create=URL.createObjectURL;URL.createObjectURL=blob=>{blob.text().then(text=>window.downloaded=text);return create(blob);};HTMLAnchorElement.prototype.click=function(){window.downloadName=this.download;};`);
  const writes=await evaluate('window.requests.filter(r=>r.method!=="GET").length');
  await evaluate('document.querySelector(".recovery-file-options").open=true;document.querySelector(".recovery-file-options .save-backup").click()');
  await waitFor('!!window.downloaded');
  const copy=JSON.parse(await evaluate('window.downloaded'));
  assert.equal(copy.fields.title,'Current unsaved backup');
  assert.equal(copy.route.filename,'existing.mdx');
  assert.equal(copy.baseSha,'base-1');
  assert.match(await evaluate('window.downloadName'),/^unsaved-changes-backup-.*\.json$/);
  assert.equal(await evaluate('window.requests.filter(r=>r.method!=="GET").length'),writes);
  assert.equal(await evaluate(`${title}.value`),'Current unsaved backup');
  assert.equal(await evaluate('document.querySelector(".top-save").disabled'),false);
 });
});

async function chooseBackup(browser, source, name='backup.json') {
  await browser.evaluate(`(() => {const transfer=new DataTransfer();transfer.items.add(new File([${JSON.stringify(source)}],${JSON.stringify(name)},{type:'application/json'}));const input=document.querySelector('.recovery-file-options input[type=file]');input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`);
}
async function downloadedCopy(browser) {
  await browser.evaluate(`(()=>{window.downloaded='';const create=URL.createObjectURL;URL.createObjectURL=blob=>{blob.text().then(text=>window.downloaded=text);return create(blob);};HTMLAnchorElement.prototype.click=function(){};document.querySelector('.recovery-file-options').open=true;document.querySelector('.save-backup').click();})()`);
  await browser.waitFor('!!window.downloaded');
  return JSON.parse(await browser.evaluate('window.downloaded'));
}

test('Recovery options is unobtrusive, links to help, and restores a downloaded backup only after confirmation',options,async()=>{
 await withEditorBrowser(fixture,async browser=>{
  const {evaluate,waitFor,send}=browser;
  await open(browser);
  assert.equal(await evaluate('document.querySelector(".recovery-file-options").open'),false);
  assert.equal(await evaluate('document.querySelector(".document-toolbar .save-backup")'),null);
  assert.doesNotMatch(await evaluate('document.body.innerText'),/Save backup file|Restore backup file|Did something go wrong/);
  await evaluate('document.querySelector(".recovery-file-options summary").focus()');
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r'});
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  await waitFor('document.querySelector(".recovery-file-options").open');
  assert.equal(await evaluate('document.querySelector(".recovery-file-panel > a").href'),'https://github.com/geobtaa/geobtaa.github.io/blob/main/docs/CMS_USER_GUIDE.md#troubleshooting-and-common-errors');
  for(const width of [1280,390,320]){
   await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<500});
   assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
   assert.equal(await evaluate('(()=>{const r=document.querySelector(".recovery-file-panel").getBoundingClientRect();return r.left>=0&&r.right<=innerWidth})()'),true);
  }
  await fill(browser,'Backed up title');const copy=await downloadedCopy(browser);
  await allowNativeDialogs(browser);await reload(browser);
  await waitFor(`${title}?.value==='Original'`);
  await evaluate('document.querySelector(".recovery-file-options").open=true');
  await chooseBackup(browser,JSON.stringify(copy));await waitFor('document.querySelector(".backup-restore-dialog")?.open');
  assert.equal(await evaluate(`${title}.value`),'Original');
  assert.match(await evaluate('document.querySelector(".backup-restore-dialog").textContent'),/Backed up title/);
  await evaluate('document.querySelector(".backup-restore-dialog button").click()');
  await waitFor('!document.querySelector(".backup-restore-dialog")');
  assert.equal(await evaluate(`${title}.value`),'Original');
  const before=await evaluate('window.requests.filter(r=>r.method!=="GET").length');
  await chooseBackup(browser,JSON.stringify(copy));await waitFor('document.querySelector(".backup-restore-dialog")?.open');
  await evaluate('document.querySelector(".confirm-backup-restore").click()');
  await waitFor(`${title}.value==='Backed up title' && !document.querySelector('.backup-restore-dialog')`);
  assert.equal(await evaluate('window.requests.filter(r=>r.method!=="GET").length'),before,'restoring a file never saves or publishes');
  assert.match(await evaluate('document.body.innerText'),/Review them, then choose Save Draft/);
  await evaluate('document.querySelector(".top-save").click()');
  await waitFor('document.querySelector(".top-save").disabled && document.querySelector(".top-save").textContent==="Save Draft"');
  assert.match(await evaluate('window.readRepo()["existing.mdx"].content'),/Backed up title/);
 });
});

test('file recovery rejects invalid, wrong-page, oversized and stale backups without replacing the current page',options,async()=>{
 await withEditorBrowser(fixture,async browser=>{
  const {evaluate,waitFor}=browser;await open(browser);const copy=await downloadedCopy(browser);
  for(const source of ['{',JSON.stringify({...copy,version:2}),JSON.stringify({...copy,fields:{...copy.fields,sha:'invented'}}),JSON.stringify({...copy,route:{area:'posts',filename:'other.mdx'},fields:{...copy.fields,filename:'other.mdx'}})]){
   await chooseBackup(browser,source);await waitFor('!!document.querySelector(".recovery-file-panel [role=alert]")');
   assert.equal(await evaluate('!!document.querySelector(".backup-restore-dialog")'),false);
   assert.equal(await evaluate(`${title}.value`),'Original');
  }
  await evaluate(`(()=>{const file=new File(['{}'],'large.json',{type:'application/json'});Object.defineProperty(file,'size',{value:200*1024*1024});const transfer=new DataTransfer();transfer.items.add(file);const input=document.querySelector('.recovery-file-options input');input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await waitFor('document.querySelector(".recovery-file-error")?.textContent.includes("too large")');
  await chooseBackup(browser,JSON.stringify(copy));await waitFor('document.querySelector(".backup-restore-dialog")?.open');
  await evaluate('window.editorBefore=document.querySelector(".rich-editor .tiptap");window.changeServer()');
  await evaluate('document.querySelector(".confirm-backup-restore").click()');
  await waitFor('document.querySelector(".backup-restore-dialog [role=alert]")?.textContent.includes("saved page has changed")');
  assert.equal(await evaluate(`${title}.value`),'Original');
  assert.equal(await evaluate('document.querySelector(".rich-editor .tiptap")===window.editorBefore'),true);
  assert.equal(await evaluate('window.requests.some(r=>r.method!=="GET")'),false);
 });
});

test('current unsaved edits block file restoration but remain downloadable, including when storage fails',options,async()=>{
 await withEditorBrowser(fixture,async browser=>{
  const {evaluate,waitFor}=browser;await open(browser);const copy=await downloadedCopy(browser);
  await evaluate('Storage.prototype.setItem=function(){throw new Error("Storage full")};');
  await fill(browser,'Keep my current edits');
  await waitFor('document.querySelector(".restore-backup").disabled');
  await waitFor('document.querySelector(".message.error")?.textContent.includes("could not be kept")');
  await chooseBackup(browser,JSON.stringify(copy));
  assert.equal(await evaluate('!!document.querySelector(".backup-restore-dialog")'),false);
  const current=await downloadedCopy(browser);
  assert.equal(current.fields.title,'Keep my current edits');
  assert.equal(await evaluate(`${title}.value`),'Keep my current edits');
 });
});

test('a never-saved backup can restore into a blank new page in the same area, preserving creation retry information',options,async()=>{
 await withEditorBrowser(fixture,async browser=>{
  const {evaluate,waitFor}=browser;
  await waitFor('!!document.querySelector(".body-editor")');
  const copy=await downloadedCopy(browser);
  copy.route={area:'posts',draftId:'original-new-page'};
  copy.fields.title='Restored new article';copy.fields.filename='';copy.fields.body='Unsaved article body.';
  copy.fields.creationAttempt={id:'original-creation-attempt-1234',filename:'original-article.mdx'};
  await chooseBackup(browser,JSON.stringify(copy));await waitFor('document.querySelector(".backup-restore-dialog")?.open');
  await evaluate('document.querySelector(".confirm-backup-restore").click()');
  await waitFor(`${title}.value==='Restored new article' && !document.querySelector('.backup-restore-dialog')`);
  const roundtrip=await downloadedCopy(browser);
  assert.deepEqual(roundtrip.fields.creationAttempt,copy.fields.creationAttempt);
  assert.equal(roundtrip.fields.body,'Unsaved article body.');
  assert.equal(await evaluate('window.requests.some(r=>r.method!=="GET")'),false);
 },{initialSearch:'?area=posts&new=blank-new-page'});
});

test('a delayed file read cannot apply after navigation, and a changed form invalidates confirmation',options,async()=>{
 await withEditorBrowser(fixture,async browser=>{
  const {evaluate,waitFor}=browser;await open(browser);const copy=await downloadedCopy(browser);
  copy.fields.title='Imported title';
  await evaluate('window.fileText=File.prototype.text;File.prototype.text=function(){return new Promise(resolve=>{window.finishBackupRead=resolve})};');
  await chooseBackup(browser,JSON.stringify(copy));await waitFor('!!window.finishBackupRead');
  await evaluate('document.querySelector(".editor-navigation .back").click()');await waitFor('!!document.querySelector(".project-list button")');
  await evaluate(`window.finishBackupRead(${JSON.stringify(JSON.stringify(copy))});File.prototype.text=window.fileText;document.querySelector('.project-list button').click()`);
  await waitFor(`${title}?.value==='Original'`);
  assert.equal(await evaluate('!!document.querySelector(".backup-restore-dialog")'),false);
  await evaluate('document.querySelector(".recovery-file-options").open=true');
  await chooseBackup(browser,JSON.stringify(copy));await waitFor('document.querySelector(".backup-restore-dialog")?.open');
  await evaluate(`{const input=${title};Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'Edits made after selection');input.dispatchEvent(new Event('input',{bubbles:true}));}`);
  await waitFor('!document.querySelector(".backup-restore-dialog")');
  assert.equal(await evaluate(`${title}.value`),'Edits made after selection');
  assert.match(await evaluate('document.querySelector(".recovery-file-error").textContent'),/open page changed/);
  assert.equal(await evaluate('window.requests.some(r=>r.method!=="GET")'),false);
 });
});
