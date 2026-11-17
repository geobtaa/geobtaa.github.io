# Custom CMS application release audit

Historical application-transfer record, prepared November 16, 2026. The subsequent Save Draft milestone is documented in [CMS_SAVE_DRAFT.md](CMS_SAVE_DRAFT.md); it supersedes the staging-write behavior and naming discrepancy recorded here. This branch prepares application code only; it does not implement Save Draft, Publish, or production deployment.

## Branch and working-tree provenance

- Release branch: `editor/cms-release`, created directly from freshly fetched `origin/main` at `ab86dd67a0b9b09d3bacaf23fe8425c0421460ad`.
- Reviewed source: `custom-cms` / `origin/custom-cms` at `d74ba55e37df933f1578fc73e56c64ede844cead`.
- The starting working tree was clean, with no staged, unstaged, or untracked fixes. Source HEAD matched the remote.
- Recent recovery fixes (`4fcfdf4`, `24633a0`, `1adaff1`, `d74ba55`), image width presets (`bfbc789`), Preview links (`b242666`), reliability tests (`dbccee4`), Markdown/MDX compatibility (`997e34f`), and security fixes (`39f6015`) were already committed. Their resulting application files are included.
- No merge or cherry-pick of staging history was used. Application paths were reviewed and transferred by file/diff. The release branch has no upstream, avoiding an inherited `origin/main` push target. Nothing was pushed.
- The publishing plan's original baseline was stale: `a909f05` removed the old editor from `main`. This preparation restores the current application under the user's explicit request.

## Application scope and dependency review

- `src/pages/editor/index.astro` and all `src/components/editor-prototype/` files provide the dashboard, metadata and rich-text editing, blocks, image controls, Preview, navigation guards, account/workspace-scoped recovery, reauthentication, and retry handling.
- `functions/api/[[path]].js` provides same-origin GitHub OAuth/session handling, content operations, and image operations. `editor-prototype/` contains the shared serialization, creation, route collision, frontmatter/preservation validation, GitHub and image utilities, local API gateway, test harnesses, and tests. Synthetic test data remains inside test code; no test documents or images were added to site content.
- `src/components/editor-blocks/` contains the published Chip List, Card Grid, and Metrics renderers plus shared data parsing and Metrics CSS. They are required by MDX the editor can generate, even though staging example documents are excluded.
- `remarkSafeComponentLinks.ts` and its Astro registration escape static Link Card text and reject unsafe static Link Card/Button URLs, including aliases. The existing image plugins retain main's logic with reviewed support for update article images and widths from 1 to 10,000 pixels.
- Shared badge CSS is imported into both the site and editor. It changes existing public badge appearance. Image rendering support, static component-link handling, and the fullview dependency patch also affect public rendering. These are intentional application changes, not document or uploaded-asset edits.
- Dependencies restore Tiptap and explicitly declare the MDX, Markdown/AST, entity, and directive packages used by the application. `patch-package` and the install hook apply the Zod 4 `.prefault({})` fix to `starlight-fullview-mode`, whose constraint is pinned to `0.2.6`. Every existing main lockfile package path and version is preserved; no installed main package is removed or downgraded. `npm ci` succeeded and applied the patch.
- Existing `main` navigation, layouts, component overrides, utilities, content schemas (including i18n), collection-policy content, workgroup table, Astro 7 versions, and production deployment workflow are preserved. The overlapping Astro configuration, global CSS, image plugins, dependencies, and validation workflow were reviewed; no textual conflicts or missing dependencies were found by the checks below.
- CI restores configuration, unit/API, and rendered-link regression tests and adds application/function/patch path triggers. The browser suite was run locally; the existing validation workflow does not run it.

## Complete content and asset audit against main

**Zero changes** under `src/content/`, `src/assets/`, `public/`, or `src/tables/`. No content or uploaded image is necessary for this transfer. Navigation configuration and existing shared utilities are unchanged. Temporary browser fixtures and render-test documents were removed by their harnesses. Generated `dist/`, `.astro/`, dependencies, and local runtime data are ignored and excluded from the commit.

