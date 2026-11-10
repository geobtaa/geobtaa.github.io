import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';
import { chrome, withEditorBrowser } from './browserHarness.mjs';

const recent = await readFile('src/content/docs/updates/2026-03-04-february-2026-program-update.mdx', 'utf8');
const legacy = await readFile('src/content/docs/updates/2026-01-05-december-2025-program-update.mdx', 'utf8');
const fixture = `import React from 'react';
import { createRoot } from 'react-dom/client';
import ProjectEditor from '../src/components/editor-prototype/ProjectEditor.tsx';
import '../src/components/editor-prototype/editor.css';
import { newProgramUpdate, parseProgramUpdate, serializeProgramUpdate } from './programUpdates.mjs';
window.records = { 'recent.mdx': ${JSON.stringify(recent)}, 'legacy.mdx': ${JSON.stringify(legacy)} };
window.writes = [];
window.confirm = () => true;
window.fetch = async (url, options = {}) => {
  const path = new URL(String(url), location.origin).pathname;
  if (path === '/api/session') return Response.json({ authenticated: true, login: 'tester' });
  const filename = decodeURIComponent(path.slice('/api/content/updates/'.length));
  if (options.method === 'POST' || options.method === 'PUT') {
    const input = JSON.parse(options.body);
    if (window.failNext) { window.failNext = false; return Response.json({ error: 'Staging changed. Your edits are still here.' }, { status: 409 }); }
    const key = options.method === 'POST' ? 'created-' + window.writes.length + '.mdx' : filename;
    window.records[key] = options.method === 'POST' ? newProgramUpdate(input) : serializeProgramUpdate(window.records[key], input);
    window.writes.push({ filename: key, input });
    return Response.json({ filename: key, content: window.records[key], sha: 'saved-' + window.writes.length, commitSha: 'commit-saved', ...parseProgramUpdate(window.records[key]) });
  }
  if (path === '/api/content/updates') return Response.json({ branch: 'custom-cms', entries: Object.keys(window.records).map(name => ({ name, path: 'src/content/docs/updates/' + name, sha: 'loaded' })) });
  if (window.records[filename]) return Response.json({ filename, content: window.records[filename], sha: 'loaded', ...parseProgramUpdate(window.records[filename]) });
  return Response.json({ error: 'Not found' }, { status: 404 });
};
createRoot(document.getElementById('root')).render(React.createElement(ProjectEditor));`;

const click = (text) => `[...document.querySelectorAll('button')].find(button => button.textContent === ${JSON.stringify(text)}).click()`;
const field = (label) => `[...document.querySelectorAll('.editor-fields label')].find(label => label.textContent.startsWith(${JSON.stringify(label)})).querySelector('input, textarea')`;
async function openUpdates(browser, filename) {
  await browser.waitFor('!!document.querySelector(".dashboard-card")');
  await browser.evaluate('[...document.querySelectorAll(".dashboard-card")].find(button => button.textContent.includes("Program Updates")).click()');
  await browser.waitFor('!!document.querySelector(".project-list button")');
  if (filename) {
    await browser.evaluate(`[...document.querySelectorAll('.project-list button')].find(button => button.textContent === ${JSON.stringify(filename)}).click()`);
    await browser.waitFor('!!document.querySelector(".editor-fields")');
  }
}
async function fill(browser, label, value) {
  await browser.evaluate(`${field(label)}.focus(); ${field(label)}.select()`);
  await browser.send('Input.insertText', { text: value });
}
const options = { skip: chrome ? false : 'Set CHROME_BIN to an installed Chrome/Chromium executable.', timeout: 60_000 };

test('new updates offer an optional outline, editable defaults, and a blank article with no required sections', options, async () => {
  await withEditorBrowser(fixture, async (browser) => {
    const { evaluate, waitFor, send } = browser;
    await openUpdates(browser);
    await evaluate(click('New Program Update'));
    await waitFor('!!document.querySelector(".editor-fields")');
    assert.equal(await evaluate('document.querySelector(".visibility-switch").getAttribute("aria-checked")'), 'false');
    assert.match(await evaluate(`${field('Publication date')}.value`), /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(await evaluate(`${field('Author 1')}.value`), 'BTAA-GIN Staff');
    assert.equal(await evaluate(`${field('Tags')}.value`), 'Program Updates');
    await evaluate(click('Start with monthly outline'));
    await waitFor('document.querySelectorAll(".body-editor .tiptap h2").length === 5');
    await fill(browser, 'Title', 'A monthly update');
    await evaluate(`(() => { const heading = document.querySelector('.body-editor .tiptap h2'); const range = document.createRange(); range.selectNodeContents(heading); const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range); heading.focus(); })()`);
    await send('Input.insertText', { text: 'Our main announcement' });
    await evaluate('document.querySelector(".top-save").click()');
    await waitFor('window.writes.length === 1 && document.querySelector(".save-state").textContent === "No unsaved changes"');
    assert.ok((await evaluate('window.writes[0].input.body')).includes('## Our main announcement'));
    await evaluate('document.querySelector(".editor-navigation .back").click()');
    await waitFor('!!document.querySelector(".list-heading .primary")');
    await evaluate(click('New Program Update'));
    await waitFor('!!document.querySelector(".editor-fields")');
    await evaluate(click('Start blank'));
    await fill(browser, 'Title', 'One announcement');
    await waitFor('!!document.querySelector(".body-editor .tiptap")');
    await evaluate('document.querySelector(".body-editor .tiptap").focus()');
    await send('Input.insertText', { text: 'A brief update.' });
    await evaluate('document.querySelector(".top-save").click()');
    await waitFor('window.writes.length === 2 && document.querySelector(".save-state").textContent === "No unsaved changes"');
    assert.equal((await evaluate('window.writes[1].input.body')).trim(), 'A brief update.');
    assert.deepEqual(await evaluate('window.writes[1].input.authors'), [{ name: 'BTAA-GIN Staff' }]);
    assert.equal(await evaluate('window.writes[1].input.excerpt'), '');
    await browser.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), true);
  });
});

