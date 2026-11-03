import assert from 'node:assert/strict';
import test from 'node:test';
import { chrome, withEditorBrowser, openNewBlockMenu } from './browserHarness.mjs';

const protectedBlock = '<CenterLayout>\nKeep this legacy content.\n</CenterLayout>\n\n<LinkButton href="/" icon="external">Protected button</LinkButton>\n';
const fixture = `import React from 'react';
import { createRoot } from 'react-dom/client';
import ProjectEditor from '../src/components/editor-prototype/ProjectEditor.tsx';
import '../src/components/editor-prototype/editor.css';
window.record = { filename: 'buttons.mdx', title: 'Buttons', description: '', body: ${JSON.stringify(`Before\n\n${protectedBlock}`)}, content: '', draft: true, date: '2026-10-24', authors: [], tags: [], cover: null, sha: 'original' };
window.writes = [];
window.confirm = () => true;
window.fetch = async (url, options = {}) => {
  const path = new URL(String(url), location.origin).pathname;
  if (path === '/api/session') return Response.json({ authenticated: true, login: 'tester' });
  if (path === '/api/content/posts') return Response.json({ branch: 'custom-cms', entries: [{ name: 'buttons.mdx', path: 'src/content/docs/posts/buttons.mdx', sha: window.record.sha, draft: true, visibilityKnown: true }] });
  if (path === '/api/content/posts/buttons.mdx') {
    if (options.method === 'PUT') { const fields = JSON.parse(options.body); window.writes.push(fields); window.record = { ...window.record, ...fields, sha: 'saved' }; }
    return Response.json(window.record);
  }
  throw new Error('Unexpected API call: ' + path);
};
createRoot(document.getElementById('root')).render(React.createElement(ProjectEditor));`;

