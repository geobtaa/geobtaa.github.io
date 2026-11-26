import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { parseContent, serializeContent } from '../editor/content.mjs';
import { validateDocument } from '../editor/validateDocument.mjs';
import { splitBody } from '../src/components/editor/bodySegments.ts';
import { parseBodySyntax } from '../src/components/editor/contentSyntax.ts';
import { parseLinkButtonMdx } from '../src/components/editor/linkButtonMdx.ts';

const original = await readFile(new URL('../src/content/docs/conference/index.mdx', import.meta.url), 'utf8');
const page = parseContent(original);

test('Conference prose, headings, table, and lists are editable with the existing Editor parser', () => {
  const segments = splitBody(page.body);
  const tree = parseBodySyntax(page.body);
  const ordinary = tree.children.filter(node => ['heading', 'paragraph', 'table', 'list'].includes(node.type));
  assert.ok(ordinary.some(node => node.type === 'table'));
  assert.ok(ordinary.some(node => node.type === 'list'));
  for (const node of ordinary) {
    const raw = page.body.slice(node.position.start.offset, node.position.end.offset);
    if (parseLinkButtonMdx(raw)) continue;
    assert.ok(segments.some(segment => segment.kind === 'markdown' && segment.content.includes(raw)), `${node.type} must be editable`);
  }
  const setup = segments.filter(segment => segment.protectedType === 'setup');
  assert.ok(setup.some(segment => segment.content.includes('wrapper: ConferenceLanding')));
  const protectedContent = segments.filter(segment => segment.kind === 'protected' && segment.protectedType !== 'setup');
  assert.equal(protectedContent.length, 1);
  assert.equal(protectedContent[0].content.trim(), '<ConferenceArchiveLinks />');
  assert.ok(segments.some(segment => segment.kind === 'structured' && parseLinkButtonMdx(segment.content)?.text === 'Watch the 2026 recordings'));
});

test('existing save validation accepts paragraph, table, and list edits while preserving page setup', async () => {
  const changed = page.body
    .replace('Give a talk, enter the map gallery, or simply join the conversation.', 'Present your work, share a map, or join the conversation.')
    .replace('| Registration opens | To be announced |', '| Registration opens | March 1, 2027 |')
    .replace('- Agriculture and natural resources', '- Agriculture, conservation, and natural resources');
  const saved = serializeContent(original, { ...page, body: changed });
  await validateDocument(saved, { filename: 'index.mdx', originalBody: page.body });
  const protectedSource = body => splitBody(body).filter(segment => segment.kind === 'protected').map(segment => segment.content);
  assert.deepEqual(protectedSource(parseContent(saved).body), protectedSource(page.body));
  await assert.rejects(validateDocument(saved.replace('wrapper: ConferenceLanding', 'wrapper: DifferentLayout'), { filename: 'index.mdx', originalBody: page.body }), /read-only/);
});
