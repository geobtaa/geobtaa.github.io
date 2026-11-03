import assert from 'node:assert/strict';
import test from 'node:test';
import { moveBodySegment, splitBody, visibleBodySegments } from '../src/components/editor-prototype/bodySegments.ts';

const source = `import X from './X';

First

<LinkCard title="Catalog" href="/catalog/" />

Last`;

test('moves preserve IDs and content, skip separators, and keep protected code verbatim', () => {
  const segments = splitBody(source);
  const card = segments.find(segment => segment.kind === 'structured');
  const moved = moveBodySegment(segments, card.id, -1);
  assert.deepEqual(visibleBodySegments(moved).map(segment => segment.id), [0, card.id, 1, 3]);
  assert.equal(moved[0], segments[0]);
  assert.match(moved.map(segment => segment.content).join(''), /href="\/catalog\/" \/>\n\nFirst\n{2,}Last/);
  assert.equal(segments.map(segment => segment.content).join(''), source);
  const restored = moveBodySegment(moved, card.id, 1);
  assert.deepEqual(visibleBodySegments(restored).map(segment => segment.id), visibleBodySegments(segments).map(segment => segment.id));
});

test('moves stop at protected blocks, boundaries, and invalid IDs', () => {
  const segments = splitBody(source);
  for (const [id, direction] of [[0, 1], [1, -1], [3, 1], [999, -1]]) {
    assert.equal(moveBodySegment(segments, id, direction), segments);
  }
  const anchored = splitBody('Before\n\n<Unknown />\n\nAfter');
  assert.equal(moveBodySegment(anchored, 0, 1), anchored);
  assert.equal(moveBodySegment(anchored, 2, -1), anchored);
});

test('separators are not move targets, and a newly added empty text block can move', () => {
  const segments = splitBody('<LinkCard title="A" href="/a" />\n\n<LinkCard title="B" href="/b" />');
  const moved = moveBodySegment(segments, 2, -1);
  assert.deepEqual(visibleBodySegments(moved).map(segment => segment.id), [2, 0]);
  const empty = { id: 3, kind: 'markdown', content: '' };
  const withEmpty = [...segments, empty];
  assert.equal(moveBodySegment(withEmpty, 3, -1), withEmpty);
  assert.equal(visibleBodySegments(moveBodySegment(withEmpty, 3, -1, 3), 3)[1].id, 3);
});

test('moves retain CRLF line endings and separate blocks at the start and end', () => {
  const segments = splitBody('First\r\n\r\n<LinkCard title="A" href="/a" />');
  const body = moveBodySegment(segments, 1, -1).map(segment => segment.content).join('');
  assert.match(body, /\/>\r\n\r\nFirst/);
  assert.doesNotMatch(body, /(?<!\r)\n/);
});
