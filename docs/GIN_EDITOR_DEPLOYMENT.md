# Permanent GIN editor deployment

Current code is on `editor/cms-release`. No project, credentials, deployment, push, merge, or live settings have been changed by this work. `geobtaa-cms-integration` and the earlier proposed `geobtaa-editor` project are superseded by **`gin-editor`**. Do not use the old temporary Direct Upload preparation.

## Project configuration ownership

Use Cloudflare Pages **Git integration** with `geobtaa/geobtaa.github.io`. Both Pages projects manage their own build settings, compatibility settings, variables, secrets, and branch controls in their dashboards. There is intentionally **no automatically discovered `wrangler.jsonc`, `wrangler.json`, or `wrangler.toml` on this release branch**. Git-connected builds are deployed by their owning project; source cannot select another project's name or replace its runtime bindings through a shared Wrangler file.

The former staging Wrangler file is retained byte-for-byte as `docs/cloudflare/staging-wrangler.reference.jsonc`, for historical reference only. Its relative paths are historical; do not pass it to Wrangler. It is not selected automatically. The running staging branch `custom-cms` still has its original configuration and code; this change neither edits that branch nor updates its deployment.

Cloudflare documents that a deployed Wrangler configuration becomes the source of truth and can replace dashboard-managed settings: https://developers.cloudflare.com/pages/functions/wrangler-configuration/. A single `env.preview` block distinguishes deployment environments, not separate Pages projects. Avoid a shared deployable file and build scripts that generate one or call deployment commands. Dashboard Git integration does not require a Wrangler file.

For any future exceptional manual deployment, use an isolated checkout and explicitly select both project and branch, reviewed against the dashboard. Never use a bare deployment command, rely on Wrangler's cached project selection, download dashboard configuration into the shared checkout, or add a project-targeted root Wrangler file without revisiting this two-project policy. Existing `npm run build` only builds Astro; it performs no deployment.

## Canonical origin security

`EDITOR_ORIGIN` is required for the hosted Pages Function. It must be a single HTTPS origin, for example `https://gin-editor.pages.dev` (a trailing slash is accepted). Paths, credentials, query strings, fragments, wildcards, HTTP origins, and malformed/missing values fail closed with HTTP 500.

Before cookies, OAuth, request-body parsing, or GitHub requests, the Function compares the actual platform request URL origin to the configured origin. A different hostname, scheme, or non-default port receives HTTP 403 for every API route, including login, callback, session, logout, content reads/writes, and image reads/uploads. Rejected origins receive no redirects, cookie modifications, or sign-in links. Client-controlled `Host`, `Forwarded`, `X-Forwarded-*`, `Origin`, and `Referer` headers cannot select the canonical hostname. The existing matching-Origin requirement for mutating requests is retained. Ordinary OAuth callbacks do not need an Origin header.

Only static editor/site assets can be viewed on a preview URL. Even a valid copied session and copied OAuth secrets do not enable API access on an alias when `EDITOR_ORIGIN` remains the canonical hostname. Do not configure a preview's own hostname as its canonical origin. Preview deployments should be disabled and have no OAuth/session credentials as additional safeguards. Administrators who change server-side configuration remain trusted; this gate does not restrict a Cloudflare administrator's powers.

The separate local Node gateway (`npm run editor`) retains its loopback/CORS development behavior. It is not the deployed Function and does not require this hosted origin setting.

## Cloudflare setup checklist — after authorization

| Setting | `gin-editor` testing | `gin-editor` final release |
| --- | --- | --- |
| Repository | `geobtaa/geobtaa.github.io` | Same |
| Production branch | `editor/cms-release` | `main` |
| Automatic production deployment | Enabled | Enabled |
| Automatic preview deployments | **None** | **None** |
| Root directory | Repository root | Same |
| Build command | `npm run build` | Same |
| Output directory | `dist` | Same |
| Node version | `24.13.1` (set `NODE_VERSION` in build environment if needed) | Same |
| Function compatibility date | `2026-09-19` in dashboard | Same |
| Additional compatibility flags | None initially | Same |
| Hostname | `https://gin-editor.pages.dev` | Same |

Use Pages' current Git build system; normal dependency installation must include build dependencies and the existing patch-package install hook. Pages automatically bundles repository-root `functions/` separately from static `dist`; retain both and do not deploy the Node development gateway. Do not configure a public-site custom domain on this project. `gin.btaa.org` remains GitHub Pages.

The working release is currently local. You may create the project with previews disabled, but do not enable authenticated testing against old remote code: a separately authorized push and successful deployment of the new origin-gated commit are prerequisites. Confirm the actual served commit, canonical login redirect, and preview rejection before entering test content. Project creation can start an initial Git build, so stage credentials only when the reviewed code is available.

### Production environment variables

