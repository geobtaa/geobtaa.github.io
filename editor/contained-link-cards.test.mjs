import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { parseContainedLinkCards, updateContainedLinkCard } from '../src/components/editor/containedLinkCards.ts';
import { splitBody, moveBodySegment } from '../src/components/editor/bodySegments.ts';
import { parseContent } from './content.mjs';
import { validateDocument } from './validateDocument.mjs';
import { validateComponentLinks } from './componentLinks.mjs';

const card = '<LinkCard title="Original" href="/maps/" />';
const layout = `<TwoThirdsLayout>\n<div slot="right">\n\n${card}\n\n<Custom expression={value}>Opaque</Custom>\n</div>\n<div slot="left">Keep **everything**.</div>\n</TwoThirdsLayout>\n`;
const document = body => `---\ntitle: Cards\n---\n\n${body}`;

test('all seven previously protected repository LinkCards expose fields without changing their layouts', async () => {
  let count = 0;
  for (const [file, expected] of [['guides/census.mdx', 6], ['conference/2026.mdx', 1]]) {
    const body = parseContent(await readFile(`src/content/docs/${file}`, 'utf8')).body;
    const segments = splitBody(body, { mergeProtected: false });
    assert.equal(segments.map(s => s.content).join(''), body);
    let pageCount = 0;
    for (const segment of segments.filter(s => s.containedLinkCards)) {
      assert.equal(segment.kind, 'protected');
      const parsed = parseContainedLinkCards(segment.content);
      for (const [index, card] of parsed.cards.entries()) {
        assert.equal(updateContainedLinkCard(segment.content, index, card.fields), segment.content);
        const updated = updateContainedLinkCard(segment.content, index, { ...card.fields, title: 'Edited <literal> {title}', description: 'New & useful' });
        assert.deepEqual(parseContainedLinkCards(updated).protectedParts, parsed.protectedParts);
        const changedBody = segments.map(s => s === segment ? updated : s.content).join('');
        await validateDocument(document(changedBody), { filename: file, originalBody: body });
        pageCount++;
      }
    }
    assert.equal(pageCount, expected, file);
    count += pageCount;
  }
  assert.equal(count, 7);
});

test('only card fields change, including optional descriptions and CRLF; layouts stay anchored', async () => {
  for (const newline of ['\n', '\r\n']) {
    const raw = layout.replace(/\n/g, newline);
    const original = parseContainedLinkCards(raw);
    const changed = updateContainedLinkCard(raw, 0, { title: 'Revised', href: '/new/', description: 'Added description' });
    assert.deepEqual(parseContainedLinkCards(changed).protectedParts, original.protectedParts);
    assert.equal(parseContainedLinkCards(changed).cards[0].fields.description, 'Added description');
    await validateDocument(document(changed), { originalBody: raw });
    const segments = splitBody(`Before${newline}${newline}${raw}${newline}After`);
    const nested = segments.find(s => s.containedLinkCards);
    assert.equal(moveBodySegment(segments, nested.id, -1), segments);
    assert.equal(moveBodySegment(segments, nested.id, 1), segments);
    const before = segments.find(s => s.content.includes('Before'));
    assert.equal(moveBodySegment(segments, before.id, 1), segments);
  }
});

test('server rejects modified wrappers, siblings, expressions, missing cards, extra cards, and new layouts', async () => {
  for (const changed of [
    layout.replace('slot="right"', 'slot="left"'), layout.replace('Keep **everything**.', 'Changed sibling'),
    layout.replace('{value}', '{differentValue}'), layout.replace('Opaque', 'Changed opaque child'),
    layout.replace(card, ''), layout.replace(card, `${card}\n${card}`),
    layout.replace(card, '<LinkCard title="New" href={executable} />'),
    layout.replace(card, '<LinkCard title="New" href="/maps" class="added" />'),
    `<Unknown>\n${layout}\n</Unknown>`, `\`\`\`mdx\n${layout}\n\`\`\``,
  ]) await assert.rejects(validateDocument(document(changed), { originalBody: layout }), /read-only content|unsupported/);
  await assert.rejects(validateDocument(document(layout)), /unsupported/);
  await assert.rejects(validateDocument(document(layout), { originalBody: '<Unknown />\n' }), /read-only content/);
  await assert.rejects(validateDocument(document(layout + '\n' + layout), { originalBody: layout }), /read-only content/);
});

test('only supported flow LinkCards on known literal layout paths become editable; Markdown stays protected', async () => {
  for (const raw of [
    `<Unknown>\n${card}\n</Unknown>`, `<div style={{ color: value }}>\n${card}\n</div>`,
    `<div onclick="handler()">\n${card}\n</div>`, `<div>\n<Unknown>\n${card}\n</Unknown>\n</div>`,
    '<div>\n<LinkCard title="T" href={value} />\n</div>',
    '<div>\n<LinkCard title="T" href="/" badge="New" />\n</div>',
    `\`\`\`mdx\n<div>\n${card}\n</div>\n\`\`\``,
  ]) assert.equal(parseContainedLinkCards(raw), null, raw);
  const grid = `<CardGrid>\n${card}\n${card}\n</CardGrid>`;
  assert.equal(parseContainedLinkCards(grid).cards.length, 2);
  assert.ok(splitBody(layout, { format: 'md' }).every(s => !s.containedLinkCards));
  const changed = updateContainedLinkCard(layout, 0, { title: 'Changed', href: '/', description: '' });
  await assert.rejects(validateDocument(document(changed), { filename: 'page.md', originalBody: layout }), /Existing component source must remain unchanged/);
});

test('adjacent protected imports/layouts remain separate and original protected ordering stays enforced', async () => {
  const first = `import X from './X';\n\n${layout}`;
  const segments = splitBody(first);
  assert.equal(segments.filter(s => s.containedLinkCards).length, 1);
  assert.equal(segments.map(s => s.content).join(''), first);
  const changed = updateContainedLinkCard(layout, 0, { title: 'New', href: '/', description: '' });
  await validateDocument(document(first.replace(layout, changed)), { originalBody: first });
  await assert.rejects(validateDocument(document(changed + "import X from './X';\n"), { originalBody: first }), /read-only content/);
});

test('editable contained links use the same URL safety policy as standalone LinkCards', () => {
  const changed = updateContainedLinkCard(layout, 0, { title: 'New', href: 'javascript:alert(1)', description: '' });
  assert.throws(() => validateComponentLinks(changed), /relative link/);
  assert.doesNotThrow(() => validateComponentLinks(layout));
});
