# Handwritten interview extraction and Excel export

## Identity and current state

Feature ID: handwritten-interview-export. Canonical locator: `specs/handwritten-interview-export/spec.md`.
Repository/integration root: `E:\Freelance\PasaData`; branch `feature/handwritten-interview-export`; verified HEAD/base `858b836373d833729c178648d01641b71df69ed3`. Feature state: BLOCKED. Document revision: DOC-7. Plan revision: PLAN-1 (approved).
Engram topic: `odd/handwritten-interview-export/tasks`; full mirror pending because Engram tools are unavailable in this session. Linear: not activated or synchronized. Next action: obtain an invocation route actually bound to the prepared TASK-001 worktree before any source writes.

## Intent, criteria and approved approach

Goal: test whether one real photograph of handwritten interview notes can be extracted into reliable structured values, corrected by a person, and exported as one `.xlsx` file. The application is stateless: no authentication, database, history, application-owned image or record persistence, cloud storage, multi-image flow, custom Excel templates, roles, or administration. Future custom-template detection and mapping are outside this release; the fixed ordered field contract is the only current extension seam.

The user confirmed `TECH-Q1`: Next.js, TypeScript, App Router, Zod, Vercel, initial Gemini Flash, and browser-side ExcelJS. The user confirmed `DISC-Q1`–`DISC-Q4`: one worksheet, one interview data row, nine columns in this order: `nombre`, `apellido`, `dni`, `estadoCivil`, `domicilio`, `situacionLaboral`, `ingresos`, `motivoSolicitud`, `observaciones`. Illegible or uncertain values stay empty and visibly flagged; after review, empty values may be exported as blank cells. Failed upload or processing does not permit export. External provider processing is allowed with advance notice and without application-owned persistence; provider retention and data-use conditions remain unverified. No real personal data belongs in this document, tests, logs, or tracking systems.

Acceptance criteria:
- AC-001: Selecting one supported image displays its preview before extraction; replacement invalidates the previous result.
- AC-002: Explicit submission processes exactly that image through a server-held credential and returns only the nine agreed fields, validated against the fixed schema.
- AC-003: Unreadable or uncertain values are empty, not guessed; invalid provider data cannot silently become an exportable result.
- AC-004: Successful extraction displays all nine editable fields; current user edits supply exported values.
- AC-005: After review, download an `.xlsx` workbook with exactly one worksheet, nine ordered headers, and one interview data row.
- AC-006: Empty fields are visibly indicated and remain blank in the downloadable workbook; they do not block export after review.
- AC-007: Invalid image, provider failure, and malformed extraction have actionable error states and do not allow export of stale or failed results.
- AC-008: No authentication, database, history, stored interview/image, multiple images, template upload, or administrative controls are introduced.
- AC-009: Before external processing, show notice that an image containing personal data is sent to the provider; verify actual provider retention/data-use terms before production deployment. Do not promise zero retention without evidence.

Proposed technical approach, pending approval: browser-only image preview and editable form; single Next.js server route validates the image and sends it to a narrow Gemini adapter; Zod validates a nine-key `string | null` contract; ExcelJS is imported only when exporting client-side. Keep `dni` and `ingresos` as strings to preserve source formatting. Avoid storing private image bytes or extracted values, including in server logs. Validate formats, signatures, size and failures on the server; exact supported types/size and model ID require verification. Use synthetic test values. Rollback is by cohesive work-unit commits; no migrations.

Material UI: The user selected `PasaDataDesign.pen` as the authoritative file and saved it in Pencil Desktop. A local file readback verified eight top-level frame IDs: component library `bi8Au` (line 6); desktop empty `kMwy4` (line 308), image ready `xXvrr` (line 759), processing `Y81wRJ` (line 1374), review `WMtic` (line 1760), errors and confirmation `eG1EO` (line 2385); mobile image ready `CiOPF` (line 2902), review `yO8fo` (line 3309). The user explicitly approved this design in the message “Apruebo el diseño, continuemos” after design review was requested. This approves the design only, not PLAN-1, implementation or publication. No generated image evidence.

## Plan approval and delivery choice

PLAN-1: explicitly presented with AC-001–AC-009, TASK-001–TASK-004, dependencies, ownership, batches, forecasts, risks, checks, and delivery. User submitted `Aprobar PLAN-1 (Recommended)` in the approval question following that presentation. Approved only this exact current PLAN-1 for local Git preparation and implementation; no push, PR, merge or deployment. The saved Pencil design was approved separately in “Apruebo el diseño, continuemos”. The user chose, in `PLAN-Q1`–`PLAN-Q4`: one strictly empty local bootstrap commit on unborn `main`, no staged paths; single-PR strategy with four cohesive commits (PR/push still not authorized); TDD ON; JPEG/PNG only, one image of at most 3 MB, no HEIC.

Forecast, authored additions plus deletions (low-to-medium confidence; excludes generated lockfile): WU-001 180–300 lines / 8–12 files; WU-002 180–300 / 4–6; WU-003 260–420 / 4–7; WU-004 140–240 / 3–5. Total 760–1,260 lines / approximately 16–24 distinct files. These are planning estimates, not measured diffs.

