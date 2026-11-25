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
| `CMS_UNPUBLISH_ENABLED` | Defaults disabled; enable only after trusted protocol and marker rollout |
| `CMS_PUBLISH_ENABLED` | `true` permits publication PR creation after rollout gates pass |

Leave `PUBLIC_PROJECT_EDITOR_API_URL` unset for hosted use. No hosted personal access token, local gateway token, storage binding, or separate publishing credential is needed. Do not put secrets in tracked files or browser variables. Preview deployments should have no OAuth/session secrets, including inherited bindings.

Use a dedicated OAuth App, separate from staging. Preserve its callback `https://gin-editor.pages.dev/api/auth/callback`. Both `/` and legacy `/editor/` same-origin return paths are accepted with queries/fragments. OAuth uses PKCE and `public_repo`; tokens remain server-side in encrypted HttpOnly eight-hour session cookies. Authenticated requests recheck the allowlist, and writes recheck repository permissions. Empty allowlists permit accounts with repository push permission at sign-in, so keep the testing allowlist populated.

Before cookies, OAuth, request parsing, or GitHub calls, the Function compares the actual request origin with `EDITOR_ORIGIN`. Missing/malformed configuration fails closed. Other origins receive 403 for all API routes, even with a copied valid session. Forwarding headers cannot select the canonical host. Mutations also require matching Origin headers. Preview hosts must not be configured as separate authorized origins.

The local Node gateway is separate: `npm run editor` uses `GITHUB_TOKEN` and optional `PROJECT_EDITOR_OWNER`/`PROJECT_EDITOR_REPO`, with loopback/CORS development behavior. It does not require the hosted origin setting. See [local development](../../editor/README.md).

## Release and rollback checks

The legacy compatibility release changes both the browser editor and shared
validation. Merge the complete reviewed release into `main` before deploying an
editor version that creates protected-block removal records. Subsequent CMS
publication checks execute trusted main code and must recognize those records.
This is an ordinary source PR: it requires the full browser suite and gains no
CMS snapshot skip. No workflow, OAuth scope, environment flag, or branch-protection
change is needed for the compatibility/removal feature.

Qualify this release with an existing disposable MDX page: inspect Page setup,
edit a supported legacy block, create replacement content, remove an eligible
opaque block, undo it, then remove/save/reopen it. Confirm setup and retained
source stay exact, then verify publication through the normal checks. Local
mock tests do not establish that hosted qualification.

1. Review the source PR from current main. Exclude staging saves, test content, and uploaded test assets. Required trusted validation must support the draft and publication protocol before deployed code uses it.
2. Confirm dashboard settings against the intended project and exact source revision. Keep automatic previews disabled. Exclude `cms/drafts/*`, `cms/publish/*`, and `cms/publication-state/*` from automatic builds in any project that permits previews. Retain `[CF-Pages-Skip]` commit markers; do not suppress real main content builds with broad watch-path exclusions.
3. Preserve canonical origin, callback, credentials, repository identity, recovery workspace, and legacy staging configuration during cutover. Pause edits and preserve browser backups when changing application versions. Keep publishing disabled during replacement/read-only checks until the designated test is approved.
4. Verify the served revision, root page, legacy redirects, 404 behavior, same-origin API, OAuth, unauthorized-host rejection, Save Draft/reopen, image reads/uploads, and browser recovery. Inspect any host rules previously restricted to `/editor/` and ensure equivalent coverage at `/`.
5. Verify no draft/snapshot/coordinator build starts, while normal main updates still build. Complete the runtime and intended-account tests in [validation](validation.md) before widening use.
6. Confirm the public site and older staging project remain operational. GitHub Pages deploys only main, serializes deployments, and rejects an obsolete build before deploying. The deployment marker supports diagnosis; the editor keeps request state separate and confirms deployment only through matching marker and Pages evidence.

Rollback restores gin-editor's previous deployment and its matching build command/output settings. Do not reset content branches, rotate OAuth credentials, or delete drafts as an application rollback. Disabling PR creation does not close an existing PR or undo a merge; inspect outstanding requests separately.

An older validator cannot publish drafts that intentionally removed protected
content. Retain those drafts and their commit metadata during rollback; use a
matching reviewed validator/editor release before resuming publication. Do not
drop removal records or weaken preservation checks to force a publication.

These are maintenance requirements, not a record of current live dashboard state. Verify actual deployed settings and platform limits at the time of release.

## Enable and qualify native auto-merge

Keep `CMS_AUTO_MERGE_ENABLED` unset or false until the reviewed backend, progress UI, tests and documentation are on main and the intended editor release has been deployed. These are two reviewable implementation stages: guarded authorization/cancellation and API tests first; editor/Library progress, confirmation and browser tests second. The immutable snapshot/coordinator format and trusted required checks do not change. Do not enable only the backend for editors.

