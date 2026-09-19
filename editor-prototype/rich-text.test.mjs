import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { Editor } from '@tiptap/core';
import { parseHTML } from 'linkedom';
import { splitBody } from '../src/components/editor-prototype/bodySegments.ts';
import { richTextEditorOptions } from '../src/components/editor-prototype/richTextEditor.ts';

const { window } = parseHTML('<!doctype html><html><body></body></html>');
Object.assign(globalThis, {
  window,
  document: window.document,
  DOMParser: window.DOMParser,
  MutationObserver: window.MutationObserver,
  getSelection: window.getSelection?.bind(window),
  innerHeight: 800,
  innerWidth: 1200,
});
window.HTMLElement.prototype.getBoundingClientRect = () => ({ top: 0, right: 0, bottom: 0, left: 0, width: 0, height: 0 });
window.HTMLElement.prototype.getClientRects = () => [];
const selection = { anchorNode: null, anchorOffset: 0, focusNode: null, focusOffset: 0, rangeCount: 0, isCollapsed: true, removeAllRanges() {}, addRange() {} };
window.document.getSelection = () => selection;
window.getSelection = () => selection;

function openEditor(markdown = '') {
  let externalMarkdown = markdown;
  const editor = new Editor({ ...richTextEditorOptions(markdown, (next) => { externalMarkdown = next; }), injectCSS: false });
  editor.commands.setTextSelection(editor.state.doc.content.size - 1);
  return { editor, externalMarkdown: () => externalMarkdown };
}

function type(editor, value) {
  for (const character of value) editor.commands.insertContent(character);
}

function assertSingleParagraph(editor, text) {
  const document = editor.getJSON();
  assert.equal(document.content?.length, 1);
  assert.equal(document.content?.[0].type, 'paragraph');
  assert.equal(document.content?.[0].content?.map((node) => node.text || '').join(''), text);
}

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
  const source = await readFile(new URL('../src/components/editor-prototype/ProjectEditor.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /commands\.setContent|setContent\s*\(/);
  assert.match(source, /<BodyEditor key=\{bodyEditorSession\} initialValue=\{project\.body\}/);
  assert.doesNotMatch(source, /<BodyEditor key=\{`\$\{project\.filename\}:\$\{project\.sha/);
});
