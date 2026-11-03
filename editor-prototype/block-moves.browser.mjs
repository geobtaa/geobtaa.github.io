import assert from 'node:assert/strict';
import test from 'node:test';
import { chrome, withEditorBrowser } from './browserHarness.mjs';

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
