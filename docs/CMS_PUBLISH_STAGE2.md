# Publication and deployment tracking — Stage 2

Stage 1 checkpoint: `aaafcc7` on `editor/cms-release`. Stage 2 is prepared as a separate local checkpoint; its SHA and the two release-preparation SHAs are recorded in the completion report. Keep `CMS_PUBLISH_ENABLED` unset/false. No live publication, push, deployment, OAuth change, or administrative setting change has been performed.

## Durable state and status API

Authenticated `GET /api/publish/<area>/<canonical-filename>` reads the existing immutable publication snapshots, append-only coordinator, retained lock and GitHub PR history. It is read-only and works with Publish disabled. No browser/session/account owns the publication identity. The latest working draft identifies the coordinator even when a newer saved revision exists. Old superseded attempts are inspected to avoid forgetting a merge. Snapshot identity/scope and source content are revalidated against the submitted frozen base, not today's main. Current draft route inventory is deliberately not consulted for historical deployment proof; it cannot retroactively authorize or invalidate an already submitted snapshot.

Statuses:

| State | Meaning / action |
| --- | --- |
| Publishing | PR creation/required checks/native merge or production deployment is pending. |
| Validation failed | Required GitHub Actions checks failed, cancelled or skipped. Open PR checks; retry the same saved revision when resolved. |
| Conflict / action required | Main advanced, merge conflicts, closed PR or unconfirmed auto-merge. Explicit Retry uses the recorded selected revision, never newer working text. |
| Deployment failed | PR merged but Pages failed/cancelled. Inspect/rerun the Pages workflow; refresh status. Do not create a duplicate PR. |
| Checking | Network, permission, inventory, identity or live-site verification is incomplete. Preserve drafts and retry status. |
| Published | The exact selected document and required uploads are confirmed in a successful production artifact and its currently served document HTML. |
| Superseded | A verified later deployment includes the merge but has changed/removed the selected document or its assets. This saved revision is not claimed live. |

The editor polls while open, offers manual Refresh, and does not save/rewrite content during status updates. It validates success responses before showing View live and explicitly identifies newer edits excluded from the publication. Polling is recoverable; no background process requires the original browser to remain open. There is still no scheduled server-side retry/merge worker. Repeated Publish requests and concurrent attempts retain Stage 1's compare-and-swap recovery behavior.

## Production proof

The only production origin is server-defined `https://gin.btaa.org`. No request header or browser-supplied URL selects a verification destination, and GitHub credentials are never sent to that origin. Redirects are rejected; requests bypass caches where possible and have timeouts. Transient stale caches cannot turn a pending revision into Published.

After Astro builds, `scripts/write-cms-deployment.mjs` generates `dist/_cms/deployment.json`. It requires the production repository, `refs/heads/main`, a checkout matching GITHUB_SHA, and unchanged tracked source/public files. The marker records source SHA, Pages workflow/run/attempt, document Git blob/route, and SHA-256 of each emitted HTML file. Drafts and non-emitted routes are excluded. The marker is generated into the artifact, never accepted from the publishing browser and never committed as content.

Published requires ALL of:

1. Authoritative publication PR merged into main, exact recorded snapshot head, and a known merge SHA.
2. The public marker identifies a completed successful run of `.github/workflows/astro.yml` in this repository on main, matching the current workflow ID and run attempt.
3. A successful `github-pages` deployment for that source SHA/ref, with the production environment URL and workflow run log link matching the marker.
4. Deployed source contains the publication merge, and its document plus required asset Git blobs equal the selected snapshot. An ancestor build or unrelated success is insufficient.
5. Marker document/route/blob match, fetched public document HTML matches its marker hash, and a second marker read confirms production did not change during verification.

A later successful deployment may satisfy an earlier cancelled/failed run only if it contains the merge and exact expected document/assets. A newer containing deployment in progress remains Publishing. A different later document version is Superseded. Missing run/deployment/marker evidence remains pending/checking, even if a PR merged. No automatic branch, draft or route-tag cleanup is performed.

## Local workflow changes