1. In the GitHub repository, open **Settings → General → Pull Requests**. Enable **Allow auto-merge** and ensure **Allow squash merging** is enabled. Leave **Automatically delete head branches** off so CMS snapshots remain available until verified maintenance cleanup; automatic authorization rejects that setting when it is enabled or cannot be verified. See [GitHub's auto-merge setting instructions](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-auto-merge-for-pull-requests-in-your-repository).
2. Preserve main's strict, up-to-date `validate` and `cms-publication-scope` checks bound to GitHub Actions, required PR protection, administrator enforcement and empty bypass allowances. The current verifier requires zero mandatory approvals and code-owner approval disabled; this release does not change that policy. Do not enable a merge queue or Update branch automation for CMS snapshots.
3. In the production **gin-editor** Cloudflare Pages project, set `CMS_AUTO_MERGE_ENABLED=true` alongside `CMS_PUBLISH_ENABLED=true`. Retain `CMS_UNPUBLISH_ENABLED=true` and the trusted main capability if automatic unpublishing is to be tested. Apply runtime variable changes using that project's normal release process. Do not add an Actions merge token or broaden OAuth scope; authorization uses the signed-in editor's existing server-held token.
4. Sign in as an intended editor, including a non-administrator account if it will be supported. Use a designated disposable CMS test document. Save/reopen it, then choose **Publish**, check the saved version in the confirmation, and confirm **Publish**. Confirm the CMS reports authorization waiting for checks, the PR passes both required checks, GitHub squash-merges it, and the normal main push triggers **Deploy Astro site to Pages**. The test is successful only when the CMS verifies the website update and the public page contains the selected content. No GitHub merge click should be needed.
5. Submit another test update and cancel automatic publication while checks are pending. Confirm cancellation in the CMS and confirm the request remains open for manual review. A merge may win the race; in that case the CMS must report merged/pending deployment, never successful cancellation.
6. Submit two different test documents close together. After the first merge, the second should show that the website changed and offer **Update and publish**. Opening that action must not create or authorize a replacement yet. Review the saved version, confirm **Publish**, and verify that only then is the replacement created and authorized. Verify both deployed contents.
7. Qualify the retained administrative manual API separately: read-only prepare, then ordinary authenticated snapshot submission without auto-merge authorization. It must not enable auto-merge; normal editors have no manual submission controls. For the disposable published test page, confirm **Unpublish** separately, verify the CMS eventually says Unpublished, and confirm the page is absent from the public build while saved editorial work remains available. Republish through Publish.
8. Check document and Library progress, a failed/blocked request, sign-in expiration, unavailable deployment evidence and subsequent Check again recovery. Record the tested editor account, request/run URLs, source revision and verified outcome with the release.

Turning the runtime flag or repository auto-merge setting off is not a substitute for cancelling outstanding authorized requests. Inspect and cancel each pending request first; the CMS cancellation route intentionally remains available when creation/authorization flags are off. A completed merge cannot be cancelled or rolled back by that action.

## Automatic branch cleanup

After this workflow reaches main, **Clean up completed CMS branches** runs daily at 06:35 UTC. It removes each eligible page's full `cms/drafts/*`, `cms/publication-state/*`, and `cms/publish/*` chain plus its publication-lock tags. Eligibility requires a verified live deployment, merged and closed publication history, at least 24 hours since every merge, no newer saved edits, and no uploads that exist only in the draft. An active page's older branches remain until the whole chain can be removed safely.

In **Actions → Clean up completed CMS branches → Run workflow**, choose main. Leave **dry_run** checked to inspect eligibility; uncheck it to apply the same verified cleanup immediately. The workflow summary gives page and error counts; step logs list each page's result, retained-state reason, and eligible/deleted reference names. Per-page errors stop work on that page, allow other pages to be checked, and mark the run failed for inspection. A lost deletion response is confirmed by reading the references back; unavailable readback is reported as an error. An interrupted deletion is safe to rerun: all reference deletions for a page are atomic, with expected OIDs checked by GitHub's [updateRefs API](https://docs.github.com/en/graphql/reference/git#updaterefs).

The workflow uses the repository's built-in `GITHUB_TOKEN` with contents write, pull-request read, Actions read, and deployments read permissions. It has no PR trigger, checks out main with persisted credentials disabled, and never merges or modifies main. It preserves files, published images, PR records, and route reservations. GitHub's automatic head-branch deletion must remain off.

Chains over 100 reference updates, missing/corrupt evidence, unpublished uploads, and orphaned branches require separate inspection; cleanup logs explain why a discovered page was retained. This workflow does not discard unpublished work. If an editor left a page open across cleanup, reopening refreshes its saved revision before the next save.


Ordinary development PRs are never automatically opted in by this integration. GitHub's repository-wide setting also lets repository writers opt other PRs into auto-merge directly; it does not enforce a repository-wide ban on automatic code merges.
