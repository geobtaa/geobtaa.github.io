import { contentVisibility } from './content.mjs';
import { documentRoute, documentSlug } from './contentRoutes.mjs';
const ORIGIN = 'https://gin.btaa.org';
const REPOSITORY = 'geobtaa/geobtaa.github.io';
const SHA = /^[a-f0-9]{40}$/;
const unavailable = () => ({ publication: 'unavailable', message: 'The website status could not be verified. Your saved work is safe.' });
async function markerJson(response) {
  if (!response.ok || response.redirected || Number(response.headers.get('content-length') || 0) > 4_000_000) throw new Error('Marker unavailable.');
  const reader = response.body.getReader(), chunks = []; let size = 0;
  try {
    while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 4_000_000) throw new Error('Marker too large.'); chunks.push(value); }
  } finally { await reader.cancel().catch(() => {}); }
  const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder().decode(bytes));
}
// Read-only, on demand. Never send GitHub credentials to the public website.
export async function websiteStatus({ request, path, fetchPublic = fetch, publicationRequest = null }) {
  try {
    const marker = await markerJson(await fetchPublic(`${ORIGIN}/_cms/deployment.json`, { redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(8_000) }));
    if (![1, 2].includes(marker.version) || marker.repository !== REPOSITORY || marker.environment !== 'github-pages' || marker.workflow !== '.github/workflows/astro.yml' || !SHA.test(marker.sha || '') || !Number.isSafeInteger(marker.runId) || marker.runId < 1 || !Number.isSafeInteger(marker.runAttempt) || marker.runAttempt < 1) return unavailable();
    const run = await request(`/actions/runs/${marker.runId}`);
    const runUrl = `https://github.com/${REPOSITORY}/actions/runs/${marker.runId}`;
    if (run.repository?.full_name !== REPOSITORY || run.path !== marker.workflow || run.head_sha !== marker.sha || run.head_branch !== 'main' || !['push', 'workflow_dispatch'].includes(run.event) || run.status !== 'completed' || run.conclusion !== 'success' || run.run_attempt !== marker.runAttempt || run.html_url !== runUrl) return unavailable();
    const deployments = await request('/deployments?environment=github-pages&per_page=10');
    if (!Array.isArray(deployments) || deployments.length > 10) return unavailable();
    let active;
    for (const deployment of deployments) {
      if (!Number.isSafeInteger(deployment.id) || deployment.environment !== 'github-pages') return unavailable();
      const statuses = await request(`/deployments/${deployment.id}/statuses?per_page=1`);
      if (!Array.isArray(statuses) || !statuses.length) return unavailable();
      if (statuses[0].state !== 'success') continue;
      active = { deployment, status: statuses[0] }; break;
    }
    if (!active || active.deployment.sha !== marker.sha || !(active.status.log_url === runUrl || active.status.log_url?.startsWith(runUrl + '/')) || new URL(active.status.environment_url).origin !== ORIGIN) return unavailable();
    const item = marker.documents?.[path];
    if (!item || !SHA.test(item.blob || '') || typeof item.route !== 'string' || (item.draft !== undefined && typeof item.draft !== 'boolean') || (item.draft === true && marker.version !== 2)) return unavailable();
    const document = await request(`/contents/${path}?ref=${marker.sha}`);
    if (document.sha !== item.blob || document.encoding !== 'base64' || typeof document.content !== 'string' || document.content.length > 1_500_000) return unavailable();
    const content = new TextDecoder().decode(Uint8Array.from(atob(document.content.replace(/\s/g, '')), ch => ch.charCodeAt(0)));
    if (contentVisibility(content).draft !== (item.draft === true) || documentRoute(path.slice('src/content/docs/'.length), documentSlug(content)) !== item.route) return unavailable();
    const result = { publication: item.draft === true ? 'unpublished' : 'published', sourceHead: marker.sha, deployedBlob: item.blob };
    if (publicationRequest?.state === 'merged' && SHA.test(publicationRequest.mergeHead || '') && SHA.test(publicationRequest.snapshotHead || '')) {
      const relation = await request(`/compare/${publicationRequest.mergeHead}...${marker.sha}?per_page=1&page=2`);
      const selected = await request(`/contents/${path}?ref=${publicationRequest.snapshotHead}`);
      result.requestApplied = ['ahead', 'identical'].includes(relation.status) && relation.merge_base_commit?.sha === publicationRequest.mergeHead && selected.sha === item.blob;
      if (!result.requestApplied) result.message = 'The deployed page differs from this request. Review the current website before submitting again.';
    }
    return result;
  } catch { return unavailable(); }
}

export async function pendingDeployment({ request, mergeHead }) {
  if (!SHA.test(mergeHead || '')) return { state: 'unknown' };
  try {
    const runs = await request('/actions/workflows/astro.yml/runs?branch=main&per_page=1');
    const run = runs.workflow_runs?.[0];
    if (!run || !SHA.test(run.head_sha || '') || !Number.isSafeInteger(run.id)) return { state: 'unknown' };
    const relation = await request(`/compare/${mergeHead}...${run.head_sha}?per_page=1&page=2`);
    if (!['ahead', 'identical'].includes(relation.status) || relation.merge_base_commit?.sha !== mergeHead) return { state: 'pending' };
    return { state: run.status === 'completed' && ['failure', 'cancelled', 'timed_out', 'action_required'].includes(run.conclusion) ? 'failed' : 'pending', url: `https://github.com/${REPOSITORY}/actions/runs/${run.id}` };
  } catch { return { state: 'unknown' }; }
}