test('LinkButton inserts, edits without cursor jumps, and saves/reopens with protected MDX intact', {
  skip: chrome ? false : 'Set CHROME_BIN to an installed Chrome/Chromium executable.', timeout: 30_000,
}, async () => {
  await withEditorBrowser(fixture, async ({ evaluate, waitFor, send, arrow }) => {
    const click = async (text, scope = 'document') => {
      if (scope === 'document') scope = await openNewBlockMenu({ evaluate, waitFor }, text) || scope;
      await waitFor(`!!${scope} && [...${scope}.querySelectorAll('button')].some(button => button.textContent.trim() === ${JSON.stringify(text)} && !button.disabled)`);
      await evaluate(`[...${scope}.querySelectorAll('button')].find(button => button.textContent.trim() === ${JSON.stringify(text)}).click()`);
    };
    const fill = async (selector, text) => {
      await evaluate(`${selector}.focus(); ${selector}.select()`);
      await send('Input.insertText', { text });
    };
    await waitFor('!!document.querySelector(".dashboard-card")');
    await evaluate('[...document.querySelectorAll(".dashboard-card")].find(button => button.textContent.includes("Blog Posts")).click()');
    await waitFor('!!document.querySelector(".project-list button")');
    await evaluate('document.querySelector(".project-list button").click()');
    await waitFor('!!document.querySelector(".tiptap")');
    await click('Link Button');
    await waitFor('!!document.querySelector("#link-button-dialog-title")');
    await click('Insert Link Button', 'document.querySelector(".link-card-dialog")');
    await waitFor('document.querySelector(".link-card-dialog [role=alert]")?.textContent.includes("button text")');
    await fill('document.querySelectorAll(".link-card-dialog input")[0]', 'Canceled');
    await click('Cancel', 'document.querySelector(".link-card-dialog")');
    await waitFor('!document.querySelector(".link-card-dialog")');
    assert.equal(await evaluate('document.querySelectorAll(".structured-link-button").length'), 0);
    await click('Link Button');
    await waitFor('!!document.querySelector(".link-card-dialog input")');
    await fill('document.querySelectorAll(".link-card-dialog input")[0]', 'Visit the catalog');
    await fill('document.querySelectorAll(".link-card-dialog input")[1]', '/catalog/');
    await evaluate('const select = document.querySelector(".link-card-dialog select"); select.value = "secondary"; select.dispatchEvent(new Event("change", { bubbles: true }))');
    await click('Insert Link Button', 'document.querySelector(".link-card-dialog")');
    await waitFor('!!document.querySelector(".structured-link-button input") && !document.querySelector(".link-card-dialog")');
    assert.equal(await evaluate('document.querySelector(".structured-link-button select").value'), 'secondary');
    const field = 'document.querySelector(".structured-link-button input")';
    await evaluate(`${field}.focus(); ${field}.select()`);
    await arrow('ArrowLeft', 37); await arrow('ArrowRight', 39); await arrow('ArrowRight', 39);
    for (const text of 'xyz') await send('Input.insertText', { text });
    assert.equal(await evaluate(`${field}.value`), 'Vixyzsit the catalog');
    assert.equal(await evaluate(`${field}.selectionStart`), 5);
    await fill('document.querySelectorAll(".structured-link-button input")[1]', 'https://example.com/maps');
    await evaluate('const appearance = document.querySelector(".structured-link-button select"); appearance.value = "minimal"; appearance.dispatchEvent(new Event("change", { bubbles: true }))');
    await waitFor('!!document.querySelector(".link-button-preview.minimal")');
    await click('Save changes', 'document.querySelector(".editor-navigation")');
    await waitFor('window.writes.length === 1');
    const saved = await evaluate('window.record.body');
    assert.ok(saved.includes(protectedBlock));
    assert.match(saved, /<LinkButton href="https:\/\/example.com\/maps" variant="minimal">Vixyzsit the catalog<\/LinkButton>/);
    assert.equal([...saved.matchAll(/import \{ LinkButton \}/g)].length, 1);
    await evaluate('document.querySelector(".editor-navigation .back").click()');
    await waitFor('!!document.querySelector(".project-list button")');
    await evaluate('document.querySelector(".project-list button").click()');
    await waitFor('document.querySelector(".structured-link-button input")?.value === "Vixyzsit the catalog"');
    assert.equal(await evaluate('document.querySelectorAll(".structured-link-button input")[1].value'), 'https://example.com/maps');
    assert.equal(await evaluate('document.querySelector(".structured-link-button select").value'), 'minimal');
    await click('Save changes', 'document.querySelector(".editor-navigation")');
    await waitFor('window.writes.length === 2');
    assert.equal(await evaluate('window.record.body'), saved);
  });
});