Delivery strategy selected: single feature branch, four cohesive reviewed commits, one PR only if separately authorized. Rationale: smallest coordination cost for this MVP despite total forecast above the advisory 400-line threshold; retain tests and documentation with each behavior unit. No push, PR, merge, release, deployment, or Linear synchronization authorization received. TDD ON by explicit `PLAN-Q3` answer; TASK-001 sets up and reads back the runner (proposed Vitest) before observable RED/GREEN/REFACTOR for contract behavior; later Tasks use the established exact commands. Proposed package manager: npm, subject to observed availability. Proposed scripts after scaffolding: `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`; these do not exist yet and are not verified checks. Security/privacy and public unauthenticated paid-endpoint cost risk are high; independent verification required for affected work units.

Image gate selected: JPEG and PNG only, maximum 3 MB, validate type/signature/size on server and give explicit rejection; verify actual Vercel/Gemini limits before deployment. Verify Gemini model/version and account-specific retention/data-use terms, region, quotas and abuse controls before production. `PLAN-Q1` authorized one empty local bootstrap commit, now observed at `858b836373d833729c178648d01641b71df69ed3` on `main`, with zero tree entries. The integration branch and TASK-001 task worktree were created locally from that SHA. All original workspace files remain untracked, including `.env`; never stage it or bulk-stage the directory. Runtime subagent invocation currently lacks an exposed explicit worktree binding; no Implementation writer may dispatch until verified. No claim of provider, GitHub, Linear, or Engram authentication is made.

## Task and work-unit register

| ID / WU / objective | ACs | Dependencies | State / phase | Edit ownership and shared resources | Forecast / commit boundary | Linear |
| --- | --- | --- | --- | --- | --- | --- |
| TASK-001 / WU-001 / scaffold and fixed contract | 002, 003, 005, 006, 008 | None; dispatch blocked by runtime routing | BLOCKED / BLOCKED | `package.json`, selected lockfile, TypeScript/lint/test config, `src/lib/document-fields.ts`, minimal `src/app/{layout,page,globals.css}`, contract tests, initial `README.md`; owns shared schema/config | 180–300; `chore: scaffold document extraction app` | Not enabled |
| TASK-002 / WU-002 / secure image extraction | 002, 003, 007, 008, 009 | TASK-001 integrated DONE | TODO / NOT_STARTED | `src/app/api/extract/route.ts`, `src/server/gemini.ts`, route/adapter tests, scoped README privacy updates; reads fixed contract | 180–300; `feat: add secure Gemini document extraction` | Not enabled |
| TASK-003 / WU-003 / single-image review UI | 001, 003, 004, 007, 008, 009 | TASK-001 integrated DONE; exact Pencil design approved | TODO / NOT_STARTED | `src/components/extraction-workspace.tsx`, its tests, narrow `src/app/page.tsx` and `src/app/globals.css`; reads fixed contract | 260–420; `feat: add document review workspace` | Not enabled |
| TASK-004 / WU-004 / reviewed Excel export | 004, 005, 006, 007, 008 | TASK-002 and TASK-003 integrated DONE | TODO / NOT_STARTED | `src/lib/export-excel.ts`, its tests, narrow workspace and integration tests; reads fixed contract | 140–240; `feat: export reviewed interview data to xlsx` | Not enabled |

TASK-001 done when the scaffold builds and the nine ordered fields validate to `string | null` with missing/blank normalized and invalid types rejected. TASK-002 done when exactly one JPEG/PNG image of at most 3 MB reaches Gemini through a server-only key and error/uncertainty/privacy controls are tested. TASK-003 done when preview, notice, editing, uncertainty, replacement, loading and error states follow the approved Pencil design and are tested accessibly. TASK-004 done when workbook tests inspect the current edited values, ordered columns and blank cells in memory; no failed or pending extraction can export. All Tasks require focused checks, independent review, scoped source commit, serial integration and accepted integration checks before DONE. TDD ON: observe RED before corresponding production behavior, then GREEN and affected checks after REFACTOR; TASK-001 first establishes the runner.

Dependency graph is acyclic. Candidate batches: first TASK-001; then TASK-002 and TASK-003 only if actual isolated worktree routing and disjoint logical/file ownership are confirmed; finally TASK-004. Shared schema, configuration, lockfile and design changes serialize affected tasks. Prepared TASK-001 root `E:\Freelance\PasaData-task-001`, branch `task/handwritten-interview-export-001`, base `858b836373d833729c178648d01641b71df69ed3`, clean and without candidate diff. No writer invocation or reservations were launched: subagent routing to this root is unverified and no explicit binding is exposed.

## Progress, integration and links

No application source changed. Delivery verified empty root commit `858b836373d833729c178648d01641b71df69ed3` (`chore: initialize repository`, empty tree `4b825dc642cb6eb9a060e54bf8d69288fbee4904`), integration root/ref/HEAD and clean task worktree; the integration root retains original untracked files. No source checks, work-unit commits, integration, push, PRs, or Linear issues observed. No Engram save/readback available; full mirror pending. Pencil design was saved, read back, and explicitly approved. PLAN-1 is approved; only TASK-001 dispatch is blocked by missing verified invocation-to-worktree routing.

## Completion

Not started. Feature DONE is branch-level verified completion, not merge or deployment.
