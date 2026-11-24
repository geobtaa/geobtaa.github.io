import assert from 'node:assert/strict';
import { glob, readFile } from 'node:fs/promises';
import test from 'node:test';
import { Editor } from '@tiptap/core';
import { parseHTML } from 'linkedom';
import { splitBody } from '../src/components/editor/bodySegments.ts';
import { richTextEditorOptions } from '../src/components/editor/richTextEditor.ts';
import { previewComponentLink } from '../src/components/editor/previewLinks.ts';
import { IMAGE_SIZE_PRESETS } from '../src/components/editor/formattedImage.ts';
import { parseDirectiveCallout } from '../src/components/editor/directiveCallout.ts';
import { parseBodySyntax } from '../src/components/editor/contentSyntax.ts';
import { validateDocument } from './validateDocument.mjs';
import { parseLegacyChipList } from '../src/components/editor/legacyChipList.ts';
import { parseLegacyCardGrid } from '../src/components/editor/legacyCardGrid.ts';
import { LegacyCardLists } from '../src/components/editor/legacyCardLists.ts';
import StarterKit from '@tiptap/starter-kit';
import { MdxMarkdown } from '../src/components/editor/MdxMarkdown.ts';
import { SIMPLE_KINDS, SIMPLE_COMPONENTS, createSimpleComponentMdx, emptySimpleFields, ensureSimpleComponentImport, parseSimpleComponentMdx } from '../src/components/editor/simpleComponents.ts';
import { createLinkButtonMdx, ensureLinkButtonImport, parseLinkButtonMdx, updateLinkButtonMdx } from '../src/components/editor/linkButtonMdx.ts';
import { createLinkCardMdx, ensureLinkCardImport, LINK_CARD_IMPORT, parseLinkCardMdx, updateLinkCardMdx } from '../src/components/editor/linkCardMdx.ts';
import { COLLECTION_BLOCKS, createCollectionMdx, parseCollectionMdx } from '../src/components/editor/collectionMdx.ts';
import { compileSync, createProcessor } from '@mdx-js/mdx';
import remarkGfm from 'remark-gfm';
import { parsePage, serializePage } from './page.mjs';

test('real documents retain tasks, footnotes, inline HTML and protected components through TipTap edits and two saves', async () => {
  for (const [filename, marker, preserved] of [
    ['src/content/docs/library/geodata-collection-roadmap.mdx', 'During the Groundwork Phase', /- \[[x ]\][^\n]*/g],
    ['src/content/docs/library/btaa-sdi-2019.mdx', 'The next phase of the BTAA GDP', /\[\^[^\]]+\]/g],
    ['src/content/docs/posts/2026-03-17-urban-base-layers-in-practice-philadelphia.mdx', 'Philadelphia represents', /<a href="[^"]+">[^<]+<\/a>/g],
  ]) {
    let source = await readFile(filename, 'utf8');
    const original = parsePage(source).body;
    const expected = [...original.matchAll(preserved)].map(match => match[0]);
    const protectedSource = splitBody(original).filter(segment => segment.kind === 'protected').map(segment => segment.content);
    assert.ok(expected.length, filename);
    for (let pass = 1; pass <= 2; pass++) {
      const loaded = parsePage(source);
      const segments = splitBody(loaded.body);
      const target = segments.find(segment => segment.kind === 'markdown' && segment.content.includes(marker));
      assert.ok(target, `${filename}: the ordinary paragraph remains editable`);
      const { editor } = openEditor(target.content);
      let position;
      editor.state.doc.descendants((node, pos) => { if (node.type.name === 'paragraph' && node.textContent.includes(marker)) position = pos + node.nodeSize - 1; });
      assert.notEqual(position, undefined);
      editor.commands.insertContentAt(position, { type: 'text', text: ` Review edit ${pass}.` });
      const markdown = editor.getMarkdown();
      const leading = target.content.match(/^(?:\r?\n)+/)?.[0] || '';
      const trailing = target.content.match(/(?:\r?\n)+$/)?.[0] || '';
      target.content = `${markdown.startsWith('\n') ? '' : leading}${markdown}${markdown.endsWith('\n') ? '' : trailing}`;
      editor.destroy();
      const body = segments.map(segment => segment.content).join('');
      source = serializePage(source, { ...loaded, body });
      for (const raw of [...expected, ...protectedSource]) assert.ok(parsePage(source).body.includes(raw), `${filename}: lost ${raw.slice(0, 100)}`);
      assert.ok(body.includes(`Review edit ${pass}.`));
      compileSync(body, { remarkPlugins: [remarkGfm] });
    }
  }
});

test('literal braces and ESM-like prose stay literal after typing, saving and reopening', () => {
  for (const initial of ['Use \\{name\\}.', '', 'An ordinary paragraph.']) {
    const opened = openEditor(initial);
    opened.editor.commands.insertContentAt(opened.editor.state.doc.content.size - 1, { type: 'text', text: ' Set {a: 1} and {process.env.SECRET}.' });
    const expected = opened.editor.state.doc.textContent;
    let saved = opened.editor.getMarkdown();
    opened.editor.destroy();
    for (let pass = 0; pass < 2; pass++) {
      compileSync(saved, { remarkPlugins: [remarkGfm] });
      const check = node => {
        assert.ok(!['mdxjsEsm', 'mdxTextExpression', 'mdxFlowExpression'].includes(node.type), 'literal input must not become executable syntax');
        node.children?.forEach(check);
      };
      check(createProcessor().parse(saved));
      const reopened = openEditor(saved);
      assert.equal(reopened.editor.state.doc.textContent, expected);
      saved = reopened.editor.getMarkdown(); reopened.editor.destroy();
    }
  }
  for (const text of ['import Thing from "some-module";', 'export const secret = process.env.SECRET;']) {
    const { editor } = openEditor('');
    editor.commands.insertContent({ type: 'text', text });
    const saved = editor.getMarkdown(); editor.destroy();
    compileSync(saved);
    assert.ok(createProcessor().parse(saved).children.every(node => node.type !== 'mdxjsEsm'), 'prose must not become an ESM declaration');
    const reopened = openEditor(saved);
    assert.equal(reopened.editor.state.doc.textContent, text); reopened.editor.destroy();
  }
});

test('table hard breaks serialize as valid MDX without rewriting fenced code', () => {
  const { editor } = openEditor('');
  editor.commands.setContent({ type: 'doc', content: [{ type: 'table', content: [
    { type: 'tableRow', content: [{ type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Header' }] }] }] },
    { type: 'tableRow', content: [{ type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'First' }, { type: 'hardBreak' }, { type: 'text', text: 'Second {literal}' }] }] }] },
  ] }] });
  const saved = editor.getMarkdown(); editor.destroy();
  assert.match(saved, /First<br \/>Second/);
  compileSync(saved, { remarkPlugins: [remarkGfm] });
  const code = openEditor('```js\nconst value = {a: 1}; // <br>\n```');
  assert.equal(code.editor.getMarkdown().trimEnd(), '```js\nconst value = {a: 1}; // <br>\n```'); code.editor.destroy();
});

test('code examples containing fence delimiters cannot expose their contents as MDX', () => {
  const text = '```mdx\n{process.env.SECRET}\n```';
  const { editor } = openEditor('');
  editor.commands.setContent({ type: 'doc', content: [{ type: 'codeBlock', attrs: { language: 'text' }, content: [{ type: 'text', text }] }] });
  const saved = editor.getMarkdown(); editor.destroy();
  compileSync(saved);
  const reopened = openEditor(saved);
  assert.equal(reopened.editor.state.doc.firstChild.type.name, 'codeBlock');
  assert.equal(reopened.editor.state.doc.firstChild.textContent, text);
  reopened.editor.destroy();
});

