import assert from 'node:assert/strict';
import test from 'node:test';
import { createDraftStore } from './draftStorage.mjs';
import { draftTestRepository } from './draftTestRepository.mjs';
import { parsePage, savePage } from './page.mjs';

// Synthetic documents; reproduce GitHub's observed prefix-relative response
// without credentials, network access, captured content, or live mutations.
const filename = 'geodata-pilot-workgroup-report.mdx';
const path = `src/content/docs/library/${filename}`;
async function fixture() {
  const repo = await draftTestRepository({ [path]: '---\ntitle: Report\n---\n\nOriginal.' });
  const store = createDraftStore({ request: repo.request });
  const initial = await store.getContent('library', filename);
  const saved = await savePage(store, 'library', filename, { ...initial, ...parsePage(initial.content), body: 'Saved draft.' });
  return { repo, store, saved };
}

test('a saved draft still reopens by deterministic document lookup', async () => {
  const { repo, saved } = await fixture();
  const reopened = await createDraftStore({ request: repo.request }).getContent('library', filename);
  assert.equal(reopened.head, saved.head);
  assert.equal(reopened.content, saved.content);
  assert.equal(reopened.mainChanged, false);
});

test('the queried GitHub prefix is returned separately from the relative reference name', async () => {
  const { repo, store, saved } = await fixture();
  const result = await repo.request('/graphql', { method: 'POST', body: JSON.stringify({ query: 'query CMSDrafts { }', variables: {} }) });
  const ref = result.data.repository.refs.nodes[0];
  assert.equal(ref.prefix, 'refs/heads/cms/drafts/');
  assert.equal(ref.name, saved.branch.slice('cms/drafts/'.length));
  assert.equal(ref.target.oid, saved.head);
  const list = await store.listContent('library');
  assert.equal(list.entries.find(item => item.name === filename).head, saved.head);
  const query = repo.requests.find(item => item.body?.includes('nodes{name prefix target{oid}}'));
  assert.ok(query, 'production discovery explicitly requests both name and prefix');
});

test('a fresh store discovers and verifies saved drafts across all response pages', async () => {
  const { repo, store, saved } = await fixture();
  await savePage(store, 'guides', 'second.mdx', { title: 'Second', description: '', body: 'Second draft.' });
  repo.pageSize = 1;
  const fresh = createDraftStore({ request: repo.request });
  const list = await fresh.listContent('library');
  assert.equal(list.entries.find(item => item.name === filename).head, saved.head);
  assert.equal((await fresh.getContent('library', filename)).head, saved.head);
  assert.ok(repo.requests.some(item => item.body?.includes('"after":"1"')));
});

test('discovery rejects wrong or missing prefixes, malformed names, null nodes and missing targets without skipping them', async () => {
  const { repo } = await fixture();
  for (const invalid of [null, { prefix: 'refs/tags/cms/drafts/' }, { prefix: 'refs/heads/' }, { prefix: undefined }, { name: '' }, { name: 123 }, { target: null }, { target: { oid: '' } }]) {
    const request = async (path, options) => {
      const result = await repo.request(path, options);
      if (path === '/graphql' && JSON.parse(options.body).query.includes('query CMSDrafts')) {
        const nodes = result.data.repository.refs.nodes;
        nodes[0] = invalid === null ? null : { ...nodes[0], ...invalid };
      }
      return result;
    };
    await assert.rejects(createDraftStore({ request }).listContent('library'), { status: 503, message: 'Invalid draft discovery result.' });
  }
});

test('canonical branch reconstruction does not bypass document identity or scope verification', async () => {
  for (const fault of ['identity', 'scope']) {
    const { repo, saved } = await fixture();
    if (fault === 'identity') repo.commits.get(saved.head).message = repo.commits.get(saved.head).message.replace(path, 'src/content/docs/library/different.mdx');
    else await repo.put('unrelated-application-file.js', 'Forbidden.', { branch: saved.branch });
    await assert.rejects(createDraftStore({ request: repo.request }).listContent('library'), { status: 409 });
  }
});

test('successful first Save Draft followed by list refresh and reopening succeeds with the real GitHub response shape', async () => {
  const { repo, store, saved } = await fixture();
  const before = [...repo.refs];
  const list = await store.listContent('library');
  assert.equal(list.entries.length, 1);
  assert.equal(list.entries[0].hasDraft, true);
  assert.equal(list.entries[0].head, saved.head);
  const reopened = await createDraftStore({ request: repo.request }).getContent('library', filename);
  assert.equal(reopened.content, saved.content);
  assert.deepEqual([...repo.refs], before, 'refresh and reopen never move refs');
});
