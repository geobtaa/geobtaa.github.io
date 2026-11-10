# CMS publishing implementation plan

Status: proposed implementation design, updated October 27, 2026. No application or hosting changes are authorized by this document. This expands step 3 of `editor-prototype/workplan.md` and supersedes that step's shared staging-to-main publishing model.

## Scope and editor experience

Release 1 covers routine blog posts and the documentation areas already enabled in the CMS. Program updates remain separate work. There are no approval roles, scheduling, in-editor history, or Unpublish action. Optional authenticated rendered previews are phase 2 and do not block publishing.

- **Save Draft** saves a working copy without changing production. For an existing live document, the current public version stays online.
- **Publish / Publish changes** publishes the selected saved revision after required checks. If there are unsaved changes, save successfully first and publish that exact revision; stop on any save conflict.
- Show **Draft**, **Live — draft changes saved**, **Publishing…**, **Published**, or an actionable failure. Saving and deployment are separate facts. Publish requires an explicit action even if content is eligible to build.
- **View live** appears after verified production deployment. Phase 2 adds **Preview saved draft**, explicitly identifying the saved version.

## 1. Stable application and transition

`main` already contains an earlier `/editor/` application and Pages Function, introduced by PR #351. It does not yet contain all current prototype improvements. Do not merge `custom-cms` wholesale again.

1. Create an editor release branch from current `main`. Transfer reviewed application changes by file/diff into this branch: editor components, shared server modules, Pages Functions, necessary dependencies, configuration, tests, and documentation. Exclude all prototype content saves and uploaded test assets. Audit the complete PR diff, including assets and content, before merging. Resolve already-live test content separately with an explicit content decision; it is not part of this publishing implementation.
2. Keep `geobtaa-editor-staging` connected to `custom-cms`, with its current OAuth app, secrets, and staging URLs operational during development and validation. Test new publishing behavior on designated test documents before routine use. Do not silently redirect the legacy staging editor's writes to production.
3. Add a separate stable Cloudflare Pages project, proposed name `geobtaa-editor`, tracking `main`. Serve the editor and its API from one origin, initially `https://geobtaa-editor.pages.dev/editor/`. Use a dedicated OAuth app/callback and separate session secret. GitHub Pages continues to serve the public website; it cannot execute the Cloudflare API. Public-site editor links must lead to the stable Cloudflare editor rather than a nonfunctional same-origin API on GitHub Pages.
4. Stable CMS builds use the same reviewed code on `main`. Future editor work starts on `editor/*` or ordinary feature branches from `main`. Content never uses those branches. Code PRs explicitly account for any content changes; no shared staging branch is merged as a code release.
5. Cut over coworkers only after the complete publishing path works. Inventory wanted legacy drafts and transfer one document at a time onto fresh document branches from current `main`; do not import `custom-cms` ancestry. Retain old staging for development, then remove routine content-writing access there after migration. Keep its infrastructure operational through the transition.

Two Cloudflare projects are intentional: one stable application and one development/preview environment. Coworkers need only one editor bookmark and the public website.

## 2. Underlying `draft` metadata

Repository review: `src/utils/blogContent.ts` explicitly excludes `draft: true` from blog/update listings. `src/utils/libraryContent.ts` excludes drafts and navigation-hidden entries from library listings. The Starlight docs collection uses `docsLoader()` and `docsSchema()`. Starlight's production draft handling excludes draft routes; local development can show them. See [Starlight draft reference](https://starlight.astro.build/reference/frontmatter/#draft).

Remove the editorial Draft/Published switch, but retain compatibility with the field:

