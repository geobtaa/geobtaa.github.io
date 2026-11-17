Current deployment configuration: see [Permanent GIN editor setup](GIN_EDITOR_DEPLOYMENT.md). The hosted Function now requires `EDITOR_ORIGIN`; project-specific runtime settings are dashboard-managed, with no auto-discovered Wrangler deployment file on this release branch. Older milestone descriptions below record prior configuration.

# Per-document Save Draft milestone

Implemented locally on `editor/cms-release`. Nothing has been pushed, merged, or deployed. This milestone contains no Publish endpoint, PR creation, merge operation, or production deployment tracking.

## Current infrastructure and repository configuration

The existing Cloudflare Pages project is **`geobtaa-github-io`**, whose production branch is **`custom-cms`**. The former root Wrangler configuration is now a historical reference at `docs/cloudflare/staging-wrangler.reference.jsonc`; current deployment configuration is dashboard-managed per project. This corrects local references; it does not rename a project, provision infrastructure, change OAuth credentials/callback registration, or alter any deployed setting. The existing OAuth callback registration must be preserved and verified in the live account before deployment; the same-origin Function derives its callback URL from its request origin.

`gin-editor` is the approved permanent project name, not yet created. Its Git production branch will initially be `editor/cms-release`, then `main`. The permanent URL and OAuth callback stay the same across that switch. The older `geobtaa-editor-staging` name in the historical release audit describes the former documentation mismatch, not another current project.

Application hosting and content storage are independent. Wherever this code is eventually hosted, it reads published content from `main` and stores working revisions on document branches. Legacy staging remains on its deployed code until an explicitly reviewed deployment; this local implementation has not changed its behavior.

## Saving and reopening

- Opening a list combines main's documents with verified working branches from every page of the GitHub `cms/drafts/*` branch inventory. Saving/reopening never depends on local storage, session cookies, an author-specific branch, or the application-host branch. Another authorized editor can reopen and continue the same saved draft.
- One deterministic branch identifies each canonical repository path: `cms/drafts/<area>/<short-filename>-<32-hex-SHA256-path-hash>`. Metadata verifies the exact full path in addition to the hash. Changing a title never changes an existing filename or branch.
- A first Save Draft creates a commit with freshly read main as its single parent, containing exactly the selected document and its permitted referenced new uploads. The branch is created atomically at that commit. No staging ancestry, unrelated documents, or application changes are copied into the working delta.
- Later saves check both the loaded document blob and expected draft head. GitHub GraphQL `updateRefs` compares the exact previous object ID and uses `force: false`. A concurrent edit, externally deleted/reset branch, or stale browser fails without overwriting another editor. An unrelated main update can precede the first draft save if the main document is unchanged. Main changes to the selected document block further saves and retain the readable draft for reconciliation.
- Server-generated `CMS-Draft-v1` commit metadata records canonical path, original main commit/blob, creation identifier where applicable, and verified asset blob identities. Discovery checks ancestry, single-parent history, exact branch/path identity, and the complete tree delta. Foreign files, deletions, symlinks/submodules, replaced existing assets, detached bases, and inconsistent manifests fail closed. Metadata is permission evidence only in combination with these checks; the namespace alone is not trusted.
- New documents always get `draft: true`. Existing documents preserve their exact existing draft field, including an absent field. Save Draft never changes `main`, `custom-cms`, the public site's active content, or eligibility metadata. The UI removes the Draft/Published toggle and reports saved draft state separately from the main version. It does not claim to verify what is deployed live.
- Existing MDX compilation, supported component-link rules, protected-source preservation, frontmatter validation, Markdown handling, route checks, ordinary in-editor Preview, and browser recovery remain in use. Failed/conflicting saves leave form content and editor instances mounted. Account/workspace-scoped recovery includes pending images. The new workspace identity is `<owner>/<repo>#cms-drafts-v1`, independent of hosting. Existing `#custom-cms` browser backups are retained in their old workspace and are not automatically applied to main-based drafts; export them through the legacy editor before cutover. No old browser data is deleted or silently migrated.
- Retryable article creation retains its fixed filename and creation identifier. An uncertain response can recover the original immutable creation revision. A later edit by another account cannot be silently blessed with a current head by a retry; subsequent stale saves conflict.

