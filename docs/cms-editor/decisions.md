# CMS editor design decisions

## Separate application hosting from content storage

Cloudflare Pages hosts the editor and its same-origin API. GitHub Pages hosts the public website. The editor reads the content baseline from `main`, regardless of the branch used to deploy the application. Application releases must not import legacy staging content or staging ancestry as code.

The editor covers the areas in `editor/contentAreas.mjs`. The React/Tiptap interface edits metadata and supported body content. Text blocks are the default writing tool; specialized components are optional. Existing Markdown files retain their format and cannot acquire MDX-only components through the editor. Program Updates can be converted individually to editable articles; unsupported content remains protected. There is no bulk conversion.

## Save drafts on shared document branches

A draft belongs to a canonical repository path, not an editor account, browser, or application branch. Other authorized editors can reopen it.

- Working branches use `cms/drafts/<area>/<short-name>-<path-hash>`. The hash uses 32 hexadecimal SHA-256 characters; metadata also verifies the exact full path. Titles do not rename existing paths.
- A first save starts from freshly read `main` and contains exactly the selected document and permitted referenced uploads. It does not copy unrelated staging files.
- Later saves compare both the loaded document blob and expected branch head. Atomic GraphQL `updateRefs` uses the previous OID and `force: false`. Stale tabs and concurrent edits fail without overwriting work.
- Main changes to the selected document block further saves until reconciled. Unrelated main changes do not imply a document conflict.
- New documents receive `draft: true`. Existing documents preserve their draft field, including an absent field. Save Draft never changes `main` or hides an existing public page.
- Draft commits carry server-generated `CMS-Draft-v1` metadata. Verification checks path/branch identity, single-parent ancestry, baseline, full tree scope, and asset identities. A namespace or metadata marker alone is not permission evidence.
- New URLs are checked against main routes and active drafts, including slug overrides, Markdown/MDX variants, case folding, and index routes. An immutable `cms-draft-routes/<route-hash>` tag reserves a new URL atomically with branch creation. Missing or incomplete inventories stop creation.

Do not delete route reservations, rewrite history, force-update branches, or expire drafts to bypass a conflict. A maintainer must inspect retained identity and history before any cleanup.

Implementation: `draftIdentity.mjs`, `draftStorage.mjs`, `draftCycles.mjs`, and `contentRoutes.mjs` under `editor/`.

## Keep uploads immutable and associated with a document

Upload preparation validates the file and returns pending bytes to the browser; it creates no Git object or build. Save Draft commits the document and its referenced pending uploads together. The UI requires a first save before a new document can upload images.

Assets use `src/assets/images/cms-<document-path-hash>/` with an understandable basename and full byte digest. Existing images cannot be overwritten. Matching bytes can be reused. A draft cannot attach another document's uncommitted upload. Unused pending images are excluded from a save; previously saved associated images remain on the draft even after removal from its body. Publication copies only the final required new images.

Body and cover images use the same image library and upload safeguards. Pending bytes participate in browser recovery, subject to browser storage capacity.

## Submit immutable publication requests and explicitly authorize merging

The preferred workflow, when enabled, is **Edit → Save Draft → Publish → required GitHub checks/reviews → native squash merge → GitHub Pages deployment → verified update**. Manual submission and merging remain available internally for administrative exceptions, without normal editor controls. Unpublish uses the same explicit authorization after the unpublish confirmation; it changes only current main visibility and preserves independent saved work.

GitHub native auto-merge performs the waiting. There is no privileged Actions merger, GitHub App migration, background publishing worker, status database, automatic branch cleanup, or unattended request refresh. The CMS keeps request status separate from deployment status. Merged does not mean deployed. On-demand website verification uses the existing production marker and matching GitHub Pages run/deployment; missing or contradictory evidence remains unverified.

Submission operates on one exact saved head, never unsaved form contents:

1. Preparation reads the immutable saved document and asset manifest. The browser prepares the publication transformation and proposed image references. Publishing sets `draft: false` on the selected saved content. Unpublishing sets `draft: true` on the current main document only; it cannot include independent editorial edits or uploads.
2. The server treats the proposal as untrusted, verifies document/revision/asset identities, compares the current main document, and constructs a separate snapshot from current main plus one document and permitted new image blobs.
3. Required trusted-base CI independently reconstructs and validates the full result. Creating a PR does not certify it as safe to merge.

The working draft is never merged directly. Later draft saves cannot change an open publication request. A coordinator under `cms/publication-state/*`, an immutable snapshot under `cms/publish/*`, and a retained `cms/publication-locks/*` tag bind publication to the selected revision. Initial reservation is atomic; subsequent attempts append history without rewriting earlier attempts.

Lost responses use authoritative readback and same-revision recovery. A merged historical request is terminal. Unrelated main advances can produce a replacement immutable attempt after the previous PR's closure is confirmed. Same-document changes stop for reconciliation. Do not use GitHub's Update branch on CMS snapshots or delete coordinator/lock state to retry.

