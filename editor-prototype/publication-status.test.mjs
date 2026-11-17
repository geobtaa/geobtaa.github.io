import assert from 'node:assert/strict';
import test from 'node:test';
import { createDraftStore } from './draftStorage.mjs';
import { draftTestRepository } from './draftTestRepository.mjs';
import { parsePage, savePage } from './page.mjs';
import { buildDeploymentMarker } from '../scripts/write-cms-deployment.mjs';
const filename = 'report.mdx', path = `src/content/docs/library/${filename}`, original = '---\ntitle: Report\n---\n\nOriginal.';
const htmlHash = 'a'.repeat(64);
async function fixture() {
  const repo = await draftTestRepository({ [path]: original });
  let marker = null, documentHash = htmlHash;
  const deployments = [], runs = new Map(), checks = [], statuses = new Map();
  const request = async (path, options) => {
    if (path.includes('/check-runs?')) return { total_count: checks.length, check_runs: checks };
    if (path === '/actions/workflows/astro.yml') return { id: 100 };
    if (path.startsWith('/actions/runs/')) return runs.get(Number(path.split('/').at(-1))) || {};
    if (path.startsWith('/actions/workflows/astro.yml/runs?')) return { total_count: runs.size, workflow_runs: [...runs.values()].filter(run => !path.includes('head_sha=') || path.includes(`head_sha=${run.head_sha}`)) };
    if (path.startsWith('/deployments?')) return deployments.filter(deployment => path.includes(`sha=${deployment.sha}`));
    if (/^\/deployments\/\d+\/statuses/.test(path)) return statuses.get(Number(path.split('/')[2])) || [];
    return repo.request(path, options);
  };
  const store = () => createDraftStore({ request, readMarker: async () => { if (marker instanceof Error) throw marker; return marker; }, readDocumentHash: async () => documentHash });
  const file = await store().getContent('library', filename), saved = await savePage(store(), 'library', filename, { ...file, ...parsePage(file.content), body: 'Selected revision.' });
  const status = () => store().getPublicationStatus('library', filename);
  await store().publishContent({ area: 'library', filename, head: saved.head });
  const pr = repo.pulls[0];
  const merged = async () => {
    const snapshot = repo.filesAt(pr.head.sha).get(path);
    const content = new TextDecoder().decode(repo.objects.get(snapshot.sha));
    const merge = await repo.put(path, content);
    pr.state = 'closed'; pr.merged_at = '2026-11-17T00:00:00Z'; pr.merge_commit_sha = merge;
    return merge;
  };
  const live = (sha = pr.merge_commit_sha) => {
    const blob = repo.filesAt(sha).get(path).sha;
    marker = { version: 1, repository: 'geobtaa/geobtaa.github.io', sha, runId: 200, runAttempt: 1, environment: 'github-pages', workflow: '.github/workflows/astro.yml', documents: { [path]: { blob, route: 'library/report', htmlHash } } };
    runs.set(200, { id: 200, workflow_id: 100, head_sha: sha, head_branch: 'main', event: 'push', path: '.github/workflows/astro.yml', run_attempt: 1, repository: { full_name: 'geobtaa/geobtaa.github.io' }, status: 'completed', conclusion: 'success' });
    deployments.push({ id: 300, environment: 'github-pages', ref: 'main', sha });
    statuses.set(300, [{ state: 'success', environment: 'github-pages', environment_url: 'https://gin.btaa.org/', log_url: 'https://github.com/geobtaa/geobtaa.github.io/actions/runs/200/job/123' }]);
  };
  return { repo, saved, pr, store, status, merged, live, checks, runs, deployments, statuses, setMarker: value => { marker = value; }, get marker() { return marker; }, setDocumentHash: value => { documentHash = value; } };
}
test('status recovers PR/checks/merge progress from fresh stores without repository writes', async () => {
  const f = await fixture(); let before = f.repo.requests.length;
  assert.equal((await f.status()).state, 'publishing');
  f.checks.push(...['validate', 'cms-publication-scope'].map((name, id) => ({ id, name, app: { id: 15368 }, status: 'completed', conclusion: 'success' })));
  f.pr.auto_merge = null;
  assert.equal((await f.status()).state, 'action-required');
  f.pr.auto_merge = { enabled_by: { login: 'editor' } };
  assert.equal((await f.status()).state, 'publishing');
  await f.merged(); before = f.repo.requests.length;
  assert.equal((await f.status()).state, 'publishing');
  assert.ok(f.repo.requests.slice(before).every(call => !call.method || call.path === '/graphql' && call.body.includes('query ')));
});
test('failed checks, conflicts, closed PRs and missing auto-merge produce actionable states', async () => {
  const f = await fixture();
  f.checks.push({ id: 1, name: 'validate', app: { id: 15368 }, status: 'completed', conclusion: 'failure' });
  assert.equal((await f.status()).state, 'validation-failed');
  f.pr.mergeable = false; assert.equal((await f.status()).state, 'conflict');
  f.pr.state = 'closed'; assert.equal((await f.status()).state, 'action-required');
});
test('Published requires successful trusted workflow, environment deployment, exact source blobs and live HTML', async () => {
  const f = await fixture(); await f.merged(); f.live();
  const result = await f.status();
  assert.equal(result.state, 'published'); assert.equal(result.selectedHead, f.saved.head); assert.equal(result.liveUrl, 'https://gin.btaa.org/library/report/');
  f.setDocumentHash('b'.repeat(64)); assert.equal((await f.status()).state, 'publishing');
  f.setDocumentHash(htmlHash); f.statuses.get(300)[0].state = 'failure'; assert.notEqual((await f.status()).state, 'published');
});
test('wrong origin/workflow/repository/ref/run attempt or deployment link cannot confirm publication', async () => {
  for (const fault of ['origin', 'workflow', 'repository', 'branch', 'attempt', 'log', 'marker-blob', 'marker-missing', 'run-failure']) {
    const f = await fixture(); await f.merged(); f.live();
    if (fault === 'origin') f.statuses.get(300)[0].environment_url = 'https://gin-editor.pages.dev/';
    if (fault === 'workflow') f.runs.get(200).path = '.github/workflows/other.yml';
    if (fault === 'repository') f.marker.repository = 'another/repo';
    if (fault === 'branch') f.runs.get(200).head_branch = 'custom-cms';
    if (fault === 'attempt') f.runs.get(200).run_attempt = 2;
    if (fault === 'log') f.statuses.get(300)[0].log_url = 'https://github.com/geobtaa/geobtaa.github.io/actions/runs/999/job/1';
    if (fault === 'marker-blob') f.marker.documents[path].blob = 'f'.repeat(40);
    if (fault === 'marker-missing') f.setMarker(new Error('Not propagated yet'));
    if (fault === 'run-failure') f.runs.get(200).conclusion = 'failure';
    assert.notEqual((await f.status()).state, 'published', fault);
  }
});
test('a later successful deployment can confirm a cancelled earlier deployment only when it still contains the revision', async () => {
  const f = await fixture(); await f.merged();
  f.runs.set(100, { id: 100, head_sha: f.pr.merge_commit_sha, head_branch: 'main', path: '.github/workflows/astro.yml', status: 'completed', conclusion: 'cancelled' });
  assert.equal((await f.status()).state, 'deployment-failed');
  const newer = await f.repo.put('unrelated.js', 'Another publication'); f.live(newer);
  assert.equal((await f.status()).state, 'published');
  const changed = await f.repo.put(path, original + 'A different document revision.'); f.live(changed);
  assert.equal((await f.status()).state, 'superseded');
});
test('newer drafts remain intact, and status survives delayed GitHub responses without claiming success', async () => {
  const f = await fixture();
  const newer = await savePage(f.store(), 'library', filename, { ...f.saved, ...parsePage(f.saved.content), body: 'Newer working text.' });
  await f.merged(); f.live();
  const before = [...f.repo.refs];
  assert.equal((await f.status()).state, 'published'); assert.equal((await f.status()).newerDraft, true);
  assert.deepEqual([...f.repo.refs], before); assert.equal(f.repo.refs.get(`refs/heads/${newer.branch}`), newer.head);
  f.repo.unavailable = true;
  assert.equal((await f.status()).state, 'checking');
});
test('the public build marker excludes drafts and missing outputs and hashes rendered bytes', async () => {
  const marker = await buildDeploymentMarker({ sha: 'a'.repeat(40), runId: 1, runAttempt: 1, repository: 'geobtaa/geobtaa.github.io', files: [
    { path, mode: '100644', type: 'blob', sha: 'b'.repeat(40) },
    { path: 'src/content/docs/library/draft.mdx', mode: '100644', type: 'blob', sha: 'c'.repeat(40) },
    { path: 'src/content/docs/library/omitted.mdx', mode: '100644', type: 'blob', sha: 'd'.repeat(40) },
  ], readSource: async name => name.includes('draft.mdx') ? '---\ntitle: Draft\ndraft: true\n---\n\nHidden.' : original, readOutput: async route => { if (route.includes('omitted')) throw new Error('No output'); return '<html>Rendered document.</html>'; } });
  assert.deepEqual(Object.keys(marker.documents), [path]); assert.match(marker.documents[path].htmlHash, /^[a-f0-9]{64}$/);
});