for (const first of ['Link Card', 'Link Button']) {
  test(`${first} inserted into an empty body creates only a standalone property form`, {
    skip: chrome ? false : 'Set CHROME_BIN to an installed Chrome/Chromium executable.', timeout: 30_000,
  }, async () => {
    const emptyFixture = fixture.replace(JSON.stringify(`Before\n\n${protectedBlock}`), "''");
    await withEditorBrowser(emptyFixture, async ({ evaluate, waitFor, send }) => {
      const click = async (text, scope = 'document') => {
      if (scope === 'document') scope = await openNewBlockMenu({ evaluate, waitFor }, text) || scope;
        await waitFor(`!!${scope} && [...${scope}.querySelectorAll('button')].some(button => button.textContent.trim() === ${JSON.stringify(text)} && !button.disabled)`);
        await evaluate(`[...${scope}.querySelectorAll('button')].find(button => button.textContent.trim() === ${JSON.stringify(text)}).click()`);
      };
      const insert = async (name) => {
        await click(`${name}`);
        await waitFor('!!document.querySelector(".link-card-dialog input")');
        for (const [index, value] of [[0, `${name} title`], [1, '/catalog/']]) {
          await evaluate(`document.querySelectorAll('.link-card-dialog input')[${index}].focus()`);
          await send('Input.insertText', { text: value });
        }
        await click(`Insert ${name}`, 'document.querySelector(".link-card-dialog")');
        await waitFor('!document.querySelector(".link-card-dialog")');
      };
      await waitFor('!!document.querySelector(".dashboard-card")');
      await evaluate('[...document.querySelectorAll(".dashboard-card")].find(button => button.textContent.includes("Blog Posts")).click()');
      await waitFor('!!document.querySelector(".project-list button")');
      await evaluate('document.querySelector(".project-list button").click()');
      await waitFor('!!document.querySelector(".rich-editor .tiptap")');
      await insert(first);
      await waitFor('document.querySelectorAll(".component-editor").length === 1');
      assert.equal(await evaluate('document.querySelectorAll(".body-editor .toolbar").length'), 0, 'property forms have no formatting palette');
      assert.equal(await evaluate('document.querySelectorAll(".body-editor .rich-editor").length'), 0, 'no empty text editor is created');
      assert.equal(await evaluate('document.querySelectorAll(".component-editor .tiptap p").length'), 0, 'no trailing paragraph is created');
      await click('Save changes', 'document.querySelector(".editor-navigation")');
      await waitFor('window.writes.length === 1');
      await evaluate('document.querySelector(".editor-navigation .back").click()');
      await waitFor('!!document.querySelector(".project-list button")');
      await evaluate('document.querySelector(".project-list button").click()');
      await waitFor('document.querySelectorAll(".component-editor").length === 1');
      assert.equal(await evaluate('document.querySelectorAll(".body-editor .rich-editor").length'), 0, 'reopening keeps separator whitespace invisible');
      await click('Text');
      await waitFor('!!document.querySelector(".rich-editor .tiptap")');
      await evaluate('document.querySelector(".rich-editor .tiptap").focus()');
      await send('Input.insertText', { text: 'Text after the component.' });
      await waitFor('document.querySelector(".rich-editor .tiptap").textContent === "Text after the component."');
      await insert(first === 'Link Card' ? 'Link Button' : 'Link Card');
      await waitFor('document.querySelectorAll(".component-editor").length === 2');
      assert.equal(await evaluate('document.querySelectorAll(".body-editor .toolbar").length'), 1, 'only the real text block has a palette');
      assert.equal(await evaluate('document.querySelectorAll(".rich-editor").length'), 1);
      assert.equal(await evaluate('document.querySelector(".rich-editor .tiptap").textContent'), 'Text after the component.');
      await click('Save changes', 'document.querySelector(".editor-navigation")');
      await waitFor('window.writes.length === 2');
      const saved = await evaluate('window.record.body');
      assert.match(saved, /Text after the component\./);
      assert.match(saved, /<LinkCard/);
      assert.match(saved, /<LinkButton/);
      await click(`Remove ${first}`);
      await waitFor('document.querySelectorAll(".component-editor").length === 1');
      assert.equal(await evaluate('document.querySelector(".rich-editor .tiptap").textContent'), 'Text after the component.');
    });
  });
}

