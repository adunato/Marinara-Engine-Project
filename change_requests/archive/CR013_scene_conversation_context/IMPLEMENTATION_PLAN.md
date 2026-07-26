# CR013 Implementation Plan

## Prerequisites

- Base `change/CR013-scene-conversation-context` on local application `main`.
- HLD approved by the user on 2026-07-26.
- Perform all application edits from a dedicated temporary worktree.
- Preserve prompt-leaf content verbatim and keep scene context compilation read-only.

## Atomic Tasks

1. Add focused regression fixtures that capture the current mismatch between Conversation prompt history and `/scene` planning/creation context.
2. Extract or expose reusable Conversation history selection/formatting helpers for summaries, important key details, summary tails, older unsummarized history, and the full current logical day.
3. Implement a read-only scene context compiler using those shared rules without generating or persisting missing summaries.
4. Extend the shared scene plan/create contract with an opaque captured-context handoff, including validation and backward-compatible omission handling.
5. Replace `/scene/plan`'s last-20/2,000-character history with the compiled context snapshot.
6. Make `/scene/create` persist the exact planned snapshot in `sceneConversationContext`; recompile only for compatible callers that omit it.
7. Update scene prompt framing and fork-continuity wording so the value is treated as structured historical context rather than only a recent transcript.
8. Add route and prompt regression coverage for snapshot parity, deduplication, fallback behavior, and edge cases.
9. Run the dedicated scene-context regression and server-only TypeScript validation.

## Expected Files

- `packages/shared/src/types/scene.ts`
- `packages/shared/src/schemas/scene-analysis.schema.ts` or a focused scene request schema if introduced
- `packages/server/src/routes/scene.routes.ts`
- `packages/server/src/routes/generate/conversation-history-runtime.ts`
- A focused shared Conversation/scene context compiler under `packages/server/src/routes/generate/` or `packages/server/src/services/conversation/`
- `packages/server/src/services/generation/scene-context-runtime.ts`
- `packages/client/src/lib/scene-generation.ts`
- `packages/client/src/hooks/use-scene.ts`
- Focused server and prompt regression tests

## Verification

- Verify an origin chat with several summarized weeks/days and a long current day gives the scene planner the same eligible continuity as normal Conversation generation.
- Verify the created roleplay persists exactly the planner's captured context even if a new origin message arrives between plan and create.
- Verify current-day messages are not clipped by the former message-count or 3,000-character limits.
- Verify summarized history is not duplicated when daily summaries are covered by a weekly summary.
- Verify hidden-from-AI messages remain excluded and prompt leaf content remains unescaped.
- Run the focused prompt/server regression command(s).
- Run a server-only TypeScript check against the updated shared declarations.

## Result

- Closed and archived on 2026-07-26.
- Implemented in application commit `d62923e8`.
- Fast-forwarded into local application `main` at `d62923e8`.
- `pnpm regression:scene-context` passed.
- Server-only TypeScript validation passed.

## Rollback

Revert the CR013 application commit. The change is limited to context compilation and an additive/backward-compatible request handoff; existing scene metadata remains readable as a string.