The technical documentation changes are exhaustive:

- `README.md`: adds editor/audit documentation links and test commands, preserving main's existing historical validation statements.
- `docs/README.md`: adds application/audit links.
- `docs/CLOUDFLARE_EDITOR_PROTOTYPE.md`: restores the architecture summary, updates supported features, and records the staging-name discrepancy.
- `docs/CMS_PUBLISHING_PLAN.md`: carries the agreed future design and corrects the current-main baseline; no publishing behavior is implemented.
- `docs/CMS_RELEASE_AUDIT.md`: this transfer inventory and validation report.
- `editor-prototype/README.md`: restores current implementation/setup/recovery documentation, corrects Preview link behavior, and marks old hosting instructions as historical.
- `editor-prototype/local-blog-testing.md`: preserves the prototype testing guide, not a published content page.
- `editor-prototype/workplan.md`: preserves implementation history and marks application branch preparation complete; publishing remains pending.
- `patches/README.md`: explains the fullview compatibility patch and removal criteria.

## Excluded branch differences

| Path | Decision |
| --- | --- |
| `src/content/docs/posts/test-poststststst.mdx` | Exclude additional staging test edits. The existing test post on main stays byte-for-byte unchanged; any cleanup needs a separate content decision. |
| `src/content/docs/projects/testproject.mdx` | Exclude staging test project. |
| `src/content/docs/updates/test-update.mdx` | Exclude staging test update. |
| `src/content/docs/updates/this-is-a-test-program-update.mdx` | Exclude staging test update. |
| `src/content/docs/updates/2026-10-02-september-2026-program-update.mdx` | Exclude staging conversion, component examples, and editorial edits. Preserve main's structured version and its later main edit. |
| `src/content/docs/library/collection-development.mdx` | Preserve main's newer content. |
| `src/content/docs/library/collection-policy.mdx` | Preserve main's added page; do not import staging's absence. |
| `src/content/docs/library/geodata-collection-roadmap.mdx` | Preserve main's newer roadmap edits. Preservation tests run against this current version. |
| `src/content/docs/workgroups/collection-policy-wg.mdx` | Preserve main's added workgroup page. |
| `src/content/i18n/en.json` | Preserve main's translation data. |
| `src/tables/workgroups.csv` | Preserve main's collection-policy workgroup entry. |
| `src/content.config.ts` | Preserve main's i18n loader/schema/collection configuration, rather than copying the stale staging version. |

There are no differing uploaded-asset paths in either the tip-to-tip or merge-base application-source comparison. No staging-only asset was transferred; assets already shared with main are retained. Older test artifacts already on main are outside this preparation's cleanup scope. Stale root README claims about historical test counts were not restored.

## Validation

Executed with Node `v24.13.1` and a fresh `npm ci`:

| Check | Result |
| --- | --- |
| `npm ci --no-audit --no-fund` | Passed; 737 packages installed, fullview patch applied. |
| `npm run test:editor` | 156 passed, zero failures or skips; includes unit and mocked local/Cloudflare API checks. |
| `npm run test:editor:browser` | 48 passed, zero failures or skips; local headless Chrome, isolated profiles, mocked GitHub, no hosted writes. |
| `npm run test:config` | 1 passed. |
| `npm run astro -- sync` | Passed. |
| `npm run astro -- check` | Passed: 0 errors, 0 warnings, 4 hints. |
| `npm run test:editor:render` | 2 passed; real Astro Link Card rendering and rejection of unsafe component URLs. |
| `npm run build -- --timings` | Passed: 178 pages, all internal links valid. |
| `npm run test:navigation` | 2 passed against the final production build. |
| `git diff --cached --check -- . ":(exclude)patches/*.patch"` | Passed. The verbatim dependency patch retains intentional CRLF/context whitespace from the upstream file. |

