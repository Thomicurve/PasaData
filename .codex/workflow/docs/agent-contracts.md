# Shared agent contracts — V2 ODD

Read this file and `.codex/workflow/docs/odd-workflow.md` before role work. Role files define capabilities; the ODD workflow defines routing, authorization and completion. These replace V1's mandatory stage chain. This is shared guidance, not permission inheritance.

## Internal communication — Caveman lite

Load `.agents/skills/caveman/SKILL.md`, explicitly select lite, and read `.agents/skills/caveman/references/ai-workflow.md`. Apply lite only to internal delegations, coordination and feedback. Preserve every required field, exact ID, state, command, evidence, condition, approval and uncertainty. Persisted document/report bodies use normal clear prose. User communication remains natural prose. Missing style tools: report once and continue in concise normal prose.

## Context Map — retained from V1.2

Orchestrator supplies only relevant context:
- Workspace Root: actual checkout/worktree root; never reuse another checkout's absolute paths.
- Scope: feature, mode, Task IDs, requested result and authorization.
- Inputs: exact known paths/URIs, purpose, relevant section/symbol, source version, verified or candidate location.
- Inline Inputs: required content not yet persisted, explicitly marked as inline.
- Output Targets: planned destinations; these do not grant write permission.
- Location Gaps: required missing/inaccessible locations, or None.
- Skills: exact relevant `SKILL.md` paths; no claim of inherited activation.
- For implementation: allowed edit surfaces (exact repo-relative files/narrow globs and authorized new-file directories), TDD mode/source/runner, exact checks, approval references and Git operation authorization.

Open supplied files before searching. Search narrowly for invalid/missing inputs or dependencies within your role. Do not re-search valid known locations; re-read current content when needed. Distinguish future files from existing files. A path/ref alone is not content, approval or verification.

Return **Context Map Updates** with only new/corrected locations, purpose and evidence or gaps; None if unchanged. Missing map metadata alone does not block. Missing authoritative inputs, evidence or authorization does.

## Memory — two complementary layers

Read `.codex/workflow/docs/engram-memory.md`. Orchestrator alone owns Engram access, scoped recall, the full feature mirror, durable fact saves and session summaries. Subagents never call Engram or register sessions.
Use supplied memory as supporting context and reconcile it with current files and approval evidence. A remembered APPROVED/DONE never substitutes for evidence.
Return **Memory Candidates**: confirmed reusable findings/decisions with type, What/Why/Where/Learned, feature/Task IDs, source revision, observed status, verification limits and suggested stable topic key; None if empty. Label assumptions and questions separately.
For tracked work, read the current feature document before edits or review. If Orchestrator is requesting preparation before that document exists, use supplied inline scope; no implementation is allowed yet.

## Evidence and scope

Distinguish facts, assumptions, stale references, contradictions and unknowns. Cite actual paths, symbols, document sections and observed command results. Never invent tools, runners, tests, permissions, user approval or successful saves.
Do not broaden business scope, hide failures, weaken tests, redesign approved UI or perform unrelated refactors.
Return unresolved product choices to Orchestrator. Only Orchestrator speaks to the user, records approvals and updates feature task state.
Readiness is not approval. Implementer reports implementation; Reviewer reports evidence and findings; Orchestrator decides progression under the required checks.

## Task worktree context — V2.1

Read `.codex/workflow/docs/task-worktrees.md` for planned task approval and any implementation, Git lifecycle or integration review. Context Map includes canonical document locator/revision, exact approved PLAN-n, integration root/ref/verified SHA, task root/branch/base, invocation identity, dependencies' integrated proof, reserved edit surfaces/shared resources and execution phase. Source paths resolve against the supplied worker root; the canonical plan is read-only to workers. Only Orchestrator persists shared state and full mirror. Actual invocation routing must be verified before isolated dispatch.

## Compact artifacts and integrations — V2.2

Apply `.codex/workflow/docs/delivery-and-tracking.md`. No generated images/captures/exports, no design-review folders and no separate stage/spec/review/context output files. Agents return scoped handoffs; Orchestrator merges needed facts into one canonical spec, default `specs/<feature>/spec.md`, preserving a valid legacy locator instead of duplicating it.
Context Map includes verified canonical locator/section/revision, exact assigned criteria and current Linear issue snapshot/IDs when remote details are needed, plus WU forecast/commit/PR boundaries. External links alone cannot substitute for worker-readable inputs. Only Orchestrator synchronizes Linear; only Implementer Delivery operates local Git and configured GitHub PR tools. Codex roles use TOML developer instructions and sandbox settings; tool availability is not authorization. Read the runtime section of delivery-and-tracking for enforcement limits.
