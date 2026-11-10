import assert from 'node:assert/strict';
import test from 'node:test';
import { chrome, withEditorBrowser, openNewBlockMenu } from './browserHarness.mjs';

const body = `import { LinkCard } from '@astrojs/starlight/components';

First paragraph.

<LinkCard title="Catalog" href="/catalog/" />

Last paragraph.

<Unknown>Keep me</Unknown>

Anchored text.`;
const content = `---
title: Blocks
draft: true
---

${body}`;
const fixture = `import React from 'react';
import { createRoot } from 'react-dom/client';
import ProjectEditor from '../src/components/editor-prototype/ProjectEditor.tsx';
import '../src/components/editor-prototype/editor.css';
import { parseBlog, serializeBlog } from './blog.mjs';
window.saved = ${JSON.stringify(content)};
window.writes = [];
window.fetch = async (url, options = {}) => {
  const path = new URL(String(url), location.origin).pathname;
  if (path === '/api/session') return Response.json({ authenticated: true, login: 'tester' });
  if (path === '/api/content/posts') return Response.json({ branch: 'custom-cms', entries: [{ path: 'src/content/docs/posts/blocks.mdx', name: 'blocks.mdx', sha: 'loaded', draft: true, visibilityKnown: true }] });
  if (options.method === 'PUT') { const input = JSON.parse(options.body); window.writes.push(input); window.saved = serializeBlog(window.saved, input); }
  return Response.json({ filename: 'blocks.mdx', content: window.saved, sha: 'loaded', commitSha: 'saved', ...parseBlog(window.saved) });
};
createRoot(document.getElementById('root')).render(React.createElement(ProjectEditor));`;

test('moves preserve edits, focus, protected content and saved order; adjacent text merges on reopen', {
  skip: chrome ? false : 'Chrome/Chromium is required.', timeout: 30_000,
}, async () => {
  await withEditorBrowser(fixture, async ({ evaluate, waitFor, send }) => {
    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    await waitFor('!!document.querySelector(".dashboard-card")');
    await evaluate('[...document.querySelectorAll(".dashboard-card")].find(button => button.textContent.includes("Blog Posts")).click()');
    await waitFor('!!document.querySelector(".project-list button")');
    await evaluate('document.querySelector(".project-list button").click()');
    await waitFor('document.querySelectorAll(".rich-editor").length === 3');
    assert.match(await evaluate('document.querySelector(".block-move-note").textContent'), /may merge/);
    assert.equal(await evaluate(`document.querySelector('.rich-editor').closest('.block-row').querySelector('[data-move="-1"]').disabled`), true);
    assert.equal(await evaluate('document.querySelectorAll(".protected-block .block-move-buttons").length'), 0);
    // Change text without saving, then move the card using the keyboard.
    await evaluate('document.querySelector(".rich-editor .tiptap").focus()');
    await send('Input.insertText', { text: 'Unsaved edit. ' });
    const card = 'document.querySelector(".component-editor").closest(".block-row")';
    await evaluate(`${card}.querySelector('[data-move="-1"]').focus()`);
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    assert.match(await evaluate('document.querySelector(".block-move-status").textContent'), /moved up/);
    assert.equal(await evaluate(`${card}.contains(document.activeElement)`), true);
    assert.equal(await evaluate(`${card}.querySelector('[data-move="-1"]').disabled`), true);
    assert.match(await evaluate('document.querySelector(".rich-editor .tiptap").textContent'), /Unsaved edit/);
    // Move back down, then up again, exercising both directions without remounting editors.
    await evaluate(`${card}.querySelector('[data-move="1"]').click()`);
    await waitFor('document.querySelector(".block-move-status").textContent.includes("moved down")');
    assert.equal(await evaluate('document.activeElement.dataset.move'), '1');
    await evaluate(`${card}.querySelector('[data-move="-1"]').click()`);
    await evaluate('document.querySelector(".top-save").click()');
    await waitFor('window.writes.length === 1 && document.querySelector(".save-state").textContent === "No unsaved changes"');
    const saved = await evaluate('window.saved');
    assert.ok(saved.indexOf('<LinkCard') < saved.indexOf('Unsaved edit'));
    assert.ok(saved.indexOf('First paragraph.') < saved.indexOf('Last paragraph.'));
    assert.ok(saved.includes("import { LinkCard } from '@astrojs/starlight/components';"));
    assert.ok(saved.includes('<Unknown>Keep me</Unknown>'));
    await evaluate('document.querySelector(".editor-navigation .back").click()');
    await waitFor('!!document.querySelector(".project-list button")');
    await evaluate('document.querySelector(".project-list button").click()');
    await waitFor('document.querySelectorAll(".rich-editor").length === 2');
    const text = await evaluate('document.querySelector(".rich-editor .tiptap").textContent');
    assert.match(text, /Unsaved edit/);
    assert.ok(text.indexOf('First paragraph.') < text.indexOf('Last paragraph.'));
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    assert.equal(await evaluate('document.documentElement.scrollWidth > innerWidth'), false);
  });
});

