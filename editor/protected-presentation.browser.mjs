import assert from 'node:assert/strict';
import test from 'node:test';
import { chrome, withEditorBrowser, openNewBlockMenu } from './browserHarness.mjs';
import { parseContent } from './content.mjs';
import { splitBody } from '../src/components/editor/bodySegments.ts';
import { validateDocument } from './validateDocument.mjs';

const setupOnly = "import Widget from './Widget.astro';\nimport './effects.css';\n";
const body = setupOnly + '\nFirst paragraph.\n\n<LegacyPanel>\n  Keep this whole layout.\n</LegacyPanel>\n<OtherWidget />\n\nBefore hidden code.\n\nexport const count = 2;\n\n{(window.protectedExpressionRan = true)}\n\nAfter hidden code.\n';
const fixture = body => `import React from 'react';
import { createRoot } from 'react-dom/client';
import ProjectEditor from '../src/components/editor/ProjectEditor.tsx';
import '../src/components/editor/editor.css';
import { parseBlog, serializeBlog } from './blog.mjs';
window.saved = ${JSON.stringify('---\ntitle: Protected presentation\ndraft: true\n---\n\n' + body)};
window.writes = [];
window.fetch = async (url, options = {}) => {
  const path = new URL(String(url), location.origin).pathname;
  if (path === '/api/session') return Response.json({ authenticated: true, login: 'tester' });
  if (path === '/api/content/posts') return Response.json({ branch: 'custom-cms', entries: [{ name: 'presentation.mdx', path: 'src/content/docs/posts/presentation.mdx', sha: 'loaded', draft: true, visibilityKnown: true }] });
  if (path === '/api/content/posts/presentation.mdx') {
    if (options.method === 'PUT') { const input = JSON.parse(options.body); window.writes.push(input); window.saved = serializeBlog(window.saved, input); }
    return Response.json({ ...parseBlog(window.saved), content: window.saved, filename: 'presentation.mdx', sha: 'loaded', commitSha: 'saved' });
  }
  throw new Error('Unexpected API: ' + path);
};
createRoot(document.getElementById('root')).render(React.createElement(ProjectEditor));`;
const options = { skip: chrome ? false : 'Chrome/Chromium is required.', timeout: 60_000 };
async function open({ evaluate, waitFor }) {
  await waitFor('!!document.querySelector(".dashboard-card")');
  await evaluate('[...document.querySelectorAll(".dashboard-card")].find(button => button.textContent.includes("Blog Posts")).click()');
  await waitFor('!!document.querySelector(".project-list button")');
  await evaluate('document.querySelector(".project-list button").click()');
  await waitFor('!!document.querySelector(".page-setup")');
}

