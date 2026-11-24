# Editor API contract and parity review

The local Node handler and hosted Cloudflare handler share content, draft, and
publication operations while retaining separate HTTP and authentication handling.
Paired contracts cover valid requests and corrected parsing, encoding, preflight,
and method-validation boundaries. Overall request-envelope limit harmonization
remains deferred; the existing local limit and hosted parsing behavior are unchanged.

## Endpoint inventory

All paths below are relative to the API origin. `area` must be an enabled key in
`CONTENT_AREAS`; `file` is a validated, possibly nested `.md` or `.mdx` filename.
Hosted content/image/publication routes require a valid session. Local routes
use the server's configured token. Hosted mutations additionally require an
exact same-origin `Origin` header.

| Endpoint and method | Inputs and shared operation | Successful response | Differences |
| --- | --- | --- | --- |
| `GET /api/session` | Local synthetic identity; hosted encrypted cookie and current allowlist | 200 `{ authenticated, login, workspace }`; hosted unauthenticated response is `{ authenticated: false }` | Local always reports authenticated without probing GitHub. Hosted clears missing/expired sessions and supplies the actual login. |
| `GET /api/auth/login` | Hosted optional `returnTo`; state, PKCE, OAuth configuration | Hosted 302 to GitHub; temporary cookies | Intentionally absent locally: 404. |
| `GET /api/auth/callback` | Hosted `code`, `state` or OAuth `error`; temporary cookies | Hosted 302 to a validated editor return path, encrypted session cookie | Intentionally absent locally: 404. |
| `POST /api/auth/logout` | No body required | 200 `{ ok: true }` | Hosted clears the session cookie. Local does not revoke its token or synthetic session. |
| `OPTIONS /api/*` | Local CORS preflight and allowed Origin | Local 204, allowed methods/headers | Hosted has no CORS/preflight implementation; it is a same-origin API. Origin-less local requests receive 204 without an allow-origin response header. |
| `GET /api/content` | `CONTENT_AREAS` | 200 `{ areas }` | Both reject unsupported methods with 405 and `Allow: GET`. |
| `GET /api/content/:area` | `discoverContent(area)` | 200 provisional inventory: `entries`, discovery/main identity and any warnings | Local has a `listContent` fallback for injected clients without discovery; the normal local client supports discovery. Lists are not authoritative document verification. |
| `POST /api/content/posts` or `/updates` | `saveBlog` or `saveProgramUpdate`; creation fields below | 201 saved article, document/commit identity, parsed metadata, optional replay information | Supported equally. Other areas do not have collection POST creation; they create through PUT to a filename. |
| `GET /api/content/:area/:file` | `getContent`, then `parsePage` or `parseProgramUpdate`, plus `contentVisibility` | 200 source/document identity, parsed fields, metadata and visibility; updates can include conversion information | Supported equally. |
| `PUT /api/content/:area/:file` | Shared area serializer, authoritative source lookup, `validateDocument`, draft save | 200 saved document and commit identity plus parsed fields | New general pages may be created this way. Existing posts/updates require `sha`; new articles use collection POST. |
| `GET /api/images` | Optional `area`, `filename`; `listImages` | 200 `{ images: [{ path, name, sha }] }` | Supported equally. Scoped listing verifies that document's saved draft. |
| `GET /api/images/file/:path` | Validated repository image path; `getImage` | 200 binary bytes, image MIME type, `Cache-Control: private, max-age=300` | Hosted also sets `X-Content-Type-Options: nosniff`; local adds CORS for allowed origins. |
| `POST /api/images` | `area`, `documentFilename`, `filename`, `mimeType`, base64 `content`; shared image validation/preparation | 201 `{ path, filename, mimeType, content }` | Preparation makes no GitHub write. Both require base64 text and use the existing shared decoder; malformed encoding returns 400. |
| `GET /api/publish/:area/:file` | `getPublicationStatus` | 200 publication state and applicable request identities/details | Available with publication flags disabled; does not authorize merging. |
| `POST /api/publish/:area/:file` | Dispatch precedence: `autoMerge` present, otherwise `initialize === true`, otherwise `prepare === true`, otherwise submit | 200 operation-specific result, described below | Shared domain calls and feature gates align; disabled-publication error wording differs. |
| `GET /api/publication-status/:area/:file` | Optional `mergeHead`, `snapshotHead`; `getWebsiteInfo` | 200 website/deployment evidence, main visibility, unpublish capability and auto-merge availability | Both return 405 with `Allow: GET` for unsupported methods on a valid document route. |

