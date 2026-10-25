import assert from 'node:assert/strict';
import { glob, readFile } from 'node:fs/promises';
import test from 'node:test';
import { Editor } from '@tiptap/core';
import { parseHTML } from 'linkedom';
import { splitBody } from '../src/components/editor-prototype/bodySegments.ts';
import { richTextEditorOptions } from '../src/components/editor-prototype/richTextEditor.ts';
import { SIMPLE_KINDS, SIMPLE_COMPONENTS, createSimpleComponentMdx, emptySimpleFields, ensureSimpleComponentImport, parseSimpleComponentMdx } from '../src/components/editor-prototype/simpleComponents.ts';
import { createLinkButtonMdx, ensureLinkButtonImport, parseLinkButtonMdx, updateLinkButtonMdx } from '../src/components/editor-prototype/linkButtonMdx.ts';
import { createLinkCardMdx, ensureLinkCardImport, LINK_CARD_IMPORT, parseLinkCardMdx, updateLinkCardMdx } from '../src/components/editor-prototype/linkCardMdx.ts';

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
  const source = await readFile(new URL('../src/components/editor-prototype/ProjectEditor.tsx', import.meta.url), 'utf8');
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