`CMS_PUBLISH_ENABLED` gates PR creation. Both it and `CMS_AUTO_MERGE_ENABLED` must be true to authorize native auto-merge; automatic unpublishing also retains the unpublish capability/flag checks. A separate authenticated POST derives the current attempt from the coordinator, verifies identity, policy and freshness, and enables squash auto-merge with `expectedHeadOid`. If the request is already ready, a protected head-pinned squash merge implements the same explicit authorization. GitHub's protection remains authoritative. Native authorization also requires automatic head-branch deletion to be off so completed snapshots are retained. Reads and manual submissions never authorize merges.

Authorization and cancellation use readback, including after uncertain mutations. Cancellation remains available with publishing flags disabled and cannot undo a merge that wins the race. It never deletes the draft or PR. Refreshing an outdated request creates a new immutable attempt without transferring authorization; the editor must explicitly authorize the replacement. No consent is inferred from branch names or earlier requests.

The visible editor and visible saved-work rows check pending progress at 20-second intervals, with error backoff, a 30-read bound, hidden-tab pausing, abort on unmount, and explicit Check again recovery. Completed, closed and outdated requests stop automatic checks, as do failed deployments and failed manual requests. Authorized open requests remain observed within the bound because GitHub can merge after checks or reviews recover. After a newly observed deployment is verified, one guarded catalog refresh updates stale New draft/Unpublished changes chips. List status reads are limited to two visible rows at once; only merged requests require deployment verification. Recently observed completed updates can be shown without restoring historical chips on every ordinary page. Verified website state remains separate from pending editorial work and request progress.

Implementation: `publicationPR.mjs`, `publicationCoordinator.mjs`, `publicationCandidate.mjs`, and `PublicationStatus.tsx`.

## Continue editing after a merge without losing history

The server verifies the recorded merge and that current main still has the exact submitted document and required images. Reopening then supports another normal Save Draft and submission cycle. Newer saved unpublished changes are carried forward instead of discarded.

Version 2 draft identity binds a successor cycle to the published base blob and predecessor head. A metadata-only preservation commit retains the predecessor tree; a successor starts from current main. The first save atomically advances the predecessor and creates the successor. Concurrent starts elect one successor; stale saves cannot advance the retired predecessor. Version 1 histories remain supported.

Same-document or required-image changes beyond the recorded publication block continuation. Install trusted validation supporting new cycle metadata before deployed code creates those cycles. No old branch, tag, snapshot, or coordinator is deleted automatically.

## Preserve unsupported content and recover unsaved work

Existing unsupported Markdown, MDX, Astro components, imports, and layouts stay read-only and retain their source and order. Edits around them are supported. New arbitrary executable syntax and changes inside protected source require technical review and must satisfy the independent source policy; a human approval does not override that policy.

Save endpoints validate generated Markdown/MDX before committing, without evaluating it. Required builds still check repository imports, assets, and rendering. Plain-text component fields are escaped rather than interpreted as executable source.

Recognized legacy callout directives use the existing Callout block with a restricted rich message editor. Their original source is retained until the callout changes; edits keep directive syntax and consolidate `info` to `note` and `warning`/`Caution` to `caution`. This provides compatibility without a content migration or new imports. Unsupported titles, attributes, descendants, and enclosing layouts remain protected, and server validation uses the same recognition rules.

Literal LinkCards on known layout paths can expose their existing property editor while the containing source stays protected and anchored. Preservation compares the ordered source fragments outside each editable card span; all wrapper attributes, sibling content, and executable source remain immutable. The API rejects new layouts and added/removed cards. This enables field edits without unwrapping or migrating existing layouts, and keeps URL validation shared with standalone cards.

Plain legacy ChipLists use the existing item controls without migrating their component or CSS classes. Only the list body is editable; imports, component tags/attributes, and any recognized enclosing `div` source stay immutable and anchored. The API compares typed preservation fragments so collection edits cannot alter surrounding executable or layout source. Unsupported item syntax remains protected, including reference-like labels whose meaning could depend on definitions outside the block. Literal edits are escaped as Markdown text, and unchanged blocks retain their original bytes.

Inside Markdown tables, the shared syntax parser restores bare inline directive tokens as literal text, matching Starlight's public rendering. This lets ordinary ratios, times, and scale values use the existing table schema without a source migration. The restoration excludes labels and attributes, and leaves other unsupported cell content and enclosing layouts protected. It does not broaden directive handling in ordinary prose or replace HTML/CSV tables.

Ordinary Preview shows the current form, including unsaved content, without writing or deploying. It approximates the page; protected content is shown as placeholders. Program Update conversion preview is a separate explicit workflow and is saved only through Save Draft.

Browser recovery is account/workspace scoped (`<owner>/<repo>#cms-drafts-v1`) and separate from GitHub saves. It includes pending images and safe creation-retry identity. Older staging backups are not silently migrated. Restoring checks the current source and continuation head; incompatible copies remain downloadable instead of overwriting newer work. Multiple copies are never combined automatically. Downloads are JSON; there is no backup import UI.