test('links with quoted titles and spaced destinations retain their attributes on unrelated edits', () => {
  const original = 'Before [Maps](<https://example.com/a b> \'A "quoted" title\').';
  const { editor } = openEditor(original);
  editor.commands.insertContentAt(1, { type: 'text', text: 'An ordinary edit. ' });
  const saved = editor.getMarkdown(); editor.destroy();
  compileSync(saved);
  const reopened = openEditor(saved);
  let attrs;
  reopened.editor.state.doc.descendants(node => { const link = node.marks.find(mark => mark.type.name === 'link'); if (link) attrs = link.attrs; });
  assert.equal(attrs?.href, 'https://example.com/a b');
  assert.equal(attrs?.title, 'A "quoted" title');
  reopened.editor.destroy();
});

test('segmentation protects whole unsupported blocks, cross-block references, expressions and multiline exports', () => {
  const blocks = ['- [x] Done\n- [ ] Pending', 'A footnote[^n].', '[^n]: Keep the citation.', 'Inline <span class="important">keep styling</span>.', 'Value {frontmatter.title}.', '![Map][map]', '[map]: @images/map.png', 'export const data = {\n  label: "a } in a string",\n};'];
  const body = `Ordinary paragraph.\n\n${blocks.join('\n\n')}\n\nAfter.`;
  const segments = splitBody(body);
  assert.equal(segments.map(segment => segment.content).join(''), body);
  for (const block of blocks) assert.ok(segments.some(segment => segment.kind === 'protected' && segment.content.includes(block)), block);
  assert.ok(segments.some(segment => segment.kind === 'markdown' && segment.content.includes('Ordinary paragraph.')));
  const exact = '  <Unknown value="a > b">\r\n  Keep exact.  \r\n  </Unknown>  \r\n';
  const spaced = `Before\r\n\r\n${exact}\r\nAfter`;
  assert.ok(splitBody(spaced).some(segment => segment.kind === 'protected' && segment.content === exact), 'protect indentation, trailing spaces and CRLF with the component');
  assert.equal(splitBody(spaced).map(segment => segment.content).join(''), spaced);
});

const { window } = parseHTML('<!doctype html><html><body></body></html>');
Object.assign(globalThis, {
  window,
  HTMLElement: window.HTMLElement,
  document: window.document,
  DOMParser: window.DOMParser,
  MutationObserver: window.MutationObserver,
  getSelection: window.getSelection?.bind(window),
  innerHeight: 800,
  innerWidth: 1200,
});
window.HTMLElement.prototype.getBoundingClientRect = () => ({ top: 0, right: 0, bottom: 0, left: 0, width: 0, height: 0 });
window.HTMLElement.prototype.getClientRects = () => [];
// Linkedom exposes only a getter for selects; supply the browser's value setter.
Object.defineProperty(window.HTMLSelectElement.prototype, 'value', {
  get: Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').get,
  set(value) {
    const options = [...this.querySelectorAll('option')];
    for (const option of options) option.removeAttribute('selected');
    const selected = options.find(option => option.value === value);
    if (selected) selected.selected = true;
  },
});
const selection = { anchorNode: null, anchorOffset: 0, focusNode: null, focusOffset: 0, rangeCount: 0, isCollapsed: true, removeAllRanges() {}, addRange() {} };
window.document.getSelection = () => selection;
window.getSelection = () => selection;

function openEditor(markdown = '') {
  let externalMarkdown = markdown;
  const editor = new Editor({ ...richTextEditorOptions(markdown, (next) => { externalMarkdown = next; }), injectCSS: false });
  if (editor.state.doc.lastChild?.isTextblock) editor.commands.setTextSelection(editor.state.doc.content.size - 1);
  return { editor, externalMarkdown: () => externalMarkdown };
}

test('legacy card-body lists retain loose paragraph structure while editing', () => {
  for (const body of ['- First\n\n- Second', '3. First\n\n4. Second']) {
    const editor = new Editor({ extensions: [StarterKit.configure({ bulletList: false, orderedList: false, heading: false }), ...LegacyCardLists, MdxMarkdown], content: body, contentType: 'markdown', injectCSS: false });
    assert.equal(editor.state.doc.firstChild.attrs.legacyLoose, true);
    let position;
    editor.state.doc.descendants((node, pos) => { if (node.type.name === 'paragraph' && node.textContent === 'First') position = pos + node.nodeSize - 1; });
    editor.commands.insertContentAt(position, { type: 'text', text: ' edited' });
    const saved = editor.getMarkdown();
    assert.equal(parseBodySyntax(saved).children[0].spread, true);
    assert.match(saved, /First edited\n\n(?:- |4\. )Second/);
    editor.destroy();
  }
});

test('legacy CardGrid titles and rich bodies load as a collection without rewriting wrappers', () => {
  const raw = '<CardGrid>\n<Card title="First">\n- First\n\n- Second\n</Card>\n<Card title="Second">\nA [link](/maps).\n</Card>\n</CardGrid>';
  const opened = openEditor(raw);
  assert.equal(opened.editor.state.doc.firstChild.type.name, 'cardGridBlock');
  assert.equal(opened.editor.getMarkdown(), raw);
  const entries = opened.editor.state.doc.firstChild.attrs.entries;
  opened.editor.commands.setNodeSelection(0);
  opened.editor.commands.updateAttributes('cardGridBlock', { entries: [{ ...entries[0], title: 'New <literal> title' }, entries[1]] });
  const saved = opened.editor.getMarkdown();
  assert.equal(parseLegacyCardGrid(saved).cards[0].title, 'New <literal> title');
  assert.equal(parseLegacyCardGrid(saved).cards[0].body, entries[0].body);
  assert.deepEqual(parseLegacyCardGrid(saved).protectedParts, parseLegacyCardGrid(raw).protectedParts);
  const reopened = openEditor(saved);
  assert.equal(reopened.editor.getMarkdown(), saved);
  opened.editor.destroy(); reopened.editor.destroy();
});

test('preview links enforce a safe new tab even with stored same-tab targets, without rewriting content', () => {
  const editor = new Editor({ ...richTextEditorOptions('[Text](/guides/)', () => {}, '', undefined, true), injectCSS: false });
  try {
    for (const href of ['/guides/', '../help/', '#details', '?q=maps', 'https://example.com/maps']) {
      editor.commands.setContent({ type: 'doc', content: [{ type: 'paragraph', content: [
        { type: 'text', text: 'Text', marks: [{ type: 'link', attrs: { href, target: '_self', rel: 'opener' } }] },
      ] }] });
      const anchor = editor.view.dom.querySelector('a');
      assert.equal(anchor.getAttribute('href'), href);
      assert.equal(anchor.getAttribute('target'), '_blank');
      assert.equal(anchor.getAttribute('rel'), 'noopener noreferrer');
      assert.equal(editor.getMarkdown(), `[Text](${href})`);
      assert.deepEqual(previewComponentLink(href), { href, target: '_blank', rel: 'noopener noreferrer' });
    }
    for (const href of ['javascript:alert(1)', 'data:text/html,unsafe', 'java\tscript:alert(1)']) {
      assert.equal(previewComponentLink(href).href, undefined);
    }
    assert.equal(previewComponentLink('').href, undefined);
  } finally { editor.destroy(); }
});

function type(editor, value) {
  for (const character of value) editor.commands.insertContent(character);
}

function assertSingleParagraph(editor, text) {
  const document = editor.getJSON();
  assert.equal(document.content?.length, 1);
  assert.equal(document.content?.[0].type, 'paragraph');
  assert.equal(document.content?.[0].content?.map((node) => node.text || '').join(''), text);
}