- New working documents get `draft: true`. Saving an existing document preserves its current field, including an absent field, and never edits `main`.
- Publish explicitly writes `draft: false` for the selected document in the publication snapshot. This also permits publishing an older `main` document that currently has `draft: true`. Preserve unrelated frontmatter, including navigation hiding and existing URLs.
- A working branch, not `draft: true` on `main`, holds revisions to a live page. Saving those revisions must not hide the live page.
- Do not infer actual publication from `draft: false`. Determine live state from the deployed production revision and document content.
- Verify production builds exclude drafts from direct routes, automatic navigation, blog/library listings, search index, sitemap, and any feeds present. Explicit links to hidden drafts must not leak draft text; validation may instead flag broken links. Check any custom collections independently of Starlight.
- Phase 2 needs an isolated preview-build override for the selected draft. Merely deploying its working branch will still omit a `draft: true` page. Do not change repository frontmatter or production build behavior to make a preview visible.

## 3. Document branches and concurrent editing

- One shared working branch per canonical content path: `cms/drafts/<area>/<short-slug>-<path-hash>`. Derive the hash from the complete normalized repository path, use enough digest characters to avoid practical collisions, and verify exact path identity rather than trusting a truncated hash. Titles never rename existing branches or document URLs.
- Create each new draft branch atomically from the current `main` SHA. Concurrent attempts for the same path reopen the winning branch. Recheck equivalent route names, `.md`/`.mdx` variants, and index routes against both `main` and active draft branches before reserving a new URL.
- The document list combines production documents with discoverable `cms/drafts/*` branches. Opening a document resumes its shared working branch if present. Backend discovery verifies its document identity and content diff; a branch prefix alone is not proof of ownership or scope. Record original base commit/document blob in server-generated branch commit metadata and validate against Git ancestry. Do not add CMS bookkeeping files to publication PRs.
- Editors collaborate on the same draft. Every save checks the loaded document blob and expected branch head and uses an atomic, non-force ref update. A stale save fails with a conflict; never use last-write-wins or silently replace another editor's work. Show the last saving editor/time when available.
- Use GitHub branches, commits, and PRs as persistent state; do not rely on a browser tab or an eight-hour session for publication state. Discovery and status work after sign-in from another browser.
- Publication uses a separate fixed snapshot branch, `cms/publish/<path-hash>-<saved-sha>`, created from freshly read `main`, containing only the approved file delta. This lets later Save Draft actions continue without changing the submitted revision. Repeated Publish requests for that revision reuse the branch/PR; permit only one active publication per document. Treat the publication branch as immutable through CMS endpoints; an externally changed head must fail the required scope check or be revalidated, never inherit an old passing check.
- After merge, delete the publication branch after its PR/merge identifiers are recoverable. Keep the working branch until deployment is confirmed. Then delete it only if no newer edits exist. Cleanup must avoid deleting a concurrent save; verify the expected ref under a tested concurrency protocol, or defer deletion to manual cleanup if an atomic condition cannot be guaranteed. Retain branches after failure; do not automatically expire abandoned drafts in release 1.
- If newer edits remain after publication, carry those edits forward relative to the published snapshot onto current `main`, using conflict checks. Never recreate a deleted branch from an obsolete base. An open editor detects that its branch was published/deleted and reloads the new baseline before another save.

## 4. Narrow publication and asset safeguards

The browser supplies a selected document and expected saved revision, not arbitrary repository/ref targets or a list of files to merge. The authenticated backend derives owner/repository, `main` base, permitted document path, branch identity, and asset scope.

Before creating a publication snapshot:

1. Reauthorize the user and verify saved revision, canonical path, supported content area, and route uniqueness. Reject traversal, unsupported paths, renames, symlinks, submodules, deletions, additional documents, and application/configuration/workflow changes.
2. Compare the source document on current `main` with the base document from which the working draft was made. If `main` changed that document, stop for manual reconciliation, even if Git could merge the text. A missing/deleted original is also a conflict. If only unrelated files changed, reconstruct the allowed publication delta onto current `main`; do not merge old application files from the draft branch.
3. Validate the full document using authoritative repository content and existing frontmatter/MDX preservation rules. Do not permit new arbitrary executable MDX, script/HTML injection, or arbitrary imports through the publishing API. Preserve existing protected constructs and allow only the editor's supported generated syntax; changing protected source outside that contract requires a normal development PR.
4. Compute assets from supported body/cover references and validated editor-generated imports. Existing assets on `main` can be referenced without modification. New assets must be verified uploads attached to this document, within `src/assets/images`, of supported type/size/signature, and actually required by the selected revision. Reject uncertain new dependencies for maintainer resolution rather than widening the PR scope. Ignore external image URLs for repository copying.
5. Assign immutable upload names with a content digest, preserving an understandable basename/extension. Never overwrite or delete an existing production image. Same path plus identical bytes is reusable; differing bytes require a new name. Recheck at publication against latest `main`. Store uploads only on the document working branch; exclude unused uploads from publication. No automatic production asset deletion.
6. Create the publication tree from current `main` plus exactly one document and the necessary new image blobs. Recompute the complete diff and validate it before opening the PR. Freeze that snapshot and use an idempotent publication identity so retries cannot create multiple merges.

