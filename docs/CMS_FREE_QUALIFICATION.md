# Cloudflare Free qualification — checkpoint 3

> Historical baseline measured before the [focused corrections](CMS_FREE_CORRECTIONS.md). Original results below remain unchanged as evidence. The harness now measures the checked-out application, so its current runs produce the corrected counts; use the recorded `78beb55` application tree to reproduce the baseline.

**Result: NO-GO for rollout.** This checkpoint changes diagnostics/documentation only. No application fixes, new infrastructure, live settings, production deployment, push, merge, PR creation or test-content writes were performed.

## Evidence and reproducibility

Candidate application: `78beb55` (includes `b1bbc57`, `d357034` and the separately committed advisory CODEOWNERS change). Fetched remote main remains `b2f6e6e`. Measurements were taken locally on Node v24.13.1 / darwin/arm64. See [raw results](CMS_FREE_QUALIFICATION_RESULTS.json).

Run from the repository root:

```sh
node scripts/qualify-cms-free.mjs --output /tmp/cms-free-qualification.json
node scripts/qualify-cms-free.mjs --filter "history-27|image-prepare-5MiB" --warm 5 --output /tmp/cms-free-focused.json
```

Every outgoing fetch is replaced with the existing in-memory GitHub model. Fixtures are assembled outside the measured process, transferred through temporary files, and removed afterward. No credentials are loaded and no network is used. The actual Pages `onRequest` handler is invoked, including session decryption, JSON parsing and response serialization. Each sample resets the Git graph; repeated samples do not accumulate saves. All cases have 168 other published documents and two other active drafts. The report contains 37 profiles and 111 measured invocations. OID-only GraphQL mock responses omit unrequested Blob text, matching real GitHub and avoiding artificial image decoding in the mock.

Fresh = separate Node process with fresh compiler/route caches, not an observed Cloudflare cold isolate. Warm = same process/module caches with a reset fixture. Module startup, fixture setup and synthetic OAuth/session setup are outside the timer. Node process CPU includes in-memory transport serialization/hashing and background/GC work; mock CPU is recorded separately but is not a reliable subtractable partition. Neither metric is Cloudflare CPU. Two warm samples describe a range, not a percentile. HTTP 200 in this harness does not enforce Cloudflare's 50-fetch cap.

The generated, deterministic PNGs are valid RGBA fixtures: 1 MiB at 500×500 and 5 MiB at 1000×1000, padded with a valid ancillary text chunk. No binary assets or test documents are committed. History N means N additional commits after the initial saved revision (N+1 saved revisions).

## Local measurements