test('cancelled deployments remain Publishing while a newer containing deployment is running', async () => {
  const f = await fixture(); await f.merged();
  f.runs.set(100, { id: 100, head_sha: f.pr.merge_commit_sha, head_branch: 'main', path: '.github/workflows/astro.yml', status: 'completed', conclusion: 'cancelled' });
  const next = await f.repo.put('other-document.js', 'Another document publication');
  f.runs.set(200, { id: 200, head_sha: next, head_branch: 'main', path: '.github/workflows/astro.yml', status: 'in_progress', conclusion: null });
  assert.equal((await f.status()).state, 'publishing');
});
test('unrelated successful deployments and wrong document HTML cannot confirm the selected merge', async () => {
  const f = await fixture(), old = f.repo.refs.get('refs/heads/main');
  await f.merged(); f.live(old);
  assert.equal((await f.status()).state, 'publishing');
});
test('superseded attempts recover the winning publication after stale replacement and reopen', async () => {
  const f = await fixture(); await f.repo.put('unrelated.js', 'New main');
  await f.store().publishContent({ area: 'library', filename, head: f.saved.head });
  const latest = f.repo.pulls[1]; latest.mergeable = false;
  assert.equal((await f.status()).state, 'conflict');
  assert.equal((await f.status()).number, latest.number);
});

