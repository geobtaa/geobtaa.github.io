> Superseded for the current release by [PR-only publishing](CMS_PR_ONLY.md). Automatic merging, the six-stage Actions orchestration proposal, and CMS deployment tracking are abandoned. The text below records the earlier design.

# CMS publishing release checklist

This is a proposed future procedure, not authorization to push, merge, deploy, change settings or publish now. Keep `CMS_PUBLISH_ENABLED=false` until the separately authorized smoke test.

## 1. Exact local commit boundaries and installation order

The completion report provides the exact SHAs. Local refs are `editor/cms-release` (Stage 2 checkpoint), `editor/cms-bootstrap` (one consolidated PR 1 commit, parent main `ab86dd6`), and `editor/cms-activation` (one PR 2 activation commit, parent the bootstrap commit). These branches/commits are prepared locally only. Do not merge or cherry-pick the whole Stage 1/Stage 2 checkpoint directly to main: those checkpoints contain activation files that must be deferred.

**PR 1 — application and trusted validation bootstrap:** use the one commit at `editor/cms-bootstrap`. It consolidates the reviewed application baseline (`6d51b74`), Save Draft (`3f114ac`), origin/config isolation (`ece758f`), discovery fix (`125eec8`), Stage 1 (`aaafcc7`), and Stage 2 checkpoint. It copies the narrowed proposal into `.github/CODEOWNERS` for advisory technical reviews (confirm both accounts have write access before merging), and contains the current release tree EXCEPT:

- `.github/workflows/cms-publication-scope.yml` is absent.
- `.github/workflows/astro.yml` is kept byte-for-byte at the existing main version.
- `editor-prototype/deployment-workflow.test.mjs` is deferred, because it asserts the activated Pages workflow.

PR 1 DOES include the marker CLI and its independent CLI test, all other unit/API/browser tests, the revised `validate.yml`, and the new trusted classifier's `--github-output` support. On the old trusted base the classifier is absent, so the plan explicitly selects full browser coverage; site validation and all browsers must pass. There is no new scope workflow to fail on a missing base implementation. The missing active-workflow contract test is not reported as skipped/successful: it simply arrives with the workflow it tests in PR 2. Keep Publish disabled. Do not require `cms-publication-scope` before it exists. If main advances before PR 1, rebase the bootstrap patch onto fresh main and review conflicts rather than overwriting main changes.

**PR 2 — activate checks and deployment proof:** after PR 1 merges, fetch actual main, create a fresh ordinary branch from it and replay ONLY the one activation commit at `editor/cms-activation`. This patch changes exactly:

1. `.github/workflows/cms-publication-scope.yml` — install the independent required-check candidate.
2. `.github/workflows/astro.yml` — activate serialized main-only deployment and marker generation.
3. `editor-prototype/deployment-workflow.test.mjs` — activate its workflow contract test.

GitHub's PR 1 merge/squash/rebase can change the actual main SHA. Replaying the activation patch onto that actual main is mandatory; the source validator rejects a PR missing current-main ancestry. The replayed commit receives a new SHA but keeps the three-file boundary and preserves the advisory CODEOWNERS installed by PR 1. Do not submit the unreplayed stacked branch against main blindly.

For PR 2, trusted main now contains the checker, its output protocol and dependencies. The independent scope job and classification job inspect the ordinary three-file diff using trusted code; browser/site checks run, and the activated workflow contract test sees the new workflow. No code/checker chicken-and-egg remains. Confirm both actual GitHub check names and source app, and let the revised Pages deployment succeed with a valid public marker BEFORE requiring/enabling the publishing configuration below. No local test result is a claim that these Actions jobs have run live.

See [coverage, timings, repeat-edit/MDX limits and live gates](CMS_RELEASE_FINAL_CHECKS.md).

## 2. GitHub dashboard configuration (later, explicitly authorized)

Repository: `geobtaa/geobtaa.github.io`.

