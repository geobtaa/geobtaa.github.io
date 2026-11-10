# Project editor prototype

This isolated prototype is available at `/editor/`. It edits a conservative allowlist of content directories under `src/content/docs` and writes through the GitHub API directly to the `custom-cms` staging branch. Decap `/admin` is unchanged.

The enabled directories are `about`, `conference`, `guides`, `library`, `metadata`, `posts`, `projects`, `scholarship`, `team`, `updates`, and `workgroups`. Files can be created in each enabled directory. Every enabled area has frontmatter controls, including the **Draft / Published** switch and page settings. The available fields follow each area's existing content conventions. Program Updates supports the simpler article workflow described below.

## Metadata across content areas

Title is required; descriptions and other page metadata are optional. Existing values load into the form. Saving an existing file keeps its filename and URL, preserves unknown frontmatter and protected MDX, and checks the current GitHub file SHA before committing. Both local and hosted APIs use the authoritative GitHub source, rather than trusting a copy sent by the browser.

- **All areas:** Draft / Published, page layout, page heading visibility, table of contents (including heading levels), navigation label/order/visibility, and site-search indexing. Unset page settings inherit the site's existing defaults.
- **Blog Posts:** publication date, excerpt, authors, tags, and cover images as described below. An existing description can also be edited.
- **Library:** optional calendar date, year, authors, and tags.
- **Guides:** tags.
- **Scholarship:** year and tags.
- **Workgroups:** committee, lead, members, active dates, and authors.
- **Conference:** announcement banner and existing Open Graph/Twitter sharing-image metadata, under Page settings. Banner content retains Starlight's HTML convention.

Existing date, excerpt, author, tag, and cover fields are also shown if present in other areas. Other configuration remains preserved even when there is no matching control. Additional author properties, light/dark cover variants, sidebar badges/attributes, and unrelated head tags survive edits.

Non-blog dates remain optional and are not automatically added. Editing their calendar date preserves an existing timestamp's time and offset; clearing an optional date removes it. Blog date requirements and new-post defaults remain unchanged. New non-blog pages retain their previous draft defaults. Editing frontmatter does not regenerate duplicated information in the body.

## Blog posts

The editor opens on a dashboard with no content area selected. Choose **Blog Posts** on the dashboard, then open an existing post or choose **New Blog Post**. Each content list has a prominent **Back to dashboard** button. Editing views have **Back to Blog Posts** (or the current content area) at the top and beside the save controls, plus a **Dashboard** button. The top navigation stays visible while scrolling. Leaving an unsaved entry still prompts before discarding changes.

Every editing view has **Save changes** at the top and bottom. Both buttons perform the same save and honor the Draft / Published switch. Projects now use these buttons too, replacing the older Save draft/Publish actions. Saves still commit to staging.

The compact visibility banner contains a horizontal Draft / Published switch and save state. Draft is the left position; Published is the right position. The switch also supports the left and right arrow keys. Content lists show a **Draft** badge and an amber row only for confirmed draft items; other items have no badge. The underlying visibility settings are:

| Indicator | Frontmatter | Meaning |
| --- | --- | --- |
| **Draft** | `draft: true` | Excluded from production builds, including the page URL. Still viewable directly during local development. |
| **Published** | `draft: false` or no draft field | Eligible for production builds. This does not confirm that the version is live. |
| **Hidden from navigation** | `sidebar.hidden: true` | Excluded from automatically generated sidebar navigation. This alone does not hide the page at its URL or remove it from manually configured navigation. |

The switch selects **Draft** (`draft: true`) on the left and **Published** (`draft: false`) on the right. These labels describe the content setting; saving still updates staging, and the live site changes after review, merge, and deployment. Page settings display inherited values explicitly, such as **Document (site default)** and **Show (site default)**. Leaving these selected preserves inheritance without adding a page override; choosing them again removes an existing override. Splash layouts hide the table of contents. Navigation-only hiding is a separate setting under **Page settings → Navigation**, alongside the navigation label and order. A draft can also have that navigation setting. Drafts have an amber banner and highlighted list row, so their status is conveyed by both text and color.

