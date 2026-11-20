# CMS editor hosting and deployment

## Project separation

`gin-editor` is the permanent Cloudflare Pages editor project, with canonical origin `https://gin-editor.pages.dev`. The older `geobtaa-github-io` project and its `custom-cms` branch are separate staging infrastructure. `https://gin.btaa.org` remains the public GitHub Pages website.

Each Cloudflare project owns its build, runtime variables, secrets, compatibility settings, and branch controls in its dashboard. There is deliberately no automatically discovered root Wrangler configuration. A shared deployable configuration could replace another project's settings. The removed historical staging configuration is available in Git history; do not restore it as an active deployment configuration.

Use Git integration for normal releases. Exceptional manual deployment must explicitly select the reviewed project and branch from an isolated checkout; do not rely on a cached Wrangler target. Building locally does not deploy anything.

## Dedicated editor build

| Setting | Intended gin-editor configuration |
| --- | --- |
| Repository | `geobtaa/geobtaa.github.io` |
| Production branch | `main` after reviewed release; `editor/cms-release` was the initial test branch |
| Root directory | Repository root |
| Build command | `npm run build:editor` |
| Output | `dist-editor` |
| Automatic preview deployments | None |
| Node version | Follow `.node-version` and `package.json` |

`astro.editor.config.ts` injects the existing editor application at `/`, without discovering public pages or content collections. Keep all generated `_astro/` dependencies. The artifact includes `_routes.json`, `_redirects`, a small `404.html`, and `_headers` if present. It excludes public pages, CNAME, search indexes, sitemaps, gallery data, and Decap admin. Do not replace the dedicated build with selective copying or pruning of a full-site build.

Legacy `/editor` and `/editor/` redirect temporarily to `/`. Check preservation of document queries and fragments before changing these redirects. The custom 404 prevents unknown routes from becoming editor pages. Public-content links resolve to `https://gin.btaa.org` in this build without modifying saved content. API and repository-image requests remain same-origin.

The older staging build and the normal `npm run build` public-site build remain independent. Do not copy gin-editor build settings to staging.

## Authentication and origin restrictions

Hosted settings:

| Variable | Purpose |
| --- | --- |
| `EDITOR_ORIGIN` | Required HTTPS origin, normally `https://gin-editor.pages.dev` |
| `GITHUB_OWNER`, `GITHUB_REPO` | Repository identity; defaults are `geobtaa` and `geobtaa.github.io` |
| `GITHUB_CLIENT_ID` | Dedicated editor OAuth App client ID |
| `GITHUB_CLIENT_SECRET` | Encrypted OAuth App secret |
| `SESSION_SECRET` | Independent encrypted secret of at least 32 characters |
| `ALLOWED_GITHUB_USERS` | Comma-separated approved GitHub handles; restrict during testing |
| `CMS_PUBLISH_ENABLED` | `true` permits publication PR creation after rollout gates pass |

Leave `PUBLIC_PROJECT_EDITOR_API_URL` unset for hosted use. No hosted personal access token, local gateway token, storage binding, or separate publishing credential is needed. Do not put secrets in tracked files or browser variables. Preview deployments should have no OAuth/session secrets, including inherited bindings.

Use a dedicated OAuth App, separate from staging. Preserve its callback `https://gin-editor.pages.dev/api/auth/callback`. Both `/` and legacy `/editor/` same-origin return paths are accepted with queries/fragments. OAuth uses PKCE and `public_repo`; tokens remain server-side in encrypted HttpOnly eight-hour session cookies. Authenticated requests recheck the allowlist, and writes recheck repository permissions. Empty allowlists permit accounts with repository push permission at sign-in, so keep the testing allowlist populated.

Before cookies, OAuth, request parsing, or GitHub calls, the Function compares the actual request origin with `EDITOR_ORIGIN`. Missing/malformed configuration fails closed. Other origins receive 403 for all API routes, even with a copied valid session. Forwarding headers cannot select the canonical host. Mutations also require matching Origin headers. Preview hosts must not be configured as separate authorized origins.

The local Node gateway is separate: `npm run editor` uses `GITHUB_TOKEN` and optional `PROJECT_EDITOR_OWNER`/`PROJECT_EDITOR_REPO`, with loopback/CORS development behavior. It does not require the hosted origin setting. See [local development](../../editor/README.md).

## Release and rollback checks

1. Review the source PR from current main. Exclude staging saves, test content, and uploaded test assets. Required trusted validation must support the draft and publication protocol before deployed code uses it.
2. Confirm dashboard settings against the intended project and exact source revision. Keep automatic previews disabled. Exclude `cms/drafts/*`, `cms/publish/*`, and `cms/publication-state/*` from automatic builds in any project that permits previews. Retain `[CF-Pages-Skip]` commit markers; do not suppress real main content builds with broad watch-path exclusions.
3. Preserve canonical origin, callback, credentials, repository identity, recovery workspace, and legacy staging configuration during cutover. Pause edits and preserve browser backups when changing application versions. Keep publishing disabled during replacement/read-only checks until the designated test is approved.
4. Verify the served revision, root page, legacy redirects, 404 behavior, same-origin API, OAuth, unauthorized-host rejection, Save Draft/reopen, image reads/uploads, and browser recovery. Inspect any host rules previously restricted to `/editor/` and ensure equivalent coverage at `/`.
5. Verify no draft/snapshot/coordinator build starts, while normal main updates still build. Complete the runtime and intended-account tests in [validation](validation.md) before widening use.
6. Confirm the public site and older staging project remain operational. GitHub Pages deploys only main, serializes deployments, and rejects an obsolete build before deploying. The deployment marker supports diagnosis; the editor reports PR state rather than certifying deployment.

Rollback restores gin-editor's previous deployment and its matching build command/output settings. Do not reset content branches, rotate OAuth credentials, or delete drafts as an application rollback. Disabling PR creation does not close an existing PR or undo a merge; inspect outstanding requests separately.

These are maintenance requirements, not a record of current live dashboard state. Verify actual deployed settings and platform limits at the time of release.
