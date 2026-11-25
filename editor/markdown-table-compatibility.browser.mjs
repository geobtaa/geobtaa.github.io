import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { chrome, withEditorBrowser } from './browserHarness.mjs';
import { parseContent } from './content.mjs';
import { parseBodySyntax } from '../src/components/editor/contentSyntax.ts';
import { splitBody } from '../src/components/editor/bodySegments.ts';
import { validateDocument } from './validateDocument.mjs';

const content = await readFile('src/content/docs/about/brand-geoportal.md', 'utf8');
const originalBody = parseContent(content).body;
const fixture = `import React from 'react';
import { createRoot } from 'react-dom/client';
import ProjectEditor from '../src/components/editor/ProjectEditor.tsx';
import '../src/components/editor/editor.css';
window.record = { filename: 'brand-geoportal.md', sha: 'loaded', title: 'Geoportal brand', description: '', draft: false, date: '', authors: [], tags: [], cover: null, body: ${JSON.stringify(originalBody)}, content: ${JSON.stringify(content)} };
window.writes = [];
window.confirm = () => true;
window.fetch = async (url, options = {}) => {
  const path = new URL(String(url), location.origin).pathname;
  if (path === '/api/session') return Response.json({ authenticated: true, login: 'tester' });
  if (path === '/api/content/about') return Response.json({ branch: 'custom-cms', entries: [{ name: 'brand-geoportal.md', path: 'src/content/docs/about/brand-geoportal.md', sha: window.record.sha }] });
  if (path === '/api/content/about/brand-geoportal.md') {
    if (options.method === 'PUT') { const input = JSON.parse(options.body); window.writes.push(input); window.record = { ...window.record, ...input, sha: 'saved-' + window.writes.length, commitSha: 'saved-commit' }; }
    return Response.json(window.record);
  }
  throw new Error('Unexpected API call: ' + path);
};
createRoot(document.getElementById('root')).render(React.createElement(ProjectEditor));`;

test('legacy ratio tables edit, preview, save and reopen with alignment and protected swatches preserved', { skip: chrome ? false : 'Chrome/Chromium is required.', timeout: 60_000 }, async () => {
  await withEditorBrowser(fixture, async ({ evaluate, waitFor, send }) => {
    await waitFor('!!document.querySelector(".dashboard-card")');
    await evaluate('[...document.querySelectorAll(".dashboard-card")].find(button => button.textContent.includes("About")).click()');
    await waitFor('!!document.querySelector(".project-list button")');
    await evaluate('document.querySelector(".project-list button").click()');
    const ratioTable = '[...document.querySelectorAll(".body-editor .tiptap table")].find(table => table.textContent.includes("11.68:1"))';
    await waitFor(`!!(${ratioTable})`);
    assert.equal(await evaluate(`(${ratioTable}).querySelectorAll('tr').length`), 7);
    assert.match(await evaluate(`(${ratioTable}).querySelector('tr th:nth-child(3)').getAttribute('style')`), /text-align: right/);

    await evaluate('document.querySelector(".editor-fields > label input").focus(); document.querySelector(".editor-fields > label input").select()');
    await send('Input.insertText', { text: 'Revised brand page' });
    await evaluate('document.querySelector(".top-save").click()');
    await waitFor('window.writes.length === 1 && document.querySelector(".top-save").disabled && document.querySelector(".top-save").textContent === "Save Draft"');
    assert.equal(await evaluate('window.writes[0].body'), originalBody);

    await evaluate(`(() => { const element = (${ratioTable}).closest('.tiptap'); window.tableEditor = element.editor; let position; window.tableEditor.state.doc.descendants((node, pos) => { if (node.type.name === 'paragraph' && node.textContent === '11.68:1') position = pos + node.nodeSize - 1; }); window.tableEditor.commands.setTextSelection(position); window.tableEditor.commands.focus(); })()`);
    await waitFor('document.activeElement === window.tableEditor.view.dom');
    await send('Input.insertText', { text: ' verified' });
    await send('Input.insertText', { text: ' twice' });
    await waitFor(`(${ratioTable}).textContent.includes('11.68:1 verified twice')`);
    await evaluate('[...document.querySelectorAll(".editor-mode-toggle button")].find(button => button.textContent === "Preview").click()');
    await waitFor('document.querySelector("#document-preview").textContent.includes("11.68:1 verified twice")');
    await evaluate('[...document.querySelectorAll(".editor-mode-toggle button")].find(button => button.textContent === "Edit").click()');
    await evaluate('document.querySelector(".top-save").click()');
    await waitFor('window.writes.length === 2 && document.querySelector(".top-save").disabled && document.querySelector(".top-save").textContent === "Save Draft"');
    const saved = await evaluate('window.writes[1].body');
    const originalTable = parseBodySyntax(originalBody, 'md').children.find(n => n.type === 'table' && originalBody.slice(n.position.start.offset, n.position.end.offset).includes('11.68:1'));
    const savedTable = parseBodySyntax(saved, 'md').children.find(n => n.type === 'table' && saved.slice(n.position.start.offset, n.position.end.offset).includes('11.68:1'));
    assert.deepEqual(savedTable.align, originalTable.align);
    assert.equal(savedTable.children.length, originalTable.children.length);
    for (const segment of splitBody(originalBody, { format: 'md' }).filter(s => s.kind === 'protected')) assert.ok(saved.includes(segment.content));
    await validateDocument(`---\ntitle: Brand\n---\n\n${saved}`, { filename: 'brand-geoportal.md', originalBody });

    await evaluate('document.querySelector(".editor-navigation .back").click()');
    await waitFor('!!document.querySelector(".project-list button")');
    await evaluate('document.querySelector(".project-list button").click()');
    await waitFor(`!!(${ratioTable}) && (${ratioTable}).textContent.includes('11.68:1 verified twice')`);
    assert.equal(await evaluate(`(${ratioTable}).querySelectorAll('tr').length`), 7);
    assert.match(await evaluate(`(${ratioTable}).querySelector('tr th:nth-child(3)').getAttribute('style')`), /text-align: right/);
  });
});