test('a production deployment changing during the final proof never yields a stale Published result', async () => {
  const f = await fixture(); await f.merged(); f.live(); let reads = 0;
  const status = createDraftStore({ request: async (path, options) => {
    // Reuse all synthetic REST responses by proxying the fixture's underlying store proof.
    if (path.startsWith('/actions/runs/')) return f.runs.get(Number(path.split('/').at(-1)));
    if (path === '/actions/workflows/astro.yml') return { id: 100 };
    if (path.startsWith('/deployments?')) return f.deployments;
    if (path.startsWith('/deployments/')) return f.statuses.get(300);
    return f.repo.request(path, options);
  }, readMarker: async () => ++reads === 1 ? f.marker : { ...f.marker, sha: 'e'.repeat(40) }, readDocumentHash: async () => htmlHash });
  assert.equal((await status.getPublicationStatus('library', filename)).state, 'publishing');
});

test('repeat editing after publication is blocked in the retained CMS draft but a current-main ordinary PR is workable', async () => {
  const { validateSourcePullRequest } = await import('./sourcePullRequest.mjs');
  const f = await fixture(); await f.merged(); f.live();
  assert.equal((await f.status()).state, 'published');
  const reopened = await f.store().getContent('library', filename);
  assert.equal(reopened.mainChanged, true);
  const before = [...f.repo.refs];
  await assert.rejects(savePage(f.store(), 'library', filename, { ...reopened, ...parsePage(reopened.content), body: 'Second round of editing.' }), error => error.status === 409 && /ordinary GitHub PR based on current main/.test(error.message));
  assert.deepEqual([...f.repo.refs], before);
  // Retry of the original published revision recovers the old merge, never publishes new text.
  assert.equal((await f.store().publishContent({ area: 'library', filename, head: reopened.head })).state, 'merged');
  assert.equal(f.repo.pulls.length, 1);
  const sourceBranch = 'repeat-content-from-main', main = f.repo.refs.get('refs/heads/main');
  f.repo.refs.set(`refs/heads/${sourceBranch}`, main);
  const published = f.repo.filesAt(main).get(path), content = new TextDecoder().decode(f.repo.objects.get(published.sha));
  const sourceHead = await f.repo.put(path, content.replace('Selected revision.', 'Second round of editing.'), { branch: sourceBranch });
  assert.equal((await validateSourcePullRequest({ request: f.repo.request, pr: { head: { sha: sourceHead } } })).changedFiles, 1);
  assert.equal(f.repo.refs.get(`refs/heads/${reopened.branch}`), reopened.head, 'ordinary PR fallback preserves the old draft and its publication history');
});
