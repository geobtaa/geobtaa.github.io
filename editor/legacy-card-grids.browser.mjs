import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { chrome, withEditorBrowser } from './browserHarness.mjs';
import { parseContent } from './content.mjs';
import { parseLegacyCardGrid } from '../src/components/editor/legacyCardGrid.ts';
import { parseBodySyntax } from '../src/components/editor/contentSyntax.ts';
import { splitBody } from '../src/components/editor/bodySegments.ts';
import { validateDocument } from './validateDocument.mjs';

const content = await readFile('src/content/docs/updates/2025-12-04-november-2025-program-highlights.mdx', 'utf8');
const originalBody = parseContent(content).body;
const originalGrid = splitBody(originalBody).find(s => s.legacyCardGrid).content;
const fixture = (source = content) => {
  const page = parseContent(source);
  return `import React from 'react';
import { createRoot } from 'react-dom/client';
import ProjectEditor from '../src/components/editor/ProjectEditor.tsx';
import '../src/components/editor/editor.css';
window.record = { filename: 'cards.mdx', sha: 'loaded', title: ${JSON.stringify(page.title)}, description: '', draft: true, date: '2025-12-04', authors: [], tags: [], cover: null, body: ${JSON.stringify(page.body)}, content: ${JSON.stringify(source)} };
window.writes = [];
window.confirm = () => true;
window.fetch = async (url, options = {}) => {
  const path = new URL(String(url), location.origin).pathname;
  if (path === '/api/session') return Response.json({ authenticated: true, login: 'tester' });
  if (path === '/api/content/updates') return Response.json({ branch: 'custom-cms', entries: [{ name: 'cards.mdx', path: 'src/content/docs/updates/cards.mdx', sha: window.record.sha }] });
  if (path === '/api/content/updates/cards.mdx') {
    if (options.method === 'PUT') { const input = JSON.parse(options.body); window.writes.push(input); window.record = { ...window.record, ...input, sha: 'saved-' + window.writes.length, commitSha: 'saved-commit' }; }
    return Response.json(window.record);
  }
  throw new Error('Unexpected API call: ' + path);
};
createRoot(document.getElementById('root')).render(React.createElement(ProjectEditor));`;
};