test('collection blocks reopen as one editable atom and serialize row edits without changing neighboring content', () => {
  for (const [kind, data] of [['chipList', ['One, two', 'Three']], ['cardGrid', [{ title: 'Committee', body: '**Formatted**\n\n- Update' }, { title: 'Second', body: 'Another paragraph.' }]], ['metrics', [{ label: 'Visitors', value: '3,651' }, { label: 'Downloads', value: '10.4%' }]]]) {
    const raw = createCollectionMdx(kind, data);
    const { editor } = openEditor(raw);
    assert.equal(editor.getJSON().content.length, 1);
    assert.equal(editor.state.doc.firstChild.type.name, COLLECTION_BLOCKS[kind].node);
    assert.equal(editor.getMarkdown(), raw);
    editor.commands.setNodeSelection(0);
    const entries = editor.state.doc.firstChild.attrs.entries;
    const next = [...entries].reverse();
    assert.equal(editor.commands.updateAttributes(COLLECTION_BLOCKS[kind].node, { entries: next }), true);
    assert.deepEqual(parseCollectionMdx(editor.getMarkdown()).data, [...data].reverse());
    const reopened = openEditor(editor.getMarkdown());
    assert.equal(reopened.editor.state.doc.firstChild.type.name, COLLECTION_BLOCKS[kind].node);
    assert.deepEqual(parseCollectionMdx(reopened.editor.getMarkdown()).data, [...data].reverse());
    editor.destroy(); reopened.editor.destroy();
  }
});

test('legacy chips load as editable collection atoms and retain their source, attributes and layout through edits', () => {
  for (const raw of ['<ChipList class="not-content">\n\n- First\n- Second\n\n</ChipList>', '<div class="grid cards" markdown>\n## Heading\n<ChipList>\n- First\n- Second\n</ChipList>\n</div>']) {
    const opened = openEditor(raw);
    assert.equal(opened.editor.state.doc.firstChild.type.name, 'chipListBlock');
    assert.equal(opened.editor.getMarkdown(), raw);
    const entries = opened.editor.state.doc.firstChild.attrs.entries;
    opened.editor.commands.setNodeSelection(0);
    opened.editor.commands.updateAttributes('chipListBlock', { entries: [{ ...entries[1], value: 'Reordered <literal> {label}' }, entries[0]] });
    const saved = opened.editor.getMarkdown();
    assert.deepEqual(parseLegacyChipList(saved).items, ['Reordered <literal> {label}', 'First']);
    assert.deepEqual(parseLegacyChipList(saved).protectedParts, parseLegacyChipList(raw).protectedParts);
    const reopened = openEditor(saved);
    assert.equal(reopened.editor.getMarkdown(), saved);
    opened.editor.destroy(); reopened.editor.destroy();
  }
});

test('consecutive characters stay in one paragraph immediately after opening', () => {
  const { editor, externalMarkdown } = openEditor('Existing ');
  type(editor, 'Some');
  assertSingleParagraph(editor, 'Existing Some');
  assert.equal(externalMarkdown(), 'Existing Some');
  editor.destroy();
});

test('typing remains continuous after bold is turned on and off', () => {
  const { editor } = openEditor();
  editor.commands.toggleBold();
  type(editor, 'Some');
  editor.commands.toggleBold();
  type(editor, ' text');
  assertSingleParagraph(editor, 'Some text');
  assert.equal(editor.getMarkdown(), '**Some** text');
  editor.destroy();
});

test('StarterKit provides every configured node, mark, and behavior', () => {
  const { editor } = openEditor();
  const extensions = new Set(editor.extensionManager.extensions.map((extension) => extension.name));
  for (const name of [
    'blockquote', 'bulletList', 'codeBlock', 'doc', 'hardBreak', 'heading', 'horizontalRule',
    'listItem', 'orderedList', 'paragraph', 'text', 'bold', 'code', 'italic', 'link', 'strike',
    'underline', 'dropCursor', 'gapCursor', 'undoRedo', 'listKeymap', 'trailingNode',
  ]) assert.ok(extensions.has(name), `${name} extension is enabled`);
  editor.destroy();
});

test('undo and redo update the live Markdown without reinitializing the editor', () => {
  const { editor, externalMarkdown } = openEditor('Before ');
  const instance = editor;
  type(editor, 'after');
  assert.equal(externalMarkdown(), 'Before after');
  assert.equal(editor.commands.undo(), true);
  assert.equal(externalMarkdown(), 'Before ');
  assert.equal(editor.commands.redo(), true);
  assert.equal(externalMarkdown(), 'Before after');
  assert.equal(editor, instance);
  editor.destroy();
});

test('StarterKit formatting and block commands serialize to Markdown', () => {
  for (const { command, mark, pattern } of [
    { command: 'toggleUnderline', mark: 'underline', pattern: /\+\+Formatted\+\+/ },
    { command: 'toggleStrike', mark: 'strike', pattern: /~~Formatted~~/ },
    { command: 'toggleCode', mark: 'code', pattern: /`Formatted`/ },
  ]) {
    const inline = openEditor('Formatted');
    inline.editor.commands.selectAll();
    assert.equal(inline.editor.commands[command](), true);
    assert.equal(inline.editor.isActive(mark), true);
    assert.match(inline.editor.getMarkdown(), pattern);
    inline.editor.destroy();
  }

  const blocks = openEditor('Quoted');
  assert.equal(blocks.editor.commands.toggleBlockquote(), true);
  assert.match(blocks.editor.getMarkdown(), /^> Quoted/);
  assert.equal(blocks.editor.commands.setHorizontalRule(), true);
  assert.match(blocks.editor.getMarkdown(), /---/);
  blocks.editor.destroy();

  const codeBlock = openEditor('const value = 1;');
  assert.equal(codeBlock.editor.commands.toggleCodeBlock(), true);
  assert.match(codeBlock.editor.getMarkdown(), /^```/);
  codeBlock.editor.destroy();
});

test('StarterKit headings, lists, links, and hard breaks serialize to Markdown', () => {
  for (const level of [1, 2, 3, 4, 5, 6]) {
    const heading = openEditor('Heading');
    assert.equal(heading.editor.commands.setHeading({ level }), true);
    assert.match(heading.editor.getMarkdown(), new RegExp(`^#{${level}} Heading`));
    heading.editor.destroy();
  }

  const bullet = openEditor('Item');
  assert.equal(bullet.editor.commands.toggleBulletList(), true);
  assert.match(bullet.editor.getMarkdown(), /^- Item/);
  bullet.editor.destroy();

  const ordered = openEditor('Item');
  assert.equal(ordered.editor.commands.toggleOrderedList(), true);
  assert.match(ordered.editor.getMarkdown(), /^1\. Item/);
  ordered.editor.destroy();

  const link = openEditor('Tiptap');
  link.editor.commands.selectAll();
  assert.equal(link.editor.commands.setLink({ href: 'https://tiptap.dev' }), true);
  assert.equal(link.editor.getMarkdown(), '[Tiptap](https://tiptap.dev)');
  link.editor.destroy();

  const hardBreak = openEditor('First');
  assert.equal(hardBreak.editor.commands.setHardBreak(), true);
  type(hardBreak.editor, 'Second');
  assert.ok(hardBreak.editor.getJSON().content?.[0].content?.some((node) => node.type === 'hardBreak'));
  assert.equal(hardBreak.editor.getMarkdown(), 'First  \nSecond');
  hardBreak.editor.destroy();
});

