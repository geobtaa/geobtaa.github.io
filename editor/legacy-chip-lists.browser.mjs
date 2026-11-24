import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { chrome, withEditorBrowser } from './browserHarness.mjs';
import { parseContent } from './content.mjs';
import { parseLegacyChipList } from '../src/components/editor/legacyChipList.ts';
import { splitBody } from '../src/components/editor/bodySegments.ts';
import { validateDocument } from './validateDocument.mjs';

const content = await readFile('src/content/docs/updates/2025-09.mdx', 'utf8');
const originalBody = parseContent(content).body;
const originalSegment = splitBody(originalBody).find(s => s.legacyChipList);
const initialItems = parseLegacyChipList(originalSegment.content).items;
const fixture = `import React from 'react';
import { createRoot } from 'react-dom/client';
import ProjectEditor from '../src/components/editor/ProjectEditor.tsx';
import '../src/components/editor/editor.css';
window.record = { filename: '2025-09.mdx', sha: 'loaded', title: 'September update', description: '', draft: true, date: '2025-10-01', authors: [], tags: [], cover: null, body: ${JSON.stringify(originalBody)}, content: ${JSON.stringify(content)} };
window.writes = [];
window.confirm = () => true;
window.fetch = async (url, options = {}) => {
  const path = new URL(String(url), location.origin).pathname;
  if (path === '/api/session') return Response.json({ authenticated: true, login: 'tester' });
  if (path === '/api/content/updates') return Response.json({ branch: 'custom-cms', entries: [{ name: '2025-09.mdx', path: 'src/content/docs/updates/2025-09.mdx', sha: window.record.sha }] });
  if (path === '/api/content/updates/2025-09.mdx') {
    if (options.method === 'PUT') { const input = JSON.parse(options.body); window.writes.push(input); window.record = { ...window.record, ...input, sha: 'saved-' + window.writes.length, commitSha: 'saved-commit' }; }
    return Response.json(window.record);
  }
  throw new Error('Unexpected API call: ' + path);
};
createRoot(document.getElementById('root')).render(React.createElement(ProjectEditor));`;

test('legacy chips edit, reorder, add, remove, preview, save/reopen and clear/refill inside a preserved layout', { skip: chrome ? false : 'Chrome/Chromium is required.', timeout: 60_000 }, async () => {
  await withEditorBrowser(fixture, async ({ evaluate, waitFor, send }) => {
    const root = 'document.querySelector(".collection-chipList")';
    const button = label => `[...${root}.querySelectorAll('button')].find(button => (button.getAttribute('aria-label') || button.textContent.trim()) === ${JSON.stringify(label)})`;
    const values = () => evaluate(`[...${root}.querySelectorAll('input')].map(input => input.value)`);
    const save = async count => {
      await evaluate('document.querySelector(".top-save").click()');
      await waitFor(`window.writes.length === ${count} && document.querySelector('.save-state').textContent === 'All changes saved'`);
      const saved = await evaluate('window.record.body');
      await validateDocument(`---\ntitle: Chips\n---\n\n${saved}`, { originalBody });
      return saved;
    };
    const reopen = async () => {
      await evaluate('document.querySelector(".editor-navigation .back").click()');
      await waitFor('!!document.querySelector(".project-list button")');
      await evaluate('document.querySelector(".project-list button").click()');
      await waitFor(`!!${root}`);
    };
    await waitFor('!!document.querySelector(".dashboard-card")');
    await evaluate('[...document.querySelectorAll(".dashboard-card")].find(button => button.textContent.includes("Program Updates")).click()');
    await waitFor('!!document.querySelector(".project-list button")');
    await evaluate('document.querySelector(".project-list button").click()');
    await waitFor(`!!${root}`);
    assert.deepEqual(await values(), initialItems);
    assert.equal(await evaluate(`${root}.closest('.block-row').querySelector('.component-remove')`), null);
    assert.equal(await evaluate(`${root}.closest('.block-row').querySelector('.block-move-buttons')`), null);
    await evaluate('document.querySelector(".editor-fields > label input").focus(); document.querySelector(".editor-fields > label input").select()');
    await send('Input.insertText', { text: 'Updated page title' });
    assert.equal(await save(1), originalBody, 'unrelated metadata edits preserve exact source');

    await evaluate(`${root}.querySelector('input').focus(); ${root}.querySelector('input').select()`);
    await send('Input.insertText', { text: 'Edited' });
    await send('Input.insertText', { text: ' continuously' });
    await evaluate(`${button('Move chip 1 down')}.click()`);
    await waitFor(`${root}.querySelectorAll('input')[1].value === 'Edited continuously'`);
    await evaluate(`${button('Add chip')}.click()`);
    await waitFor(`document.activeElement?.getAttribute('aria-label') === 'Chip ${initialItems.length + 1} text'`);
    await send('Input.insertText', { text: 'Maps & <literal> {value}, 地図' });
    await evaluate(`${button('Remove chip 1')}.click()`);
    const expected = ['Edited continuously', ...initialItems.slice(2), 'Maps & <literal> {value}, 地図'];
    assert.deepEqual(await values(), expected);
    const saved = await save(2);
    const legacy = splitBody(saved).find(s => s.legacyChipList);
    assert.deepEqual(parseLegacyChipList(legacy.content).protectedParts, parseLegacyChipList(originalSegment.content).protectedParts);
    assert.ok(!saved.includes('CmsChipList'));
    for (const segment of splitBody(originalBody).filter(s => s.kind === 'protected' && !s.legacyChipList)) assert.ok(saved.includes(segment.content));
    await evaluate('[...document.querySelectorAll(".editor-mode-toggle button")].find(button => button.textContent === "Preview").click()');
    await waitFor('!!document.querySelector("#document-preview .editor-chip-preview")');
    assert.deepEqual(await evaluate('[...document.querySelectorAll("#document-preview .editor-chip-preview li")].map(li => li.textContent)'), expected);
    assert.equal(await evaluate('document.querySelectorAll("#document-preview .collection-chipList input").length'), 0);
    await reopen();
    assert.deepEqual(await values(), expected);

    for (let count = expected.length; count > 0; count--) {
      await evaluate(`${button('Remove chip 1')}.click()`);
      await waitFor(`${root}.querySelectorAll('input').length === ${count - 1}`);
    }
    await save(3);
    await reopen();
    assert.deepEqual(await values(), []);
    await evaluate(`${button('Add chip')}.click()`);
    await waitFor('document.activeElement?.getAttribute("aria-label") === "Chip 1 text"');
    await send('Input.insertText', { text: 'Refilled list' });
    await save(4);
    await reopen();
    assert.deepEqual(await values(), ['Refilled list']);
  });
});