test('page setup is a locked inspector; adjacent protected content is named and source stays exact through saves', options, async () => {
  await withEditorBrowser(fixture(body), async browser => {
    const { evaluate, waitFor, send } = browser;
    await open(browser);
    assert.equal(await evaluate('document.querySelector(".page-setup").open'), false);
    assert.match(await evaluate('document.querySelector(".page-setup > summary").textContent'), /Page setup.*Locked.*4 source blocks/);
    assert.equal(await evaluate('document.querySelectorAll(".block-row [data-protected-type=setup]").length'), 0);
    assert.equal(await evaluate('document.querySelectorAll(".block-row .protected-block").length'), 2);
    const labels = await evaluate('[...document.querySelectorAll(".block-row .protected-block > summary")].map(n => n.textContent)');
    assert.match(labels[0], /LegacyPanel.*Read-only/);
    assert.match(labels[1], /OtherWidget.*Read-only/);
    await evaluate('document.querySelector(".page-setup > summary").focus()');
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    assert.equal(await evaluate('document.querySelector(".page-setup").open'), true);
    await evaluate('document.querySelector(".page-setup .protected-block > summary").click(); document.querySelector(".block-row .protected-block > summary").click()');
    assert.equal(await evaluate('document.querySelector(".page-setup pre").textContent'), setupOnly.split('\n')[0] + '\n');
    assert.equal(await evaluate('document.querySelector(".page-setup button, .page-setup [contenteditable=true]")'), null);
    assert.equal(await evaluate('document.querySelector(".block-row .protected-block button, .block-row .protected-block [contenteditable=true]")'), null);
    assert.match(await evaluate('document.querySelector(".block-row .protected-block pre").textContent'), /Keep this whole layout/);
    assert.equal(await evaluate('window.protectedExpressionRan === true'), false);
    // Setup between prose blocks still forms a source movement barrier.
    const beforeCode = '[...document.querySelectorAll(".block-row")].find(row => row.querySelector(".tiptap")?.textContent.includes("Before hidden code"))';
    assert.equal(await evaluate(`${beforeCode}.querySelector('button[data-move="1"]').disabled`), true);
    await evaluate('document.querySelector(".editor-fields > label input").focus(); document.querySelector(".editor-fields > label input").select()');
    await send('Input.insertText', { text: 'Metadata edit' });
    const save = async count => {
      await evaluate('document.querySelector(".top-save").click()');
      await waitFor(`window.writes.length === ${count} && document.querySelector('.save-state').textContent === 'All changes saved'`);
      const saved = await evaluate('window.saved');
      await validateDocument(saved, { originalBody: body });
      return parseContent(saved).body;
    };
    assert.equal(await save(1), body);
    await evaluate('document.querySelector(".body-editor .tiptap").editor.commands.focus("end")');
    await waitFor('document.activeElement === document.querySelector(".body-editor .tiptap")');
    await send('Input.insertText', { text: ' Edited text.' });
    const edited = await save(2);
    for (const segment of splitBody(body).filter(s => s.kind === 'protected')) assert.ok(edited.includes(segment.content));
    await evaluate('[...document.querySelectorAll(".editor-mode-toggle button")].find(button => button.textContent === "Preview").click()');
    await waitFor('document.querySelectorAll("#document-preview .preview-protected").length === 2');
    const preview = await evaluate('document.querySelector("#document-preview").textContent');
    assert.ok(!preview.includes('Widget.astro') && !preview.includes('export const') && !preview.includes('protectedExpressionRan'));
    assert.ok(preview.includes('LegacyPanel') && preview.includes('OtherWidget'));
    await evaluate('document.querySelector(".editor-navigation .back").click()');
    await waitFor('!!document.querySelector(".project-list button")');
    await evaluate('document.querySelector(".project-list button").click()');
    await waitFor('!!document.querySelector(".page-setup")');
    assert.equal(await evaluate('document.querySelector(".page-setup").open'), false);
    assert.equal(await evaluate('document.querySelectorAll(".block-row .protected-block").length'), 2);
    assert.match(await evaluate('document.querySelector(".body-editor .tiptap").textContent'), /Edited text/);
  });
});

test('a setup-only page still offers content insertion after its preserved imports', options, async () => {
  await withEditorBrowser(fixture(setupOnly), async browser => {
    const { evaluate, waitFor, send } = browser;
    await open(browser);
    assert.equal(await evaluate('document.querySelectorAll(".block-row").length'), 0);
    assert.ok(await evaluate('!!document.querySelector(".empty-body")'));
    const menu = await openNewBlockMenu(browser, 'Text', 'document.querySelector(".empty-body")');
    await evaluate(`[...${menu}.querySelectorAll('button')].find(button => button.textContent === 'Text').click()`);
    await waitFor('!!document.querySelector(".body-editor .tiptap")');
    await evaluate('document.querySelector(".body-editor .tiptap").focus()');
    await send('Input.insertText', { text: 'New content.' });
    await evaluate('document.querySelector(".top-save").click()');
    await waitFor('window.writes.length === 1');
    const saved = await evaluate('window.saved');
    await validateDocument(saved, { originalBody: setupOnly });
    assert.ok(parseContent(saved).body.startsWith(setupOnly));
    assert.match(parseContent(saved).body, /New content/);
  });
});
