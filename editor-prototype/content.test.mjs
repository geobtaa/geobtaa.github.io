import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { glob } from 'node:fs/promises';
import { contentVisibility, withContentVisibility, newContent, newProject, parseContent, parseProject, serializeContent, serializeProject } from './content.mjs';
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

test('every enabled content area allows new documents', () => {
  for (const [area, config] of Object.entries(CONTENT_AREAS)) {
    assert.equal(config.create, true, area);
    assert.ok(config.itemLabel, `${area} needs a singular item label`);
  }
});

test('new content includes only frontmatter managed by its content area', () => {
  const entry = { title: 'New page', description: 'Summary', draft: false, body: 'Body.' };
  const ordinary = newContent(entry, { description: true, draft: false });
  assert.equal(ordinary, '---\ntitle: "New page"\ndescription: "Summary"\n---\n\nBody.');
  assert.doesNotMatch(ordinary, /^draft:/m);

  const workgroup = newContent(entry, { description: false, draft: false });
  assert.equal(workgroup, '---\ntitle: "New page"\n---\n\nBody.');
  assert.doesNotMatch(workgroup, /^(description|draft):/m);
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

test('draft visibility and sidebar-only hiding are separate settings', () => {
  assert.deepEqual(contentVisibility('---\ntitle: Draft\ndraft: true\n---\n\nBody'), { draft: true, sidebarHidden: false });
  assert.deepEqual(contentVisibility('---\ntitle: Unlisted\ndraft: false\nsidebar:\n  hidden: true\n---\n\nBody'), { draft: false, sidebarHidden: true });
  assert.deepEqual(contentVisibility('---\ntitle: Both\ndraft: true\nsidebar:\n  hidden: true\n---\n\nBody'), { draft: true, sidebarHidden: true });
  assert.deepEqual(contentVisibility('---\ntitle: Ordinary\n---\n\nBody'), { draft: false, sidebarHidden: false });
});

test('content listings retain order and mark unreadable visibility as unknown', async () => {
  const entries = ['draft', 'sidebar', 'unreadable', 'invalid', 'ready'].map((name) => ({ name, sha: `${name}-sha` }));
  const result = await withContentVisibility(entries, async ({ name }) => {
    if (name === 'unreadable') throw new Error('GitHub request failed');
    if (name === 'invalid') return '---\ntitle: [broken\n---\n\nBody';
    return `---\ntitle: ${name}\ndraft: ${name === 'draft'}\nsidebar:\n  hidden: ${name === 'sidebar'}\n---\n\nBody`;
  });
  assert.deepEqual(result.map((item) => item.name), entries.map((item) => item.name));
  assert.equal(result[0].draft, true);
  assert.equal(result[1].draft, false);
  assert.equal(result[1].sidebarHidden, true);
  assert.deepEqual(result[2], { ...entries[2], visibilityKnown: false });
  assert.deepEqual(result[3], { ...entries[3], visibilityKnown: false });
  assert.equal(result[4].draft, false);
  assert.equal(result[4].visibilityKnown, true);
});
