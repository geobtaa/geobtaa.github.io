import assert from 'node:assert/strict';
import test from 'node:test';
import { glob, readFile } from 'node:fs/promises';
import { parseLegacyChipList, updateLegacyChipList, matchLegacyChipList } from '../src/components/editor/legacyChipList.ts';
import { parseCollectionMdx, updateCollectionMdx } from '../src/components/editor/collectionMdx.ts';
import { splitBody, moveBodySegment } from '../src/components/editor/bodySegments.ts';
import { parseContent } from './content.mjs';
import { validateDocument } from './validateDocument.mjs';

const chipList = '<ChipList class = \'not-content custom\'>\n\n- First\n- Second\n\n</ChipList>\n';
const nested = `<div class="grid cards" markdown>\n\n## Keep heading\n${chipList}\n<Custom data={expression}>Keep opaque sibling</Custom>\n</div>\n`;
const document = body => `---\ntitle: Chip lists\n---\n\n${body}`;

test('legacy plain ChipLists use collection fields and preserve exact source until edited', () => {
  for (const raw of [chipList, nested, chipList.replace(/\n/g, '\r\n')]) {
    const parsed = parseCollectionMdx(raw);
    assert.equal(parsed.kind, 'chipList');
    assert.deepEqual(parsed.data, ['First', 'Second']);
    assert.equal(updateCollectionMdx(raw, parsed.data), raw);
    const segments = splitBody(raw);
    assert.equal(segments.length, 1);
    assert.equal(segments[0].legacyChipList, true);
    assert.equal(segments[0].kind, 'protected', 'component and layout remain anchored');
    assert.equal(segments[0].content, raw);
    assert.equal(moveBodySegment(segments, segments[0].id, 1), segments);
  }
});

test('add, reorder, remove, clear and refill keep labels literal and component/layout source immutable', async () => {
  const labels = ['Lincoln, Nebraska', 'A "quote" & <tag> {expression}', '&amp; stays literal', '地図 🗺️', '**bold** :note[label] - [x]', 'First\nsecond', '', ' '];
  for (const original of [chipList, nested, chipList.replace(/\n/g, '\r\n')]) {
    let raw = original;
    for (const items of [labels, [...labels].reverse(), ['One remaining'], [], [''], ['Refilled']]) {
      raw = updateLegacyChipList(raw, items);
      assert.deepEqual(parseLegacyChipList(raw)?.items, items);
      assert.deepEqual(parseLegacyChipList(raw)?.protectedParts, parseLegacyChipList(original).protectedParts);
      assert.equal(updateLegacyChipList(raw, items), raw);
      assert.ok(!raw.includes('CmsChipList'));
      if (original.includes('\r\n')) assert.ok(!/(?<!\r)\n/.test(raw));
      await validateDocument(document(raw), { originalBody: original });
    }
  }
});

test('tight/loose list structure and list markers are retained on edits', () => {
  for (const [marker, spread] of [['-', false], ['*', true], ['+', false]]) {
    const raw = `<ChipList>\n\t${marker} First${spread ? '\n' : ''}\n\t${marker} Second\n</ChipList>`;
    const parsed = parseLegacyChipList(raw);
    assert.equal(parsed.list.spread, spread);
    const updated = updateLegacyChipList(raw, ['First', 'Third', 'Last']);
    assert.deepEqual(parseLegacyChipList(updated).items, ['First', 'Third', 'Last']);
    assert.equal(parseLegacyChipList(updated).list.spread, spread);
    assert.ok(updated.includes(`\n\t${marker} Third`));
  }
});

