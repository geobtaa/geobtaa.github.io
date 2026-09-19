import assert from 'node:assert/strict';
import { glob, readFile } from 'node:fs/promises';
import test from 'node:test';
import { Editor } from '@tiptap/core';
import { parseHTML } from 'linkedom';
import { splitBody } from '../src/components/editor-prototype/bodySegments.ts';
import { richTextEditorOptions } from '../src/components/editor-prototype/richTextEditor.ts';
import { parseLinkCardMdx, updateLinkCardMdx } from '../src/components/editor-prototype/linkCardMdx.ts';

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
  if (editor.state.doc.lastChild?.isTextblock) editor.commands.setTextSelection(editor.state.doc.content.size - 1);
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

test('all existing LinkCard instances use the supported structured syntax', async () => {
  const instances = [];
  for await (const filename of glob('src/content/docs/**/*.{md,mdx}')) {
    const source = await readFile(filename, 'utf8');
    instances.push(...source.matchAll(/<LinkCard\b[\s\S]*?\/>/g).map((match) => ({ filename, source: match[0] })));
  }
  assert.equal(instances.length, 21);
  for (const instance of instances) assert.ok(parseLinkCardMdx(instance.source), instance.filename);
});

test('existing editable LinkCards preserve their surrounding file segment when edited', async () => {
  let editable = 0;
  let readOnly = 0;
  for await (const filename of glob('src/content/docs/**/*.{md,mdx}')) {
    const body = (await readFile(filename, 'utf8')).replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n(?:\r?\n)?/, '');
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
  assert.equal(editable, 19);
  assert.equal(readOnly, 2);
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
  const source = await readFile(new URL('../src/components/editor-prototype/ProjectEditor.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /commands\.setContent|setContent\s*\(/);
  assert.match(source, /<BodyEditor key=\{bodyEditorSession\} initialValue=\{project\.body\}/);
  assert.doesNotMatch(source, /<BodyEditor key=\{`\$\{project\.filename\}:\$\{project\.sha/);
});
