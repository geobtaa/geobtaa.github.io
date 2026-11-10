The prototype supports blog posts, the enabled documentation areas, Program Updates, image uploads and formatting, tables, editable content blocks, protected MDX, and hosted GitHub sign-in. Current saves still go to `custom-cms`. Program Updates now has an optional outline, a flexible article body, and conversion previews for older content. Chip List and Card Grid blocks and icon formatting toolbars are implemented across the editor.

Review status (November 10, 2026): the editing features and local/automated checks are complete for the implemented prototype flows. The main unfinished work is the production publishing workflow in step 3, followed by hosted end-to-end validation and coworker testing. The newer publishing plan keeps release 1 focused on blog posts and enabled documentation; Program Updates editing is already implemented, but its production publishing rollout remains separate. Optional authenticated saved-draft previews are phase 2.

Implementation note: existing blog saves still commit to staging. The agreed direction is separate Save Draft and Publish actions, shared per-document working branches, narrow automatic publishing PRs, and verified production deployment. Optional authenticated previews are phase 2. See the [publishing implementation plan](../docs/CMS_PUBLISHING_PLAN.md) for design, safeguards, transition, and launch prerequisites. Completed checkboxes below record prototype behavior; step 3 supersedes the editorial visibility switch and shared staging publication model.

1. Confirm the blog post content model

Keep the existing blog post fields and confirm how they will work in the prototype.

- [x] Keep the existing blog frontmatter fields: `title`, `excerpt`, `authors`, `cover`, `tags`, `date`, and `draft`
- [x] Review existing post bodies: custom components such as `<centerLayout>` can use the same protected, uneditable MDX handling as other page types
- [x] Ensure metadata controls correctly load and preserve existing blog frontmatter
- [x] Define field requirements and defaults: `title` is required; `date` is autofilled for new posts and remains editable; `draft` defaults to `true` until the user changes it; `excerpt`, `authors`, `cover`, and `tags` are optional
- [x] Align editor controls and server-side validation with these requirements; preserve existing dates and draft states when opening existing posts
- [x] Define validation for publication date and timezone, author names, tags, optional cover image and alt text, and draft state
- [x] Verify URL derivation: `docsLoader()` in `src/content.config.ts` uses Astro's default glob IDs, derived from the relative filename without its extension unless frontmatter overrides `slug`; Starlight routes use those IDs, and `src/utils/blogContent.ts` builds listing links from `entry.id`. Existing posts have no frontmatter `slug` overrides
- [x] Choose permanent filenames as the simplest source of stable URLs: a new `src/content/docs/posts/example-title.mdx` produces `/posts/example-title/`, without adding a `slug` metadata field
- [x] Define new-post slug rules: generate a short, URL-friendly slug from the title on first creation, without automatically including the publication date; keep it permanent after changes to title, date, or other metadata
- [x] Keep all existing post filenames and URLs unchanged; version 1 has no editable slug field, and intentional URL changes and redirects are handled manually through GitHub
- [x] Verify compatibility with `src/content/BlogSchema.ts`, `src/content.config.ts`, and blog listings and filters

2. Add blog posts to the editor

Support creating and editing blog posts with the existing fields and Markdown/MDX body.

