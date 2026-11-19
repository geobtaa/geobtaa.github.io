# CMS read-performance checkpoint

This checkpoint changes read scheduling, response payloads and navigation only. There is no editor-only deployment packaging, root redirect, persistent cache, new service, credential change, live publication, push or deployment. All live profiling operations were guarded GETs or GraphQL queries; no draft/publication mutation was attempted.

## Changes

- Opening a selected document fetches its authoritative document endpoint without reloading the area list. Existing list state is preserved within the same area. Entering/returning to the list, opening a new-entry form, and a successful Save Draft refresh the list. Switching areas clears the previous area's rows. Direct links work without a list request. Existing document conflict and recovery handling remain intact.
- CMS ancestry comparisons request `per_page=1&page=2`, retaining status and merge-base evidence while omitting first-page file patches. Identical known immutable OIDs reuse the existing no-request path. Missing, unknown or internally inconsistent evidence fails closed; unavailable/unauthorized responses propagate. The independent ordinary-source validator is unchanged.
- An invocation-local queue permits at most two immutable reads simultaneously. Independent base/draft trees and ancestry evidence overlap; draft verification and document-text batches use bounded pairs. Full scope/ancestry/image verification still runs. Failures are awaited and propagated, not treated as missing drafts.
- Invocation-local caches share in-flight promises as well as completed immutable objects. Cycle discovery seeds the existing commit cache from already returned inventory evidence. No mutable ref/lock readback is removed, memoized or shared across requests; no validation result persists between invocations.

## Measurement

The same real Pages-handler harness used for the diagnosis ran against live GitHub before and after changes. It used a local synthetic session with the existing GitHub credential; it did not access a live Cloudflare editor session. [Raw timing traces](CMS_READ_PERFORMANCE_RESULTS.json) contain no tokens, cookies or document contents.

All responses were HTTP 200. Current main remained the same immutable SHA across the before/after runs. Library returned 48 entries. Byte counts are decoded GitHub JSON, not compressed wire traffic. Two runs show variability, not percentiles or a guarantee about production latency.

| Endpoint | Before seconds, runs 1 / 2 | After seconds, runs 1 / 2 | Calls before / after | GitHub bytes before / after | Client JSON bytes |
| --- | --- | --- | --- | --- | --- |
| Library list | 17.60 / 9.48 | 10.72 / 6.28 | 30 / 30 | 3,707,427 / 2,530,226 | 14,712 |
| Publishing-test document | 6.13 / 6.04 | 6.59 / 4.69 | 22 / 19 | 780,219 / 768,028 | 1,248 |
| Workgroup-report document | 3.25 / 3.55 | 2.50 / 2.80 | 12 / 12 | 2,144,291 / 972,970 | 18,124 |

Library payload decreased about 32%; report payload decreased about 55%. One publishing-test run was slower despite fewer requests, so a uniform backend speedup is not established. Request traces show a peak of two simultaneous outbound calls in all six after-change invocations. The sum of overlapping GitHub request durations now exceeds elapsed time and is not a latency total.

The document-opening UI previously waited for both list and document. It now waits only for the document: at this inventory, this removes a separate 30-call / 3.71 MB baseline list invocation per document opening. This structural improvement is verified with browser tests; the table is individual API latency, not measured authenticated browser end-to-end navigation.

No authenticated Cloudflare Network trace or hosted CPU measurements were available. Node process CPU is recorded in the raw traces but cannot certify Cloudflare's Free CPU allowance. Reduced payload lowers JSON-processing work, but image verification, YAML/Markdown processing and large inventories still require actual hosted qualification. Bounded overlap can change peak memory; it is not permission to increase limits or skip checks.

## Comparison correctness

Read-only live GitHub checks verified the new comparison on identical, one-commit-ahead, one-commit-behind, divergent and unavailable commits. For one-commit comparisons, page two returned an empty commit array while still supplying correct status and merge-base fields. No decision depends on that array or on file patches. Missing commits failed with 404. Regression tests also reject missing fields, unknown statuses and inconsistent ahead/behind/identical evidence.

Do not use the smaller response for code that needs a complete commit/file inventory. The full independent publication-snapshot validator, complete trees and asset checks remain authoritative. GitHub documents that files appear only on page one in its [comparison API](https://docs.github.com/en/rest/commits/commits#compare-two-commits).

## Reproduction and release gates

From the repository root, with the existing credential supplied through the environment:

```sh
node --env-file-if-exists=.env.local scripts/profile-cms-reads.mjs /tmp/cms-read-profile-results.json
```

The command performs two rounds of the three profiled reads. It blocks non-GitHub destinations and every operation except GET or GraphQL query, and writes timing/size traces locally. It does not use Cloudflare secrets. GitHub/network variability means timings will differ.

Focused regressions cover list freshness after return/save, direct links without a list, stale saves preserving input, independent read overlap across three draft histories, same-invocation immutable read reuse, fresh stores seeing changed drafts, truncated-tree rejection and ancestry edge cases. All 260 unit/API/workerd and 56 browser tests pass, as do configuration (1), render (2), Astro checks (zero errors/warnings, four existing hints), the 172-page production build and navigation (2). The short, 28-revision and 61-revision Free-plan fixtures retain their previous counts: Save Draft 24/18 or 25/19 fresh/warm, reopen 7 or 8, and discovery 10 or 11. No fixture exceeded 50; these counts are local, not hosted telemetry.

The Free-plan request limit applies per invocation, not to the sum of list/document requests. These live read profiles remain below 50 calls; opening a page eliminates an invocation instead of combining its work into the document request. More drafts/assets/history can still cost more. Do not claim Cloudflare CPU qualification or enable new publishing settings based on these local timings. Actual hosted testing and any push/deployment require separate authorization.