Pages builds/deploys are restricted to the production repository main branch, including manual dispatch. Workflow concurrency cancels no active deployment and serializes main builds/deployments. Before deploying, an old run verifies it still represents current main. All main pushes now trigger Pages: this ensures an unrelated commit cannot strand an earlier publication by superseding its source without scheduling a replacement build. Draft/publication/coordinator branches do not trigger Pages.

The marker step runs after build and before artifact upload. The artifact's source identity and document hashes bind the live proof. These are checked-in workflow changes only; no live workflow or deployment has been triggered.

## Limits and integration gates

The public marker is only present after the revised Pages workflow reaches main and deploys. Older deployments cannot confirm publication through this protocol. GitHub IDs, run/attempt linkage, OAuth read permissions, edge-cache behavior and HTML byte stability require the authorized first live test; the existing deployment API response shape was verified read-only during development.

Status reconstruction intentionally retains integrity checks. Long draft ancestry or many retained attempts can consume significant GitHub requests/Cloudflare runtime CPU. Measure cold/warm request time, CPU/subrequests, GitHub rate-limit use, and long-history cases on the actual Free-plan runtime; a limit failure remains Checking and never becomes Published. Pagination is bounded and incomplete responses fail closed. Public document verification is capped at 2 MB. The marker contains only already-public repository/source identities and emitted-document hashes, never tokens or unpublished draft text.

No automated rebase/cleanup of working drafts was added. Newer working revisions are preserved exactly when an older revision publishes. If main changed, further saves/publications may require deliberate reconciliation with the new baseline; an explicit revision-transfer/rebase protocol remains separate work. Do not delete locks or working branches to force continuation. Already-mergeable PR behavior and legacy/corrupt state retain Stage 1's conservative maintainer recovery boundaries.

Release procedure: [CMS_PUBLISH_RELEASE_CHECKLIST.md](CMS_PUBLISH_RELEASE_CHECKLIST.md).

GitHub API references: [deployment statuses](https://docs.github.com/en/rest/deployments/statuses), [workflow runs](https://docs.github.com/en/rest/actions/workflow-runs).

## First-release repeat-editing path (confirmed blocker)

After a successful publication, the deterministic working branch is retained on its original baseline. Reopening it returns `mainChanged: true`. Save Draft returns 409 before a Git ref update; it cannot continue editing that stale draft. Retrying Publish for the already submitted revision returns the original merged PR, not another publication. A newer saved draft revision cannot take over the old coordinator automatically. This is a user-facing CMS-only repeat-editing blocker, not automatic rebasing in disguise.

For release 1, an authorized writer can repeat-edit through GitHub's ordinary PR flow:

1. Download/copy any unsaved or newer CMS draft edits. Leave the existing draft, publication snapshots, coordinator and tags intact.
2. Start a **new ordinary branch from current main**, using GitHub's edit-file → propose changes flow or a normal developer checkout. Open the current published document, not the stale draft branch. Keep the filename/slug and `draft: false`; do not copy the stale draft frontmatter wholesale.
3. Apply the intended prose/metadata changes onto that current file. Preserve protected MDX byte-for-byte. If new images are needed, include only those images in the PR and preserve immutable filenames; do not merge or cherry-pick the working branch.
4. Open an ordinary PR into main, inspect its actual document/asset diff, and let both automated checks pass. The writer may self-merge; no human approval is required. Wait for Pages to deploy and verify the public result. This ordinary PR is not represented as a new CMS publication in the old coordinator.
5. Continue subsequent edits through current-main ordinary PRs until a separate manual draft-refresh protocol is approved. The old CMS draft remains available for recovery but cannot be safely cleared by deleting locks or force-resetting its branch.

A regression test confirms Save Draft rejects the stale post-publication draft without changing refs and the current-main ordinary prose PR passes trusted-source validation. The release's controlled test must exercise this second-edit path. If editors require all repeat edits to stay inside the CMS UI, release must wait for an explicit draft-refresh feature; it is not provided here.

Final release checks, measured CI timings, technical-only CODEOWNERS and bootstrap boundaries: [CMS_RELEASE_FINAL_CHECKS.md](CMS_RELEASE_FINAL_CHECKS.md).
