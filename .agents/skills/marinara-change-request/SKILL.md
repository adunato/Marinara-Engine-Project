---
name: marinara-change-request
description: Route Marinara Engine change-request work through its shared contract and focused lifecycle stage skills.
---

# Marinara Change Request

Use this index only in `Marinara-Engine-Project/`. It is the entry point for one decomposed Marinara CR workflow, not a competing adapter workflow. Read [SHARED_CONTRACT.md](SHARED_CONTRACT.md) before selecting a stage skill.

## Stage Skills

| Need | Skill |
| --- | --- |
| Number and open a CR | [`$marinara-change-request-intake`](../marinara-change-request-intake/SKILL.md) |
| Draft or approve the design and plan | [`$marinara-change-request-planning`](../marinara-change-request-planning/SKILL.md) |
| Create or retire the nested application worktree | [`$marinara-change-request-worktree`](../marinara-change-request-worktree/SKILL.md) |
| Implement approved application work | [`$marinara-change-request-implementation`](../marinara-change-request-implementation/SKILL.md) |
| Independently inspect completed work | [`$marinara-change-request-review`](../marinara-change-request-review/SKILL.md) |
| Run proportionate checks and E2E work | [`$marinara-change-request-validation`](../marinara-change-request-validation/SKILL.md) |
| Prepare local integration, release, or upstream contribution | [`$marinara-change-request-ship`](../marinara-change-request-ship/SKILL.md) |
| Close, supersede, or archive a CR | [`$marinara-change-request-close`](../marinara-change-request-close/SKILL.md) |

Use only the stages needed for the request. For an explicitly directed trivial change, use the fast path in the shared contract: combine minimal CR bookkeeping with implementation rather than creating a separate approval or documentation checkpoint.

Kangentic loads the committed parent-root [`kangentic.json`](../../../kangentic.json) as this workflow's shared board source. Use [KANGENTIC_STAGE_MAPPING.md](KANGENTIC_STAGE_MAPPING.md) with it for lifecycle authority and the documented schema limits. Runtime `.kangentic/config.json` is machine-local and ignored; do not edit it to change the shared workflow.
