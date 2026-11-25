import assert from 'node:assert/strict';
import test from 'node:test';
import { chrome, withEditorBrowser } from './browserHarness.mjs';
import { parseDirectiveCallout } from '../src/components/editor/directiveCallout.ts';
import { splitBody } from '../src/components/editor/bodySegments.ts';

const protectedSource = "import Custom from './Custom.astro';\n\n<Custom value={expression}>Preserved.</Custom>\n";
const callout = ':::info[Existing title]\n\nA **bold** [map link](/maps).\n\n- First item\n- Second item\n\n:::\n';
const originalBody = `${protectedSource}\n${callout}\nOrdinary paragraph.\n`;
const fixture = `import React from 'react';
import { createRoot } from 'react-dom/client';
import ProjectEditor from '../src/components/editor/ProjectEditor.tsx';
import '../src/components/editor/editor.css';
window.record = { filename: 'callouts.mdx', sha: 'loaded', title: 'Callouts', description: '', draft: true, date: '2026-11-23', authors: [], tags: [], cover: null, body: ${JSON.stringify(originalBody)}, content: ${JSON.stringify('---\ntitle: Callouts\n---\n\n' + originalBody)} };
window.writes = [];
window.confirm = () => true;
window.fetch = async (url, options = {}) => {
  const path = new URL(String(url), location.origin).pathname;
  if (path === '/api/session') return Response.json({ authenticated: true, login: 'tester' });
  if (path === '/api/content/updates') return Response.json({ branch: 'custom-cms', entries: [{ name: 'callouts.mdx', path: 'src/content/docs/updates/callouts.mdx', sha: window.record.sha }] });
  if (path === '/api/content/updates/callouts.mdx') {
    if (options.method === 'PUT') { const input = JSON.parse(options.body); window.writes.push(input); window.record = { ...window.record, ...input, sha: 'saved-' + window.writes.length, commitSha: 'saved-commit' }; }
    return Response.json(window.record);
  }
  throw new Error('Unexpected API call: ' + path);
};
createRoot(document.getElementById('root')).render(React.createElement(ProjectEditor));`;

test('directive callouts edit rich messages, consolidate aliases, save/reopen and preserve protected source', { skip: chrome ? false : 'Chrome/Chromium is required.', timeout: 60_000 }, async () => {
  await withEditorBrowser(fixture, async ({ evaluate, waitFor, send }) => {
    await waitFor('!!document.querySelector(".dashboard-card")');
    await evaluate('[...document.querySelectorAll(".dashboard-card")].find(button => button.textContent.includes("Program Updates")).click()');
    await waitFor('!!document.querySelector(".project-list button")');
    await evaluate('document.querySelector(".project-list button").click()');
    await waitFor('!!document.querySelector(".simple-callout .card-body .tiptap")');
    assert.equal(await evaluate('document.querySelectorAll(".simple-callout").length'), 1);
    assert.equal(await evaluate('document.querySelector(".simple-callout select").value'), 'note');
    assert.equal(await evaluate('document.querySelectorAll(".simple-callout .card-body strong").length'), 1);
    assert.equal(await evaluate('document.querySelectorAll(".simple-callout .card-body li").length'), 2);

    // An unrelated metadata edit must not normalize or rewrite the original callout.
    await evaluate('document.querySelector(".editor-fields > label input").focus(); document.querySelector(".editor-fields > label input").select()');
    await send('Input.insertText', { text: 'Revised page title' });
    await evaluate('document.querySelector(".top-save").click()');
    await waitFor('window.writes.length === 1 && document.querySelector(".top-save").disabled && document.querySelector(".top-save").textContent === "Save Draft"');
    assert.equal(await evaluate('window.writes[0].body'), originalBody);

    await evaluate('document.querySelector(".simple-callout input").focus(); document.querySelector(".simple-callout input").select()');
    await send('Input.insertText', { text: 'Revised callout title' });
    const changedTitleBody = await evaluate('document.querySelector(".simple-callout .card-body .tiptap").editor.getMarkdown()');
    assert.match(changedTitleBody, /\*\*bold\*\*/);
    assert.match(changedTitleBody, /\[map link\]\(\/maps\)/);

    await evaluate(`(() => { const editor = document.querySelector('.simple-callout .card-body .tiptap').editor; editor.commands.focus('end'); })()`);
    await waitFor('document.activeElement === document.querySelector(".simple-callout .card-body .tiptap")');
    await send('Input.insertText', { text: ' continued typing' });
    await waitFor('document.querySelector(".simple-callout .card-body .tiptap").textContent.includes("Second item continued typing")');
    await send('Input.insertText', { text: ' stays continuous' });
    await evaluate(`(() => { const select = document.querySelector('.simple-callout select'); select.value = 'caution'; select.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    await evaluate('document.querySelector(".top-save").click()');
    await waitFor('window.writes.length === 2 && document.querySelector(".top-save").disabled && document.querySelector(".top-save").textContent === "Save Draft"');
    const saved = await evaluate('window.writes[1].body');
    assert.ok(saved.includes(protectedSource));
    assert.match(saved, /:::caution\[Revised callout title\]/);
    const parsed = parseDirectiveCallout(splitBody(saved).find(s => s.kind === 'structured').content);
    assert.match(parsed.fields.text, /\*\*bold\*\*/);
    assert.match(parsed.fields.text, /\[map link\]\(\/maps\)/);
    assert.match(parsed.fields.text, /Second item continued typing stays continuous/);
    assert.ok(!saved.includes('CmsCallout'));

    await evaluate('document.querySelector(".editor-navigation .back").click()');
    await waitFor('!!document.querySelector(".project-list button")');
    await evaluate('document.querySelector(".project-list button").click()');
    await waitFor('!!document.querySelector(".simple-callout .card-body .tiptap")');
    assert.equal(await evaluate('document.querySelector(".simple-callout input").value'), 'Revised callout title');
    assert.equal(await evaluate('document.querySelector(".simple-callout select").value'), 'caution');
    assert.equal(await evaluate('document.querySelectorAll(".simple-callout .card-body li").length'), 2);
    assert.ok((await evaluate('document.querySelector(".simple-callout .card-body .tiptap").textContent')).includes('stays continuous'));
  });
});
