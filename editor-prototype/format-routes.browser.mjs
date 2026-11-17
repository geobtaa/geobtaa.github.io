import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { splitBody } from '../src/components/editor-prototype/bodySegments.ts';
import { parsePage } from './page.mjs';
import { chrome, withEditorBrowser, openNewBlockMenu } from './browserHarness.mjs';

const original = await readFile(new URL('../src/content/docs/about/brand-gin.md', import.meta.url), 'utf8');
const fixture = (content = original) => `import React from 'react';
import { createRoot } from 'react-dom/client';
import ProjectEditor from '../src/components/editor-prototype/ProjectEditor.tsx';
import '../src/components/editor-prototype/editor.css';
import { parsePage, savePage, newPage } from './page.mjs';
import { documentRoute, documentSlug } from './contentRoutes.mjs';
window.records = { 'brand-gin.md': ${JSON.stringify(content)}, 'nested/index.mdx': ${JSON.stringify('---\ntitle: Nested\n---\n\nBody.')}, 'alias.mdx': ${JSON.stringify('---\ntitle: Alias\nslug: about/taken\n---\n\nBody.')} };
window.writes = [];
window.confirm = () => true;
const github = {
  getContent: async (area, filename) => ({ content: window.records[filename], sha: 'loaded' }),
  saveContent: async ({ filename, content }) => { window.records[filename] = content; return { sha: 'loaded', commitSha: 'saved-commit' }; },
};
window.fetch = async (url, options = {}) => {
  const path = new URL(String(url), location.origin).pathname;
  if (path === '/api/session') return Response.json({ authenticated: true, login: 'tester' });
  if (path === '/api/content/about') {
    const entries = Object.entries(window.records).map(([name, content]) => ({ name, path: 'src/content/docs/about/' + name, sha: 'loaded', route: documentRoute('about/' + name, documentSlug(content)), visibilityKnown: true }));
    entries.push({ name: 'remote-claim.md', path: 'src/content/docs/about/remote-claim.md', sha: 'unreadable', visibilityKnown: false });
    return Response.json({ branch: 'custom-cms', entries });
  }
  const filename = decodeURIComponent(path.replace('/api/content/about/', ''));
  if (options.method === 'PUT') {
    const input = JSON.parse(options.body); window.writes.push({ filename, input });
    if (filename === 'remote-claim.mdx') return Response.json({ error: 'The URL /about/remote-claim/ is already claimed by src/content/docs/team/alias.mdx. Choose a different filename. Nothing was saved to GitHub.' }, { status: 409 });
    if (!input.sha) { window.records[filename] = newPage('about', input); return Response.json({ filename, sha: 'loaded', commitSha: 'created-commit', ...parsePage(window.records[filename]), content: window.records[filename] }); }
    try { return Response.json(await savePage(github, 'about', filename, input)); }
    catch (error) { return Response.json({ error: error.message }, { status: error.status || 500 }); }
  }
  return Response.json({ filename, content: window.records[filename], sha: 'loaded', ...parsePage(window.records[filename]) });
};
createRoot(document.getElementById('root')).render(React.createElement(ProjectEditor));`;