test('lower-risk legacy grids edit rich text and titles, reorder, preview and reopen without changing higher-risk content', { skip: chrome ? false : 'Chrome/Chromium is required.', timeout: 60_000 }, async () => {
  await withEditorBrowser(fixture(), async ({ evaluate, waitFor, send }) => {
    const root = 'document.querySelector(".collection-cardGrid")';
    const card = index => `${root}.querySelectorAll('.collection-entry')[${index}]`;
    const save = async count => {
      await evaluate('document.querySelector(".top-save").click()');
      await waitFor(`window.writes.length === ${count} && document.querySelector('.save-state').textContent === 'All changes saved'`);
      const saved = await evaluate('window.record.body');
      await validateDocument(`---\ntitle: Cards\n---\n\n${saved}`, { originalBody });
      return saved;
    };
    await waitFor('!!document.querySelector(".dashboard-card")');
    await evaluate('[...document.querySelectorAll(".dashboard-card")].find(button => button.textContent.includes("Program Updates")).click()');
    await waitFor('!!document.querySelector(".project-list button")');
    await evaluate('document.querySelector(".project-list button").click()');
    await waitFor(`${root}?.querySelectorAll('.card-body .tiptap').length === 4`);
    assert.equal(await evaluate('document.querySelectorAll(".collection-cardGrid").length'), 3);
    assert.equal(await evaluate(`${root}.querySelector('[data-add-entry]')`), null);
    assert.equal(await evaluate(`${root}.querySelector('button[aria-label="Remove card 1"]')`), null);
    assert.equal(await evaluate(`${root}.closest('.block-row').querySelector('.component-remove, .block-move-buttons')`), null);
    assert.equal(await evaluate(`${card(0)}.querySelector('.tiptap').editor.state.doc.firstChild.attrs.legacyLoose`), true);
    await evaluate('document.querySelector(".editor-fields > label input").focus(); document.querySelector(".editor-fields > label input").select()');
    await send('Input.insertText', { text: 'Updated page title' });
    assert.equal(await save(1), originalBody, 'unrelated edits leave legacy source exact');

    await evaluate(`${card(0)}.querySelector('input').focus(); ${card(0)}.querySelector('input').select()`);
    await send('Input.insertText', { text: 'Tech & <literal> {title}' });
    await evaluate(`${card(0)}.querySelector('.tiptap').editor.commands.focus('end')`);
    await waitFor(`document.activeElement === ${card(0)}.querySelector('.tiptap')`);
    await send('Input.insertText', { text: ' continued' });
    await send('Input.insertText', { text: ' typing' });
    await evaluate(`${card(0)}.querySelector('button[aria-label="Bold"]').click()`);
    await send('Input.insertText', { text: ' bold addition' });
    await waitFor(`${card(0)}.querySelector('.tiptap strong')?.textContent === ' bold addition'`);
    await evaluate(`${card(0)}.querySelector('button[data-entry-move="1"]').click()`);
    await waitFor(`${card(1)}.querySelector('input').value === 'Tech & <literal> {title}'`);
    const saved = await save(2);
    const grid = splitBody(saved).find(s => s.legacyCardGrid).content;
    const parsed = parseLegacyCardGrid(grid);
    assert.deepEqual(parsed.protectedParts, parseLegacyCardGrid(originalGrid).protectedParts);
    assert.equal(parsed.cards[1].title, 'Tech & <literal> {title}');
    assert.match(parsed.cards[1].body, /continued typing/);
    assert.match(parsed.cards[1].body, /\*\*.*bold addition.*\*\*/);
    assert.equal(parseBodySyntax(parsed.cards[1].body).children[0].spread, true);
    assert.ok(!saved.includes('CmsCardGrid'));
    for (const segment of splitBody(originalBody).filter(s => s.kind === 'protected' && !s.legacyCardGrid)) assert.ok(saved.includes(segment.content));

    await evaluate('[...document.querySelectorAll(".editor-mode-toggle button")].find(button => button.textContent === "Preview").click()');
    await waitFor('document.querySelector("#document-preview .collection-cardGrid")?.querySelectorAll(".collection-entry").length === 4');
    assert.equal(await evaluate('document.querySelectorAll("#document-preview .collection-cardGrid input").length'), 0);
    assert.ok((await evaluate('document.querySelector("#document-preview").textContent')).includes('Tech & <literal> {title}'));
    await evaluate('document.querySelector(".editor-navigation .back").click()');
    await waitFor('!!document.querySelector(".project-list button")');
    await evaluate('document.querySelector(".project-list button").click()');
    await waitFor(`${root}?.querySelectorAll('.card-body .tiptap').length === 4`);
    assert.equal(await evaluate(`${card(1)}.querySelector('input').value`), 'Tech & <literal> {title}');
    assert.equal(await evaluate(`${card(1)}.querySelector('.tiptap').editor.state.doc.firstChild.attrs.legacyLoose`), true);
    assert.match(await evaluate(`${card(1)}.querySelector('.tiptap strong').textContent`), /bold addition/);
  });
});

