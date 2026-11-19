# PR-only publishing — checkpoint 1

The approved release direction is Edit → Save Draft → Create Publication PR → manually merge in GitHub → GitHub Pages deployment. The six-stage privileged Actions migration is abandoned. No GitHub App, control issue, signing credentials, background publishing worker, automatic merging, deployment polling, or status cache is introduced.

Checkpoint 1 prepares submission and basic PR status. [Checkpoint 2](CMS_REPEAT_EDITING.md) now implements repeat editing locally. Do not authorize wider use before representative Cloudflare Free runtime testing passes. Existing published documents, working drafts and route tags are preserved.

## Execution and security

The existing authenticated, canonical-origin `/api/publish/<area>/<file>` route and `CMS_PUBLISH_ENABLED` flag are retained. The flag now gates PR creation, not merging. No legacy auto-merge fallback remains. The existing OAuth `public_repo` scope and repository write authorization are unchanged. Protection verification remains fail closed: strict `validate` and `cms-publication-scope` from GitHub Actions, administrators enforced, no bypasses, no force pushes/deletion. Native auto-merge need not be enabled. Non-admin editors' ability to read policy still needs an integration test.

Submission has two bounded invocations:

1. POST `{head, prepare:true}` reads the immutable saved document and its recorded asset manifest. The browser prepares the sole `draft:false` transformation and referenced-upload list using shared serialization/image-reference helpers. It does not serialize unsaved form contents or choose a new revision on retry.
2. POST `{head, candidate:{content, assets}}` treats that proposal as untrusted. The server derives the canonical document/branch identity, checks the selected revision belongs to the working branch, compares the current main document blob, verifies candidate upload names/SHAs against the selected revision, and refuses production image collisions. It constructs current main's tree plus exactly one document and proposed permitted new image blobs. It never merges the working branch.

The existing atomic, non-force snapshot/coordinator/lock reservation, append-only history checks, immutable-attempt naming and PR recovery protocol remain. Coordinator history and historical PR lookup are batched through GraphQL. Conflicting saved revisions cannot take an existing reservation. An uncertain response is read back or reported for safe same-revision recovery. Historical merged PRs are terminal; no duplicate merge is attempted.

The complete required CI checker remains authoritative for draft ancestry/scope, protected MDX, frontmatter, routes, referenced image closure/signatures/digests, exact published document bytes, full main-based snapshot tree and coordinator/lock identity. It reconstructs the expected result from immutable Git objects, not browser claims. A malformed proposal can produce a failing candidate PR; submission is not certification. Branch protection must prevent merging until both checks pass. CMS browser-test skipping still requires the complete verified snapshot contract.

`publicationPlan()` and `verifyPublication()` remain the full independent validators. Shared coordinator and image-reference helpers were extracted without removing their validation conditions. Save Draft, Preview and browser recovery retain their behavior.

## PR and recovery experience

The editor shows Create Publication PR separately from Save Draft, a direct PR link, and open/closed/merged/conflict/reserved/checking states. It reads on opening or explicit refresh; no timer polls deployments. Merged is not Published. The editor links to the existing Pages workflow for deployment confirmation. A successful submission's PR link remains visible if a subsequent status read fails.

Wait for `validate` and `cms-publication-scope`, inspect the diff, then merge in GitHub. If unrelated main changes make the snapshot stale, retry the same saved revision through the CMS; it closes/readbacks the previous PR and appends a new immutable attempt. Do not use GitHub's Update branch on CMS snapshots. Same-document changes stop for reconciliation. No draft or lock is deleted.

The incomplete test revision `5fe43d83398d994fdf86beee7bcc5c01a59a38ec`, snapshot `fd2b06259282ab1421a7c6d8070932f70b880c61`, coordinator commit `90d87e48650a421a939531ced7ccbcc3ad03e866`, and its retained lock must stay intact. Checkpoint 1's read-only status can find a reservation without a PR. After main advances, an explicitly authorized recovery may append a replacement attempt using that same saved revision; old snapshot/coordinator commits and the original lock remain preserved. Local implementation/testing does not retry the live publication.

## Free-plan bounds and remaining gates

Each preparation, submission or status operation has a hard cap of 40 outgoing GitHub requests. Writes require an eight-call budget reserve. GitHub redirects fail rather than silently consuming additional subrequests. Preparation/submission do not scan all drafts, fetch recursive repository trees, compile MDX or download/hash image blobs. Complete validation runs in required CI.

Explicit hosted bounds fail closed while preserving all saved state: document/candidate text at most 1,000,000 characters; at most 100 retained/proposed upload assets; coordinator-history query at most 100 nodes (with parent readback when needed), at most 250,000 serialized history characters, and the existing 100-attempt ancestry limit; at most three complete 100-item open-PR pages. Larger inventories require maintainer assistance rather than partial validation or a best-effort overwrite. These bounds limit hosted submission, not what the independent CI checker must verify.

Request-count regression: a 601-commit draft requires 3 preparation calls, 23 first-submission calls, 18 repeat-submission calls and 8 status calls in the mocked repository. These are logical GitHub requests, not measured Cloudflare CPU. The same test separately runs complete CI verification across all 601 draft commits. A large retained coordinator or asset manifest has different costs and must also be profiled.

The 10 ms Free CPU allowance is NOT certified by local Node/browser success. GitHub JSON parsing, cookie cryptography and bounded history checks still need cold/warm measurements on Pages Free. Save Draft/discovery still perform compilation, history scans and image processing, and remain separate Free-plan release gates. This checkpoint does not claim a reliable complete Edit Again cycle or bypass those gates.

Before any rollout, an administrator must disable the legacy live Publish flag during application replacement, verify the existing required checks and Cloudflare branch exclusions (`cms/drafts/*`, `cms/publish/*`, `cms/publication-state/*`), then authorize only a controlled PR-only test. Generated commits retain `[CF-Pages-Skip]`. No settings are changed by this implementation. Existing staging `geobtaa-github-io` and the GitHub Pages workflow remain unchanged.

## Repeat editing

[Checkpoint 2](CMS_REPEAT_EDITING.md) supplies the intuitive next-edit cycle while preserving historical drafts and locks. It is local and not deployed. The full Free-plan release gates remain outstanding.
