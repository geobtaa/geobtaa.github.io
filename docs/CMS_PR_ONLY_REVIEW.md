# Checkpoint 1 focused review

Local correctness review passes. This is not approval to deploy or a claim that Cloudflare Free CPU has been measured. The complete Edit Again cycle is checkpoint 2.

Preparation is read-only and creates no reservation. Browser closure or a failed preparation is safely retried from any authorized session. Creation rereads main, the working branch, coordinator and lock. A prepared candidate cannot override the saved revision: required CI independently reconstructs its exact expected bytes and asset closure. Concurrent working saves are preserved; main document conflicts stop submission. A lost atomic reservation or PR response is read back; unavailable readback preserves the saved draft and reports uncertainty. Refresh discovers an orphan reservation, and same-revision retry completes it. No merge operation exists.

The full trusted-base checker, its required workflow identity, exact-tree comparison, protected MDX/frontmatter, route, asset and ancestry checks remain intact. Candidate PRs can fail CI; creation does not certify them. GitHub branch protection remains the merge gate. Deployment is not inferred from a merged PR.

| Hosted limit | Trigger and editor message |
| --- | --- |
| 40 GitHub requests per preparation/submission/status invocation | Large inventories or recovery exhaust the budget: “Publication could not be confirmed within this request. The saved draft is intact. Refresh PR status, then retry the same saved revision.” Status wraps errors in “PR status could not be verified: …”. No further request is sent. Writes require eight calls of remaining budget. |
| 1,000,000 JavaScript string code units of saved document text | Preparation: “Document unavailable or too large for hosted PR preparation. The draft is intact.” GitHub-truncated text fails closed earlier as incomplete data. |
| 1,000,000 code units of proposed document text; at most 100 distinct proposed assets | Invalid/oversized candidate: “Prepare the selected saved revision before creating its PR.” This never permits publishing a different revision. |
| 100 retained assets in the saved manifest | More than 100 uploads retained across multiple saves, including unused uploads: “This draft has too many retained assets for bounded PR submission. Ask a maintainer; the draft is preserved.” Applies to preparation and status as well. It is not the pre-existing 20-upload-per-save limit. |
| 250,000 code units of serialized GraphQL history nodes | Includes coordinator and returned main ancestors; attempt metadata grows with retries: “Publication history is too large or incomplete for hosted submission. Ask a maintainer; retained attempts are unchanged.” This may be reached before 100 attempts. |
| 100 coordinator commits/attempts | Existing append-only ancestry limit remains. A 101st attempt: “Publication retry limit reached. Ask a maintainer.” GraphQL reads at most 100 nodes, then bounded immutable parent readback where necessary. |
| Fewer than 300 open main PRs in the complete inventory | Three full 100-item pages cannot establish completeness: “Active PR inventory is too large for hosted submission. Ask a maintainer; nothing was reserved.” Exactly 300 also fails closed. |
| At most one PR for each immutable attempt branch | Unexpected duplicate PR history: “Publication PR identity is uncertain. Ask a maintainer; no replacement was created.” |

Ordinary preparation, initial submission and status measured 3/23/8 requests in local fixtures; repeat submission used 18. A 601-commit draft does not increase submission calls because full draft-history verification runs in required CI. A 21-attempt coordinator used 27 submission/9 status calls. These are request-count tests, not Cloudflare CPU measurements. Size checks occur after parsing GitHub responses; they do not establish a 10 ms CPU guarantee.

The retained live reservation was checked read-only during checkpoint 1: `5fe43d8` remained discoverable as reserved in eight requests; the full independent validator accepted snapshot `fd2b062` with coordinator `90d87e4` and the retained lock. No creation/merge was retried. Existing metadata and ref names remain supported. Future unrelated main changes require a replacement attempt, retaining all old snapshot/coordinator commits and the original lock; same-document changes block recovery. No deletion or historical rewrite is necessary.

Remaining release gates: actual cold/warm Free-plan CPU/subrequests, Save Draft/image/history performance, non-admin editor policy-read permission, and intuitive repeat editing. Oversized submissions require maintainer assistance rather than weakening checks or deleting saved state.
