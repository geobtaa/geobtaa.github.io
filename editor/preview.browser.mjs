import assert from 'node:assert/strict';
import test from 'node:test';
import { answerLeaveDialog, chrome, withEditorBrowser } from './browserHarness.mjs';
import { createCollectionMdx } from '../src/components/editor/collectionMdx.ts';
import { createSimpleComponentMdx, emptySimpleFields } from '../src/components/editor/simpleComponents.ts';

const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aIo0AAAAASUVORK5CYII=';
const simple = kind => createSimpleComponentMdx(kind, { ...emptySimpleFields(), title: 'A literal <title>', text: 'A literal <message> & {value}.\nSecond line.' });
const body = [
  "import { LinkCard } from '@astrojs/starlight/components';",
  '## Review heading\n\nOriginal text with a [link](/must-not-navigate/), [external](https://example.com/text), [relative](../help/), [fragment](#details), and [query](?preview-link=1).',
  '<LinkCard title="Card title" href="https://example.com" description="Card description" />',
  '<LinkButton href="https://example.com" variant="secondary">Read more</LinkButton>',
  ...['badge', 'callout', 'card'].map(simple),
  createCollectionMdx('chipList', ['Lincoln, Nebraska', 'Maps']),
  createCollectionMdx('cardGrid', [{ title: 'Rich card', body: '**Bold body**\n\n- First\n- Second\n\n[Nested link](/nested-card/)' }, { title: '', body: '' }]),
  createCollectionMdx('metrics', [{ label: 'Visitors', value: '3,651' }]),
  '| Column A | Column B |\n| --- | --- |\n| One | Two |',
  `![Ordinary image](${image} "Ordinary caption")`,
  `<figure data-cms-image="true" data-align="right" data-width="240">\n\n![Formatted image](${image} "Formatted caption")\n\n</figure>`,
  '<UnknownWidget>\nProtected content.\n</UnknownWidget>',
  'After protected block.',
].join('\n\n');

const fixture = area => `import React from 'react';
import { createRoot } from 'react-dom/client';
import ProjectEditor from '../src/components/editor/ProjectEditor.tsx';
import '../src/components/editor/editor.css';
window.record = ${JSON.stringify({ filename: 'preview.mdx', sha: 'loaded', title: 'Preview title', description: 'Library summary', draft: true, date: '2026-11-13T23:30:00-06:00', authors: [{ name: 'Editor One' }, 'Editor Two'], tags: ['Maps'], metadata: { year: 2026 }, cover: { image, alt: 'Cover intentionally omitted' }, body, content: '---\ntitle: Preview title\n---\n\n' + body })};
window.requests = [];
window.confirm = () => true;
window.fetch = async (url, options = {}) => {
  const path = new URL(String(url), location.origin).pathname;
  const method = options.method || 'GET';
  window.requests.push({ path, method });
  if (method !== 'GET') throw new Error('Preview must never write: ' + path);
  if (path === '/api/session') return Response.json({ authenticated: true, login: 'tester' });
  if (path === '/api/content/${area}') return Response.json({ branch: 'custom-cms', entries: [{ name: 'preview.mdx', path: 'src/content/docs/${area}/preview.mdx', sha: 'loaded' }] });
  if (path === '/api/content/${area}/preview.mdx') return Response.json(window.record);
  throw new Error('Unexpected API call: ' + path);
};
createRoot(document.getElementById('root')).render(React.createElement(ProjectEditor));`;
const options = { skip: chrome ? false : 'Set CHROME_BIN to an installed Chrome/Chromium executable.', timeout: 60_000 };
const modeButton = name => `[...document.querySelectorAll('.editor-mode-toggle button')].find(button => button.textContent === '${name}')`;
const previewImage = alt => `[...document.querySelectorAll('.cms-preview img')].find(image => image.alt === ${JSON.stringify(alt)}).closest('figure')`;
async function preview(browser) {
  await browser.evaluate(`${modeButton('Preview')}.click()`);
  await browser.waitFor('!!document.querySelector(".cms-preview .tiptap") || document.querySelector(".cms-preview")?.textContent.includes("No body content yet.")');
}
async function edit(browser) {
  await browser.evaluate(`${modeButton('Edit')}.click()`);
  await browser.waitFor('!document.querySelector("#document-edit").hidden');
}

