import assert from 'node:assert/strict';
import test from 'node:test';
import { answerLeaveDialog, chrome, withEditorBrowser } from './browserHarness.mjs';

const original = '---\ntitle: Existing\ndate: 2026-11-14\ndraft: true\n---\n\nEditable paragraph.\n\n<Unknown>Protected source.</Unknown>\n';
const fixture = `import React from 'react';
import { createRoot } from 'react-dom/client';
import ProjectEditor from '../src/components/editor-prototype/ProjectEditor.tsx';
import '../src/components/editor-prototype/editor.css';
import { creationTestRepository } from './creationTestRepository.mjs';
import { createBlogCommit } from './blogStorage.mjs';
import { gitBlobSha } from './articleCreation.mjs';
import { saveBlog, parseBlog } from './blog.mjs';
import { saveProgramUpdate, parseProgramUpdate } from './programUpdates.mjs';
window.loadId = crypto.randomUUID(); window.authenticated = true; window.login = 'tester'; window.workspace = 'repo#staging'; window.writes = [];
window.area = new URL(location.href).searchParams.get('area') || 'posts';
window.repo = creationTestRepository({ state: JSON.parse(localStorage.getItem('test-git-state') || 'null') || undefined, persist: state => localStorage.setItem('test-git-state', JSON.stringify(state)) });
const prefix = 'src/content/docs/' + window.area + '/';
if (!window.repo.state.trees.initial[prefix + 'existing.mdx']) window.repo.state.trees.initial[prefix + 'existing.mdx'] = { content: ${JSON.stringify(original)}, sha: await gitBlobSha(${JSON.stringify(original)}) };
window.files = () => window.repo.state.trees[window.repo.state.commits[window.repo.state.head].tree];
const github = {
  createBlog: input => createBlogCommit({ request: window.repo.request, ensureBranch: async () => {}, branch: 'custom-cms', area: window.area, ...input }),
  getContent: async (area, filename) => ({ filename, ...window.files()[prefix + filename] }),
  saveContent: async ({ filename, content, sha }) => {
    if (window.files()[prefix + filename]?.sha !== sha) throw Object.assign(new Error('Conflict'), { status: 409 });
    const savedSha = await gitBlobSha(content); window.files()[prefix + filename] = { content, sha: savedSha };
    localStorage.setItem('test-git-state', JSON.stringify(window.repo.state)); return { sha: savedSha, commitSha: 'updated-commit' };
  },
};
window.fetch = async (url, options = {}) => {
  const path = new URL(String(url), location.origin).pathname;
  if (path === '/api/session') return Response.json(window.authenticated ? { authenticated: true, login: window.login, workspace: window.workspace } : { authenticated: false });
  if (!window.authenticated) return Response.json({ error: window.authError || 'Your editor session has expired. Sign in again.' }, { status: 401 });
  const filename = decodeURIComponent(path.replace('/api/content/' + window.area, '').replace(/^\\//, ''));
  if (options.method === 'POST' || options.method === 'PUT') {
    const input = JSON.parse(options.body); window.writes.push({ path, input });
    const attempts = JSON.parse(localStorage.getItem('test-attempts') || '[]'); attempts.push(input); localStorage.setItem('test-attempts', JSON.stringify(attempts));
    let saved;
    try { saved = await (window.area === 'posts' ? saveBlog : saveProgramUpdate)(github, filename || null, input); }
    catch (error) { return Response.json({ error: error.message, creationState: error.creationState, suggestedFilename: error.suggestedFilename }, { status: error.status || 500 }); }
    const fault = window.responseFault; window.responseFault = '';
    if (fault === 'lost') throw new TypeError('Response lost after successful server commit');
    if (fault === 'malformed') return Response.json({});
    return Response.json(saved);
  }
  if (!filename) return Response.json({ branch: 'custom-cms', entries: Object.entries(window.files()).filter(([path]) => path.startsWith(prefix)).map(([path, file]) => ({ name: path.slice(prefix.length), path, sha: file.sha })) });
  const file = window.files()[prefix + filename];
  return Response.json({ filename, ...file, ...(window.area === 'posts' ? parseBlog : parseProgramUpdate)(file.content) });
};
createRoot(document.getElementById('root')).render(React.createElement(ProjectEditor));`;
const options = { skip: chrome ? false : 'Chrome/Chromium is required.', timeout: 45_000 };
const title = `document.querySelector('.editor-fields input[required]')`;
const button = label => `[...document.querySelectorAll('button')].find(button => button.textContent === ${JSON.stringify(label)})`;
const authPanel = `document.querySelector('[aria-label="Sign-in required"]')`;
async function fillTitle(browser, value) {
  await browser.evaluate(`${title}.focus(); ${title}.select()`);
  await browser.send('Input.insertText', { text: value });
}

