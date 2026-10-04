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

`POST /api/extract` accepts multipart form data containing exactly one `image` file and one `processingAcknowledged` string equal to `true`. The client shows a notice that personal data in the image will be sent to Google before explicit submission. The acknowledgement is a request gate, not proof of account privacy settings or authentication. Only JPEG/PNG MIME types with matching signatures are accepted, from 1 through **3,000,000 bytes** (decimal 3 MB). Total multipart bytes are limited to 3,016,384 before parsing, regardless of Content-Length; use a short filename. Signature checks do not certify complete image decoding; invalid encoded content may be rejected by Google.

Success is HTTP 200 with `{ "fields": { ... } }`, containing the nine ordered keys and only strings or nulls. The provider must explicitly supply every key; missing, extra or incorrectly typed values fail extraction. Blank strings normalize to null; readable formatting is preserved. Instructions require uncertain/illegible content to stay null, but real handwriting accuracy still requires human evaluation. Failure is `{ "error": { "code": "...", "message": "..." } }` with no fields: invalid input/acknowledgement is 400, oversized input 413, missing server configuration 503, provider/network/invalid extraction 502, timeout 504. Every response uses `Cache-Control: no-store`. The client invalidates stale results after failures/replacement and permits export only after successful extraction and review.

Provider documentation checked on 2026-10-03: [stable model and supported inputs](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash), [generateContent REST API](https://ai.google.dev/api/generate-content), [inline image limits](https://ai.google.dev/gemini-api/docs/image-understanding), [structured outputs](https://ai.google.dev/gemini-api/docs/structured-output), and [data-use terms](https://ai.google.dev/gemini-api/terms). Google's unpaid services must not receive sensitive, confidential or personal information. Paid-service terms exclude prompts/responses from product improvement but permit limited safety logging. No zero-retention promise is made. Tests use synthetic in-memory byte arrays and mocked fetch only; no real interview or provider call has been verified.

Before processing real personal data or deploying, verify the actual project's active paid billing and applicable terms, retention, processing region, permissions, quotas, model availability and Vercel limits. The unauthenticated paid endpoint still needs deployment-level abuse/cost controls; the acknowledgement and per-request size bounds do not provide these controls. This task does not authorize publication or a live-provider test.

In the browser, choose or drop one JPEG/PNG up to 3,000,000 bytes, check the local preview and acknowledge the Google processing notice before selecting **Procesar imagen**. Successful processing opens nine editable, labeled text fields. Empty values remain blank with a text indicator and live count. Replacing the image or submitting an invalid replacement clears previous values; replacement/unmount aborts pending fetch and late responses are ignored. Object URLs are revoked when discarded. Values live only in component memory; no local/session storage is used. Server validation remains authoritative.

The responsive composition follows the approved `PasaDataDesign.pen` app frames: desktop upload/preview columns, three review columns and single-column mobile controls. Instrument Sans is bundled through Fontsource and served by the app; no remote font request is needed. DOM tests run in jsdom using Testing Library, synthetic in-memory files, simulated decode events and mocked fetch. They verify user interactions and race guards, not real image decoding, rendering dimensions or handwriting accuracy. No screenshots or design exports are produced.

Select **Descargar Excel** after reviewing the values. ExcelJS 4.4.0 loads only when exporting and prepares entrevista.xlsx locally with one Entrevista worksheet, the nine ordered contract headers and one interview row. Blank/whitespace values stay blank; DNI, income formatting and formula-like input remain literal text. Fields freeze during preparation; replacing the image or leaving the page discards late export results. Export failures keep reviewed edits and permit retry. The download confirmation means the browser received a download request, not that a file was saved. Temporary anchors and Blob URLs are cleaned up. Serialization tests load the generated workbook in memory; mocked DOM tests cannot verify a real browser download or Excel application compatibility.