test('real Markdown files disable MDX blocks and retain text, images, tables, preview, and existing source after save/reopen', {
  skip: chrome ? false : 'Chrome/Chromium is required.', timeout: 45_000,
}, async () => {
  const legacy = `${original}\nimport { LinkCard } from '@astrojs/starlight/components';\n\n<LinkCard title="Legacy source" href="/maps/" />\n`;
  await withEditorBrowser(fixture(legacy), async browser => {
    const { evaluate, waitFor, send } = browser;
    await waitFor('!!document.querySelector(".rich-editor .tiptap")');
    const menu = await openNewBlockMenu(browser, 'Link Card');
    const buttons = await evaluate(`[...${menu}.querySelectorAll('button')].map(button => ({ label: button.textContent, disabled: button.disabled }))`);
    assert.equal(buttons.find(button => button.label === 'Text').disabled, false);
    assert.equal(buttons.filter(button => button.disabled).length, 8);
    assert.match(await evaluate(`${menu}.textContent`), /require an \.mdx document/);
    for (const label of ['Image', 'Table']) assert.equal(await evaluate(`document.querySelector('.toolbar button[aria-label=${JSON.stringify(label)}]').disabled`), false);
    assert.equal(await evaluate('document.querySelectorAll(".component-editor").length'), 0, 'legacy MDX in Markdown is read-only');
    await evaluate(`${menu}.open = false; document.querySelector('.rich-editor .tiptap').focus(); (() => { const p = document.querySelector('.rich-editor .tiptap p'); const range = document.createRange(); range.selectNodeContents(p); range.collapse(false); const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range); })()`);
    await send('Input.insertText', { text: ' Added safely.' });
    await evaluate('[...document.querySelectorAll(".editor-mode-toggle button")].find(button => button.textContent === "Preview").click()');
    await waitFor('!!document.querySelector(".cms-preview")');
    assert.match(await evaluate('document.querySelector(".cms-preview").textContent'), /Added safely/);
    assert.match(await evaluate('document.querySelector(".cms-preview").textContent'), /Legacy source/);
    await evaluate('[...document.querySelectorAll(".editor-mode-toggle button")].find(button => button.textContent === "Edit").click(); document.querySelector(".top-save").click()');
    await waitFor('document.querySelector(".save-state").textContent === "No unsaved changes"');
    assert.equal(await evaluate('window.writes[0].filename'), 'brand-gin.md');
    const saved = await evaluate('window.records["brand-gin.md"]');
    assert.match(parsePage(saved).body, /Added safely/);
    for (const segment of splitBody(parsePage(legacy).body, { format: 'md' }).filter(segment => segment.kind === 'protected')) assert.ok(saved.includes(segment.content), 'protected source remains exact');
    await evaluate('document.querySelector(".editor-actions .back").click()');
    await waitFor('!!document.querySelector(".project-list button")');
    await evaluate('[...document.querySelectorAll(".project-list button")].find(button => button.textContent.includes("brand-gin")).click()');
    await waitFor('!!document.querySelector(".rich-editor .tiptap")');
    assert.match(await evaluate('document.querySelector(".rich-editor .tiptap").textContent'), /Added safely/);
    assert.equal(await evaluate('document.querySelectorAll(".component-editor").length'), 0);
  }, { initialSearch: '?area=about&file=brand-gin.md' });
});

test('new-page validation rejects known route aliases and preserves the draft on authoritative server conflicts', {
  skip: chrome ? false : 'Chrome/Chromium is required.', timeout: 30_000,
}, async () => {
  await withEditorBrowser(fixture(), async ({ evaluate, waitFor, send }) => {
    await waitFor('!!document.querySelector(".editor-fields")');
    const fill = async (label, value) => {
      const input = `[...document.querySelectorAll('.editor-fields label')].find(label => label.textContent.startsWith(${JSON.stringify(label)})).querySelector('input')`;
      await evaluate(`${input}.focus(); ${input}.select()`);
      await send('Input.insertText', { text: value });
    };
    await fill('Title', 'A draft worth keeping');
    for (const name of ['brand-gin', 'nested', 'taken']) {
      await fill('Filename', name);
      await evaluate('document.querySelector(".top-save").click()');
      await waitFor('!!document.querySelector("[role=alert]")');
      assert.match(await evaluate('document.querySelector("[role=alert]").textContent'), /already claimed/);
      assert.equal(await evaluate('window.writes.length'), 0);
    }
    await fill('Filename', 'remote-claim');
    await evaluate('document.querySelector(".top-save").click()');
    await waitFor('window.writes.length === 1 && !document.querySelector(".top-save").disabled');
    assert.match(await evaluate('document.querySelector("[role=alert]").textContent'), /team\/alias.mdx/);
    assert.equal(await evaluate('window.writes[0].input.title'), 'A draft worth keeping');
    assert.match(await evaluate('location.search'), /new=/);
    await fill('Filename', 'unique');
    await evaluate('document.querySelector(".top-save").click()');
    await waitFor('document.querySelector(".save-state").textContent === "No unsaved changes"');
    assert.equal(await evaluate('window.writes[1].filename'), 'unique.mdx');
    assert.equal(await evaluate('window.writes[1].input.title'), 'A draft worth keeping');
  }, { initialSearch: '?area=about&new=route-test' });
});