test('Text blocks have explicit removal and undo; saved removals preserve neighboring blocks and imports', {
  skip: chrome ? false : 'Chrome/Chromium is required.', timeout: 30_000,
}, async () => {
  await withEditorBrowser(fixture, async browser => {
    const { evaluate, waitFor, send } = browser;
    await waitFor('!!document.querySelector(".dashboard-card")');
    await evaluate('[...document.querySelectorAll(".dashboard-card")].find(button => button.textContent.includes("Blog Posts")).click()');
    await waitFor('!!document.querySelector(".project-list button")');
    await evaluate('document.querySelector(".project-list button").click()');
    await waitFor('document.querySelectorAll(".text-block-footer button").length === 3');
    assert.equal(await evaluate('document.querySelectorAll(".protected-block button").length'), 0);
    // Remove an uncleared block using its actual keyboard-accessible control.
    await evaluate('document.querySelector(".text-block-footer button").focus()');
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    await waitFor('document.querySelectorAll(".rich-editor").length === 2');
    assert.equal(await evaluate('document.activeElement.classList.contains("block-row")'), true);
    assert.equal(await evaluate('document.querySelector(".save-state").textContent'), 'Unsaved changes');
    assert.match(await evaluate('document.querySelector(".block-removal-notice").textContent'), /Text block removed/);
    // Editing another block must survive undoing the removal.
    await evaluate('document.querySelector(".rich-editor .tiptap").focus()');
    await send('Input.insertText', { text: 'Kept edit. ' });
    await evaluate('document.querySelector(".block-removal-notice button").click()');
    await waitFor('document.querySelectorAll(".rich-editor").length === 3');
    assert.equal(await evaluate('document.querySelector(".rich-editor .tiptap").textContent'), 'First paragraph.');
    assert.match(await evaluate('document.querySelectorAll(".rich-editor .tiptap")[1].textContent'), /Kept edit/);
    await evaluate('document.querySelector(".text-block-footer button").click()');
    await waitFor('document.querySelectorAll(".rich-editor").length === 2');
    await evaluate('document.querySelector(".top-save").click()');
    await waitFor('window.writes.length === 1 && document.querySelector(".save-state").textContent === "No unsaved changes"');
    const saved = await evaluate('window.saved');
    assert.ok(!saved.includes('First paragraph.'));
    assert.ok(saved.includes('Kept edit.'));
    assert.ok(saved.includes('<Unknown>Keep me</Unknown>'));
    assert.ok(saved.includes('Anchored text.'));
    assert.match(saved, /import \{ LinkCard \} from '@astrojs\/starlight\/components';\n{2,}<LinkCard/);
    await evaluate('document.querySelector(".editor-navigation .back").click()');
    await waitFor('!!document.querySelector(".project-list button")');
    await evaluate('document.querySelector(".project-list button").click()');
    await waitFor('document.querySelectorAll(".rich-editor").length === 2');
    assert.ok(!(await evaluate('document.querySelector(".body-editor").textContent')).includes('First paragraph.'));
    assert.ok((await evaluate('document.querySelector(".body-editor").textContent')).includes('Kept edit.'));
  });
});

test('empty and final Text blocks can be removed immediately, restored, and replaced without reloading', {
  skip: chrome ? false : 'Chrome/Chromium is required.', timeout: 30_000,
}, async () => {
  const single = '---\ntitle: Blocks\ndraft: true\n---\n\nOnly text.';
  await withEditorBrowser(fixture.replace(JSON.stringify(content), JSON.stringify(single)), async browser => {
    const { evaluate, waitFor, send } = browser;
    await waitFor('!!document.querySelector(".dashboard-card")');
    await evaluate('[...document.querySelectorAll(".dashboard-card")].find(button => button.textContent.includes("Blog Posts")).click()');
    await waitFor('!!document.querySelector(".project-list button")');
    await evaluate('document.querySelector(".project-list button").click()');
    await waitFor('!!document.querySelector(".text-block-footer button")');
    await evaluate(`(() => {
      const editor = document.querySelector('.rich-editor .tiptap'); editor.focus();
      const range = document.createRange(); range.selectNodeContents(editor);
      const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
    })()`);
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 });
    await waitFor('document.querySelector(".text-block-empty")?.textContent === "Empty Text block."');
    await evaluate('document.querySelector(".text-block-footer button").click()');
    await waitFor('!!document.querySelector(".empty-body") && !document.querySelector(".rich-editor")');
    assert.equal(await evaluate('document.activeElement.tagName'), 'SUMMARY');
    await evaluate('document.querySelector(".block-removal-notice button").click()');
    await waitFor('!!document.querySelector(".rich-editor") && !!document.querySelector(".text-block-empty")');
    await evaluate('document.querySelector(".text-block-footer button").click()');
    await waitFor('!!document.querySelector(".empty-body")');
    await evaluate('document.querySelector(".top-save").click()');
    await waitFor('window.writes.length === 1 && document.querySelector(".save-state").textContent === "No unsaved changes"');
    assert.equal((await evaluate('window.writes[0].body')).trim(), '');
    const menu = await openNewBlockMenu(browser, 'Text', 'document.querySelector(".empty-body")');
    await evaluate(`[...${menu}.querySelectorAll('button')].find(button => button.textContent === 'Text').click()`);
    await waitFor('!!document.querySelector(".rich-editor .tiptap")');
    assert.equal(await evaluate('document.querySelector(".block-removal-notice")'), null, 'adding another block ends the previous removal undo');
    await evaluate('document.querySelector(".rich-editor .tiptap").focus()');
    await send('Input.insertText', { text: 'Replacement text.' });
    await evaluate('document.querySelector(".top-save").click()');
    await waitFor('window.writes.length === 2 && document.querySelector(".save-state").textContent === "No unsaved changes"');
    assert.equal((await evaluate('window.writes[1].body')).trim(), 'Replacement text.');
  });
});
