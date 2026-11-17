Stage 1 is committed as `aaafcc7`. Stage 2 tracking is implemented locally; see [CMS_PUBLISH_STAGE2.md](CMS_PUBLISH_STAGE2.md) and the [release checklist](CMS_PUBLISH_RELEASE_CHECKLIST.md). Older status descriptions below record the Stage 1 checkpoint.

# Publish mechanics — Stage 1

Implemented locally, uncommitted on `editor/cms-release`. Keep `CMS_PUBLISH_ENABLED` unset or false. No live publication or administrative changes were made. The permanent editor is `gin-editor`; staging remains `geobtaa-github-io` / `custom-cms`; the public site remains GitHub Pages from main. Deployment confirmation (Stage 2) has not begun.

## Eligibility and advisory ownership

There are no mandatory human approvals, reviewer allowlists, or code-owner approval gates. Authorized repository writers may merge their own ordinary PRs after both required checks pass. GitHub enforces merge permission; a passing source check does not grant an outside contributor permission to merge.

`cms-publication-scope` distinguishes two results:

- **cms-snapshot**: only a same-repository snapshot passing the full saved-draft ancestry/identity, protected MDX/frontmatter, route, upload, exact-tree, current-main and active-coordinator contract. A branch name, label, description or content-only path list is not proof. Invalid reserved `cms/*` PRs fail; there is no ordinary-source fallback. Only these verified snapshots can be submitted by the CMS auto-merge endpoint.
- **validated-source**: every ordinary PR is scanned against complete actual Git trees on current main, without relying on a truncated PR-files list. New/modified MD/MDX must pass the existing syntax and protected-source validator: arbitrary new imports, expressions, scripts and protected source changes are rejected. New executable `head`/`layout` frontmatter is rejected. Existing protected source may remain unchanged, and supported generated components remain available. Ordinary PRs are not automatically merged by the CMS, even when their safe content happens to resemble a publication.

Snapshot verification proves the content/state contract, not that a branch was created through the CMS UI. A repository writer could manually construct a snapshot, but it must pass every same check; metadata or a matching name alone cannot bypass them.

The source scanner also checks regular file modes, obvious credential signatures, runtime `.env` files, conflict markers, JS/TS syntax, package JSON, npm v3 dependency lock HTTPS/integrity entries, workflow YAML, and dangerous workflow triggers/PR write permissions or repository-secret references. The scope workflow must retain its trusted-base checkout and checker command. Required gate files cannot be deleted. Changed security-sensitive paths are listed in CI output; there is no mandatory approval associated with that list. `validate` independently installs dependencies, runs tests/Astro checks, builds the site and checks navigation. This is bounded inspection, not a comprehensive vulnerability audit or dependency reputation guarantee.

The source scanner/compiler is CI-only; the hosted Pages Functions do not import TypeScript or execute ordinary PR code. The eligibility workflow executes trusted base code with read-only permissions. PR source is fetched as data and is never evaluated by that job. It runs on PR changes, without approval/dismissal triggers. See [final CI coverage and timing](CMS_RELEASE_FINAL_CHECKS.md) for the parallel validation jobs and browser-skip proof. There is no passing bootstrap when trusted checker code is absent. Install the checker on main before making it mandatory; both required workflows have no PR path filters.

`.github/CODEOWNERS.proposed` is inactive. It assigns only technical, authentication, workflow, dependency and configuration paths to `@karenmajewicz` and `@ewlarson`. There is no catch-all: routine documents, image uploads and editorial documentation do not request code reviews. After confirming both accounts have repository write access, it may be renamed to CODEOWNERS to request advisory reviews. Do not enable required code-owner reviews. Advisory ownership/automatic review requests are separate from the required-review setting ([GitHub CODEOWNERS documentation](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners)). Explicit changes-requested reviews may still need resolution under GitHub behavior; the CMS does not bypass them. Colleen and other repository writers need no maintainer approval to merge checked ordinary PRs.

### Security boundary under this governance

Automated checks cannot prove arbitrary application/authentication/workflow code safe or establish an author's intent. An authorized writer can introduce a subtle vulnerability, change tests, or weaken validation through an ordinary PR. CODEOWNERS requests review but cannot prevent that merge. Application/MDX dependencies and existing protected MDX can execute code during the separate read-only build. Its runner must have no production secrets, privileged token, or authenticated preview deployment.

All repository writers must therefore be trusted to change production application code; CMS OAuth and route restrictions constrain the CMS interface, not the user's independent GitHub permissions. Content editors who should not have that trust need a different future authorization/token architecture; this implementation does not provide content-only GitHub write roles. Broadening the executable-MDX policy or introducing new privileged workflow patterns requires an explicit technical policy change, not an approval override. As requested, such source policy changes can themselves be self-merged by authorized writers after checks: automation cannot make those writers adversarially untrusted.

The source scanner fails closed on incomplete inventories, more than 500 changed files, more than 20 MB inspected data, unsupported binary source, and changed symlink/executable/submodule modes. Supported raster image changes receive signature/size validation. Split large PRs or deliberately extend the scanner for new asset types; do not treat a passing scan as proof that all code or binaries are safe.