The first browser attempt was blocked by the sandbox's loopback listener restriction (`EPERM`); rerunning with local server/browser access passed the full suite. This was an environment restriction, not an application fix. Test-generated source fixtures are absent from the final diff. The full unfiltered whitespace check reports the dependency patch's intentional CRLF/context lines; they are retained so patch application matches the installed package. An extra empty line at the end of `editorTypes.ts` was removed; that whitespace-only cleanup is the sole implementation-file difference from the committed staging source.

## Staging preservation and remaining issues at application transfer

`geobtaa-github-io`, tracking `custom-cms`, is unchanged by this work: no Cloudflare project, branch connection, OAuth app/callback, runtime variable, secret, or deployment was modified. Neither `main` nor `custom-cms` was modified or pushed. The transferred API and local gateway still write to `custom-cms`; they have not been redirected to production or this development branch. `wrangler.jsonc` and the hosted Function are unchanged from the reviewed source.

No connected Cloudflare administrative tool or live account inspection was available, so this records non-mutation by this work, not independent verification of the live dashboard's settings. At transfer time, `wrangler.jsonc` and older instructions used `geobtaa-editor-staging`. The subsequent Save Draft milestone reconciles current repository references to the existing `geobtaa-github-io` project. This is a local configuration/documentation correction, with no live rename, provisioning, or OAuth change.

Before Save Draft / Publish work:

1. Use this branch as the clean code baseline and keep ordinary saves on legacy staging until the new workflow is implemented. The current Draft / Published toggle is only frontmatter, and Save changes commits directly to staging; it does not mean production publication.
2. Follow the existing plan for per-document working branches, atomic concurrency checks, isolated immutable uploads, fixed publication snapshots, independent scope CI, verified production deployment, and recovery. These do not exist yet.
3. Verify repository rules, required checks/auto-merge policy, intended editor permissions (including reauthorization at write/publish time), and live hosting/OAuth configuration before rollout. The mocked API tests do not establish these administrative guarantees. The unchanged production workflow still permits manual dispatch without a main-only job guard; address that during publishing implementation.
4. Keep Program Updates editing/conversion in this complete application baseline, while keeping Program Updates publication/cutover outside the scoped first publishing release. Inventory legacy and Decap drafts separately; do not merge staging content as code.
5. Carry forward non-blocking diagnostics: Astro hints for two unused metadata variables and deprecated `beforeunload.returnValue` / Zod `.url()`; build warnings for large chunks, empty directives in MDX dependencies, and missing `docs/404` content. Build/link/navigation checks pass. Manual hosted OAuth, cover-image, assistive-technology, and real publishing/recovery tests remain future release gates.

## Transferred file manifest

The following is the exhaustive application/documentation diff against main (A = added, M = modified). No file outside this inventory is part of the transfer.

112 files.

