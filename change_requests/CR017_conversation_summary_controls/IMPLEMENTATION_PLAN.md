# CR017 Implementation Plan

Status: Proposed — awaiting HLD approval

## Prerequisites

- Base application work on nested `Marinara-Engine/main` using `change/CR017-conversation-summary-controls` and a dedicated temporary worktree.
- Obtain approval for `HLD.md` before implementation because connection fallback and prompt-consumer scope are behavior-bearing decisions.
- Read `packages/client/.instructions.md` before editing client code.
- Reconfirm the normal generation, manual backfill, Conversation history, cross-chat awareness, scene context, Roleplay context-source, and schedule-continuity paths identified during CR creation.

## Atomic Tasks

1. Add shared `ChatMetadata` definitions and defaults/normalizers for a dedicated Conversation summary connection and summary-memory prompt-inclusion setting.
2. Implement one server-side Conversation summary connection resolver that defaults to the chat connection, validates explicit text connections, supports the local sidecar as applicable, and wraps valid primaries with the existing agent fallback provider.
3. Refactor `prepareConversationPromptHistory` to receive/use the resolved summary provider independently of the main chat response provider while preserving non-blocking automatic-summary failure behavior.
4. Update the manual backfill endpoint to use the same resolver and return an actionable error for a missing or unusable explicit selection.
5. Add a centralized compatibility helper for summary-memory inclusion, with missing metadata resolving to `true`.
6. Gate `keyDetails` formatting in normal Conversation history and every other Conversation-summary prompt consumer, while leaving summary prose formatting unconditional.
7. Add the language-connection selector and prompt-inclusion toggle to Conversation Chat Settings > Automatic Summarization, including default, missing-selection, pending, and explanatory states.
8. Add focused tests for metadata defaults, connection selection/error/failover, retained generation/storage of key details, and inclusion/exclusion across all prompt builders.
9. Run the repository baseline `pnpm check` from the CR worktree and document validation results.
10. Commit implementation, merge it into the requested local branch after approval/validation, update the tracker, clean the temporary worktree, and discuss focused CR017 Playwright E2E validation.

## Expected Files and Areas

- `packages/shared/src/types/chat.ts`
- Shared chat metadata schemas/default helpers if implementation requires explicit validation.
- `packages/server/src/routes/generate/conversation-history-runtime.ts`
- `packages/server/src/routes/generate.routes.ts`
- `packages/server/src/routes/chats.routes.ts`
- A shared Conversation summary connection-resolution service under `packages/server/src/services/conversation/` or the existing chat-summary service area.
- `packages/server/src/services/conversation/awareness.service.ts`
- `packages/server/src/services/conversation/scene-context.ts`
- `packages/server/src/routes/generate/roleplay-context-sources.ts`
- `packages/server/src/routes/conversation.routes.ts` and any other verified summary-entry prompt consumers.
- `packages/client/src/components/chat/ChatSettingsDrawer.tsx`
- Focused server/shared/client test files adjacent to the affected units.
- `change_requests/CR017_conversation_summary_controls/HLD.md`
- `change_requests/CR017_conversation_summary_controls/IMPLEMENTATION_PLAN.md`
- `change_requests/tracker.md`

## Verification

- Confirm existing chats with neither field set continue to summarize on the normal chat connection and inject both summary prose and key details.
- Confirm the selected summary connection handles automatic day generation, week consolidation, and manual backfill without changing the main response connection.
- Confirm missing/deleted and non-language selections are visible/actionable and cannot silently fall back to the chat connection.
- Confirm provider runtime fallback still uses the configured agent fallback after resolving a valid selected primary.
- Confirm excluded key details remain persisted, editable, exportable, and available to weekly consolidation.
- Confirm excluded key details do not appear in normal Conversation prompts, cross-chat awareness, scene context, explicit Roleplay context sources, or schedule-continuity prompts.
- Confirm summary prose remains in all of those prompt paths and current/unsummarized transcript behavior is unchanged.
- Confirm Chat Settings controls persist sequential changes without stale metadata overwrites and remain usable on narrow layouts.
- Run focused automated coverage and one baseline `pnpm check`; do not add redundant broad checks.
- Verify clean Git status before removing the implementation worktree.

## Rollback

Revert the CR017 application commits. Existing persisted metadata fields can remain harmlessly ignored by older code; summary entries require no migration because their schema is unchanged. If only the prompt toggle is reverted, restore the compatibility default that always includes `keyDetails` so older behavior is explicit.
