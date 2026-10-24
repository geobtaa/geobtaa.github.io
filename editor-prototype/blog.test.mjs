import assert from 'node:assert/strict';
import test from 'node:test';
import { glob, readFile } from 'node:fs/promises';
import { parseDocument } from 'yaml';
import { calendarDate, todayCalendar, newBlog, parseBlog, serializeBlog, saveBlog, postSlug } from './blog.mjs';
import { availablePostFilename, createBlogCommit } from './blogStorage.mjs';
import { splitBody } from '../src/components/editor-prototype/bodySegments.ts';

const entry = (overrides = {}) => ({ title: 'A new blog post', date: '2026-10-24', draft: true, excerpt: '', authors: [], tags: [], cover: null, body: 'Ordinary **Markdown**.\n', ...overrides });
const metadata = (content) => parseDocument(content.match(/^---\r?\n([\s\S]*?)\r?\n---/)[1]).toJS();

test('new posts use established metadata, calendar dates, and optional fields', () => {
  const content = newBlog(entry());
  assert.deepEqual(metadata(content), { title: 'A new blog post', date: '2026-10-24', draft: true });
  assert.deepEqual(parseBlog(content), { ...entry(), description: '' });
  const withOptional = newBlog(entry({ authors: [{ name: 'Staff' }], tags: ['Maps'], cover: { image: '@images/map.png', alt: 'A map' }, excerpt: 'Summary' }));
  assert.deepEqual(metadata(withOptional).authors, [{ name: 'Staff' }]);
  assert.deepEqual(metadata(withOptional).cover, { image: '@images/map.png', alt: 'A map' });
});

test('dates retain the written calendar day regardless of offset or host timezone', () => {
  for (const value of ['2026-01-01T00:15:00.000+14:00', '2026-01-01T23:30:00.000-12:00', '2026-01-01']) {
    assert.equal(calendarDate(value), '2026-01-01');
    const original = `---\ntitle: Post\ndate: ${value}\ndraft: false\n---\n\nBody`;
    const parsed = parseBlog(original);
    assert.equal(serializeBlog(original, { ...parsed, title: 'Edited' }).includes(`date: ${value}`), true);
    assert.equal(metadata(serializeBlog(original, { ...parsed, date: '2026-02-02' })).date, `2026-02-02${value.slice(10)}`);
  }
  assert.equal(todayCalendar(new Date(2026, 9, 24, 23, 59)), '2026-10-24');
});

test('validation rejects invalid metadata without requiring optional fields', () => {
  for (const overrides of [{ title: ' ' }, { date: '2025-02-29' }, { date: '2026-13-01' }, { date: '2026-01-00' }, { draft: 'false' }, { authors: [{ name: '' }] }, { tags: [12] }, { cover: { image: '', alt: '' } }]) {
    assert.throws(() => newBlog(entry(overrides)), { status: 400 });
  }
  assert.doesNotThrow(() => newBlog(entry({ date: '2024-02-29' })));
});

test('all existing posts round-trip exactly and keep protected blocks when surrounding text changes', async () => {
  for await (const path of glob('src/content/docs/posts/**/*.{md,mdx}')) {
    const original = await readFile(path, 'utf8');
    const parsed = parseBlog(original);
    assert.equal(serializeBlog(original, parsed), original, path);
    const segments = splitBody(parsed.body);
    assert.equal(segments.map((part) => part.content).join(''), parsed.body);
    const body = segments.map((part) => part.kind === 'markdown' ? part.content.replace(/\w+/, 'Edited') : part.content).join('');
    const saved = serializeBlog(original, { ...parsed, body });
    assert.deepEqual(metadata(saved), metadata(original), path);
    for (const part of segments.filter((item) => item.kind === 'protected')) assert.ok(saved.includes(part.content), path);
  }
});