| Operation/profile | Fetches fresh / warm | Node CPU ms fresh / warm range | Free request budget |
| --- | ---: | ---: | --- |
| reopen-small | 7 / 7 | 5.0 / 1.4–1.4 | Within 50; CPU unqualified |
| discovery-small | 10 / 10 | 7.2 / 2.4–3.0 | Within 50; CPU unqualified |
| save-small | 24 / 18 | 66.9 / 10.9–17.5 | Within 50; CPU unqualified |
| save-32KiB | 24 / 18 | 272.0 / 103.4–145.1 | Within 50; CPU unqualified |
| save-128KiB | 24 / 18 | 718.5 / 422.4–527.4 | Within 50; CPU unqualified |
| image-prepare-1MiB | 0 / 0 | 52.6 / 47.4–54.0 | Within 50; CPU unqualified |
| save-image-1MiB | 25 / 19 | 159.6 / 93.3–102.6 | Within 50; CPU unqualified |
| reopen-image-1MiB | 9 / 9 | 78.1 / 60.0–63.1 | Within 50; CPU unqualified |
| image-prepare-5MiB | 0 / 0 | 273.3 / 242.5–247.2 | Within 50; CPU unqualified |
| save-image-5MiB | 25 / 19 | 495.8 / 412.9–422.7 | Within 50; CPU unqualified |
| reopen-image-5MiB | 9 / 9 | 324.2 / 306.8–308.9 | Within 50; CPU unqualified |
| reopen-history-27 | 34 / 34 | 6.1 / 1.8–2.2 | Within 50; CPU unqualified |
| save-history-27 | 51 / 45 | 67.8 / 13.5–22.5 | **FAIL >50** |
| discovery-history-27 | 36 / 36 | 8.0 / 2.5–2.8 | Within 50; CPU unqualified |
| reopen-history-33 | 40 / 40 | 6.0 / 1.8–2.1 | Within 50; CPU unqualified |
| save-history-33 | 57 / 51 | 70.1 / 13.5–20.1 | **FAIL >50** |
| discovery-history-33 | 42 / 42 | 8.0 / 2.6–2.7 | Within 50; CPU unqualified |
| reopen-history-60 | 67 / 67 | 8.8 / 2.1–2.8 | **FAIL >50** |
| save-history-60 | 84 / 78 | 72.2 / 21.0–26.3 | **FAIL >50** |
| discovery-history-60 | 69 / 69 | 13.5 / 3.2–3.2 | **FAIL >50** |
| reopen-history-600 | 607 / 607 | 22.7 / 7.5–8.8 | **FAIL >50** |
| save-history-600 | 624 / 618 | 96.1 / 23.0–32.3 | **FAIL >50** |
| discovery-history-600 | 609 / 609 | 23.4 / 9.7–16.8 | **FAIL >50** |
| pr-prepare | 3 / 3 | 1.3 / 0.5–0.6 | Within 50; CPU unqualified |
| pr-create | 23 / 23 | 3.1 / 1.2–1.5 | Within 50; CPU unqualified |
| pr-status | 8 / 8 | 2.3 / 0.6–0.7 | Within 50; CPU unqualified |
| pr-create-history-600 | 23 / 23 | 18.1 / 1.1–1.4 | Within 50; CPU unqualified |
| pr-prepare-image-1MiB | 3 / 3 | 1.4 / 0.5–0.6 | Within 50; CPU unqualified |
| pr-create-image-1MiB | 24 / 24 | 3.4 / 1.1–1.5 | Within 50; CPU unqualified |
| pr-prepare-image-5MiB | 3 / 3 | 1.4 / 0.4–2.5 | Within 50; CPU unqualified |
| pr-create-image-5MiB | 24 / 24 | 3.4 / 1.6–9.1 | Within 50; CPU unqualified |
| pr-create-repeat | 18 / 18 | 2.8 / 1.0–1.2 | Within 50; CPU unqualified |
| pr-create-attempts-20 | 27 / 27 | 5.9 / 1.4–1.9 | Within 50; CPU unqualified |
| pr-status-attempts-20 | 9 / 9 | 3.0 / 1.2–1.3 | Within 50; CPU unqualified |
| pr-prepare-128KiB | 3 / 3 | 1.9 / 1.0–1.1 | Within 50; CPU unqualified |
| pr-create-128KiB | 23 / 23 | 4.0 / 1.8–2.0 | Within 50; CPU unqualified |
| repeat-save | 37 / 31 | 75.8 / 17.2–26.1 | Within 50; CPU unqualified |

### Blocking findings

- Save Draft with just 28 saved revisions requires **51 fetches cold / 45 warm**. With 34 revisions it requires **57 / 51**. At 61 revisions: reopen **67**, discovery **69**, Save Draft **84 / 78**. At 601 revisions: **607**, **609**, **624 / 618** respectively. The active-draft inspector fetches ancestral commits individually; these paths are not covered by the publication client's 40-request cap. A longer draft also affects list refresh after a save to another page.
- PR preparation remains **3**, PR creation **23** (**24** with an image), and status **8** calls in these fixtures. PR creation with a 601-revision draft remains 23. Repeating creation uses **18**; creating attempt 21 uses **27**, and status with 20 retained attempts uses **9**. Candidate correctness still depends on the complete independent CI gate.
- Local CPU is concerning even where network counts fit: see exact large-document/image values above. Image preparation has **zero outbound calls and zero mock-transport CPU**; its local costs therefore identify real handler work, but still do not measure Cloudflare. The 10 ms allowance must not be assessed from Node timings, browser latency, `performance.now()`, or a successful HTTP result.
- For the 28-revision cold Save Draft, the first disallowed call (51) is the atomic `CMSSaveDraft` mutation. At 34 revisions the warm save reaches the same mutation at call 51; the cold path reaches call 51 during `CMSRoutes`. Longer-history reopen/discovery exceed the limit while reading individual commits. These are model traces, not observed Cloudflare failures.
- No application optimization was made in response. The measured request overruns must be reviewed before proposing or authorizing a fix.

