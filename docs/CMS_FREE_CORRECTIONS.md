# Cloudflare Free qualification — focused corrections

> Subsequent read-only verification passes after the maintainer corrected GitHub protection: effective PRs are required with zero approvals, strict Actions checks, administrator enforcement and no bypasses. The diagnosis below records the earlier configuration; the verifier was not relaxed. Actual Cloudflare runtime qualification remains outstanding.

This records the authorized correction phase after checkpoint 3. No GitHub settings, Cloudflare settings, OAuth grants or live repository content were changed. No publication was retried. [Original measurements](CMS_FREE_QUALIFICATION_RESULTS.json) remain preserved; [corrected measurements](CMS_FREE_CORRECTION_RESULTS.json) were taken with the same network-disabled Pages-handler harness.

## Protection diagnosis

Read-only requests with the existing administrator credential returned HTTP 200 for the effective REST protection response and GraphQL rule. This is not a missing-permission response. Explicit REST API versions `2022-11-28` and `2026-03-10` both omit `required_pull_request_reviews`.

The effective GraphQL rule for `refs/heads/main` reports:

- `requiresApprovingReviews: false`, `requiredApprovingReviewCount: null`;
- `requiresCodeOwnerReviews: false`, `requireLastPushApproval: false`;
- administrator enforcement, strict required checks bound to GitHub Actions, no force pushes/deletion, and zero PR/force-push bypass actors;
- no effective rulesets.

The separate REST `/protection/required_pull_request_reviews` endpoint returns retained preferences with **one** required approval, not zero, despite their absence from the effective protection object. A successful subresource response cannot prove that the outer PR requirement is enabled. Neither response establishes the intended PR-required/zero-approval policy. GitHub's [branch-protection API](https://docs.github.com/en/rest/branches/branch-protection) supports zero required reviewers; its [GraphQL rule fields](https://docs.github.com/en/graphql/reference/branches#branchprotectionrule) expose the independent enabled/count values. The UI distinguishes Require a pull request before merging from Require approvals in [GitHub's setup instructions](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/managing-a-branch-protection-rule).

The evidence is consistent with disabled PR protection/retained review preferences, rather than a valid verified zero-approval representation. Dashboard confirmation is still required. In Settings → Branches → main, inspect **Require a pull request before merging**, its approval toggle/count, code-owner/last-push approval requirements and bypass allowances. Any correction needs separate settings authorization. If the dashboard already shows the intended configuration, reconcile the API discrepancy with GitHub before rollout; do not assume the UI or subresource overrides effective API evidence.

**The verifier correctly remains blocked.** Its acceptance conditions are unchanged. Its 403 now explains missing effective PR protection specifically. A regression verifies that missing/null effective protection remains rejected even if review preferences would be readable with count zero. No GraphQL fallback, extra per-publication policy request, credential expansion or settings change was introduced. Enabled PR protection with zero approvals still passes the local contract fixture.

## History batching

Previously `inspect()` made one REST request for every uncached historical commit. It now reads up to 100 immutable commits per GraphQL request, anchored at the exact missing commit OID. The existing invocation-local commit cache shares those objects between the initial open, Save Draft and route discovery. On reaching an uncached parent beyond a batch, the next query starts at that exact parent; response ordering is not evidence of ancestry.

Every prior inspector condition remains: each exact parent, single-parent ancestry, full document/cycle identity, retired-ancestor rejection, predecessor preservation, recorded main baseline/ancestry, final complete tree scope, immutable asset digest/manifest, content metadata, authorization and atomic non-force ref preconditions. Mutable refs are still read normally. The existing 1,000-revision integrity bound is unchanged. There is no persisted verification cache, new state, relaxed check, historical deletion or automatic rebase.

Malformed/missing/error/duplicate history responses fail closed. Reordered nodes are accepted only when following their actual parent identities succeeds. Regression fixtures cover 28, 61 and 221 revisions, corrupted ancestors beyond a batch boundary, unavailable history, stale browser saves and the existing 1,000-revision bound. Existing publication/repeat-editing/image/concurrency regressions continue to run the complete independent checker.

The exact new query was also executed **read-only** against saved revision `5fe43d8`; GitHub returned the requested commit and 100 history nodes with no GraphQL error. This confirms response compatibility, not hosted CPU or full live publication qualification.

## Measured requests per invocation