test('edits replace multiline fields safely and preserve unrelated YAML, author details, covers, and timestamps', () => {
  const original = `---\ntitle: >-\n  Original\n  title\n# publication\ndate: 2026-01-01T23:00:00.000-05:00\nexcerpt: >\n  First line\n  second line\nauthors:\n  - name: Staff\n    url: https://example.com\ncover:\n  image: '@images/map.png'\n  alt: Map\n  caption: Keep me\ntags: [maps, GIS]\nsidebar:\n  hidden: true\n---\n\nimport CenterLayout from '@components/CenterLayout.astro';\n\n<CenterLayout>\nProtected\n</CenterLayout>\n`;
  const parsed = parseBlog(original);
  const saved = serializeBlog(original, { ...parsed, title: 'Changed', excerpt: 'New summary' });
  assert.equal(metadata(saved).title, 'Changed');
  assert.equal(metadata(saved).excerpt, 'New summary');
  assert.ok(saved.includes("cover:\n  image: '@images/map.png'\n  alt: Map\n  caption: Keep me"));
  assert.ok(saved.includes('# publication\ndate: 2026-01-01T23:00:00.000-05:00'));
  assert.equal(parseBlog(saved).body, parsed.body);
  const changedAuthor = serializeBlog(original, { ...parsed, authors: [{ ...parsed.authors[0], name: 'New staff' }] });
  assert.deepEqual(metadata(changedAuthor).authors, [{ name: 'New staff', url: 'https://example.com' }]);
});

test('optional fields can be removed, absent fields stay absent, CRLF and final YAML fields survive', () => {
  for (const ending of ['', '\n']) {
    const original = `---\ntitle: Post\ndate: 2026-01-01\nexcerpt: Hello${ending}\n---\n\nBody`;
    const parsed = parseBlog(original);
    assert.equal(serializeBlog(original, parsed), original);
    assert.equal(metadata(serializeBlog(original, { ...parsed, excerpt: 'Changed' })).excerpt, 'Changed');
    assert.equal(metadata(serializeBlog(original, { ...parsed, excerpt: '' })).excerpt, undefined);
    const added = serializeBlog(original, { ...parsed, draft: true, tags: ['Maps'], authors: [{ name: 'Staff' }] });
    assert.equal(metadata(added).draft, true);
    assert.deepEqual(metadata(added).tags, ['Maps']);
    const crlf = original.replace(/\n/g, '\r\n');
    assert.equal(serializeBlog(crlf, parseBlog(crlf)), crlf);
    assert.equal(metadata(serializeBlog(crlf, { ...parseBlog(crlf), excerpt: 'Changed' })).excerpt, 'Changed');
  }
  const legacy = '---\ntitle: Legacy\nauthors: Staff\ncover:\n  light: light.png\n  dark: dark.png\n  alt: Map\n---\n\nBody';
  assert.equal(serializeBlog(legacy, parseBlog(legacy)), legacy);
  assert.equal(metadata(serializeBlog(legacy, { ...parseBlog(legacy), authors: ['New staff'] })).authors, 'New staff');
});

test('slug generation is short and URL-friendly, without an automatic publication date', () => {
  assert.equal(postSlug('  Café: Maps & GIS! '), 'cafe-maps-gis');
  assert.ok(postSlug('A very long title '.repeat(30)).length <= 64);
  assert.equal(postSlug('地図'), 'post');
  assert.equal(availablePostFilename('Maps', ['maps.md', 'maps-2/index.mdx', 'MAPS-3.mdx']), 'maps-4.mdx');
  assert.equal(availablePostFilename('Index', []), 'index-2.mdx');
});

test('saving existing posts uses authoritative frontmatter, loaded SHA, and exact filename', async () => {
  const original = newBlog(entry({ date: '2026-01-01', cover: { image: 'map.png', alt: 'Map', caption: 'Keep' } }));
  const writes = [];
  const github = {
    async getContent(area, filename) { assert.equal(area, 'posts'); assert.equal(filename, '2025-old-name.md'); return { sha: 'loaded', content: original }; },
    async saveContent(input) { writes.push(input); return { sha: 'saved', commitSha: 'commit', branch: 'custom-cms' }; },
  };
  const input = { ...parseBlog(original), title: 'A different title', date: '2026-05-01', sha: 'loaded', originalContent: 'untrusted' };
  const saved = await saveBlog(github, '2025-old-name.md', input);
  assert.equal(saved.filename, '2025-old-name.md');
  assert.equal(writes[0].filename, '2025-old-name.md');
  assert.equal(writes[0].sha, 'loaded');
  assert.deepEqual(metadata(writes[0].content).cover, metadata(original).cover);
  await assert.rejects(saveBlog(github, '2025-old-name.md', { ...input, sha: 'stale' }), { status: 409 });
  await assert.rejects(saveBlog(github, '2025-old-name.md', { ...input, sha: undefined }), { status: 400 });
  assert.equal(writes.length, 1);
});

