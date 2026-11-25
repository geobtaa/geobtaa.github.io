import assert from 'node:assert/strict';
import test from 'node:test';
import { glob, readFile } from 'node:fs/promises';
import { parseBodySyntax, supportedMarkdownNode } from '../src/components/editor/contentSyntax.ts';
import { splitBody } from '../src/components/editor/bodySegments.ts';
import { parseContent } from './content.mjs';
import { validateDocument } from './validateDocument.mjs';

const table = value => `| Label | Value |\n| :--- | ---: |\n| Example | ${value} |`;
const document = body => `---\ntitle: Tables\n---\n\n${body}`;

test('bare colon values inside Markdown tables are literal text in Markdown and MDX', async () => {
  for (const format of ['md', 'mdx']) for (const value of ['11.68:1', 'Scale [1:1,140,480]', '10:30', 'dc:value', ':note', ':custom-name']) {
    const source = table(value);
    const node = parseBodySyntax(source, format).children[0];
    assert.equal(node.type, 'table');
    assert.equal(supportedMarkdownNode(node), true, value);
    assert.ok(!JSON.stringify(node).includes('textDirective'));
    assert.deepEqual(node.align, ['left', 'right']);
    assert.equal(node.children[1].children[1].children.map(n => n.value).join(''), value);
    assert.equal(splitBody(source, { format })[0].kind, 'markdown');
    assert.equal(splitBody(source, { format }).map(s => s.content).join(''), source);
    await validateDocument(document(source), { filename: `page.${format}`, originalBody: source });
  }
});

test('labeled directives, attributes, expressions, components, references and HTML in cells remain protected', async () => {
  for (const [value, definitions = ''] of [
    [':badge[label]'], [':note[]'], [':custom{key="value"}'], [':note{}'],
    ['{frontmatter.value}'], ['<Icon name="check" />'], ['<span class="swatch">Blue</span>'],
    ['Footnote[^n]', '\n\n[^n]: A citation.'], ['![Map][map]', '\n\n[map]: /map.png'],
  ]) {
    const source = table(value) + definitions;
    assert.equal(splitBody(source)[0].kind, 'protected', value);
    await assert.rejects(validateDocument(document(source)), /unsupported/);
    const changed = source.replace('Example', 'Edited');
    await assert.rejects(validateDocument(document(changed), { originalBody: source }), /read-only content/);
  }
  for (const value of [':badge[label]', ':custom{}', '<span>Styled</span>']) {
    assert.equal(splitBody(table(value), { format: 'md' })[0].kind, 'protected');
  }
});

test('numeric prose stays editable while directives, code and containing layouts retain their meaning', async () => {
  const prose = 'At 10:30, the ratio is 11.68:1.';
  assert.equal(splitBody(prose)[0].kind, 'markdown');
  assert.ok(!JSON.stringify(parseBodySyntax(prose)).includes('textDirective'));
  assert.equal(splitBody('A custom :widget directive.')[0].kind, 'protected');
  await validateDocument(document(prose));
  const code = '```md\n' + table('11.68:1') + '\n```';
  assert.equal(parseBodySyntax(code).children[0].value, table('11.68:1'));
  const wrapped = `<Slideshow>\n${table('11.68:1')}\n</Slideshow>\n`;
  assert.equal(splitBody(wrapped)[0].kind, 'protected');
  await assert.rejects(validateDocument(document(wrapped.replace('Example', 'Edited')), { originalBody: wrapped }), /read-only content/);
  const callout = ':::note\nA plain message.\n:::';
  assert.equal(splitBody(callout)[0].kind, 'structured');
  assert.equal(parseBodySyntax(callout).children[0].type, 'containerDirective');
});

test('the three existing ratio/scale tables become editable and every document still reconstructs exactly', async () => {
  const targets = new Map([
    ['about/brand-geoportal.md', '11.68:1'],
    ['about/brand-gin.md', '16.26:1'],
    ['metadata/b1g.md', 'Scale [1:1,140,480]'],
  ]);
  for (const [file, marker] of targets) {
    const body = parseContent(await readFile(`src/content/docs/${file}`, 'utf8')).body;
    const segments = splitBody(body, { format: 'md' });
    const segment = segments.find(s => s.content.includes(marker));
    assert.equal(segment.kind, 'markdown', file);
    const revised = segments.map(s => s === segment ? { ...s, content: s.content.replace(marker, `${marker} updated`) } : s).map(s => s.content).join('');
    await validateDocument(document(revised), { filename: file, originalBody: body });
    // These pages also contain unsupported markup; it remains immutable.
    const protectedBlock = segments.find(s => s.kind === 'protected');
    assert.ok(protectedBlock, file);
    await assert.rejects(validateDocument(document(revised.replace(protectedBlock.content, 'Removed.\n')), { filename: file, originalBody: body }), /read-only content|component source must remain unchanged/);
  }
  for await (const file of glob('src/content/docs/**/*.{md,mdx}')) {
    const body = parseContent(await readFile(file, 'utf8')).body;
    const format = file.endsWith('.md') ? 'md' : 'mdx';
    assert.equal(splitBody(body, { format }).map(s => s.content).join(''), body, file);
  }
});
