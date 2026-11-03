import assert from 'node:assert/strict';
import test from 'node:test';
import { chrome, withEditorBrowser, openNewBlockMenu } from './browserHarness.mjs';

const text = 'First paragraph.\n\nSecond paragraph.';
const fixture = `import React from 'react';
import { createRoot } from 'react-dom/client';
import ProjectEditor from '../src/components/editor-prototype/ProjectEditor.tsx';
import '../src/components/editor-prototype/editor.css';
window.record = { filename: 'blocks.mdx', title: 'Blocks', description: '', body: ${JSON.stringify(text)}, content: '', sha: 'loaded', draft: true, date: '2026-10-24', authors: [], tags: [], cover: null };
window.writes = [];
window.fetch = async (url, options = {}) => {
  const path = new URL(String(url), location.origin).pathname;
  if (path === '/api/session') return Response.json({ authenticated: true, login: 'tester' });
  if (path === '/api/content/posts') return Response.json({ branch: 'custom-cms', entries: [{ name: 'blocks.mdx', path: 'src/content/docs/posts/blocks.mdx', sha: 'loaded', draft: true, visibilityKnown: true }] });
  if (path === '/api/content/posts/blocks.mdx') {
    if (options.method === 'PUT') { window.writes.push(JSON.parse(options.body)); window.record = { ...window.record, ...window.writes.at(-1), sha: 'saved' }; }
    return Response.json(window.record);
  }
  throw new Error('Unexpected API: ' + path);
};
createRoot(document.getElementById('root')).render(React.createElement(ProjectEditor));`;

