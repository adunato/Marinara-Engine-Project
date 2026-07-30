# CR018 Implementation Plan

Status: Implemented and focused validation passed on the CR branch; awaiting E2E decision and local `main` integration

## Prerequisites

- Base application work on nested `Marinara-Engine/main` using `change/CR018-scene-daily-memory-context` and a dedicated temporary worktree.
- Obtain approval for `HLD.md` before implementation because the Daily Memories snapshot definition and failure behavior affect prompt context.
- Preserve CR013's exact plan/create snapshot parity and CR015's read-only retrieval semantics.
- Keep prompt leaf content verbatim and clearly delimit Daily Memories from automatic summaries and transcript history.

## Atomic Tasks

1. Add focused regression fixtures proving the current CR013 scene snapshot omits Daily Memories that qualify for normal CR015 retrieval.
2. Extract or expose a read-only Daily Memories retrieval configuration path that checks Conversation enablement and normalizes retrieval settings without requiring memory formation.
3. Reuse the existing eligible-message query builder, embedding-source resolution, ranking, minimum-threshold filtering, and uncapped result semantics used by normal Conversation generation.
4. Add a formatter or formatter input that renders the resolved memories chronologically in a dedicated Daily Memories section while preserving stored text verbatim.
5. Extend the origin Conversation scene compiler to resolve stored Daily Memories and pass the optional result into `buildSceneConversationContext`.
6. Ensure `/scene/plan` captures the enriched value and `/scene/create` persists the exact plan-time capture; retain best-effort recompilation only for compatible callers that omit it.
7. Add bounded fail-open handling for disabled/unavailable configuration, empty queries, missing embeddings, no qualifying results, and retrieval failures.
8. Add regressions for retrieval parity, source separation, snapshot immutability across plan/create, fallback compilation, hidden-message exclusion, and absence of formation/storage writes.
9. Run the focused scene-context regression and a server-only TypeScript validation, then record the results in this plan.

## Expected Files and Areas

- `packages/server/src/routes/scene.routes.ts`
- `packages/server/src/services/conversation/scene-context.ts`
- `packages/server/src/services/conversation/daily-memory.service.ts`
- `packages/server/src/services/generation/daily-memory-agent-runtime.ts` or a focused read-only retrieval-settings resolver
- Existing memory-recall embedding-source resolution helpers used by `packages/server/src/routes/generate.routes.ts`
- `packages/server/src/routes/generate.routes.ts` if normal Conversation retrieval is refactored onto shared orchestration
- `scripts/scene-conversation-context.regression.ts`
- `package.json` only if a focused regression command needs adjustment

No client or database-schema changes are expected. If implementation analysis shows a shared contract or schema change is required, update and reapprove the HLD before adding it.

## Verification

- Build a fixture with an enabled Daily Memories agent, stored memories across multiple dates, deterministic embeddings, a configured last-message count, custom ranking weights, and a minimum-rank threshold.
- Confirm the scene snapshot contains exactly every qualifying memory and omits below-threshold memories, matching normal retrieval for the same query and capture time.
- Confirm the formatted Daily Memories are ordered by stored date and remain distinct from automatic-summary `keyDetails`, summary prose, and current-day transcript content.
- Confirm hidden-from-AI messages cannot change the Daily Memories query or selected result.
- Capture a plan, then add an origin message and edit stored Daily Memories before create; verify the created Roleplay persists the original plan-time snapshot unchanged.
- Confirm a legacy create request without `conversationContext` performs one best-effort fresh compilation.
- Confirm `/scene` succeeds without Daily Memories when the agent is disabled, no embedding source is available, no memories qualify, or retrieval throws.
- Confirm no missing-day generation, formation-provider call, memory write, embedding write, or agent-setting mutation occurs during scene compilation.
- Run the existing focused scene-context regression once after extension and one server-only TypeScript check.

## Completion Record

- Implemented in application commit `afbb2398f` on `change/CR018-scene-daily-memory-context`.
- Added a read-only Daily Memories settings resolver that never creates agent configuration or resolves the formation provider.
- Reused the existing CR015 retrieval query, embedding, ranking, minimum-threshold, and uncapped result behavior from `/scene` planning.
- Added a dedicated chronological `<daily_memories>` section to CR013's captured context while preserving memory text verbatim and keeping CR017 automatic-summary controls independent.
- Kept retrieval fail-open and preserved exact plan/create snapshot behavior, including the legacy create fallback.
- Extended `regression:scene-context`; it passed.
- Server-only `tsc --noEmit` passed.
- No client, schema, dependency-manifest, or release-metadata validation was required.
- Focused Playwright E2E and local `main` integration remain pending user agreement.

## Rollback

Revert the CR018 application commit. Existing scene captures are self-contained strings and remain readable; Daily Memory storage requires no migration or cleanup.
