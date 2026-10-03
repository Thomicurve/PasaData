# Codex task worktrees

This is the Codex runtime contract. It replaces OpenCode-specific routing assumptions while retaining V2.1 isolation, approval, dependency and integration rules. Read `agent-contracts.md`, `odd-workflow.md` and `delivery-and-tracking.md` in this directory.

## Approval and preparation

Substantial work requires explicit human approval of the exact PLAN-n/Task/AC set, dependencies, ownership, checks, design and delivery strategy recorded in the canonical spec. Changing material scope/ownership/contracts requires the affected plan approval; harmless evidence updates do not ask again. Missing/canceled answers are not approval.

Each task records integration root/branch/verified HEAD, canonical locator/revision, task root/branch/base, dependency integrated SHAs, invocation identity, reserved paths/contracts/resources, phase and candidate/source/integrated identities. PLAN-n identifies content, not necessarily a filename. One canonical spec stays in the integration checkout; workers get read-only current sections or the launcher's immutable full snapshot. Worktree copies are tracked baseline inputs, not separate mutable task specs.

Orchestrator proposes batches of at most two ready independent tasks. Disjoint filenames alone are insufficient: APIs, schema, shared generated outputs, services, migrations, lockfiles, ports, databases and caches can still conflict. Reserve each affected logical resource and explicit allowed new-file directory. A task consuming another's result waits for its accepted integrated SHA and starts from that new integration base. Independent tasks may start from the same exact approved integration SHA.

Implementer Delivery prepares integration/task branches and worktrees serially. Check Git branch names, repository identity, dirty/staged state, existing worktrees and exact source SHA. Never overwrite a branch, move the integration checkout or force-remove a worktree. A greenfield base may contain only the tracked workflow, approved spec and Pencil design; application code can be created by TASK-001. Untracked/ignored configuration and designs are not copied by Git worktree. Version only explicit non-secret necessary paths; never copy `.env` or use `.worktreeinclude` to transfer secrets.

## Actual Codex execution

Native subagent creation does not prove another checkout: subagents may share cwd/environment. `create_worktree` prepares a checkout but does not change the current chat's root. Never report a session relocation based only on a shell `cd`, an absolute path in a prompt or a tool name from another runtime.

Default root-coordinated path: `.codex/workflow/tools/dispatch_task.py --packet <transient-json>`. It reads the task worktree's native Implementer TOML, checks actual Git roots/common repository/branch/HEAD, tracked role/config inputs, canonical spec hash and Task/PLAN identifiers, dependency ancestry and receipt metadata, then creates a **new process** with `codex exec -C <task-root>`. Explicit `developer_instructions` supplies the role because this CLI does not have `--agent`. The actual CLI help and merged MCP inventory are checked before dispatch. It does not create or integrate worktrees.

The coordinator's packet carries verified approval/independence/review evidence; the script cannot establish that a boolean or reference truly came from the human. Orchestrator and worker must read current governing inputs and reject mismatches before writes. Approval, narrower allowed paths, mode limits and forbidden images remain contracts; workspace-write is an outer sandbox, not a per-task path ACL. External hooks/app integrations and shared service state require separate inspection.

Small known authorized changes retain the inline route: `scope_kind=small`, `INLINE-n`, an exact `small_scope` and the original user authorization reference, without a feature spec/mirror or planned dependencies. Root/branch/HEAD, criteria/checks, surfaces/resources and separate worktree validation still apply. Classification is Orchestrator's evidence-based responsibility; the packet cannot downgrade substantial work to bypass approval.

The launcher's shared registry lives under the repository's common Git metadata, outside `specs/` and Git content. It serializes reservation checks and rejects over two active dispatches, repeated task/root/branch, overlapping conservative path prefixes/shared resources and Delivery with any active dispatch. It does not coordinate other manually launched processes, and glob checking intentionally errs toward serial execution. Parallel workers need distinct invocations actually running concurrently; the coordinator monitors each terminal/process and does not infer completion from silence.

CLI workers disable recursive spawn and discovered MCP servers by default. A Delivery packet can re-enable an observed server with reviewed exact tool names and operation authorization; memory/tracking/design servers remain forbidden. Native role defaults disable known server names for non-owners. Neither layer claims wildcard protection against unknown app tools/hooks. If effective permissions cannot be established, return the exact gap rather than pretending the worker is safe.

Alternative: a Codex app Worktree chat with a verified base and branch. The app can initially use detached HEAD; this launcher intentionally requires an explicit task branch, so create it there before using the launcher. Choose/verify the chat's own worktree and give it the same bounded packet. Root orchestration via app tools is only available if those tools really exist and user authorization covers creation/messaging. Do not invent `session_move`, an OpenCode command or an Agents API integration.

## Candidate, review and commits

New implementation dispatches require a clean task worktree. The worker edits only its assigned scope, checks actual root/ref/base before writes, runs required checks and returns a candidate with criteria/design coverage, commands/results, diff/scope and Memory Candidates. It neither commits in implementation mode nor edits spec/task state. Stop writes and verify child exit before inspection. If preflight or implementation leaves existing changes, preserve them and reconcile an explicit continuation; do not reset or silently redispatch.

For a stopped candidate, `--fingerprint` performs preflight/read-only candidate inspection and returns the digest of changed authorized paths/content and diff/index boundaries. Verification-only or source Delivery must receive this fingerprint and `candidate_stopped_reference`. Identity is not review: Reviewer inspects actual diff/criteria. Verification-only executes independent check-only commands, preserving candidate source; source mutations invalidate review/check receipts. Unexpected/secret/out-of-scope inputs block fingerprinting. Required tests producing image artifacts remain forbidden; report that coverage gap.

Each accepted coherent WU includes behavior/tests/docs and its forecast/actual authored count. Delivery commits selected reviewed paths only and records source SHA. Mutating Git and integration are serial; all active dispatches must have ended before Delivery. Integration itself runs in a separately verified integration-checkout invocation (not this task launcher), with only delegated Git operations. Preserve/checkpoint Orchestrator's canonical document edits before operations that need a clean integration tree. Inspect unrelated dirty content; never stage everything, stash/reset it silently or resolve application conflicts in Delivery. Conflicts return to bounded Implementation plus renewed checking/review.

After cherry-pick/integration, record the distinct integrated SHA, compare logical change boundaries and run affected integration checks. Source commit, IMPLEMENTED, a PR or a provider status never implies DONE. Orchestrator marks DONE only with accepted AC coverage, current review/checks and integration proof. A dependent task starts from that accepted integrated base. Push/draft PR/merge follow the recorded matching authorization; branch preparation and task approval alone do not authorize publication.

## Recovery and cleanup

Persist meaningful current metadata in the single canonical spec/full Engram mirror; do not create per-task spec/report/context files. On resume/compaction inspect actual root/ref/HEAD, dirty/candidate state, source/integrated SHAs, reservations and process liveness. Check both parent and recorded child PID plus command/root identity; PID reuse is not proof of ownership.

The launcher waits for its child, has no timeout and removes its reservation only after observed child return. Interruption/crash leaves a receipt intentionally: confirm all writers stopped before removing that owned stale receipt. A terminal timeout/yield or a dead launcher does not prove the child ended; do not redispatch or integrate while liveness is unknown. Registry lock leftovers also require reconciliation, never blind deletion. Preserve dirty/failed/conflicted worktrees and branches. Clean owned worktrees may be removed only with authorized cleanup and recoverable source/integrated commits. Never force-remove or delete unmerged branches.

Acceptance is tracked in `odd-validation.md`; local help/config/static tests are not proof of end-to-end model execution or MCP connectivity.