## Snapshots, replacement attempts, and recovery

Publish is separate from Save Draft and requires a clean saved revision. The backend reauthorizes repository push access and retains canonical-origin/session/allowlist/same-origin safeguards. It accepts the selected document and expected saved head, never browser-provided Git targets or arbitrary file manifests.

Each snapshot is built from freshly read main plus exactly one document (`draft: false`) and required verified new image assets. It is never a merge of a draft branch. Unused uploads and unrelated files are excluded. Existing document content changing on main stops publication for manual reconciliation, even if Git could merge it. Unrelated main advances permit a replacement after all validations run again.

A publication coordinator lives at `cms/publication-state/<path-hash>-<original-document-blob-or-new>`. Its commits record an append-only attempt history and a fixed selected saved SHA; ancestry is checked. The initial coordinator, immutable snapshot branch, and immutable `cms-publication-locks/*` tag are created in one atomic compare-and-swap transaction. Subsequent attempts atomically append state and create a new immutable snapshot; the lock tag is retained unchanged. Snapshot names include path identity, selected saved SHA, main SHA and attempt ordinal. All generated commits use `[CF-Pages-Skip]`.

On **explicit retry of Publish for the same saved revision**:

1. Read all recorded attempts/PRs. A prior merged PR is terminal, even if main has advanced. Never create another merge attempt after a confirmed merge.
2. Revalidate against current main. Same-document conflict stops before retiring anything.
3. If a snapshot is stale, close its open PR and read it back. A merge that wins the race is terminal. Uncertain closure blocks replacement. GitHub's strict main protection also blocks simultaneous stale snapshots from both merging.
4. If a PR is closed and unmerged, create the next attempt even on the same main. If a reservation has no PR, recover that reservation instead of creating a duplicate; if its base is stale, append a fresh attempt.
5. Preserve all old snapshots, coordinator history, lock tags, working drafts, newer edits, and route-reservation tags. Concurrent requests elect one coordinator update and recover the winner. Superseded snapshots fail eligibility.

There is no background retry loop in Stage 1; another explicit Publish request recovers progress after main moves or an uncertain response. Native auto-merge failures return an actionable PR state and preserve the same attempt for retry. There is no direct-merge fallback. A PR already mergeable when auto-merge is requested may still require manual completion; this remains a live integration gate.

Conservative boundaries: a different selected revision cannot steal an existing publication coordinator. An explicit abandon/transfer UI or maintainer migration needs a separate reviewed protocol. Legacy locks without a coordinator, corrupt history, moved/deleted snapshots, unverified protection, or a 100-attempt history limit require maintainer investigation. Never delete such a lock to force a retry. No old-format publication was created live by this local milestone.

## Repository policy and rollout decisions

Use one classic protection rule for main initially. The verifier requires:

- Repository native auto-merge and squash merging enabled.
- Administrator enforcement; force pushes and branch deletion disabled; no PR bypass allowances.
- Strict required `validate` and `cms-publication-scope` checks bound to GitHub Actions (app ID 15368).
- PRs required, zero human approvals, required code-owner reviews disabled, and no last-push approval requirement. Stale-review dismissal is optional and is not a merge gate under this policy.
- No additional effective rulesets or restricted-push actor lists. These mechanisms currently fail closed pending an explicit compatibility verifier.

The policy is checked before publication writes and again before native auto-merge. Missing read permission, absent settings, malformed policy, or unsupported protection returns a specific maintainer action. The CMS neither changes settings nor bypasses them. The actual OAuth account must be able to read policy and request auto-merge; the earlier admin-token audit is not proof of that access for every editor.

Before any authorized live publish: confirm advisory owners and the inactive CODEOWNERS proposal; install trusted base code; configure and verify required checks/ownership/protection; exercise intended non-admin OAuth access, stale replacements, concurrent retries, self-merged ordinary PR security validation and native auto-merge. Keep publication disabled until review and Stage 2 are complete.

In both Cloudflare projects, keep authenticated previews disabled and exclude `cms/drafts/*`, `cms/publish/*`, and `cms/publication-state/*` from preview builds. Generated commits also carry the skip marker. No Cloudflare settings were changed. Main merges can still build the final main-based editor; optimizing those builds is separate from suppressing publication-branch previews.

## Validation and Stage 2 boundary

Local mocks cover ordinary source security validation and rejection without approvals, complete CMS eligibility, snapshots/assets/concurrent revisions, unrelated and same-document main changes, closed/abandoned attempts, retained locks, duplicate retries, merge-versus-close races, uncertain responses, corrupt state and protection failures. Browser/API tests retain Save Draft, Preview, recovery, image and authentication coverage. No test writes to GitHub.

There is no Pages deployment polling, live revision marker, Published claim, deployment-status recovery, automatic draft rebase, or cleanup. Retained coordinator/PR history supplies durable Stage 2 inputs. Existing Pages manual-dispatch restrictions and deployment ordering remain Stage 2 review items.