test('expiration preserves live editors, undo and Preview; resuming requires the same account and workspace', options, async () => {
  await withEditorBrowser(fixture, async browser => {
    const { evaluate, waitFor, send } = browser;
    await waitFor('!!document.querySelector(".rich-editor .tiptap")');
    await fillTitle(browser, 'Unsaved title');
    await evaluate('window.originalEditor = document.querySelector(".rich-editor .tiptap"); window.originalView = window.originalEditor.editor.view; window.originalEditor.editor.commands.focus("end")');
    await waitFor('document.activeElement === window.originalEditor');
    await send('Input.insertText', { text: ' Unsaved body.' });
    await evaluate(`${button('Preview')}.click()`);
    await waitFor('!!document.querySelector(".cms-preview")');
    await evaluate('window.authenticated = false; window.authError = { unexpected: "malformed error response" }; document.querySelector(".top-save").click()');
    await waitFor(`!!${authPanel}`);
    assert.equal(await evaluate('window.originalEditor.editor.view === window.originalView'), true);
    assert.equal(await evaluate('window.originalEditor.isConnected'), true);
    assert.match(await evaluate('document.querySelector(".cms-preview").textContent'), /Unsaved body/);
    const signIn = await evaluate(`(() => { const a = document.querySelector('[aria-label="Sign-in required"] a'); return { target: a.target, rel: a.rel, href: a.href }; })()`);
    assert.equal(signIn.target, '_blank'); assert.match(signIn.rel, /noopener/);
    assert.match(new URL(signIn.href).searchParams.get('returnTo'), /area=posts&file=existing.mdx/);
    assert.ok(await evaluate('Object.keys(localStorage).some(key => key.startsWith("geobtaa-editor-recovery:"))'));
    await evaluate(`${button('Check sign-in')}.click()`);
    await waitFor(`${authPanel}.textContent.includes("still required")`);
    for (const [login, workspace] of [['someone-else', 'repo#staging'], ['tester', 'another-workspace']]) {
      await evaluate(`window.authenticated = true; window.login = ${JSON.stringify(login)}; window.workspace = ${JSON.stringify(workspace)}; ${button('Check sign-in')}.click()`);
      await waitFor(`${authPanel}.textContent.includes("different account or workspace")`);
      assert.equal(await evaluate('document.querySelector(".top-save").disabled'), true);
      assert.equal(await evaluate('window.writes.length'), 0);
    }
    await evaluate(`window.login = 'tester'; window.workspace = 'repo#staging'; ${button('Check sign-in')}.click()`);
    await waitFor(`!${authPanel}`);
    assert.equal(await evaluate('window.originalEditor.editor.view === window.originalView'), true);
    assert.equal(await evaluate(`${title}.value`), 'Unsaved title');
    assert.equal(await evaluate('!!document.querySelector(".cms-preview")'), true);
    await evaluate(`${button('Edit')}.click(); window.originalEditor.editor.commands.undo()`);
    assert.equal(await evaluate('window.originalEditor.textContent.includes("Unsaved body")'), false);
    await evaluate('window.originalEditor.editor.commands.redo()');
    await waitFor('window.originalEditor.textContent.includes("Unsaved body")');
    await evaluate('document.querySelector(".top-save").click()');
    await waitFor('document.querySelector(".save-state").textContent === "No unsaved changes"');
    assert.equal(await evaluate('window.writes[0].input.title'), 'Unsaved title');
    assert.match(await evaluate('window.writes[0].input.body'), /Unsaved body/);
  }, { initialSearch: '?area=posts&file=existing.mdx' });
});

