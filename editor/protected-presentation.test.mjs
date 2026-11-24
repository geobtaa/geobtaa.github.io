import assert from 'node:assert/strict';
import { glob, readFile } from 'node:fs/promises';
import test from 'node:test';
import { splitBody, moveBodySegment } from '../src/components/editor/bodySegments.ts';
import { parseContent } from './content.mjs';
import { validateDocument } from './validateDocument.mjs';

const document = body => `---\ntitle: Protected presentation\n---\n\n${body}`;

test('setup and adjacent content stay separate, in source order, with exact bytes', () => {
  const body = "import Widget from './Widget.astro';\nimport './effects.css';\n\nexport const items = ['One'];\n\n<Widget />\n<Other />\n\n<Layout>\n  <Nested />\n  {items.map(item => <Widget>{item}</Widget>)}\n</Layout>\n\nAfter.\n";
  for (const source of [body, body.replace(/\n/g, '\r\n')]) {
    const segments = splitBody(source);
    assert.equal(segments.map(s => s.content).join(''), source);
    assert.deepEqual(splitBody(source, { mergeProtected: true }), splitBody(source, { mergeProtected: false }));
    const setup = segments.filter(s => s.protectedType === 'setup');
    assert.equal(setup.length, 3);
    assert.deepEqual(setup.map(s => s.sourceLabel), ['Import: ./Widget.astro', 'Import: ./effects.css', 'Page code']);
    const content = segments.filter(s => s.protectedType === 'content');
    assert.equal(content.length, 3);
    assert.deepEqual(content.map(s => s.sourceLabel), ['Existing component or layout: Widget', 'Existing component or layout: Other', 'Existing component or layout: Layout']);
    assert.match(content[2].content, /<Nested \/>[\s\S]*items\.map/);
    assert.ok(segments.indexOf(setup.at(-1)) < segments.indexOf(content[0]));
  }
});

test('comments, exports, standalone expressions and scripts are setup; visible prose stays visible', () => {
  for (const source of [
    "import W from './W'; // keep this comment\nexport const n = 1;\n",
    '{/* Keep the comment */}', '{items.map(item => <Widget>{item}</Widget>)}',
    '<script>console.log("existing")</script>', "<style>{'.existing { color: red; }'}</style>",
  ]) {
    const segments = splitBody(source);
    assert.equal(segments.map(s => s.content).join(''), source);
    assert.ok(segments.filter(s => s.content.trim()).every(s => s.protectedType === 'setup'), source);
  }
  for (const source of ['Text with {expression}.', "const message = 'visible prose';", '```js\nimport X from "./X";\n```', '<Widget>{expression}</Widget>']) {
    assert.ok(splitBody(source).every(s => s.protectedType !== 'setup'), source);
  }
  const broken = "import X from './X';\n\n<Broken>";
  assert.deepEqual(splitBody(broken), [{ id: 0, kind: 'protected', content: broken, protectedType: 'uncertain', sourceLabel: 'Source could not be parsed' }]);
});

test('Markdown legacy imports are hidden only when the entire isolated source is page code', () => {
  const source = "import X from './X';\n\n<Widget />\n\nVisible text.";
  const segments = splitBody(source, { format: 'md' });
  assert.equal(segments.map(s => s.content).join(''), source);
  assert.equal(segments[0].protectedType, 'setup');
  assert.equal(segments.find(s => s.content.includes('<Widget')).protectedType, 'content');
  const mixed = "import X from './X';\nThis is visible prose.";
  assert.ok(splitBody(mixed, { format: 'md' }).every(s => s.protectedType !== 'setup'));
});

test('hidden setup remains a movement barrier and every protected source category stays immutable', async () => {
  const source = "Before.\n\nimport X from './X';\n\n<Widget />\n<Other />\n\nAfter.";
  const segments = splitBody(source);
  assert.equal(moveBodySegment(segments, segments[0].id, 1), segments);
  await validateDocument(document(source.replace('Before.', 'Edited text.')), { originalBody: source });
  for (const segment of segments.filter(s => s.kind === 'protected')) {
    await assert.rejects(validateDocument(document(source.replace(segment.content, '')), { originalBody: source }), /read-only content/);
    await assert.rejects(validateDocument(document(source.replace(segment.content, '```mdx\n' + segment.content + '\n```\n')), { originalBody: source }), /read-only content/);
  }
});

test('all repository pages retain exact source and every protected block has a presentation category', async () => {
  let pages = 0, protectedBlocks = 0;
  for await (const filename of glob('src/content/docs/**/*.{md,mdx}')) {
    const body = parseContent(await readFile(filename, 'utf8')).body;
    const segments = splitBody(body, { format: filename.endsWith('.md') ? 'md' : 'mdx' });
    assert.equal(segments.map(s => s.content).join(''), body, filename);
    for (const segment of segments.filter(s => s.kind === 'protected')) {
      assert.ok(['setup', 'content', 'uncertain'].includes(segment.protectedType), filename);
      assert.ok(segment.sourceLabel, filename);
      protectedBlocks++;
    }
    pages++;
  }
  assert.ok(pages > 100 && protectedBlocks > 100);
});
