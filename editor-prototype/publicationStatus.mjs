export const PRODUCTION_ORIGIN = 'https://gin.btaa.org';
export const PAGES_WORKFLOW = '.github/workflows/astro.yml';
export async function readProductionMarker() {
  const response = await fetch(`${PRODUCTION_ORIGIN}/_cms/deployment.json?cms=${Date.now()}`, { redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(8000), headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('The website revision marker is not available yet.');
  return response.json();
}
export async function productionDocumentHash(route) {
  const path = route.split('/').map(encodeURIComponent).join('/');
  const response = await fetch(`${PRODUCTION_ORIGIN}/${path ? `${path}/` : ''}?cms=${Date.now()}`, { redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error('The public document could not be fetched.');
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > 2_000_000) throw new Error('The public document exceeds the verification size limit.');
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
const validSHA = value => /^[a-f0-9]{40}$/.test(value || '');
const failureConclusions = new Set(['failure', 'timed_out', 'cancelled', 'action_required', 'startup_failure']);
// Reads only. No polling call may create a PR, retry a merge, or advance refs.
export async function trackPublication({ request, publication, repository, readMarker, snapshot, contains, matches, readDocumentHash }) {
  const { attempt, pr, selectedHead, path } = publication;
  const result = (state, message, extra = {}) => ({ state, message, selectedHead, snapshotHead: attempt.head, number: pr?.number, url: pr?.html_url, ...extra });
  if (!pr) return result('publishing', 'Publishing · snapshot saved; retry Publish to confirm PR creation.');
  if (pr.head?.sha !== attempt.head || pr.head?.ref !== attempt.branch || pr.head?.repo?.full_name !== repository || pr.base?.ref !== 'main') throw new Error('Publication PR identity could not be verified.');
  if (!pr.merged_at) {
    if (pr.state === 'closed') return result('action-required', 'Publication PR closed without merging. Retry Publish for this saved revision.');
    if (pr.mergeable === false || pr.mergeable_state === 'dirty') return result('conflict', 'Publication has merge conflicts. Retry Publish; changes to this document on main require maintainer reconciliation.');
    if (pr.mergeable_state === 'behind') return result('action-required', 'Main advanced. Retry Publish to rebuild this same saved revision.');
    const checks = await request(`/commits/${attempt.head}/check-runs?filter=latest&per_page=100`);
    if (!Array.isArray(checks.check_runs) || checks.total_count > 100) throw new Error('Required-check results are incomplete.');
    const required = ['validate', 'cms-publication-scope'].map(name => checks.check_runs.filter(check => check.name === name && check.app?.id === 15368).sort((a, b) => b.id - a.id)[0]);
    if (required.some(check => check?.status === 'completed' && check.conclusion !== 'success')) return result('validation-failed', 'Publication checks failed or were cancelled. Open the PR checks to resolve the problem; the saved draft is intact.');
    if (required.some(check => !check || check.status !== 'completed')) return result('publishing', 'Publishing · waiting for required validation checks.');
    if (!pr.auto_merge) return result('action-required', 'Checks passed; native auto-merge is not confirmed. Retry Publish or inspect the PR.');
    return result('publishing', 'Publishing · checks passed; waiting for GitHub to merge.');
  }
  if (!validSHA(pr.merge_commit_sha)) throw new Error('GitHub has not returned the merge revision yet.');
  const expected = await snapshot(publication);
  let marker;
  try { marker = await readMarker(); } catch { marker = null; }
  if (marker && marker.version === 1 && marker.repository === repository && marker.environment === 'github-pages' && marker.workflow === PAGES_WORKFLOW && validSHA(marker.sha) && Number.isSafeInteger(marker.runId) && marker.runId > 0 && Number.isSafeInteger(marker.runAttempt) && marker.runAttempt > 0) {
    // Validate the workflow/run AND environment deployment AND live marker.
    const run = await request(`/actions/runs/${marker.runId}`);
    const workflow = await request('/actions/workflows/astro.yml');
    if (run.id === marker.runId && run.workflow_id === workflow.id && run.path === PAGES_WORKFLOW && run.repository?.full_name === repository && run.head_branch === 'main' && ['push', 'workflow_dispatch'].includes(run.event) && run.head_sha === marker.sha && run.run_attempt === marker.runAttempt && run.status === 'completed' && run.conclusion === 'success') {
      const deployments = await request(`/deployments?environment=github-pages&sha=${marker.sha}&per_page=100`);
      if (!Array.isArray(deployments) || deployments.length >= 100) throw new Error('Deployment inventory is incomplete.');
      for (const deployment of deployments) {
        if (deployment.environment !== 'github-pages' || deployment.sha !== marker.sha || deployment.ref !== 'main') continue;
        const statuses = await request(`/deployments/${deployment.id}/statuses?per_page=1`);
        const status = statuses[0];
        if (!Array.isArray(statuses) || status?.state !== 'success' || status.environment !== 'github-pages') continue;
        let origin; try { origin = new URL(status.environment_url).origin; } catch { continue; }
        if (origin !== PRODUCTION_ORIGIN || !status.log_url?.startsWith(`https://github.com/${repository}/actions/runs/${run.id}/`)) continue;
        if (!await contains(pr.merge_commit_sha, marker.sha)) continue;
        const document = marker.documents?.[path];
        if (!await matches(expected, marker.sha)) return result('superseded', 'The website has a newer or different version of this document. This saved revision is not confirmed live.');
        if (document?.blob === expected.blob && document?.route === expected.route && /^[a-f0-9]{64}$/.test(document?.htmlHash || '')) {
          let htmlHash; try { htmlHash = await readDocumentHash(expected.route); } catch { return result('publishing', 'Publishing · waiting to verify the public document.'); }
          if (htmlHash !== document.htmlHash) return result('publishing', 'Publishing · website caches have not confirmed the document revision yet.');
          let confirmed; try { confirmed = await readMarker(); } catch { return result('publishing', 'Publishing · rechecking the production revision.'); }
          if (!['version', 'repository', 'environment', 'workflow', 'sha', 'runId', 'runAttempt'].every(key => confirmed?.[key] === marker[key]) || confirmed?.documents?.[path]?.htmlHash !== document.htmlHash || confirmed?.documents?.[path]?.blob !== document.blob || confirmed?.documents?.[path]?.route !== document.route) return result('publishing', 'Publishing · production changed during verification. Refresh status.');
          return result('published', 'Published · verified on gin.btaa.org.', { mergeHead: pr.merge_commit_sha, deployedHead: marker.sha, deploymentId: deployment.id, runId: run.id, liveUrl: `${PRODUCTION_ORIGIN}/${expected.route ? `${expected.route}/` : ''}` });
        }
        return result('checking', 'The deployed marker does not confirm this document output. Inspect the Pages workflow and refresh status.');
      }
    }
  }
  // An older successful deployment cannot hide a failed newer merge deployment.
  const runs = await request(`/actions/workflows/astro.yml/runs?branch=main&head_sha=${pr.merge_commit_sha}&per_page=100`);
  if (!Array.isArray(runs.workflow_runs) || runs.total_count > 100) throw new Error('Pages workflow inventory is incomplete.');
  let run = runs.workflow_runs.filter(item => item.head_branch === 'main' && item.head_sha === pr.merge_commit_sha && item.path === PAGES_WORKFLOW).sort((a, b) => b.id - a.id || b.run_attempt - a.run_attempt)[0];
  if (run?.status === 'completed' && failureConclusions.has(run.conclusion)) {
    const recent = await request('/actions/workflows/astro.yml/runs?branch=main&per_page=100');
    if (!Array.isArray(recent.workflow_runs)) throw new Error('Recent deployment progress could not be read.');
    for (const candidate of recent.workflow_runs.slice().sort((a, b) => b.id - a.id || b.run_attempt - a.run_attempt).slice(0, 10)) {
      if (candidate.head_branch !== 'main' || candidate.path !== PAGES_WORKFLOW || !validSHA(candidate.head_sha) || !await contains(pr.merge_commit_sha, candidate.head_sha)) continue;
      if (candidate.status !== 'completed') return result('publishing', 'Publishing · a newer production deployment containing this revision is underway.');
      if (candidate.conclusion === 'success') return result('publishing', 'Publishing · waiting to verify the newer production website revision.');
      run = candidate; break;
    }
    return result('deployment-failed', 'Changes merged; the GitHub Pages deployment failed or was cancelled. Ask a maintainer to inspect or rerun the Pages workflow, then refresh status. Do not publish another PR for this revision.', { mergeHead: pr.merge_commit_sha, runId: run.id });
  }
  return result('publishing', 'Publishing · changes merged; waiting to verify the production deployment.', { mergeHead: pr.merge_commit_sha });
}
