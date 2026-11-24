# CMS editor validation and operational limits

## Required publication checks

The chosen policy requires PRs to main and strict, up-to-date `validate` and `cms-publication-scope` checks from GitHub Actions. Administrators are included; bypasses, force pushes, and deletion are disallowed. Required human, code-owner, and last-push approvals are not part of the chosen routine-publication policy. Native auto-merge is opt-in per verified CMS request. An authenticated editor explicitly authorizes it, or retains manual merging. Repository protection and both required checks remain unchanged.

The verifier requires effective PR protection, not retained review preferences from a separate endpoint. An earlier missing-effective-protection diagnosis was subsequently resolved by the maintainer; that old failure is not a standing finding. Recheck the effective policy using each intended editor's own OAuth session. Administrator-token success does not prove non-admin policy-read access.

Repository writers remain trusted to change application code through ordinary PRs. CMS restrictions do not create content-only GitHub permissions. Automated source inspection and advisory reviews do not prove arbitrary code safe against a malicious repository writer.

The independent scope checker runs trusted base code with read-only credentials and treats PR content as data. It reconstructs exact main-based snapshots and checks ancestry, metadata, routes, protected source, document bytes, asset closure/signatures/digests, coordinator, and lock identity. Names, labels, PR descriptions, and client manifests cannot authorize a browser-test skip.

`validate` must fail on missing/failed classification, missing required jobs, unknown outputs, or an unauthorized browser skip. Full browsers run on ordinary source PRs; only a completely verified CMS snapshot can skip them. The current workflow has an isolated render-test job in addition to classification, site validation, and browsers. Future CI contract changes must reach trusted main before relying on them. Inspect the checked-in workflows for the active job graph.

Changes to opaque MDX components, imports, executable source, and sensitive frontmatter can fail source policy even when editorially harmless. Do not rename branches, add approvals, or weaken the checker to bypass that boundary. Deliberate policy extensions require a reviewed technical change.

## Local checks

### Prerequisites

Run all commands from the repository root with Node **24.13.1**, as pinned in
`.node-version` and Volta. Use npm and the committed `package-lock.json`.
`npm ci` installs reproducible dependencies and runs the required
`patch-package` postinstall hook. Use `npm install` when intentionally changing
dependencies, then review the lockfile changes.

Git is required by temporary-repository tests. Tests need permission to create
and remove temporary files, start child processes, and bind local loopback
listeners; the unit/API suite includes Miniflare/workerd runtime tests.
Automated tests use mocked GitHub operations and require no GitHub credentials
or running development servers.

Chrome/Chromium is required for both browser tests and the editor artifact's
hydration check. The harness checks common macOS/Linux executable locations;
set `CHROME_BIN` to an installed executable if necessary. Install and verify the
browser before treating a local run as full validation.

### Command reference

| Command | Purpose and scope | Prerequisites and intended use |
| --- | --- | --- |
| `npm run test:editor` | All `editor/*.test.mjs`: unit/API, draft/publication policy, workflow contracts, and workerd tests | Dependencies, Git, temporary-file and local runtime access. Primary editor regression suite; does not include browser or render suites. |
| `npm run test:editor:browser` | All `editor/*.browser.mjs`, sequentially; editor interactions and related site filtering | Chrome/Chromium and local server access. Uses isolated profiles and fixtures; no live GitHub operations. |
| `npm run test:config` | Fullview-mode dependency patch/configuration regression | Dependencies installed with the patch. Run for configuration/dependency changes and full validation. |
| `npm run test:editor:render` | Real Astro Link Card/Link Button rendering and URL-safety tests, then production unpublish-build regressions | Builds temporary fixtures. Run alone in the checkout and before the final clean production build. |
| `npm run test:editor:publication` | Only `tests/unpublish-build.test.mjs`: draft-route exclusion, link warnings and validation | Focused unpublish-build shortcut. Already included in `test:editor:render`; not the complete publication test coverage. |
| `npm run astro -- sync` | Generate Astro content/types | Run before type checking; do not overlap with other Astro commands. |
| `npm run astro -- check` | Source/type diagnostics | Generated Astro types and installed dependencies. Not a substitute for tests or a production build. |
| `npm run build` | Public-site build to `dist`, including internal-link validation | Run after fixture tests finish; provides fresh output for navigation checks. Does not deploy. |
| `npm run test:navigation` | Built sidebar organization, date ordering and previous/next navigation | A successful, current public-site build. This command does not build first. |
| `npm run build:editor` | Dedicated editor artifact to `dist-editor` | Packaging only; no hydration assertions or deployment. Included in `test:editor:build`. |
| `npm run test:editor:build` | Dedicated editor build, artifact contents/dependency checks, and browser hydration | Chrome/Chromium and local server access. Run for packaging changes and full validation. |

