# CMS editor validation and operational limits

## Required publication checks

The chosen policy requires PRs to main and strict, up-to-date `validate` and `cms-publication-scope` checks from GitHub Actions. Administrators are included; bypasses, force pushes, and deletion are disallowed. Required human, code-owner, and last-push approvals are not part of the chosen routine-publication policy. Native auto-merge is opt-in per verified CMS request. An authenticated editor explicitly authorizes it, or retains manual merging. Repository protection and both required checks remain unchanged.

The verifier requires effective PR protection, not retained review preferences from a separate endpoint. An earlier missing-effective-protection diagnosis was subsequently resolved by the maintainer; that old failure is not a standing finding. Recheck the effective policy using each intended editor's own OAuth session. Administrator-token success does not prove non-admin policy-read access.

Repository writers remain trusted to change application code through ordinary PRs. CMS restrictions do not create content-only GitHub permissions. Automated source inspection and advisory reviews do not prove arbitrary code safe against a malicious repository writer.

The independent scope checker runs trusted base code with read-only credentials and treats PR content as data. It reconstructs exact main-based snapshots and checks ancestry, metadata, routes, protected source, document bytes, asset closure/signatures/digests, coordinator, and lock identity. Names, labels, PR descriptions, and client manifests cannot authorize a browser-test skip.

`validate` must fail on missing/failed classification, missing required jobs, unknown outputs, or an unauthorized browser skip. Full browsers run on ordinary source PRs; only a completely verified CMS snapshot can skip them. The current workflow has an isolated render-test job in addition to classification, site validation, and browsers. Future CI contract changes must reach trusted main before relying on them. The old two-stage bootstrap and pending render-job activation plans are obsolete; inspect the checked-in workflows for the active job graph.

Changes to opaque MDX components, imports, executable source, and sensitive frontmatter can fail source policy even when editorially harmless. Do not rename branches, add approvals, or weaken the checker to bypass that boundary. Deliberate policy extensions require a reviewed technical change.

## Local checks

Run from the repository root using the pinned Node version:

```sh
npm run test:editor
node --test --test-concurrency=1 editor/*.browser.mjs
npm run test:config
npm run test:editor:render
npm run astro -- sync
npm run astro -- check
npm run build
npm run test:navigation
npm run test:editor:build
```

Run render fixtures and final production builds sequentially: fixtures create temporary content, and concurrent build/navigation checks can observe it. Browser tests need Chrome/Chromium; configure `CHROME_BIN` when necessary and check that coverage actually ran. The editor-build check verifies the packaged artifact and hydration with mock API responses. Real workerd tests exercise redirect rejection, image operations, and uncertain-write recovery without live credentials.

Tests cover stale/concurrent saves, atomic creation/route reservation, multiple accounts, protected-source preservation, images, browser recovery, lost responses, publication scope, and repeated editing cycles. Test totals from old milestones are intentionally omitted; use the output for the revision being reviewed. Local/mock success does not establish live OAuth, Cloudflare capacity, GitHub permissions, or production deployment success.

## Application bounds

These are implemented guardrails, not promises that all inputs near a limit fit the hosting plan. Confirm the code when changing them.

| Operation or inventory | Bound |
| --- | --- |
| Publication preparation/submission/status | 40 outgoing GitHub calls per invocation; writes reserve eight remaining calls |
| Saved/proposed publication document | 1,000,000 JavaScript string code units; GitHub truncation can reject earlier |
| Publication assets | 100 retained or proposed assets, including retained unused uploads |
| Coordinator history | 100 attempts and 250,000 serialized history characters |
| Open PR enumeration | Three pages of 100; exactly 300 cannot establish completeness and fails |
| Each immutable publication attempt | At most one PR |
| Draft ancestry inspection | 1,000 commits |
| Draft-ref inventory | 5,000 entries, with paginated enumeration |
| Lightweight content inventory | 10,000 objects |
| Individual image | PNG, JPEG, GIF, or WebP, up to 5 MB |
| Pending uploads in one save | 20 files and 20,000,000 base64 characters, approximately 15 MB of bytes |

Browser storage can be smaller than upload limits. Oversized inventories, missing evidence, malformed history, and exhausted budgets fail while preserving saved work. Do not raise limits or remove retained state solely to make a failing request pass.

## Performance evidence and reproduction

History batching replaced one request per uncached commit with batches of up to 100 immutable commits. Corrected local fixtures with 168 other published documents and two other drafts measured 25/19 GitHub calls for fresh/warm saves with 28 or 61 saved revisions, and 30/24 with 601 revisions. Reopening those histories used 8 or 13 calls. Publication preparation/initial creation/status used 3/23/8 calls, or 24 for image-bearing creation. These are fixture observations, not production capacity guarantees.

Later lightweight discovery measured a 48-entry Library list at two GitHub calls instead of 32, reducing decoded response bytes from 2,877,648 to 8,624 in the recorded comparison. Document opening still performs full verification and can be slower. Small timing samples are not percentiles. The older verified-list counts do not describe the current lightweight list endpoint.

Reproduce measurements into temporary output files rather than adding raw reports to `docs/`:

```sh
node scripts/qualify-cms-free.mjs --output /tmp/cms-free-qualification.json
node scripts/qualify-cms-free.mjs --filter 'history-27|image-prepare-5MiB' --warm 5 --output /tmp/cms-free-focused.json
node --env-file-if-exists=.env.local scripts/profile-cms-reads.mjs /tmp/cms-read-profile-results.json
```

