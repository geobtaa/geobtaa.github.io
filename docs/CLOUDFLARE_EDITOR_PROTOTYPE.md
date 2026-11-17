Current deployment configuration: see [Permanent GIN editor setup](GIN_EDITOR_DEPLOYMENT.md). The hosted Function now requires `EDITOR_ORIGIN`; project-specific runtime settings are dashboard-managed, with no auto-discovered Wrangler deployment file on this release branch. Older milestone descriptions below record prior configuration.

# Cloudflare content editor

The existing Cloudflare Pages project is **`geobtaa-github-io`**, connected to this repository with **`custom-cms`** as its production branch. The editor is served at `/editor/`, with its same-origin Pages Function under `/api/`. Each Git-integrated project owns its runtime configuration in its dashboard; the release branch no longer contains an auto-discovered Wrangler deployment file. No project was renamed or created; no deployed settings, secrets, OAuth credentials, or callback registration were changed.

The code on `editor/cms-release` implements per-document Save Draft and has not been pushed or deployed. The application-host branch does not select content: current code reads published content from `main` and shared working revisions from verified `cms/drafts/*` branches. Legacy live staging retains its deployed behavior until a reviewed rollout.

The React/Tiptap application supports enabled documentation areas, Blog Posts, and Program Updates; frontmatter, rich text, tables, links, images, supported components, ordinary in-editor Preview, protected MDX preservation, navigation guards, reauthentication, safe creation retries, and private browser recovery. Saved drafts are discoverable from GitHub by other authorized accounts. Browser-only recovery copies remain private to their signed-in account/workspace.

Save Draft commits the selected document and referenced permitted new uploads together. Existing main files stay unchanged, new documents use `draft: true`, and existing visibility metadata is preserved. Save Draft creates no PR, merge, or production deployment. Publication and live-deployment status are future milestones; Program Updates publishing/cutover remains separately scoped.

GitHub OAuth uses PKCE, repository authorization, an optional `ALLOWED_GITHUB_USERS` allowlist, and an AES-GCM-encrypted HttpOnly eight-hour session cookie. Tokens never reach browser JavaScript. Every authenticated API request rechecks the allowlist, and every draft write rechecks repository push permission. Preserve the existing OAuth registration; the Function derives `/api/auth/callback` from its same-origin request URL.

The approved permanent project `gin-editor` will initially track `editor/cms-release`, then `main`, as described in the [publishing plan](CMS_PUBLISHING_PLAN.md). It is distinct from current staging and has not been provisioned.

See [the Save Draft milestone and rollout gates](CMS_SAVE_DRAFT.md), [application setup and editing](../editor-prototype/README.md), and [the historical application-transfer audit](CMS_RELEASE_AUDIT.md). Draft commits include `[CF-Pages-Skip]`; required preview-branch exclusions are documented in the milestone and have not been applied.
