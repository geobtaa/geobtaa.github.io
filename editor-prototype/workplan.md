The prototype already supports several content directories, image uploads, tables, editable LinkCards, protected MDX blocks, and hosted GitHub sign-in. Saves go to `custom-cms`; `posts` is now enabled; `updates` remains deferred. Blog post creation and editing are implemented using the existing frontmatter fields; browser acceptance and the publishing/release work below remain. Program updates are deferred until after this milestone.

Implementation note: blog saves commit to staging. Production builds still omit drafts, so hosted draft previews and deployment-status tracking remain separate work. Recovery copies can be downloaded for manual recovery; automatic recovery-file import is not implemented.

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
- [x] Add server-side validation; preserve unmanaged frontmatter, multiline YAML, existing author and cover metadata, and unsupported MDX when saving
- [x] Use the existing rich-text body editor, image uploads, tables, editable LinkCards, and protected MDX blocks for blog content
- [x] Preserve custom component imports and entire protected blocks verbatim, including nested content; keep surrounding Markdown editable
- [ ] Improve navigation, saving, and previews for the blog workflow
- [x] Warn before leaving unsaved changes and preserve work after failed saves, expired sessions, and stale-file conflicts; provide a recovery or copy-out path
- [ ] Distinguish unsaved changes, saved commits, deployment in progress, and a preview ready to view; ensure preview links show the intended saved version and explain whether unsaved content is included
- [ ] Verify image selection, upload, alt text, and cover images in blog posts; document that uploads commit separately and decide how unused uploads are handled
- [ ] Check keyboard navigation, field labels, dialog focus, error messages, and usability on smaller screens

3. Finalize publishing

Separate development from publishing, establish production validation, and document the staging-to-live workflow.

- [ ] Define branch and merge strategy
- [ ] Decide how editor code changes and content saves are isolated so unfinished editor development does not enter a content publishing PR
- [ ] Define who reviews and merges content from staging to `main`, how unrelated staged edits are excluded when needed, and how staging stays synchronized with production
- [ ] Separate Save, Hide from site, and Publish labels and behavior; a save to `custom-cms` must not imply the content is live
- [ ] Verify draft visibility on direct URLs, blog listings, navigation, search, and any feeds or sitemap; decide how authorized editors preview hidden drafts
- [ ] Require successful builds
- [ ] Make the existing validation workflow a required merge check, confirm its triggers cover publishing changes, and verify the approved commit deploys successfully to GitHub Pages
- [ ] Confirm the editor's hosted URL and API host for routine use; GitHub Pages serves the public site while the hosted editor API currently runs on Cloudflare Pages
- [ ] Document rollback and access settings
- [ ] Verify hosted sign-in, repository permissions, optional user allowlist, session expiry, logout, and rejection of unauthorized writes before expanding access
- [ ] Document how to recover from a failed staging build, failed live deployment, or incorrect content publish, including image changes and staging synchronization after rollback
- [ ] Define how the prototype and existing Decap `/admin` editor coexist during rollout, including how editors avoid conflicting changes

4. Test and release

Validate representative blog editing tasks, resolve release blockers, and begin routine production use.

- [x] Add regression coverage for blog creation and metadata, existing post formats, protected MDX, unchanged content, duplicate filenames, and stale-file conflicts
- [x] Verify title-derived slugs omit automatic date prefixes, remain unchanged after title/date/metadata edits, and leave existing filenames and URLs intact; test unique alternatives, equivalent route collisions, and simultaneous creation without overwrites
- [x] Verify representative posts with custom layout components survive opening, editing surrounding Markdown, saving, and reloading without changes to the protected MDX
- [x] Run `npm run test:editor`, Astro sync/check, `npm run build`, and `npm run test:navigation` against representative blog posts
- [ ] Exercise the full hosted workflow: sign in, create a draft, edit an existing entry, upload an image, save, preview, review, publish, and verify the live page and blog listing
- [ ] Test recovery from unsaved navigation, session expiry, a network failure, concurrent edits, and a failed build without losing the editor's work
- [ ] Run coworker usability test
- [ ] Include creating a blog post and editing an existing post; confirm coworkers can distinguish saving, previewing, hiding, and publishing without assistance
- [ ] Fix essential issues
- [ ] Agree on release criteria: blog creation and editing work end to end, existing content is preserved, publishing checks pass, and no unresolved data-loss or access issues remain
- [ ] Create short editor guide
- [x] Update `editor-prototype/README.md` with blog post fields, supported body content, preview behavior, publishing responsibilities, and recovery instructions
- [ ] Release version 1 with blog post support
- [ ] Start with a small group of editors, identify a support contact, and record follow-up improvements after the first routine publishing cycle

5. Return to program updates after blog post release

Treat program updates as a separate content model and editor workflow.

- [ ] Audit update frontmatter, older MDX bodies, and newer `programUpdate` data rendered by `ProgramUpdateStructured`
- [ ] Design the simplified program update template and decide whether it uses Markdown, structured fields, or a combination
- [ ] Define required and optional fields, compatibility with existing updates, and any migration needed
- [ ] Plan update-specific controls, rendering, validation, and tests before enabling `updates` in the editor
- [ ] Revisit editable MDX attributes beyond the existing LinkCard support if the update workflow needs them