GitHub documents the [atomic multi-ref update and `beforeOid` comparison](https://docs.github.com/en/graphql/reference/git#updaterefs). No merge or force-update fallback is used if that operation is unavailable.

## Route reservations

Route validation checks current main's complete document/static-route inventory and every verified active draft, including frontmatter slug overrides, `.md`/`.mdx`, case folding, nested index routes, and cross-area claims. Incomplete route queries stop creation.

For a new document, the working branch and an immutable lightweight tag `cms-draft-routes/<SHA256-canonical-route>` are created in the same `updateRefs` transaction, both with an expected absent ref. This prevents two different canonical paths from simultaneously reserving the same output URL. The tag points to the document's initial creation commit; it contains no additional files and is not a second working branch. Tags do not drive branch discovery or ordinary saves. A losing transaction creates neither ref. Existing main documents do not need a new-route tag.

Reservation tags remain until a future, reviewed publishing/cleanup implementation. Do not manually delete them to bypass a conflict. If a working branch was deleted externally while its route tag remains, a maintainer must reconcile the tag's immutable document identity and retained Git history before reusing the route. No automatic deletion or expiry is implemented.

## Images

Image selection still reads main's image library, plus the selected document's verified saved images. Existing repository image syntax is preserved. Authenticated image reads can find an upload through the verified draft inventory after a browser/account change.

Upload preparation validates PNG/JPEG/GIF/WebP type, magic bytes, filename, and the existing 5 MB individual limit. The server derives a document-associated immutable path under `src/assets/images/cms-<path-hash>/`, with the understandable basename and full SHA256 byte digest. It never accepts an arbitrary ref or destination path from the browser. Preparing an upload creates no Git object or ref and triggers no build.

Pending bytes remain in the form/recovery copy and render through local data URLs. Save Draft revalidates the bytes and derives the path again, includes only images referenced by supported body-image or cover fields, and commits them with the document in one ref transaction. Unused pending uploads are excluded. Existing images cannot be overwritten; matching bytes are reusable. A draft cannot attach another document's uncommitted upload. Previously saved associated uploads remain on that working branch after removal from the body; publication must select the final required asset closure later.

The UI requires a first Save Draft before uploading to a never-saved document, so the document has a fixed identity. Its API can include prepared, associated assets on an initial save. Pending uploads are limited to 20 files and 20 million base64 characters per save (approximately 15 MB of bytes); browser storage quotas can be smaller. Storage failures remain visible and offer download/keep-editing recovery. Do not close a tab with pending files if its backup failed.

## Avoiding builds and required live settings

Every draft-save commit starts with **`[CF-Pages-Skip]`**, including initial creation. Cloudflare documents that this prefix [omits its Pages deployment without configuration changes](https://developers.cloudflare.com/pages/configuration/git-integration/github-integration/#skipping-a-build-via-a-commit-message). The code neither updates the application's production branch nor calls a build/deploy endpoint. The GitHub Pages push workflow already targets only `main`; this milestone leaves it unchanged and creates no PR.

Before rollout, an administrator should also configure the existing `geobtaa-github-io` project's **preview branch controls** to use Custom branches and exclude `cms/drafts/*` (or `cms/*`, reserving all CMS branch namespaces). Preserve `custom-cms` as production and preserve its existing production deployment behavior. Preserve current preview includes for ordinary development branches; if no automatic development previews are needed, the None option also suppresses all preview builds. Do not use content/image watch-path exclusions that could suppress real application/production updates. See [Cloudflare branch deployment controls](https://developers.cloudflare.com/pages/configuration/branch-build-controls/).

These settings have **not** been read or changed in the live account. Confirm the skip prefix and branch exclusion with a designated test draft after an authorized deployment, including an initial new-document branch creation. Any future rendered-draft-preview phase will need an explicit isolated build path rather than removing these ordinary-save safeguards globally.

## Validation and remaining integration gates

Regression coverage uses an immutable multi-branch Git fixture and real application serializers. It exercises repeated saves, paginated discovery, another token/account, stale blobs/heads, simultaneous same-path and equivalent-route edits, absent/false draft metadata, changed main documents, scoped image uploads/covers, malformed branches, revoked writes, and uncertain creation responses. Both local and hosted API adapters use this same store. Browser integration covers real Save Draft, reload under another account, conflict retention, and pending-image recovery. The existing editor/Preview/recovery suite remains enabled.

No live GitHub writes or hosted OAuth tests were performed. Before proceeding to production rollout:

1. Deploy the reviewed application only through an explicitly authorized process, preserving legacy staging until its migration is agreed. Validate same-origin OAuth, reauthentication, intended editor accounts' repository rights, and the new stable recovery workspace.
2. On designated test documents, verify actual GitHub `updateRefs` CAS and atomic branch/tag creation with the existing OAuth scope and repository rules. Test two simultaneous authorized accounts, response loss/retry, main conflicts, reload/relogin, and new/existing documents with body/cover uploads. Do not weaken protections or introduce a privileged bypass if branch/tag rules reject the protocol.
3. Verify Cloudflare does not build on initial draft creation, repeated saves, or image saves, while ordinary application changes still build. Apply the reviewed branch exclusions only with separate administrative authorization.
4. Verify Function runtime/subrequest limits, GitHub rate limits, and latency with a realistic active-draft inventory. Main metadata reads and ref discovery are paginated/batched. Full draft ancestry and asset verification still scales with active drafts, history, and asset size. Discovery fails closed on unreadable/foreign branches, over 5,000 inventory entries during pagination, or over 1,000 commits in one draft's history; maintainer cleanup/reconciliation may be needed before those limits. Confirm the intended Cloudflare account tier can support that workload; local mocks cannot establish it.
5. Retain legacy/Decap content migration, production draft-exclusion tests, accessibility/coworker testing, and the independent publication-scope CI/deployment gates from the publishing plan. This milestone has no Publish operation, PR merge, auto-merge, live-publication status, or automatic working-branch/route-tag cleanup. Program Updates editing uses the same safe draft store, while its production publishing/cutover remains separately scoped.

## Completed local validation

| Check | Result |
| --- | --- |
| `npm run test:editor` | 165 passed; zero failures/skips, including both API adapters and the new storage/asset cases. |
| `npm run test:editor:browser` | 50 passed; zero failures/skips, including actual-store reload/account/conflict and pending-image recovery. |
| `npm run test:config` | 1 passed. |
| `npm run test:editor:render` | 2 passed against real Astro rendering. |
| `npm run astro -- sync` | Passed. |
| `npm run astro -- check` | 0 errors, 0 warnings, 4 pre-existing hints. |
| `npm run build -- --timings` | Passed; 178 pages; all internal links valid. |
| `npm run test:navigation` | 2 passed against that production build. |
| Complete diff whitespace check | Passed for this milestone. |

No dependencies or lockfiles changed, and no editorial documents, uploaded assets, public files, table data, or deployment workflows changed. Existing non-blocking build diagnostics remain: large chunks, empty directives in MDX dependencies, and missing `docs/404` content. Astro's four existing hints concern unused metadata variables and deprecated `beforeunload.returnValue` / Zod `.url()` use. Browser tests run locally; the existing CI workflow does not run the browser suite. The Astro production build covers the static editor/site, not a live Cloudflare Function deployment.

## Files changed in this milestone

The following inventory is relative to the clean application transfer commit `6d51b74`. A = added; M = modified. The release audit remains a historical record and links to this milestone for current behavior.

37 files.

```text
M README.md
M docs/CLOUDFLARE_EDITOR_PROTOTYPE.md
M docs/CMS_PUBLISHING_PLAN.md
M docs/CMS_RELEASE_AUDIT.md
A docs/CMS_SAVE_DRAFT.md
M docs/README.md
M editor-prototype/README.md
M editor-prototype/blog-api.test.mjs
M editor-prototype/blog.mjs
M editor-prototype/blogStorage.mjs
M editor-prototype/cloudflare.test.mjs
A editor-prototype/draft-assets-api.test.mjs
A editor-prototype/draftStorage.mjs
A editor-prototype/draftTestRepository.mjs
A editor-prototype/drafts.browser.mjs
M editor-prototype/frontmatter.browser.mjs
M editor-prototype/github.mjs
M editor-prototype/github.test.mjs
M editor-prototype/image-editing.browser.mjs
M editor-prototype/link-button.browser.mjs
M editor-prototype/local-blog-testing.md
M editor-prototype/navigation.browser.mjs
M editor-prototype/page-api.test.mjs
M editor-prototype/page.mjs
M editor-prototype/preview.browser.mjs
M editor-prototype/program-updates.browser.mjs
M editor-prototype/programUpdates.mjs
M editor-prototype/server.mjs
M editor-prototype/simple-components.browser.mjs
M editor-prototype/workplan.md
M functions/api/[[path]].js
M src/components/editor-prototype/ProjectEditor.tsx
M src/components/editor-prototype/editorRecovery.ts
M src/components/editor-prototype/editorTypes.ts
A src/components/editor-prototype/pendingImages.ts
M src/components/editor-prototype/richTextEditor.ts
M wrangler.jsonc
```
