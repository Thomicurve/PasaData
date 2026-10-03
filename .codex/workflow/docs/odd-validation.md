# Codex migration validation

This package is an adaptation from OpenCode V2.2 at `b173160830466ac2f59aaaf211a60573a5888c5f`. Historical OpenCode validation is retained under `opencode/docs/odd-validation.md`; it does not certify Codex. No application implementation, paid model run, live provider write or merge is performed by this migration's static validation.

## Repeatable local validation

Run Python 3.11+ from the Codex bundle:

```text
python -m unittest discover -s tests -v
```

The tests parse all nine native role files/config, verify installed docs/skills, inspect retained contracts and exercise the dispatcher against disposable real Git worktrees with mocked Codex help/catalog responses and a real local fixture child process. They cover root/ref/HEAD/spec mismatches, accepted dependency ancestry, small inline scope, candidate mutations/out-of-scope changes, process argument/stdin role binding, nonzero child exit, reservations, overlap/concurrency/Delivery and inherited MCP restrictions. The fixture demonstrates adapter behavior, not that a real Codex model adopted the role or sandbox.

During PR preparation the original 24 OpenCode file blobs are compared byte-for-byte with the pinned base. The installed local Codex CLI help is inspected for actual flags. Successful TOML parsing is syntax validation, not runtime schema loading; a live strict-config execution remains in the matrix below.

## Target-project acceptance (pending until observed)

| Case | Required evidence |
| --- | --- |
| Trusted project / config | Real Codex loads all installed native roles/skills without strict-config errors; root behaves as Orchestrator and workers inherit the selected model |
| Single worktree dispatch | Child returns actual task root/branch/base, role, current PLAN/Task/ACs; writes only assigned surfaces; primary remains in root |
| Two independent tasks | Two child PIDs/session identities run concurrently in distinct roots; no cross-writes/shared services; isolated checks; at most two reservations |
| Dependency | Dependent task is rejected before accepted integration and starts from the integrated SHA afterward |
| Permissions | Audit actual parent sandbox, inherited app/MCP/tools/hooks; remote writes blocked outside authorized owner; mode/path restrictions checked against real diffs |
| Approval | Unapproved/canceled/stale/materially changed PLAN or design cannot start implementation; evidence updates alone do not request approval again |
| Greenfield | Tracked workflow/spec/design base works without prior application code; ignored local secrets/config are not silently copied |
| Candidate review | Writer exit proven; exact fingerprint, independent review/checks, source commits per WU and integrated checks observed; no DONE from a source commit |
| Integration/conflicts | Dirty coordinator doc preserved/checkpointed; serial integration; conflicts preserved and corrected only by scoped Implementation with renewed evidence |
| Recovery | Timeout/interruption parent/child liveness reconciled before retry; unknown/stale registry entries block; dirty/conflicted worktrees preserved |
| No images | Designer uses only native editable Pencil nodes/text; no direct or indirect captures/exports/generated images, including checks |
| Compact specs | One canonical document per feature, no stage/Task/report/context files; workers see current criteria without mutating canonical state |
| Engram | Actual aliases, isolated project recall, selected-fact save/read, complete mirror equality, stale evidence rejection and outage fallback; no assumed OpenCode lifecycle hook |
| Linear | User-selected team/project or no project, actual statuses/schema, owner-only managed issue/link updates with readback; no implicit org administration |
| GitHub | Authenticated exact catalog, authorized push/draft PR/title-body updates with exact head/base/SHA readback; no merge without explicit authorization |

Record actual receipts and limits in the application's canonical spec, not a second feature report. Keep unavailable provider checks pending; do not describe a draft template migration as a production-tested runtime.