The editing view separately shows **Not saved yet**, **Unsaved changes**, **Saving…**, or **No unsaved changes**. A checkbox change affects the current form immediately and takes effect on staging after saving. Content-list statuses describe saved metadata, read from each listed file's blob SHA. Updating the live site requires review, merge, and deployment.

- Title is required. New posts start with today's local calendar date and the toggle set to **Draft**. The date is editable; changing it does not rename the post.
- Excerpt, authors, tags, and cover are optional. Authors use the existing list of named author objects, tags use one comma-separated input and remain a list of strings, and covers retain the existing image/alt/caption structure. Existing string authors, extra author properties, and light/dark covers are also preserved.
- Dates display their written `YYYY-MM-DD` portion without timezone conversion. Unchanged dates retain their original YAML value. When an existing timestamp's calendar date changes, its time and offset remain intact. New dates use the existing unquoted YAML date format.
- A short title-based filename is generated on first save, with no automatic date prefix. If its URL is occupied, the editor suggests an available suffix and asks you to use that alternative. The filename is permanent after creation, including when the title, date, or metadata changes. Existing filenames and extensions are retained. Intentional URL changes and redirects can be made manually through GitHub.
- Standard Markdown, images, and tables use the existing body editor; supported LinkCards, LinkButtons, and newly inserted badges, callouts, and cards have standalone property forms. Complex MDX components, nested layouts, and imports stay in protected, read-only blocks. Unchanged frontmatter is preserved; editing an optional field changes only that field.
- Select a body image to show **Left**, **Center**, **Right**, **Width (px)**, and **Reset formatting** beside it. Drag its bottom-right handle to resize while preserving its aspect ratio. Formatted images use a narrow HTML figure around the Markdown image; captions stay in the Markdown title and repository paths stay intact. Reset returns the image to ordinary Markdown. Images shrink to fit narrow screens. Unfamiliar HTML/MDX wrappers remain read-only.
- Cover images can use the same repository picker and uploads as body images, or an image URL/path. Uploads commit immediately and separately from the post. Unused uploads are not removed automatically.

**Save changes** commits to staging; it does not publish to the live site. Switch from **Draft** to **Published** when the post should be eligible for publication, then use the repository's review and merge process to move the content to `main`. Existing production builds omit drafts, including their direct URLs, so hosted draft previews are not available. Saving does not mean the staging deployment is ready; check the Cloudflare deployment before reviewing its rendered page.

The editor warns before discarding unsaved changes. Choose **Cancel** to return to the editor and save your work. Failed saves and expired sessions leave your work in the open editor, but there is no automatic browser storage. Before reloading or signing in again, copy any unsaved text and field changes into a separate document. For conflicts, reopen the latest post and reapply those edits. Do not repeatedly submit a stale version.

Both API implementations share blog serialization and creation logic. Updates use the loaded blob SHA and authoritative repository frontmatter. New posts use a Git tree snapshot and a fast-forward-only branch update so competing writes cannot overwrite an existing file or create an equivalent route unnoticed. If staging changes during creation, save again to recheck availability.

Run `npm run test:editor` for editor regression tests. Run `npm run test:editor:browser` to check component insertion and property forms, image editing, link-address handling, Link Card cursor behavior, dashboard/back navigation, unsaved-change prompts, mobile layout, frontmatter controls across all enabled areas, visibility indicators, and both Save buttons using isolated headless Chrome profiles and temporary local test pages. These browser tests use no GitHub credentials or content saves. They find Chrome in common macOS/Linux locations; set `CHROME_BIN` to your Chrome/Chromium executable if needed. They skip when no browser is installed.

## Chip List and Card Grid blocks

