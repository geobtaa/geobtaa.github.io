import assert from 'node:assert/strict';
import test from 'node:test';
import { chrome, withEditorBrowser } from './browserHarness.mjs';

const original = '---\ntitle: Original\ndate: 2026-11-09\ndraft: true\nauthors: [{name: Staff}]\ntags: [Maps]\ncustom: keep\n---\n\nEditable paragraph.\n\n<Unknown>Protected source.</Unknown>\n';
const fixture = `import React from 'react';
import { createRoot } from 'react-dom/client';
import ProjectEditor from '../src/components/editor-prototype/ProjectEditor.tsx';
import '../src/components/editor-prototype/editor.css';
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

test('dashboard resumes unsaved work with one primary action, then discards only after confirmation', options, async () => {
  await withEditorBrowser(fixture, async browser => {
    const { evaluate, waitFor, send } = browser;
    await open(browser);
    await fill(browser, 'Work to resume');
    await evaluate('document.querySelector(".rich-editor .tiptap").editor.commands.focus("end")');
    await waitFor('document.activeElement === document.querySelector(".rich-editor .tiptap")');
    await send('Input.insertText', { text: ' Unsaved body to resume.' });
    await evaluate('document.querySelector(".dashboard-link").click()');
    assert.equal(await evaluate(`${title}.value`), 'Work to resume', 'cancel keeps the live document open');
    assert.match(await evaluate('window.confirmMessages.at(-1)'), /kept only in this browser.*Resume editing/);
    await evaluate('window.allowLeave = true; document.querySelector(".dashboard-link").click()');
    await waitFor(`!!(${button('Resume editing')})`);
    assert.equal(await evaluate('document.querySelector(".recovery-panel h2").textContent'), 'Unsaved changes');
    assert.equal(await evaluate(`${button('Resume editing')}.classList.contains('primary')`), true);
    assert.match(await evaluate('document.querySelector(".recovery-panel").textContent'), /only in this browser.*not been confirmed saved to GitHub/s);
    assert.ok(await evaluate(`!!(${button('Download backup')})`));
    await evaluate(`${button('Resume editing')}.click()`);
    await waitFor(`${title}?.value === 'Work to resume' && !document.querySelector('.top-save').disabled`);
    assert.match(await evaluate('document.querySelector(".rich-editor .tiptap").textContent'), /Unsaved body to resume/);
    assert.match(await evaluate('document.querySelector(".message.success").textContent'), /restored changes are now displayed.*not been confirmed saved to GitHub/);
    assert.equal(await evaluate('document.querySelector(".save-state").textContent'), 'Unsaved changes');
    await waitFor(`${recoveryKeys}.length === 1`);
    assert.equal(await evaluate('window.readRepo()["existing.mdx"].sha'), 'base-1');
    assert.equal(await evaluate('window.requests.some(request => request.method !== "GET")'), false, 'resuming never saves to GitHub');
    await evaluate('document.querySelector(".dashboard-link").click()');
    await waitFor(`!!(${button('Discard unsaved changes')})`);
    const stored = await evaluate(`${recoveryKeys}.map(key => localStorage.getItem(key))`);
    await evaluate(`window.allowLeave = false; ${button('Discard unsaved changes')}.click()`);
    assert.deepEqual(await evaluate(`${recoveryKeys}.map(key => localStorage.getItem(key))`), stored);
    assert.match(await evaluate('window.confirmMessages.at(-1)'), /Work to resume.*permanently removes.*cannot undo.*GitHub will not change/);
    await evaluate(`window.allowLeave = true; ${button('Discard unsaved changes')}.click()`);
    await waitFor(`${recoveryKeys}.length === 0 && !document.querySelector('.recovery-panel')`);
    await open(browser);
    assert.equal(await evaluate(`${title}.value`), 'Original');
    assert.equal(await evaluate(`!!(${button('Restore changes')})`), false);
    assert.equal(await evaluate('window.requests.some(request => request.method !== "GET")'), false);
  });
});

test('dashboard resume keeps changed GitHub content open and retains unsaved work as a backup', options, async () => {
  await withEditorBrowser(fixture, async browser => {
    const { evaluate, waitFor } = browser;
    await open(browser); await fill(browser, 'Do not overwrite GitHub');
    await evaluate('window.allowLeave = true; document.querySelector(".dashboard-link").click()');
    await waitFor(`!!(${button('Resume editing')})`);
    await evaluate(`window.changeServer(); ${button('Resume editing')}.click()`);
    await waitFor(`${title}?.value === 'Newer repository title' && !document.querySelector('.top-save').disabled`);
    assert.match(await evaluate('document.querySelector(".recovery-panel").textContent'), /unsaved changes have not been applied/);
    assert.equal(await evaluate(`!!(${button('Restore changes')})`), false);
    assert.equal(await evaluate('!!document.querySelector(".message.success")'), false);
    assert.equal(await evaluate(`${recoveryKeys}.length`), 1);
    assert.equal(await evaluate(`JSON.parse(localStorage.getItem(${recoveryKeys}[0])).fields.title`), 'Do not overwrite GitHub');
    assert.equal(await evaluate('window.requests.some(request => request.method !== "GET")'), false);
  });
});

test('discard refuses to delete unsaved work updated in another tab', options, async () => {
  await withEditorBrowser(fixture, async browser => {
    const { evaluate, waitFor } = browser;
    await open(browser); await fill(browser, 'Earlier version');
    await evaluate('window.allowLeave = true; document.querySelector(".dashboard-link").click()');
    await waitFor(`!!(${button('Discard unsaved changes')})`);
    await evaluate(`window.keyToKeep = ${recoveryKeys}[0];
      const updated = JSON.parse(localStorage.getItem(window.keyToKeep));
      updated.revision = 'changed-in-another-tab'; updated.fields.title = 'Newer unsaved work';
      localStorage.setItem(window.keyToKeep, JSON.stringify(updated));
      ${button('Discard unsaved changes')}.click();`);
    await waitFor('document.querySelector(".message.error")?.textContent.includes("another tab")');
    assert.equal(await evaluate('JSON.parse(localStorage.getItem(window.keyToKeep)).fields.title'), 'Newer unsaved work');
    assert.match(await evaluate('document.querySelector(".recovery-panel").textContent'), /Newer unsaved work/);
  });
});

test('browser Back/Forward follows editor screens, cancel restores URL and edits, and returning offers recovery', options, async () => {
  await withEditorBrowser(fixture, async browser => {
    await open(browser);
    assert.equal(await browser.evaluate('new URL(location.href).searchParams.get("file")'),'existing.mdx');
    await fill(browser,'Unsaved title');
    await browser.evaluate('document.querySelector(".rich-editor .tiptap").focus()'); await browser.send('Input.insertText',{text:'Unsaved body. '});
    await browser.evaluate('history.back()');
    await browser.waitFor('window.confirmCalls===1 && new URL(location.href).searchParams.get("file")==="existing.mdx"');
    assert.equal(await browser.evaluate(`${title}.value`),'Unsaved title');
    await browser.evaluate('window.allowLeave=true; history.back()');
    await browser.waitFor('!!document.querySelector(".project-list") && !new URL(location.href).searchParams.has("file")');
    assert.ok(await browser.evaluate(`${recoveryKeys}.length > 0`));
    await browser.evaluate('history.forward()');
    await browser.waitFor(`!!(${button('Restore changes')})`);
    assert.equal(await browser.evaluate(`${title}.value`),'Original');
    await browser.evaluate(`${button('Restore changes')}.click()`);
    await browser.waitFor(`${title}.value==='Unsaved title' && !document.querySelector('.top-save').disabled`);
    assert.ok((await browser.evaluate('document.querySelector(".rich-editor .tiptap").textContent')).includes('Unsaved body.'));
    await browser.evaluate('document.querySelector(".top-save").click()');
    await browser.waitFor('document.querySelector(".save-state").textContent==="No unsaved changes"');
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
    await browser.waitFor('document.querySelector(".save-state").textContent==="No unsaved changes"');
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
    await browser.waitFor(`${title}.value==='Newer repository title' && !document.querySelector('.top-save').disabled`);
    assert.equal(await browser.evaluate(`!!(${button('Restore changes')})`),false);
    assert.ok(await browser.evaluate(`${recoveryKeys}.length > 0`));
    await browser.evaluate(`window.downloaded=''; const originalCreate=URL.createObjectURL; URL.createObjectURL=blob=>{blob.text().then(text=>window.downloaded=text);return originalCreate(blob)}; HTMLAnchorElement.prototype.click=function(){}; ${button('Download backup')}.click()`);
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
    await browser.waitFor('window.confirmCalls===1 && new URL(location.href).searchParams.get("file")==="existing.mdx"');
    assert.equal(await browser.evaluate(`${title}.value`),'Not backed up');
  });
});

test('a deleted repository document still leaves its local copy downloadable without recreating or saving it', options, async () => {
  await withEditorBrowser(fixture, async browser => {
    await allowNativeDialogs(browser); await open(browser); await fill(browser,'Copy of deleted document');
    await browser.evaluate('localStorage.setItem("test-repository","{}")');
    const oldLoad = await browser.evaluate('window.loadId');
    await browser.send('Page.reload');
    await browser.waitFor(`window.loadId && window.loadId!==${JSON.stringify(oldLoad)} && !!(${button('Retry opening entry')})`);
    await browser.waitFor(`!!(${button('Download backup')})`);
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
    await browser.evaluate('window.finishSave()'); await browser.waitFor('document.querySelector(".save-state").textContent==="No unsaved changes"');
    assert.equal(await browser.evaluate(`${recoveryKeys}.length`),0);
  });
});
