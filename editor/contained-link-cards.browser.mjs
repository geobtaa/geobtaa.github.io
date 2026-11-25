import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { chrome, withEditorBrowser } from './browserHarness.mjs';
import { parseContent } from './content.mjs';
import { splitBody } from '../src/components/editor/bodySegments.ts';
import { parseContainedLinkCards } from '../src/components/editor/containedLinkCards.ts';
import { validateDocument } from './validateDocument.mjs';

const content = await readFile('src/content/docs/guides/census.mdx', 'utf8');
const originalBody = parseContent(content).body;
const fixture = `import React from 'react';
import { createRoot } from 'react-dom/client';
import ProjectEditor from '../src/components/editor/ProjectEditor.tsx';
import '../src/components/editor/editor.css';
window.record = { filename: 'census.mdx', sha: 'loaded', title: 'Census', description: '', draft: false, date: '', authors: [], tags: [], cover: null, body: ${JSON.stringify(originalBody)}, content: ${JSON.stringify(content)} };
window.writes = [];
window.confirm = () => true;
window.fetch = async (url, options = {}) => {
  const path = new URL(String(url), location.origin).pathname;
  if (path === '/api/session') return Response.json({ authenticated: true, login: 'tester' });
  if (path === '/api/content/guides') return Response.json({ branch: 'custom-cms', entries: [{ name: 'census.mdx', path: 'src/content/docs/guides/census.mdx', sha: window.record.sha }] });
  if (path === '/api/content/guides/census.mdx') {
    if (options.method === 'PUT') { const input = JSON.parse(options.body); window.writes.push(input); window.record = { ...window.record, ...input, sha: 'saved-' + window.writes.length, commitSha: 'saved-commit' }; }
    return Response.json(window.record);
  }
  throw new Error('Unexpected API call: ' + path);
};
createRoot(document.getElementById('root')).render(React.createElement(ProjectEditor));`;

test('existing wrapped LinkCards edit, validate URLs, preview and reopen while their layouts stay anchored', { skip: chrome ? false : 'Chrome/Chromium is required.', timeout: 60_000 }, async () => {
  await withEditorBrowser(fixture, async ({ evaluate, waitFor, send }) => {
    await waitFor('!!document.querySelector(".dashboard-card")');
    await evaluate('[...document.querySelectorAll(".dashboard-card")].find(button => button.textContent.includes("Guides")).click()');
    await waitFor('!!document.querySelector(".project-list button")');
    await evaluate('document.querySelector(".project-list button").click()');
    await waitFor('document.querySelectorAll(".contained-link-cards .structured-link-card").length === 6');
    assert.equal(await evaluate('document.querySelectorAll(".contained-link-cards .component-remove").length'), 0);
    assert.equal(await evaluate('[...document.querySelectorAll(".contained-link-cards")].some(el => el.closest(".block-row").querySelector(".block-move-buttons"))'), false);
    await evaluate('document.querySelector(".editor-fields > label input").focus(); document.querySelector(".editor-fields > label input").select()');
    await send('Input.insertText', { text: 'Updated census guide' });
    await evaluate('document.querySelector(".top-save").click()');
    await waitFor('window.writes.length === 1 && document.querySelector(".top-save").disabled && document.querySelector(".top-save").textContent === "Save Draft"');
    assert.equal(await evaluate('window.writes[0].body'), originalBody);

    const root = 'document.querySelector(".contained-link-cards .structured-link-card")';
    await evaluate(`${root}.querySelector('input').focus(); ${root}.querySelector('input').select()`);
    await send('Input.insertText', { text: 'Updated Census Bureau maps' });
    await evaluate(`${root}.querySelector('textarea').focus(); ${root}.querySelector('textarea').select()`);
    await send('Input.insertText', { text: 'A revised description & details.' });
    await evaluate(`${root}.querySelector('.link-address-field input').focus(); ${root}.querySelector('.link-address-field input').select()`);
    await send('Input.insertText', { text: 'javascript:example' });
    await waitFor(`!!${root}.querySelector('[role=alert]')`);
    await evaluate(`${root}.querySelector('.link-address-field input').select()`);
    await send('Input.insertText', { text: 'example.com/maps' });
    await evaluate(`${root}.querySelector('input').focus()`);
    await waitFor(`${root}.querySelector('.link-address-field input').value === 'https://example.com/maps'`);
    await evaluate('document.querySelector(".top-save").click()');
    await waitFor('window.writes.length === 2 && document.querySelector(".top-save").disabled && document.querySelector(".top-save").textContent === "Save Draft"');
    const saved = await evaluate('window.writes[1].body');
    const before = splitBody(originalBody, { mergeProtected: false }).filter(s => s.kind === 'protected');
    const after = splitBody(saved, { mergeProtected: false }).filter(s => s.kind === 'protected');
    assert.deepEqual(after.map(s => s.containedLinkCards ? parseContainedLinkCards(s.content).protectedParts : [s.content]), before.map(s => s.containedLinkCards ? parseContainedLinkCards(s.content).protectedParts : [s.content]));
    await validateDocument(`---\ntitle: Census\n---\n\n${saved}`, { filename: 'census.mdx', originalBody });

    await evaluate('[...document.querySelectorAll(".editor-mode-toggle button")].find(button => button.textContent === "Preview").click()');
    await waitFor('document.querySelectorAll("#document-preview .contained-link-cards .preview-link-card").length === 6');
    assert.equal(await evaluate('document.querySelector("#document-preview .contained-link-cards a").getAttribute("href")'), 'https://example.com/maps');
    assert.equal(await evaluate('document.querySelector("#document-preview .contained-link-cards a").getAttribute("target")'), '_blank');
    assert.equal(await evaluate('document.querySelectorAll("#document-preview .contained-link-cards input").length'), 0);
    await evaluate('document.querySelector(".editor-navigation .back").click()');
    await waitFor('!!document.querySelector(".project-list button")');
    await evaluate('document.querySelector(".project-list button").click()');
    await waitFor('document.querySelectorAll(".contained-link-cards .structured-link-card").length === 6');
    assert.equal(await evaluate(`${root}.querySelector('input').value`), 'Updated Census Bureau maps');
    assert.equal(await evaluate(`${root}.querySelector('textarea').value`), 'A revised description & details.');
  });
});