async function checkPreviewLinks(browser) {
  const { evaluate, send, onEvent } = browser;
  const opened = [];
  const stop = onEvent('Page.windowOpen', event => opened.push(event));
  await send('Page.enable');
  const before = await evaluate(`({ url: location.href, history: history.length,
    selection: window.originalView.state.selection.toJSON(), markdown: window.originalEditor.editor.getMarkdown(),
    requests: window.requests.length })`);
  const links = await evaluate(`[...document.querySelectorAll('.cms-preview a[href]')].map(a => ({ href: a.href, target: a.target, rel: a.rel }))`);
  assert.equal(links.length, 8, 'text links, card, button and nested card-body link are all anchors');
  try {
    for (const [index, link] of links.entries()) {
      assert.equal(link.target, '_blank');
      assert.equal(link.rel, 'noopener noreferrer');
      const targetsBefore = new Set((await send('Target.getTargets')).targetInfos.map(target => target.targetId));
      const point = await evaluate(`(async () => {
        const anchor = document.querySelectorAll('.cms-preview a[href]')[${index}];
        anchor.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        window.clickedPreviewLink = anchor;
        // Inline links can span lines: the union box's center can be empty space.
        // Hit-test after scrolling settles so sticky controls cannot intercept it.
        for (const rect of anchor.getClientRects()) {
          if (!rect.width || !rect.height) continue;
          const point = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
          if (document.elementFromPoint(point.x, point.y)?.closest('a') === anchor) return point;
        }
        throw new Error('Preview link ${index} has no visible, unobstructed click target');
      })()`);
      if (index === 3) {
        await evaluate(`document.querySelectorAll('.cms-preview a[href]')[${index - 1}].focus()`);
        await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
        await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
        assert.equal(await evaluate('document.activeElement === window.clickedPreviewLink'), true, 'links remain in the native tab order');
        await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
        await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
      } else {
        const button = index === 2 ? 'middle' : 'left';
        const modifiers = index === 4 ? (process.platform === 'darwin' ? 4 : 2) : 0;
        await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button, clickCount: 1, modifiers });
        await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button, clickCount: 1, modifiers });
      }
      // Auxiliary clicks create tabs without a Page.windowOpen event in Chrome.
      let tabs = [];
      for (let attempt = 0; attempt < 100; attempt++) {
        tabs = (await send('Target.getTargets')).targetInfos.filter(target => target.type === 'page' && !targetsBefore.has(target.targetId));
        if (tabs.length && (tabs[0].url === link.href || opened.some(event => event.url === link.href))) break;
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      assert.equal(tabs.length, 1, `link ${index} opens exactly one tab`);
      assert.ok(tabs[0].url === link.href || opened.some(event => event.url === link.href), `link ${index} uses the expected destination`);
      await send('Target.closeTarget', { targetId: tabs[0].targetId });
      assert.deepEqual(await evaluate(`({ url: location.href, history: history.length,
        selection: window.originalView.state.selection.toJSON(), markdown: window.originalEditor.editor.getMarkdown(),
        requests: window.requests.length })`), before);
      assert.equal(await evaluate(`document.querySelector('.body-editor .tiptap') === window.originalEditor &&
        document.querySelector('#document-edit').hidden &&
        document.querySelector('.save-state').textContent === 'Unsaved changes' &&
        [...document.querySelectorAll('.editor-mode-toggle button')].find(b => b.textContent === 'Preview').getAttribute('aria-pressed') === 'true'`), true);
    }
  } finally { stop(); }
}