- **Settings → Branches → classic protection → main:** Require a pull request. Leave Require approvals OFF (API required count 0), Require review from Code Owners OFF, and approval of the most recent push OFF. Stale-approval dismissal may be either value; it is not required.
- Require status checks **validate** and **cms-publication-scope**, bound to the **GitHub Actions** app (ID 15368). Require branches to be up to date. Enable **Do not allow bypassing the above settings** / administrator enforcement. Leave PR bypass allowances empty. Disable force pushes and deletion. Keep restricted-push actor lists off. No additional rulesets/merge queue are currently supported by the verifier.
- **Settings → General → Pull Requests:** Allow auto-merge ON; Allow squash merging ON. Do not add a CMS bypass actor. Keep automatic branch deletion OFF while snapshot/coordinator history is retained for recovery.
- Confirm `@karenmajewicz` and `@ewlarson` have write access before merging PR 1, which installs the technical-only advisory CODEOWNERS copied from the proposal. No catch-all owns routine documents/uploads. Ownership must not become a required approval gate.
- **Settings → Pages:** Source remains GitHub Actions and public custom domain remains `gin.btaa.org`. **Settings → Environments → github-pages:** restrict deployment branches to main; no required environment reviewer if publication is to remain automatic. Retain existing domain/HTTPS configuration.
- Verify intended editor accounts have repository write access, OAuth authorization and any required organization/SSO approval. Test policy/check/PR/Actions/deployment reads with an intended non-admin account while CMS Publish remains disabled. Do not broaden OAuth scopes or distribute the maintainer's token merely to make the test pass.
- Optional hardening: default Actions token permissions read-only and disable workflow-generated PR approvals. Keep explicit Pages permissions for the main-only deployment workflow. All repository writers remain trusted to change application/security code under this no-mandatory-review governance.

## 3. Cloudflare configuration (later, explicitly authorized)

- Keep `geobtaa-github-io` on custom-cms and its OAuth App/secrets unchanged.
- After the reviewed release reaches main, switch `gin-editor`'s production branch to main and verify its build/authentication at the existing hostname/callback. Retain `EDITOR_ORIGIN=https://gin-editor.pages.dev`, existing dedicated OAuth credentials/session secret, repo owner/repository and editor allowlist. Stage 2 needs no additional secrets.
- Keep authenticated previews disabled. Exclude `cms/drafts/*`, `cms/publish/*`, and `cms/publication-state/*` from Cloudflare preview builds in both projects. Retain the generated commit skip marker. Verify actual absence of these builds; main application/content merges may still build the main-based editor.
- Keep `CMS_PUBLISH_ENABLED=false` throughout application rollout and read-only checks. A later explicit approval may enable it only on the canonical gin-editor production environment for the smoke test.

## 4. Safest first live publication (separate authorization required)

- Use one designated harmless NEW document, e.g. `src/content/docs/library/cms-publishing-smoke-test.mdx`, with a non-sensitive paragraph and no uploads initially. Agree on its public route/visibility in advance; publishing really makes it public. Do not use or alter the existing report draft or other editors' drafts.
- Save/reopen first; record the exact saved head. Confirm main, production Pages and staging builds are unchanged by Save Draft.
- Enable Publish only for the authorized test window. Publish that selected revision once. Record coordinator/snapshot heads and PR number. Inspect the PR diff: one document, no application/configuration changes. Confirm both checks run, no approvals are required, native squash auto-merge honors strict protection, and no Cloudflare preview/staging deployment runs for CMS branches.
- Watch status from a second authorized account/reload. It must stay Publishing until Pages succeeds, the public marker identifies the correct run/source and the public document hash matches. Verify the public URL independently. Repeat Publish for the same revision only to verify reuse/terminal recovery, never as a workaround for deployment failure.
- Exercise native auto-merge both while checks are pending and on retry with already-green checks; stop if the supposedly automatic path requires unexplained manual merging. Verify the second ordinary current-main edit path for the same document, with old drafts/locks preserved.
- Measure cold/warm status latency, CPU/subrequests, GitHub rate-limit cost and cache propagation. Follow with controlled stale/concurrent/newer-draft and image tests only after this basic path succeeds. Long-history Free-plan limits and non-admin policy reads are explicit release gates.
- If anything is uncertain, disable the CMS flag to prevent new requests, then inspect any already-enabled auto-merge PR: disabling the flag does NOT cancel a queued GitHub merge. Close an unmerged test PR only after checking authoritative state. If merged, investigate/rerun Pages; do not create another publication for the same revision. Correct published test content later through a normal content PR. Never force-push main or blindly delete draft/route/publication locks.
