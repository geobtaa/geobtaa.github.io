import assert from 'node:assert/strict';
import test from 'node:test';
import { createDraftStore } from './draftStorage.mjs';
import { draftTestRepository } from './draftTestRepository.mjs';
import { parsePage, savePage } from './page.mjs';

const filename = 'history.mdx', path = `src/content/docs/library/${filename}`;
async function fixture(additional = 60) {
  const repo = await draftTestRepository({ [path]: '---\ntitle: History\n---\n\nPublished.' });
  const store = () => createDraftStore({ request: repo.request });
  const opened = await store().getContent('library', filename);
  let saved = await savePage(store(), 'library', filename, { ...opened, ...parsePage(opened.content), body: 'Saved.' });
  const heads = [saved.head];
  for (let i = 0; i < additional; i++) heads.push(await repo.put(path, `${saved.content}\nRevision ${i}.`, { branch: saved.branch }));
  return { repo, store, heads, saved };
}
const historyCalls = calls => calls.filter(call => call.body?.includes('query CMSDraftHistory'));

test('28, 61 and 221 revisions reopen, discover and save with batched immutable history and no ref loss', async t => {
  for (const additional of [27, 60, 220]) {
    const { repo, store, heads, saved } = await fixture(additional);
    const refs = [...repo.refs], main = repo.refs.get('refs/heads/main');
    let start = repo.requests.length;
    const reopened = await store().getContent('library', filename);
    const reopenCalls = repo.requests.slice(start);
    assert.equal(reopened.head, heads.at(-1));
    start = repo.requests.length;
    const discovered = await store().listContent('library');
    const discoveryCalls = repo.requests.slice(start);
    assert.equal(discovered.entries.find(entry => entry.name === filename).head, reopened.head);
    assert.deepEqual([...repo.refs], refs, 'verification is read-only');
    start = repo.requests.length;
    const next = await savePage(store(), 'library', filename, { ...reopened, ...parsePage(reopened.content), body: 'Next saved edit.' });
    const saveCalls = repo.requests.slice(start);
    for (const calls of [reopenCalls, discoveryCalls, saveCalls]) {
      assert.ok(calls.length <= 35, `operation used ${calls.length} requests`);
      assert.equal(historyCalls(calls).length, Math.ceil(additional / 100));
      assert.ok(calls.filter(call => call.path.startsWith('/git/commits/')).length <= 3, 'no per-revision REST walk');
    }
    assert.equal(repo.commits.get(next.head).parents[0].sha, reopened.head);
    assert.equal(repo.refs.get('refs/heads/main'), main);
    assert.equal(repo.refs.get(`refs/heads/${saved.branch}`), next.head);
    assert.ok(heads.every(head => repo.commits.has(head)), 'all saved revisions are retained');
    t.diagnostic(JSON.stringify({ revisions: additional + 1, reopen: reopenCalls.length, discovery: discoveryCalls.length, save: saveCalls.length }));
  }
});

test('history node order is not trusted; every exact parent is followed across batches', async () => {
  const { repo, heads } = await fixture(220);
  const request = async (path, options) => {
    const result = await repo.request(path, options);
    if (options?.body?.includes('query CMSDraftHistory')) result.data.repository.object.history.nodes.reverse();
    return result;
  };
  const reopened = await createDraftStore({ request }).getContent('library', filename);
  assert.equal(reopened.head, heads.at(-1));
  assert.equal(historyCalls(repo.requests).length, 3);
});

test('batched history still rejects changed document identities, retired ancestors, merges and a false base', async () => {
  for (const fault of ['identity', 'retired', 'merge', 'base']) {
    const { repo, heads } = await fixture(120), ancestor = repo.commits.get(heads[10]);
    if (fault === 'identity') ancestor.message = ancestor.message.replace(path, 'src/content/docs/library/other.mdx');
    if (fault === 'retired') {
      const [prefix, encoded] = ancestor.message.split('CMS-Draft-v1: ');
      ancestor.message = prefix + 'CMS-Draft-v1: ' + JSON.stringify({ ...JSON.parse(encoded), retiredTo: { branch: 'forged', head: heads[0] } });
    }
    if (fault === 'merge') ancestor.parents.push({ sha: heads[0] });
    if (fault === 'base') ancestor.parents = [];
    const refs = [...repo.refs];
    await assert.rejects(createDraftStore({ request: repo.request }).getContent('library', filename), { status: 409 });
    assert.deepEqual([...repo.refs], refs);
  }
});

test('missing, malformed or denied history cannot fall back to unchecked data or advance a draft', async () => {
  for (const fault of ['root', 'nodes', 'missing-requested', 'duplicate', 'parent', 'errors', 'denied']) {
    const { repo } = await fixture(), refs = [...repo.refs];
    const request = async (path, options) => {
      const result = await repo.request(path, options);
      if (!options?.body?.includes('query CMSDraftHistory')) return result;
      const object = result.data.repository.object, nodes = object.history.nodes;
      if (fault === 'root') object.oid = '0'.repeat(40);
      if (fault === 'nodes') object.history.nodes = null;
      if (fault === 'missing-requested') nodes.shift();
      if (fault === 'duplicate') nodes.push(nodes[0]);
      if (fault === 'parent') nodes[0].parents.nodes[0].oid = 'invalid';
      if (fault === 'errors') result.errors = [{ message: 'GitHub rejected the history query' }];
      if (fault === 'denied') throw Object.assign(new Error('Permission denied'), { status: 403 });
      return result;
    };
    const start = repo.requests.length;
    await assert.rejects(createDraftStore({ request }).getContent('library', filename));
    assert.deepEqual([...repo.refs], refs);
    assert.ok(repo.requests.slice(start).every(call => !call.method || call.path === '/graphql' && call.body.includes('query ')), 'failure sends only reads');
  }
});

test('a stale browser save remains rejected after a batched-history read', async () => {
  const { repo, store, heads, saved } = await fixture();
  const opened = await store().getContent('library', filename);
  await repo.put(path, opened.content + '\nAnother editor saved.', { branch: saved.branch });
  const refs = [...repo.refs];
  await assert.rejects(savePage(store(), 'library', filename, { ...opened, ...parsePage(opened.content), body: 'Stale edit.' }), { status: 409 });
  assert.deepEqual([...repo.refs], refs);
  assert.ok(repo.commits.has(heads.at(-1)));
});

test('batching does not raise or bypass the existing 1000-revision integrity bound', async () => {
  const { repo, store } = await fixture(1000), refs = [...repo.refs];
  await assert.rejects(store().getContent('library', filename), /history exceeds the verification limit/);
  assert.deepEqual([...repo.refs], refs);
});