test('Markdown tables parse, edit, and serialize as one pipe table', () => {
  const markdown = '| Name | Status |\n| --- | --- |\n| Project A | Active |';
  const { editor, externalMarkdown } = openEditor(markdown);
  const document = editor.getJSON();
  const tables = document.content?.filter((node) => node.type === 'table');
  assert.equal(tables?.length, 1);
  assert.equal(tables?.[0].content?.[0].content?.[0].type, 'tableHeader');

  let activeCellEnd;
  editor.state.doc.descendants((node, pos) => {
    if (activeCellEnd === undefined && node.type.name === 'tableCell') activeCellEnd = pos + node.nodeSize - 2;
  });
  assert.notEqual(activeCellEnd, undefined);
  editor.commands.setTextSelection(activeCellEnd);
  type(editor, ' now');

  const serialized = externalMarkdown().trim();
  assert.match(serialized, /^\| Name\s+\| Status\s+\|/);
  assert.match(serialized, /\| Project A now\s+\| Active\s+\|/);
  assert.equal(editor.getJSON().content?.filter((node) => node.type === 'table').length, 1);
  editor.destroy();
});

test('table commands create and change a Markdown-compatible table', () => {
  const { editor } = openEditor();
  assert.equal(editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: true }), true);
  assert.equal(editor.commands.addRowAfter(), true);
  assert.equal(editor.commands.addColumnAfter(), true);
  assert.equal(editor.getJSON().content?.[0].type, 'table');
  assert.equal(editor.getJSON().content?.[0].content?.length, 3);
  assert.equal(editor.getJSON().content?.[0].content?.[0].content?.length, 3);
  assert.match(editor.getMarkdown().trim(), /^\|\s+\|\s+\|\s+\|\n\|\s*---\s*\|\s*---\s*\|\s*---\s*\|/);
  editor.destroy();
});

test('real ratio and scale tables retain cell values, alignment and safe Markdown through edits and two reopens', async () => {
  for (const [file, marker] of [
    ['about/brand-geoportal.md', '11.68:1'], ['about/brand-gin.md', '16.26:1'], ['metadata/b1g.md', 'Scale [1:1,140,480]'],
  ]) {
    const originalBody = parsePage(await readFile(`src/content/docs/${file}`, 'utf8')).body;
    const originalTable = parseBodySyntax(originalBody, 'md').children.find(n => n.type === 'table' && originalBody.slice(n.position.start.offset, n.position.end.offset).includes(marker));
    let markdown = originalBody.slice(originalTable.position.start.offset, originalTable.position.end.offset);
    let expected;
    for (let pass = 1; pass <= 2; pass++) {
      const { editor } = openEditor(markdown);
      const table = editor.state.doc.firstChild;
      assert.equal(table.type.name, 'table');
      const values = table.toJSON();
      if (expected) assert.deepEqual(values, expected, `${file}: changed cells on reopen`);
      let target;
      editor.state.doc.descendants((node, pos) => {
        if (target === undefined && node.type.name === 'paragraph' && node.textContent === marker) target = pos + node.nodeSize - 1;
      });
      if (pass === 1) {
        assert.notEqual(target, undefined, file);
        editor.commands.insertContentAt(target, { type: 'text', text: ' (edited)' });
      }
      expected = editor.state.doc.firstChild.toJSON();
      markdown = editor.getMarkdown();
      const parsed = parseBodySyntax(markdown, 'md').children[0];
      assert.deepEqual(parsed.align, originalTable.align, `${file}: lost column alignment`);
      assert.equal(splitBody(markdown, { format: 'md' })[0].kind, 'markdown');
      const changedBody = originalBody.slice(0, originalTable.position.start.offset) + markdown + originalBody.slice(originalTable.position.end.offset);
      await validateDocument(`---\ntitle: Tables\n---\n\n${changedBody}`, { filename: file, originalBody });
      editor.destroy();
    }
  }
});

test('repository images parse visually and keep their Markdown reference after save and reload', () => {
  const markdown = 'Before\n\n![A useful map](@images/maps/example.png)\n\nAfter';
  const first = openEditor(markdown);
  const image = first.editor.getJSON().content?.find((node) => node.type === 'image');
  assert.equal(image?.attrs?.src, '@images/maps/example.png');
  assert.equal(image?.attrs?.alt, 'A useful map');
  assert.equal(first.editor.getMarkdown(), markdown);
  const rendered = first.editor.view.dom.innerHTML;
  assert.match(rendered, /src="\/api\/images\/file\/maps\/example\.png"/);
  const saved = first.editor.getMarkdown();
  first.editor.destroy();

  const reloaded = openEditor(saved);
  assert.equal(reloaded.editor.getMarkdown(), markdown);
  assert.equal(reloaded.editor.getJSON().content?.find((node) => node.type === 'image')?.attrs?.alt, 'A useful map');
  reloaded.editor.destroy();
});

test('inserting an image writes established @images Markdown syntax', () => {
  const { editor } = openEditor('Before');
  editor.commands.setTextSelection(editor.state.doc.content.size);
  assert.equal(editor.commands.setImage({ src: '@images/uploaded-map.webp', alt: 'Uploaded map' }), true);
  assert.match(editor.getMarkdown(), /!\[Uploaded map\]\(@images\/uploaded-map\.webp\)/);
  editor.destroy();
});

test('all existing LinkCard instances use the supported structured syntax', async () => {
  const instances = [];
  for await (const filename of glob('src/content/docs/**/*.{md,mdx}')) {
    const source = await readFile(filename, 'utf8');
    instances.push(...source.matchAll(/<LinkCard\b[\s\S]*?\/>/g).map((match) => ({ filename, source: match[0] })));
  }
  assert.ok(instances.length > 0, 'repository content exercises LinkCard parsing');
  for (const instance of instances) assert.ok(parseLinkCardMdx(instance.source), instance.filename);
});

test('existing editable LinkCards preserve their surrounding file segment when edited', async () => {
  let editable = 0;
  let readOnly = 0;
  let total = 0;
  for await (const filename of glob('src/content/docs/**/*.{md,mdx}')) {
    const body = (await readFile(filename, 'utf8')).replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n(?:\r?\n)?/, '');
    total += [...body.matchAll(/<LinkCard\b/g)].length;
    for (const segment of splitBody(body)) {
      const count = [...segment.content.matchAll(/<LinkCard\b/g)].length;
      if (!count) continue;
      if (segment.kind === 'protected') { readOnly += count; continue; }
      editable += count;
      const opened = openEditor(segment.content);
      assert.equal(opened.externalMarkdown(), segment.content, `${filename} changed while opening`);
      let position;
      let node;
      opened.editor.state.doc.descendants((item, pos) => {
        if (!node && item.type.name === 'linkCardBlock') { node = item; position = pos; }
      });
      assert.ok(node, `${filename} did not create a LinkCard node`);
      const title = `${node.attrs.title} (edited)`;
      const expectedRaw = updateLinkCardMdx(node.attrs.raw, { title, href: node.attrs.href, description: node.attrs.description });
      const expected = segment.content.replace(node.attrs.raw, expectedRaw);
      opened.editor.commands.setNodeSelection(position);
      opened.editor.commands.updateAttributes('linkCardBlock', { title });
      const serialized = opened.editor.getMarkdown();
      const trailing = segment.content.match(/(?:\r?\n)+$/)?.[0] || '';
      const bounded = `${serialized}${serialized.endsWith('\n') ? '' : trailing}`;
      assert.equal(bounded, expected, `${filename} changed surrounding Markdown`);
      opened.editor.destroy();
    }
  }
  assert.ok(editable > 0, 'repository content exercises editable LinkCards');
  assert.ok(readOnly > 0, 'repository content exercises protected LinkCards');
  assert.equal(editable + readOnly, total, 'every LinkCard is exercised without losing file segments');
});

