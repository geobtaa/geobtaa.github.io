import assert from 'node:assert/strict';
import test from 'node:test';
import { glob, readFile } from 'node:fs/promises';
import { parseDirectiveCallout, updateDirectiveCallout, matchDirectiveCallout } from '../src/components/editor/directiveCallout.ts';
import { parseBodySyntax } from '../src/components/editor/contentSyntax.ts';
import { splitBody } from '../src/components/editor/bodySegments.ts';
import { parseContent } from './content.mjs';
import { validateDocument } from './validateDocument.mjs';

const document = body => `---\ntitle: Callouts\n---\n\n${body}`;
const aliases = { note: 'note', info: 'note', tip: 'tip', caution: 'caution', warning: 'caution', Caution: 'caution', danger: 'danger' };

test('directive aliases share canonical types, preserve untouched bytes, and consolidate only on edit', async () => {
  for (const [alias, type] of Object.entries(aliases)) {
    const raw = `  ::::${alias}[Title &amp; details]  \r\n\r\nA **bold** [link](/maps).\r\n\r\n- First\r\n- Second\r\n\r\n::::  \r\n`;
    const parsed = parseDirectiveCallout(raw);
    assert.ok(parsed, alias);
    assert.equal(parsed.fields.type, type);
    assert.equal(parsed.fields.title, 'Title & details');
    assert.equal(updateDirectiveCallout(raw, parsed.fields), raw);
    const changed = updateDirectiveCallout(raw, { ...parsed.fields, title: 'Changed [title] {literal}' });
    assert.ok(changed.startsWith(`  ::::${type}[`));
    assert.ok(changed.includes('\r\n\r\nA **bold** [link](/maps).\r\n\r\n- First\r\n- Second\r\n\r\n'));
    assert.ok(changed.endsWith('::::  \r\n'));
    assert.equal(parseDirectiveCallout(changed).fields.title, 'Changed [title] {literal}');
    for (const format of ['md', 'mdx']) {
      assert.equal(splitBody(raw, { format })[0].kind, 'structured');
      await validateDocument(document(changed), { filename: `callouts.${format}`, originalBody: raw });
    }
  }
});

test('title-only and multi-paragraph callouts preserve paragraph structure and default titles', () => {
  for (const raw of [':::note\n:::\n', ':::note[Updated]\n:::\n', ':::tip\nFirst.\n\nSecond.\n:::\n']) {
    const parsed = parseDirectiveCallout(raw);
    assert.ok(parsed);
    const changed = updateDirectiveCallout(raw, { ...parsed.fields, type: 'danger' });
    assert.equal(parseDirectiveCallout(changed).fields.text, parsed.fields.text);
    assert.equal(parseDirectiveCallout(changed).fields.title, parsed.fields.title);
  }
  const indentedClose = ':::info\n  Keep the body.\n   :::::  \n';
  const changed = updateDirectiveCallout(indentedClose, { ...parseDirectiveCallout(indentedClose).fields, title: 'New title' });
  assert.ok(changed.endsWith('\n  Keep the body.\n   :::::  \n'));
});

test('edited bodies retain rich Markdown and cannot close their containing directive with colon fences', async () => {
  const raw = ':::note\nOriginal.\n:::\n';
  const text = 'First **paragraph**.\n\n- [Link](/maps)\n- Second\n\n```text\n:::\n```';
  const changed = updateDirectiveCallout(raw, { ...parseDirectiveCallout(raw).fields, text });
  assert.ok(changed.startsWith('::::note\n'));
  assert.equal(parseDirectiveCallout(changed).fields.text, text);
  await validateDocument(document(changed), { originalBody: raw });
});

