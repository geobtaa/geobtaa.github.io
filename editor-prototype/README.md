# Project editor prototype

This isolated prototype is available at `/editor/`. It edits only files in `src/content/docs/projects` and writes them through the GitHub Contents API to the `editor-prototype` branch. Decap `/admin` is unchanged.

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

Optional variables are `GITHUB_OWNER`, `GITHUB_REPO`, `GITHUB_BRANCH`, and `GITHUB_BASE_BRANCH`; defaults are `geobtaa`, `geobtaa.github.io`, `editor-prototype`, and `main`.

If `editor-prototype` does not exist, reads initially fall back to `main`; the first save creates the branch immediately before committing. Every update includes the blob SHA loaded by the editor. GitHub 409/422 responses are reported as conflicts and are never retried as overwrites.

The existing Decap Worker at `decap-auth.geobtaa.workers.dev` uses a different GitHub OAuth callback and returns credentials in the protocol expected by Decap. Its source is not in this repository, so it is not reused. No `public/admin` files or `config.yml` changes are required.

Small change to trigger build