# CR014 Implementation Plan

## Prerequisites

- Base application work on nested `Marinara-Engine/main`.
- Preserve the existing Conversation `crossChatAwareness` metadata toggle and default-enabled behavior.

## Atomic Tasks

1. Refactor `awareness.service.ts` to select every other cross-chat-enabled Conversation sharing at least one current character.
2. Load source-chat metadata, persona names, and all source character names.
3. Format weekly/daily summaries and the complete visible transcript in clearly named structural sections.
4. Update the generation route call site and settings copy to describe the expanded scope.
5. Add a focused server regression for selection, formatting, attribution, and exclusions.
6. Run focused validation and `pnpm check`.
7. Commit the application branch, merge it into local nested `main`, update the CR tracker, and remove the temporary worktree.

## Files Affected

- `packages/server/src/services/conversation/awareness.service.ts`
- `packages/server/src/routes/generate.routes.ts`
- `packages/server/src/services/generation/conversation-memory-context.ts`
- `packages/client/src/components/chat/ChatSettingsDrawer.tsx`
- `scripts/regressions/cross-chat-awareness.regression.ts`
- `package.json`
- `change_requests/CR014_full_cross_chat_context/HLD.md`
- `change_requests/CR014_full_cross_chat_context/IMPLEMENTATION_PLAN.md`
- `change_requests/tracker.md`

## Verification

- Focused cross-chat awareness regression.
- Verify a multi-character current chat includes sources shared through either current character and excludes unrelated or disabled sources.
- `pnpm check` from the temporary application worktree.
- Clean Git status before worktree removal.

## Rollback

Revert the CR014 application commit and restore the previous awareness service's shared-character/time-window behavior.
