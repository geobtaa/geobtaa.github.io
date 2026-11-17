# First-release final checks and CI timing

These are local results and a read-only audit, not live publishing approval. Keep `CMS_PUBLISH_ENABLED=false`. Stage 1 checkpoint is `aaafcc7`; the Stage 2 checkpoint and prepared release commits are identified by the local branch refs in the release checklist and the completion report.

## Repeat editing and MDX boundaries

Confirmed in a Git-graph regression: publish an existing document → retain the working draft → reopen with `mainChanged: true` → another Save Draft fails 409 without changing refs. Repeating Publish recovers the old merged PR, not a new revision. The UI now explains the blocker and links to current-main GitHub editing. Release 1 supports repeat edits through an ordinary PR from current main; it does not support CMS-only repeat editing. Preserve `draft: false`, URLs, protected source and current-main changes. Retain the old draft and locks. See the step-by-step path in [Stage 2](CMS_PUBLISH_STAGE2.md#first-release-repeat-editing-path-confirmed-blocker). If CMS-only repeat editing is required, this is a release blocker, not a hidden automatic rebase.

The trusted-source policy allows ordinary prose, headings, lists, tables, metadata outside executable `head`/`layout`, supported images and generated CMS components. Existing protected MDX may remain byte-for-byte unchanged while surrounding prose changes. Both a representative regression fixture and a read-only check against `geodata-collection-foundation-report.mdx` confirm that normal prose outside its legacy `<div class="gold-highlight">` passes.

Legitimate source edits that deliberately fail the first-release policy include correcting text inside an opaque legacy layout/card/custom component, changing its attributes or imports, moving/removing protected blocks, adding raw HTML/JSX/JavaScript expressions or non-allowlisted imports, and changing `head`/`layout` frontmatter. Even a harmless typo inside an opaque component can fail. Synthetic fixtures avoid tying CI to editorial wording on the real report. This is a conservative executable-source boundary; we cannot claim all existing-page edits are supported. Use supported blocks or an explicit technical policy change for such cases; neither an approval nor a branch rename bypasses the validator. No MDX guard was weakened in this release.

The proposal and the active advisory copy prepared in release PR 1 cover technical paths only. Content documents, image uploads and editorial docs have no catch-all owner/review request. Required human/code-owner approvals remain disabled.

## Actual local timings

Measured with `/usr/bin/time -p` on the shared development machine; elapsed time includes command startup. These are observations, not GitHub-hosted runner estimates. No GitHub publication was performed.

| Work | Elapsed seconds | Result |
| --- | ---: | --- |
| All 52 browser tests, sequential | 70.53 | 52 passed |
| Unit/API tests | 3.54 | 224 passed |
| Configuration test | 0.36 | Passed |
| Astro sync | 9.34 | Passed |
| Astro check | 10.76 | Zero errors/warnings; four hints |
| MDX/component render tests | 23.25 | 2 passed |
| Production build, with timings | 7.30 | Passed, internal links valid |
| Built-site navigation | 0.77 | 2 passed |

The non-browser work totals **55.32 s** locally. Running every step and browsers serially totals **125.85 s**, excluding dependency installation. Browser omission removes **70.53 s of measured test work** per verified snapshot. Runner acquisition, npm installation/cache, GitHub API latency and parallelism determine actual CI wall time. Measure check start/completion timestamps during rollout; do not promise the local numbers as production turnaround.

## Live coverage versus proposed coverage

Read-only GitHub inspection confirmed main `ab86dd67a0b9b09d3bacaf23fe8425c0421460ad`. Its currently live `validate.yml` runs npm ci, Astro sync/check, production build and navigation only. It does **not** currently run editor unit/API, configuration, render or browser tests; the new scope workflow is not installed. The tests reported here ran locally, not as a claimed live Actions result.

After the prepared release:

| Job/check | Verified CMS snapshot | Ordinary source / bootstrap / manual validation |
| --- | --- | --- |
| `publication-plan` | Trusted base executes the complete snapshot contract | Trusted source scan; missing checker on bootstrap/manual selects full suite |
| `site-validation` | npm ci, Astro sync/check, configuration, all unit/API, render tests, production build, navigation | Same complete non-browser work |
| `browser-tests` | Skipped only after `cms-snapshot` proof | All 52 tests, sequential; Chrome absence fails rather than silently skips |
| required `validate` | Passes only with successful plan/site jobs and the specifically permitted browser skip | Passes only with successful plan/site/browser jobs |
| required `cms-publication-scope` | Independently repeats the complete snapshot proof | Independently runs actual-tree source validation |

`publication-plan` and `site-validation` start in parallel. Ordinary PR browsers start after classification. Workflow/app/auth/publishing/test-infrastructure changes cannot fit the one-document-plus-required-images snapshot contract and therefore cannot earn the skip. Ordinary content-only PRs ALSO run browsers: there is no path/label shortcut. This means the first-release current-main repeat-edit fallback pays ordinary-PR browser time; only complete CMS snapshots earn the fast path.

The classifier checks out the PR's trusted base SHA without persisted checkout credentials and installs that base's dependencies. It never executes a classifier from PR head. Only a successful complete-contract result is written to job output. Branch names/labels/descriptions cannot assign that result. Missing trusted code selects full browser coverage; failed verification does not fall back to a successful skip.

`validate` uses `if: always()` and explicitly examines all job results. A failed/cancelled classifier, unknown/missing output, failed site validation, skipped ordinary browser job, missing Chrome or browser failure makes this required check fail. A local ten-case shell decision matrix exercised these outcomes. Trusted source inspection also rejects edits that remove the required gating structure. The separate scope check remains independently required. Deliberately changing trusted CI/validator code remains within the previously documented repository-writer trust boundary; advisory CODEOWNERS is not an adversarial-code guarantee.

CI uses mocked GitHub APIs and temporary Git/MDX fixtures. It does not perform real OAuth, auto-merge, Cloudflare runtime execution, Pages deployment or public-site proof. The actual deployment workflow builds/marks/deploys main; its correctness tests run in unit/API CI after activation, but production behavior remains a controlled live-test gate.

GitHub Ubuntu runners include Chrome; the workflow still checks the installed executable ([runner image inventory](https://github.com/actions/runner-images/blob/main/images/ubuntu/Ubuntu2404-Readme.md)).

## Bootstrap and live acceptance gates

The exact two-PR file boundary is documented in [the release checklist](CMS_PUBLISH_RELEASE_CHECKLIST.md). An important bootstrap correction: defer `editor-prototype/deployment-workflow.test.mjs` along with Pages workflow activation, because that test asserts the active workflow contract. Marker-generator CLI tests stay in PR 1. Otherwise PR 1 would fail its unit suite while deliberately retaining the old Pages workflow.

Before general use, controlled live testing must demonstrate:

- Actual Cloudflare cold/warm CPU, subrequests, latency, memory/resource errors and GitHub quota consumption, including repeated saves/retained history and two editors. Free-plan limits currently include 10 ms CPU, 50 subrequests per invocation and 100,000 shared daily Workers/Functions requests. Local Node timings do not verify those limits. Obtain runtime measurements/logs; unavailable metrics remain unverified. Do not authorize general use if resource limits cause publication/status failure. ([Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [Pages Functions pricing](https://developers.cloudflare.com/pages/functions/pricing/))
- Native auto-merge using an intended non-admin OAuth account, initially pending required checks and retry after checks are already green. A required manual merge is an actionable first-release limitation, not a successful automatic-publishing test. Do not weaken protections as a workaround.
- A main-only successful Pages run/deployment, matching marker source SHA/run/attempt/environment, and served document HTML whose hash matches the artifact. Reload/another account must recover the same state; cache delays, missing markers or changed HTML must never produce a premature Published result.
- A second ordinary current-main edit to the same test document passes required checks and deploys while the old CMS draft remains preserved and clearly blocked. A stale unrelated-main publication retry must keep the selected saved revision; same-document changes must stop for reconciliation.

These are release gates still to be performed with separate authorization. No live configuration or deployment readiness is inferred merely from local test success.
