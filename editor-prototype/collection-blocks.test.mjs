import assert from 'node:assert/strict';
import test from 'node:test';
import { COLLECTION_BLOCKS, createCollectionMdx, parseCollectionMdx, updateCollectionMdx, ensureCollectionImport, supportedCardBody } from '../src/components/editor-prototype/collectionMdx.ts';
import { splitBody, moveBodySegment } from '../src/components/editor-prototype/bodySegments.ts';

test('chip text preserves commas, quotes, entity text, braces, Unicode and newlines as literal values', () => {
  const items = ['Lincoln, Nebraska', 'A "quote" & <literal> {expression}', '&quot; is text', '地図 🗺️', 'First\nsecond', ''];
  const raw = createCollectionMdx('chipList', items);
  assert.deepEqual(parseCollectionMdx(raw).data, items);
  assert.equal(updateCollectionMdx(raw, items), raw);
  assert.equal(splitBody(raw)[0].kind, 'structured');
  const updated = updateCollectionMdx(raw, [...items].reverse());
  assert.deepEqual(parseCollectionMdx(updated).data, [...items].reverse());
});

test('card grids preserve titled rich Markdown, arbitrary literal titles, and unchanged source', () => {
  const cards = [{ title: 'Maps & <b>literal</b> {title}', body: '**Bold** and *italic* with a [link](https://example.com/maps).\n\n- First\n- Second\n\n1. Third\n2. Fourth' }, { title: 'Another card', body: '```text\nLiteral <code> {value}\n```' }];
  const raw = `\r\n${createCollectionMdx('cardGrid', cards)}\r\n`;
  assert.deepEqual(parseCollectionMdx(raw).data, cards);
  assert.equal(updateCollectionMdx(raw, cards), raw);
  assert.equal(splitBody(raw).find(segment => segment.content.trim()).kind, 'structured');
  const next = [{ ...cards[0], title: 'Revised title' }, cards[1]];
  const updated = updateCollectionMdx(raw, next);
  assert.deepEqual(parseCollectionMdx(updated).data, next);
  assert.ok(updated.startsWith('\r\n') && updated.endsWith('\r\n'));
});

test('unfamiliar markup, extra fields, HTML, images and tables remain protected without losing source', () => {
  for (const source of [
    '<ChipList>\n- Legacy\n</ChipList>', '<CardGrid>\n<Card title="Legacy">Content.</Card>\n</CardGrid>',
    '<CmsChipList items={getTerms()} />', '<CmsChipList items="[]" class="custom" />',
    createCollectionMdx('cardGrid', [{ title: 'Keep extra data', body: 'Body', extra: true }]),
    ...['<SpecialComponent />', '<b>Custom HTML</b>', '![Map](@images/map.png)', '| A | B |\n| --- | --- |\n| 1 | 2 |', '- [x] Task'].map(body => createCollectionMdx('cardGrid', [{ title: 'Unsupported body', body }])),
  ]) {
    assert.equal(parseCollectionMdx(source), null, source);
    const segments = splitBody(source);
    assert.equal(segments[0].kind, 'protected', source);
    assert.equal(segments.map(segment => segment.content).join(''), source);
  }
  assert.equal(supportedCardBody('Escaped \\<literal> and `{expression}`.'), true);
});

test('new component imports are added once, retain legacy imports, ignore fenced examples and reject conflicts', () => {
  const legacy = "import ChipList from 'src/components/ChipList.astro';\nimport { Card, CardGrid } from '@astrojs/starlight/components';\n\n<ChipList>\n- Preserve\n</ChipList>\n";
  for (const [kind, config] of Object.entries(COLLECTION_BLOCKS)) {
    const first = ensureCollectionImport(legacy, kind);
    assert.equal(first.added, true);
    for (const line of legacy.split('\n').filter(Boolean)) assert.ok(first.content.includes(line));
    assert.ok(first.content.includes(`import ${config.binding} from '${config.path}';`));
    assert.equal(ensureCollectionImport(first.content, kind).content, first.content);
    assert.ok(ensureCollectionImport(`import ${config.binding} from './Other.astro';\n`, kind).error);
    assert.ok(ensureCollectionImport(`export const ${config.binding} = 1;\n`, kind).error);
    const fenced = `\`\`\`mdx\nimport ${config.binding} from '${config.path}';\n\`\`\`\n`;
    assert.equal(ensureCollectionImport(fenced, kind).added, true);
    assert.equal(splitBody(`\`\`\`mdx\n${createCollectionMdx(kind, [])}\n\`\`\``)[0].kind, 'markdown');
  }
});

test('collection blocks move as complete editable blocks without crossing protected layouts', () => {
  const chips = createCollectionMdx('chipList', ['One', 'Two']);
  const grid = createCollectionMdx('cardGrid', [{ title: 'Report', body: '- A formatted update' }]);
  const source = `<Unknown />\n\nParagraph.\n\n${chips}\n\n${grid}\n`;
  const segments = splitBody(source);
  const card = segments.find(segment => segment.content.includes('<CmsCardGrid'));
  const moved = moveBodySegment(segments, card.id, -1);
  assert.ok(moved.map(segment => segment.content).join('').indexOf(grid) < moved.map(segment => segment.content).join('').indexOf(chips));
  assert.equal(moved[0].content, '<Unknown />\n');
});
