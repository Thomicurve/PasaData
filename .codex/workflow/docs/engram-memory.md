# Engram memory policy — V2 ODD

Two complementary layers provide continuity. Current files, explicit user decisions, versioned approvals and observed verification remain authoritative. Memory is supporting context, never execution authorization or proof of completion.

## Runtime contract and ownership

Target the Engram provider selected for this project; the source bundle referenced v1.20.0. No Codex connection, binary version, aliases or payload limits are established by that historical observation.
Orchestrator alone may call mem_current_project, mem_context, mem_search, mem_get_observation, mem_save and mem_session_summary through inspected Codex MCP tools, with an explicit connection-specific allowlist. Verify real tool schemas before use; never infer MCP permission or allow all tools. Subagents return Memory Candidates and never call Engram.
Use mem_current_project to confirm project identity/location against the current workspace. Use the resolved project name, project scope and explicit project filters. Never search all projects as a fallback. Follow returned recovery/conflict schemas; do not invent a project or session ID.
Do not assume OpenCode lifecycle hooks exist in Codex. Use lifecycle integration only if actually installed and verified; do not register duplicate sessions or invent lifecycle tools. Omit optional session_id unless the real active ID is supplied and verified.

## Layer 1 — selected durable facts

Preserve V1.3's selected memories: confirmed decisions, architecture, discoveries, bug fixes, patterns, configuration and preferences useful beyond one task.
After meaningful checkpoints, validate candidates against current source evidence and deduplicate. Save a short searchable title, supported type and stable topic key such as `feature/<stable-id>/decision/<topic>`.
Use What / Why / Where / Learned, source revision, feature/Task IDs, observed status and verification limits. Distinguish planned, implemented and approved work. Label unresolved assumptions separately.
Do not save every routine handoff. Reuse a topic only for evolution of the same fact; never silently replace conflicting user decisions. These memories complement the mirror and do not substitute for it.

## Layer 2 — full feature mirror

For substantial authorized work only, the project-scoped stable topic `odd/<feature-name>/tasks` stores the complete current `specs/<feature>/spec.md` plus its locator. Do not create it for a small understood fix or read-only research.
Do not summarize the document, omit completed Tasks, acceptance criteria, approval references, failures or next step. This is a full snapshot, not a list of memory candidates and not an additional local plan file.
Save supported type `decision`, a searchable feature title and an envelope containing confirmed project, repository/branch/base ref, repository-relative document path, document revision, observed source version when available, and the verbatim full Markdown body. Remap paths on recovery; absolute paths from another checkout are not authority.
Use a dedicated document revision separate from the plan revision: progress/evidence updates change the document revision; material plan changes change the plan revision and require the approval in `.codex/workflow/docs/odd-workflow.md`.
Update the mirror after document creation, accepted intent/Task changes, observed checking/review results, commit checkpoints and completion. Reuse the same topic for the same feature; do not create a new topic per session.
Orchestrator persists the local document, reads it back, sends that exact body, checks mem_save success, and retrieves the full saved observation via verified APIs to compare the returned project/topic/locator/revision/body. Only successful readback permits reporting the target snapshot synchronized. Search snippets or a successful save without readback are insufficient.
The two writes are not atomic. Prepare sync metadata before serializing; do not claim sync until readback succeeds. If an acknowledgement field changes the document afterward, that creates a new revision requiring another sync. Keep transient readback receipts in the Context Map/session summary instead of producing an endless self-referential sync update.
Do not invent a content limit or truncate to fit. If the actual server rejects/shortens the full payload, keep the complete local file, mark the mirror pending/unavailable, report the limitation and validate the provider's supported mechanism before changing storage.
Never include credentials, secrets, raw private logs or unnecessary personal data in either the document or its mirror. Redact evidence at document creation; if the current file contains unsafe data, pause memory writes, preserve local content and resolve the exact redaction before mirroring. Never call a redacted summary a full synchronized mirror.

## Recall and reconciliation

At start/resume/compaction: confirm current workspace/project/branch; use mem_context once; narrow mem_search only for missing relevant facts; retrieve selected full observations.
For an active tracked feature, retrieve its exact mirror and read the actual local feature file before selecting the next Task. Compare source identity, document/plan revisions, user decisions, approvals, Tasks, commits, code changes and observed checking evidence.
Do not choose a winner merely by last-write time. If the local document is demonstrably newer and consistent with actual proof, retain it and update the mirror. If the mirror contains credible progress missing locally, reconcile it with code/commits and explicit decisions before restoring a local revision. Preserve both versions when uncertain; pause only affected execution.
A missing local file may be restored from a validated full mirror, but restoration alone does not authorize implementation. Missing approval or verification evidence follows workflow blocking rules.
Readiness/status from memory is never a substitute for the matching current approval or results. Pass only relevant validated facts, observation ID/date/source, full-document locator and any conflict through the Context Map.
Implementation/review workers read the supplied feature file; they do not independently recall Engram or receive entire memory histories.

## Summaries and failure behavior

At significant interruption/end, save Goal / Instructions / Discoveries / Accomplished / Next Steps / Relevant Files with project/branch, document and plan revisions, Task states, approval/evidence references, blockers and actual mirror readback status.
Do not duplicate plugin-managed lifecycle calls or claim an abrupt interruption was captured. On compaction, recall/reconcile; save a new summary only for a new checkpoint.
Tool failure, denied access, project mismatch, payload rejection or conflict means pending memory, not lost authorization or successful synchronization. Keep complete local state and report the gap once per checkpoint. Continue where authoritative local inputs suffice; block only missing required evidence/decisions.
Follow mem_save conflict/judgment_required schema; V2 grants no mem_judge, delete, merge or administrative permission. Preserve current decisions locally pending resolution.

## Required Codex acceptance

Verify actual aliases/permissions, two-project isolation, selected-fact save/read and deduplication, full-document save/read equality including Tasks/ACs/evidence, topic evolution, resumed feature recovery, stale approval rejection, conflict preservation, unavailable-server and payload-rejection fallback, subagent denial and installed lifecycle behavior, or its explicitly documented absence. Use disposable non-sensitive observations.
These checks remain pending until executed in Codex. Static document validation proves none of this runtime behavior.
Source: [Engram v1.20.0](https://github.com/Gentleman-Programming/engram/tree/v1.20.0).

## Parallel task continuity — V2.1

Apply `.codex/workflow/docs/task-worktrees.md`. One canonical feature document and one full feature mirror remain shared across task worktrees. Orchestrator serially persists task roots/branches/bases/invocations/reservations/phases and distinct source/integrated SHAs. Workers do not mutate state or create per-task memory topics. On resume, reconcile actual worktrees and worker liveness before redispatch; memory alone proves neither isolation nor integration.

## Compact spec and Linear — V2.2

Default canonical locator is `specs/<feature>/spec.md`; keep an existing valid `odd/tasks/<feature>.md` until explicit migration. Preserve the same stable feature topic `odd/<feature>/tasks` so a path change does not fork memory. Mirror the exact complete current canonical file, including criteria, approvals, compact task/evidence/Linear/PR mappings and unresolved gaps; never claim remote Linear bodies were mirrored merely because their links are present.
Reduce repeated history/raw logs in the canonical file under `.codex/workflow/docs/delivery-and-tracking.md`, not by truncating the mirror or discarding governing evidence. Store meaningful decisions/progress in place, and preserve required current task detail locally during Linear outages. Selected durable facts remain complementary. No generated image evidence, per-worktree mirrors or per-provider outbox files.