Both blocks are available in **Add block** across every enabled content area. Selecting one inserts an editable block immediately after the current block. Their contents are optional and can be changed freely; empty collections do not produce placeholders on the public site.

- **Chip List:** starts with one blank term. Enter each term in its own field; commas remain part of that term. Use **Add chip**, **Remove chip**, and the arrow buttons to manage and reorder terms. A live preview shows the chips. Long terms wrap on smaller screens.
- **Card Grid:** starts with two blank cards. Each card has an editable title and its own visual content editor, supporting paragraphs, bold, italic, links, and bulleted/numbered lists. Use **Add card**, **Remove card**, and the arrow buttons to manage cards. Moving a card keeps its title, content, and editor together. The site uses its existing responsive CardGrid styling.

Use the block-level arrows to move the complete collection, and **Remove Chip List** or **Remove Card Grid** to remove the whole block. Adding, removing, moving, or editing marks the page unsaved. Save and reopen work like the other blocks. Conversion previews display both blocks read-only.

New blocks use dedicated `CmsChipList` and `CmsCardGrid` Astro imports with quoted JSON attributes. Chip terms and card titles are literal text; card bodies are stored as Markdown and rendered by the site's Markdown processor. Imports are added once, existing imports are preserved, and conflicting bindings produce an error. Existing ChipList/CardGrid layouts and unsupported manually modified formats remain protected. Program Update conversion continues to simplify older layouts into ordinary content; these optional blocks can be inserted wherever the author wants the richer presentation. Card-body images, tables, raw HTML, and custom components are not editable in this version; unfamiliar saved card content remains protected rather than being discarded.

## Program updates

Choose **Program Updates → New Program Update** on the dashboard. New entries start as **Draft**, with today's editable publication date, the author **BTAA-GIN Staff**, and the tag **Program Updates**. Title and a valid publication date are required for new entries; summary, authors, tags, and cover image are optional. Existing authors, tags, timestamps, draft states, filenames, and URLs are retained.

Choose **Start with monthly outline** for ordinary editable headings covering the highlight, committees, workgroups, Geoportal activity, collections, harvesting, and development. Choose **Start blank** to write any announcement. Rename, remove, or reorder headings and add any other content. There are no required report sections, committee names, metric labels, search terms, or collection totals. The body uses the existing visual editor for rich text, links, images and captions, lists, and tables. Optional Chip List and Card Grid blocks are available from **Add block**. New updates use a single-column article layout and derive their table of contents from actual headings. A new update's short title-based filename becomes permanent on its first save, using the same collision and concurrency protection as Blog Posts.

Existing updates open in their original format. Opening an entry or saving metadata does not convert it. **Preview editable version** displays a read-only conversion; **Cancel preview** returns without changing anything. **Use editable version** replaces the body in the open editor and marks it unsaved. Edit it, then choose **Save changes** to commit the conversion to staging. Save any body edits before previewing so the conversion includes them. Conversion previews show the proposed article content rather than the complete production page styling.

- Newer structured `programUpdate` entries become ordinary body content. Conversion includes rich narratives, images and captions, metric tables, search terms (including terms containing commas), collection totals, harvesting tables or Markdown, development links, and historical priority-project links. The analytics and harvesting dashboard links formerly supplied by the renderer are retained. The old `programUpdate` field and renderer invocation are removed only when the conversion is saved; unrelated frontmatter stays intact.
- Older MDX updates convert recognized cards, layout wrappers, chip lists, record totals, and callouts into headings, text, lists, and links. Existing CSV-backed Table components, embedded presentations, unfamiliar wrappers, and other unsupported components retain their source and stay read-only. The preview identifies those protected blocks. Card grids and chart columns become a single column; search chips become lists.
- Unrecognized structured fields or a custom structured-renderer invocation prevent conversion and show a manual-review message. Metadata and surrounding editable text can still be saved without changing that data. Existing entries are never migrated in bulk.