### Save request fields and validation

Both handlers pass parsed objects to the same domain modules rather than defining
independent document schemas:

- Editable fields include `title`, `description`, `body`, `date`, `excerpt`,
  `authors`, `tags`, `cover`, and `metadata`, subject to the area's conventions.
  `metadata` supports `year`, `committee`, `lead`, `members`, `dates_active`,
  `sidebar`, `tableOfContents`, `template`, `hidePageTitle`, `pagefind`, `banner`,
  and `head`, with validation and protected-value restrictions.
- `sha`, `head`, and optional `resumeHead` identify the loaded document/revision
  and publication continuation. Stale identities return 409. Browser-supplied
  `originalContent` does not replace authoritative repository source.
- `assets` contains pending image descriptors. Shared storage validates ownership,
  digest, references, individual size, aggregate size, and count. Only referenced
  new uploads enter Git. An upload prepared for another draft cannot simply be
  referenced from a different document.
- Article creation accepts `creationId`, `creationFilename`, `creationRetry`, and
  `suggestedFilename`. Safe retries preserve the original creation identity;
  collision errors can add `suggestedFilename` and `creationState`.
- Updates additionally accept `convertProgramUpdate === true`. Unsupported source
  stays protected; conversion is explicit rather than inferred from opening.
- `draft` is accepted by serializers but Save Draft preserves existing publication
  visibility and makes new documents drafts. It is not an alternate publish API.
  Legacy page fields do not bypass the shared draft/publication protocol.

Required request bodies must be JSON objects, excluding null, arrays, and scalar
values. Empty or malformed JSON and malformed encoding in document/image paths
return 400. These checks run after the existing hosted session/origin gates.

Ordinary domain validation errors generally return 400; missing content is 404;
write authorization failures are 403; stale/conflicting state is 409; image or
pending-image limits can return 413; incomplete upstream evidence can return 503.
Upstream GitHub statuses are also propagated. Unexpected internal failures remain
500: only exceptions at JSON parsing or URL decoding boundaries are classified
as client errors.

### Publication inputs and flags

| Operation on publication POST | Inputs | Shared call and result | Gates |
| --- | --- | --- | --- |
| Prepare | `head`, optional `action`, `prepare: true` | `preparePublication`; immutable saved content/assets and selected head | `CMS_PUBLISH_ENABLED === 'true'`; unpublish additionally needs its flag and main capability. Read-only with respect to GitHub state. |
| Submit | `head`, optional `action`, `candidate` | `publishContent`; publication state and PR/snapshot identities | Same publish/unpublish gates plus domain authorization, policy, scope and identity verification. |
| Initialize unpublish | `action: 'unpublish'`, `initialize: true`, `expectedSha`, `expectedHead`, optional `resumeHead` | `initializeUnpublish`; `{ head, document }` | Same unpublish gates. Copies authoritative saved bytes and preserves concurrent work; does not itself create a PR. |
| Authorize automatic completion | Boolean `autoMerge: true`, `head`, `snapshotHead`, optional `action` | `setPublicationAutoMerge`; verified publication state | Both publish and auto-merge flags; unpublish also needs the unpublish gate. |
| Cancel automatic completion | Boolean `autoMerge: false`, same immutable identities | Same call with `enabled: false` | Cancellation remains possible with all publication flags disabled; authentication, origin and domain checks remain. |

Only the exact string `true` enables flags. `action` defaults through the shared
publication implementation to publish; unpublish is explicitly action-bound.
`autoMerge` must be a boolean. A preparation/status read never authorizes merging.
The `publishing` properties in the content-area catalog do not replace these gates.

## Intentional security and runtime differences

