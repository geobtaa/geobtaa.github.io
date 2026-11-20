import assert from 'node:assert/strict';
import test from 'node:test';
import { websiteStatus, pendingDeployment } from './websiteStatus.mjs';
import { requireUnpublishCapability } from './unpublishGate.mjs';
const sha = 'a'.repeat(40), blob = 'b'.repeat(40), merge = 'c'.repeat(40), snapshot = 'd'.repeat(40);
const path = 'src/content/docs/library/report.mdx', runUrl = 'https://github.com/geobtaa/geobtaa.github.io/actions/runs/123';
function fixture(draft = false) {
 const content = `---\ntitle: Report\ndraft: ${draft}\n---\n\nText.`;
 const marker = { version: 2, repository: 'geobtaa/geobtaa.github.io', sha, runId: 123, runAttempt: 1, environment: 'github-pages', workflow: '.github/workflows/astro.yml', documents: { [path]: { blob, route: 'library/report', ...(draft ? { draft: true } : {}) } } };
 const run = { repository: { full_name: marker.repository }, path: marker.workflow, head_sha: sha, head_branch: 'main', event: 'push', status: 'completed', conclusion: 'success', run_attempt: 1, html_url: runUrl };
 const deployment = { id: 1, sha, environment: 'github-pages' }, status = { state: 'success', log_url: runUrl + '/job/456', environment_url: 'https://gin.btaa.org/' };
 const document = { sha: blob, encoding: 'base64', content: Buffer.from(content).toString('base64') };
 const calls = [];
 const request = async url => {
  calls.push(url);
  if (url === '/actions/runs/123') return run;
  if (url.startsWith('/deployments?')) return [deployment];
  if (url.startsWith('/deployments/1/statuses')) return [status];
  if (url.startsWith('/contents/')) return document;
  if (url.startsWith('/compare/')) return { status: 'ahead', merge_base_commit: { sha: merge } };
  throw new Error('Unexpected call ' + url);
 };
 const fetchPublic = async (url, options) => { assert.equal(url, 'https://gin.btaa.org/_cms/deployment.json'); assert.equal(options.headers, undefined); assert.equal(options.redirect, 'manual'); return Response.json(marker); };
 const check = (publicationRequest = null) => websiteStatus({ request, fetchPublic, path, publicationRequest });
 return { marker, run, deployment, status, document, calls, request, check };
}
test('only matching successful production evidence confirms published or unpublished; checks are read-only and on demand', async () => {
 for (const draft of [false, true]) {
  const f = fixture(draft), result = await f.check({ state: 'merged', mergeHead: merge, snapshotHead: snapshot });
  assert.equal(result.publication, draft ? 'unpublished' : 'published'); assert.equal(result.requestApplied, true);
  assert.ok(f.calls.length <= 6);
 }
 const legacy = fixture(); legacy.marker.version = 1; assert.equal((await legacy.check()).publication, 'published');
});
test('stale, mismatched, old, missing, inactive and failed deployment evidence never claims unpublish success', async () => {
 const changes = [
  f => { f.marker.version = 1; }, f => { f.marker.runAttempt = 2; }, f => { f.run.conclusion = 'failure'; },
  f => { f.run.path = '.github/workflows/other.yml'; }, f => { f.run.head_branch = 'feature'; },
  f => { f.run.repository.full_name = 'other/repo'; }, f => { f.deployment.sha = merge; },
  f => { f.status.state = 'inactive'; }, f => { f.status.log_url = 'https://evil.test/'; },
  f => { f.status.environment_url = 'https://evil.test/'; }, f => { delete f.marker.documents[path]; },
  f => { f.document.sha = merge; }, f => { f.marker.documents[path].route = 'wrong'; },
  f => { f.document.content = Buffer.from('---\ntitle: Wrong\ndraft: false\n---\n').toString('base64'); },
 ];
 for (const change of changes) { const f = fixture(true); change(f); assert.equal((await f.check()).publication, 'unavailable'); }
 const f = fixture();
 assert.equal((await websiteStatus({ request: f.request, path, fetchPublic: async () => new Response('', { status: 302, headers: { Location: 'https://evil.test/' } }) })).publication, 'unavailable');
 assert.equal((await websiteStatus({ request: f.request, path, fetchPublic: async () => { throw new Error('Offline'); } })).publication, 'unavailable');
});
test('newer deployed content does not certify an older selected request', async () => {
 const f = fixture(true);
 const request = async url => url.endsWith(`ref=${snapshot}`) ? { ...f.document, sha: merge } : f.request(url);
 const result = await websiteStatus({ request, path, fetchPublic: async () => Response.json(f.marker), publicationRequest: { state: 'merged', mergeHead: merge, snapshotHead: snapshot } });
 assert.equal(result.publication, 'unpublished'); assert.equal(result.requestApplied, false);
});
test('failed deployment messages require a run containing the merge; uncertainty remains unverified', async () => {
 let run = { id: 12, head_sha: sha, status: 'completed', conclusion: 'failure' };
 const request = async url => url.startsWith('/actions/') ? { workflow_runs: [run] } : { status: 'ahead', merge_base_commit: { sha: merge } };
 assert.equal((await pendingDeployment({ request, mergeHead: merge })).state, 'failed');
 run = { ...run, status: 'in_progress', conclusion: null };
 assert.equal((await pendingDeployment({ request, mergeHead: merge })).state, 'pending');
 assert.equal((await pendingDeployment({ request: async () => { throw new Error(); }, mergeHead: merge })).state, 'unknown');
});
test('unpublish defaults disabled and requires capability installed on main independently of publishing enablement', async () => {
 const capability = { version: 2, actions: ['publish', 'unpublish'] };
 for (const enabled of [undefined, 'false', '']) await assert.rejects(requireUnpublishCapability({ enabled, readMainCapability: async () => capability }), { status: 403 });
 for (const value of [null, {}, { version: 1, actions: ['unpublish'] }, { version: 2, actions: ['publish'] }]) await assert.rejects(requireUnpublishCapability({ enabled: 'true', readMainCapability: async () => value }), { status: 403 });
 await requireUnpublishCapability({ enabled: 'true', readMainCapability: async () => capability });
});