Use the custom editor for new and converted updates; Decap's Program Updates form continues to target the older structured format. Saving still commits to `custom-cms`; review, merge, deployment, image-upload behavior, and draft-preview limitations are the same as for Blog Posts.

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

## Hosted staging on Cloudflare Pages

The repository includes a same-origin Pages Function under `functions/api/` and a `wrangler.jsonc` for a staging Pages project named `geobtaa-editor-staging`. The Function performs GitHub OAuth with PKCE, verifies that the signed-in user has push permission to this repository, optionally applies a login allowlist, and stores the GitHub token only inside an AES-GCM-encrypted, HttpOnly, eight-hour session cookie. GitHub API requests execute in the Pages Function, never in browser JavaScript.

Create a GitHub OAuth App dedicated to staging:

- Homepage URL: `https://geobtaa-editor-staging.pages.dev/editor/`
- Authorization callback URL: `https://geobtaa-editor-staging.pages.dev/api/auth/callback`

Create a Cloudflare Pages project connected to `geobtaa/geobtaa.github.io` with these settings:

- Project name: `geobtaa-editor-staging`
- Production branch: `custom-cms` (the current branch, not `main`)
- Build command: `npm run build`
- Build output directory: `dist`
- Root directory: repository root

Set these runtime variables/secrets for the Pages production environment:

| Name | Kind | Value |
| --- | --- | --- |
| `GITHUB_CLIENT_ID` | variable | OAuth App client ID |
| `GITHUB_CLIENT_SECRET` | encrypted secret | OAuth App client secret |
| `SESSION_SECRET` | encrypted secret | at least 32 random characters; for example, `openssl rand -base64 32` |
| `ALLOWED_GITHUB_USERS` | variable | recommended comma-separated GitHub logins |

Optional hosted variables are `GITHUB_OWNER` and `GITHUB_REPO`; their defaults are `geobtaa` and `geobtaa.github.io`. Local equivalents are `PROJECT_EDITOR_OWNER` and `PROJECT_EDITOR_REPO`. The staging content branch is intentionally fixed to `custom-cms` so a stale Cloudflare variable cannot redirect writes elsewhere.

The hosted editor reads from and commits directly to `custom-cms`, so each save triggers the branch-connected Cloudflare Pages deployment. Every update includes the blob SHA loaded by the editor. GitHub 409/422 responses are reported as conflicts and are never retried as overwrites.

The existing Decap Worker at `decap-auth.geobtaa.workers.dev` uses a different GitHub OAuth callback and returns credentials in the protocol expected by Decap. Its source is not in this repository, so it is not reused. No `public/admin` files or `config.yml` changes are required.

New badges, callouts, and cards use the existing Starlight components imported as `CmsBadge`, `CmsCallout`, and `CmsCard`. These aliases identify the CMS's narrow generated format after reopening; legacy `Badge`, `Aside`, and `Card` blocks stay protected. Callout/card messages are literal text with Markdown hard breaks. Unrecognized attributes or nested syntax in generated blocks also stay protected. No new Astro components are required.

Each content block has an **Add block** menu beside it on desktop and below it on narrow screens. Text, Link Card, Link Button, Badge, Callout, Card, Chip List, and Card Grid create a block after that block. Formatting, Image, and Table controls stay inside the Markdown editor and change its existing content. Formatting toolbars use icons in both the main editor and card contents; hover for a tooltip. Every icon button has an accessible name, and active/disabled states remain visible. The text-style dropdown retains its paragraph and heading labels. Component insertion does not split a text block at the cursor or add an empty text editor.

Editable body blocks have **Move up** and **Move down** buttons beside **Add block**. Each move swaps neighboring editable blocks and marks the page as unsaved. Read-only MDX, imports, and exports stay anchored; blocks cannot move across them. Keyboard focus follows the moved block, and its position is announced. Adjacent text blocks may merge into one editor when reopened, with their content order preserved.