- [x] Enable `posts` in the shared content-area configuration and both local and hosted APIs; support listing, opening, editing, and creating entries
- [x] Add controls for title, excerpt, repeatable authors, tags, publication date, optional cover image and alt text, and Hide from site
- [x] Require a nonblank title, autofill an editable publication date on creation, and default new posts to Hide from site (`draft: true`); allow the other fields to be omitted
- [x] Generate and persist the title-based filename on first creation; reuse the exact saved filename and extension on every subsequent save, without regenerating it from metadata
- [x] Check proposed slugs against existing content IDs and routes, including drafts, `.md`/`.mdx` variants, and equivalent index paths; suggest an available alternative such as `example-title-2` when occupied
- [x] Enforce collision protection on the server in both APIs: create without a replacement SHA, reject occupied routes and filenames, and handle concurrent creation conflicts without overwriting existing content; suggest another unique alternative while preserving the user's work
- [x] Extend frontmatter controls across all enabled areas using the blog patterns: area-specific metadata, navigation/layout settings, and Draft / Published; validate saves against authoritative GitHub content and preserve optional/unknown values
- [x] Add server-side validation; preserve unmanaged frontmatter, multiline YAML, existing author and cover metadata, and unsupported MDX when saving
- [x] Separate controls within a text block from a responsive side menu for adding new blocks after any existing block; avoid automatic empty blocks
- [x] Add insertion and property forms for new badges, plain-text callouts, and plain-text cards, using existing Starlight components; keep legacy components protected
- [x] Add LinkButton insertion and property editing for plain button text, URL, and appearance; preserve unsupported buttons as protected MDX
- [x] Use the existing rich-text body editor, image uploads, tables, editable LinkCards, and protected MDX blocks for blog content
- [x] Preserve custom component imports and entire protected blocks verbatim, including nested content; keep surrounding Markdown editable
- [x] Improve prototype navigation and save-state feedback; production publishing and optional rendered previews remain tracked separately below
- [x] Open on a dashboard with no content area selected; add prominent back buttons to content lists and editing views, keep top navigation visible while scrolling, and preserve unsaved-change prompts
- [x] Add matching Save buttons at the top and bottom; distinguish unsaved changes from visibility, highlight saved drafts in content lists, and label navigation-only hiding separately
- [x] Warn before leaving unsaved changes and preserve work in the open editor after failed saves, expired sessions, and stale-file conflicts; document how to copy unsaved changes before reloading
- [x] Distinguish unsaved changes, saving, and a saved staging commit in the prototype
- [ ] Add verified publishing/deployment states under step 3; do not infer that a saved commit is live
- [ ] Phase 2: add rendered saved-draft previews with exact-version links and readiness status; conversion previews are implemented but do not provide a hosted page preview
- [x] Improve ordinary Markdown image insertion and editing with source, alt text, and optional captions stored as image titles; show centered images and captions in the existing editor, preserve unchanged image syntax, and keep legacy MDX protected
- [x] Add compatible image resize handles, width entry, and left/center/right alignment to the existing editor; store formatting in a narrow HTML figure around the Markdown image, preserve captions and asset paths, and provide Reset formatting
- [x] Verify body-image selection, upload, alt text, captions, formatting, and save/reopen in isolated browser tests; cover metadata validation and preservation are covered by unit/API tests
- [x] Document the prototype's separate upload commits and retained unused uploads; document working-branch upload isolation and publication asset selection as future step 3 work
- [ ] Complete cover-image picker/upload/removal and save/reopen checks in the browser and hosted workflow
- [x] Check representative keyboard interactions, labels, focus behavior, error feedback, and smaller-screen layouts with the automated prototype browser suite
- [x] Replace formatting-toolbar words with icons in both main and card-content editors, retaining tooltips, accessible names, focus indicators, and active/disabled states
- [x] Add explicit Text block removal, empty-block labels, undo for the most recent block removal, and keyboard focus handling; preserve neighboring content/imports and allow adding content after removing the last block
- [x] Add editor URLs and browser Back/Forward history for dashboard, lists, existing entries, and uniquely identified new entries; protect unsaved changes and preserve the URL/editor when navigation is canceled
- [x] Add debounced local document recovery with lifecycle/navigation flushes, account/workspace isolation, independent session copies, restore/download/discard controls, repository SHA rechecks, and visible storage-failure handling
- [x] Preserve requested editor URLs through hosted sign-in and reject external return destinations
- [ ] Complete manual keyboard and assistive-technology review alongside coworker usability testing

3. Finalize publishing

Implement the [detailed publishing plan](../docs/CMS_PUBLISHING_PLAN.md). Planning is complete; the following implementation and administrative checks remain pending. Keep the existing Cloudflare staging setup operational during transition.

- [x] Define stable application deployment, draft metadata/lifecycle, publication scope, permissions/checks, deployment tracking, recovery, previews, and Decap transition in the detailed plan
- [ ] Prepare a clean application release branch from current `main`; transfer reviewed editor changes without staging content/history
- [ ] Provision a stable same-origin Cloudflare editor/API deployment tracking `main`, retaining existing `custom-cms` staging during transition
- [ ] Add shared document working branches based on current `main`, draft discovery/reopening, isolated uploads, and concurrent-save protection
- [ ] Replace the editorial Draft/Published switch with Save Draft and Publish; automatically manage underlying `draft` frontmatter without hiding the existing live page
- [ ] Implement fixed single-document publication snapshots, required-asset selection, collision protection, stale-main conflicts, and idempotent PR creation/automatic merging
- [ ] Add an independent required publication-scope check and make existing validation required; verify actual repository rules and intended editor account capabilities
- [ ] Verify production draft exclusion from routes, navigation, listings, search, sitemap, and feeds present
- [ ] Track the exact published revision through production deployment, overlapping/canceled runs, and served build verification before reporting Published
- [ ] Restrict production Pages deployment to `main`, including manual workflow dispatch
- [ ] Verify authorization on writes, allowlist, session expiry/logout, same-origin protection, and expired-session recovery
- [ ] Implement concise failure states and document manual deployment/conflict/revert recovery
- [ ] Inventory legacy/Decap drafts and transfer content-area ownership during rollout; prevent both editors from editing migrated areas
- [ ] Phase 2: verify existing Cloudflare branch preview controls/Access, isolate preview credentials, render only the selected draft, and link to the exact saved deployment

4. Validate and refine blog posts

Validate representative editing tasks against the completed prototype, then exercise the new publishing workflow once step 3 is implemented. Program Updates editing is already implemented in step 5.