test('LinkCard loads as a structured node and round-trips through edit and reload', () => {
  const markdown = 'Before\n\n<LinkCard\n  title="Original title"\n  href="/original"\n  description="Original description"\n/>\n\nAfter';
  const opened = openEditor(markdown);
  const node = opened.editor.getJSON().content?.find((item) => item.type === 'linkCardBlock');
  assert.equal(node?.attrs?.title, 'Original title');
  assert.equal(opened.editor.getMarkdown(), markdown);

  let position;
  opened.editor.state.doc.descendants((item, pos) => { if (item.type.name === 'linkCardBlock') position = pos; });
  opened.editor.commands.setNodeSelection(position);
  opened.editor.commands.updateAttributes('linkCardBlock', { title: 'Edited title' });
  const saved = opened.editor.getMarkdown();
  assert.equal(saved, markdown.replace('title="Original title"', 'title="Edited title"'));
  assert.match(saved, /^Before[\s\S]*After$/);
  opened.editor.destroy();

  const reloaded = openEditor(saved);
  assert.equal(reloaded.editor.getJSON().content?.find((item) => item.type === 'linkCardBlock')?.attrs?.title, 'Edited title');
  assert.equal(reloaded.editor.getMarkdown(), saved);
  reloaded.editor.destroy();
});

test('editing one LinkCard field preserves its formatting and other fields exactly', () => {
  const original = `<LinkCard title='Keep title' description="Old &amp; useful" href='/keep-url' />`;
  const parsed = parseLinkCardMdx(original);
  const changed = updateLinkCardMdx(original, { title: parsed.title, description: 'New description', href: parsed.href });
  assert.equal(changed, `<LinkCard title='Keep title' description="New description" href='/keep-url' />`);
});

test('inserting a LinkCard uses the supported MDX syntax and reloads as an editable block', () => {
  const fields = { title: 'Maps & more', description: 'Open the "catalog"', href: '/catalog/' };
  const expected = '<LinkCard\n  title="Maps &amp; more"\n  href="/catalog/"\n  description="Open the &quot;catalog&quot;"\n/>';
  assert.equal(createLinkCardMdx(fields), expected);

  const opened = openEditor('Before\n\nAfter');
  opened.editor.commands.setTextSelection(8);
  assert.equal(opened.editor.commands.insertContent({ type: 'linkCardBlock', attrs: { ...fields, raw: createLinkCardMdx(fields) } }), true);
  const saved = opened.editor.getMarkdown();
  assert.match(saved, /Before[\s\S]*<LinkCard[\s\S]*Maps &amp; more[\s\S]*After/);
  opened.editor.destroy();

  const reloaded = openEditor(saved);
  let position;
  reloaded.editor.state.doc.descendants((node, pos) => { if (node.type.name === 'linkCardBlock') position = pos; });
  assert.notEqual(position, undefined);
  reloaded.editor.commands.setNodeSelection(position);
  reloaded.editor.commands.updateAttributes('linkCardBlock', { title: 'Edited after reload' });
  assert.match(reloaded.editor.getMarkdown(), /title="Edited after reload"/);
  reloaded.editor.destroy();
});

test('LinkCard import is preserved when present and added once when absent', () => {
  const existing = "import { Card, LinkCard } from '@astrojs/starlight/components';\nimport Other from './Other.astro';\n\nBody";
  assert.deepEqual(ensureLinkCardImport(existing), { content: existing, added: false });

  const without = "import Other from './Other.astro';\n\nBody";
  const once = ensureLinkCardImport(without);
  assert.equal(once.added, true);
  assert.equal(once.content, `import Other from './Other.astro';\n${LINK_CARD_IMPORT}\n\nBody`);
  const twice = ensureLinkCardImport(once.content);
  assert.deepEqual(twice, { content: once.content, added: false });
  assert.equal([...twice.content.matchAll(/import \{ LinkCard \}/g)].length, 1);
});

test('multiple inserted LinkCards remain separate structured nodes', () => {
  const opened = openEditor('Start');
  for (const fields of [
    { title: 'One', description: '', href: '/one/' },
    { title: 'Two', description: 'Second', href: '/two/' },
  ]) {
    assert.equal(opened.editor.commands.insertContentAt(opened.editor.state.selection.to, {
      type: 'linkCardBlock', attrs: { ...fields, raw: createLinkCardMdx(fields) },
    }), true);
  }
  assert.equal(opened.editor.getJSON().content?.filter((node) => node.type === 'linkCardBlock').length, 2);
  assert.equal([...opened.editor.getMarkdown().matchAll(/<LinkCard\b/g)].length, 2);
  opened.editor.destroy();
});

test('inserting LinkCards keeps unsupported MDX unchanged and creates isolated structured blocks', () => {
  const original = "import Other from './Other.astro';\n\n<Card dynamic={value}>\nDo not change\n</Card>\n\nBefore";
  const card = createLinkCardMdx({ title: 'One', description: '', href: '/one/' });
  const first = ensureLinkCardImport(`${original}\n\n${card}\n`).content;
  const second = ensureLinkCardImport(`${first}\n${createLinkCardMdx({ title: 'Two', description: 'Second', href: '/two/' })}\n`).content;
  assert.equal([...second.matchAll(/import \{ LinkCard \}/g)].length, 1);
  assert.match(second, /<Card dynamic=\{value\}>\nDo not change\n<\/Card>/);
  const segments = splitBody(second);
  assert.equal(segments.filter((segment) => segment.kind === 'structured').length, 2);
  assert.ok(segments.some((segment) => segment.kind === 'protected' && segment.content.includes('Do not change')));
});

test('unsupported LinkCard variants remain unchanged read-only MDX', () => {
  for (const source of [
    '<LinkCard title={dynamicTitle} href="/example" />\n',
    '<LinkCard title="Example" href="/example" icon="external" />\n',
    '<LinkCard title="Example" href="/example">Children</LinkCard>\n',
  ]) {
    assert.equal(parseLinkCardMdx(source), null);
    const segments = splitBody(source);
    assert.equal(segments.map((segment) => segment.content).join(''), source);
    assert.ok(segments.every((segment) => segment.kind === 'protected'));
  }
});

test('opening another entry initializes a new document once', () => {
  const first = openEditor('First');
  type(first.editor, ' entry');
  first.editor.destroy();

  const second = openEditor('Second ');
  type(second.editor, 'Some');
  assertSingleParagraph(second.editor, 'Second Some');
  second.editor.destroy();
});

test('saving external Markdown does not rehydrate the live editor', () => {
  const { editor, externalMarkdown } = openEditor('Before ');
  type(editor, 'save');
  const instance = editor;
  const savedMarkdown = externalMarkdown();

  type(editor, ' and after');
  assert.equal(editor, instance);
  assert.equal(savedMarkdown, 'Before save');
  assertSingleParagraph(editor, 'Before save and after');
  editor.destroy();
});

test('typing in Markdown adjacent to protected MDX preserves the MDX block', () => {
  const body = 'Before\n\n<Card>\nprotected\n</Card>\n\nAfter ';
  const segments = splitBody(body);
  const protectedSegment = segments.find((segment) => segment.kind === 'protected');
  const editableSegment = segments.at(-1);
  assert.equal(protectedSegment?.content, '<Card>\nprotected\n</Card>\n');
  assert.equal(editableSegment?.kind, 'markdown');

  const { editor } = openEditor(editableSegment?.content);
  type(editor, 'Some');
  assertSingleParagraph(editor, 'After Some');
  assert.match(segments.map((segment) => segment === editableSegment ? editor.getMarkdown() : segment.content).join(''), /<Card>\nprotected\n<\/Card>/);
  editor.destroy();
});

