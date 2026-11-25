# CMS editor

The dedicated gin-editor build serves the editor at `/`, with legacy `/editor/` redirects. The public-site development build serves it at `/editor/`. It reads the published-content baseline from `main` and saves working revisions on shared per-document `cms/drafts/*` branches. Application hosting is independent of content storage. Decap `/admin` is unchanged. See [CMS editor development decisions](../docs/cms-editor/README.md) for design, hosting, validation, and operational limits.

The enabled directories are `about`, `conference`, `guides`, `library`, `metadata`, `posts`, `projects`, `scholarship`, `team`, `updates`, and `workgroups`. Files can be created in each enabled directory. Every enabled area has frontmatter controls and page settings. Draft metadata is managed automatically; there is no Draft / Published toggle. The available fields follow each area's existing content conventions. Program Updates supports the simpler article workflow described below.

## Development and testing

Use Node **24.13.1**, pinned in `.node-version` and Volta, plus npm and Git.
Run `npm ci` from the repository root for reproducible dependencies; installation
also applies the required dependency patch. Browser tests and the editor artifact
check require Chrome/Chromium. The harness checks common macOS/Linux locations;
set `CHROME_BIN` to the executable path when necessary. Tests need temporary-file,
child-process, and local loopback access, including the workerd runtime.