```text
M .github/workflows/validate.yml
M README.md
M astro.config.ts
A docs/CLOUDFLARE_EDITOR_PROTOTYPE.md
A docs/CMS_PUBLISHING_PLAN.md
A docs/CMS_RELEASE_AUDIT.md
M docs/README.md
A editor-prototype/README.md
A editor-prototype/article-creation.test.mjs
A editor-prototype/articleCreation.mjs
A editor-prototype/block-insertion.browser.mjs
A editor-prototype/block-moves.browser.mjs
A editor-prototype/block-moves.test.mjs
A editor-prototype/blog-api.test.mjs
A editor-prototype/blog.mjs
A editor-prototype/blog.test.mjs
A editor-prototype/blogStorage.mjs
A editor-prototype/browserHarness.mjs
A editor-prototype/cloudflare.test.mjs
A editor-prototype/collection-blocks.browser.mjs
A editor-prototype/collection-blocks.test.mjs
A editor-prototype/componentLinks.mjs
A editor-prototype/content-routes.test.mjs
A editor-prototype/content.mjs
A editor-prototype/content.test.mjs
A editor-prototype/contentAreas.mjs
A editor-prototype/contentRoutes.mjs
A editor-prototype/creationTestRepository.mjs
A editor-prototype/document-validation.test.mjs
A editor-prototype/format-routes.browser.mjs
A editor-prototype/formatted-images.test.mjs
A editor-prototype/frontmatter.browser.mjs
A editor-prototype/github.mjs
A editor-prototype/github.test.mjs
A editor-prototype/githubTestHelpers.mjs
A editor-prototype/image-editing.browser.mjs
A editor-prototype/imageAssets.mjs
A editor-prototype/images.test.mjs
A editor-prototype/link-address.test.mjs
A editor-prototype/link-button.browser.mjs
A editor-prototype/link-card-safety.test.mjs
A editor-prototype/link-card.browser.mjs
A editor-prototype/local-blog-testing.md
A editor-prototype/navigation.browser.mjs
A editor-prototype/page-api.test.mjs
A editor-prototype/page.mjs
A editor-prototype/page.test.mjs
A editor-prototype/pageMetadata.mjs
A editor-prototype/preservation.browser.mjs
A editor-prototype/preview.browser.mjs
A editor-prototype/program-updates.browser.mjs
A editor-prototype/program-updates.test.mjs
A editor-prototype/programUpdates.mjs
A editor-prototype/recovery.browser.mjs
A editor-prototype/recovery.test.mjs
A editor-prototype/reliability.browser.mjs
A editor-prototype/rich-text.test.mjs
A editor-prototype/server.mjs
A editor-prototype/simple-components.browser.mjs
A editor-prototype/validateDocument.mjs
A editor-prototype/workplan.md
A functions/api/[[path]].js
M package-lock.json
M package.json
A patches/README.md
A patches/starlight-fullview-mode+0.2.6.patch
A src/components/editor-blocks/CardGrid.astro
A src/components/editor-blocks/ChipList.astro
A src/components/editor-blocks/Metrics.astro
A src/components/editor-blocks/data.mjs
A src/components/editor-blocks/metrics.css
A src/components/editor-prototype/CardBodyEditor.ts
A src/components/editor-prototype/CollectionBlockViews.ts
A src/components/editor-prototype/DocumentPreview.tsx
A src/components/editor-prototype/LinkAddressField.ts
A src/components/editor-prototype/LinkButtonBlock.ts
A src/components/editor-prototype/LinkCardBlock.ts
A src/components/editor-prototype/MdxMarkdown.ts
A src/components/editor-prototype/ProjectEditor.tsx
A src/components/editor-prototype/RecoveryManager.tsx
A src/components/editor-prototype/SimpleComponentBlock.ts
A src/components/editor-prototype/ToolbarButton.ts
A src/components/editor-prototype/UnsavedChangesDialog.tsx
A src/components/editor-prototype/UnsavedChangesList.tsx
A src/components/editor-prototype/bodySegments.ts
A src/components/editor-prototype/collectionMdx.ts
A src/components/editor-prototype/componentLinkSafety.ts
A src/components/editor-prototype/contentSyntax.ts
A src/components/editor-prototype/editor.css
A src/components/editor-prototype/editorNavigation.ts
A src/components/editor-prototype/editorRecovery.ts
A src/components/editor-prototype/editorTypes.ts
A src/components/editor-prototype/formattedImage.ts
A src/components/editor-prototype/linkAddress.ts
A src/components/editor-prototype/linkButtonMdx.ts
A src/components/editor-prototype/linkCardMdx.ts
A src/components/editor-prototype/preview.css
A src/components/editor-prototype/previewLinks.ts
A src/components/editor-prototype/richTextEditor.ts
A src/components/editor-prototype/simpleComponents.ts
A src/components/editor-prototype/starlightImports.ts
A src/components/editor-prototype/toolbarIcons.ts
A src/components/editor-prototype/useEditorRecovery.ts
A src/pages/editor/index.astro
M src/plugins/remarkCenterLayoutImages.ts
M src/plugins/remarkFormattedImages.ts
A src/plugins/remarkSafeComponentLinks.ts
A src/styles/badges.css
M src/styles/global.css
A tests/cms-links-render.test.mjs
A tests/fullview-mode.test.mjs
A wrangler.jsonc
```