- [x] Add regression coverage for blog creation and metadata, existing post formats, protected MDX, unchanged content, duplicate filenames, and stale-file conflicts
- [x] Verify title-derived slugs omit automatic date prefixes, remain unchanged after title/date/metadata edits, and leave existing filenames and URLs intact; test unique alternatives, equivalent route collisions, and simultaneous creation without overwrites
- [x] Verify representative posts with custom layout components survive opening, editing surrounding Markdown, saving, and reloading without changes to the protected MDX
- [x] Run `npm run test:editor`, Astro sync/check, `npm run build`, and `npm run test:navigation` against representative blog posts
- [ ] Exercise phase 1 hosted workflow: sign in, create/reopen a draft, edit an existing entry, upload an image, save, publish through required checks, and verify the deployed live page and listings; add optional preview testing in phase 2
- [x] Test unsaved-navigation cancellation/discard, stale-save rejection, and retention of open edits after a simulated failed conversion save
- [x] Test Back/Forward, direct links, immediate reload recovery, new-entry recovery, failed/pending saves, stale-copy preservation, unavailable storage, and account/workspace isolation with an isolated local browser; live hosted verification remains pending
- [ ] Exercise expired-session/reauthentication, network uncertainty, failed validation/build/deployment, refresh/relogin, and concurrent publication recovery through the real hosted workflow; prototype tests do not establish these release guarantees
- [ ] Resolve remaining issues discovered during hosted publishing/recovery validation
- [x] Update `editor-prototype/README.md` with blog post fields, supported body content, preview behavior, publishing responsibilities, and recovery instructions

5. Program Updates prototype implementation

The separate Program Updates editing workflow is implemented and has local, API, browser, and representative rendered-page validation. This completes the prototype implementation, not production publication/cutover. The scoped release 1 publishing plan still covers blog posts and enabled documentation; coordinate Program Updates ownership and publishing rollout separately.

- [x] Audit update frontmatter, older MDX bodies, and newer `programUpdate` data rendered by `ProgramUpdateStructured`
- [x] Design the simplified program update template and decide whether it uses Markdown, structured fields, or a combination
- [x] Define required and optional fields, compatibility with existing updates, and any migration needed
- [x] Plan update-specific controls, rendering, validation, and tests before enabling `updates` in the editor
- [x] Review MDX requirements: reuse current rich-text controls, convert supported legacy layouts, and keep unfamiliar components protected
- [x] Implement program update creation and editing, enable `updates` in both local and hosted APIs, and run the relevant regression and build checks
- [x] Validate creating, editing, saving, and rendering representative program updates while preserving existing content
- [x] Add optional Chip List and Card Grid blocks across content areas, including rich card content, entry reordering, source preservation, and save/reopen/rendering checks

6. Run coworker usability test and release

Show coworkers the editor after routine blog and enabled documentation publishing work end to end. Program Updates prototype editing is complete and can be included in editing feedback, while its production publishing/cutover remains separate. Optional authenticated previews follow in phase 2.

- [x] Document implemented prototype editing, Program Updates conversion, content blocks, icon toolbars, staging saves, and recovery limits in `editor-prototype/README.md`
- [ ] Create a short coworker guide for the final Save Draft / Publish workflow and a maintainer recovery/cutover runbook after step 3
- [ ] Run coworker usability test
- [ ] Include creating a blog post and updating a documentation page; confirm coworkers can distinguish saved drafts, publishing, and verified live content without assistance
- [ ] Fix essential issues found during the usability test
- [ ] Agree on release criteria: blog/documentation publishing works end to end, existing content is preserved, publication scope and validation are enforced, deployment is verified, and no unresolved data-loss or access issues remain
- [ ] Release version 1 with verified blog/documentation publishing; roll out Program Updates publishing separately after its production scope and cutover are ready
- [ ] Start with a small group of editors, identify a support contact, and record follow-up improvements after the first routine publishing cycle

Next implementation sequence

1. Review live repository rules, intended editor-account permissions, Cloudflare/OAuth settings, and legacy drafts; prepare the clean application release branch from `main` without importing staging content/history. These live settings have not been verified by the local tests.
2. Implement shared per-document working branches, isolated uploads, discovery/reopening, concurrent-save protection, and **Save Draft**, following `docs/CMS_PUBLISHING_PLAN.md`.
3. Implement **Publish** using fixed single-document snapshots, an independent required scope check, required validation, and idempotent automatic PR merging.
4. Track and verify the exact production deployment, finish failure/recovery states, and validate one new blog post and one documentation update end to end. Include the outstanding cover-image and recovery checks.
5. Deploy the stable editor, complete the user/maintainer guides and area-by-area Decap cutover, and run coworker usability testing before release. Schedule Program Updates production publishing separately; optional saved-draft previews remain phase 2.