| Boundary | Local Node gateway | Hosted Cloudflare API |
| --- | --- | --- |
| Credentials | `GITHUB_TOKEN` stays on the server; one client/store is reused | OAuth user token stays inside an encrypted, HttpOnly, Secure session cookie; a fresh store is created for each content/image invocation |
| Identity and permission | `/session` says `local development`; actual domain writes check token push permission | Login verifies GitHub identity and push access; authenticated requests recheck the allowlist, and actual domain writes recheck repository permission |
| Expiration and renewal | No application session expiry or OAuth renewal; update the token/server configuration when necessary | Fixed eight-hour expiry, no sliding renewal on session reads. Expired content calls return 401; `/session` returns 200 unauthenticated and clears the cookie. Renewal requires sign-in again. |
| Sign-out | UI response only; token remains configured | Browser cookie is cleared. Logout does not revoke the OAuth token at GitHub or implement a server-side revocation list. |
| Origin controls | Binds to `127.0.0.1`; allows the two port-4321 development origins and optional configured origin. Origin-less CLI requests are permitted. | Actual request URL must equal the configured canonical HTTPS origin before OAuth/body parsing. Mutations require an exactly matching Origin header. Forwarded headers cannot select the host. |
| CORS | Explicit allowed-origin responses and OPTIONS handling | Same-origin operation; no cross-origin access is added for parity |
| OAuth CSRF/return paths | Not implemented locally | PKCE/state; ten-minute temporary cookies; same-origin editor-only return paths; session cookie uses SameSite Strict |
| Errors and headers | JSON error fields and no-store responses; no sign-in URL | Adds `signInUrl` for authentication/OAuth errors, clears invalid sessions, adds nosniff. OAuth can return escaped HTML errors for browser navigation with a restrictive CSP. |

An existing hosted session is not a live GitHub-permission probe: a revoked token
can still appear authenticated until an upstream operation rejects it. This does
not authorize a draft save without the domain permission check. Image POST is
preparation only, so it does not need to perform a GitHub write authorization.
These distinctions should be preserved, not removed to make the environments identical.

### Environment configuration

| Purpose | Local | Hosted |
| --- | --- | --- |
| Repository | `PROJECT_EDITOR_OWNER`, `PROJECT_EDITOR_REPO` | `GITHUB_OWNER`, `GITHUB_REPO` |
| Authentication | `GITHUB_TOKEN` | `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `SESSION_SECRET`, optional `ALLOWED_GITHUB_USERS` |
| Origin/port | `PROJECT_EDITOR_ORIGIN`, `PROJECT_EDITOR_PORT` (default 8787); bind host remains loopback | Required canonical HTTPS `EDITOR_ORIGIN` |
| Publication | Three `CMS_*_ENABLED` process variables | Same three runtime bindings |

Both default to `geobtaa/geobtaa.github.io` and use the same workspace suffix
`#cms-drafts-v1`. Local startup configuration is loaded by the npm editor command
from `.env.local`; hosted settings belong to the Cloudflare project. Custom
repository configuration was inspected in source; the paired contracts use the
default mock repository rather than a live alternate repository.

## Request boundary guarantees

### Streamed local JSON