test('September 2025 indented lists and paragraphs preview and edit normally while untouched source stays exact', { skip: chrome ? false : 'Chrome/Chromium is required.', timeout: 60_000 }, async () => {
  const source = await readFile('src/content/docs/updates/2025-09.mdx', 'utf8');
  const original = parseContent(source).body;
  const initialGrid = splitBody(original).find(s => s.legacyCardGrid).content;
  const initial = parseLegacyCardGrid(initialGrid);
  await withEditorBrowser(fixture(source), async ({ evaluate, waitFor, send }) => {
    const root = 'document.querySelector(".collection-cardGrid")';
    const card = index => `${root}.querySelectorAll('.collection-entry')[${index}]`;
    const save = async count => {
      await evaluate('document.querySelector(".top-save").click()');
      await waitFor(`window.writes.length === ${count} && document.querySelector('.save-state').textContent === 'All changes saved'`);
      const saved = await evaluate('window.record.body');
      await validateDocument(`---\ntitle: Cards\n---\n\n${saved}`, { originalBody: original });
      return saved;
    };
    await waitFor('!!document.querySelector(".dashboard-card")');
    await evaluate('[...document.querySelectorAll(".dashboard-card")].find(button => button.textContent.includes("Program Updates")).click()');
    await waitFor('!!document.querySelector(".project-list button")');
    await evaluate('document.querySelector(".project-list button").click()');
    await waitFor(`${root}?.querySelectorAll('.card-body .tiptap').length === 4`);
    assert.equal(await evaluate(`${root}.querySelectorAll('.card-body pre').length`), 0);
    assert.equal(await evaluate(`${root}.querySelectorAll('.card-body ul').length`), 2);
    assert.equal(await evaluate(`${card(2)}.querySelector('.tiptap').editor.state.doc.firstChild.type.name`), 'paragraph');
    await evaluate('document.querySelector(".editor-fields > label input").focus(); document.querySelector(".editor-fields > label input").select()');
    await send('Input.insertText', { text: 'Revised September page title' });
    assert.equal(await save(1), original);

    await evaluate(`${card(0)}.querySelector('input').focus(); ${card(0)}.querySelector('input').select()`);
    await send('Input.insertText', { text: 'TECHnology revised' });
    const titleOnly = await save(2);
    const titleGrid = splitBody(titleOnly).find(s => s.legacyCardGrid).content;
    const titleParsed = parseLegacyCardGrid(titleGrid);
    initial.cards.forEach((old, index) => {
      const next = titleParsed.cards[index];
      assert.equal(titleGrid.slice(next.bodyStart, next.bodyEnd), initialGrid.slice(old.bodyStart, old.bodyEnd));
    });
    for (const [index, text] of [[0, ' verified list'], [2, ' verified paragraph']]) {
      await evaluate(`${card(index)}.querySelector('.tiptap').editor.commands.focus('end')`);
      await waitFor(`document.activeElement === ${card(index)}.querySelector('.tiptap')`);
      await send('Input.insertText', { text });
    }
    const saved = await save(3);
    const editedGrid = splitBody(saved).find(s => s.legacyCardGrid).content;
    const edited = parseLegacyCardGrid(editedGrid);
    assert.deepEqual(edited.protectedParts, initial.protectedParts);
    assert.match(edited.cards[0].body, /verified list/);
    assert.match(edited.cards[2].body, /verified paragraph/);
    assert.equal(parseBodySyntax(edited.cards[0].body, 'md').children[0].type, 'list');
    assert.equal(parseBodySyntax(edited.cards[2].body, 'md').children[0].type, 'paragraph');
    for (const index of [1, 3]) {
      assert.equal(editedGrid.slice(edited.cards[index].bodyStart, edited.cards[index].bodyEnd), initialGrid.slice(initial.cards[index].bodyStart, initial.cards[index].bodyEnd));
    }
    for (const segment of splitBody(original).filter(s => s.kind === 'protected' && !s.legacyCardGrid)) assert.ok(saved.includes(segment.content));
    await evaluate('[...document.querySelectorAll(".editor-mode-toggle button")].find(button => button.textContent === "Preview").click()');
    await waitFor('document.querySelector("#document-preview .collection-cardGrid")?.textContent.includes("verified paragraph")');
    assert.equal(await evaluate('document.querySelectorAll("#document-preview .collection-cardGrid .card-body pre").length'), 0);
    assert.equal(await evaluate('document.querySelector("#document-preview .collection-cardGrid").querySelectorAll(".card-body ul").length'), 2);
    await evaluate('document.querySelector(".editor-navigation .back").click()');
    await waitFor('!!document.querySelector(".project-list button")');
    await evaluate('document.querySelector(".project-list button").click()');
    await waitFor(`${root}?.querySelectorAll('.card-body .tiptap').length === 4`);
    assert.match(await evaluate(`${card(0)}.querySelector('.tiptap').textContent`), /verified list/);
    assert.match(await evaluate(`${card(2)}.querySelector('.tiptap').textContent`), /verified paragraph/);
    assert.equal(await evaluate(`${root}.querySelectorAll('.card-body pre').length`), 0);
  });
});