For routine manual development, run `npm run dev`; run `npm run editor` in a
second terminal when using the local API. See [local setup](#local-setup) for its
configuration. The gateway uses the configured GitHub repository, so manual saves
are real operations. Automated tests start their own fixtures and use mocked
GitHub operations; they need neither these development servers nor a GitHub token.

Use `npm run test:editor` for unit/API regressions and
`npm run test:editor:browser` for sequential browser tests. For a targeted change,
run the relevant files directly, for example:

```sh
node --test editor/api-parity.test.mjs editor/cloudflare-runtime.test.mjs
node --test --test-concurrency=1 editor/image-editing.browser.mjs
```

The [validation reference](../docs/cms-editor/validation.md#local-checks) lists
each command's scope, prerequisites, and the full pre-release sequence. Within one
checkout, run browser, render, build, and Astro sync/check commands sequentially.
Render tests temporarily add source content; separate output directories alone do
not isolate fixtures or Astro's generated files.

Read the test summary: skipped tests did not execute, and TODO tests can execute
and fail without failing the command. Five FilterPanel TODO cases currently
record unresolved defects. A successful exit alone is not complete coverage.

Local testing does not deploy. CI validates PRs under the existing trusted-base
policy; the deployment workflow publishes the public site from main. Dedicated
Cloudflare editor deployment is separate. See [CI and deployment boundaries](../docs/cms-editor/validation.md#ci-and-deployment-boundaries).

## Metadata across content areas

Title is required; descriptions and other page metadata are optional. Existing values load into the form. Saving an existing file keeps its filename and URL, preserves unknown frontmatter and protected MDX, and checks the current GitHub file SHA before committing. Both local and hosted APIs use the authoritative GitHub source, rather than trusting a copy sent by the browser.

Existing `.md` files retain their format. Their Add block menu enables text and explains why custom components require `.mdx`; image and table tools remain available. Existing component/import source in Markdown stays read-only. Both APIs independently reject newly inserted or modified MDX-only component source in `.md` documents, while allowing ordinary edits that preserve legacy source. Code examples remain supported.

Every new page uses a complete Git tree snapshot to check route ownership across the entire docs collection and static `src/pages` routes. Checks include Markdown extension equivalents, Astro filename normalization, Starlight index routes, and frontmatter `slug` overrides (including other content areas and drafts). The editor checks known list routes before saving; the backend remains authoritative. Blob reads use read-only GraphQL batches by immutable SHA and a bounded metadata cache. Incomplete trees, unreadable/truncated blobs, or failed queries stop creation. A non-forced branch update rejects concurrent changes; the draft stays in the editor for retry. Existing-file updates keep their SHA checks. Changes to the site's loader, dynamic routes, or redirect configuration require a corresponding review of these route rules; the CMS does not create or edit slugs, redirects, or route templates.

- **All areas:** page layout, page heading visibility, table of contents (including heading levels), navigation label/order/visibility, and site-search indexing. Unset page settings inherit the site's existing defaults.
- **Blog Posts:** publication date, excerpt, authors, tags, and cover images as described below. An existing description can also be edited.
- **Library:** optional calendar date, year, authors, and tags.
- **Guides:** tags.
- **Scholarship:** year and tags.
- **Workgroups:** committee, lead, members, active dates, and authors.
- **Conference:** announcement banner and existing Open Graph/Twitter sharing-image metadata, under Page settings. Banner content retains Starlight's HTML convention.

Existing date, excerpt, author, tag, and cover fields are also shown if present in other areas. Other configuration remains preserved even when there is no matching control. Additional author properties, light/dark cover variants, sidebar badges/attributes, and unrelated head tags survive edits.

Non-blog dates remain optional and are not automatically added. Editing their calendar date preserves an existing timestamp's time and offset; clearing an optional date removes it. Blog date requirements and new-post defaults remain unchanged. New non-blog pages retain their previous draft defaults. Editing frontmatter does not regenerate duplicated information in the body.

## Blog posts

Opening `/editor/` without a query opens the dashboard with no content area selected; editor links can open a list or entry directly. Choose **Blog Posts** on the dashboard, then open an existing post or choose **New Blog Post**. Each content list has a prominent **Back to dashboard** button. Editing views have **Back to Blog Posts** (or the current content area) at the top and beside the save controls, plus a **Dashboard** button. The top navigation stays visible while scrolling. Leaving an unsaved entry prompts first; confirmed navigation keeps a local recovery copy when browser storage is available.

Every editing view has **Save Draft**, **Publish**, and **Unpublish** at the top. Save Draft is disabled when there is nothing to save and saves only the selected document and permitted associated uploads to its shared working branch. Existing main content stays unchanged. New documents receive `draft: true`; existing documents preserve their current draft field, including an absent field.

The header uses one compact status area, with **Edit / Preview** above the form. **Publish**, when enabled, explicitly authorizes native auto-merge for an immutable saved revision. The normal UI has no manual submission option; maintainers retain the existing manual API for exceptional cases. Lists combine main with saved working branches and identify draft copies. Page settings retain layout, heading, table of contents, navigation, and search options, including inherited defaults. Navigation hiding remains separate from draft storage.

The editing view shows **Unsaved changes**, **Draft saved**, **Publishing…**, **Published**, **Unpublishing…**, **Unpublished**, or **Needs attention**, with brief context when the editor differs from the website. Publication continues automatically after authorization, even after navigation or closing the tab. Visible unresolved requests refresh with backoff from 20 seconds up to 2 minutes, pause in hidden tabs, and resume when visible. Transient verification problems retry automatically and do not imply publication failed. **Technical details** contains GitHub links, manual refresh, cancellation, and diagnostics. Continued editing and saving never change the submitted snapshot; the editor adopts continuation tokens only for the exact saved draft after a verified merge. A merge racing a save can require another Save Draft attempt; concurrent changes remain protected. **Save Draft** never changes the public website or the `custom-cms` application branch. Reopening through another authorized account loads the same GitHub working copy; private browser recovery remains account-scoped.

- Title is required. New posts start with today's local calendar date and the toggle set to **Draft**. The date is editable; changing it does not rename the post.
- Excerpt, authors, tags, and cover are optional. Authors use the existing list of named author objects, tags use one comma-separated input and remain a list of strings, and covers retain the existing image/alt/caption structure. Existing string authors, extra author properties, and light/dark covers are also preserved.
- Dates display their written `YYYY-MM-DD` portion without timezone conversion. Unchanged dates retain their original YAML value. When an existing timestamp's calendar date changes, its time and offset remain intact. New dates use the existing unquoted YAML date format.
- A short title-based filename is generated on first save, with no automatic date prefix. If its URL is occupied, the editor suggests an available suffix and asks you to use that alternative. The filename is permanent after creation, including when the title, date, or metadata changes. Existing filenames and extensions are retained. Intentional URL changes and redirects can be made manually through GitHub.
- Standard Markdown, images, and tables use the existing body editor; supported LinkCards, LinkButtons, and newly inserted badges, callouts, and cards have standalone property forms. Complex MDX components and nested layouts stay in separate, named read-only source blocks. Imports and page code are grouped visually in a collapsed, locked **Page setup** inspector and omitted from Preview. Their source order and bytes remain unchanged; all protected blocks still prohibit movement. Opaque content blocks on MDX pages offer Remove original block and immediate Undo removal. Explicit removal records are retained in recovery, checked against the loaded source/SHA, and accumulated in draft metadata for independent publication checks. Setup, uncertain source and compatibility wrappers cannot be removed. Unparseable source remains one visible locked block. Unchanged frontmatter is preserved; editing an optional field changes only that field.
- Select a body image to show **Left**, **Center**, **Right**, a **Size** menu (**Small**, **Medium**, **Large**), and **Reset formatting** beside it. Presets use 240, 480, and 720 pixels, shrinking to fit narrow screens while preserving aspect ratios. Existing custom widths stay unchanged until a preset is selected. Tiny images have a larger selection area in Edit mode; keyboard focus also exposes their controls. Formatted images use a narrow HTML figure around the Markdown image; captions stay in the Markdown title and repository paths stay intact. Reset returns the image to ordinary Markdown. Unfamiliar HTML/MDX wrappers remain read-only.
- Cover images can use the same repository picker and uploads as body images, or an image URL/path. Uploads remain pending in this form until Save Draft commits referenced images with the document. Save a new document once before uploading, so its filename is fixed. Pending images join browser recovery; watch for storage-quota warnings. Previously saved uploads remain associated with the working branch until future publication/cleanup.

**Save Draft** updates a document branch and does not publish the live site. Draft-save commits suppress Cloudflare builds. Required branch controls are documented in [hosting and deployment](../docs/cms-editor/deployment.md).

Completed CMS branches are checked daily for [automatic cleanup](../docs/cms-editor/deployment.md#automatic-branch-cleanup). Cleanup waits at least 24 hours after merging and verifies the live page before removing a complete branch chain. Newer edits, unpublished uploads, and unfinished requests stay intact. Manual runs default to a dry run; reports explain which pages were kept. GitHub's automatic head-branch deletion remains disabled.

The editor warns before leaving unsaved changes. Its modal offers **Keep editing** (also Escape) and **Leave editor**, explaining that a recovery copy stays in this browser and the changes have not been saved to the website. If a browser backup cannot be kept, it warns that leaving may lose the changes. Failed saves leave your work in the open editor, and browser backups support returning after navigation, reload, or sign-in. Recovery is separate from saving to GitHub; see the navigation and recovery details below. For repository conflicts, keep/download the backup and reconcile against the latest version rather than repeatedly submitting a stale file.

Both API implementations share the draft store, blog serialization, and creation logic. Updates use the loaded blob SHA and authoritative repository frontmatter. New posts use a Git tree snapshot and a fast-forward-only branch update so competing writes cannot overwrite an existing file or create an equivalent route unnoticed.

New articles persist a creation identifier and fixed target filename in the account-scoped recovery copy before sending the request. A commit-message marker lets **Retry creation safely** find the original committed file, including when the browser lost the entire response. Retries retain the same identifier and filename; changing the title does not create another document. The API returns the original committed content on replay, and later unsaved edits remain in the editor. The blob revision is available before the branch update, so a successful creation does not depend on a subsequent file read. Ambiguous branch responses are checked against the branch and commit history. Unreadable history, or a retry whose occupied URL cannot be matched to its original marker, remains unconfirmed and offers no duplicate-name alternative. History lookup is bounded to 1,000 changes to the target file; manual history rewrites, moved/deleted files, or discarded recovery data may require manual comparison. Article creation waits if browser storage cannot persist its retry information.

If a session expires during editing, the editor stays mounted and flushes its recovery copy. Use **Sign in again with GitHub** in the separate tab, then return and choose **Check sign-in**. Resuming requires the original account and workspace. Unsaved text, undo history, selection, and Edit/Preview state remain in the original tab; reloading uses local recovery instead and cannot restore undo history or selection. If storage fails, keep the tab open and download the unsaved edits. API operations remain blocked until sign-in is checked.

Editor regression commands and prerequisites are summarized under
[Development and testing](#development-and-testing). Browser tests cover block
controls, images, navigation, recovery, metadata, publication, and related site
filtering using isolated Chrome profiles and temporary fixtures.

## In-editor preview

Use **Edit / Preview** to review the current title, relevant article/library metadata, and body, including unsaved changes. Preview runs in the browser using the existing TipTap extensions. Toggling does not save content, call a write API, or trigger a deployment. The editing instances stay mounted, preserving their content, selections, undo history, and block-removal undo. Returning to Edit resumes the same session.

Preview shows ordinary rich text, tables, images, Link Cards, Link Buttons, badges, callouts, cards, Chip Lists, Card Grids, and Metrics as read-only content. Fonts, content width, spacing, and component styles approximate the published page. Protected MDX/Astro blocks remain in position as labeled placeholders with expandable source; nested content inside those blocks is not rendered. Links open in a separate tab with opener protection. Code highlighting, image zoom, navigation, and the full site shell are not reproduced. Frontmatter covers and excerpts are omitted from this page preview, matching the current article header; library descriptions appear as summaries. Blog/update images use the article centering and caption conventions, while documentation images retain their separate defaults.

The existing **Preview editable version** action for older Program Updates remains a separate conversion workflow. Ordinary Preview always shows the current document without applying a conversion. Ordinary Preview performs no save or deployment; Save Draft uses the shared document workflow described above. Focused browser coverage is available with `node --test editor/preview.browser.mjs`.

## Browser navigation and local recovery

Editor screens have their own URLs while remaining in the same application:

- `/editor/` opens the dashboard.
- `/editor/?area=posts` opens a content list.
- `/editor/?area=posts&file=example.mdx` opens the current repository version of an entry. Nested filenames are URL-encoded.
- `/editor/?area=posts&new=<unique-id>` identifies a particular never-saved entry, including after a reload. The first successful save replaces this URL with the saved filename without adding a second history entry.

Browser **Back** and **Forward** follow these screens. Leaving an entry with unsaved document changes prompts, using the same guard as the editor's own navigation. **Keep editing** restores the original history entry, URL, and editor state without adding dummy history entries. **Leave editor** completes the requested navigation. Navigation waits while a save or restoration is pending; ordinary list/document loading can be left. A directly opened editor link can still lead back outside the editor. Reloading, closing a tab, or leaving the page requests the browser's standard warning when changes are unsaved or a save is pending. The browser controls that warning's message and buttons, and does not guarantee it in every situation.

Changed document fields and body content receive a browser backup after a short typing pause, with immediate flushes before confirmed navigation and when the page becomes hidden or unloads. **Unsaved changes kept in this browser only** describes this backup; **Save Draft** still saves to GitHub. An untouched new form does not create a backup. Dialog values are included after their **Insert** or **Apply** action adds them to the document.

The dashboard and content lists do not show recovery panels. Existing documents with a browser backup have a small **Unsaved edits** indicator beside their normal list entry. Opening that entry loads the normal GitHub document, without restoring automatically. The editor shows **Unsaved changes available**, a short explanation, and **Restore changes** / **Discard**. Restore loads local changes for review; it never saves to GitHub. Discard requires confirmation and affects only the selected local record.

There is no recovery entry point on the dashboard or listing pages. Return to an interrupted new draft using its original editor URL (including the draft ID) or browser history. **Restore changes** opens a separate version dialog if versions diverge, GitHub changed, or other unsaved edits are already open. Timestamps, session distinctions, excerpts, safe retry details, per-version discard, and **Save backup file** are confined to this exceptional interface; there is no Options menu in routine notices.

Records remain grouped by exact document route within the account/workspace. Never-saved drafts have independent IDs. Each record holds the latest snapshot of an editing session/context; subsequent edits replace that record's revision rather than building keystroke history. Grouping never merges or deletes records. Different editable content, starting GitHub revisions, or creation attempts require an explicit version choice. Matching records use the latest timestamp.

Restoration rechecks the stored record revision and current GitHub file revision. If GitHub changed, the local version stays separate and can be exported for manual comparison. Other session records are preserved; a selected version is continued in the working editor using the existing backup lifecycle. Unconfirmed article creation retains its original retry identity. The notice after restoration explicitly says the work is displayed but not confirmed saved. Backup files remain JSON for safekeeping/manual comparison, without automatic import or merge. The published document is never changed by restoring, exporting, or discarding local work.

Browser backups are scoped by signed-in account, backend/workspace, and document. Separate editing sessions use independent records, so another tab's changes are not overwritten. Deletion/cleanup checks the specific backup revision and does not delete a newer version. Multiple unsaved versions of an entry can be selected by timestamp. Backups remain available after sign-out to the same account. Hosted sign-in returns to the editor link originally requested; external or non-editor return URLs are rejected.

These copies live in this browser on this device, are not synchronized to another device, and can be removed by clearing browser storage or private-browsing policies. If storage is blocked/full, the editor shows an explicit warning and offers **Download unsaved edits**; it does not claim that recovery was saved. Downloaded JSON includes document metadata, body content, and the base repository SHA for comparison, without authentication credentials. No automatic publishing or server-side autosave is introduced.

Automated coverage includes direct links, Back/Forward and canceled navigation, immediate reload recovery, unsaved new entries, failed and pending saves, stale versions checked at restore time, storage failure, account/workspace isolation, and safe sign-in return URLs.

## Chip List and Card Grid blocks

Both blocks are available in **Add block** across every enabled content area. Selecting one inserts an editable block immediately after the current block. Their contents are optional and can be changed freely; empty collections do not produce placeholders on the public site.

- **Chip List:** starts with one blank term. Enter each term in its own field; commas remain part of that term. Use **Add chip**, **Remove chip**, and the arrow buttons to manage and reorder terms. A live preview shows the chips. Long terms wrap on smaller screens.
- **Card Grid:** starts with two blank cards. Each card has an editable title and its own visual content editor, supporting paragraphs, bold, italic, links, and bulleted/numbered lists. Use **Add card**, **Remove card**, and the arrow buttons to manage cards. Moving a card keeps its title, content, and editor together. The site uses its existing responsive CardGrid styling.

New collection blocks have block-level arrows to move the complete collection, and **Remove Chip List** or **Remove Card Grid** to remove the whole block. Legacy ChipList components and their enclosing layouts stay anchored; their item controls remain available. Adding, removing, moving, or editing items marks the page unsaved. Save and reopen work like the other blocks. Conversion previews display both blocks read-only.

New blocks use dedicated `CmsChipList` and `CmsCardGrid` Astro imports with quoted JSON attributes. Chip terms and card titles are literal text; card bodies are stored as Markdown and rendered by the site's Markdown processor. Imports are added once, existing imports are preserved, and conflicting bindings produce an error. Unsupported legacy CardGrid layouts and manually modified formats remain protected. Program Update conversion continues to simplify older layouts into ordinary content; these optional blocks can be inserted wherever the author wants the richer presentation. Card-body images, tables, raw HTML, and custom components are not editable in this version; unfamiliar saved card content remains protected rather than being discarded.

Legacy paired `<ChipList>` components with plain unordered-list items reuse the chip controls, including adding, removing, reordering, clearing, and refilling items. Their original source is retained until an item changes. Edits keep the original component, optional literal `class` attribute, imports, and outer source instead of migrating to `CmsChipList` and its styling. A single eligible ChipList inside known literal `div` wrappers can also be edited while surrounding headings and components remain immutable. Server validation preserves the wrapper fragments and their order, and rejects changes to attributes, imports, or opaque siblings. Rich labels, raw reference-like bracket syntax, tasks, expressions, custom props, ordered/nested lists, and unknown wrappers stay protected. Markdown files retain their existing component restrictions. The render tests check public classes, list structure, and literal labels against the real ChipList component.

Compatible legacy `<CardGrid>` blocks reuse the Card Grid editor while retaining the original MDX renderer and imports. Eligibility requires an attribute-free root grid containing only paired Cards with literal plain titles or a leading plain-text level-four Markdown heading, and bodies that have equivalent MDX/Markdown structure. The parser may remove common leading spaces in the editing view only after confirming that the normalized body matches the original MDX structure, including list nesting, loose-list spacing, code values, and links. Titles and supported rich bodies can be edited, and card contents can be reordered. The grid, card tags, title attribute syntax, and card count remain protected; adding/removing cards and moving/removing the whole grid are disabled. Untouched fields retain their exact source: opening, previewing, editing metadata, or renaming a card does not normalize its body source. Only edited bodies are serialized from the normalized view. The legacy body editor supports level-four section headings; its Section heading button toggles that style, and other heading levels remain unsupported. Cards without either supported label, HTML titles, rich leading heading labels, icons, custom props/components, images, tables, references, tasks, unresolved indentation, and enclosing layouts remain protected. A supported untitled card exposes the **First section heading** field, retains its `####` marker and absent title attribute, and previews as a heading. Renaming it can change its generated public anchor; body-only edits preserve the heading exactly. Standalone Cards with a literal title or this leading-heading pattern reuse the editor as one-card blocks. Additional level-four headings remain in the rich body, including their supported inline formatting, and preview as headings. The first heading is labelled First section heading and is never promoted to a component title. This recognizes 22 grids (92 cards) and 19 standalone cards. The tab-indented August 2024 grid and November/December 2024 workgroup cards remain protected. No source migration to `CmsCardGrid` is performed.

## Metrics block

Choose **Add block → Metrics** to insert a live preview and editable **Label**/**Value** pairs. Use **Add metric**, **Remove metric**, and the arrows to manage any number of metrics. Values are plain text: percentages, comma-separated counts, ranges, and approximate values keep the formatting you enter. No metric names or number formats are fixed.

The site shows large centered values above their labels in tiles, with four columns when the content area is wide, two at medium widths, and one on narrow screens. Entirely blank pairs do not produce public placeholders. Labels and values render as literal text. The same layout appears in the editor preview, and conversion previews remain read-only.

The whole block supports moving, removal/undo, saving/reopening, and local recovery like the other collection blocks. New metrics use the generated `CmsMetrics` component with a quoted JSON `items` attribute. Unsupported manually modified formats stay protected. The September 2026 Program Update uses this block for its four Geoportal metrics; ordinary tables keep their existing behavior.

## Program updates

Choose **Program Updates → New Program Update** on the dashboard. New entries start as **Draft**, with today's editable publication date, the author **BTAA-GIN Staff**, and the tag **Program Updates**. Title and a valid publication date are required for new entries; summary, authors, tags, and cover image are optional. Existing authors, tags, timestamps, draft states, filenames, and URLs are retained.

Choose **Start with monthly outline** for ordinary editable headings covering the highlight, committees, workgroups, Geoportal activity, collections, harvesting, and development. Choose **Start blank** to write any announcement. Rename, remove, or reorder headings and add any other content. There are no required report sections, committee names, metric labels, search terms, or collection totals. The body uses the existing visual editor for rich text, links, images and captions, lists, and tables. Optional Chip List, Card Grid, and Metrics blocks are available from **Add block**. New updates use a single-column article layout and derive their table of contents from actual headings. A new update's short title-based filename becomes permanent on its first save, using the same collision and concurrency protection as Blog Posts.

Existing updates open in their original format. Opening an entry or saving metadata does not convert it. **Preview editable version** displays a read-only conversion; **Cancel preview** returns without changing anything. **Use editable version** replaces the body in the open editor and marks it unsaved. Edit it, then choose **Save Draft** to save the conversion to its document working branch. Save any body edits before previewing so the conversion includes them. Conversion previews show the proposed article content rather than the complete production page styling.

- Newer structured `programUpdate` entries become ordinary body content. Conversion includes rich narratives, images and captions, metric tables, search terms (including terms containing commas), collection totals, harvesting tables or Markdown, development links, and historical priority-project links. The analytics and harvesting dashboard links formerly supplied by the renderer are retained. The old `programUpdate` field and renderer invocation are removed only when the conversion is saved; unrelated frontmatter stays intact.
- Older MDX updates convert recognized cards, layout wrappers, chip lists, record totals, and callouts into headings, text, lists, and links. Existing CSV-backed Table components, embedded presentations, unfamiliar wrappers, and other unsupported components retain their source and stay read-only. The preview identifies those protected blocks. Card grids and chart columns become a single column; search chips become lists.
- Unrecognized structured fields or a custom structured-renderer invocation prevent conversion and show a manual-review message. Metadata and surrounding editable text can still be saved without changing that data. Existing entries are never migrated in bulk.

Use the custom editor for new and converted updates; Decap's Program Updates form continues to target the older structured format. Saving uses a shared document working branch; the same image, recovery, and preview rules apply as for Blog Posts. Publication follows the shared saved-revision PR workflow.

Program Update regressions are included in `npm run test:editor` and `npm run test:editor:browser`. Coverage includes unchanged existing files, structured and legacy conversions, harvesting content, unknown-component preservation, both API implementations, defaults and optional outline selection, preview cancellation, failed-save recovery, and saving/reopening without URL changes.

## Local setup

For a guided walkthrough of creating a post, downloading the saved file, and viewing it locally, see [Test blog posts with the editor locally](./local-blog-testing.md).

Create an uncommitted `.env.local` in the repository root:

```dotenv
GITHUB_TOKEN=github-token-with-contents-write-access
# Optional when testing a fork:
PROJECT_EDITOR_OWNER=geobtaa
PROJECT_EDITOR_REPO=geobtaa.github.io
```

Then run these in separate terminals:

```sh
npm run editor
npm run dev
```

Open `http://localhost:4321/editor/`. The local gateway uses the token only on the server and presents a local-development session to the UI.

Existing pages and posts contain Astro/MDX imports, components, directives, and HTML. The editor displays unsupported syntax as read-only protected blocks and preserves its text verbatim; surrounding ordinary Markdown remains visually editable. The editor can insert supported LinkCards, LinkButtons, badges, plain-text callouts, and plain-text cards with their required MDX imports. Ordinary body content uses Markdown.

Task lists, footnote references and definitions, reference-style links/images, custom directives, inline HTML, and MDX expressions remain read-only. An unsupported item protects its entire containing paragraph, list, table, or component, including indentation and line endings. Edit surrounding ordinary text normally; Preview shows expandable source for protected content. If syntax cannot be parsed confidently, the body stays protected rather than being partially converted. Use a reviewed source edit for changes inside these blocks.

Visual text serialization escapes literal MDX braces and import/export-like prose, escapes link destinations and titles, emits self-closing table line breaks, and chooses code fences that cannot be closed by the example they contain. Both APIs compile generated MDX without evaluating it before writing to GitHub, and check that retained protected source remains unchanged and ordered. Only explicit eligible whole-block removal records permit omissions; see the [save contract](../docs/cms-editor/api-contract.md#save-request-fields-and-validation). Invalid syntax, altered protected content, and new unsupported/executable source produce an error while retaining the open edits. Markdown files are validated as Markdown. This is a syntax/preservation check; repository imports, assets, and site rendering still require the production build.

Preservation regressions include actual TipTap edits, saves, reopening, validation failures, and Edit/Preview with the Roadmap, SDI proposal, and Philadelphia CityGeo article. Run `npm run test:editor` and `npm run test:editor:browser`; `npm run test:editor:render` runs Astro-generated Link Card/Link Button safety checks, legacy chip/card rendering checks, and production unpublish-build regressions.

## Hosted deployment

Use the consolidated [hosting and deployment guide](../docs/cms-editor/deployment.md) for gin-editor build settings, staging isolation, OAuth, canonical-origin restrictions, and rollout checks. See [validation and operational limits](../docs/cms-editor/validation.md) for required checks and hosted qualification. Historical milestone deployment claims have been retired; verify live settings and the deployed revision separately.

New badges, callouts, and cards use the existing Starlight components imported as `CmsBadge`, `CmsCallout`, and `CmsCard`. These aliases identify the CMS's narrow generated format after reopening; unsupported legacy `Badge`, `Aside`, and `Card` blocks stay protected. Callout/card messages are literal text with Markdown hard breaks. Unrecognized attributes or nested syntax in generated blocks also stay protected. No new Astro components are required.

Existing explicitly closed `:::note`, `:::tip`, `:::caution`, `:::danger`, `:::info`, `:::warning`, and `:::Caution` directives open as Callout blocks with a rich message editor for supported Markdown. `info` shares Note; `warning` and `Caution` share Caution. Opening a page or editing unrelated content preserves the directive source exactly. Editing the callout retains directive syntax and writes the canonical type name, without adding imports. Plain titles, paragraphs, links, lists, and supported text formatting are editable; rich titles, custom attributes, images, tables, tasks, references, nested directives, HTML, expressions, and custom components stay protected. Callouts inside unsupported layouts remain part of those protected layouts. Bare colon text such as times and ratios is outside this compatibility change.

Supported LinkCards inside known `div`, `CardGrid`, and `TwoThirdsLayout` paths expose the same title, description, and URL fields as standalone cards. The containing block stays anchored and cannot be removed. Imports, layout tags/attributes, surrounding text, expressions, custom components, and unsupported cards remain byte-preserved; server validation compares every fragment outside the editable card spans and rejects adding/removing cards or introducing new layouts. Only literal `class`, `slot`, and `id` attributes on `div`, and attribute-free `CardGrid`/`TwoThirdsLayout`, are traversed. Unknown ancestors stay fully protected. Markdown files retain their existing MDX-component restrictions. Preview shows the cards and expandable layout source without executing the layout.

Markdown tables containing bare colon text such as `11.68:1`, `10:30`, or `Scale [1:1,140,480]` use the existing table editor in both `.md` and `.mdx` files. The syntax parser restores bare inline directive tokens as literal text only inside tables, matching Starlight's handling of those tokens. Original source stays unchanged until an editable text block changes. Labeled directives, directive attributes, HTML, custom components, expressions, references, and unsupported enclosing layouts remain protected; ordinary colon text outside tables keeps its existing behavior. This compatibility does not convert HTML tables or CSV-backed components.

Each content block has an **Add block** menu beside it on desktop and below it on narrow screens. Text, Link Card, Link Button, Badge, Callout, Card, Chip List, Card Grid, and Metrics create a block after that block. Formatting, Image, and Table controls stay inside the Markdown editor and change its existing content. Formatting toolbars use icons in both the main editor and card contents; hover for a tooltip. Every icon button has an accessible name, and active/disabled states remain visible. The text-style dropdown retains its paragraph and heading labels. Component insertion does not split a text block at the cursor or add an empty text editor.

Editable body blocks have **Move up** and **Move down** buttons beside **Add block**. Each move swaps neighboring editable blocks and marks the page as unsaved. Read-only MDX, imports, and exports stay anchored; blocks cannot move across them. Keyboard focus follows the moved block, and its position is announced. Adjacent text blocks may merge into one editor when reopened, with their content order preserved.

Each Text block also has **Remove Text block** beneath its editor, including when it is empty. Removal closes that editor immediately and removes its contents, including any images or tables in that block; use **Save Draft** to keep the change. **Undo removal** restores the most recently removed block without discarding edits made in other blocks. Adding or moving a block clears that removal undo; removing another block replaces it. Removing the last visible block leaves **Add block** available. Empty Text blocks are labeled while editing; blank editor placeholders are not stored as separate blocks in Markdown.


## Native auto-merge

`CMS_AUTO_MERGE_ENABLED=true` enables the Publish UI when publishing is also enabled. It defaults off. When automatic publication is disabled, normal Publish/Unpublish controls stay disabled; they do not fall back to manual submission. The existing manual API remains available to maintainers. Native authorization is a separate, authenticated, head-pinned operation with authoritative readback; GETs and ordinary saves/submissions never authorize merging. Cancellation is available even with publishing disabled. Unpublish requires its own explicit confirmation and all existing unpublish gates. See the [enablement and live qualification steps](../docs/cms-editor/deployment.md#enable-and-qualify-native-auto-merge). Local gateway testing uses the same flags in `.env.local`; those operations still affect the configured GitHub repository.
