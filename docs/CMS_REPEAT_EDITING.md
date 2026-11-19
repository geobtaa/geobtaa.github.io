# Repeat editing — checkpoint 2

Checkpoint 1 is committed locally as `b1bbc57`. This checkpoint implements reopening a merged page and continuing normal CMS editing. Neither checkpoint has been pushed or deployed. Cloudflare Free runtime qualification is still required before wider use.

## Editor experience

After a publication PR merges, reopen the page normally. The server verifies the recorded PR merge and that current main still contains the exact submitted document revision and required images. The page opens ready to edit. Save Draft and Create Publication PR work as usual. The UI does not expose branch generations or ask editors to reset a branch.

If another saved revision was made while the PR was open, those unpublished edits are shown instead of discarded. A notice explains that the prior PR merged and later edits were preserved. Save Draft starts the next working draft. New unpublished image uploads are retained; images already on main remain immutable references.

Browser recovery recognizes a pre-merge backup only when its saved source still matches the verified source being carried forward. It restores editable fields without reverting published visibility. Recovery for a resumed document also binds to the source head, so a newer saved revision with the same main baseline cannot silently be overwritten. An older tab's save is rejected; the form and its recovery copy remain intact.

If someone changed the same document or its required images on main beyond the recorded publication, continuation fails closed and retains the saved draft for reconciliation. Unrelated main changes can become the next baseline automatically. Merge is sufficient to start editing from main; this does not assert that GitHub Pages deployment succeeded.

## Storage and concurrency

Legacy draft names and v1 metadata remain supported. A subsequent working draft uses v2 identity tied to the canonical document, published base blob, and predecessor head. The old source branch advances once with a metadata-only preservation commit, retaining its original tree and every prior revision. The new branch starts directly from current main and contains only that document and retained authorized new uploads.

The first save updates both refs in one atomic, non-force compare-and-swap. Concurrent starts elect one successor; a save prepared against the predecessor cannot advance it after handoff. No branch, tag, snapshot, or original coordinator commit is deleted, force-reset or rewritten. Publication coordinators and locks remain independent per editing cycle, including unchanged-byte publications, so an old merged request cannot capture a later publication.

Discovery resolves the successor chain from a paginated metadata inventory. Hosted route lists verify retirement commits against their unchanged predecessor trees and inspect the active working draft; they do not repeatedly scan archived content. Required CI still verifies complete scope and ancestry for every retained branch before publication. The independent CI checker accepts both metadata versions and verifies the predecessor's preservation commit, its unchanged tree, and the exact initial successor commit. All existing protected-content, route, image, snapshot and lock validations remain. New cycle support must reach trusted main/CI before the corresponding application deployment can create v2 drafts; an older checker fails closed rather than granting an exemption.

The retained incomplete live test publication has not merged and does not qualify for continuation. Its saved revision, snapshot, coordinator and lock retain their prior recovery path. No live handoff or publication has been attempted.

## Validation and remaining limits

Focused tests exercise existing/new documents over three publications, later saved text and images, pre-merge browser recovery, stale tabs, concurrent starts, unavailable responses, conflicting main edits, unrelated main advances, unchanged-byte merges and tampered predecessor evidence. Every new publication fixture runs the full independent scope validator.

A cold-module fixture with 168 other published documents and two other working drafts used 38 logical GitHub requests for a first repeat save. This test uses an in-memory GitHub transport and fresh module caches; it is not Cloudflare CPU telemetry. Successful immutable merge/ancestry evidence is reused only for the same source and main SHAs, while mutable heads and atomic save preconditions are reread.

The general Save Draft/discovery implementation still verifies retained histories and images and has no new guarantee of fitting 10 ms CPU or 50 subrequests for every inventory. A ten-round regression used at most 37 save calls in its smaller warm fixture. Many editing cycles, long histories and larger uploads still need representative Free-plan measurements. Publication operations retain checkpoint 1's 40-request cap and explicit size/history bounds. No background orchestration, new credentials, deployment polling, or automatic merge has been introduced.

Final local validation: 238 unit/API tests and 54 browser tests passed, along with Astro checks (zero errors/warnings; four existing hints), render/configuration checks, production build and navigation tests. The existing empty-text-block browser test exposed a DOM-selection synchronization race during verification; its native selection/state synchronization was corrected without changing application behavior or removing assertions, and three isolated repeats plus the full suite passed. A read-only GitHub check confirmed the retained test reservation is still Reserved and its original snapshot passes the full independent validator.