An independent required CI scope check repeats these constraints against the PR's actual head and base. It must not trust a label, branch prefix, PR body, or client-supplied manifest as authority. Verify deterministic path identity, asset reference closure, protected source rules, and every changed path. Run the checker from trusted base code, without exposing write secrets to PR content. All `cms/*` PRs and any PR configured for CMS auto-publication must pass this gate. Ordinary reviewed development PRs may change code; the CMS never creates or automatically publishes them.

Require the head to be current with `main` and rerun checks when base/head changes. In particular, a same-document change on `main` must force a conflict/reconfirmation rather than merely a successful text merge. Validate this race explicitly before enabling auto-publication. Do not bypass branch protection to make a merge succeed.

## 5. GitHub authentication and required repository settings

Verified in code: OAuth requests `public_repo`; callback requires repository push permission and optionally checks `ALLOWED_GITHUB_USERS`; tokens stay in an encrypted HttpOnly eight-hour session cookie. Branch/file writes already use the signed-in user's token. PR creation, auto-merge, and deployment monitoring are not implemented yet.

For this public repository, that OAuth scope is suitable in principle for branch/PR writes and publication status reads. Actual authorization remains limited by the user's repository rights and repository/organization rules. [GitHub scopes](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps) and [auto-merge requirements](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/automatically-merging-a-pull-request) support retaining this approach; no bot token or GitHub App migration is required for release 1. The scope itself does not restrict writes to content: backend enforcement and required CI do that.

Before rollout, an administrator must verify/configure:

- Auto-merge enabled and squash merges permitted. Use GitHub's native auto-merge after required checks; if already mergeable, perform a SHA-bound merge only after verifying the same requirements. Do not merge from a browser credential or a token embedded in PR content.
- Protect `main`: require PRs, required status checks, up-to-date branches, no force pushes/deletion, and no CMS bypass of checks. Required human approvals or CODEOWNERS reviews must not block routine content PRs; if existing policy mandates them, that policy conflicts with automatic self-publication and needs resolution.
- Make both `validate` and the new independent `cms-publication-scope` check required, using their actual GitHub check names and trusted source. Ensure they run on every applicable PR/base update without path-filter skips that leave required checks pending. A scope job can pass ordinary development PRs while strictly checking reserved CMS branches; CMS merge endpoints never accept ordinary branches. Verify branch namespace restrictions/rules do not allow an alternate CMS path around the gate.
- Current validation already runs Astro sync/check, editor tests, build, and navigation tests. Add meaningful publishing coverage for scope escape, assets, concurrency, draft visibility, and deployment tracking. Keep required workflow identity stable and protect changes to the checker/workflows through normal code review.
- Keep Pages configured for GitHub Actions and restrict the `github-pages` environment to `main`. Current deployment allows manual workflow dispatch; explicitly reject non-`main` deployments so a manual run cannot publish a draft branch. Preserve the `main` content/asset push triggers.
- Recheck permissions/allowlist at write and Publish time, not only login; retain same-origin request protection, logout/session expiry handling, and server-only tokens. Test branch creation, PR creation, native auto-merge, and deployment reads using a real intended editor account during implementation. These are write tests and have not been performed during planning.