### Live read-only policy finding

The real application policy verifier currently returns **403**, because the GitHub protection response has **no `required_pull_request_reviews` field**. `validate` and `cms-publication-scope` remain strict and GitHub-Actions-bound; administrators are enforced, force pushes/deletion are disabled, and effective rulesets are empty. Inspect the dashboard's Require a pull request before merging setting and its zero-approval representation. Do not relax the verifier or change settings automatically. The current response differs from the earlier audit.

The repository API currently reports Colleen as **admin**, not merely write. This does not verify her actual editor OAuth grant. No repository permission change is proposed. All four retained test refs match their original SHAs.

## Actual Cloudflare measurements

**None collected for this candidate.** The committed application has not been deployed. Current gin-editor production runs older code and its metrics cannot qualify this revision. No new project, preview exception or OAuth App is proposed.

Pages exposes aggregate subrequest counts and sampled CPU quantiles, with aggregation delay; errored subrequests may not be included. Pages live logs do not persist. Workers Logs/Logpush should not be assumed available on Pages. See [Pages metrics](https://developers.cloudflare.com/pages/functions/metrics/), [Pages logging](https://developers.cloudflare.com/pages/functions/debugging-and-logging/), and [product comparison](https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/).

A **non-applied**, temporary [diagnostic patch](CMS_FREE_QUALIFICATION_DIAGNOSTICS.patch) is prepared solely for a later authorized qualification deployment. `git apply --check docs/CMS_FREE_QUALIFICATION_DIAGNOSTICS.patch` validates it locally. It records module ID/first invocation, safe case tag, method/path, response status, outgoing GitHub fetch attempts and wall time. It does not log content, tokens, cookies or authorization headers, and does not infer CPU from wall time. It uses request-scoped counters, not a globally replaced fetch in Cloudflare. For these content/image/publication routes all external fetches go through that counter; OAuth callbacks are explicitly outside this measurement scope. Redirects already fail closed.

Do not apply/deploy this patch without authorization. It adds no storage binding or infrastructure and must be removed after qualification. It is separate from the normal candidate: instrumented CPU includes logging overhead and needs confirmation against the uninstrumented build too.

### Reproducible hosted capture after authorization

1. Pause other editor traffic. Record main SHA, deployed CF SHA, Free-plan confirmation, compatibility settings, UTC time window, case tag, document/head/image sizes, and the preserved-ref manifest. Keep normal preview origin rejection. No separate preview host can authenticate under the current origin policy.
2. A later **canonical gin-editor deployment is required** to measure this code without new infrastructure or OAuth changes. This is not authorized now. Keep PR creation disabled except during its explicitly authorized test window. Save Draft itself writes GitHub, so test content/image writes need approval independently of the Publish flag.
3. Stream deployment logs before testing; retain only whitelisted probe fields and outcomes. Run one operation/profile at a time using the signed-in browser with a unique `?qualification=case-id` tag. Normal UI actions can cause several separate API invocations (e.g. PUT save followed by GET list); record each, not their sum as one invocation. Pending-image POST and the later PUT containing the upload are distinct measurements.
4. Collect observed first-module calls and repeated same-module calls separately. A new URL/query, cache bypass, browser reload, or idle wait does **not** prove cold execution. Record module ID/first flag; if cold samples cannot be obtained, mark that coverage unverified. Existing cookies can survive deployment; a static same-origin tab can send the first measured API call without warming through a login/page-load sequence. Other API traffic may invalidate that attempt.
5. Capture at least 30 warm trials per supported profile and explicit observed cold coverage for each critical operation. Repeat with normal prose, the 32/128 KiB document fixtures, 1/5 MiB PNGs, current realistic inventory, multiple editing cycles, and longer histories. For cases already known to exceed 50 locally, do not run live write probes until the blocker is resolved; begin only with separately authorized reads or local reproduction.
6. In gin-editor → Functions Metrics, select the exact test window and export available CPU quantiles, request/error/invocation statuses and subrequests after aggregation settles. Record sampling/quantile availability and missing values. A low median, total subrequests divided by requests, or absent exception is not an observed per-request maximum. The per-call diagnostic count supplies the outbound-call distribution; platform CPU remains the dashboard measurement. If required CPU data/coverage is unavailable, qualification remains incomplete.
7. The module-first log marks API-module coldness, not a guarantee about every platform startup component. Tail logs may be absent on resource termination. Match outcomes/CF-Ray/time windows; never discard a failed invocation because its final diagnostic line is absent. Publish wall time only as latency. Preserve all negative results.

Safe log projection (requires jq; no raw request headers/HAR should be saved):

```sh
wrangler pages deployment tail <DEPLOYMENT_ID> --project-name gin-editor --environment production --format json |
  jq -c --unbuffered '{outcome, eventTimestamp, status: .event.response.status, probes: [.logs[]?.message[]? | fromjson? | select(.type == "cms-free-qualification") | {type,moduleId,moduleFirst,tag,path,method,cfRay,status,externalFetches,wallMs}]}' > /tmp/cms-free-safe-tail.jsonl
```

The flags above match the current [Pages Wrangler reference](https://developers.cloudflare.com/workers/wrangler/commands/pages/); check the installed version before use. Do not add a deployable root Wrangler file. Do not enable Workers-only observability bindings as a substitute for missing Pages measurements. Raw tail/HAR data can contain session credentials; the projection intentionally drops headers and exception bodies.

## Local checks

The qualification harness completed all 111 invocations with expected HTTP 200/201 responses; over-budget cases remain failed qualification despite the mock accepting them. `npm run test:editor`: **238 passed**, no skipped or failed tests. Diagnostic script syntax, non-applied patch applicability and safe tail-log projection passed. The unchanged trusted-main source checker also accepted the complete local 46-file release diff (including these five diagnostics/documentation files) through a read-only Git-object fixture. That is local source-policy evidence, not a live Actions result. No application/browser/workflow files were changed, so the full browser/Astro/build/navigation suite from checkpoint 2 was not rerun for these diagnostics-only additions.

## Limits review

The exact new limits/messages remain in [checkpoint 1 review](CMS_PR_ONLY_REVIEW.md). Ordinary workflows may hit them as follows:

- **40 requests** applies only to publication prepare/create/status; Save Draft/reopen/discovery have no equivalent cap and already overrun 50 under realistic repeated saves.
- **1,000,000 code units** is a rejection limit, not evidence that a near-limit document fits CPU/memory. A 32/128 KiB document is well below it yet expensive locally. GitHub truncation may reject earlier, especially for multibyte text.
- **100 retained/proposed assets** can be reached through cumulative uploads across saves, even if most are no longer referenced. New editing cycles retain unpublished uploads. No deletion/cleanup is authorized to get below the limit.
- **250,000 serialized history code units / 100 publication attempts** concern coordinator retries, not document Save Draft history. Large main commit messages can consume the size budget. New publication cycles get separate coordinators, but repeated stale/closed attempts still accumulate.
- **299 open main PRs** is unlikely for this team but includes ordinary PRs too. Exactly 300 fails completeness.
- Existing **1,000 draft commits / 5,000 discovered refs** are integrity bounds, not hosted capacity promises: measured request failure occurs far earlier. Existing image bounds are **5 MiB each**, **20 pending uploads**, and **20,000,000 base64 characters per save** (message says 15 MB); cumulative active assets can exceed those per-save counts.

No caps were raised, no validation was skipped, and no historical state was cleaned up. See [release checklist](CMS_FREE_RELEASE_CHECKLIST.md) for the conditional rollout sequence.
