// Execute trusted main code only. Defaults to a read-only report.
import { appendFile } from 'node:fs/promises';
import { createDraftStore } from '../editor/draftStorage.mjs';
import { draftHeads } from '../editor/draftCycles.mjs';
import { draftMetadata } from '../editor/draftIdentity.mjs';
import { CONTENT_ROOT } from '../editor/contentAreas.mjs';

const apply = process.argv.includes('--apply');
if (process.argv.slice(2).some(arg => arg !== '--apply')) throw new Error('Usage: node scripts/cleanup-cms-branches.mjs [--apply]');
if (apply && (process.env.GITHUB_REF !== 'refs/heads/main' || !['schedule', 'workflow_dispatch'].includes(process.env.GITHUB_EVENT_NAME))) throw new Error('Apply cleanup only from a scheduled or manual main workflow.');
const [owner, repo, extra] = (process.env.GITHUB_REPOSITORY || '').split('/');
if (!owner || !repo || extra || !process.env.GITHUB_TOKEN) throw new Error('GITHUB_REPOSITORY and GITHUB_TOKEN are required.');
const request = async (path, options = {}) => {
  const response = await fetch(path === '/graphql' ? 'https://api.github.com/graphql' : `https://api.github.com/repos/${owner}/${repo}${path}`, {
    ...options, redirect: 'manual', signal: AbortSignal.timeout(30_000), headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json', 'User-Agent': 'cms-branch-cleanup' },
  });
  if (!response.ok) throw Object.assign(new Error(`GitHub cleanup request failed: ${response.status}`), { status: response.status });
  return response.json();
};
const documents = new Map();
for (const item of await draftHeads({ request, owner, repo })) {
  const meta = draftMetadata(item.value);
  if (!meta.path?.startsWith(`${CONTENT_ROOT}/`)) throw new Error('Unexpected draft path.');
  const [area, ...parts] = meta.path.slice(CONTENT_ROOT.length + 1).split('/');
  documents.set(meta.path, { area, filename: parts.join('/') });
}
const results = [];
for (const document of documents.values()) {
  try {
    // A fresh store avoids reusing evidence after another page is cleaned.
    const result = await createDraftStore({ request, owner, repo }).cleanupPublishedDrafts({ ...document, dryRun: !apply });
    results.push(result);
  } catch (error) {
    results.push({ path: `${CONTENT_ROOT}/${document.area}/${document.filename}`, state: 'error', reason: error.message });
    // Keep processing other pages, but make unexpected/API failures visible.
    process.exitCode = 1;
  }
  console.log(JSON.stringify(results.at(-1)));
}
if (process.env.GITHUB_STEP_SUMMARY) {
  const counts = state => results.filter(result => result.state === state).length;
  await appendFile(process.env.GITHUB_STEP_SUMMARY, `CMS branch cleanup (${apply ? 'apply' : 'dry run'}): ${counts('deleted')} pages cleaned, ${counts('eligible')} eligible, ${counts('kept')} kept, ${counts('error')} errors.\n\nPer-page reasons and removed reference names are in the step log.\n`);
}