The qualification harness invokes the real Pages handler with an in-memory GitHub transport and no live credentials. Fresh means a fresh local process, not a Cloudflare cold isolate. The read profiler uses guarded live GitHub reads with the existing local credential; mutations and other destinations are blocked. Node CPU includes local runtime and fixture overhead. Neither harness measures hosted CPU or authenticated browser end-to-end latency.

The previous qualification notes did not certify actual candidate Cloudflare cold/warm CPU. Do not carry their old NO-GO label forward as a live deployment audit, or infer qualification from HTTP success. Reassess the deployed revision against current platform limits and retain the release's evidence.

## Hosted qualification procedure

1. Record the exact deployed source SHA, hosting plan, compatibility settings, time window, test identities, document/image sizes, and a manifest of retained refs. Restrict traffic and use intended editor accounts. Preserve the canonical-origin gate.
2. Test one operation at a time. Save followed by list refresh is two invocations; pending-image preparation and image-bearing save are also separate. Cover prose, protected/large documents, images, long histories, multiple drafts, repeated edit cycles, stale tabs, and two editors.
3. Obtain observed cold and warm coverage. Reloading a browser, changing a query, or waiting does not prove cold execution. Any temporary diagnostics need request-scoped identifiers and counters; never log tokens, cookies, headers, or document contents. The old unapplied probe patch was retired rather than retained as a deployment recipe.
4. Capture per-invocation outgoing calls, outcomes, latency, and platform CPU/resource metrics. The earlier procedure called for at least 30 warm trials per supported profile plus observed cold coverage. Platform sampling, missing logs after termination, and aggregation delay must remain visible in the evidence. Wall time and mean subrequests are not CPU or per-request maxima.
5. Verify actual OAuth, intended-account policy reads, draft/image saves, no CMS branch builds, PR recovery, manual merge, explicit automatic authorization/cancellation, successful Pages deployment, public page contents, and another edit cycle. Use designated test content and the authorized test scope. Inspect outstanding PRs before rollback or disabling creation.
6. If required metrics or supported profiles remain unverified, do not claim qualification. Record evidence with the release, remove temporary diagnostics, and confirm the uninstrumented build before widening use.

## Retained publication recovery state

Earlier read-only investigations recorded this incomplete test publication:

| Item | Recorded identity |
| --- | --- |
| Document | `library/cms-publishing-test.mdx` |
| Selected saved revision | `5fe43d83398d994fdf86beee7bcc5c01a59a38ec` |
| Snapshot | `fd2b06259282ab1421a7c6d8070932f70b880c61` |
| Coordinator commit | `90d87e48650a421a939531ced7ccbcc3ad03e866` |

These are historical recovery identifiers, not freshly checked live state. Preserve the associated draft, snapshot, coordinator, and lock until inspected. A same-revision retry may recover a reservation or append an immutable replacement after unrelated main changes; same-document changes require reconciliation. Documentation cleanup does not authorize publication retries, ref deletion, or test-content cleanup.

## Editor source directory

The implementation and tests live in `editor/`; React editor components live in `src/components/editor/`. CI runs the complete browser suite directly from `editor/`. The temporary prototype compatibility files have been removed after the relocated trusted validator reached main. The validator protects the current validation module paths and requires the complete browser suite.

## Unpublish release stages

Stage 1 adds action-bound immutable publication validation, the draft-aware production marker, and exact-route link warnings. Unpublish HTTP submissions remain blocked. Navigation data lives in `navigation.groups.json`, shared by the normal navigation configuration and publication preflight so hosted code never evaluates repository TypeScript.

Stage 2 adds the editor action and read-only deployment verification. `CMS_UNPUBLISH_ENABLED` defaults to disabled and is independent of `CMS_PUBLISH_ENABLED`. Enable it only after Stage 1 has merged into main, its required checks have passed, and the updated production marker has been deployed through the normal reviewed release process. Main must contain the matching publication capability before an unpublish request is accepted. Do not merge or deploy automatically.

Run `npm run test:editor:publication` sequentially with other builds. It temporarily creates draft fixtures in each editor area, checks production route/sitemap exclusion and visible inbound-link warnings, then proves unrelated broken links and bad anchors on republished pages remain fatal. Fixtures and build output are removed afterward. Source and publication tests cover action identity, frontmatter preservation, stale requests, sidebar blockers, working-draft preservation, and unpublish/edit/republish cycles.

## Native auto-merge regression contract

The backend and progress UI are one release feature. Authorization is a separate bounded operation, not part of a read-only preparation or status read. Tests cover permission/policy failures, snapshot/head/action mismatch, head changes during authorization, uncertain mutation responses, readback, cancellation with flags disabled, already-ready protected merging, manual submission, and preserved unpublish drafts. Two requests sharing a main baseline must demonstrate that the first merge blocks the second and that the replacement needs fresh authorization. All existing immutable-snapshot, source-policy, rendering, production draft-exclusion, link-warning and deployment-marker checks remain required.

Browser tests cover explicit publication and unpublish confirmation, manual submission, cancellation, stale-request recovery, failed deployment recovery, progress in the document and Library, hidden-tab pausing, bounded polling and stop after verification. CI optimizations are a separate change; this feature does not alter workflows or remove coverage. Local simulations do not qualify live GitHub permissions or event delivery. Complete the designated live request test in the deployment guide before widening use.