test('preview renders unsaved content and supported blocks without writes, and preserves live editors, selection and undo', options, async () => {
  await withEditorBrowser(fixture('posts'), async browser => {
    const { evaluate, waitFor, send } = browser;
    await waitFor('!!document.querySelector(".body-editor .tiptap")');
    await evaluate(`window.originalEditor = document.querySelector('.body-editor .tiptap');
      window.originalCardEditor = document.querySelector('.body-editor .card-body .tiptap');
      window.originalView = window.originalEditor.editor.view;
      const paragraph = window.originalEditor.querySelector('p');
      const range = document.createRange(); range.selectNodeContents(paragraph); range.collapse(false);
      window.originalEditor.focus(); const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);`);
    await send('Input.insertText', { text: ' Unsaved sentence.' });
    await waitFor('document.querySelector(".save-state").textContent === "Unsaved changes"');
    await evaluate(`window.selectionBefore = window.originalView.state.selection.toJSON();
      const input = document.querySelector('#document-edit input[required]'); input.focus(); input.select();`);
    await send('Input.insertText', { text: 'Unsaved title' });
    await evaluate('document.querySelector(".structured-link-card input").focus(); document.querySelector(".structured-link-card input").select()');
    await send('Input.insertText', { text: 'Unsaved card title' });
    await evaluate(`window.originalCardEditor.editor.commands.focus('end')`);
    await waitFor('document.activeElement === window.originalCardEditor');
    await send('Input.insertText', { text: ' Unsaved card body.' });
    await evaluate('window.requestCountBefore = window.requests.length');
    await preview(browser);
    await waitFor('document.querySelector(".cms-preview").textContent.includes("Unsaved sentence.")');
    assert.equal(await evaluate('document.querySelector(".cms-preview h1").textContent'), 'Unsaved title');
    assert.match(await evaluate('document.querySelector(".preview-meta").textContent'), /Editor One, Editor Two.*November 13, 2026.*Maps/s);
    assert.equal(await evaluate('document.querySelector("#document-edit").hidden && document.querySelector("#document-edit").inert'), true);
    assert.equal(await evaluate('document.querySelector(".body-editor .tiptap") === window.originalEditor'), true);
    assert.equal(await evaluate('document.querySelector(".body-editor .card-body .tiptap") === window.originalCardEditor'), true);
    assert.equal(await evaluate('document.querySelectorAll(".cms-preview input, .cms-preview textarea, .cms-preview select, .cms-preview button, .cms-preview [contenteditable=true], .cms-preview .image-resize-handle").length'), 0);
    assert.equal(await evaluate('document.querySelector(".preview-link-card strong").textContent'), 'Unsaved card title');
    assert.equal(await evaluate('document.querySelector(".preview-link-button.preview-button-secondary").textContent'), 'Read more');
    assert.equal(await evaluate('document.querySelector(".cms-preview .badge-preview").textContent'), 'A literal <message> & {value}.\nSecond line.');
    assert.match(await evaluate('document.querySelector(".preview-callout").textContent'), /A literal <message>/);
    assert.match(await evaluate('document.querySelector(".preview-card").textContent'), /A literal <title>/);
    assert.equal(await evaluate('document.querySelector(".cms-preview .collection-cardGrid .card-body strong").textContent'), 'Bold body');
    assert.match(await evaluate('document.querySelector(".cms-preview .collection-cardGrid .card-body").textContent'), /Unsaved card body/);
    assert.equal(await evaluate('document.querySelectorAll(".cms-preview .collection-cardGrid .collection-entry").length'), 1, 'blank cards are omitted');
    assert.equal(await evaluate('document.querySelector(".cms-preview .cms-metric-value").textContent'), '3,651');
    assert.equal(await evaluate('document.querySelectorAll(".cms-preview .editor-chip-preview li").length'), 2);
    assert.equal(await evaluate('document.querySelector(".cms-preview th").textContent'), 'Column A');
    assert.equal(await evaluate(`${previewImage('Formatted image')}.dataset.align`), 'right');
    assert.equal(await evaluate(`${previewImage('Formatted image')}.style.width`), '240px');
    assert.equal(await evaluate(`${previewImage('Ordinary image')}.querySelector('figcaption').hidden`), false);
    assert.equal(await evaluate('document.querySelectorAll(".cms-preview img").length'), 2, 'frontmatter cover is omitted like the published article');
    assert.equal(await evaluate(`(() => {
      const widget = [...document.querySelectorAll('.cms-preview .preview-protected')].find(block => block.textContent.includes('UnknownWidget'));
      return !!(widget.compareDocumentPosition(document.querySelector('.cms-preview > div:last-child')) & Node.DOCUMENT_POSITION_FOLLOWING);
    })()`), true, 'protected block remains before the final paragraph');
    await checkPreviewLinks(browser);
    assert.equal(await evaluate('location.pathname'), '/__editor-test');
    await evaluate('document.querySelector(".cms-preview .tiptap").focus()');
    await send('Input.insertText', { text: 'Must not be inserted.' });
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'z', code: 'KeyZ', modifiers: process.platform === 'darwin' ? 4 : 2 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'z', code: 'KeyZ' });
    assert.equal(await evaluate('document.querySelector(".cms-preview").textContent.includes("Must not be inserted.")'), false);
    assert.equal(await evaluate('document.querySelector(".cms-preview").textContent.includes("Unsaved sentence.")'), true);
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), true);
    assert.equal(await evaluate('!!document.querySelector(".draft-status") && !!document.querySelector(".editor-mode-toggle")'), true, 'draft status and Preview remain available on mobile');
    await edit(browser);
    assert.deepEqual(await evaluate('window.originalView.state.selection.toJSON()'), await evaluate('window.selectionBefore'));
    assert.equal(await evaluate('document.querySelector(".save-state").textContent'), 'Unsaved changes');
    await evaluate("window.originalCardEditor.editor.commands.undo()");
    await waitFor('!window.originalCardEditor.textContent.includes("Unsaved card body.")');
    await evaluate("window.originalCardEditor.editor.commands.redo()");
    await waitFor('window.originalCardEditor.textContent.includes("Unsaved card body.")');
    const undo = `[...window.originalEditor.closest('.rich-editor').querySelectorAll('button')].find(button => button.getAttribute('aria-label') === 'Undo')`;
    await evaluate(`${undo}.click()`);
    await waitFor('!window.originalEditor.textContent.includes("Unsaved sentence.")');
    const redo = undo.replace("=== 'Undo'", "=== 'Redo'");
    await evaluate(`${redo}.click()`);
    await waitFor('window.originalEditor.textContent.includes("Unsaved sentence.")');
    await preview(browser);
    await waitFor('document.querySelector(".cms-preview").textContent.includes("Unsaved sentence.")');
    assert.equal(await evaluate('window.requests.length === window.requestCountBefore'), true, 'toggling does not call any API');
    assert.equal(await evaluate('window.requests.some(request => request.method !== "GET")'), false);
    assert.equal(await evaluate('window.record.sha'), 'loaded');
  }, { initialSearch: '?area=posts&file=preview.mdx' });
});