test('unknown directives, custom attributes, rich titles, unsupported children and unclosed blocks stay protected', async () => {
  for (const raw of [
    ':::custom\nText\n:::', ':::NOTE\nText\n:::', ':::note{icon="star"}\nText\n:::',
    ':::note[**Rich title**]\nText\n:::', ':::note\nUnclosed',
    '::::note\n```text\n:::', ':::note\n```js title="Metadata"\nexample\n```\n:::',
    ':::note\n<Component value={expression} />\n:::', ':::note\n{expression}\n:::',
    ":::note\nimport Thing from './thing.js';\n:::",
    ':::note\n![Image](/map.png)\n:::', ':::note\n| A | B |\n| - | - |\n| 1 | 2 |\n:::',
    ':::note\n- [x] Checked\n:::', ':::note\nFootnote[^1]\n\n[^1]: Definition\n:::',
    ':::note\n[Reference][ref]\n\n[ref]: /maps\n:::',
    '::::note\n:::tip\nNested\n:::\n::::',
  ]) {
    assert.equal(parseDirectiveCallout(raw), null, raw);
    assert.ok(splitBody(raw).every(segment => segment.kind === 'protected'), raw);
    await assert.rejects(validateDocument(document(raw)), /unsupported|Invalid/);
  }
  const nested = '<Layout>\n:::note\nKeep this wrapper.\n:::\n</Layout>\n';
  assert.equal(splitBody(nested)[0].kind, 'protected');
  const ordinary = 'At 10:30, the ratio is 11.68:1.';
  assert.equal(parseDirectiveCallout(ordinary), null);
  assert.equal(splitBody(ordinary)[0].kind, 'protected', 'bare colon text is outside this change');
});

test('matching keeps adjacent callouts and following text separate and never consumes an implicit EOF close', () => {
  const first = ':::note\nFirst.\n:::\n';
  const second = ':::info\nSecond.\n:::\n';
  assert.equal(matchDirectiveCallout(`${first}\n${second}\nAfter.`), first);
  assert.equal(matchDirectiveCallout(':::note\nUnclosed'), null);
  assert.deepEqual(splitBody(`${first}\n${second}\nAfter.`).filter(s => s.content.trim()).map(s => s.kind), ['structured', 'structured', 'markdown']);
  assert.equal(splitBody('```md\n:::note\nExample\n:::\n```')[0].kind, 'markdown');
  assert.equal(splitBody('    :::note\n    An indented code example.\n    :::', { format: 'md' })[0].kind, 'markdown');
});

test('all existing recognized callout contents parse without losing source; protected neighbors stay enforced', async () => {
  let count = 0;
  for await (const file of glob('src/content/docs/**/*.{md,mdx}')) {
    const body = parseContent(await readFile(file, 'utf8')).body;
    const format = file.endsWith('.md') ? 'md' : 'mdx';
    const visit = (node, depth = 0) => {
      if (node.type === 'containerDirective' && Object.hasOwn(aliases, node.name)) {
        const raw = body.slice(node.position.start.offset, node.position.end.offset);
        const parsed = parseDirectiveCallout(raw);
        // List/JSX indentation belongs to its protected ancestor, not a standalone directive.
        if (depth === 1) assert.ok(parsed, `${file}: ${raw}`);
        if (parsed) assert.equal(updateDirectiveCallout(raw, parsed.fields), raw);
        count++;
      }
      node.children?.forEach(child => visit(child, depth + 1));
    };
    visit(parseBodySyntax(body, format));
    assert.equal(splitBody(body, { format }).map(s => s.content).join(''), body);
  }
  assert.ok(count >= 93, 'exercise the existing callout corpus');
  const protectedSource = "import Layout from './Layout.astro';\n\n<Layout dynamic={value}>Keep</Layout>\n";
  const callout = ':::warning\nA [link](/maps).\n:::\n';
  const changed = updateDirectiveCallout(callout, { ...parseDirectiveCallout(callout).fields, title: 'Changed' });
  await validateDocument(document(protectedSource + '\n' + changed), { originalBody: protectedSource + '\n' + callout });
  await assert.rejects(validateDocument(document(protectedSource.replace('Keep', 'Lost') + '\n' + changed), { originalBody: protectedSource + '\n' + callout }), /read-only content/);
});