test('lost article responses survive recovery and retry one creation while retaining later edits', options, async () => {
  await withEditorBrowser(fixture, async browser => {
    const { evaluate, waitFor, send } = browser;
    await send('Page.enable');
    browser.onEvent('Page.javascriptDialogOpening', () => { void send('Page.handleJavaScriptDialog', { accept: true }); });
    await waitFor('!!document.querySelector(".editor-fields")');
    await fillTitle(browser, 'Original article');
    await evaluate('document.querySelector(".rich-editor .tiptap").editor.commands.focus("end")');
    await waitFor('document.activeElement === document.querySelector(".rich-editor .tiptap")');
    await send('Input.insertText', { text: 'Original article body.' });
    await evaluate('window.responseFault = "lost"; document.querySelector(".top-save").click()');
    await waitFor('document.querySelector(".top-save").textContent === "Retry creation safely" && !document.querySelector(".top-save").disabled');
    assert.match(await evaluate('document.querySelector(".message.error").textContent'), /Creation is not confirmed/);
    await fillTitle(browser, 'Later title');
    await evaluate('document.querySelector(".rich-editor .tiptap").editor.commands.focus("end")');
    await waitFor('document.activeElement === document.querySelector(".rich-editor .tiptap")');
    await send('Input.insertText', { text: ' Later body edits.' });
    await waitFor(`Object.keys(localStorage).filter(key => key.startsWith('geobtaa-editor-recovery:')).some(key => { const copy = JSON.parse(localStorage.getItem(key)); return copy.fields.title === 'Later title' && copy.fields.body.includes('Later body edits.'); })`);
    const previous = await evaluate('window.loadId');
    await send('Page.reload');
    await waitFor(`window.loadId !== ${JSON.stringify(previous)} && !!(${button('Restore changes')})`);
    await evaluate(`${button('Restore changes')}.click()`);
    await waitFor(`${title}.value === 'Later title' && !document.querySelector('.top-save').disabled`);
    await evaluate('window.pendingEditor = document.querySelector(".rich-editor .tiptap"); document.querySelector(".top-save").click()');
    await waitFor('new URL(location.href).searchParams.get("file") === "original-article.mdx"');
    assert.equal(await evaluate('document.querySelector(".rich-editor .tiptap") === window.pendingEditor'), true);
    assert.equal(await evaluate(`${title}.value`), 'Later title');
    assert.match(await evaluate('window.pendingEditor.textContent'), /Later body edits/);
    assert.equal(await evaluate('document.querySelector(".save-state").textContent'), 'Unsaved changes');
    const attempts = await evaluate('JSON.parse(localStorage.getItem("test-attempts"))');
    assert.equal(attempts[0].creationId, attempts[1].creationId);
    assert.equal(attempts[0].creationFilename, attempts[1].creationFilename);
    assert.equal(await evaluate('Object.values(window.repo.state.commits).filter(commit => commit.message.includes("CMS-Creation:")).length'), 1);
    assert.equal(await evaluate('Object.keys(window.files()).some(path => path.endsWith("later-title.mdx"))'), false);
    await evaluate('document.querySelector(".top-save").click()');
    await waitFor('document.querySelector(".save-state").textContent === "No unsaved changes"');
    assert.match(await evaluate('window.files()["src/content/docs/posts/original-article.mdx"].content'), /Later title/);
  }, { initialSearch: '?area=posts&new=uncertain-creation' });
});

test('malformed update responses cannot mark a draft saved or create a suffixed duplicate', options, async () => {
  await withEditorBrowser(fixture, async ({ evaluate, waitFor, send }) => {
    await waitFor('!!document.querySelector(".editor-fields")');
    await evaluate(`${button('Start blank')}.click(); ${title}.focus()`);
    await send('Input.insertText', { text: 'Monthly update' });
    await evaluate('window.responseFault = "malformed"; document.querySelector(".top-save").click()');
    await waitFor('document.querySelector(".top-save").textContent === "Retry creation safely" && !document.querySelector(".top-save").disabled');
    assert.match(await evaluate('location.search'), /new=/);
    assert.equal(await evaluate('!!document.querySelector(".message.success")'), false);
    await evaluate('document.querySelector(".top-save").click()');
    await waitFor('new URL(location.href).searchParams.get("file") === "monthly-update.mdx"');
    assert.equal(await evaluate('document.querySelector(".save-state").textContent'), 'No unsaved changes');
    assert.equal(await evaluate('Object.values(window.repo.state.commits).filter(commit => commit.message.includes("CMS-Creation:")).length'), 1);
  }, { initialSearch: '?area=updates&new=malformed-creation' });
});

