import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { glob } from 'node:fs/promises';
import { newProject, parseContent, parseProject, serializeContent, serializeProject } from './content.mjs';
import { CONTENT_AREAS } from './contentAreas.mjs';
import { splitBody } from '../src/components/editor-prototype/bodySegments.ts';

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

test('every enabled content file round-trips without changing body or unmanaged frontmatter', async () => {
  for (const [area, config] of Object.entries(CONTENT_AREAS)) {
    for await (const filename of glob(`src/content/docs/${area}/**/*.{md,mdx}`)) {
      const original = await readFile(filename, 'utf8');
      const parsed = parseContent(original);
      const saved = serializeContent(original, parsed, { description: config.description, draft: config.publishing });
      assert.equal(saved, original, filename);
      assert.equal(splitBody(parsed.body).map((segment) => segment.content).join(''), parsed.body, `${filename} body segments`);
    }
  }
});

test('non-Project saves preserve specialized frontmatter and existing draft state', () => {
  const original = `---\ntitle: Group\ncommittee: Steering\nmembers:\n  - One\ndraft: true\n---\n\nBody`;
  const saved = serializeContent(original, { ...parseContent(original), title: 'Renamed', draft: false, body: 'Edited' });
  assert.match(saved, /committee: Steering\nmembers:\n  - One\ndraft: true/);
  assert.deepEqual(parseContent(saved), { title: 'Renamed', description: '', draft: true, body: 'Edited' });
});
