# Project editor prototype

This isolated prototype is available at `/editor/`. It edits a conservative allowlist of content directories under `src/content/docs` and writes through the GitHub API directly to the `custom-cms` staging branch. Decap `/admin` is unchanged.

The enabled directories are `about`, `conference`, `guides`, `library`, `metadata`, `posts`, `projects`, `scholarship`, `team`, and `workgroups`. Files can be created in each enabled directory. Blog Posts have the metadata controls described below. Blog Posts and Projects use the **Draft / Published** toggle to control draft state; other directories edit titles, descriptions (where present), and bodies while preserving all other frontmatter, including draft state. Program updates are not enabled.

## Blog posts

The editor opens on a dashboard with no content area selected. Choose **Blog Posts** on the dashboard, then open an existing post or choose **New Blog Post**. Each content list has a prominent **Back to dashboard** button. Editing views have **Back to Blog Posts** (or the current content area) at the top and beside the save controls, plus a **Dashboard** button. The top navigation stays visible while scrolling. Leaving an unsaved entry still prompts before discarding changes.

Every editing view has **Save changes** at the top and bottom. Both buttons perform the same save and honor the Draft / Published switch. Projects now use these buttons too, replacing the older Save draft/Publish actions. Saves still commit to staging.

The compact visibility banner contains a horizontal Draft / Published switch and save state. Draft is the left position; Published is the right position. The switch also supports the left and right arrow keys. Content lists show a **Draft** badge and an amber row only for confirmed draft items; other items have no badge. The underlying visibility settings are:

| Indicator | Frontmatter | Meaning |
| --- | --- | --- |
| **Draft** | `draft: true` | Excluded from production builds, including the page URL. Still viewable directly during local development. |
| **Published** | `draft: false` or no draft field | Eligible for production builds. This does not confirm that the version is live. |
| **Hidden from navigation** | `sidebar.hidden: true` | Excluded from automatically generated sidebar navigation. This alone does not hide the page at its URL or remove it from manually configured navigation. |

The switch selects **Draft** (`draft: true`) on the left and **Published** (`draft: false`) on the right. These labels describe the content setting; saving still updates staging, and the live site changes after review, merge, and deployment. Navigation-only hiding is a separate setting that is displayed in the editing view but preserved unchanged by the editor. A draft can also have that navigation setting. Drafts have an amber banner and highlighted list row, so their status is conveyed by both text and color.

The editing view separately shows **Not saved yet**, **Unsaved changes**, **Saving…**, or **No unsaved changes**. A checkbox change affects the current form immediately and takes effect on staging after saving. Content-list statuses describe saved metadata, read from each listed file's blob SHA. Updating the live site requires review, merge, and deployment.

- Title is required. New posts start with today's local calendar date and the toggle set to **Draft**. The date is editable; changing it does not rename the post.
- Excerpt, authors, tags, and cover are optional. Authors use the existing list of named author objects, tags remain a list of strings, and covers retain the existing image/alt/caption structure. Existing string authors, extra author properties, and light/dark covers are also preserved.
- Dates display their written `YYYY-MM-DD` portion without timezone conversion. Unchanged dates retain their original YAML value. When an existing timestamp's calendar date changes, its time and offset remain intact. New dates use the existing unquoted YAML date format.
- A short title-based filename is generated on first save, with no automatic date prefix. If its URL is occupied, the editor suggests an available suffix and asks you to use that alternative. The filename is permanent after creation, including when the title, date, or metadata changes. Existing filenames and extensions are retained. Intentional URL changes and redirects can be made manually through GitHub.
- Standard Markdown, images, tables, and supported LinkCards use the existing body editor. Complex MDX components, nested layouts, and imports stay in protected, read-only blocks. Unchanged frontmatter is preserved; editing an optional field changes only that field.
- Cover images can use the same repository picker and uploads as body images, or an image URL/path. Uploads commit immediately and separately from the post. Unused uploads are not removed automatically.

**Save changes** commits to staging; it does not publish to the live site. Switch from **Draft** to **Published** when the post should be eligible for publication, then use the repository's review and merge process to move the content to `main`. Existing production builds omit drafts, including their direct URLs, so hosted draft previews are not available. Saving does not mean the staging deployment is ready; check the Cloudflare deployment before reviewing its rendered page.

The editor warns before discarding unsaved changes. Choose **Cancel** to return to the editor and save your work. Failed saves and expired sessions leave your work in the open editor, but there is no automatic browser storage. Before reloading or signing in again, copy any unsaved text and field changes into a separate document. For conflicts, reopen the latest post and reapply those edits. Do not repeatedly submit a stale version.

Both API implementations share blog serialization and creation logic. Updates use the loaded blob SHA and authoritative repository frontmatter. New posts use a Git tree snapshot and a fast-forward-only branch update so competing writes cannot overwrite an existing file or create an equivalent route unnoticed. If staging changes during creation, save again to recheck availability.

Run `npm run test:editor` for editor regression tests. Run `npm run test:editor:browser` to check Link Card cursor behavior, dashboard/back navigation, unsaved-change prompts, mobile layout, visibility indicators, and both Save buttons using isolated headless Chrome profiles and temporary local test pages. These browser tests use no GitHub credentials or content saves. They find Chrome in common macOS/Linux locations; set `CHROME_BIN` to your Chrome/Chromium executable if needed. They skip when no browser is installed.

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

Existing pages and posts contain Astro/MDX imports, components, directives, and HTML. The editor displays unsupported syntax as read-only protected blocks and preserves its text verbatim; surrounding ordinary Markdown remains visually editable. The editor can insert supported LinkCards with their required MDX import, while other new body content uses Markdown.

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
