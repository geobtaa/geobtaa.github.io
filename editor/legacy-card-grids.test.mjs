import assert from 'node:assert/strict';
import test from 'node:test';
import { glob, readFile } from 'node:fs/promises';
import { parseLegacyCardGrid, updateLegacyCardGrid, matchLegacyCardGrid } from '../src/components/editor/legacyCardGrid.ts';
import { parseCollectionMdx, updateCollectionMdx } from '../src/components/editor/collectionMdx.ts';
import { parseBodySyntax } from '../src/components/editor/contentSyntax.ts';
import { splitBody, moveBodySegment } from '../src/components/editor/bodySegments.ts';
import { parseContent } from './content.mjs';
import { validateDocument } from './validateDocument.mjs';

const grid = '<CardGrid>\n<Card title = \'First &amp; title\'>\n\n- First item\n\n- Second **bold** item\n\n</Card>\n<Card title="Second">\nA [link](/maps).\n</Card>\n</CardGrid>\n';
const document = body => `---\ntitle: Cards\n---\n\n${body}`;
const fields = parsed => parsed.cards.map(({ title, body }) => ({ title, body }));

test('lower-risk CardGrids expose collection fields and preserve exact source until edited', () => {
  for (const raw of [grid, grid.replace(/\n/g, '\r\n')]) {
    const parsed = parseLegacyCardGrid(raw);
    assert.ok(parsed);
    assert.equal(parsed.cards[0].title, 'First & title');
    assert.equal(parseCollectionMdx(raw).kind, 'cardGrid');
    assert.equal(updateCollectionMdx(raw, fields(parsed)), raw);
    const segments = splitBody(raw);
    assert.equal(segments.length, 1);
    assert.equal(segments[0].legacyCardGrid, true);
    assert.equal(segments[0].kind, 'protected');
    assert.equal(moveBodySegment(segments, 0, 1), segments);
    assert.equal(matchLegacyCardGrid(raw + '\nAfter'), raw);
  }
});

test('title/body edits and content reorder preserve wrapper fragments, quotes and line endings', async () => {
  for (const raw of [grid, grid.replace(/\n/g, '\r\n')]) {
    const parsed = parseLegacyCardGrid(raw), cards = fields(parsed);
    const changed = updateLegacyCardGrid(raw, [{ ...cards[0], title: 'A <literal> & "quote" {title}', body: cards[0].body.replace('First item', 'Revised item') }, cards[1]]);
    const reopened = parseLegacyCardGrid(changed);
    assert.deepEqual(reopened.protectedParts, parsed.protectedParts);
    assert.equal(reopened.cards[0].title, 'A <literal> & "quote" {title}');
    assert.ok(changed.includes('title = \''));
    if (raw.includes('\r\n')) assert.ok(!/(?<!\r)\n/.test(changed));
    await validateDocument(document(changed), { originalBody: raw });
    const reordered = updateLegacyCardGrid(raw, [...cards].reverse());
    assert.deepEqual(fields(parseLegacyCardGrid(reordered)), [...cards].reverse());
    await validateDocument(document(reordered), { originalBody: raw });
    const blank = updateLegacyCardGrid(raw, cards.map(() => ({ title: '', body: '' })));
    assert.equal(parseLegacyCardGrid(blank).cards.length, cards.length);
    await validateDocument(document(blank), { originalBody: raw });
  }
});

test('higher-risk syntax, unresolved indentation, missing titles and custom grid props stay protected', async () => {
  for (const raw of [
    grid.replace('<CardGrid>', '<CardGrid stagger>'), grid.replace('title="Second"', 'title="Second" icon="star"'),
    grid.replace('title="Second"', 'title={expression}'), grid.replace('title="Second"', ''),
    grid.replace('title="Second"', 'title=\'<a href="/">Rich title</a>\''),
    grid.replace('A [link](/maps).', '#### Heading'), grid.replace('A [link](/maps).', '\tIndented paragraph'),
    ...['![Image](/map.png)', '<Icon name="star" />', '<div class="compact-list">Text</div>', '{expression}', '| A | B |\n| - | - |\n| 1 | 2 |', '- [x] Task', '[external-reference]', '```js title="Meta"\ncode\n```'].map(body => grid.replace('A [link](/maps).', body)),
    '<CardGrid>\n' + grid + '\n</CardGrid>', '<div>\n' + grid + '\n</div>',
  ]) {
    assert.equal(parseLegacyCardGrid(raw), null, raw);
    assert.ok(splitBody(raw).every(segment => !segment.legacyCardGrid));
    await assert.rejects(validateDocument(document(raw)), /unsupported|Invalid/);
  }
});

