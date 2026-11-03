import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import { setTimeout as delay } from 'node:timers/promises';
import { chrome, withEditorBrowser } from './browserHarness.mjs';

const png = await sharp({ create: { width: 160, height: 100, channels: 3, background: '#0e7490' } }).png().toBuffer();
const legacy = '<CenterLayout class="legacy">\n![Protected](@images/private.png "Keep caption")\n<Other value={expression} />\n</CenterLayout>\n';
const libraryNames = ['original.png', 'replacement.png', ...Array.from({ length: 12 }, (_, index) => `sample-${index}.png`)];
const originalImage = "![Original alt](@images//original.png 'Original caption')";
const precedingText = Array.from({ length: 24 }, (_, index) => `Paragraph ${index + 1} before the image.`).join('\n\n');
const fixture = `import React from 'react';
import { createRoot } from 'react-dom/client';
import ProjectEditor from '../src/components/editor-prototype/ProjectEditor.tsx';
import '../src/components/editor-prototype/editor.css';
window.record = { filename: 'images.mdx', path: 'src/content/docs/posts/images.mdx', sha: 'loaded', content: '', title: 'Images', description: '', draft: true, body: ${JSON.stringify(`Before\n\n${precedingText}\n\n${originalImage}\n\nAfter\n\n${legacy}`)}, date: '2026-10-24', excerpt: '', authors: [], tags: [], cover: null };
window.writes = [];
window.confirm = () => true;
window.fetch = async (url, options = {}) => {
  const path = new URL(String(url), location.origin).pathname.replace('/__mock-gateway', '');
  if (path === '/api/session') return Response.json({ authenticated: true, login: 'test-editor' });
  if (path === '/api/images' && options.method === 'POST') { window.upload = JSON.parse(options.body); return Response.json({ path: 'uploaded.png', sha: 'uploaded', commitSha: 'upload' }); }
  if (path === '/api/images') return Response.json({ images: ${JSON.stringify(libraryNames)}.map(name => ({ name, path: name, sha: name })) });
  if (path === '/api/content/posts') return Response.json({ branch: 'custom-cms', entries: [{ name: 'images.mdx', path: 'src/content/docs/posts/images.mdx', sha: window.record.sha, draft: true, visibilityKnown: true }] });
  if (path === '/api/content/posts/images.mdx') {
    if (options.method === 'PUT') { const fields = JSON.parse(options.body); window.writes.push(fields); window.record = { ...window.record, ...fields, sha: 'saved-' + window.writes.length }; }
    return Response.json(window.record);
  }
  throw new Error('Unexpected API call: ' + path);
};
createRoot(document.getElementById('root')).render(React.createElement(ProjectEditor));`;

