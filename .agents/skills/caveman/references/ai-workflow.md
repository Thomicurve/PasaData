# AI-Workflow V2 — internal communication

## Versioning

V1 is the integrated Story Writer baseline. V1.1 introduces Caveman lite for internal communication. Increase the minor version for each subsequent compatible workflow change; use a major version for incompatible contracts or responsibilities. Record date, reason, affected roles, validation, PR/commit, and proposed/integrated status in Notion. A draft PR does not make its version active. Verify integration before promoting the active version.

## Scope and precedence

Load `caveman` from `.agents/skills/caveman/SKILL.md` and select `lite` explicitly. This workflow policy restricts its session-wide default: apply it only to Orchestrator/subagent delegations, internal status summaries, handoffs, and review feedback. Preserve the configured artifact language. User communication remains natural, concise prose.

Role instructions, approved artifacts, output contracts, gates, permissions, and explicit user decisions take precedence over Caveman style. Do not let its default `full`, session persistence, or ban on tool-call narration change user-facing progress/approval communication.

## Preserve meaning and contracts

Keep every required output field and section, including explicit empty values required by the contract. Keep exact IDs, status/verdict/readiness/severity enums, artifact versions, paths, symbols, commands, errors, numbers, units, evidence references, approval evidence, conditions, negations, scope exclusions, dependencies, unresolved questions, and uncertainty. Remove filler and repeated explanation, not information needed to decide or execute.

Use short complete sentences. Do not invent abbreviations, relabel states, translate identifiers, omit qualifications, or turn unknowns into facts. Return normal prose whenever compression obscures causality, ordering, constraints, security findings, or a decision.

## Artifacts and persistence

The ODD feature document, optional product/Story/plan sections, Tasks, design documentation, persisted evidence, code/comments, commits, PR/issue bodies, and Notion documentation remain normal clear prose with complete contracts.

When an agent returns document content inside a handoff, the document body remains normal prose; only the surrounding internal coordination may use lite. Orchestrator persists full document content, not a compressed synopsis. If a handoff will itself be saved as evidence, its evidence/report body must already use normal prose. Never reconstruct omitted requirements from a summary.

ODD routing, approval and completion are defined in `.codex/workflow/docs/odd-workflow.md`, not V1's stage chain. Story Writer remains the exclusive author of optional Stories with edit denied; Orchestrator validates and persists them in the feature document. Keep current user plan/design approval, required checking/review and scoped Git authorization. Separate PRD/spec/Story/plan files are not required.

## Orchestrator delegation

Select `caveman lite` for every internal delegation and tell the recipient whether the output contains document content or a report to persist. Use the existing required context and output contract without pasting the whole skill or unrelated conversation into every prompt. Subagents load the local skill once per invocation/context; do not infer inherited activation.

Missing skill/policy: report the loading gap and use concise normal prose with the full contract. Style unavailability alone does not block an otherwise valid stage; never claim Caveman loaded when it did not.

## Validation limits

Declared permissions and instructions require verification in the actual Codex runtime. Do not claim token savings without measurement. Compare representative delegations with/without lite, including input/output token totals, skill-loading cost, and contract completeness. No proxy, cavecrew agents, caveman-review, or caveman-compress is introduced by V1.1.

## Two-layer memory

Selected durable facts and the full feature mirror remain normal complete prose. Never compress the mirror into a coordination synopsis; `.codex/workflow/docs/engram-memory.md` defines exact full-body readback. V1 stage/approval wording in the Caveman skill itself is not authority over the V2 workflow.