test('common space indentation is normalized in memory and untouched bodies stay byte-exact', async () => {
  const indented = '<CardGrid>\n  <Card title="List">\n    - First\n    - Second\n  </Card>\n  <Card title="Paragraph">\n    A paragraph with **formatting**.\n  </Card>\n</CardGrid>\n';
  for (const raw of [indented, indented.replace(/\n/g, '\r\n')]) {
    const parsed = parseLegacyCardGrid(raw), data = fields(parsed);
    assert.ok(parsed);
    assert.equal(parseBodySyntax(data[0].body, 'md').children[0].type, 'list');
    assert.equal(parseBodySyntax(data[1].body, 'md').children[0].type, 'paragraph');
    assert.equal(updateLegacyCardGrid(raw, data), raw);
    const titleOnly = updateLegacyCardGrid(raw, [{ ...data[0], title: 'Renamed' }, data[1]]);
    const titleParsed = parseLegacyCardGrid(titleOnly);
    parsed.cards.forEach((card, index) => {
      const next = titleParsed.cards[index];
      assert.equal(titleOnly.slice(next.bodyStart, next.bodyEnd), raw.slice(card.bodyStart, card.bodyEnd), 'title changes cannot normalize body source');
    });
    const changed = updateLegacyCardGrid(raw, [{ ...data[0], body: data[0].body.replace('First', 'Revised') }, data[1]]);
    const reopened = parseLegacyCardGrid(changed);
    assert.deepEqual(reopened.protectedParts, parsed.protectedParts);
    assert.equal(changed.slice(reopened.cards[1].bodyStart, reopened.cards[1].bodyEnd), raw.slice(parsed.cards[1].bodyStart, parsed.cards[1].bodyEnd));
    assert.match(reopened.cards[0].body, /- Revised/);
    await validateDocument(document(changed), { originalBody: raw });
  }
});

test('API rejects tag, prop, context and card-count changes and new unsupported content', async () => {
  const prefix = "import { Card, CardGrid } from '@astrojs/starlight/components';\n\n";
  const originalBody = prefix + grid;
  const changed = updateLegacyCardGrid(grid, [{ ...fields(parseLegacyCardGrid(grid))[0], title: 'Revised' }, fields(parseLegacyCardGrid(grid))[1]]);
  await validateDocument(document(prefix + changed), { originalBody });
  for (const next of [
    changed.replace('<CardGrid>', '<CardGrid stagger>'), changed.replace('title = ', 'title='),
    changed.replace('<Card title="Second">', '<Card title="Second" class="new">'),
    changed.replace('A [link](/maps).', '{expression}'), changed.replace('A [link](/maps).', '## Heading'),
    changed.replace(/<Card title="Second">[\s\S]*?<\/Card>/, ''),
    changed.replace('</CardGrid>', '<Card title="Added">\nNew\n</Card>\n</CardGrid>'),
    '<div>\n' + changed + '\n</div>', '```mdx\n' + changed + '\n```',
  ]) await assert.rejects(validateDocument(document(prefix + next), { originalBody }), /read-only content/);
  await assert.rejects(validateDocument(document(prefix + grid.replace('title="Second"', 'title="Changed"')), { filename: 'page.md', originalBody }), /read-only content|component source must remain unchanged/);
  assert.equal(updateLegacyCardGrid(grid, []), grid);
});

test('the three original and fifteen safely normalizable grids are editable; higher-risk grids stay protected', async () => {
  const expected = new Set([
    'updates/2023-12.mdx', 'updates/2024-01.mdx', 'updates/2024-02.mdx', 'updates/2024-03.mdx',
    'updates/2024-09.mdx', 'updates/2024-10.mdx', 'updates/2024-11.mdx', 'updates/2024-12.mdx',
    'updates/2025-01.mdx', 'updates/2025-02.mdx', 'updates/2025-03.mdx', 'updates/2025-04.mdx',
    'updates/2025-07.mdx', 'updates/2025-08.mdx', 'updates/2025-09.mdx', 'updates/2025-10.mdx',
    'updates/2025-12-04-november-2025-program-highlights.mdx', 'updates/2026-01-05-december-2025-program-update.mdx',
  ]);
  let grids = 0, cards = 0, allGrids = 0;
  for await (const file of glob('src/content/docs/**/*.{md,mdx}')) {
    const body = parseContent(await readFile(file, 'utf8')).body;
    const format = file.endsWith('.md') ? 'md' : 'mdx';
    const segments = splitBody(body, { format });
    assert.equal(segments.map(s => s.content).join(''), body);
    const visit = node => { if (node.name === 'CardGrid') allGrids++; node.children?.forEach(visit); };
    visit(parseBodySyntax(body, format));
    for (const segment of segments.filter(s => s.legacyCardGrid)) {
      assert.ok(expected.delete(file.replace('src/content/docs/', '')), file);
      const parsed = parseLegacyCardGrid(segment.content);
      const data = fields(parsed);
      assert.equal(updateLegacyCardGrid(segment.content, data), segment.content);
      const edited = updateLegacyCardGrid(segment.content, data.map(c => ({ ...c, title: c.title + ' revised' })));
      const editedParsed = parseLegacyCardGrid(edited);
      parsed.cards.forEach((card, index) => {
        const next = editedParsed.cards[index];
        assert.equal(edited.slice(next.bodyStart, next.bodyEnd), segment.content.slice(card.bodyStart, card.bodyEnd));
      });
      await validateDocument(document(segments.map(s => s === segment ? edited : s.content).join('')), { filename: file, originalBody: body });
      const bodyEdit = updateLegacyCardGrid(segment.content, data.map((c, index) => index === 0 ? { ...c, body: c.body + '\n\nAdditional paragraph.' } : c));
      await validateDocument(document(segments.map(s => s === segment ? bodyEdit : s.content).join('')), { filename: file, originalBody: body });
      grids++; cards += data.length;
    }
  }
  assert.equal(grids, 18); assert.equal(cards, 72); assert.equal(allGrids, 38); assert.equal(expected.size, 0);
});