for (const name of ['recent', 'legacy']) test(`${name} conversion can be previewed, cancelled, edited, saved and reopened without changing the URL`, options, async () => {
  await withEditorBrowser(fixture, async (browser) => {
    const { evaluate, waitFor, send } = browser;
    await openUpdates(browser, name);
    // A metadata save keeps the original layout and all structured data intact.
    await fill(browser, 'Title', 'An updated title');
    await evaluate('document.querySelector(".top-save").click()');
    await waitFor('window.writes.length === 1 && document.querySelector(".save-state").textContent === "No unsaved changes"');
    await evaluate(click('Preview editable version'));
    await waitFor('!!document.querySelector(".update-conversion-preview .tiptap")');
    assert.equal(await evaluate('document.querySelector(".conversion-preview-content [contenteditable]").getAttribute("contenteditable")'), 'false');
    assert.equal(await evaluate('document.querySelectorAll(".conversion-preview-content button:enabled, .conversion-preview-content input:enabled, .conversion-preview-content textarea:enabled").length'), 0);
    await evaluate(click('Cancel preview'));
    await waitFor('!document.querySelector(".update-conversion-preview")');
    assert.equal(await evaluate('window.writes.length'), 1);
    assert.equal(await evaluate('document.querySelector(".save-state").textContent'), 'No unsaved changes');
    await evaluate(click('Preview editable version'));
    await waitFor('!!document.querySelector(".update-conversion-preview .tiptap")');
    await evaluate(click('Use editable version'));
    await waitFor('!!document.querySelector(".body-editor .tiptap[contenteditable=true]")');
    assert.equal(await evaluate('document.querySelectorAll(".body-editor .protected-block").length'), 0);
    await evaluate(`(() => { const heading = document.querySelector('.body-editor .tiptap h2'); const range = document.createRange(); range.selectNodeContents(heading); const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range); heading.focus(); })()`);
    await send('Input.insertText', { text: 'Revised highlight' });
    await evaluate('window.failNext = true; document.querySelector(".top-save").click()');
    await waitFor('!!document.querySelector(".message.error")');
    assert.equal(await evaluate('document.querySelector(".save-state").textContent'), 'Unsaved changes');
    assert.equal(await evaluate('window.writes.length'), 1);
    assert.ok((await evaluate('document.querySelector(".body-editor .tiptap").textContent')).includes('Revised highlight'));
    await evaluate('document.querySelector(".top-save").click()');
    await waitFor('window.writes.length === 2 && document.querySelector(".save-state").textContent === "No unsaved changes"');
    const source = await evaluate(`window.records[${JSON.stringify(name + '.mdx')}]`);
    const data = parse(source.match(/^---\n([\s\S]*?)\n---/)[1]);
    assert.equal(data.programUpdate, undefined);
    assert.ok(source.includes('## Revised highlight'));
    assert.ok(source.includes(name === 'recent' ? 'Harvesting Activities' : 'Umedia Reharvest'));
    assert.equal(await evaluate('window.writes[1].filename'), `${name}.mdx`);
    await evaluate('document.querySelector(".editor-navigation .back").click()');
    await waitFor('!!document.querySelector(".project-list button")');
    await evaluate(`[...document.querySelectorAll('.project-list button')].find(button => button.textContent === ${JSON.stringify(name)}).click()`);
    await waitFor('!!document.querySelector(".body-editor .tiptap")');
    assert.ok((await evaluate('document.querySelector(".body-editor .tiptap").textContent')).includes('Revised highlight'));
    assert.equal(await evaluate('document.querySelectorAll(".update-options").length'), 0);
  });
});
