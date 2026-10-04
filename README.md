# PasaData

This checkout contains the Next.js foundation, fixed Zod contract and TASK-002 server extraction endpoint. The current page is a temporary placeholder. Browser image selection, review controls and Excel export are not implemented yet.

Use Node.js 22.12 or newer and npm:

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

The server requires `GEMINI_API_KEY` in its environment. Never use a `NEXT_PUBLIC_` credential. The `server-only` adapter sends one inline image to Google's `gemini-3.8-flash:generateContent` endpoint through an API-key header. It does not upload through Files API, write files, log interviews or store application records. Responses are not cached. Requests time out after 30 seconds; raw provider responses and errors never reach the client.

`POST /api/extract` accepts multipart form data containing exactly one `image` file and one `processingAcknowledged` string equal to `true`. The future client must show a notice that personal data in the image will be sent to Google before explicit submission. The acknowledgement is a request gate, not proof of account privacy settings or authentication. Only JPEG/PNG MIME types with matching signatures are accepted, from 1 through **3,000,000 bytes** (decimal 3 MB). Total multipart bytes are limited to 3,016,384 before parsing, regardless of Content-Length; use a short filename. Signature checks do not certify complete image decoding; invalid encoded content may be rejected by Google.

Success is HTTP 200 with `{ "fields": { ... } }`, containing the nine ordered keys and only strings or nulls. The provider must explicitly supply every key; missing, extra or incorrectly typed values fail extraction. Blank strings normalize to null; readable formatting is preserved. Instructions require uncertain/illegible content to stay null, but real handwriting accuracy still requires human evaluation. Failure is `{ "error": { "code": "...", "message": "..." } }` with no fields: invalid input/acknowledgement is 400, oversized input 413, missing server configuration 503, provider/network/invalid extraction 502, timeout 504. Every response uses `Cache-Control: no-store`. The future client must invalidate stale results after failures/replacement and permit export only after successful extraction and review.

Provider documentation checked on 2026-10-03: [stable model and supported inputs](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash), [generateContent REST API](https://ai.google.dev/api/generate-content), [inline image limits](https://ai.google.dev/gemini-api/docs/image-understanding), [structured outputs](https://ai.google.dev/gemini-api/docs/structured-output), and [data-use terms](https://ai.google.dev/gemini-api/terms). Google's unpaid services must not receive sensitive, confidential or personal information. Paid-service terms exclude prompts/responses from product improvement but permit limited safety logging. No zero-retention promise is made. Tests use synthetic in-memory byte arrays and mocked fetch only; no real interview or provider call has been verified.

Before processing real personal data or deploying, verify the actual project's active paid billing and applicable terms, retention, processing region, permissions, quotas, model availability and Vercel limits. The unauthenticated paid endpoint still needs deployment-level abuse/cost controls; the acknowledgement and per-request size bounds do not provide these controls. This task does not authorize publication or a live-provider test.
