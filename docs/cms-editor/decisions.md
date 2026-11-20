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

## Submit immutable publication requests and merge manually

The chosen workflow is **Edit → Save Draft → Submit for publishing → review and manually merge in GitHub → GitHub Pages deployment**.

Automatic merging, privileged Actions orchestration, a GitHub App migration, background publishing workers, CMS deployment polling, and automatic branch cleanup were abandoned. The CMS reports PR status; merged does not mean verified live publication. The Pages workflow still produces a deployment marker, but the CMS does not use it to certify a live page.

Submission operates on one exact saved head, never unsaved form contents:

1. Preparation reads the immutable saved document and asset manifest. The browser prepares the `draft: false` transformation and proposed image references.
2. The server treats the proposal as untrusted, verifies document/revision/asset identities, compares the current main document, and constructs a separate snapshot from current main plus one document and permitted new image blobs.
3. Required trusted-base CI independently reconstructs and validates the full result. Creating a PR does not certify it as safe to merge.

The working draft is never merged directly. Later draft saves cannot change an open publication request. A coordinator under `cms/publication-state/*`, an immutable snapshot under `cms/publish/*`, and a retained `cms/publication-locks/*` tag bind publication to the selected revision. Initial reservation is atomic; subsequent attempts append history without rewriting earlier attempts.

Lost responses use authoritative readback and same-revision recovery. A merged historical request is terminal. Unrelated main advances can produce a replacement immutable attempt after the previous PR's closure is confirmed. Same-document changes stop for reconciliation. Do not use GitHub's Update branch on CMS snapshots or delete coordinator/lock state to retry.

`CMS_PUBLISH_ENABLED` gates PR creation, not merging. Status reads remain available when creation is disabled. Status is refreshed on opening or explicit Check status; there is no deployment polling timer.

Implementation: `publicationPR.mjs`, `publicationCoordinator.mjs`, `publicationCandidate.mjs`, and `PublicationStatus.tsx`.

## Continue editing after a merge without losing history

The server verifies the recorded merge and that current main still has the exact submitted document and required images. Reopening then supports another normal Save Draft and submission cycle. Newer saved unpublished changes are carried forward instead of discarded.

Version 2 draft identity binds a successor cycle to the published base blob and predecessor head. A metadata-only preservation commit retains the predecessor tree; a successor starts from current main. The first save atomically advances the predecessor and creates the successor. Concurrent starts elect one successor; stale saves cannot advance the retired predecessor. Version 1 histories remain supported.

Same-document or required-image changes beyond the recorded publication block continuation. Install trusted validation supporting new cycle metadata before deployed code creates those cycles. No old branch, tag, snapshot, or coordinator is deleted automatically.

## Preserve unsupported content and recover unsaved work

Existing unsupported Markdown, MDX, Astro components, imports, and layouts stay read-only and retain their source and order. Edits around them are supported. New arbitrary executable syntax and changes inside protected source require technical review and must satisfy the independent source policy; a human approval does not override that policy.

Save endpoints validate generated Markdown/MDX before committing, without evaluating it. Required builds still check repository imports, assets, and rendering. Plain-text component fields are escaped rather than interpreted as executable source.

Ordinary Preview shows the current form, including unsaved content, without writing or deploying. It approximates the page; protected content is shown as placeholders. Program Update conversion preview is a separate explicit workflow and is saved only through Save Draft.

Browser recovery is account/workspace scoped (`<owner>/<repo>#cms-drafts-v1`) and separate from GitHub saves. It includes pending images and safe creation-retry identity. Older staging backups are not silently migrated. Restoring checks the current source and continuation head; incompatible copies remain downloadable instead of overwriting newer work. Multiple copies are never combined automatically. Downloads are JSON; there is no backup import UI.

Session expiry keeps the editor mounted. Reauthentication occurs in another tab, followed by Check sign-in with the same account/workspace. Save failures retain form contents. New article creation persists a fixed filename and creation identifier before sending its request; safe retries recover the original creation rather than duplicate it. Browser storage failure can block creation until retry identity can be preserved.

## Keep list discovery fast without treating it as authorization

Area lists are provisional inventories of main files and saved-work candidates. They do not verify every draft's ancestry, scope, images, route reservations, or publication state. Opening, saving, and submitting still require authoritative checks. Retained generations group into one row per path; ambiguity produces Needs review rather than choosing by timestamp or branch order.

One in-memory catalog per area is scoped to origin, API, workspace, and account. Returning to a list shows prior rows while a fresh request runs; failures label it out of date. Sign-out/authentication loss clears it. It is not persisted or used to initialize an editable document. Opening a document does not wait for a separate list refresh. Saving refreshes the list; a failed refresh cannot undo a confirmed save.

Immutable reads use batches and at most two overlapping requests. Invocation-local caches share immutable objects and pending reads; mutable refs and locks are reread. History batching follows actual parent OIDs, not query ordering. Compact ancestry comparisons retain status and merge-base evidence while omitting file patches; they must not replace full inventories where those are required. No cross-request verification cache or relaxed scope checks were introduced.

## Reject redirects without forwarding credentials

Cloudflare workerd rejects `redirect: 'error'` before making the request. Both GitHub adapters and OAuth token exchange therefore use `redirect: 'manual'` and explicitly reject 3xx responses. They never forward credentials to a redirect target. An uncertain write still requires readback because a redirect response does not prove that no write occurred. Real-runtime regression coverage lives in `cloudflare-runtime.test.mjs`.