test('image controls insert, edit, cancel, render real images, and preserve Markdown through save/reopen', {
  skip: chrome ? false : 'Set CHROME_BIN to an installed Chrome/Chromium executable.', timeout: 45_000,
}, async () => {
  await withEditorBrowser(fixture, async ({ evaluate, waitFor, send, arrow }) => {
    const click = async (text, scope = 'document') => {
      await waitFor(`!![...${scope}.querySelectorAll('button')].find(button => button.textContent.trim() === ${JSON.stringify(text)} && !button.disabled)`);
      await evaluate(`[...${scope}.querySelectorAll('button')].find(button => button.textContent.trim() === ${JSON.stringify(text)}).click()`);
    };
    const fill = async (label, value) => {
      await waitFor(`!![...document.querySelectorAll('.image-picker label')].find(label => label.textContent.startsWith(${JSON.stringify(label)}))?.querySelector('input')`);
      await evaluate(`(() => { const input = [...document.querySelectorAll('.image-picker label')].find(label => label.textContent.startsWith(${JSON.stringify(label)})).querySelector('input'); input.focus(); input.select(); })()`);
      await send('Input.insertText', { text: value });
    };
    await waitFor('!!document.querySelector(".dashboard-card")');
    await evaluate('[...document.querySelectorAll(".dashboard-card")].find(button => button.textContent.includes("Blog Posts")).click()');
    await waitFor('!!document.querySelector(".project-list button")');
    await evaluate('document.querySelector(".project-list button").click()');
    await waitFor('document.querySelector(".editor-image img")?.naturalWidth > 0');
    assert.equal(await evaluate('document.querySelector(".editor-image figcaption").textContent'), 'Original caption');
    assert.equal(await evaluate('document.querySelector(".image-edit-action").offsetWidth'), 0, 'unselected images hide the action');
    // Select an image in the document and use its nearby editing action.
    const selectImage = async (index = 0) => {
      await delay(550); // ProseMirror treats rapid clicks at the same coordinates as a double-click.
      const point = await evaluate(`(() => { const image = document.querySelectorAll('.editor-image img')[${index}]; image.scrollIntoView({ block: 'center' }); const r = image.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
      await waitFor('document.querySelector(".ProseMirror-selectednode .image-edit-action")?.offsetWidth > 0');
    };
    await selectImage();
    assert.ok(await evaluate('document.querySelector(".toolbar").getBoundingClientRect().bottom < 0'), 'editing works with the toolbar scrolled out of view');
    const editPoint = await evaluate(`(() => { const r = document.querySelector('.ProseMirror-selectednode .image-edit-action').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...editPoint, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...editPoint, button: 'left', clickCount: 1 });
    await waitFor('!!document.querySelector(".image-picker")');
    await waitFor('document.querySelectorAll(".image-grid button").length === 6');
    await click('Next', 'document.querySelector(".image-pagination")');
    await waitFor('document.querySelector(".image-pagination span")?.textContent === "Page 2 of 3"');
    await fill('Find an existing image', 'original');
    await waitFor('document.querySelectorAll(".image-grid button").length === 1 && !document.querySelector(".image-pagination")');
    await fill('Find an existing image', 'sample');
    await waitFor('document.querySelectorAll(".image-grid button").length === 6');
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 740, deviceScaleFactor: 1, mobile: true });
    await evaluate('document.querySelector(".image-picker-body").scrollTop = 0');
    const mobile = await evaluate(`(() => {
      const dialog = document.querySelector('.image-picker');
      const footer = dialog.querySelector('.image-picker-actions').getBoundingClientRect();
      const fields = dialog.querySelector('.image-picker-fields').getBoundingClientRect();
      return { footerTop: footer.top, footerBottom: footer.bottom, fieldsBottom: fields.bottom, overflow: dialog.scrollWidth > dialog.clientWidth };
    })()`);
    assert.ok(mobile.fieldsBottom <= mobile.footerTop, 'image details are visible above the footer on mobile');
    assert.ok(mobile.footerBottom <= 740, 'actions stay inside the mobile viewport');
    assert.equal(mobile.overflow, false);
    const wheel = await evaluate(`(() => {
      const body = document.querySelector('.image-picker-body'); body.scrollTop = body.scrollHeight;
      const grid = document.querySelector('.image-grid').getBoundingClientRect();
      const bounds = body.getBoundingClientRect();
      return { x: grid.left + 20, y: Math.min(grid.bottom, bounds.bottom) - 20, before: body.scrollTop };
    })()`);
    await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: wheel.x, y: wheel.y, deltaX: 0, deltaY: -160 });
    await waitFor(`document.querySelector('.image-picker-body').scrollTop < ${wheel.before}`);
    assert.equal(await evaluate('document.querySelector(".image-grid").scrollTop'), 0, 'the grid has no nested scrollbar');
    await send('Emulation.setDeviceMetricsOverride', { width: 800, height: 600, deviceScaleFactor: 1, mobile: false });
    assert.equal(await evaluate('[...document.querySelectorAll(".image-picker label")].find(label => label.textContent === "Caption (optional)").querySelector("input").value'), 'Original caption');
    await fill('Caption (optional)', 'Canceled caption');
    await click('Cancel', 'document.querySelector(".image-picker")');
    await waitFor('!document.querySelector(".image-picker")');
    // ProseMirror counts clicks at the same coordinates within 500ms as a double click.
    await delay(550);
    await selectImage();
    assert.equal(await evaluate('document.querySelector(".editor-image figcaption").textContent'), 'Original caption');
    await click('Edit image', 'document.querySelector(".ProseMirror-selectednode")');
    await fill('Image source', '@images/replacement.png');
    await fill('Alt text', 'Replacement alt');
    await fill('Caption (optional)', 'Replacement "caption"');
    await click('Apply Changes', 'document.querySelector(".image-picker")');
    await waitFor('document.querySelector(".editor-image img")?.naturalWidth > 0 && document.querySelector(".editor-image img").alt === "Replacement alt"');
    assert.equal(await evaluate('document.querySelector(".editor-image figcaption").textContent'), 'Replacement "caption"');
    // Nearby formatting controls apply only to this image. Drag preserves its ratio.
    await selectImage();
    await click('Left', 'document.querySelector(".ProseMirror-selectednode")');
    const resizeStart = await evaluate(`(() => { const r = document.querySelector('.ProseMirror-selectednode .image-resize-handle').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...resizeStart, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: resizeStart.x + 70, y: resizeStart.y + 44, button: 'left', buttons: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: resizeStart.x + 70, y: resizeStart.y + 44, button: 'left', clickCount: 1 });
    await waitFor('Number(document.querySelector(".image-format-controls input").value) > 160');
    const ratio = await evaluate(`(() => { const r = document.querySelector('.editor-image img').getBoundingClientRect(); return r.width / r.height; })()`);
    assert.ok(Math.abs(ratio - 1.6) < .02, 'resizing preserves the image aspect ratio');
    await evaluate('document.querySelector(".image-format-controls input").focus(); document.querySelector(".image-format-controls input").select()');
    await send('Input.insertText', { text: '240' });
    await arrow('Tab', 9);
    await click('Right', 'document.querySelector(".ProseMirror-selectednode")');
    await waitFor('document.querySelector(".editor-image").dataset.align === "right" && document.querySelector(".editor-image").style.width === "240px"');
    await click('Save changes', 'document.querySelector(".editor-navigation")');
    await waitFor('window.writes.length === 1');
    assert.ok((await evaluate('window.record.body')).includes(legacy));
    assert.match(await evaluate('window.record.body'), /!\[Replacement alt\]\(@images\/replacement.png "Replacement \\"caption\\""\)/);
    // Reopen through the actual page editor and gateway response.
    await waitFor('!document.querySelector(".editor-navigation .back").disabled');
    await evaluate('document.querySelector(".editor-navigation .back").click()');
    await waitFor('!!document.querySelector(".project-list button")');
    await evaluate('document.querySelector(".project-list button").click()');
    await waitFor('document.querySelector(".editor-image img")?.alt === "Replacement alt"');
    assert.equal(await evaluate('document.querySelector(".editor-image figcaption").textContent'), 'Replacement "caption"');
    assert.match(await evaluate('window.record.body'), /<figure data-cms-image="true" data-align="right" data-width="240">/);
    assert.equal(await evaluate('document.querySelector(".editor-image").style.width'), '240px');
    await selectImage();
    await click('Center', 'document.querySelector(".ProseMirror-selectednode")');
    await waitFor('document.querySelector(".editor-image").dataset.align === "center"');
    await click('Reset formatting', 'document.querySelector(".ProseMirror-selectednode")');
    await waitFor('document.querySelector(".editor-image").dataset.formatted === "false"');
    // Upload through the existing picker, then insert a second image without a caption.
    await click('Image');
    await evaluate(`(() => { const input = document.querySelector('.image-picker input[type=file]'); const data = new DataTransfer(); data.items.add(new File([Uint8Array.from(atob('${png.toString('base64')}'), c => c.charCodeAt(0))], 'uploaded.png', { type: 'image/png' })); input.files = data.files; input.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    await waitFor('!!window.upload && [...document.querySelectorAll(".image-picker label")].find(label => label.textContent === "Image source").querySelector("input").value === "@images/uploaded.png"');
    await fill('Alt text', 'Uploaded alt');
    await fill('Caption (optional)', 'Uploaded caption');
    await click('Insert image', 'document.querySelector(".image-picker")');
    await waitFor('document.querySelectorAll(".editor-image").length === 2');
    await click('Image');
    await waitFor('!!document.querySelector(".image-grid button")');
    await evaluate('[...document.querySelectorAll(".image-grid button")].find(button => button.textContent === "original.png").click()');
    await fill('Alt text', 'No caption');
    await click('Insert image', 'document.querySelector(".image-picker")');
    await waitFor('document.querySelectorAll(".editor-image").length === 3');
    await click('Save changes', 'document.querySelector(".editor-navigation")');
    await waitFor('window.writes.length === 2');
    const saved = await evaluate('window.record.body');
    assert.match(saved, /!\[Uploaded alt\]\(@images\/uploaded.png "Uploaded caption"\)/);
    assert.match(saved, /!\[No caption\]\(@images\/original.png\)/);
    assert.ok(saved.includes(legacy));
    assert.equal(saved.includes('data-cms-image'), false, 'reset returns to ordinary Markdown');
    await waitFor('!document.querySelector(".editor-navigation .back").disabled');
    await evaluate('document.querySelector(".editor-navigation .back").click()');
    await waitFor('!!document.querySelector(".project-list button")');
    await evaluate('document.querySelector(".project-list button").click()');
    await waitFor('document.querySelectorAll(".editor-image").length === 3 && [...document.querySelectorAll(".editor-image img")].every(image => image.complete && image.naturalWidth > 0)');
    assert.equal(await evaluate('[...document.querySelectorAll(".editor-image figcaption")].some(caption => caption.textContent === "Uploaded caption")'), true);
    assert.equal(await evaluate(`document.querySelector('.editor-image img[alt="No caption"]').closest('.editor-image').querySelector('figcaption').hidden`), true);
    assert.equal(await evaluate('[...document.querySelectorAll(".editor-image img")].every(image => image.complete && image.naturalWidth > 0)'), true);
  }, { images: Object.fromEntries([...libraryNames, 'uploaded.png'].map(name => [name, png])) });
});