### Routine development and targeted checks

Run `npm run dev` for the public-site development server. When manually exercising
the editor's local API, also run `npm run editor` in another terminal using the
[editor setup](../../editor/README.md#local-setup). That gateway uses the configured
repository; manual saves are real operations, unlike the automated mocks.

Run `npm run test:editor` when changing editor behavior. During a focused fix,
select relevant files directly; these examples cover API boundaries and image UI
behavior respectively:

```sh
node --test editor/api-parity.test.mjs editor/cloudflare-runtime.test.mjs
node --test --test-concurrency=1 editor/image-editing.browser.mjs
```

Use `npm run test:editor:render` for public rendering/publication changes,
`npm run test:config` for the patched configuration, and
`npm run test:editor:build` for editor packaging. Targeted checks shorten the
feedback loop but do not replace pre-release validation or required CI checks.

### Full pre-release validation

Run the following sequentially in one checkout, stopping on unexpected failures:

```sh
npm ci
npm run test:editor
npm run test:editor:browser
npm run test:config
npm run test:editor:render
npm run astro -- sync
npm run astro -- check
npm run build
npm run test:navigation
npm run test:editor:build
```

Do not additionally run `test:editor:publication` or `build:editor` in this
sequence: their work is already included in `test:editor:render` and
`test:editor:build` respectively. Tests at different layers intentionally overlap;
fixture builds do not replace the clean final build or its artifact checks.

### Fixture isolation and execution order

Within a single checkout, run browser, render, build, and Astro type-generation
commands sequentially, including sync/check. Do not overlap them with a development
server watching the same source tree. Browser test-file execution is also
sequential to limit Chrome/Vite resource contention; it does not authorize running
other build commands alongside the suite.

Render tests temporarily write documents under `src/content/docs/`, including
examples that intentionally make a build fail. Another build can observe these
files and either fail or include test content. They are removed in `finally`
cleanup, but an interrupted process may leave fixtures behind; inspect the
working tree before using a build for release. Browser profiles and fixture names
are isolated, but Astro commands can still share generated `.astro/` files.
Different output/cache directories alone are insufficient isolation.

CI runs render fixtures in a separate checkout/runner. Preserve that separation.
Use separate checkouts for genuinely parallel validation, rather than running
commands concurrently in the same checkout.

### Interpreting results

Check the executed/pass/fail/skip/TODO summary as well as the exit status.
Skipped tests did not execute. Several browser tests and local artifact hydration
can skip when Chrome is absent; other tests may fail instead. An all-green exit
with missing browser coverage is not full validation.

TODO tests may execute and fail while the command still exits successfully.
Five FilterPanel TODO cases currently record unresolved search-state, sort-state,
and author-normalization defects. Review those known limitations separately from
unexpected failures. `FILTER_REVIEW_STRICT=1 node --test editor/filter-panel.browser.mjs`
runs those assertions as ordinary failures when reproducing them deliberately;
it is not an additional required passing step in the sequence above.

Local/mock success does not establish live OAuth, intended-account permissions,
Cloudflare capacity, or successful production deployment. Use the hosted
qualification procedure below for those separate claims.

## CI and deployment boundaries

PR validation uses the existing `.github/workflows/validate.yml` job graph:
`site-validation` runs sync/check, config and unit/API tests, a clean site build,
navigation checks, and editor artifact tests. `render-tests` runs the render suite
in a separate checkout. `browser-tests` requires Chrome and runs the full browser
suite for ordinary source PRs; only trusted, verified CMS snapshots can skip it.

CI deliberately retains the literal
`node --test --test-concurrency=1 editor/*.browser.mjs` command with
`CHROME_BIN=/usr/bin/google-chrome`. The local npm command now matches its execution
policy. The trusted source validator checks that literal command as well as job
IDs, dependencies, and skip conditions; replacing it with an npm alias would
require a separate trusted-policy change. Do not make that substitution as a
command cleanup.

`publication-plan` and the independent `cms-publication-scope` check execute
trusted base code with read-only credentials. The final `validate` job aggregates
all required results and fails closed. Preserve the required `validate` and
`cms-publication-scope` names, GitHub Actions binding, strict branch protection,
and authorized-skip rules. The classifier script expects GitHub event context;
it is not a general-purpose local test command.

Public-site deployment is separate from PR validation. `.github/workflows/astro.yml`
rebuilds protected main, writes the production deployment marker, and deploys to
GitHub Pages with its existing source-identity and deployment guards. A build
command or passing test suite does not trigger deployment by itself.

The dedicated editor is deployed separately by the Cloudflare Pages Git integration
using `npm run build:editor` and `dist-editor`, with project settings maintained in
its dashboard. `test:editor:build` verifies the artifact locally; it does not deploy
it. See [hosting and deployment](deployment.md) before release operations.

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

The implementation and tests live in `editor/`; React editor components live in `src/components/editor/`. CI runs the complete browser suite directly from `editor/`. The validator protects the current validation module paths and requires the complete browser suite.

## Unpublish rollout prerequisites

The historical rollout separated two stages; this is not a statement of current
live deployment status. Stage 1 added action-bound immutable publication validation, the draft-aware production marker, and exact-route link warnings. During that first stage, unpublish HTTP submissions remained blocked. Navigation data lives in `navigation.groups.json`, shared by the normal navigation configuration and publication preflight so hosted code never evaluates repository TypeScript.

Stage 2 added the editor action and read-only deployment verification. `CMS_UNPUBLISH_ENABLED` defaults to disabled and is independent of `CMS_PUBLISH_ENABLED`. Enable it only after Stage 1 has merged into main, its required checks have passed, and the updated production marker has been deployed through the normal reviewed release process. Main must contain the matching publication capability before an unpublish request is accepted. Do not merge or deploy automatically.

Run `npm run test:editor:publication` sequentially with other builds. It temporarily creates draft fixtures in each editor area, checks production route/sitemap exclusion and visible inbound-link warnings, then proves unrelated broken links and bad anchors on republished pages remain fatal. Fixtures and build output are removed afterward. Source and publication tests cover action identity, frontmatter preservation, stale requests, sidebar blockers, working-draft preservation, and unpublish/edit/republish cycles.

## Native auto-merge regression contract

The backend and progress UI are one release feature. Authorization is a separate bounded operation, not part of a read-only preparation or status read. Tests cover permission/policy failures, snapshot/head/action mismatch, head changes during authorization, uncertain mutation responses, readback, cancellation with flags disabled, already-ready protected merging, manual submission, and preserved unpublish drafts. Two requests sharing a main baseline must demonstrate that the first merge blocks the second and that the replacement needs fresh authorization. All existing immutable-snapshot, source-policy, rendering, production draft-exclusion, link-warning and deployment-marker checks remain required.

Browser tests cover explicit publication and unpublish confirmation, manual submission, cancellation, stale-request recovery, failed deployment recovery, progress in the document and Library, hidden-tab pausing, bounded polling and stop after verification. CI optimizations are a separate change; this feature does not alter workflows or remove coverage. Local simulations do not qualify live GitHub permissions or event delivery. Complete the designated live request test in the deployment guide before widening use.