test('untitled grid and standalone cards edit their Markdown heading and body, preview and reopen', { skip: chrome ? false : 'Chrome/Chromium is required.', timeout: 60_000 }, async () => {
  for (const [file, count, standalone] of [['2024-04.mdx', 5, false], ['2025-12-04-november-2025-program-highlights.mdx', 1, true]]) {
    const source = await readFile('src/content/docs/updates/' + file, 'utf8');
    const original = parseContent(source).body;
    const segment = splitBody(original).find(s => s.legacyCardGrid && parseLegacyCardGrid(s.content).cards[0].heading);
    const initial = parseLegacyCardGrid(segment.content);
    await withEditorBrowser(fixture(source), async ({ evaluate, waitFor, send }) => {
      const heading = 'document.querySelector(\'input[aria-label="Card 1 heading"]\')';
      const block = `${heading}.closest('.collection-cardGrid')`;
      const save = async count => {
        await evaluate('document.querySelector(".top-save").click()');
        await waitFor(`window.writes.length === ${count} && document.querySelector('.save-state').textContent === 'All changes saved'`);
        const body = await evaluate('window.record.body');
        await validateDocument(`---\ntitle: Cards\n---\n\n${body}`, { originalBody: original });
        return body;
      };
      await waitFor('!!document.querySelector(".dashboard-card")');
      await evaluate('[...document.querySelectorAll(".dashboard-card")].find(button => button.textContent.includes("Program Updates")).click()');
      await waitFor('!!document.querySelector(".project-list button")');
      await evaluate('document.querySelector(".project-list button").click()');
      await waitFor(`!!${heading}`);
      assert.equal(await evaluate(`${block}.querySelectorAll('.collection-entry').length`), count);
      assert.equal(await evaluate(`${block}.querySelector('.collection-heading').textContent`), standalone ? 'Card' : 'Card Grid');
      assert.equal(await evaluate(`${heading}.value`), initial.cards[0].title);
      await evaluate('document.querySelector(".editor-fields > label input").focus(); document.querySelector(".editor-fields > label input").select()');
      await send('Input.insertText', { text: 'Metadata edit' });
      assert.equal(await save(1), original);
      await evaluate(`${heading}.focus(); ${heading}.select()`);
      await send('Input.insertText', { text: 'Changed & <literal> {heading}' });
      const renamed = await save(2);
      const renamedSegment = splitBody(renamed).find(s => s.legacyCardGrid && parseLegacyCardGrid(s.content).cards[0].title === 'Changed & <literal> {heading}');
      const parsed = parseLegacyCardGrid(renamedSegment.content);
      assert.deepEqual(parsed.protectedParts, initial.protectedParts);
      assert.equal(renamedSegment.content.slice(parsed.cards[0].bodyStart), segment.content.slice(initial.cards[0].bodyStart));
      assert.ok(!renamedSegment.content.includes('title='));
      await evaluate(`${block}.querySelector('.tiptap').editor.commands.focus('end')`);
      await waitFor(`document.activeElement === ${block}.querySelector('.tiptap')`);
      await send('Input.insertText', { text: ' Added body text.' });
      const edited = await save(3);
      const editedGrid = splitBody(edited).find(s => s.legacyCardGrid && parseLegacyCardGrid(s.content).cards[0].title === 'Changed & <literal> {heading}');
      assert.match(parseLegacyCardGrid(editedGrid.content).cards[0].body, /Added body text/);
      for (const s of splitBody(original).filter(s => s.kind === 'protected' && s.content !== segment.content)) assert.ok(edited.includes(s.content));
      await evaluate('[...document.querySelectorAll(".editor-mode-toggle button")].find(button => button.textContent === "Preview").click()');
      await waitFor('!!document.querySelector("#document-preview .collection-cardGrid h4")');
      assert.equal(await evaluate('document.querySelector("#document-preview .collection-cardGrid h4").textContent'), 'Changed & <literal> {heading}');
      assert.equal(await evaluate('document.querySelector("#document-preview .collection-cardGrid h4").children.length'), 0);
      await evaluate('document.querySelector(".editor-navigation .back").click()');
      await waitFor('!!document.querySelector(".project-list button")');
      await evaluate('document.querySelector(".project-list button").click()');
      await waitFor(`!!${heading}`);
      assert.equal(await evaluate(`${heading}.value`), 'Changed & <literal> {heading}');
      assert.match(await evaluate(`${block}.querySelector('.tiptap').textContent`), /Added body text/);
    });
  }
});


