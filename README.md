# PasaData

This checkout contains the Next.js foundation, fixed Zod contract, server extraction endpoint and single-image review workspace. Reviewed values can be downloaded as an Excel workbook.

Use Node.js 22.22.2+, 24.15.0+ (within their respective major versions), or 26+ and npm. The DOM test runner requires these versions:

```sh
npm ci
npm run dev
```

Required checks:

```sh
npm test
npm run lint
npm run typecheck
npm run build
```

`DOCUMENT_FIELDS` defines the nine export columns in order. `documentFieldsSchema` returns every field as `string | null`, normalizes omitted, undefined and whitespace-only values to `null`, and rejects unexpected keys or non-string values. Nonblank text is preserved, including leading zeroes in DNI and formatting in ingresos. Tests use synthetic values only.

Keep credentials and private interview data out of source control, tests and logs. Local environment and workflow data are ignored without being deleted. The canonical feature plan is `specs/handwritten-interview-export/spec.md`; the approved material design is `PasaDataDesign.pen`.

The server requires `GEMINI_TOKEN` in the project-root `.env` file, which Next.js loads into the server environment. Restart the development server after changing this value. Never use a `NEXT_PUBLIC_` credential. The `server-only` adapter sends one inline image to Google's `gemini-3.8-flash:generateContent` endpoint through an API-key header. It does not upload through Files API, write files, log interviews or store application records. Responses are not cached. Requests time out after 30 seconds; raw provider responses and errors never reach the client.

`POST /api/extract` accepts multipart form data containing exactly one `image` file, one `processingAcknowledged` string equal to `true`, and one `turnstileToken` string (1–2048 characters without surrounding whitespace). The client shows a notice that personal data in the image will be sent to Google before explicit submission. The acknowledgement is a request gate, not proof of account privacy settings or authentication. Only JPEG/PNG MIME types with matching signatures are accepted, from 1 through **3,000,000 bytes** (decimal 3 MB). Total multipart bytes are limited to 3,016,384 before parsing, regardless of Content-Length; use a short filename. Signature checks do not certify complete image decoding; invalid encoded content may be rejected by Google.

Success is HTTP 200 with `{ "fields": { ... } }`, containing the nine ordered keys and only strings or nulls. The provider must explicitly supply every key; missing, extra or incorrectly typed values fail extraction. Blank strings normalize to null; readable formatting is preserved. Instructions require uncertain/illegible content to stay null, but real handwriting accuracy still requires human evaluation. Failure is `{ "error": { "code": "...", "message": "..." } }` with no fields: invalid input/acknowledgement is 400, oversized input 413, missing server configuration 503, provider/network/invalid extraction 502, timeout 504. Every response uses `Cache-Control: no-store`. The client invalidates stale results after failures/replacement and permits export only after successful extraction and review.