| Name | Value / type |
| --- | --- |
| `EDITOR_ORIGIN` | Plain variable: `https://gin-editor.pages.dev` |
| `GITHUB_OWNER` | Plain variable: `geobtaa` (also the code default) |
| `GITHUB_REPO` | Plain variable: `geobtaa.github.io` (also the code default) |
| `GITHUB_CLIENT_ID` | Plain variable: dedicated permanent OAuth App client ID |
| `ALLOWED_GITHUB_USERS` | Plain variable: nonempty comma-separated approved tester handles initially |
| `GITHUB_CLIENT_SECRET` | Encrypted secret: dedicated permanent OAuth App secret |
| `SESSION_SECRET` | Encrypted secret: new independent random string of at least 32 characters |

Leave build-time `PUBLIC_PROJECT_EDITOR_API_URL` unset so the browser uses the same host for `/api/`. No hosted `GITHUB_TOKEN`, PAT, `PROJECT_EDITOR_*`, storage binding, or publishing credential is needed. No secrets belong in tracked files, build logs, or browser variables. Set secrets before deploying code that uses them.

For Preview, leave OAuth/session secrets absent and inspect inherited/shared bindings explicitly. If `EDITOR_ORIGIN` is present there, keep it canonical; if absent, APIs fail closed. Do not treat request headers or `CF_PAGES_BRANCH` as authentication authority. Pages' Preview Access toggle alone does not protect the project's canonical hostname. Keep the tester allowlist populated; the existing empty-allowlist behavior permits any account with repository push permission at sign-in.

## GitHub OAuth setup checklist — after authorization

Create one dedicated OAuth App for GIN Editor, separate from the existing staging App:

- Homepage: `https://gin-editor.pages.dev/editor/`
- Authorization callback: `https://gin-editor.pages.dev/api/auth/callback`
- Device flow: disabled; use the existing web flow with PKCE and state.
- The code requests `public_repo`, verifies push permission at login and before draft writes, and keeps tokens in encrypted HttpOnly eight-hour sessions. No token-refresh feature or Publish endpoint is added here.

Keep the existing staging OAuth App, callback, secrets, and project unchanged. This code can serve a separately configured staging origin: if it is deliberately rolled out to staging in a future task, first configure staging's Production `EDITOR_ORIGIN=https://geobtaa-github-io.pages.dev` (verify its actual hostname). A newer Function with missing `EDITOR_ORIGIN` intentionally fails closed. Do not merge this branch into staging or deploy new code there as part of creating `gin-editor`.

## Draft builds, release and continuity

Disabling gin-editor previews excludes both `cms/drafts/*` and `cms/publish/*`. If development previews are ever introduced, use explicit development includes plus a `cms/*` exclusion, no writing credentials, and retain the canonical-origin gate. Current Save Draft commits start with `[CF-Pages-Skip]`; verify no build on the existing Git-connected staging project too, whose controls remain untouched. Future publication snapshots must also suppress Cloudflare builds without suppressing required GitHub checks. That Publish implementation is still pending.

Run the initial designated test only after authorization: authentication, a main document read, Save Draft, reopen, and check for unintended builds. Keep routine access restricted until runtime/permissions and publishing gates pass. Dashboard settings and OAuth registration have not been inspected or changed by local tests.

After an approved merge containing this code into `main`, switch only gin-editor's production branch to `main`, explicitly build that main revision, and verify it on the same canonical URL. Keep previews disabled, `EDITOR_ORIGIN`, OAuth credentials/callback, `SESSION_SECRET`, repository identity, and `cms-drafts-v1` identity unchanged. Pause edits and preserve browser backups during cutover. Working branches/assets/route tags stay in GitHub and need no migration. Legacy staging browser copies are not automatically imported. Keep `custom-cms`, its active deployment, and GitHub Pages configuration unchanged. An authorized merge into main triggers the public site's existing normal workflow.

## Local verification

Unit/API tests cover configured canonical origins, missing/invalid settings, preview hashes/branch aliases, scheme/port/lookalike hosts, spoofed forwarding headers, a real copied session, OAuth redirect/callback behavior, and staging configured with its own origin. Existing Save Draft unit/API coverage remains enabled. Astro checks, production build, render safety, browser regression, and built navigation are run before handing off. Live Cloudflare resource limits, GitHub/OAuth permissions, and actual deployment behavior still require the designated hosted test.

Verified locally for this change: 170 unit/API tests, 50 browser tests, 1 configuration test, 2 render-safety tests, and 2 navigation tests passed. Astro check reported 0 errors, 0 warnings, and 4 existing hints. The production build generated 178 pages with all internal links valid. Wrangler 4.163.0 compiled the Pages Functions locally without deployment. Initial concurrent verification encountered an Astro optimizer cache collision and one browser image-load timeout; isolated reruns passed, without application changes to bypass either check. No content/assets or production deployment workflows were changed.