Session expiry keeps the editor mounted. Reauthentication occurs in another tab, followed by Check sign-in with the same account/workspace. Save failures retain form contents. New article creation persists a fixed filename and creation identifier before sending its request; safe retries recover the original creation rather than duplicate it. Browser storage failure can block creation until retry identity can be preserved.

## Keep list discovery fast without treating it as authorization

Area lists are provisional inventories of main files and saved-work candidates. They do not verify every draft's ancestry, scope, images, route reservations, or publication state. Opening, saving, and submitting still require authoritative checks. Retained generations group into one row per path; ambiguity produces Needs review rather than choosing by timestamp or branch order.

One in-memory catalog per area is scoped to origin, API, workspace, and account. Returning to a list shows prior rows while a fresh request runs; failures label it out of date. Sign-out/authentication loss clears it. It is not persisted or used to initialize an editable document. Opening a document does not wait for a separate list refresh. Saving refreshes the list; a failed refresh cannot undo a confirmed save.

Immutable reads use batches and at most two overlapping requests. Invocation-local caches share immutable objects and pending reads; mutable refs and locks are reread. History batching follows actual parent OIDs, not query ordering. Compact ancestry comparisons retain status and merge-base evidence while omitting file patches; they must not replace full inventories where those are required. No cross-request verification cache or relaxed scope checks were introduced.

## Reject redirects without forwarding credentials

Cloudflare workerd rejects `redirect: 'error'` before making the request. Both GitHub adapters and OAuth token exchange therefore use `redirect: 'manual'` and explicitly reject 3xx responses. They never forward credentials to a redirect target. An uncertain write still requires readback because a redirect response does not prove that no write occurred. Real-runtime regression coverage lives in `cloudflare-runtime.test.mjs`.

## Unpublish and deployment status

`CMS_UNPUBLISH_ENABLED` is disabled unless explicitly set to `true`. It also requires the version-2 capability on main and normal publishing authorization. Install trusted Stage 1 before enabling Stage 2; no rollout or merge is automatic.

The primary editor status describes the verified deployment. Working drafts and pending requests are secondary details. Draft files stay discoverable/editable, with existing route reservations and metadata preserved. After either action merges, continuation uses that action's immutable snapshot rather than assuming published visibility.

The existing marker records draft documents explicitly and rejects draft routes that produced output. Read-only verification checks its repository, workflow, source SHA/run/attempt, successful active Pages deployment, and the selected document at that source revision. It does not probe each page, hash served HTML, poll in the background, or store status in a database. Separate website-status and PR-status invocations preserve the publication client's request budget. Website reads send no GitHub credentials, reject redirects, and have a bounded marker size and timeout.

Links to exact draft destinations produce visible warnings in every build, including after merge; unrelated broken links remain fatal. The warning exemption follows frontmatter, not a persistent exception list. Explicit sidebar entries and custom-page route collisions block unpublishing rather than silently changing navigation. The shared JSON navigation data is used by both Astro configuration and API/CI preflight.

## Direct unpublishing of unchanged pages

Unpublish does not require an editor to manually save an unchanged document. After confirmation, an explicit authorized `initialize: true` POST for the unpublish action prepares or recovers the working revision. Ordinary `prepare: true` remains read-only. The initializer uses authoritative content byte-for-byte rather than form serialization, preserves continuation tokens and saved uploads, and checks loaded source identity, authorization, policy, and explicit navigation blockers. Different concurrent editorial work causes a conflict rather than an overwrite.

The returned revision is passed directly to the existing preparation/submission protocol. A lost response can reuse an identical working copy or an existing unpublish reservation. Initialization does not itself create a publication request or change main. Partial failures keep the copy and open form. Actual unsaved edits must still be saved explicitly. Snapshot metadata, required validation, deployment verification, and feature gates remain unchanged.


## Publication confirmation and normal-editor language

Publish and Unpublish are the normal actions and always authorize automatic completion after explicit confirmation. Both dialogs use the same accessible native-dialog layout, Cancel as the initial focus, Escape dismissal, and focus restoration. Publish identifies the selected immutable saved revision with a version code, available local save time and editor, and a warning when an earlier selection excludes newer work. The loaded working copy is captured when opening; a local change dismisses the dialog, and confirmation rechecks that identity, dirty state, availability and authentication before using the captured head. Concurrent saved work is never silently substituted for that head.

Unpublish keeps the existing current-main-only semantics and prepares any internal copy only after confirmation. A missing automatic-publishing capability disables normal controls instead of falling back to a manual submission. The backend manual prepare/submit protocol remains unchanged for administrative exceptions. Technical request state, GitHub links and raw diagnostics live under View details; normal notices describe validation, deployment and cancellation without PR terminology. Cancellation cannot undo an update already accepted for deployment.