test('returning to the original editor URL preserves an uncertain creation and retries the original article once', options, async () => {
  await withEditorBrowser(fixture, async browser => {
    const { evaluate, waitFor, send } = browser;
    await send('Page.enable');
    browser.onEvent('Page.javascriptDialogOpening', () => { void send('Page.handleJavaScriptDialog', { accept: true }); });
    await waitFor('!!document.querySelector(".editor-fields")');
    await fillTitle(browser, 'Interrupted dashboard draft');
    await evaluate('window.responseFault = "lost"; document.querySelector(".top-save").click()');
    await waitFor('document.querySelector(".top-save").textContent === "Retry creation safely" && !document.querySelector(".top-save").disabled');
    const originalDraftUrl = await evaluate('location.href');
    await evaluate('document.querySelector(".editor-navigation .back").click()');
    await answerLeaveDialog(browser);
    assert.equal(await evaluate(`!!(${button('Find unsaved work')})`), false);
    await evaluate('history.back()');
    await waitFor(`!!(${button('Restore changes')})`);
    assert.equal(await evaluate('location.href'), originalDraftUrl);
    await evaluate(`const key = Object.keys(localStorage).find(key => key.startsWith('geobtaa-editor-recovery:'));
      const original = JSON.parse(localStorage.getItem(key));
      const separate = { ...original, id: 'separate-save-attempt', revision: 'separate-revision', savedAt: '2000-01-01T00:00:00Z', fields: { ...original.fields, title: 'Another unconfirmed save', creationAttempt: { ...original.fields.creationAttempt, id: 'different-creation-id-12345' } } };
      window.separateAttemptKey = key.slice(0, key.lastIndexOf(':') + 1) + separate.id;
      localStorage.setItem(window.separateAttemptKey, JSON.stringify(separate));
      window.dispatchEvent(new StorageEvent('storage', { key }));`);
    await waitFor(`!!(${button('Restore changes')})`);
    await evaluate(`${button('Restore changes')}.click()`);
    await waitFor('!!document.querySelector(".unsaved-versions")');
    assert.equal(await evaluate('document.querySelectorAll(".unsaved-versions > ol > li").length'), 2);
    assert.match(await evaluate('document.querySelector(".unsaved-versions").textContent'), /Unconfirmed save/);
    await evaluate('document.querySelector(".unsaved-versions .recovery-copy-actions > button").click()');
    await waitFor(`${title}?.value === 'Interrupted dashboard draft' && document.querySelector('.top-save').textContent === 'Retry creation safely' && !document.querySelector('.top-save').disabled`);
    assert.equal(await evaluate('window.writes.length'), 1, 'resume checks the draft without sending a save');
    assert.match(await evaluate('document.querySelector(".message.success").textContent'), /not been confirmed saved to GitHub/);
    await evaluate('document.querySelector(".top-save").click()');
    await waitFor('new URL(location.href).searchParams.get("file") === "interrupted-dashboard-draft.mdx"');
    assert.equal(await evaluate('document.querySelector(".save-state").textContent'), 'No unsaved changes');
    const attempts = await evaluate('window.writes.map(write => write.input)');
    assert.equal(attempts[0].creationId, attempts[1].creationId);
    assert.equal(attempts[0].creationFilename, attempts[1].creationFilename);
    assert.equal(attempts[1].creationRetry, true);
    assert.equal(await evaluate('Object.values(window.repo.state.commits).filter(commit => commit.message.includes("CMS-Creation:")).length'), 1);
    assert.ok(await evaluate('!!localStorage.getItem(window.separateAttemptKey)'), 'the other uncertain attempt is retained');
  }, { initialSearch: '?area=posts&new=dashboard-interrupted-save' });
});

test('ignoring recovery after a lost response still reuses the pending creation rather than making a new article', options, async () => {
  await withEditorBrowser(fixture, async browser => {
    const { evaluate, waitFor, send } = browser;
    await send('Page.enable');
    browser.onEvent('Page.javascriptDialogOpening', () => { void send('Page.handleJavaScriptDialog', { accept: true }); });
    await waitFor('!!document.querySelector(".editor-fields")');
    await fillTitle(browser, 'Original article');
    await evaluate('window.responseFault = "lost"; document.querySelector(".top-save").click()');
    await waitFor('document.querySelector(".top-save").textContent === "Retry creation safely" && !document.querySelector(".top-save").disabled');
    const previous = await evaluate('window.loadId');
    await send('Page.reload');
    await waitFor(`window.loadId !== ${JSON.stringify(previous)} && !!(${button('Restore changes')})`);
    await fillTitle(browser, 'A different title after reloading');
    await evaluate('document.querySelector(".top-save").click()');
    await waitFor('new URL(location.href).searchParams.get("file") === "original-article.mdx"');
    const attempts = await evaluate('JSON.parse(localStorage.getItem("test-attempts"))');
    assert.equal(attempts[0].creationId, attempts[1].creationId);
    assert.equal(attempts[1].creationRetry, true);
    assert.equal(await evaluate('Object.values(window.repo.state.commits).filter(commit => commit.message.includes("CMS-Creation:")).length'), 1);
    assert.equal(await evaluate(`${title}.value`), 'A different title after reloading');
  }, { initialSearch: '?area=posts&new=ignored-recovery' });
});

test('creation waits for durable retry information when browser recovery storage fails', options, async () => {
  await withEditorBrowser(fixture, async browser => {
    await browser.waitFor('!!document.querySelector(".editor-fields")');
    await fillTitle(browser, 'Keep this draft');
    await browser.evaluate('Storage.prototype.setItem = () => { throw new Error("Storage unavailable"); }; document.querySelector(".top-save").click()');
    await browser.waitFor('!!document.querySelector(".message.error")');
    assert.match(await browser.evaluate('document.body.textContent'), /retry information could not be saved/);
    assert.equal(await browser.evaluate('window.writes.length'), 0);
    assert.equal(await browser.evaluate(`${title}.value`), 'Keep this draft');
  }, { initialSearch: '?area=posts&new=storage-failure' });
});
