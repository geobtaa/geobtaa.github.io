import assert from 'node:assert/strict';
import test from 'node:test';
import { chrome, withEditorBrowser, openNewBlockMenu } from './browserHarness.mjs';

const legacy = '<Badge text="Legacy badge" />\n\n<Aside type="tip">Legacy callout.</Aside>\n\n<Card title="Legacy card">Legacy **rich** content.</Card>\n';
const fixture = `import React from 'react';
import { createRoot } from 'react-dom/client';
import ProjectEditor from '../src/components/editor-prototype/ProjectEditor.tsx';
import '../src/components/editor-prototype/editor.css';
window.record = { filename: 'simple-components.mdx', title: 'Simple components', description: '', body: ${JSON.stringify(`import { Badge, Aside, Card } from '@astrojs/starlight/components';\n\n${legacy}`)}, content: '', draft: true, date: '2026-10-24', authors: [], tags: [], cover: null, sha: 'original' };
window.writes = [];
window.confirm = () => true;
window.fetch = async (url, options = {}) => {
  const path = new URL(String(url), location.origin).pathname;
  if (path === '/api/session') return Response.json({ authenticated: true, login: 'tester' });
  if (path === '/api/content/posts') return Response.json({ branch: 'custom-cms', entries: [{ name: window.record.filename, path: 'src/content/docs/posts/simple-components.mdx', sha: window.record.sha, draft: true, visibilityKnown: true }] });
  if (path === '/api/content/posts/simple-components.mdx') {
    if (options.method === 'PUT') { const fields = JSON.parse(options.body); window.writes.push(fields); window.record = { ...window.record, ...fields, sha: 'saved-' + window.writes.length }; }
    return Response.json(window.record);
  }
  throw new Error('Unexpected API call: ' + path);
};
createRoot(document.getElementById('root')).render(React.createElement(ProjectEditor));`;