test('rich content, tasks, references, expressions, custom props, and unknown wrappers remain protected', async () => {
  for (const raw of [
    '<ChipList dynamic={value}>\n- First\n</ChipList>', '<ChipList class="one" class="two">\n- First\n</ChipList>',
    '<ChipList class="one" id="custom">\n- First\n</ChipList>', '<ChipList>Plain paragraph</ChipList>',
    '<ChipList />', '<ChipList>\n1. Ordered\n</ChipList>',
    ...['**Bold**', '[Link](/maps)', '`Code`', '{value}', '<Custom />', '![Image](/map.png)', '10:30', '[x] Task', 'Parent\n  - Nested', 'Two  \n  lines'].map(item => `<ChipList>\n- ${item}\n</ChipList>`),
    '<ChipList>\n- [Link][ref]\n</ChipList>\n\n[ref]: /maps',
    `<Unknown>\n${chipList}\n</Unknown>`, `<div class={dynamic}>\n${chipList}\n</div>`,
    `<div>\n${chipList}\n${chipList}\n</div>`,
  ]) {
    assert.equal(parseLegacyChipList(raw), null, raw);
    assert.ok(splitBody(raw).every(s => !s.legacyChipList), raw);
    await assert.rejects(validateDocument(document(raw)), /unsupported|Invalid/);
  }
});

test('API protects imports, wrapper attributes, enclosing layouts and siblings while allowing item edits', async () => {
  const prefix = "import ChipList from 'src/components/ChipList.astro';\n\n";
  const original = prefix + nested;
  const edited = prefix + updateLegacyChipList(nested, ['New item']);
  await validateDocument(document(edited), { originalBody: original });
  for (const changed of [
    edited.replace('not-content custom', 'changed-class'), edited.replace('grid cards', 'different'),
    edited.replace('Keep heading', 'Changed heading'), edited.replace('Keep opaque sibling', 'Changed sibling'),
    edited.replace('{expression}', '{otherExpression}'), edited.replace("src/components/ChipList.astro", './Other.astro'),
    edited.replace(' markdown', ''), edited.replace(/<ChipList[\s\S]*?<\/ChipList>/, ''),
    '```mdx\n' + edited + '\n```', prefix + chipList,
  ]) await assert.rejects(validateDocument(document(changed), { originalBody: original }), /read-only content/);
  await assert.rejects(validateDocument(document(chipList)), /unsupported/);
  await assert.rejects(validateDocument(document(edited.replace('not-content custom', 'changed-class')), { filename: 'page.md', originalBody: original }), /component source must remain unchanged|read-only content/);
});

test('matching isolates adjacent lists; fenced and indented examples remain ordinary code', () => {
  assert.equal(matchLegacyChipList(chipList + '\n' + chipList), chipList);
  assert.equal(splitBody(chipList + '\n' + chipList).filter(s => s.legacyChipList).length, 2);
  assert.equal(splitBody('```mdx\n' + chipList + '\n```')[0].kind, 'markdown');
  assert.equal(splitBody(chipList.split('\n').map(line => '    ' + line).join('\n'), { format: 'md' })[0].kind, 'markdown');
  assert.ok(splitBody(chipList, { format: 'md' }).every(s => !s.legacyChipList));
});

test('all 32 existing ChipLists across 21 pages edit without changing protected source', async () => {
  let count = 0;
  const pages = new Set();
  for await (const file of glob('src/content/docs/**/*.{md,mdx}')) {
    const body = parseContent(await readFile(file, 'utf8')).body;
    const format = file.endsWith('.md') ? 'md' : 'mdx';
    const segments = splitBody(body, { format });
    assert.equal(segments.map(s => s.content).join(''), body);
    for (const segment of segments.filter(s => s.legacyChipList)) {
      const parsed = parseLegacyChipList(segment.content);
      assert.equal(updateLegacyChipList(segment.content, parsed.items), segment.content);
      const revised = updateLegacyChipList(segment.content, [...parsed.items.slice(1), 'Edited <literal> {text}']);
      assert.deepEqual(parseLegacyChipList(revised).protectedParts, parsed.protectedParts);
      await validateDocument(document(segments.map(s => s === segment ? revised : s.content).join('')), { filename: file, originalBody: body });
      count++;
      pages.add(file);
    }
  }
  assert.equal(count, 32);
  assert.equal(pages.size, 21);
});
