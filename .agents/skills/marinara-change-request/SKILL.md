---
name: marinara-change-request
description: Route Marinara Engine change-request work through its shared contract and focused lifecycle stage skills.
---

# Marinara Change Request

Use this index only in `Marinara-Engine-Project/`. It is the entry point for one decomposed Marinara CR workflow, not a competing adapter workflow. Read [SHARED_CONTRACT.md](SHARED_CONTRACT.md) before selecting a stage skill.

## Stage Skills

| Need | Skill |
| --- | --- |
| Number and open a CR | `$marinara-change-request-intake` |
| Draft or approve the design and plan | `$marinara-change-request-planning` |
| Create or retire the nested application worktree | `$marinara-change-request-worktree` |
| Implement approved application work | `$marinara-change-request-implementation` |
| Independently inspect completed work | `$marinara-change-request-review` |
| Run proportionate checks and E2E work | `$marinara-change-request-validation` |
| Prepare local integration, release, or upstream contribution | `$marinara-change-request-ship` |
| Close, supersede, or archive a CR | `$marinara-change-request-close` |

Use only the stages needed for the request. For an explicitly directed trivial change, use the fast path in the shared contract: combine minimal CR bookkeeping with implementation rather than creating a separate approval or documentation checkpoint.

For a manual Kangentic setup, use [KANGENTIC_STAGE_MAPPING.md](KANGENTIC_STAGE_MAPPING.md). It is the authoritative mapping reference for this package; it is not a board configuration file.
