# Lightweight content discovery

The area list is a repository inventory, not verified editing state. It lists files on a pinned `main` revision and saved-work candidates identified by canonical path and deterministic branch identity. It does not walk draft history or verify document scope, assets, route reservations, publication state, or draft continuation ancestry. Those checks remain mandatory in the authoritative document, save, and publication endpoints. The strict internal `listContent` operation is unchanged.

## List semantics

- `On main` describes the repository baseline, not a claim that a page is live. Frontmatter visibility is unknown until opening the document.
- `New saved draft` and `Saved work available` are provisional hints. The response contains no editing SHA/head, route authority, or verified draft status.
- Retained generations are grouped into one row per canonical path. Discovery never selects an editing generation using time, branch order, or a retirement marker. Multiple apparent active candidates show `Needs review`; opening the document resolves the actual continuation using existing checks.
- Malformed candidate identity or a missing candidate blob produces an incomplete-indicators warning. It cannot grant editing permission or hide the main inventory. Incomplete GraphQL pagination, permissions, or tree evidence fails the request rather than returning a silently truncated list.
- All draft-ref pages are enumerated (100 per page, the existing 5,000-ref guard). Immutable main tree and candidate-blob existence reads are batched in groups of 24; nested directories are walked. The inventory has a 10,000-object guard. These are discovery bounds, not new saved-history limits.

## Navigation and list reuse

The mounted editor keeps at most one catalog per enabled area in memory, scoped to browser origin, API endpoint, workspace and signed-in account. Returning to an area shows these rows immediately and always starts a fresh discovery request. `Refreshing content list…` distinguishes remembered rows from a completed read; a failed refresh leaves an explicit out-of-date message. Sequence and authentication-epoch guards discard late responses after navigation or session changes.

No catalog is written to browser storage, reused across tabs/reloads/accounts, or used to initialize an editable document. Sign-out and authentication loss clear it. Opening a selected row always displays `Checking document and saved work…` until the authoritative document endpoint succeeds. Existing browser recovery storage is separate and unchanged. Successful Save Draft refreshes the area catalog, including newly created documents; failed refreshes cannot undo a confirmed save. New-entry conflict hints remain advisory, with authoritative route reservations and validation on save.

## Read-only measurements

[Raw traces](CMS_CONTENT_DISCOVERY_RESULTS.json) use the local real Pages handler and live GitHub, with every mutation blocked. They are not hosted Cloudflare CPU/subrequest telemetry or authenticated browser Network measurements. Main was `346d4543f14f5ae9b45fa0058f93388eec120256`; Library returned 48 rows in each run. Byte counts are decoded JSON.

| Library list | Existing verified list, three runs | Lightweight list, two runs |
| --- | --- | --- |
| Elapsed seconds | 11.88 / 16.69 / 16.89 | 1.18 / 0.63 |
| GitHub calls per invocation | 32 | 2 |
| GitHub response bytes | 2,877,648 | 8,624 |
| Client response bytes | 14,712 | 14,124 |

This removes 30 requests and about 99.7% of GitHub response bytes for this inventory. GitHub/network variability prevents treating two timings as percentiles. Larger inventories add ref pages and immutable-object batches, not one complete verification per draft. Ordinary selected-document opening remains the same authoritative operation; it is not expected to receive the list speedup. One cold test-document run remained slow (about 15.64 seconds), versus 5.08 seconds warm; the workgroup document took about 2.97 seconds on the first run. These paths are unchanged by discovery.

The harness remains `node --env-file-if-exists=.env.local scripts/profile-cms-reads.mjs /tmp/cms-read-profile-results.json`. Node CPU values include process/JIT overhead and cannot certify Cloudflare's CPU allowance. Hosted cold/warm CPU measurements and authenticated browser timings remain release gates. No drafts, publication refs, reservations, live settings, or deployments were changed for this checkpoint.

## Separate CI activation

Recent publication validation runs spent 48–64 seconds in render fixtures before starting the production build. An isolated `render-tests` job can overlap that work with Astro/unit/build/navigation checks. It must use its own checkout because the fixtures create temporary content and build output. Render coverage still runs for every CMS snapshot and ordinary source PR, and required `validate` must fail unless it succeeds. The existing trusted snapshot classifier remains the only authority for skipping unrelated browser tests; labels, filenames and branch names do not grant a skip. GitHub Pages deployment is unchanged.

This needs two installation steps: the currently installed trusted source validator enforces the existing three-job validation contract. The source branch therefore leaves `validate.yml` unchanged and adds tested support for both the installed contract and an equally strict four-job contract. Merge that source change first. Then prepare the separately committed workflow activation from updated main. Activating the workflow before the trusted validator reaches main will correctly fail the independent scope check. No dashboard settings, credentials, new required-check names or infrastructure are needed; `validate` and `cms-publication-scope` remain required.

The activation moves the render command out of `site-validation`, adds an unconditional isolated job, adds it to the `validate` dependencies, and binds its actual result in the fail-closed final gate. Regression tests reject omitted or skipped fixtures, wrong checkout, missing installation, ignored failures, forged results and a weakened browser condition. Parallel runner/setup overhead and runner availability mean actual publication time savings require a GitHub Actions run after authorized release; local timings do not establish a CI speedup.

## Qualification and release

Local validation passes: 269 unit/API/workerd tests, 59 Chrome browser tests (none skipped), configuration (1), Astro-render fixtures (2), Astro checks (zero errors/warnings, four existing hints), the production build (179 pages), and navigation (2). The new tests cover main/new/nested inventories, a 61-revision draft without history reads, pagination/permissions/missing evidence, tampered drafts rejected on open, retained-generation continuations, delayed refreshes, stale lists and authentication clearing. Existing Save Draft, concurrency, image, recovery and publication regressions remain in the full suites. The render fixtures took about 28 seconds locally; runner timings differ from the measured GitHub Actions runs above.

Release order, requiring separate authorization:

1. Review and release `editor/cms-lightweight-discovery` (discovery, memory reuse and trusted CI-contract support). The installed validation workflow remains unchanged, so current main can validate this source PR.
2. After that PR reaches main, create the CI activation PR from updated main using only the activation commit prepared on `editor/cms-render-ci-activation`. Do not use the activation branch as an initially stacked release PR.
3. Check both required jobs and the isolated render job on that activation PR. Confirm that a verified CMS snapshot still skips only browsers and that ordinary source still runs the full browser suite.
4. After authorized deployment, measure authenticated Library cold/warm list and document navigation with browser Network timings and Cloudflare CPU/subrequests. Expect the list improvement, not a guarantee of faster verified document opening. No Cloudflare/GitHub settings, OAuth changes, publishing toggles, draft cleanup, editor-only packaging or root redirects are part of these changes.
