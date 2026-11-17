// Run only from trusted base code. PR source is inspected as data, never executed.
import { appendFile, readFile } from 'node:fs/promises';
import { createDraftStore } from '../editor-prototype/draftStorage.mjs';
import { verifyPullRequestEligibility } from '../editor-prototype/pullRequestEligibility.mjs';
const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, 'utf8'));
const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');
const request = async (path, options = {}) => {
  if (options.method && !(path === '/graphql' && options.method === 'POST' && /^query\b/.test(JSON.parse(options.body).query))) throw new Error('Eligibility checks are read-only.');
  const response = await fetch(path === '/graphql' ? 'https://api.github.com/graphql' : `https://api.github.com/repos/${owner}/${repo}${path}`, { ...options, headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json', 'User-Agent': 'cms-publication-scope' } });
  if (!response.ok) throw new Error(`GitHub eligibility read failed: ${response.status}`);
  return response.json();
};
const pr = event.pull_request;
if (!pr || pr.base.ref !== 'main') throw new Error('Expected a main PR event.');
const store = createDraftStore({ request, owner, repo });
const kind = await verifyPullRequestEligibility({ request, store, pr, repository: `${owner}/${repo}`, report: summary => console.log(JSON.stringify(summary)) });
console.log(kind);
if (process.argv.includes('--github-output')) {
  if (!['cms-snapshot', 'validated-source'].includes(kind) || !process.env.GITHUB_OUTPUT) throw new Error('Invalid trusted classification output.');
  await appendFile(process.env.GITHUB_OUTPUT, `kind=${kind}\n`);
}