test('standalone MDX expressions and comments are preserved as read-only blocks', () => {
  const body = 'Before\n\n{/* do not rewrite */}\n\n{items.map((item) => (\n  <Card>{item}</Card>\n))}\n\nAfter';
  const segments = splitBody(body);
  assert.equal(segments.map((segment) => segment.content).join(''), body);
  assert.equal(segments.filter((segment) => segment.kind === 'protected').length, 2);
  assert.match(segments.filter((segment) => segment.kind === 'protected').map((segment) => segment.content).join(''), /do not rewrite[\s\S]*items\.map/);
});

test('Astro Image components and imported image expressions remain read-only', () => {
  const body = `import { Image } from 'astro:assets';\nimport map from '@images/map.png';\n\nBefore\n\n<Image src={map} alt="Map" />\n\nAfter`;
  const segments = splitBody(body);
  assert.equal(segments.map((segment) => segment.content).join(''), body);
  assert.match(segments.filter((segment) => segment.kind === 'protected').map((segment) => segment.content).join(''), /import \{ Image \}[\s\S]*<Image src=\{map\}/);
});

test('React integration has no live-content rehydration and remounts only for entry sessions', async () => {
  const source = await readFile(new URL('../src/components/editor/ProjectEditor.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /commands\.setContent|setContent\s*\(/);
  assert.match(source, /<BodyEditor key=\{bodyEditorSession\} initialValue=\{project\.body\}/);
  assert.doesNotMatch(source, /<BodyEditor key=\{`\$\{project\.filename\}:\$\{project\.sha/);
});

test('blog layout blocks protect nested components, multiline attributes, and imports while nearby Markdown remains editable', () => {
  const component = '<CenterLayout\n  class="layout > wide"\n>\n  <CenterLayout>\n  Inner content\n  </CenterLayout>\n  Outer content\n</CenterLayout>\n';
  const imports = "import {\n  Card,\n  CardGrid\n} from '@astrojs/starlight/components';\n";
  const body = `${imports}\nBefore\n\n${component}\nAfter `;
  const segments = splitBody(body);
  assert.equal(segments.map((segment) => segment.content).join(''), body);
  const protectedText = segments.filter((segment) => segment.kind === 'protected').map((segment) => segment.content).join('');
  assert.ok(protectedText.includes(component));
  assert.ok(protectedText.includes(imports));
  const editable = segments.at(-1);
  assert.equal(editable.kind, 'markdown');
  const { editor } = openEditor(editable.content);
  type(editor, 'edited');
  const saved = segments.map((segment) => segment === editable ? editor.getMarkdown() : segment.content).join('');
  assert.ok(saved.includes(component));
  assert.ok(saved.includes(imports));
  assert.ok(saved.includes('After edited'));
  editor.destroy();
});

test('images with and without captions insert, edit, and reopen as standard Markdown', () => {
  for (const title of ['', 'A "quoted" caption \\ with brackets [here]']) {
    const { editor } = openEditor();
    editor.commands.setImage({ src: '@images/original.png', alt: 'Original [map]', title });
    const firstSave = editor.getMarkdown();
    assert.doesNotMatch(firstSave, /<figure|<img|width=/);
    const reopened = openEditor(firstSave);
    const image = reopened.editor.state.doc.firstChild;
    assert.equal(image.type.name, 'image');
    assert.equal(image.attrs.title || '', title);
    assert.equal(image.attrs.alt, 'Original [map]');
    reopened.editor.commands.setNodeSelection(0);
    reopened.editor.commands.updateAttributes('image', { src: '@images/replacement.png', alt: 'Replacement map', title: 'Replacement caption' });
    const saved = reopened.editor.getMarkdown();
    assert.match(saved, /!\[Replacement map\]\(@images\/replacement.png "Replacement caption"\)/);
    const final = openEditor(saved);
    assert.equal(final.editor.state.doc.firstChild.attrs.title, 'Replacement caption');
    assert.equal(final.editor.state.doc.firstChild.attrs.src, '@images/replacement.png');
    final.editor.commands.setNodeSelection(0);
    final.editor.commands.updateAttributes('image', { title: '' });
    assert.match(final.editor.getMarkdown(), /!\[Replacement map\]\(@images\/replacement.png\)/);
    for (const instance of [editor, reopened.editor, final.editor]) instance.destroy();
  }
});

test('unrelated text edits retain original image syntax, titles, paths, and protected MDX', () => {
  const body = `import CenterLayout from '/src/components/CenterLayout.astro';\n\n![Original alt](@images//map.png 'Original title')\n\nBefore\n\n<CenterLayout class="legacy">\n![Protected](@images/private.png "Do not change")\n<Other value={expression} />\n</CenterLayout>\n`;
  const segments = splitBody(body);
  const markdown = segments.find((segment) => segment.kind === 'markdown');
  const opened = openEditor(markdown.content);
  type(opened.editor, ' edited');
  assert.ok(opened.editor.getMarkdown().includes("![Original alt](@images//map.png 'Original title')"));
  const saved = segments.map((segment) => segment === markdown ? `${opened.editor.getMarkdown()}\n\n` : segment.content).join('');
  assert.ok(saved.includes('<CenterLayout class="legacy">\n![Protected](@images/private.png "Do not change")\n<Other value={expression} />\n</CenterLayout>'));
  assert.ok(saved.includes("import CenterLayout from '/src/components/CenterLayout.astro';"));
  opened.editor.destroy();
});

test('repository preview resolves legacy paths without changing stored source', () => {
  for (const src of ['@images//folder/map.png', '../../assets/images/folder/map.png', '/src/assets/images/folder/map.png']) {
    const markdown = `![Map](${src} "Map caption")`;
    const opened = openEditor(markdown);
    assert.equal(opened.editor.view.dom.querySelector('img').getAttribute('src'), '/api/images/file/folder/map.png');
    assert.equal(opened.editor.view.dom.querySelector('figcaption').textContent, 'Map caption');
    assert.equal(opened.editor.getMarkdown().trim(), markdown);
    opened.editor.destroy();
  }
});


test('LinkButtons round-trip and targeted edits preserve quotes, spacing, and surrounding content', () => {
  for (const source of ["<LinkButton href='/original'>Original label</LinkButton>", '<LinkButton\r\n  href="/original"\r\n  variant="secondary"\r\n>\r\n  Original label\r\n</LinkButton>']) {
    const parsed = parseLinkButtonMdx(source);
    assert.ok(parsed);
    assert.equal(updateLinkButtonMdx(source, parsed), source);
    assert.equal(updateLinkButtonMdx(source, { ...parsed, text: 'Updated label' }), source.replace('Original label', 'Updated label'));
    const opened = openEditor(`Before\n\n${source}\n\nAfter`);
    assert.ok(opened.editor.getMarkdown().includes(source.replace(/\r\n/g, '\n')));
    let position;
    opened.editor.state.doc.descendants((node, pos) => { if (node.type.name === 'linkButtonBlock') position = pos; });
    opened.editor.commands.setNodeSelection(position);
    opened.editor.commands.updateAttributes('linkButtonBlock', { text: 'New label', href: '/changed', variant: 'minimal' });
    const saved = opened.editor.getMarkdown();
    assert.match(saved, /New label/);
    assert.match(saved, /href=['"]\/changed['"]/);
    assert.match(saved, /variant="minimal"/);
    const reloaded = openEditor(saved);
    const button = reloaded.editor.getJSON().content.find(node => node.type === 'linkButtonBlock');
    assert.equal(button.attrs.text, 'New label');
    assert.equal(button.attrs.href, '/changed');
    assert.equal(button.attrs.variant, 'minimal');
    opened.editor.destroy(); reloaded.editor.destroy();
  }
});

test('new LinkButtons escape literal labels and serialize as supported Starlight MDX', () => {
  const fields = { text: 'Maps & {data} [links] **text** <more>', href: '/maps/?a=1&b=2', variant: 'secondary' };
  const raw = createLinkButtonMdx(fields);
  assert.deepEqual(parseLinkButtonMdx(raw), { ...fields, raw });
  const opened = openEditor('Before');
  assert.equal(opened.editor.commands.insertContentAt(opened.editor.state.selection.to, { type: 'linkButtonBlock', attrs: { ...fields, raw } }), true);
  const saved = opened.editor.getMarkdown();
  assert.ok(saved.includes(raw));
  const reloaded = openEditor(saved);
  assert.equal(reloaded.editor.getJSON().content.find(node => node.type === 'linkButtonBlock').attrs.text, fields.text);
  opened.editor.destroy(); reloaded.editor.destroy();
});

test('unsupported LinkButtons and buttons inside legacy layouts remain protected verbatim', () => {
  for (const source of [
    '<LinkButton href={url}>Label</LinkButton>\n',
    '<LinkButton href="/" icon="external">Label</LinkButton>\n',
    '<LinkButton href="/" variant="other">Label</LinkButton>\n',
    '<LinkButton href="/">**Formatted**</LinkButton>\n',
    '<LinkButton href="/">{label}</LinkButton>\n',
    '<LinkButton href="/">Read <Icon name="external" /></LinkButton>\n',
    '<LinkButton href="/" href="/two">Duplicate</LinkButton>\n',
    '<CenterLayout>\n<LinkButton href="/">Nested</LinkButton>\n</CenterLayout>\n',
  ]) {
    assert.equal(parseLinkButtonMdx(source), null);
    const segments = splitBody(source);
    assert.equal(segments.map(segment => segment.content).join(''), source);
    assert.ok(segments.every(segment => segment.kind === 'protected'));
  }
  const raw = '<LinkButton href="/">Editable</LinkButton>\n';
  assert.equal(splitBody(raw)[0].kind, 'structured');
});

test('LinkButton imports preserve complete existing imports and avoid duplicates or binding conflicts', () => {
  for (const imports of ["import { Card, LinkButton } from '@astrojs/starlight/components';\n", "import {\n  Card,\n  LinkButton,\n} from '@astrojs/starlight/components';\n"]) {
    const source = `${imports}\nBody`;
    assert.equal(ensureLinkButtonImport(source).content, source);
    assert.equal(ensureLinkButtonImport(source).added, false);
  }
  const source = "import {\n  Card,\n} from '@astrojs/starlight/components';\n\nBody";
  const added = ensureLinkButtonImport(source);
  assert.ok(added.content.startsWith(source.split('\n\n')[0]));
  assert.ok(added.content.includes("import { LinkButton } from '@astrojs/starlight/components';"));
  assert.equal(ensureLinkButtonImport(added.content).content, added.content);
  const conflict = "import LinkButton from './Custom.astro';\n\nBody";
  assert.ok(ensureLinkButtonImport(conflict).error);
  assert.equal(ensureLinkButtonImport(conflict).content, conflict);
});

test('LinkButton examples in fenced Markdown stay code rather than editable components', () => {
  const example = '```mdx\nimport { LinkButton } from \'@astrojs/starlight/components\';\n<LinkButton href="/">Example</LinkButton>\n```\n';
  const segments = splitBody(example);
  assert.equal(segments.length, 1);
  assert.equal(segments[0].kind, 'markdown');
  assert.equal(segments[0].content, example);
  assert.equal(ensureLinkButtonImport(example).added, true, 'example imports are not runtime imports');
});


for (const kind of SIMPLE_KINDS) {
  test(`new ${kind} inserts, edits and reopens using its narrow Starlight format`, () => {
    const fields = { ...emptySimpleFields(), title: kind === 'badge' ? '' : 'Maps & <literal title>', text: kind === 'badge' ? 'New & useful' : 'Message with {expressions} and <components>.\n1. A literal line, not a list.\n::: not a callout', ...(kind === 'badge' ? { variant: 'success', size: 'medium' } : kind === 'callout' ? { type: 'tip' } : {}) };
    const raw = createSimpleComponentMdx(kind, fields);
    assert.deepEqual(parseSimpleComponentMdx(raw)?.fields, fields);
    const opened = openEditor('Before');
    assert.equal(opened.editor.commands.insertContentAt(opened.editor.state.selection.to, { type: SIMPLE_COMPONENTS[kind].node, attrs: { ...fields, raw } }), true);
    const saved = opened.editor.getMarkdown();
    assert.ok(saved.includes(raw));
    const reloaded = openEditor(saved);
    let position;
    reloaded.editor.state.doc.descendants((node, pos) => { if (node.type.name === SIMPLE_COMPONENTS[kind].node) position = pos; });
    assert.notEqual(position, undefined);
    reloaded.editor.commands.setNodeSelection(position);
    reloaded.editor.commands.updateAttributes(SIMPLE_COMPONENTS[kind].node, { text: 'Revised & literal <text>' });
    const changed = reloaded.editor.getMarkdown();
    const component = splitBody(changed).find(segment => segment.kind === 'structured');
    assert.equal(parseSimpleComponentMdx(component.content)?.fields.text, 'Revised & literal <text>');
    const final = openEditor(changed);
    assert.equal(final.editor.getMarkdown(), changed);
    opened.editor.destroy(); reloaded.editor.destroy(); final.editor.destroy();
  });
}

test('existing badges, callouts, cards, and unsupported new-format syntax remain protected', () => {
  const fields = { ...emptySimpleFields(), title: 'Title', text: 'Message' };
  for (const source of [
    '<Badge text="Existing" />\n',
    '<Aside type="tip">Existing plain message</Aside>\n',
    '<Card title="Existing">Existing plain message</Card>\n',
    createSimpleComponentMdx('badge', fields).replace('size="small"', 'size="small" class="custom"') + '\n',
    createSimpleComponentMdx('callout', fields).replace('Message', '<Other dynamic={value} />') + '\n',
    createSimpleComponentMdx('card', fields).replace('Message', '**Rich Markdown**') + '\n',
    '<CardGrid>\n' + createSimpleComponentMdx('card', fields) + '\n</CardGrid>\n',
  ]) {
    assert.equal(parseSimpleComponentMdx(source), null);
    assert.equal(splitBody(source).map(segment => segment.content).join(''), source);
    assert.ok(splitBody(source).every(segment => segment.kind === 'protected'));
  }
});

test('legacy directive callouts reopen as rich editable blocks and preserve original Markdown until edited', () => {
  for (const name of ['note', 'tip', 'caution', 'danger', 'info', 'warning', 'Caution']) {
    const raw = `:::${name}[Title]\n\nA **bold** [link](/maps).\n\n- First\n- Second\n\n:::`;
    const opened = openEditor(raw);
    assert.equal(opened.editor.state.doc.firstChild.type.name, 'simpleCalloutBlock');
    assert.equal(opened.editor.getMarkdown(), raw);
    opened.editor.commands.setNodeSelection(0);
    opened.editor.commands.updateAttributes('simpleCalloutBlock', { title: 'Revised' });
    const changed = opened.editor.getMarkdown();
    assert.equal(parseDirectiveCallout(changed).fields.title, 'Revised');
    assert.ok(changed.includes('A **bold** [link](/maps).\n\n- First\n- Second'));
    assert.ok(!changed.includes('CmsCallout'));
    const reloaded = openEditor(changed);
    assert.equal(reloaded.editor.getMarkdown(), changed);
    opened.editor.destroy(); reloaded.editor.destroy();
  }
});

test('new component aliases preserve legacy imports, avoid duplicates, and detect conflicts', () => {
  const original = "import { Card, Aside, Badge } from '@astrojs/starlight/components';\n\n<Card title=\"Old\">Keep me</Card>\n";
  let source = original;
  for (const kind of SIMPLE_KINDS) {
    const result = ensureSimpleComponentImport(source, kind);
    assert.equal(result.added, true);
    assert.ok(result.content.includes('<Card title="Old">Keep me</Card>'));
    assert.ok(result.content.includes(original.split('\n')[0]));
    source = result.content;
    assert.equal(ensureSimpleComponentImport(source, kind).content, source);
    assert.equal(ensureSimpleComponentImport(source, kind).added, false);
    const conflict = `import ${SIMPLE_COMPONENTS[kind].binding} from './Custom.astro';\n`;
    assert.ok(ensureSimpleComponentImport(conflict, kind).error);
    assert.equal(ensureSimpleComponentImport(conflict, kind).content, conflict);
  }
});

test('image formatting preserves Markdown, saves explicit alignment/width, and resets without losing captions', () => {
  const raw = "![Original alt](@images//original.png 'Original caption')";
  const { editor } = openEditor(`${raw}\n\nAfter`);
  editor.commands.setNodeSelection(0);
  editor.commands.updateAttributes('image', { width: 320, align: 'right' });
  const formatted = `<figure data-cms-image="true" data-align="right" data-width="320">\n\n${raw}\n\n</figure>`;
  assert.equal(editor.getMarkdown(), `${formatted}\n\nAfter`);
  const segments = splitBody(`${formatted}\n\nAfter`);
  assert.equal(segments.length, 1);
  assert.equal(segments[0].kind, 'markdown');
  const reopened = openEditor(editor.getMarkdown()).editor;
  assert.equal(reopened.state.doc.firstChild.attrs.width, 320);
  assert.equal(reopened.state.doc.firstChild.attrs.align, 'right');
  assert.equal(reopened.getMarkdown(), editor.getMarkdown());
  reopened.commands.setNodeSelection(0);
  reopened.commands.updateAttributes('image', { src: '@images/new.png', alt: 'New alt', title: 'New caption' });
  assert.match(reopened.getMarkdown(), /!\[New alt\]\(@images\/new.png "New caption"\)/);
  assert.match(reopened.getMarkdown(), /data-width="320"/);
  reopened.commands.updateAttributes('image', { width: null, align: null });
  assert.equal(reopened.getMarkdown(), '![New alt](@images/new.png "New caption")\n\nAfter');
  reopened.destroy(); editor.destroy();
});

test('alignment without width and formatted images without captions round trip', () => {
  for (const align of ['left', 'center', 'right']) {
    const raw = `<figure data-cms-image="true" data-align="${align}">\n\n![Map](@images/map.png)\n\n</figure>`;
    const { editor } = openEditor(raw);
    assert.equal(editor.state.doc.firstChild.type.name, 'image');
    assert.equal(editor.state.doc.firstChild.attrs.align, align);
    assert.equal(editor.getMarkdown().trim(), raw);
    editor.destroy();
  }
});

test('existing custom image sizes stay exact; preset controls preserve metadata through undo and save/reopen', () => {
  const markdown = "![Original alt](@images//original.png 'Original caption')";
  for (const width of [5, 137, 320, 9600]) {
    const source = `<figure data-cms-image="true" data-align="right" data-width="${width}">\n\n${markdown}\n\n</figure>\n\nAfter`;
    const { editor } = openEditor(source);
    assert.equal(editor.getMarkdown(), source, 'opening a custom size must not normalize the source');
    const select = editor.view.dom.querySelector('.image-format-controls select');
    assert.equal(select.querySelector('option').textContent, `Custom (${width}px)`);
    for (const preset of IMAGE_SIZE_PRESETS) {
      select.value = String(preset.width);
      select.dispatchEvent(new window.Event('change'));
      const saved = editor.getMarkdown();
      assert.equal(saved, source.replace(`data-width="${width}"`, `data-width="${preset.width}"`));
      const reopened = openEditor(saved).editor;
      assert.equal(reopened.getMarkdown(), saved);
      assert.equal(reopened.state.doc.firstChild.attrs.width, preset.width);
      assert.equal(reopened.state.doc.firstChild.attrs.align, 'right');
      assert.equal(reopened.state.doc.firstChild.attrs.src, '@images//original.png');
      assert.equal(reopened.state.doc.firstChild.attrs.alt, 'Original alt');
      assert.equal(reopened.state.doc.firstChild.attrs.title, 'Original caption');
      reopened.commands.setNodeSelection(0);
      reopened.commands.updateAttributes('image', { title: 'Changed caption' });
      const final = openEditor(reopened.getMarkdown()).editor;
      assert.equal(final.state.doc.firstChild.attrs.width, preset.width);
      assert.equal(final.state.doc.firstChild.attrs.title, 'Changed caption');
      final.destroy(); reopened.destroy();
    }
    editor.commands.undo();
    assert.equal(editor.getMarkdown(), source);
    editor.commands.redo();
    assert.equal(editor.state.doc.firstChild.attrs.width, IMAGE_SIZE_PRESETS.at(-1).width);
    editor.destroy();
  }
});

test('unrecognized figures remain protected, while adjacent formatted images stay editable', () => {
  const valid = '<figure data-cms-image="true" data-align="left" data-width="240">\n\n![Map](@images/map.png "Caption")\n\n</figure>';
  for (const raw of [
    valid.replace('data-align="left"', 'data-align={alignment}'),
    valid.replace('data-width="240"', 'data-width="0"'),
    valid.replace('<figure ', '<figure class="custom" '),
    valid.replace('\n\n</figure>', '\n\n<Unknown />\n\n</figure>'),
    '<CenterLayout>\n' + valid + '\n</CenterLayout>',
  ]) {
    const body = `${raw}\n\n${valid}\n\nAfter\n`;
    const parts = splitBody(body);
    assert.equal(parts.map(p => p.content).join(''), body);
    assert.equal(parts[0].kind, 'protected');
    assert.ok(parts[0].content.includes(raw));
    assert.equal(parts.at(-1).kind, 'markdown');
    const { editor } = openEditor(parts.at(-1).content);
    type(editor, ' edited');
    assert.ok(editor.getMarkdown().includes(valid));
    editor.destroy();
  }
  const crlf = valid.replaceAll('\n', '\r\n') + '\r\n';
  assert.equal(splitBody(crlf).map(p => p.content).join(''), crlf);
});

test('formatting a parenthesized Markdown destination produces an editable inline image on reopen', () => {
  const { editor } = openEditor('![Map](https://example.org/map(1).png "Caption")\n\n![Unchanged](@images//other.png \'Keep\')');
  editor.commands.setNodeSelection(0);
  editor.commands.updateAttributes('image', { align: 'left' });
  const saved = editor.getMarkdown();
  assert.ok(saved.includes("![Unchanged](@images//other.png 'Keep')"));
  assert.equal(splitBody(saved)[0].kind, 'markdown');
  const reopened = openEditor(saved).editor;
  assert.equal(reopened.state.doc.firstChild.type.name, 'image');
  assert.equal(reopened.state.doc.firstChild.attrs.src, 'https://example.org/map(1).png');
  reopened.destroy(); editor.destroy();
});