Live repository rules, granted token scopes, Pages settings, and Cloudflare settings are not available from the checked-in files. A public API read was attempted but the shell could not resolve the host; no authenticated administrative connection is available here. Treat these as launch prerequisites, not verified configuration.

## 6. Deployment tracking and overlapping publishes

- Persist/derive publication identity from PR number, submitted draft SHA, publication head SHA, merge commit SHA, document path, expected published blob, and asset blobs. PR metadata may help recovery but is not permission evidence.
- Poll from the CMS backend for merge and the `github-pages` deployment status; use the production workflow/environment identity, source SHA, deployment ID, and final success. A merged PR or a successful build alone is not Published. See [GitHub deployment statuses](https://docs.github.com/en/rest/deployments/statuses).
- Current deployment cancels older runs on the same ref. If the run for merge A is canceled because merge B supersedes it, a successful deployment of B can satisfy A only if B contains A's merge commit and still has the expected selected document and required assets. An unrelated successful deployment, or an ancestor without the change, cannot satisfy A.
- Add a small public build revision marker containing the deployed source SHA, produced by the build rather than accepted from a client. Combine final production deployment status with the marker to verify the currently served build. This also supports recovery after tab closure or GitHub status retention limits. Treat cache/network uncertainty as “Checking publication…” rather than success.
- Serialize production deploy jobs and prevent an older artifact from becoming the final active deployment after a newer one. Test cancellation during build and deploy. Never use a branch's current head or the most recent successful workflow alone as evidence of which revision is live.
- Failure before merge: draft and old production remain. Failure after merge: display “Changes merged; website deployment failed” with Retry status and a maintainer/log link. Do not create another PR for the same content or claim the old version is unchanged without checking the served revision. A later successful deployment containing the exact change can resolve the status.
- If another publication superseded/reverted the selected document, identify that the website has a newer/different version rather than reporting this draft Published. Reopening the editor reconstructs status from GitHub and the live revision; no background task depends on keeping a session open.

## 7. Errors and manual recovery

Keep the form and unsaved content in place on errors. Provide one clear next step, with optional technical details/link for maintainers:

| Situation | Message/action |
| --- | --- |
| Invalid field | “Add a title before saving.” Focus the relevant field. |
| Stale shared draft | “Someone saved a newer draft. Copy your unsaved changes, reopen the latest draft, and reapply them.” |
| Document changed on main | “The public document changed since this draft began. A maintainer needs to reconcile the versions before publishing.” |
| Session expired | “Sign in again to save. Your unsaved changes are still in this tab.” Reauthentication must preserve the form; offer copying text before any reload. |
| Validation failed | “Publishing checks failed. Your draft is saved; the public page has not been updated by this attempt.” Link to actionable check details. |
| GitHub/network uncertainty | “We couldn't confirm publication. Check status before trying again.” Recover the existing PR before retrying mutations. |
| Deployment failed after merge | “Changes merged, but deployment failed. A maintainer can retry the deployment.” |

Document a maintainer runbook: record document/PR/SHAs; inspect scope/validation/deploy logs; rerun the failed deployment from a valid `main` revision when appropriate; repair code/build issues through a normal PR; reconcile conflicts into a fresh branch from current `main`. For an incorrect content publication, restore the previous document through a narrow revert PR, retaining shared images unless proven unused. Avoid reverting unrelated newer edits. Verify deployment and live revision afterward. Reconcile or retire the corresponding draft branch so it cannot silently republish reverted content. Git history remains the recovery source; there is no rollback interface.

## 8. Phase 2: authenticated Cloudflare previews

The existing Git-connected staging project can host `cms/drafts/*` branch previews while retaining `custom-cms` as its production branch during transition. Configure branch include/exclude controls to avoid unnecessary builds. Cloudflare supports immutable deployment URLs plus moving branch aliases; the CMS must use the successful deployment matching the saved SHA, not just a branch alias. See [preview deployments](https://developers.cloudflare.com/pages/configuration/preview-deployments/) and [branch controls](https://developers.cloudflare.com/pages/configuration/branch-build-controls/).

- Protect previews with Cloudflare Access before enabling draft rendering. Its default preview protection does not automatically protect the project's root `pages.dev` or custom domain; account for those separately. Validate both page and asset access. Keep the draft-rendering override confined to authorized preview builds and to the selected document.
- Render using the current stable CMS/site build logic. Older draft branches may lack preview support; refresh their allowed document/asset delta onto current `main` before requesting a preview, with conflict detection. Never merge arbitrary old application code to enable previews.
- Configure no production OAuth/session/write credentials in preview environments. Disable write/auth routes there; viewing requires Access, while editing/sign-in stays at the stable application origin. Inspect inherited [Pages bindings](https://developers.cloudflare.com/pages/functions/bindings/) rather than assuming production secrets are absent.
- Use the deployment/check association or a server-only, read-only Cloudflare API credential to find the matching successful deployment. Do not require broad Cloudflare credentials in the browser. Unsaved changes are not included; a saved draft can still need a build.
- Access protects rendered previews, not source committed to a public GitHub repository. This design does not provide confidential draft storage. Confirm this limitation with editors before rollout; if confidential drafts are required, a private source/storage design is separate work.

Recommendation: keep stable editor deployment separate from staging/previews. This avoids variable callback URLs, draft code executing with production editing credentials, and preview failures taking down the routine editor. The existing project need not be replaced to add previews; its actual Access policies, environment configuration, and capacity must be checked in phase 2.

## 9. Decap coexistence and cutover

Use ownership by content area during rollout. Once blog posts or a documentation collection moves to the new CMS, disable its editing in Decap and direct editors to the new URL. Leave unsupported program updates in Decap until separately migrated. Do not depend solely on a notice while both interfaces can edit the same collection.

Before each area switches, inventory and resolve existing Decap open PRs/drafts, legacy staging drafts, and in-progress browser edits. No automatic legacy branch merges. New CMS publishing compares `main` against its base so a Decap/manual edit still results in a conflict instead of overwrite. Scope checks for `cms/*` must not accidentally block ordinary Decap branches for the remaining areas. Name the maintainer responsible for migration/conflict resolution in the editor guide.

## Implementation order and release gates

1. Audit live repository/Cloudflare settings and editor account capabilities; inventory drafts and Decap areas. Prepare the clean application release PR from `main`.
2. Implement shared per-document drafts, upload isolation, concurrency checks, discovery/reopening, and Save Draft UI. Keep old staging working.
3. Implement fixed publication snapshots, independent scope CI, required validation and branch protection, native automatic merging, and idempotent recovery.
4. Implement deployment tracking and simple failure states; publish one new post and one updated documentation page end to end. Test overlapping documents, edits during publication, competing same-document drafts/main changes, filename collisions, expired sessions, failed checks, failed deployment, refresh/relogin, and manual recovery.
5. Deploy stable editor from `main`, migrate one content area at a time, and document the editor/maintainer workflows. Release after the above gates pass; program updates and previews are not prerequisites for this scoped release.
6. Phase 2: Access-protected saved-version previews on the existing staging project.

## Blocking decisions and verification limits

No unresolved product decision prevents implementation of phase 1 under the defaults above: separate stable project, shared document drafts, fixed publication snapshots, user OAuth, squash auto-merge, and phased Decap ownership.

Before enabling production publication, an administrator must confirm that required PR checks without mandatory human content approval are permitted and that intended editor accounts can perform the required operations. If organization rules require approvals or prevent the necessary OAuth access, that is a genuine policy blocker; do not introduce a privileged bypass. Stable Cloudflare project/OAuth provisioning is also a launch dependency, with the proposed `pages.dev` URL sufficient unless unavailable.

Phase 2 requires agreement on Access identities and confirmation that public Git source is acceptable for drafts. Neither blocks implementing phase 1; confidential draft requirements would change the storage design and must be raised before real sensitive drafts are saved.