test('September workgroup sections preserve headings and lists through body edits, heading edits and reopen', { skip: chrome ? false : 'Chrome/Chromium is required.', timeout: 60_000 }, async () => {
  const source = await readFile('src/content/docs/updates/2025-09.mdx', 'utf8');
  const original = parseContent(source).body;
  const segment = splitBody(original).find(s => s.legacyCardGrid && parseLegacyCardGrid(s.content).standalone);
  const initial = parseLegacyCardGrid(segment.content);
  await withEditorBrowser(fixture(source), async ({ evaluate, waitFor, send }) => {
    const block = 'document.querySelector(\'input[aria-label="Card 1 heading"]\').closest(".collection-cardGrid")';
    const editor = `${block}.querySelector('.tiptap').editor`;
    const save = async count => {
      await evaluate('document.querySelector(".top-save").click()');
      await waitFor(`window.writes.length === ${count} && document.querySelector('.save-state').textContent === 'All changes saved'`);
      const body = await evaluate('window.record.body');
      await validateDocument(`---\ntitle: Cards\n---\n\n${body}`, { originalBody: original });
      return body;
    };
    const headings = raw => parseBodySyntax(parseLegacyCardGrid(raw).cards[0].body).children.filter(n => n.type === 'heading').map(n => ({ depth: n.depth, text: n.children.map(c => c.value || '').join('') }));
    const standalone = body => splitBody(body).find(s => s.legacyCardGrid && parseLegacyCardGrid(s.content).standalone).content;
    await waitFor('!!document.querySelector(".dashboard-card")');
    await evaluate('[...document.querySelectorAll(".dashboard-card")].find(button => button.textContent.includes("Program Updates")).click()');
    await waitFor('!!document.querySelector(".project-list button")');
    await evaluate('document.querySelector(".project-list button").click()');
    await waitFor(`!!document.querySelector('input[aria-label="Card 1 heading"]')`);
    assert.equal(await evaluate(`${block}.querySelectorAll('.tiptap h4').length`), 2);
    assert.equal(await evaluate(`${block}.querySelectorAll('.tiptap ul').length`), 3);
    assert.equal(await evaluate(`${editor}.can().toggleHeading({ level: 2 })`), false);
    await evaluate('document.querySelector(".editor-fields > label input").focus(); document.querySelector(".editor-fields > label input").select()');
    await send('Input.insertText', { text: 'Updated metadata' });
    assert.equal(await save(1), original);
    await evaluate(`${editor}.commands.focus('end')`);
    await waitFor(`document.activeElement === ${block}.querySelector('.tiptap')`);
    await send('Input.insertText', { text: ' Body edit with {literal} & <tag>.' });
    const bodyEdited = standalone(await save(2));
    assert.deepEqual(headings(bodyEdited), headings(segment.content));
    assert.deepEqual(parseLegacyCardGrid(bodyEdited).protectedParts, initial.protectedParts);
    await evaluate(`{ const e = ${editor}; let position; e.state.doc.descendants((node, pos) => { if (node.type.name === 'heading' && node.textContent.includes('Service Model')) position = pos + 1; }); e.commands.setTextSelection(position); e.commands.focus(); }`);
    await waitFor(`document.activeElement === ${block}.querySelector('.tiptap')`);
    await send('Input.insertText', { text: 'Revised {literal} ' });
    assert.equal(await evaluate(`${block}.querySelector('button[aria-label="Section heading"]').getAttribute('aria-pressed')`), 'true');
    const saved = await save(3), edited = standalone(saved);
    assert.deepEqual(headings(edited).map(h => h.depth), [4, 4]);
    assert.match(headings(edited)[0].text, /^Revised \{literal\} Service Model/);
    assert.equal(headings(edited)[1].text, headings(segment.content)[1].text);
    assert.ok(!edited.includes('title='));
    for (const s of splitBody(original).filter(s => s.kind === 'protected' && s.content !== segment.content)) assert.ok(saved.includes(s.content));
    await evaluate('[...document.querySelectorAll(".editor-mode-toggle button")].find(button => button.textContent === "Preview").click()');
    await waitFor('document.querySelectorAll("#document-preview .collection-cardGrid h4").length === 3');
    assert.ok((await evaluate('document.querySelector("#document-preview").textContent')).includes('Revised {literal} Service Model'));
    await evaluate('document.querySelector(".editor-navigation .back").click()');
    await waitFor('!!document.querySelector(".project-list button")');
    await evaluate('document.querySelector(".project-list button").click()');
    await waitFor(`!!document.querySelector('input[aria-label="Card 1 heading"]')`);
    assert.equal(await evaluate(`${block}.querySelectorAll('.tiptap h4').length`), 2);
    assert.match(await evaluate(`${block}.querySelector('.tiptap h4').textContent`), /^Revised \{literal\}/);
    assert.match(await evaluate(`${block}.querySelector('.tiptap').textContent`), /Body edit with \{literal\} & <tag>/);
  });
});
