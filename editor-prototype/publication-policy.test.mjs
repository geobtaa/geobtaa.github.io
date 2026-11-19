import { publicationTestClient } from './publicationTestHelpers.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyPublicationPolicy } from './publicationPolicy.mjs';
import { verifyPullRequestEligibility } from './pullRequestEligibility.mjs';
import { draftTestRepository } from './draftTestRepository.mjs';
import { parsePage, savePage } from './page.mjs';
test('only the complete current snapshot contract gives CMS eligibility; a name or document-shaped diff cannot', async () => {
  const repo = await draftTestRepository({ 'src/content/docs/library/report.mdx': '---\ntitle: Report\n---\n\nOriginal.' });
  const store = () => publicationTestClient({ request: repo.request });
  const file = await store().getContent('library', 'report.mdx');
  const saved = await savePage(store(), 'library', 'report.mdx', { ...file, ...parsePage(file.content), body: 'Safe edit.' });
  await store().publishContent({ area: 'library', filename: 'report.mdx', head: saved.head });
  const pr = repo.pulls[0];
  assert.equal(await verifyPullRequestEligibility({ request: repo.request, store: store(), pr, repository: 'geobtaa/geobtaa.github.io' }), 'cms-snapshot');
  for (const changed of [{ ...pr, head: { ...pr.head, sha: saved.head } }, { ...pr, head: { ...pr.head, ref: 'cms/publish/forged' } }, { ...pr, head: { ...pr.head, repo: { full_name: 'attacker/fork' } } }]) await assert.rejects(verifyPullRequestEligibility({ request: repo.request, store: store(), pr: changed, repository: 'geobtaa/geobtaa.github.io' }));
});
test('policy verifier rejects weak checks, missing enforcement, bypasses, permissions and unsupported mechanisms', async () => {
  const repo = await draftTestRepository();
  const baseline = await repo.request('/branches/main/protection');
  await verifyPublicationPolicy(repo.request);
  await verifyPublicationPolicy(path => path === '/branches/main/protection' ? { ...baseline, required_pull_request_reviews: { ...baseline.required_pull_request_reviews, dismiss_stale_reviews: false } } : repo.request(path));
  const policies = [
    { ...baseline, enforce_admins: { enabled: false } },
    { ...baseline, allow_force_pushes: { enabled: true } },
    { ...baseline, allow_deletions: { enabled: true } },
    { ...baseline, required_status_checks: { strict: false, checks: baseline.required_status_checks.checks } },
    { ...baseline, required_status_checks: { strict: true, contexts: ['validate', 'cms-publication-scope'] } },
    { ...baseline, required_pull_request_reviews: { ...baseline.required_pull_request_reviews, bypass_pull_request_allowances: { users: ['cms-user'] } } },
    { ...baseline, required_pull_request_reviews: { ...baseline.required_pull_request_reviews, required_approving_review_count: 1 } },
    { ...baseline, required_pull_request_reviews: { ...baseline.required_pull_request_reviews, require_code_owner_reviews: true } },
    { ...baseline, required_pull_request_reviews: { ...baseline.required_pull_request_reviews, require_last_push_approval: true } },
  ];
  for (const policy of policies) await assert.rejects(verifyPublicationPolicy(path => path === '/branches/main/protection' ? policy : repo.request(path)), /policy blocked/);
  for (const status of [403, 404, 500]) await assert.rejects(verifyPublicationPolicy(() => { throw Object.assign(new Error('Denied'), { status }); }), /policy-read permission/);
  repo.rules = [{ type: 'pull_request' }]; await assert.rejects(verifyPublicationPolicy(repo.request), /ruleset protection is unsupported/);
});
