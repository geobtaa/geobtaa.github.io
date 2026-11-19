import assert from 'node:assert/strict';
import test from 'node:test';
import { draftTestRepository } from './draftTestRepository.mjs';
import { publicationTestClient } from './publicationTestHelpers.mjs';
import { parsePage, savePage } from './page.mjs';
const filename = 'report.mdx', path = `src/content/docs/library/${filename}`, original = '---\ntitle: Report\n---\n\nOriginal.';
async function fixture() {
  const repo = await draftTestRepository({ [path]: original });
  const store = () => publicationTestClient({ request: repo.request });
  const file = await store().getContent('library', filename), saved = await savePage(store(), 'library', filename, { ...file, ...parsePage(file.content), body: 'Selected revision.' });
  await store().publishContent({ area: 'library', filename, head: saved.head });
  return { repo, saved, store, pr: repo.pulls[0], status: () => store().getPublicationStatus('library', filename) };
}
test('PR status survives fresh sessions and reports open, conflicts, closed and merged without claiming deployment', async () => {
  const f = await fixture(); const refs = [...f.repo.refs], before = f.repo.requests.length;
  assert.equal((await f.status()).state, 'pr-open');
  f.pr.mergeable = false; assert.equal((await f.status()).state, 'conflict');
  f.pr.state = 'closed'; assert.equal((await f.status()).state, 'closed');
  f.pr.merged_at = '2026-11-18T00:00:00Z';
  const result = await f.status();
  assert.equal(result.state, 'merged'); assert.equal(result.url, f.pr.html_url);
  assert.match(result.message, /deployment is not verified/);
  assert.deepEqual([...f.repo.refs], refs);
  assert.ok(f.repo.requests.slice(before).every(call => !call.method || call.path === '/graphql' && call.body.includes('query ')));
  assert.ok(f.repo.requests.every(call => !/\/deployments|\/actions\/|check-runs/.test(call.path)));
});
test('status preserves newer drafts, rejects incomplete data and never creates a PR', async () => {
  const f = await fixture();
  const newer = await savePage(f.store(), 'library', filename, { ...f.saved, ...parsePage(f.saved.content), body: 'Newer working text.' });
  const before = [...f.repo.refs];
  assert.equal((await f.status()).newerDraft, true);
  assert.deepEqual([...f.repo.refs], before);
  assert.equal(f.repo.refs.get(`refs/heads/${newer.branch}`), newer.head);
  f.repo.unavailable = true; assert.equal((await f.status()).state, 'checking');
});
test('a retained reservation without a PR can be discovered and safely resumed', async () => {
  const f = await fixture(); f.repo.pulls.length = 0;
  const refs = [...f.repo.refs];
  assert.equal((await f.status()).state, 'reserved');
  assert.deepEqual([...f.repo.refs], refs);
  const result = await f.store().publishContent({ area: 'library', filename, head: f.saved.head });
  assert.equal(result.state, 'pr-open'); assert.equal(f.repo.pulls.length, 1);
  assert.deepEqual([...f.repo.refs], refs);
});
test('manual publication still preserves the post-merge draft; intuitive repeat editing remains checkpoint 2', async () => {
  const f = await fixture(), file = f.repo.filesAt(f.pr.head.sha).get(path);
  await f.repo.put(path, new TextDecoder().decode(f.repo.objects.get(file.sha)));
  f.pr.state = 'closed'; f.pr.merged_at = '2026-11-18T00:00:00Z';
  const reopened = await f.store().getContent('library', filename), refs = [...f.repo.refs];
  assert.equal(reopened.mainChanged, true);
  await assert.rejects(savePage(f.store(), 'library', filename, { ...reopened, ...parsePage(reopened.content), body: 'Keep these later edits.' }), { status: 409 });
  assert.deepEqual([...f.repo.refs], refs);
  assert.equal((await f.store().publishContent({ area: 'library', filename, head: f.saved.head })).state, 'merged');
  assert.equal(f.repo.pulls.length, 1);
});
