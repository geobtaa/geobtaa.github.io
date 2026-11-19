# Workers redirect compatibility correction

Local fix branch: `editor/cms-worker-redirect-fix`, based on merged main `144f178`. No push, deployment, live settings change, OAuth credential change or publication retry is part of this correction.

## Cause and affected requests

Two production server adapters specified unsupported `redirect: 'error'`:

- `functions/api/[[path]].js`, `githubRequest()`: Pages GitHub API requests, including image listing, draft reads/saves, OAuth account checks and publication requests.
- `editor-prototype/github.mjs`, the local gateway's GitHub client: the corresponding server-side adapter.

Opening the image picker immediately loads `GET /api/images?area=…&filename=…`. This calls `listImages()`, reads main's ref first, and reaches the Pages adapter. The error is thrown by workerd while constructing that first fetch request, before it reaches the outbound service. The original Pages handler was bundled and executed in workerd and reproduced the exact reported error on this route. There is no need for GitHub to return a redirect to trigger it.

`POST /api/images` is different: it validates/encodes an image into a pending browser upload and does not write GitHub. The image enters Git only during Save Draft. The reported compatibility error cannot originate in that POST's GitHub access because it has none. A later Save Draft would also fail on its first GitHub call under the old adapter. A browser network trace would identify the exact failed UI request; the message alone does not distinguish a picker read from a later save.

Cloudflare documents the unsupported mode and pre-request failure in its [Request API](https://developers.cloudflare.com/workers/runtime-apis/request/).

## Correction and safeguards

Both adapters now specify `redirect: 'manual'` and reject every 3xx response explicitly as HTTP 502 before attempting JSON parsing. They never follow Location, forward it to the browser, or retry the redirected request. The OAuth token exchange also uses manual mode and explicit rejection, so client credentials/code cannot be forwarded through a redirect there either.

A real redirect returned by a write does not prove whether GitHub performed the write. The error instructs readback, and existing atomic-save recovery remains intact. A workerd regression simulates a successful atomic update followed by HTTP 307 and verifies authoritative readback recovers the save without a second mutation. Publication coordination, validation, authorization, scope, concurrency and credential configuration are unchanged.

## Real-runtime regression coverage

`editor-prototype/cloudflare-runtime.test.mjs` is included in the existing `npm run test:editor` glob, so the required validate workflow runs it without a workflow change. Pinned development-only Miniflare `4.20260730.0` / workerd `1.20260730.1` and esbuild `0.28.2` bundle and execute the actual Pages handler and local GitHub adapter. The stable emulator uses compatibility date `2026-07-30`; no deployed compatibility setting is changed or claimed verified.

All external traffic terminates at an in-memory GitHub fixture; these tests load no real credentials and perform no live network writes. Tests prove:

1. Native workerd rejects the old error mode before any outbound request (an intentional unsupported-mode control exists only in the test bundle).
2. Same/cross-host 301, 302, 303, 307 and 308 responses are rejected by both adapters, with exactly one API request and no redirected credential forwarding.
3. OAuth token redirects are rejected without sending credentials to a second endpoint.
4. Image listing, pending preparation, document/image atomic Save Draft and reopening/listing succeed through the real runtime.
5. A redirect after an atomic mutation is recovered by readback, without duplicate mutation.

Before the correction, the original handler's image-listing test failed with the exact runtime exception. Afterward all five runtime regressions pass. This checks runtime semantics, not Cloudflare Free CPU/subrequest certification. No production dependency versions changed; package-lock additions support the pinned test tooling and platform binaries.

## Read-only repository inspection

On 2026-11-19, the complete draft-ref inventory contained three drafts:

| Document | Current head | Last commit UTC | Retained new images |
| --- | --- | --- | ---: |
| `library/cms-publishing-test.mdx` | `5fe43d8` | 2026-11-19 01:14:49 | 0 |
| `library/geodata-pilot-workgroup-report.mdx` | `8a29030` | 2026-11-17 18:56:44 | 0 |
| `library/test-doc-today.mdx` | `82e025a` | 2026-11-17 19:03:39 | 1 |

All predate the 2026-11-19 source-release deployment. The retained test snapshot `fd2b062`, coordinator `90d87e4`, working revision `5fe43d8` and associated lock were read back and match their recorded SHAs. No refs were deleted, rewritten or retried. The pre-existing image is not evidence of a write by the failed attempt.

The failing invocation cannot have caused a GitHub mutation: its fetch failed before transmission, and image listing is read-only. This does not retrospectively certify unrelated successful requests or identify the editor's particular draft without its path/time. A separately successful pending preparation may still be in browser memory/recovery. Preserve those edits; no automatic retry/cleanup has been performed.

## Local validation

All **254 unit/API tests**, including five actual workerd regressions, and all **54 browser tests** pass. Configuration (1), render (2) and navigation (2) checks pass. Astro reports zero errors/warnings and four existing hints; the production build produces 171 pages with valid internal links. The diagnostic measurement patch remains unapplied. Actual hosted validation remains a separately authorized step after review; this change is committed locally only.
