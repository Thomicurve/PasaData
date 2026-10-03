# AI-Workflow — ODD with V2.2 delivery and tracking

Codex adaptation of the integrated OpenCode V2.2 baseline `b173160830466ac2f59aaaf211a60573a5888c5f`. This package is not runtime-certified until the acceptance matrix has observed receipts.
Reference: [Gentle AI ODD](https://github.com/Gentleman-Programming/gentle-ai/blob/5140c5f55baf91763198eb0bfca019c015e3b015/docs/usage.md#organic-driven-development-odd). The reference tracks main and may contain unreleased behavior.

## Intent and deliberate adaptations

Use explore → resolve real decisions → implement → proportionate checks. For substantial work, keep one evolving feature document and its full Engram mirror. Preserve selected durable facts separately.
Keep existing roles, inherited Codex model selection, Caveman lite, Context Maps and user-approved Pencil design. Make specialist preparation conditional instead of forcing every feature through every stage.
This adaptation retains an explicit pre-implementation user approval for substantial work. It retains independent review for every substantial work unit, with deeper independent verification for high-risk work. These are local choices, not claims that upstream ODD requires them.
RDD is not installed, enabled, emulated or required by V2. Do not invoke Gentle AI review commands merely because this workflow uses ODD.
V2.1 adds approval details and isolated parallel task worktrees through existing agents. V2.2 adds runtime-specific role configuration, no-image review, compact specs, explicit GitHub draft PR delivery and Linear tracking; see `.codex/workflow/docs/delivery-and-tracking.md`. Linear requires connection-specific activation; publication still follows the user's authorized scope.

## Role routing

| Role | Use when | Result / consumer |
| --- | --- | --- |
| Orchestrator | Every request | Routing, user decisions, persistence and progress |
| Discovery | Material functional ambiguity | Scope facts/questions → Orchestrator |
| Product | Complex behavior needs explicit criteria | Intent/behavior/AC sections → Orchestrator |
| Story Writer | User asks for stories or decomposition adds functional value | Optional Stories and coverage → Orchestrator |
| Explorer | Unfamiliar code or evidence needed to choose/route | Current code/test map → Orchestrator and relevant workers |
| Architect | Material architecture, migrations or nontrivial dependencies | Technical approach and executable Tasks → Orchestrator |
| Designer | Material screen/component/interaction/responsive change | Pencil candidate → user review → approved design |
| Implementer | Authorized bounded code changes or authorized Git delivery | Files, tests, checks, commit/delivery evidence → Orchestrator |
| Reviewer | Substantial work units, completion, risky small changes | Evidence-based verdict → Orchestrator |

## Handoff status consumers

Orchestrator consumes Discovery READY_FOR_SCOPE, Explorer READY_FOR_PLANNING and Product/Architect/Story Writer READY_FOR_PLAN_REVIEW as preparation evidence only, then selects missing work or presents the plan. None grants implementation authority.
Designer READY_FOR_USER_REVIEW goes to the user; DESIGN_APPROVED becomes a validated design input. Every WAITING_FOR_USER goes to an exact user decision; every BLOCKED retains the gap and routes only affected work.
Implementer IMPLEMENTED goes to checking/review, PARTIALLY_IMPLEMENTED retains IN_PROGRESS and BLOCKED records the missing prerequisite. Verification-only/delivery COMPLETED is operational evidence, not task completion; PARTIAL/BLOCKED retains missing proof.
Reviewer verdict/readiness mappings in `.codex/agents/reviewer.toml` control the next checking/correction action; Orchestrator alone applies feature/task states.

Orchestrator performs lightweight synthesis and task planning when specialists are unnecessary; it does not write application code. Implementer is the only application-writing role, with at most one writer per isolated task worktree. Explorer is not a mandatory predecessor: Implementer may inspect known scoped files as preparation for a write.
Story Writer remains exclusive owner of requested functional Stories; Tasks and ACs do not require Stories. No obligatory PRD, Functional Spec, Story files or standalone implementation plan.

## Ordered protocol

1. Classify authorization. Investigation/explanation/proposals stay read-only in target repositories; do not create branches, feature task files or memory mirrors for proposal-only work. Disposable research notes are not target workflow artifacts.
2. Explore current repository rules, relevant code and existing tests proportionately. Use Explorer when mapping is needed; do not formalize a speculative solution before inspecting reality.
3. Resolve material unknowns. Research only named uncertainty. Preserve V1.4's batch of independently answerable questions, recommended options and custom responses; defer answer-dependent questions. Greenfield projects with no established stack require the user's technology choice before architecture or scaffolding. Agents may propose options, not choose silently.
4. Classify size separately from risk. Substantial means two or more meaningful implementation steps or progress worth recovering. Small means understood, bounded work with no durable tracking value. Security, credentials, data loss, concurrency, migrations, installation and public contracts are high-risk even in one file; unknown risk is high.
5. For substantial work, draft `specs/<feature>/spec.md` from `.codex/workflow/docs/templates/odd-feature.md` after exploration and before the first application source write. Use a stable feature ID/path. Record objective, scope, ACs, approach, Tasks, expected files, dependencies, checks, risks, TDD, delivery strategy, approval and next step. Creating the planning document is permitted before plan approval; application writes are not.
6. Present the scope, approach, Tasks/ACs, optional Stories, material risks and delivery strategy to the user. Record explicit approval of the exact current plan revision; silence, draft status, agent readiness and remembered approval do not qualify. Present the current document locator and task count. Material UI also requires explicit approval of the exact Pencil design.
7. Create a dedicated feature branch before application writes. Use a meaningful `feature/`, `bugfix/`, `hotfix/` or `workflow/` name; check current branch, dirty state and branch existence first. An already dedicated, confirmed branch may be reused. Preserve unrelated work; never reset, force-push or overwrite another branch.
8. Synchronize and read back the full Engram mirror before execution when available. Memory failure alone does not block authorized work with sufficient local evidence; record the pending sync and use the document.
9. Execute approved ready Tasks in unique task worktrees under `.codex/workflow/docs/task-worktrees.md`. Mark IN_PROGRESS and reserve scope/resources before dispatch. Supply exact worker root/ref/base, canonical document revision, approval, dependencies, TDD and checks. At most two independent writers by default; overlap, uncertainty or dependencies require sequential work. Actual runtime routing must be verified.
10. Implementer normalizes files, runs relevant checks and reports observed results. Reviewer inspects the current diff and evidence for each substantial work unit. Passive content needs structural readback; ordinary behavior needs functional proof; high/unknown risk adds independent check execution through a fresh verification-only invocation.
11. After APPROVED and required proof, serialize a selected-path work-unit commit on the task branch, then integrate into the dedicated feature branch under `.codex/workflow/docs/task-worktrees.md`. Tests/docs accompany behavior; use Conventional Commits. Record source and integrated SHAs. DONE requires reviewed committed candidate and accepted current integration checks; source commit alone cannot unblock dependent tasks. Changed bytes/paths/modes invalidate affected checks/review.
12. Update progress, evidence, commit boundaries and full mirror. Repeat only authorized work. At completion, run proportionate feature integration review, update the same document's outcome/rationale/remaining limitations, and report failures/pending checks truthfully. Branch completion is not merge, deployment or main activation.

For small work: confirm authorization/scope → scoped implementation → relevant checks → independent review if high/unknown risk → report. No feature document/mirror or extra planning approval is required. Dedicated branch remains required before application writes; a commit requires explicit user/Orchestrator Git authorization because substantial-task commit authorization does not apply.

## Approval, evolution and task state

Plan revisions use stable identifiers (`PLAN-1`, `PLAN-2`, ...). Approval records exact revision and authoritative user decision reference, scope, Tasks/ACs, design references when applicable and selected delivery strategy.
Routine in-scope corrections and evidence-backed path adjustments may update the document without renewing the whole approval. Material behavior, scope, architecture, delivery-strategy changes or newly added meaningful Tasks require presenting the affected delta and explicit approval before those writes. Do not silently accept a review suggestion that expands business scope.
Preserve valid completed Tasks and stable IDs; reopen only invalidated work with a reason. Refresh affected tests, design, review and approval evidence. A memory topic is never authorization.
Feature states: PREPARING, WAITING_FOR_USER, READY, IMPLEMENTING, CHECKING, BLOCKED, DONE.
Task states: TODO, IN_PROGRESS, BLOCKED, DONE. Unchecking/reopening records why.
No automatic loops until clean. Corrections address supported findings; repeated failure is reported with the actual blocker and next action.

## TDD and checking

Resolve TDD on/off from explicit user choice or existing unambiguous project/session policy. Record mode, source and exact test runner; existing tests do not imply TDD on. If sources conflict or enabled TDD has no working runner, ask only the decision needed for the next action.
ON means observed RED before behavior implementation → GREEN → REFACTOR with affected checks rerun. OFF still requires ordinary checks. Do not claim RED retrospectively.
Run mutating formatters/generators before verification. A subsequent source change invalidates affected checks. Begin with focused checks; run applicable broader checks for shared code and integration at closure.
Reviewer does not execute shell commands under its role contract: high/unknown risk requires fresh, separate Implementer invocation in verification-only mode to independently inspect the diff and rerun exact checks without editing. Supply no writer conclusions as proof. Reviewer consumes that independently observed evidence. Verify this isolation in Codex before rollout.
Missing results are INSUFFICIENT_EVIDENCE, not a fabricated defect/pass. If required checking is unavailable, record BLOCKED and the required action. Document-only workflow validation does not prove autonomous agent behavior.

## Commits, size and delivery

Forecast authored additions plus deletions, excluding generated files; record confidence and likely files. Approximately 400 lines per work unit is advisory only. Never remove tests/docs/comments, minify or invent abstractions to satisfy a line target.
Default delivery is `ask-on-risk`: when the initial forecast exceeds about 400 authored changed lines, propose cohesive PR/work-unit slices and obtain one choice before application writes; if running changes later exceed it, revisit the affected split before the next commit: `single-pr` with rationale, `stacked-to-main`, or `feature-branch-chain`. Record chosen boundaries and do not mix strategies silently. A user-selected strategy is retained while relevant scope is unchanged.
Commit permission applies to approved substantial Tasks on the dedicated branch; it does not authorize pushes, PR creation, merges or releases. Delegate these only when the user's request authorizes each operation. Prepare draft PRs when authorized; include checks, dependencies, rollback and limitations. RDD evidence is not delivery authorization.
Orchestrator has no shell; branch/commit/push/PR operations go to Implementer in delivery mode with exact repository, branch, selected paths/candidate and allowed operations. No code edits in delivery mode.
Always inspect dirty state/staged diff. Never stage unrelated files or claim a clean tree without observing it. Return branch and SHA/URL evidence.

## Worktrees and recovery

Every implementation uses an isolated task worktree. Apply `.codex/workflow/docs/task-worktrees.md` for approval, dependency/ownership validation, runtime routing, serial integration, conflict handling, recovery and safe cleanup. The parent remains the sole task-document/memory writer.
On resume/compaction, confirm workspace/project/branch, read the actual feature file and full feature-specific Engram observation, inspect commits/diffs and reconcile approvals, Task states and checking evidence. Resume the earliest incomplete valid Task; do not restart completed preparation or trust labels alone.
Memory conflicts are reconciled using current files, source revisions, explicit user decisions and observed proof, never merely last-write time. Retain both versions if uncertainty remains and pause only affected work.

## Migration and testing

V2 changes role contracts and stage semantics: use a major version. Load the coherent branch bundle; do not mix V1 agents with V2 docs. Existing V1 features may finish under V1. For migration, read all current V1 artifacts, retain their references, map approved intent/Stories/Tasks/evidence to one V2 feature document, identify gaps and obtain explicit approval of the V2 continuation. Do not delete historical specs or reinterpret old approvals.
See `.codex/workflow/docs/odd-validation.md` for static evidence and required Codex acceptance scenarios. No installation or runtime tests are implied by repository publication.

## V2.1 approval gate

For planned task sets, apply the explicit approve-current-plan/request-changes gate in `.codex/workflow/docs/task-worktrees.md` before dispatch. Include all task IDs, criteria, optional Stories, dependencies, ownership and proposed parallel batches. A small inline fix still needs concrete scope authorization; omitted/canceled answers never approve anything.

## V2.2 delivery, visibility and tracking

Apply `.codex/workflow/docs/delivery-and-tracking.md` for all role work. Default to one compact `specs/<feature>/spec.md`, keep an existing canonical legacy locator until migration, and update sections in place rather than producing stage/review/context files. The full spec mirror and selected durable memories remain separate.
No generated images or design-review/desing-review folders. User reviews native Pencil; workers use text/structure/state evidence. Implementer Delivery prepares requirement-derived branches, commits each checked/reviewed work unit and creates/reads back an authorized draft PR through the configured GitHub MCP. Orchestrator alone synchronizes approved features/optional Stories/Tasks and verified PR links to the chosen Linear team/project; connection failures preserve sufficient local state.
