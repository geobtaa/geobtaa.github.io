import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { getContentEntryIdAndSlug } from '../node_modules/astro/dist/content/utils.js';
import { createBlogCommit, createContentCommit } from './blogStorage.mjs';
import { canonicalRoute, documentRoute, documentSlug, isRoutedDocument } from './contentRoutes.mjs';
import { blobQueryResponse } from './githubTestHelpers.mjs';

const source = (slug, body = 'Body.') => `---\ntitle: Test\n${slug ? `slug: ${JSON.stringify(slug)}\n` : ''}---\n\n${body}`;
const prefix = 'src/content/docs/';
function repository(entries = [], { race = false, truncated = false, queryError } = {}) {
  const files = new Map(entries.map(([path, content]) => [path, { content, sha: createHash('sha1').update(content).digest('hex'), type: 'blob' }]));
  const requests = [];
  let pending;
  const request = async (path, options = {}) => {
    requests.push({ path, ...options });
    if (path.startsWith('/git/ref/heads/')) return { object: { sha: 'parent' } };
    if (path === '/git/commits/parent') return { tree: { sha: 'snapshot' } };
    if (path === '/git/trees/snapshot?recursive=1') return { truncated, tree: [...files].map(([path, file]) => ({ path, sha: file.sha, type: file.type })) };
    if (path === '/graphql') {
      const payload = JSON.parse(options.body);
      assert.deepEqual(payload.variables, { owner: 'geobtaa', repo: 'geobtaa.github.io' });
      assert.match(payload.query, /^query CMSRoutes\(/, 'a read-only GraphQL operation');
      const result = blobQueryResponse(payload, files.values());
      return typeof queryError === 'function' ? queryError(result) : queryError || result;
    }
    if (path === '/git/trees') {
      const input = JSON.parse(options.body);
      assert.equal(input.base_tree, 'snapshot');
      pending = input.tree[0];
      return { sha: 'next-tree', tree: [{ ...pending, sha: 'created-blob' }] };
    }
    if (path === '/git/commits') {
      assert.deepEqual(JSON.parse(options.body).parents, ['parent']);
      return { sha: 'next-commit' };
    }
    if (path.startsWith('/git/refs/heads/')) {
      assert.equal(JSON.parse(options.body).force, false);
      if (race) throw Object.assign(new Error('Not fast forward'), { status: 422 });
      assert.equal(files.has(pending.path), false);
      files.set(pending.path, { content: pending.content, sha: createHash('sha1').update(pending.content).digest('hex'), type: 'blob' });
      return { object: { sha: JSON.parse(options.body).sha } };
    }
    throw new Error(`Unexpected request ${path}`);
  };
  return { files, requests, request, ensureBranch: async () => {}, branch: 'custom-cms' };
}
const create = (repo, filename = 'maps.mdx', area = 'guides') => createContentCommit({ ...repo, area, filename, content: source(null) });
const writes = repo => repo.requests.filter(item => item.method && item.path !== '/graphql');

test('document routes match the installed Astro filename generator and Starlight index conventions', async () => {
  const base = new URL('../src/content/docs/', import.meta.url);
  for (const filename of ['about/brand-gin.md', 'metadata/b1g.md', 'guides/Maps & Data.mdx', 'guides/Caf\u00e9.md', 'guides/cafe\u0301.md', 'guides/maps/index.mdx', 'guides/maps/index/index.md', 'index.mdx']) {
    const { slug } = getContentEntryIdAndSlug({ entry: new URL(filename, base), contentDir: base, collection: '' });
    const param = slug === 'index' ? '' : slug.replace(/\/index$/, '').normalize();
    assert.equal(documentRoute(filename), param, filename);
  }
  assert.equal(documentRoute('about/brand-gin.mdx'), documentRoute('about/brand-gin.md'));
  assert.equal(documentRoute('guides/maps/index.mdx'), 'guides/maps');
  assert.equal(canonicalRoute('/guides/cafe\u0301/'), canonicalRoute('guides/caf%C3%A9/'));
  assert.equal(documentRoute('elsewhere.mdx', 'guides/maps/index'), 'guides/maps');
  assert.equal(isRoutedDocument(`${prefix}guides/_example.mdx`), false);
  for (const filename of ['about/brand-gin.md', 'about/brand-geoportal.md', 'metadata/b1g.md']) {
    assert.equal(documentSlug(await readFile(new URL(`../${prefix}${filename}`, import.meta.url), 'utf8')), null);
  }
});

test('all page creations reject equivalent URLs, including cross-area slug overrides and static pages', async () => {
  for (const [existing, filename, area = 'guides', slug = null] of [
    ['guides/maps.md', 'maps.mdx'], ['guides/maps.mdx', 'maps.md'],
    ['guides/maps/index.mdx', 'maps.md'], ['guides/maps.md', 'maps/index.mdx'],
    ['guides/maps/index/index.md', 'maps.mdx'], ['guides/MAPS.md', 'maps.mdx'],
    ['guides/ma.ps.markdown', 'maps.mdx'], ['team/other.mdx', 'maps.mdx', 'guides', '/guides/maps/'],
    ['team/other.mdx', 'maps.mdx', 'guides', 'guides/maps/index'],
    ['library/index.astro', 'index.mdx', 'library'],
    ['guides/maps.mdx', 'maps.mdx', 'guides', 'a-different-url'],
  ]) {
    const path = existing.endsWith('.astro') ? `src/pages/${existing}` : `${prefix}${existing}`;
    const repo = repository([[path, source(slug)]]);
    await assert.rejects(create(repo, filename, area), error => error.status === 409 && /already claimed/.test(error.message));
    assert.equal(writes(repo).length, 0, existing);
    assert.equal(repo.files.size, 1);
  }
});

test('articles also check global slug claims before suggesting an alternative', async () => {
  const repo = repository([[`${prefix}team/other.mdx`, source('posts/maps')]]);
  const input = { ...repo, area: 'posts', title: 'Maps', content: source(null) };
  await assert.rejects(createBlogCommit(input), { status: 409, suggestedFilename: 'maps-2.mdx' });
  assert.equal(writes(repo).length, 0);
  assert.equal((await createBlogCommit({ ...input, suggestedFilename: 'maps-2.mdx' })).filename, 'maps-2.mdx');
});

test('unique pages use one snapshot and a non-forced update, and competing commits prevent creation', async () => {
  const repo = repository([[`${prefix}guides/other.mdx`, source(null)]]);
  assert.equal((await create(repo, 'maps.md')).filename, 'maps.md');
  assert.equal(repo.files.get(`${prefix}guides/maps.md`).content, source(null));
  const competing = repository([[`${prefix}guides/other.mdx`, source(null)]], { race: true });
  await assert.rejects(create(competing), { status: 409 });
  assert.equal(competing.files.has(`${prefix}guides/maps.mdx`), false);
  assert.equal(competing.files.size, 1);
});

test('incomplete listings, blob queries and invalid routing metadata fail before repository writes', async () => {
  for (const options of [
    { truncated: true }, { queryError: { errors: [{ message: 'Unavailable' }] } },
    { queryError: { data: { repository: { b0: null } } } },
    { queryError: { data: { repository: { b0: { oid: 'wrong-sha', text: source(null), isTruncated: false } } } } },
    { queryError: result => { result.data.repository.b0.isTruncated = true; return result; } },
    { queryError: result => { result.data.repository.b0.text = null; return result; } },
  ]) {
    const repo = repository([[`${prefix}guides/other.mdx`, source(`unknown-${JSON.stringify(options)}-${String(options.queryError)}`)]], options);
    await assert.rejects(create(repo), { status: 503 });
    assert.equal(writes(repo).length, 0);
  }
  const invalid = repository([[`${prefix}other/broken.md`, '---\ntitle: [invalid YAML\n---\n\nBody.']]);
  await assert.rejects(create(invalid), { status: 503 });
  assert.equal(writes(invalid).length, 0);
});

test('large repositories batch immutable blob reads and recheck changed slug metadata', async () => {
  const files = Array.from({ length: 170 }, (_, i) => [`${prefix}guides/page-${i}.mdx`, source(null, `Document ${i}.`)]);
  const repo = repository(files);
  await create(repo);
  assert.equal(repo.requests.filter(item => item.path === '/graphql').length, 6);
  const changed = repository([[`${prefix}team/route-holder.mdx`, source('guides/maps')]]);
  await assert.rejects(create(changed), { status: 409 });
  const renamed = repository([[`${prefix}team/route-holder.mdx`, source('guides/a-different-route')]]);
  assert.equal((await create(renamed)).filename, 'maps.mdx');
});