Provider documentation checked on 2026-10-03: [stable model and supported inputs](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash), [generateContent REST API](https://ai.google.dev/api/generate-content), [inline image limits](https://ai.google.dev/gemini-api/docs/image-understanding), [structured outputs](https://ai.google.dev/gemini-api/docs/structured-output), and [data-use terms](https://ai.google.dev/gemini-api/terms). Google's unpaid services must not receive sensitive, confidential or personal information. Paid-service terms exclude prompts/responses from product improvement but permit limited safety logging. No zero-retention promise is made. Tests use synthetic in-memory byte arrays and mocked fetch only; no real interview or provider call has been verified.

Before processing real personal data or deploying, verify the actual project's active paid billing and applicable terms, retention, processing region, permissions, quotas, model availability and Vercel limits. The public endpoint now requires the server abuse controls below; the acknowledgement and image bounds alone do not provide these controls. Verify deployment-level protections before publishing. This task does not authorize publication or a live-provider test.

In the browser, choose or drop one JPEG/PNG up to 3,000,000 bytes, check the local preview and acknowledge the Google processing notice before selecting **Procesar imagen**. Successful processing opens nine editable, labeled text fields. Empty values remain blank with a text indicator and live count. Replacing the image or submitting an invalid replacement clears previous values; replacement/unmount aborts pending fetch and late responses are ignored. Object URLs are revoked when discarded. Values live only in component memory; no local/session storage is used. Server validation remains authoritative.

The responsive composition follows the approved `PasaDataDesign.pen` app frames: desktop upload/preview columns, three review columns and single-column mobile controls. Instrument Sans is bundled through Fontsource and served by the app; no remote font request is needed. DOM tests run in jsdom using Testing Library, synthetic in-memory files, simulated decode events and mocked fetch. They verify user interactions and race guards, not real image decoding, rendering dimensions or handwriting accuracy. No screenshots or design exports are produced.

Select **Descargar Excel** after reviewing the values. ExcelJS 4.4.0 loads only when exporting and prepares entrevista.xlsx locally with one Entrevista worksheet, the nine ordered contract headers and one interview row. Blank/whitespace values stay blank; DNI, income formatting and formula-like input remain literal text. Fields freeze during preparation; replacing the image or leaving the page discards late export results. Export failures keep reviewed edits and permit retry. The download confirmation means the browser received a download request, not that a file was saved. Temporary anchors and Blob URLs are cleaned up. Serialization tests load the generated workbook in memory; mocked DOM tests cannot verify a real browser download or Excel application compatibility.

## Gemini consumption protection

Extraction is disabled unless `EXTRACTION_ENABLED=true` and every protection setting is valid. The server checks configuration, bounded image input, Turnstile, and an atomic Redis reservation before its single Google request. Turnstile must return `success=true`, an allowed hostname and the exact action `extract`. Tokens are single-use: missing, duplicate, expired or replayed tokens cannot authorize another call. The image is never sent to Cloudflare. Transport errors, redirects, responses above 8192 bytes, five-second protection deadlines and ambiguous Redis replies block extraction. There are no automatic retries or refunds, including when Google fails, times out, or the visitor disconnects after reservation.

Configure these **server-only** settings in Vercel; all values below are placeholders. Do not commit credentials or use `NEXT_PUBLIC_` for any secret:

```text
GEMINI_TOKEN=<Google server API key>
EXTRACTION_ENABLED=true
TURNSTILE_SECRET_KEY=<Cloudflare Turnstile secret>
TURNSTILE_HOSTNAMES=<production hostname,optional approved preview hostname>
UPSTASH_REDIS_REST_URL=https://<database>.upstash.io
UPSTASH_REDIS_REST_TOKEN=<Redis REST token>
EXTRACTION_NAMESPACE=<stable production namespace, letters/numbers/underscore/hyphen, up to 64 characters>
EXTRACTION_IP_HMAC_SECRET=<random server secret, at least 32 characters>
```

Vercel supplies `VERCEL=1` and `VERCEL_ENV=production`, `preview` or `development`; do not manually impersonate this environment on a server exposed directly to clients. The route trusts only Vercel's overwritten `x-vercel-forwarded-for` header containing a single valid IP. Confirm this proxy model in the actual deployment, including any proxy before Vercel. Arbitrary `x-forwarded-for`, request bodies and missing/ambiguous IPs never authorize extraction. Local tests use synthetic Vercel metadata; there is no production bypass for local development.

The fixed global budget is **10 reserved attempts per calendar day in Buenos Aires (UTC−03:00)** for the entire application, with one reservation per IP every 60 seconds. Rotating IP or deploying another instance does not reset the global budget. Redis evaluates both limits in one Lua script immediately before Google. It checks its own clock against the application's daily window and rejects stale windows and corrupt values/types/expirations before writing. The daily key expires 48 hours after its day closes; IP HMAC keys expire after 60 seconds. Redis holds only these counts and HMAC identifiers, never clear IPs, images, extracted values or challenge tokens. Images and extracted data retain the privacy behavior described above.

Preserve the same Redis database, credentials and `EXTRACTION_NAMESPACE` across all deployments using this Google project/key. A namespace/database change or deletion of counters can reset the budget; HMAC rotation changes IP identities but does not reset the global daily key. Previews are disabled by default even if extraction is enabled. To deliberately enable a preview, set `EXTRACTION_PREVIEW_ENABLED=true`, allow its hostname in Turnstile and use the **same production Redis namespace/database**. Never create an extra preview budget for the same Google project. No external account setup is included in this change.

Failures contain only sanitized codes/messages with `Cache-Control: no-store`: `BOT_VERIFICATION` (400), `RATE_LIMITED` (429 with remaining seconds in `Retry-After`), `DAILY_LIMIT` (429 with seconds until daily reset), `EXTRACTION_DISABLED`, `CONFIGURATION`, and `PROTECTION_UNAVAILABLE` (503). Invalid image/body and Google failures keep their prior status/schema. A reservation may conservatively consume quota even when its Redis response times out or the process stops; retrying it would risk extra consumption.

To suspend new attempts, set `EXTRACTION_ENABLED=false` and redeploy/apply the environment change to every active deployment. Propagation is not instantaneous and requests already sent to Google can finish. For rollback, suspend extraction first and retain the protection boundary; reverting it while leaving a public endpoint active removes the budget. This is an attempt limit, not a token/dollar cap, and cannot meter direct use of a leaked key or other applications. A visitor who passes Turnstile may exhaust all ten attempts. Blocked requests can still consume hosting/protection resources. Verify Google project quotas and available project spending controls separately before production.

Configure `NEXT_PUBLIC_TURNSTILE_SITE_KEY=<Cloudflare public site key>` at **build time** for the browser widget. This public key is safe to expose; `TURNSTILE_SECRET_KEY` and every other credential above remain server-only. Use a Managed widget with approved hostnames and the server's action `extract`. Rebuild/redeploy after changing the public key. The browser loads the official script directly from `https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit`; CSP rules, if added, must allow Cloudflare's documented script/frame origins. Never proxy or cache this script.

Processing requires a decoded image, consent and a current challenge token. Each manual attempt consumes that token before the POST; failures require a fresh verification, with no automatic extraction retry. Expired challenges, failed script/widget loading and timeouts offer manual recovery. Replacing the photo or leaving the page removes the widget and invalidates late callbacks. Missing public configuration blocks submission. Cloudflare receives the challenge interaction, never the image. Server `Retry-After` controls the visible wait and prevents early submissions, including after replacing the photo; daily availability uses Buenos Aires time. Photo and consent remain available after processing failures. Review and Excel export do not require another challenge.

Unit tests use synthetic images, mocked Google/Turnstile/Upstash fetches and no live credentials. The optional Redis proof executes the exact exported production script on a real disposable process bound to loopback, with persistence disabled. It tests concurrent contenders after nine reservations, IP races, expiration and corrupt state; a skipped proof is not evidence of atomicity. Obtain the approved portable runtime (or an explicitly authorized compatible executable) and run:

```powershell
$env:EXTRACTION_TEST_REDIS_EXECUTABLE = '<absolute path to real redis-server executable>'
npm test -- src/server/extraction-protection.test.ts
Remove-Item Env:EXTRACTION_TEST_REDIS_EXECUTABLE
```

The test chooses an unused high port, uses a unique synthetic namespace, and stops only its own child process. An invalid executable fails the proof. Live Vercel, Turnstile and Upstash wiring remains an operational check before publication; local Redis proves script behavior, not account configuration.