test('documentation preview uses current library metadata and document image behavior without changing a clean entry', options, async () => {
  await withEditorBrowser(fixture('library'), async browser => {
    await browser.waitFor('!!document.querySelector(".body-editor .tiptap")');
    await preview(browser);
    assert.match(await browser.evaluate('document.querySelector(".preview-meta").textContent'), /Created: 2026/);
    assert.equal(await browser.evaluate('document.querySelector(".preview-summary").textContent'), 'Summary: Library summary');
    assert.equal(await browser.evaluate(`${previewImage('Ordinary image')}.querySelector('figcaption').hidden`), true);
    assert.equal(await browser.evaluate(`getComputedStyle(${previewImage('Ordinary image')}).maxWidth`), '100%');
    assert.equal(await browser.evaluate(`${previewImage('Formatted image')}.querySelector('figcaption').hidden`), false);
    await edit(browser);
    assert.equal(await browser.evaluate('document.querySelector(".save-state").textContent'), 'All changes saved');
    assert.equal(await browser.evaluate('window.requests.some(request => request.method !== "GET")'), false);
  }, { initialSearch: '?area=library&file=preview.mdx' });
});

test('never-saved pages preview current form content and reset mode when leaving the document', options, async () => {
  await withEditorBrowser(fixture('guides'), async browser => {
    await browser.waitFor('!!document.querySelector(".body-editor .tiptap")');
    await preview(browser);
    assert.equal(await browser.evaluate('document.querySelector(".cms-preview h1").textContent'), 'Untitled page');
    assert.equal(await browser.evaluate('document.querySelector(".cms-preview").textContent.includes("No body content yet.")'), true);
    await edit(browser);
    await browser.evaluate('document.querySelector(".body-editor .tiptap").focus()');
    await browser.send('Input.insertText', { text: 'New page, never saved.' });
    await preview(browser);
    await browser.waitFor('document.querySelector(".cms-preview").textContent.includes("New page, never saved.")');
    assert.equal(await browser.evaluate('document.querySelector(".save-state").textContent'), 'Not saved yet');
    await browser.evaluate('document.querySelector(".editor-navigation .back").click()');
    await answerLeaveDialog(browser);
    await browser.waitFor('!!document.querySelector(".project-list button")');
    await browser.evaluate('document.querySelector(".project-list button").click()');
    await browser.waitFor('!!document.querySelector(".body-editor .tiptap")');
    assert.equal(await browser.evaluate('document.querySelector("#document-edit").hidden'), false);
    assert.equal(await browser.evaluate('window.requests.some(request => request.method !== "GET")'), false);
  }, { initialSearch: '?area=guides&new=preview-test' });
});