test('side menus add blocks after their owner, keep text intact, and fit desktop and mobile', {
  skip: chrome ? false : 'Set CHROME_BIN to an installed Chrome/Chromium executable.', timeout: 30_000,
}, async () => {
  await withEditorBrowser(fixture, async ({ evaluate, waitFor, send }) => {
    const click = async (selector) => {
      await evaluate(`${selector}.scrollIntoView({ block: 'center' })`);
      const point = await evaluate(`(() => { const r = ${selector}.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
    };
    const fill = async (selector, value) => {
      await evaluate(`${selector}.focus(); ${selector}.select()`);
      await send('Input.insertText', { text: value });
    };
    await waitFor('!!document.querySelector(".dashboard-card")');
    await evaluate('[...document.querySelectorAll(".dashboard-card")].find(button => button.textContent.includes("Blog Posts")).click()');
    await waitFor('!!document.querySelector(".project-list button")');
    await evaluate('document.querySelector(".project-list button").click()');
    await waitFor('!!document.querySelector(".rich-editor")');
    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    const geometry = await evaluate(`(() => { const row = document.querySelector('.block-row'); return { editor: row.querySelector('.rich-editor').getBoundingClientRect().right, aside: row.querySelector('.block-inserter').getBoundingClientRect().left }; })()`);
    assert.ok(geometry.aside >= geometry.editor, 'new-block controls sit beside the editor');
    const palette = await evaluate('[...document.querySelectorAll(".toolbar button")].map(button => button.textContent)');
    assert.ok(palette.includes('Image') && palette.includes('Table'));
    assert.ok(!palette.some(label => ['Link Card', 'Link Button', 'Badge', 'Callout', 'Card', 'Text'].includes(label)));
    // Put the caret in the first paragraph: adding a page block must still leave both paragraphs together.
    await evaluate(`(() => { const p = document.querySelector('.tiptap p'); const range = document.createRange(); range.selectNodeContents(p); range.collapse(false); const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range); })()`);
    await click('document.querySelector(".block-inserter-menu summary")');
    await waitFor('document.querySelector(".block-inserter-menu").open');
    await click('[...document.querySelectorAll(".block-inserter-menu button")].find(button => button.textContent === "Link Card")');
    await waitFor('!!document.querySelector("#link-card-dialog-title")');
    assert.equal(await evaluate('document.querySelector(".rich-editor .link-card-dialog")'), null, 'new-block dialog is outside the text editor');
    await fill('document.querySelectorAll(".link-card-dialog input")[0]', 'Catalog');
    await fill('document.querySelectorAll(".link-card-dialog input")[1]', '/catalog/');
    await evaluate('[...document.querySelectorAll(".link-card-dialog button")].find(button => button.textContent === "Insert Link Card").click()');
    await waitFor('!!document.querySelector(".component-editor") && !document.querySelector(".link-card-dialog")');
    assert.equal(await evaluate('document.querySelectorAll(".rich-editor").length'), 1);
    assert.equal(await evaluate('document.querySelector(".rich-editor .tiptap").textContent'), 'First paragraph.Second paragraph.');
    const overlap = await evaluate(`(() => {
      const rows = [...document.querySelectorAll('.block-row')];
      const index = rows.findIndex(row => row.querySelector('.protected-block'));
      const menu = rows[index].querySelector('.block-inserter-menu');
      menu.querySelector('summary').scrollIntoView({ block: 'center' });
      menu.open = true;
      const next = rows[index + 1].querySelector('.block-inserter-menu summary').getBoundingClientRect();
      const list = menu.querySelector('.block-menu-list');
      const bounds = list.getBoundingClientRect();
      const x = next.x + next.width / 2, y = next.y + next.height / 2;
      const overlapping = x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom;
      const onTop = list.contains(document.elementFromPoint(x, y));
      menu.open = false;
      return { overlapping, onTop };
    })()`);
    assert.equal(overlap.overlapping, true, 'short MDX block menu overlaps the next Add block control');
    assert.equal(overlap.onTop, true, 'the open menu receives pointer events above the following control');
    const cardRow = 'document.querySelector(".component-editor").closest(".block-row")';
    let menu = await openNewBlockMenu({ evaluate, waitFor }, 'Callout', cardRow);
    await evaluate(`[...${menu}.querySelectorAll('button')].find(button => button.textContent === 'Callout').click()`);
    await waitFor('!!document.querySelector(".simple-component-dialog textarea")');
    await fill('document.querySelector(".simple-component-dialog textarea")', 'A new callout.');
    await evaluate('[...document.querySelectorAll(".simple-component-dialog button")].find(button => button.textContent === "Insert Callout").click()');
    await waitFor('document.querySelectorAll(".component-editor").length === 2');
    assert.equal(await evaluate('document.querySelectorAll(".rich-editor").length'), 1, 'components can follow components without a temporary text editor');
    menu = await openNewBlockMenu({ evaluate, waitFor }, 'Text', 'document.querySelector(".structured-link-card").closest(".block-row")');
    await evaluate(`[...${menu}.querySelectorAll('button')].find(button => button.textContent === 'Text').click()`);
    await waitFor('document.querySelectorAll(".rich-editor").length === 2');
    await evaluate('document.querySelectorAll(".rich-editor .tiptap")[1].focus()');
    await send('Input.insertText', { text: 'Between blocks.' });
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    const mobile = await evaluate(`(() => { const row = document.querySelector('.rich-editor').closest('.block-row'); const editor = row.querySelector('.rich-editor').getBoundingClientRect(); const aside = row.querySelector('.block-inserter').getBoundingClientRect(); return { bottom: editor.bottom, top: aside.top, overflow: document.documentElement.scrollWidth > innerWidth }; })()`);
    assert.ok(mobile.top >= mobile.bottom, 'mobile controls sit below the editor');
    assert.equal(mobile.overflow, false);
    menu = await openNewBlockMenu({ evaluate, waitFor }, 'Badge');
    const bounds = await evaluate(`(() => { const r = ${menu}.querySelector('.block-menu-list').getBoundingClientRect(); return { left: r.left, right: r.right }; })()`);
    assert.ok(bounds.left >= 0 && bounds.right <= 390, 'mobile menu fits the viewport');
    await evaluate(`${menu}.querySelector('summary').focus()`);
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await waitFor(`!${menu}.open`);
    await evaluate('document.querySelector(".top-save").click()');
    await waitFor('window.writes.length === 1');
    const saved = await evaluate('window.record.body');
    assert.ok(saved.includes(text));
    assert.ok(saved.indexOf('Second paragraph.') < saved.indexOf('<LinkCard'));
    assert.ok(saved.indexOf('<LinkCard') < saved.indexOf('Between blocks.'));
    assert.ok(saved.indexOf('Between blocks.') < saved.indexOf('<CmsCallout'));
  });
});

test('menu options remain clickable when pointer activation blurs focus with no related target', {
  skip: chrome ? false : 'Set CHROME_BIN to an installed Chrome/Chromium executable.', timeout: 30_000,
}, async () => {
  await withEditorBrowser(fixture, async ({ evaluate, waitFor, send }) => {
    const click = async (selector) => {
      await evaluate(`${selector}.scrollIntoView({ block: 'center' })`);
      const point = await evaluate(`(() => { const r = ${selector}.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
    };
    await waitFor('!!document.querySelector(".dashboard-card")');
    await evaluate('[...document.querySelectorAll(".dashboard-card")].find(button => button.textContent.includes("Blog Posts")).click()');
    await waitFor('!!document.querySelector(".project-list button")');
    await evaluate('document.querySelector(".project-list button").click()');
    await waitFor('!!document.querySelector(".block-inserter-menu")');
    // Model WebKit's sequence: a pointer press blurs the focused summary with
    // relatedTarget=null before the menu option receives its click.
    await evaluate(`(() => {
      window.menuBlurEvents = [];
      document.addEventListener('focusout', event => {
        if (event.target.closest?.('.block-inserter-menu')) window.menuBlurEvents.push(event.relatedTarget === null);
      }, true);
      document.addEventListener('mousedown', event => {
        const button = event.target.closest?.('.block-menu-list button');
        if (button?.closest('.block-inserter-menu').contains(document.activeElement)) document.activeElement.blur();
      }, true);
    })()`);
    for (const label of ['Link Card', 'Link Button', 'Badge', 'Callout', 'Card']) {
      await click('document.querySelector(".block-inserter-menu summary")');
      await waitFor('document.querySelector(".block-inserter-menu").open');
      await evaluate('document.querySelector(".block-inserter-menu summary").focus()');
      await click(`[...document.querySelectorAll('.block-inserter-menu button')].find(button => button.textContent === ${JSON.stringify(label)})`);
      await waitFor(`document.querySelector('.link-card-dialog h3')?.textContent === ${JSON.stringify(`Insert ${label}`)}`);
      await evaluate('[...document.querySelectorAll(".link-card-dialog button")].find(button => button.textContent === "Cancel").click()');
      await waitFor('!document.querySelector(".link-card-dialog")');
    }
    // Closing on an outside pointer press should still work when no focusable
    // element receives focus, and keyboard Tab should still close the menu.
    await click('document.querySelector(".block-inserter-menu summary")');
    await waitFor('document.querySelector(".block-inserter-menu").open');
    await click('document.querySelector("h1")');
    await waitFor('!document.querySelector(".block-inserter-menu").open');
    await click('document.querySelector(".block-inserter-menu summary")');
    await evaluate('document.querySelector(".block-inserter-menu summary").focus(); document.querySelector(".editor-fields input").focus()');
    await waitFor('!document.querySelector(".block-inserter-menu").open');
    await click('document.querySelector(".block-inserter-menu summary")');
    await waitFor('document.querySelector(".block-inserter-menu").open');
    await evaluate('document.querySelector(".block-inserter-menu summary").focus()');
    await click('[...document.querySelectorAll(".block-inserter-menu button")].find(button => button.textContent === "Text")');
    await waitFor('document.querySelectorAll(".rich-editor").length === 2');
    assert.ok(await evaluate('window.menuBlurEvents.filter(Boolean).length >= 6'), 'the null-target blur sequence was exercised for all six options');
    assert.equal(await evaluate('window.writes.length'), 0, 'opening dialogs does not save content');
  });
});