test('new badges, callouts, and cards insert, edit, save/reopen and remove without touching legacy MDX', {
  skip: chrome ? false : 'Set CHROME_BIN to an installed Chrome/Chromium executable.', timeout: 45_000,
}, async () => {
  await withEditorBrowser(fixture, async ({ evaluate, waitFor, send, arrow }) => {
    const click = async (text, scope = 'document') => {
      if (scope === 'document') scope = await openNewBlockMenu({ evaluate, waitFor }, text) || scope;
      await waitFor(`!!${scope} && [...${scope}.querySelectorAll('button')].some(button => button.textContent.trim() === ${JSON.stringify(text)} && !button.disabled)`);
      await evaluate(`[...${scope}.querySelectorAll('button')].find(button => button.textContent.trim() === ${JSON.stringify(text)}).click()`);
    };
    const field = (scope, label) => `[...${scope}.querySelectorAll('label')].find(label => label.textContent.startsWith(${JSON.stringify(label)})).querySelector('input, textarea, select')`;
    const fill = async (scope, label, value) => {
      const selector = field(scope, label);
      await evaluate(`${selector}.focus(); ${selector}.select()`);
      await send('Input.insertText', { text: value });
    };
    const select = async (scope, label, value) => evaluate(`(() => { const input = ${field(scope, label)}; input.value = ${JSON.stringify(value)}; input.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    const dialog = 'document.querySelector(".simple-component-dialog")';
    await waitFor('!!document.querySelector(".dashboard-card")');
    await evaluate('[...document.querySelectorAll(".dashboard-card")].find(button => button.textContent.includes("Blog Posts")).click()');
    await waitFor('!!document.querySelector(".project-list button")');
    await evaluate('document.querySelector(".project-list button").click()');
    await waitFor('!!document.querySelector(".protected-block")');
    assert.equal(await evaluate('document.querySelectorAll(".structured-simple-component").length'), 0, 'legacy components remain read-only');
    await click('Text');
    await click('Badge');
    await waitFor('!!document.querySelector(".simple-component-dialog")');
    await fill(dialog, 'Badge text', 'Canceled badge');
    await click('Cancel', dialog);
    await waitFor('!document.querySelector(".simple-component-dialog")');
    assert.equal(await evaluate('document.querySelectorAll(".structured-simple-component").length'), 0);
    for (const [index, label] of ['Badge', 'Callout', 'Card'].entries()) {
      if (index) await click('Text');
      await click(`${label}`);
      await waitFor('!!document.querySelector(".simple-component-dialog")');
      await click(`Insert ${label}`, dialog);
      await waitFor('!!document.querySelector(".simple-component-dialog [role=alert]")');
      if (label === 'Badge') {
        await fill(dialog, 'Badge text', 'New & useful');
        await select(dialog, 'Style', 'success'); await select(dialog, 'Size', 'medium');
      } else {
        await fill(dialog, 'Title', label === 'Card' ? 'Maps & <b>literal</b>' : 'Remember');
        await fill(dialog, 'Message', 'First line\nSecond {line} with **literal text**.');
        if (label === 'Callout') await select(dialog, 'Type', 'tip');
      }
      await click(`Insert ${label}`, dialog);
      await waitFor(`document.querySelectorAll('.structured-simple-component').length === ${index + 1} && !document.querySelector('.simple-component-dialog')`);
      assert.equal(await evaluate('document.querySelectorAll(".body-editor .toolbar").length'), 0, 'no formatting palette on component forms');
      assert.equal(await evaluate('document.querySelectorAll(".rich-editor").length'), 0, 'no blank text editor after insertion');
    }
    const callout = 'document.querySelector(".simple-callout")';
    const message = field(callout, 'Message');
    await evaluate(`${message}.focus(); ${message}.select()`);
    await arrow('ArrowLeft', 37); await arrow('ArrowRight', 39); await arrow('ArrowRight', 39);
    for (const text of 'xyz') await send('Input.insertText', { text });
    assert.equal(await evaluate(`${message}.value`), 'Fixyzrst line\nSecond {line} with **literal text**.');
    assert.equal(await evaluate(`${message}.selectionStart`), 5);
    await select('document.querySelector(".simple-badge")', 'Style', 'caution');
    await select('document.querySelector(".simple-badge")', 'Size', 'large');
    await waitFor('!!document.querySelector(".badge-preview.badge-caution.badge-size-large")');
    await click('Text');
    await waitFor('!!document.querySelector(".rich-editor .tiptap")');
    await evaluate('document.querySelector(".rich-editor .tiptap").focus()');
    await send('Input.insertText', { text: 'A normal paragraph.' });
    await click('Save changes', 'document.querySelector(".editor-navigation")');
    await waitFor('window.writes.length === 1 && !document.querySelector(".top-save").disabled');
    const saved = await evaluate('window.record.body');
    assert.ok(saved.includes(legacy));
    assert.match(saved, /<CmsBadge text="New &amp; useful" variant="caution" size="large" \/>/);
    assert.match(saved, /<CmsCallout type="tip" title="Remember">/);
    assert.match(saved, /<CmsCard title="Maps &amp;amp; &amp;lt;b&amp;gt;literal&amp;lt;\/b&amp;gt;">/);
    assert.match(saved, /A normal paragraph\./);
    for (const binding of ['CmsBadge', 'CmsCallout', 'CmsCard']) assert.equal([...saved.matchAll(new RegExp(`as ${binding} \\}`, 'g'))].length, 1);
    await evaluate('document.querySelector(".editor-navigation .back").click()');
    await waitFor('!!document.querySelector(".project-list button")');
    await evaluate('document.querySelector(".project-list button").click()');
    await waitFor('document.querySelectorAll(".structured-simple-component").length === 3');
    assert.equal(await evaluate(`${field('document.querySelector(".simple-card")', 'Title')}.value`), 'Maps & <b>literal</b>');
    assert.equal(await evaluate(`${field(callout, 'Message')}.value`), 'Fixyzrst line\nSecond {line} with **literal text**.');
    assert.equal(await evaluate('document.querySelectorAll(".body-editor .toolbar").length'), 1, 'only ordinary Markdown has a toolbar');
    await click('Save changes', 'document.querySelector(".editor-navigation")');
    await waitFor('window.writes.length === 2 && !document.querySelector(".top-save").disabled');
    assert.equal(await evaluate('window.record.body'), saved, 'unchanged reopened content saves exactly');
    await click('Remove Badge');
    await waitFor('document.querySelectorAll(".structured-simple-component").length === 2');
    await click('Save changes', 'document.querySelector(".editor-navigation")');
    await waitFor('window.writes.length === 3');
    const removed = await evaluate('window.record.body');
    assert.doesNotMatch(removed, /<CmsBadge/);
    assert.ok(removed.includes(legacy));
    assert.match(removed, /<CmsCallout/); assert.match(removed, /<CmsCard/);
  });
});
