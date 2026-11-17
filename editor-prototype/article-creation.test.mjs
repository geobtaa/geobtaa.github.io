import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { createBlogCommit } from './blogStorage.mjs';
import { gitBlobSha } from './articleCreation.mjs';
import { creationTestRepository } from './creationTestRepository.mjs';
import { saveBlog } from './blog.mjs';
import { saveProgramUpdate } from './programUpdates.mjs';

const source = '---\ntitle: Maps\n---\n\nUnicode 地図 and {literal text}.\n';
const id = 'a-creation-identifier-12345';
const options = repo => ({ request: repo.request, ensureBranch: async () => {}, branch: 'custom-cms', area: 'posts', title: 'Maps', content: source, creationId: id, creationFilename: 'maps.mdx' });
const attached = repo => Object.keys(repo.state.trees[repo.state.commits[repo.state.head].tree]);

test('Git blob revision is computed from exact UTF-8 bytes before the commit, without a post-save read', async () => {
  const expected = createHash('sha1').update(`blob ${Buffer.byteLength(source)}\0`).update(source).digest('hex');
  assert.equal(await gitBlobSha(source), expected);
  const repo = creationTestRepository(); repo.shallow = true;
  assert.equal((await createBlogCommit(options(repo))).sha, expected);
  assert.equal(repo.requests.some(item => item.path.startsWith('/contents/')), false);
});

test('lost and malformed branch-update responses are confirmed against the attached commit', async () => {
  for (const fault of ['after', 'malformed']) {
    const repo = creationTestRepository(); repo.fault = fault;
    const saved = await createBlogCommit(options(repo));
    assert.equal(saved.commitSha, repo.state.head);
    assert.equal(attached(repo).length, 1);
    const replay = await createBlogCommit({ ...options(repo), title: 'A different title', content: source.replace('Maps', 'Later edits') });
    assert.equal(replay.replayed, true);
    assert.equal(replay.content, source);
    assert.equal(replay.filename, 'maps.mdx');
    assert.equal(repo.requests.filter(item => item.method === 'PATCH').length, 1);
  }
});

test('an unconfirmed response retains its identity and a retry recovers one original article', async () => {
  const repo = creationTestRepository(); repo.fault = 'unavailable-after';
  await assert.rejects(createBlogCommit(options(repo)), { status: 503, creationState: 'uncertain' });
  assert.equal(attached(repo).length, 1);
  repo.unavailable = false;
  const saved = await createBlogCommit(options(repo));
  assert.equal(saved.replayed, true);
  assert.equal(saved.commitSha, repo.state.head);
  assert.equal(repo.requests.filter(item => item.method === 'PATCH').length, 1);
  assert.deepEqual(attached(repo), ['src/content/docs/posts/maps.mdx']);
});

test('a request that never updated the branch can safely retry the same filename and identifier', async () => {
  const repo = creationTestRepository(); repo.fault = 'before';
  await assert.rejects(createBlogCommit(options(repo)), { status: 503, creationState: 'uncertain' });
  assert.equal(repo.state.head, 'root');
  assert.equal((await createBlogCommit(options(repo))).filename, 'maps.mdx');
  assert.equal(attached(repo).length, 1);
});

test('a retry never suggests a duplicate if manual history changes hide its creation marker', async () => {
  const repo = creationTestRepository();
  await createBlogCommit(options(repo));
  repo.state.commits[repo.state.head].message = 'A manually rewritten commit message';
  await assert.rejects(createBlogCommit({ ...options(repo), creationRetry: true }), error => error.creationState === 'uncertain' && !error.suggestedFilename);
  assert.equal(repo.requests.filter(item => item.method === 'PATCH').length, 1);
});

test('concurrent retries attach one article and both resolve to its original commit', async () => {
  const repo = creationTestRepository();
  const [first, second] = await Promise.all([createBlogCommit(options(repo)), createBlogCommit(options(repo))]);
  assert.equal(first.commitSha, second.commitSha);
  assert.equal(attached(repo).length, 1);
});

test('an attached creation remains confirmed after an unrelated child commit advances the branch', async () => {
  const repo = creationTestRepository();
  const request = async (path, input) => {
    const result = await repo.request(path, input);
    if (path.startsWith('/git/refs/heads/')) {
      const created = repo.state.head;
      repo.state.commits.child = { ...repo.state.commits[created], parents: [created], message: 'Unrelated change', changed: [] };
      repo.state.head = 'child';
      throw new TypeError('Lost branch response');
    }
    return result;
  };
  const saved = await createBlogCommit({ ...options(repo), request, creationId: undefined, creationFilename: undefined });
  assert.equal(repo.state.commits.child.parents[0], saved.commitSha);
  assert.equal(attached(repo).length, 1);
});

test('unreadable prior history and invalid creation identifiers never fall through to a fresh creation', async () => {
  const repo = creationTestRepository();
  await assert.rejects(createBlogCommit({ ...options(repo), creationId: 'invalid\nmarker' }), { status: 400 });
  assert.equal(repo.requests.length, 0);
  const request = async (path, input) => path.startsWith('/commits?') ? null : repo.request(path, input);
  await assert.rejects(createBlogCommit({ ...options(repo), request }), { status: 503, creationState: 'uncertain' });
  assert.equal(repo.requests.some(item => item.method), false);
});

test('both article serializers return the original committed content on replay', async () => {
  for (const [area, save] of [['posts', saveBlog], ['updates', saveProgramUpdate]]) {
    const repo = creationTestRepository();
    const github = { createBlog: input => createBlogCommit({ request: repo.request, ensureBranch: async () => {}, branch: 'custom-cms', area, ...input }) };
    const input = { title: 'Maps', body: 'Initial paragraph.', date: '2026-11-14', draft: true, creationId: `${id}-${area}`, creationFilename: 'maps.mdx' };
    const first = await save(github, null, input);
    const replay = await save(github, null, { ...input, title: 'Later title', body: 'Later body.' });
    assert.equal(replay.title, first.title);
    assert.equal(replay.body, first.body);
    assert.equal(replay.sha, first.sha);
    assert.equal(attached(repo).length, 1);
  }
});