test('bare website addresses work for links, cards, and buttons while existing and internal links stay unchanged', {
  skip: chrome ? false : 'Set CHROME_BIN to an installed Chrome/Chromium executable.', timeout: 30_000,
}, async () => {
  const legacy = '<LinkCard title="Legacy card" href="legacy.example.com" />\n\n<LinkButton href="legacy.example.org">Legacy button</LinkButton>\n';
  const addressFixture = fixture.replace(JSON.stringify(`Before\n\n${protectedBlock}`), JSON.stringify(`Before\n\n${legacy}\n${protectedBlock}`));
  await withEditorBrowser(addressFixture, async ({ evaluate, waitFor, send }) => {
    const click = async (text, scope = 'document') => {
      if (scope === 'document') scope = await openNewBlockMenu({ evaluate, waitFor }, text) || scope;
      await waitFor(`!!${scope} && [...${scope}.querySelectorAll('button')].some(button => button.textContent.trim() === ${JSON.stringify(text)} && !button.disabled)`);
      await evaluate(`[...${scope}.querySelectorAll('button')].find(button => button.textContent.trim() === ${JSON.stringify(text)}).click()`);
    };
    const fill = async (selector, text) => {
      await evaluate(`${selector}.focus(); ${selector}.select()`);
      await send('Input.insertText', { text });
    };
    await waitFor('!!document.querySelector(".dashboard-card")');
    await evaluate('[...document.querySelectorAll(".dashboard-card")].find(button => button.textContent.includes("Blog Posts")).click()');
    await waitFor('!!document.querySelector(".project-list button")');
    await evaluate('document.querySelector(".project-list button").click()');
    await waitFor('document.querySelectorAll(".link-address-field input").length === 2');
    assert.deepEqual(await evaluate('[...document.querySelectorAll(".link-address-field input")].map(input => input.value)'), ['legacy.example.com', 'legacy.example.org']);
    // Focusing and leaving an existing address is not an edit.
    await evaluate('document.querySelector(".link-address-field input").focus(); document.querySelector(".link-address-field input").blur()');
    await fill('document.querySelector(".structured-link-card input")', 'Legacy title revised');
    await evaluate(`(() => {
      window.prompt = () => 'docs.example.net/help';
      const paragraph = document.querySelector('.rich-editor .tiptap p');
      paragraph.parentElement.focus();
      const range = document.createRange(); range.selectNodeContents(paragraph);
      const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
    })()`);
    await evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
    await click('Link', 'document.querySelector(".rich-editor .toolbar")');
    await waitFor('document.querySelector(".rich-editor a")?.getAttribute("href") === "https://docs.example.net/help"');
    for (const [name, address] of [['Link Card', 'example.com/maps'], ['Link Button', 'example.org/contact']]) {
      await click(`${name}`);
      await waitFor('!!document.querySelector(".link-card-dialog input")');
      await fill('document.querySelectorAll(".link-card-dialog input")[0]', `New ${name}`);
      await fill('document.querySelectorAll(".link-card-dialog input")[1]', address);
      await click(`Insert ${name}`, 'document.querySelector(".link-card-dialog")');
      await waitFor('!document.querySelector(".link-card-dialog")');
    }
    await waitFor('document.querySelectorAll(".link-address-field input").length === 4');
    const newCard = `document.querySelectorAll('.structured-link-card:not(.structured-link-button) .link-address-field input')[0]`;
    const newButton = `document.querySelectorAll('.structured-link-button .link-address-field input')[0]`;
    assert.equal(await evaluate(`${newCard}.value`), 'https://example.com/maps');
    assert.equal(await evaluate(`${newButton}.value`), 'https://example.org/contact');
    await fill(newCard, '/guides/help/');
    await fill(newButton, 'maps.example.edu/catalog');
    // A real Save click must commit the address still being edited before saving.
    await evaluate('document.querySelector(".top-save").scrollIntoView({ block: "center" })');
    const point = await evaluate('(() => { const r = document.querySelector(".top-save").getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()');
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
    await waitFor('window.writes.length === 1');
    const saved = await evaluate('window.record.body');
    assert.match(saved, /href="https:\/\/maps.example.edu\/catalog"/);
    assert.match(saved, /href="\/guides\/help\/"/);
    assert.match(saved, /title="Legacy title revised" href="legacy.example.com"/);
    assert.match(saved, /href="legacy.example.org">Legacy button/);
    assert.match(saved, /\[Before\]\(https:\/\/docs.example.net\/help\)/);
    assert.ok(saved.includes(protectedBlock));
    await waitFor('!document.querySelector(".top-save").disabled');
    await evaluate('document.querySelector(".editor-navigation .back").click()');
    await waitFor('!!document.querySelector(".project-list button")');
    await evaluate('document.querySelector(".project-list button").click()');
    await waitFor('document.querySelectorAll(".link-address-field input").length === 4');
    assert.ok((await evaluate('[...document.querySelectorAll(".link-address-field input")].map(input => input.value)')).includes('https://maps.example.edu/catalog'));
  });
});