Fresh means a fresh local Node process/compiler cache, not an observed Cloudflare cold isolate. Warm means the same local module with reset Git fixtures. Each profile includes 168 other published documents and two other working drafts. History counts include the initial saved revision. The full run includes 37 profiles / 111 invocations, each with expected HTTP 200/201 and no request overrun in this inventory.

| Active saved revisions | Operation | GitHub calls fresh / warm | Additional external calls | Total fresh / warm |
| --- | --- | ---: | ---: | ---: |
| 1 | Save Draft | 24 / 18 | 0 | 24 / 18 |
| 1 | Reopen | 7 / 7 | 0 | 7 / 7 |
| 1 | Discovery/list refresh | 10 / 10 | 0 | 10 / 10 |
| 28 | Save Draft | 25 / 19 | 0 | 25 / 19 |
| 28 | Reopen | 8 / 8 | 0 | 8 / 8 |
| 28 | Discovery/list refresh | 11 / 11 | 0 | 11 / 11 |
| 61 | Save Draft | 25 / 19 | 0 | 25 / 19 |
| 61 | Reopen | 8 / 8 | 0 | 8 / 8 |
| 61 | Discovery/list refresh | 11 / 11 | 0 | 11 / 11 |
| 601 | Save Draft | 30 / 24 | 0 | 30 / 24 |
| 601 | Reopen | 13 / 13 | 0 | 13 / 13 |
| 601 | Discovery/list refresh | 16 / 16 | 0 | 16 / 16 |

List refresh after Save Draft is a separate invocation, not an extra 11 calls within the PUT. OAuth fixture setup is outside these measurements; measured content invocations decrypt the session locally and do not refresh OAuth. External fetches to GitHub are counted individually; redirects already fail closed. The harness now explicitly records GitHub API, additional external and total calls, and source SHA-256 fingerprints because the parent commit predates these tracked working-tree corrections.

PR preparation/creation/status remain 3/23/8 calls; creation with an image uses 24, duplicate creation 18, attempt 21 creation 27, and status with 20 attempts 9. Pending image preparation uses zero GitHub calls; image-bearing Save Draft uses 25 fresh / 19 warm. Post-merge repeat save uses 37 / 31. None of the other hosted size/asset/inventory/retry caps were raised or changed.

Reproduce from the repository root:

```sh
node scripts/qualify-cms-free.mjs --filter '^(save|reopen|discovery)-(small|history-27|history-60)$' --output /tmp/cms-free-focused.json
node scripts/qualify-cms-free.mjs --output /tmp/cms-free-all.json
```

These are logical outgoing-call counts through the real handler and mocked transport, not actual Cloudflare telemetry. The tested profiles now satisfy the local request budget, including headroom below 50. More simultaneous long-lived drafts, many assets or a larger repository can still cost more. The 100-asset/100-attempt/250,000-character limits remain unqualified near their boundaries.

**Cloudflare CPU remains unqualified.** Node CPU, including costly document/image work and mock transport overhead, does not certify 10 ms. Actual cold/warm Pages CPU/subrequests, larger/protected documents, images and intended-account authentication still require the separately authorized capture procedure in [qualification](CMS_FREE_QUALIFICATION.md). No hosted test/deployment was attempted.

## Validation and release status

Local validation passed: **245 unit/API**, **54 browser**, **1 configuration**, **2 render** and **2 navigation** tests; Astro sync/check with zero errors/warnings and four existing hints; production build of **171 pages** with valid internal links. The unchanged trusted-main source checker accepted the complete **49-file** local release-tree fixture, including the corrections and qualification artifacts. This is local evidence, not a live Actions run.

An initial navigation check used a build made concurrently with render fixtures and correctly rejected a temporary source route. After render cleanup, the production build and navigation checks were run sequentially and passed. No application/test assertion was changed to address this test-ordering mistake. Run render fixtures before the final build/navigation gate.

Production eligibility remains **NO-GO** until actual Cloudflare runtime qualification passes. Effective protection now passes subsequent administrator read-only verification; intended-account OAuth verification remains a live-test gate. The [release checklist](CMS_FREE_RELEASE_CHECKLIST.md) still requires updated independent validation on main before use of new CMS publishing/cycle code.

The live saved revision `5fe43d83398d994fdf86beee7bcc5c01a59a38ec`, snapshot `fd2b06259282ab1421a7c6d8070932f70b880c61`, coordinator `90d87e48650a421a939531ced7ccbcc3ad03e866`, retained lock and main `b2f6e6e` were rechecked read-only and remain unchanged. No draft, route reservation or publication ref was modified.
