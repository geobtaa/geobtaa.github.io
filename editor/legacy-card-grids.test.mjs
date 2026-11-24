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
    grid.replace('A [link](/maps).', '### Heading'), grid.replace('A [link](/maps).', '\tIndented paragraph'),
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

test('the compatible grid and standalone card inventory stays explicit; higher-risk cards stay protected', async () => {
  const expected = new Set([
    'updates/2023-12.mdx', 'updates/2024-01.mdx', 'updates/2024-02.mdx', 'updates/2024-03.mdx',
    'updates/2024-09.mdx', 'updates/2024-10.mdx', 'updates/2024-11.mdx', 'updates/2024-12.mdx',
    'updates/2025-01.mdx', 'updates/2025-02.mdx', 'updates/2025-03.mdx', 'updates/2025-04.mdx',
    'updates/2025-07.mdx', 'updates/2025-08.mdx', 'updates/2025-09.mdx', 'updates/2025-10.mdx',
    'updates/2025-12-04-november-2025-program-highlights.mdx', 'updates/2026-01-05-december-2025-program-update.mdx',
  ]);
  for (const month of ['04', '05', '06', '07']) expected.add(`updates/2024-${month}.mdx`);
  const standaloneExpected = new Map([
    ['updates/2025-12-04-november-2025-program-highlights.mdx', 2],
    ['updates/2026-01-05-december-2025-program-update.mdx', 2],
    ...['2024-09', '2024-10', '2025-01', '2025-02', '2025-03', '2025-04', '2025-05', '2025-06', '2025-07', '2025-08', '2025-09', '2025-10'].map(month => [`updates/${month}.mdx`, 1]),
    ['library/geodata-collection-implementation-plan.mdx', 3],
  ]);
  let grids = 0, cards = 0, standalone = 0, allGrids = 0;
  for await (const file of glob('src/content/docs/**/*.{md,mdx}')) {
    const body = parseContent(await readFile(file, 'utf8')).body;
    const format = file.endsWith('.md') ? 'md' : 'mdx';
    const segments = splitBody(body, { format });
    assert.equal(segments.map(s => s.content).join(''), body);
    const visit = node => { if (node.name === 'CardGrid') allGrids++; node.children?.forEach(visit); };
    visit(parseBodySyntax(body, format));
    for (const segment of segments.filter(s => s.legacyCardGrid)) {
      const parsed = parseLegacyCardGrid(segment.content);
      const path = file.replace('src/content/docs/', '');
      if (parsed.standalone) {
        assert.ok(standaloneExpected.get(path) > 0, file);
        standaloneExpected.set(path, standaloneExpected.get(path) - 1);
        standalone++;
      } else {
        assert.ok(expected.delete(path), file);
        grids++;
      }
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
      cards += data.length;
    }
  }
  assert.equal(grids, 22); assert.equal(standalone, 19); assert.equal(cards, 111); assert.equal(allGrids, 38); assert.equal(expected.size, 0);
  assert.ok([...standaloneExpected.values()].every(count => count === 0));
});

