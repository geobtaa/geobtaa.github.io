import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { glob } from 'node:fs/promises';
import { newProject, parseProject, serializeProject } from './content.mjs';

test('updates only managed frontmatter and preserves unrelated fields', () => {
  const original = `---\ntitle: Old\ndescription: 'Old description'\nsidebar:\n  order: 4\ntableOfContents: true\n---\n\nHello **world**.\n`;
  const saved = serializeProject(original, { title: 'New: title', description: 'New description', draft: true, body: 'Changed **words**.\n' });
  assert.match(saved, /sidebar:\n  order: 4\ntableOfContents: true/);
  assert.deepEqual(parseProject(saved), { title: 'New: title', description: 'New description', draft: true, body: 'Changed **words**.\n' });
});

test('does not reformat unchanged managed frontmatter', () => {
  const original = `---\ntitle: Plain title\ndescription: 'Single-quoted description'\ndraft: true\n---\n\nBody`;
  const saved = serializeProject(original, { ...parseProject(original), body: 'Edited body' });
  assert.match(saved, /title: Plain title\ndescription: 'Single-quoted description'\ndraft: true/);
});

test('creates a Markdown-compatible Project', () => {
  const saved = newProject({ title: 'Prototype', description: 'Test', draft: false, body: 'A [link](https://example.com).' });
  assert.deepEqual(parseProject(saved), { title: 'Prototype', description: 'Test', draft: false, body: 'A [link](https://example.com).' });
});

test('all existing Project bodies and unrelated frontmatter survive serialization', async () => {
  for await (const filename of glob('src/content/docs/projects/*.mdx')) {
    const original = await readFile(filename, 'utf8');
    const parsed = parseProject(original);
    const saved = serializeProject(original, parsed);
    assert.equal(parseProject(saved).body, parsed.body, filename);
    for (const marker of ['sidebar:', 'tableOfContents:']) {
      if (original.includes(marker)) assert.ok(saved.includes(marker), `${filename} lost ${marker}`);
    }
  }
});
