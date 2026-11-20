// Trusted-base policy. CODEOWNERS is advisory; all required gates are automated.
export const ACTIONS_APP_ID = 15368;
const blocked = message => Object.assign(new Error(message), { status: 403 });
export async function verifyPublicationPolicy(request, { manual = false } = {}) {
  let repo, policy, rules;
  try { [repo, policy, rules] = await Promise.all([request(''), request('/branches/main/protection'), request('/rules/branches/main')]); }
  catch (error) { throw blocked(`Cannot verify main protection (${error.status || 'network error'}). Ask a maintainer to verify classic branch protection and this account's policy-read permission. Publishing remains blocked.`); }
  const reject = detail => { throw blocked(`Publication policy blocked: ${detail}. Ask a maintainer to correct repository policy; no protection bypass is supported.`); };
  if (!Array.isArray(rules) || rules.length) reject('ruleset protection is unsupported; review effective rules before enabling publishing');
  if ((!manual && repo.allow_auto_merge !== true) || repo.allow_squash_merge !== true) reject(manual ? 'squash merges must be enabled' : 'native auto-merge and squash merges must be enabled');
  if (policy.enforce_admins?.enabled !== true) reject('administrator enforcement is required');
  if (policy.allow_force_pushes?.enabled !== false || policy.allow_deletions?.enabled !== false) reject('force pushes and deletion must be disabled');
  if (policy.restrictions != null) reject('restricted push actors require an explicit compatibility review');
  const reviews = policy.required_pull_request_reviews;
  // A successful review-settings subresource is not evidence that PR protection
  // is enabled. GitHub can retain those preferences with the outer rule off.
  if (!reviews) reject('GitHub does not report enabled pull-request protection for main; inspect Require a pull request before merging with zero required approvals');
  if (reviews.required_approving_review_count !== 0 || reviews.require_code_owner_reviews !== false || reviews.require_last_push_approval === true) reject('require PRs with zero human approvals, code-owner approval disabled, and no last-push approval requirement');
  if (Object.values(reviews.bypass_pull_request_allowances || {}).some(list => !Array.isArray(list) || list.length)) reject('PR bypass allowances must be empty');
  const checks = policy.required_status_checks;
  if (checks?.strict !== true || !['validate', 'cms-publication-scope'].every(name => checks.checks?.some(check => check.context === name && check.app_id === ACTIONS_APP_ID))) reject('strict validate and cms-publication-scope checks must be bound to GitHub Actions');
}