The [local reader](../../editor/server.mjs#L36) uses a streaming UTF-8 decoder,
so characters split across IncomingMessage Buffer chunks survive unchanged.
The 28,000,000 JavaScript string-code-unit limit is retained during accumulation
and after decoder flush; it has not been replaced by a byte-based limit.
Legacy test doubles that supply complete strings continue to work.

JSON syntax errors are converted to 400 only around `JSON.parse`. Stream failures
and later domain errors are not caught by that parser-specific classification.
The [hosted reader](../../functions/api/[[path]].js#L195) similarly classifies
only syntax failures from the incoming request's JSON parsing. Neither reader
accepts a null, array, or scalar root value for body-consuming endpoints.

### Local preflight

The [local OPTIONS handler](../../editor/server.mjs#L61) runs inside the error
boundary and omits `Access-Control-Allow-Origin` when no Origin is provided.
Allowed origins still receive the existing CORS response. Disallowed origins
still receive 403 before dispatch. Real local HTTP and Node header-validation
tests verify that an Origin-less preflight returns a valid 204 response.
The hosted API remains same-origin and does not gain CORS handling.

### Image encoding and path validation

Both image POST handlers require string `content` and use the existing
`decodeBytes` decoder from `draftStorage.mjs`. Standard base64 with valid optional
padding and whitespace is accepted; invalid characters, invalid padding, and
invalid lengths return 400. Data URLs and URL-safe base64 are not accepted as
image payload encodings. Signature, MIME, size, and document-ownership validation
still run afterward. Empty decoded images return 400.

The existing [content path validator](../../editor/contentAreas.mjs#L26) and
[image path validator](../../editor/imageAssets.mjs#L11) classify malformed
percent encoding directly around `decodeURIComponent`. There is no blanket
conversion of URI errors thrown elsewhere in an operation. Traversal and
extension restrictions are unchanged.

### Method and error semantics

After the existing origin/authentication gates, the following resource routes
return 405 with the corresponding `Allow` header for unsupported methods:

| Resource | Allow |
| --- | --- |
| `/api/content` | `GET` |
| `/api/content/posts`, `/api/content/updates` | `GET, POST` |
| Other enabled content-area collections | `GET` |
| `/api/content/:area/:file` | `GET, PUT` |
| `/api/images` | `GET, POST` |
| `/api/images/file/:path` | `GET` |
| `/api/publish/:area/:file` | `GET, POST` |
| `/api/publication-status/:area/:file` | `GET` |

Unknown routes remain 404 after any required authentication. Invalid document
selection on a publication route remains 400. OAuth/session dispatch is unchanged;
local OPTIONS retains its separate CORS handling. Disabled-publication error
wording still differs without changing its gates or status.

Regressions exercise internal `SyntaxError`, `URIError`, and `TypeError` failures
after valid input parsing and require 500 responses. Malformed input is rejected
without changing GitHub refs. A 400 response therefore does not hide unexpected
GitHub or domain failures.

## Deferred envelope limit assessment

### Hosted parsing has no matching application envelope limit

**Retained boundary difference; not corrected by this change.**
The local reader rejects strings exceeding 28,000,000 JavaScript string code
units with 413. Hosted `request.json()` has no equivalent handler-level guard.
A mock request containing 28,000,001 spaces followed by `{}` is rejected locally
with 413; hosted parsing completes and image validation returns 400 afterward.
Shared 5 MiB image and pending-asset limits still apply, but only after parsing.

A separate assessment should choose a documented byte-based envelope bound
before changing either runtime. Platform-specific limits may also apply; this
local test does not establish deployed Cloudflare capacity or demonstrate a
hosted outage.

## Test coverage and interpretation

[API parity tests](../../editor/api-parity.test.mjs) add shared expectations for
catalog/list/document/image reads, authoritative saves, stale conflicts,
protected source, image validation and ownership, article replay, publication
flags, read-only preparation, automatic authorization/cancellation, and unpublish
initialization. Separate tests exercise intentional origin/session/logout differences.
The former defect characterizations now assert the same corrected behavior in
both implementations. The one retained `review reproduction` test documents the
deferred envelope-limit difference and must not be read as a harmonized limit.

[Real-runtime tests](../../editor/cloudflare-runtime.test.mjs) now also verify a
split UTF-8 body through workerd, 400 responses for malformed input and encoding,
and 405 method handling with an Allow header.
Existing suites already cover cross-area metadata, Program Update conversion,
OAuth state/PKCE/cookies and failure paths, canonical-host rejection, allowlist
changes, expired sessions, redirect rejection, uncertain writes, and publication
identity/policy. These should remain complementary to shared transport contracts.

Run:

```sh
node --test editor/api-parity.test.mjs editor/cloudflare-runtime.test.mjs
npm run test:editor
```

All GitHub operations in these tests terminate in in-memory fixtures. No live
repository writes, publications, OAuth exchanges, or deployments were performed.
Local/mock success does not qualify live OAuth, intended-account permissions,
custom hosting configuration, or platform capacity.

## Maintenance recommendation

Keep the handlers separate. The boundary defects were corrected through
small parsing, validation, and method-handling changes with paired tests. Shared
serializers/storage already own the complex domain behavior. Consolidating
routing is unnecessary to address these findings and would add risk around
intentional authentication and runtime boundaries.
