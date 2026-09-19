# Project editor prototype

This isolated prototype is available at `/editor/`. It edits a conservative allowlist of content directories under `src/content/docs` and writes through the GitHub Contents API directly to the `custom-cms` staging branch. Decap `/admin` is unchanged.

The enabled directories are `about`, `conference`, `guides`, `library`, `metadata`, `projects`, `scholarship`, `team`, and `workgroups`. Creating files and changing draft/published state remain limited to Projects; other directories edit existing titles, descriptions (where present), and bodies while preserving all other frontmatter.

## Local setup

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

Existing Projects contain Astro/MDX imports, components, directives, and HTML. The editor displays those as read-only protected blocks and preserves their text verbatim; surrounding ordinary Markdown remains visually editable. New content produced by the editor is ordinary Markdown and does not introduce MDX syntax.

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