function storage(paths = [], race = false) {
  const requests = [];
  return { requests, request: async (path, options = {}) => {
    requests.push({ path, ...options });
    if (path.startsWith('/git/ref/heads/')) return { object: { sha: 'parent' } };
    if (path === '/git/commits/parent') return { tree: { sha: 'base-tree' } };
    if (path.startsWith('/git/trees/base-tree')) return { tree: paths.map((path) => ({ path: `src/content/docs/posts/${path}`, type: 'blob' })) };
    if (path === '/git/trees') {
      const input = JSON.parse(options.body);
      return { sha: 'new-tree', tree: input.tree.map((item) => ({ ...item, sha: 'new-blob' })) };
    }
    if (path === '/git/commits') return { sha: 'new-commit' };
    if (path.startsWith('/git/refs/heads/')) { if (race) throw Object.assign(new Error('not fast forward'), { status: 422 }); return {}; }
    throw new Error(`Unexpected ${path}`);
  }};
}

test('creation suggests an available alternative and commits only after it is accepted', async () => {
  const github = storage(['a-new-blog-post.md', 'a-new-blog-post-2/index.mdx']);
  const options = { request: github.request, ensureBranch: async () => {}, branch: 'custom-cms', title: entry().title, content: newBlog(entry()) };
  await assert.rejects(createBlogCommit(options), { status: 409, suggestedFilename: 'a-new-blog-post-3.mdx' });
  assert.ok(github.requests.every((item) => !item.method));
  const saved = await createBlogCommit({ ...options, suggestedFilename: 'a-new-blog-post-3.mdx' });
  assert.equal(saved.filename, 'a-new-blog-post-3.mdx');
  assert.equal(saved.sha, 'new-blob');
  const commit = JSON.parse(github.requests.find((item) => item.path === '/git/commits').body);
  assert.deepEqual(commit.parents, ['parent']);
  const update = JSON.parse(github.requests.at(-1).body);
  assert.equal(update.force, false);
});

test('concurrent branch writes cannot publish a competing creation commit', async () => {
  const github = storage([], true);
  await assert.rejects(createBlogCommit({ request: github.request, ensureBranch: async () => {}, branch: 'custom-cms', title: 'Maps', content: newBlog(entry()) }), { status: 409 });
  assert.equal(github.requests.filter((item) => item.method === 'PATCH').length, 1);
});

test('empty YAML values can be populated without corrupting adjacent fields', () => {
  const original = '---\ntitle: Post\ndate: 2026-01-01\nexcerpt:\ncover: # optional\nauthors:\ntags:\n---\n\nBody';
  const parsed = parseBlog(original);
  const saved = serializeBlog(original, { ...parsed, excerpt: 'Summary', cover: { image: 'map.png', alt: 'Map' }, authors: [{ name: 'Staff' }], tags: ['Maps'] });
  const doc = parseDocument(saved.match(/^---\n([\s\S]*?)\n---/)[1]);
  assert.equal(doc.errors.length, 0);
  assert.equal(doc.toJS().excerpt, 'Summary');
  assert.deepEqual(doc.toJS().cover, { image: 'map.png', alt: 'Map' });
});

test('creation resolves the blob SHA when GitHub returns a shallow tree response', async () => {
  const github = storage();
  const request = async (path, options) => {
    const result = await github.request(path, options).catch((error) => {
      if (path === '/contents/src/content/docs/posts/maps.mdx?ref=new-commit') return { sha: 'resolved-blob' };
      throw error;
    });
    return path === '/git/trees' ? { sha: result.sha, tree: [{ path: 'src', type: 'tree', sha: 'subtree' }] } : result;
  };
  const saved = await createBlogCommit({ request, ensureBranch: async () => {}, branch: 'custom-cms', title: 'Maps', content: newBlog(entry()) });
  assert.equal(saved.sha, 'resolved-blob');
});