test('single leading Markdown headings expose a label without creating a title attribute', async () => {
  const source = '<Card>\n\n####  TECHnology\n\n* First item\n\n* Second item\n\n</Card>\n';
  for (const raw of [source, source.replace(/\n/g, '\r\n'), '<CardGrid>\n' + source + '</CardGrid>\n']) {
    const parsed = parseLegacyCardGrid(raw);
    assert.ok(parsed);
    assert.equal(parsed.cards[0].heading, true);
    assert.equal(parsed.cards[0].title, 'TECHnology');
    assert.equal(parseBodySyntax(parsed.cards[0].body).children[0].type, 'list');
    assert.equal(updateLegacyCardGrid(raw, fields(parsed)), raw);
    assert.equal(splitBody(raw)[0].legacyCardGrid, true);
    assert.equal(matchLegacyCardGrid(raw + '\nAfter'), raw);
    const card = parsed.cards[0];
    for (const title of ['Updated heading', '<script>literal</script> & {value} [reference] # *text*', '', 'Restored']) {
      const changed = updateLegacyCardGrid(raw, [{ title, body: card.body }]);
      const reopened = parseLegacyCardGrid(changed);
      assert.ok(reopened, changed);
      assert.equal(reopened.cards[0].title, title);
      assert.deepEqual(reopened.protectedParts, parsed.protectedParts);
      assert.equal(changed.slice(reopened.cards[0].bodyStart, reopened.cards[0].bodyEnd), raw.slice(card.bodyStart, card.bodyEnd));
      assert.ok(!changed.includes('title='));
      await validateDocument(document(changed), { originalBody: raw });
    }
    const changed = updateLegacyCardGrid(raw, [{ title: card.title, body: card.body.replace('First', 'Revised') }]);
    const reopened = parseLegacyCardGrid(changed);
    assert.equal(changed.slice(0, reopened.cards[0].bodyStart), raw.slice(0, card.bodyStart), 'body edit leaves the heading source exact');
    await validateDocument(document(changed), { originalBody: raw });
    const empty = updateLegacyCardGrid(raw, [{ title: '', body: card.body }]);
    const refilled = updateLegacyCardGrid(empty, [{ title: 'Refilled', body: 'New body.' }]);
    assert.deepEqual(fields(parseLegacyCardGrid(refilled)), [{ title: 'Refilled', body: 'New body.' }]);
    await validateDocument(document(refilled), { originalBody: raw });
    for (const invalid of [raw.replace('####', '###'), raw.replace('####  TECHnology', '####  **TECHnology**'), raw.replace('* First item', '### Another heading')]) {
      await assert.rejects(validateDocument(document(invalid), { originalBody: raw }), /read-only content/);
    }
    assert.equal(splitBody(raw, { format: 'md' })[0].legacyCardGrid, undefined);
  }
  for (const body of ['Text\n\n#### Heading', '#### **Rich**', '### Other level', '#### Heading ###', '#### [reference]', '#### Heading\n\n![Image](/image.png)', '#### Heading\n\n{expression}']) {
    assert.equal(parseLegacyCardGrid(`<Card>\n${body}\n</Card>`), null, body);
  }
});


test('multiple body headings and standalone literal-title cards retain supported structure and reject unsafe edits', async () => {
  const raw = '<Card>\n\n#### First\n\n- First item\n\n#### Second\n\nA paragraph.\n\n#### Third\n\n- Another item\n\n</Card>\n';
  const titled = raw.replace('<Card>', '<Card title="Workgroups">');
  for (const source of [raw, raw.replace(/\n/g, '\r\n'), titled, '<CardGrid>\n' + raw + titled + '</CardGrid>\n']) {
    const parsed = parseLegacyCardGrid(source);
    assert.ok(parsed);
    assert.equal(updateLegacyCardGrid(source, fields(parsed)), source);
    assert.equal(parseCollectionMdx(source).kind, 'cardGrid');
    const changed = updateLegacyCardGrid(source, fields(parsed).map(card => ({ ...card, body: card.body.replace('#### Second', '#### Revised **section**').replace('A paragraph.', 'A [link](https://example.com).') })));
    const reopened = parseLegacyCardGrid(changed);
    assert.ok(reopened);
    assert.deepEqual(reopened.protectedParts, parsed.protectedParts);
    const headings = parseBodySyntax(reopened.cards[0].body).children.filter(n => n.type === 'heading');
    assert.deepEqual(headings.map(n => n.depth), parsed.cards[0].heading ? [4, 4] : [4, 4, 4]);
    await validateDocument(document(changed), { originalBody: source });
    for (const replacement of ['### Second', '## Second', '<h4>Second</h4>', '#### {expression}', '#### [external]', '#### ![Image](/image.png)']) {
      const unsafe = source.replace('#### Second', replacement);
      assert.equal(parseLegacyCardGrid(unsafe), null, replacement);
      await assert.rejects(validateDocument(document(unsafe), { originalBody: source }), /read-only content/);
    }
    for (const unsafe of [source.replace(/<Card(?=[ >])/, '<Card icon="star"'), '<div>\n' + source + '\n</div>']) {
      await assert.rejects(validateDocument(document(unsafe), { originalBody: source }), /read-only content/);
    }
  }
  // These bodies contain tabs with different MDX and standalone Markdown
  // interpretations. Adding heading support must not normalize them silently.
  for (const file of ['2024-11.mdx', '2024-12.mdx']) {
    const body = parseContent(await readFile('src/content/docs/updates/' + file, 'utf8')).body;
    const standalone = parseBodySyntax(body).children.find(n => n.name === 'Card');
    assert.equal(parseLegacyCardGrid(body.slice(standalone.position.start.offset, standalone.position.end.offset)), null);
  }
});
