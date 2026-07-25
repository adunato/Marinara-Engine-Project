# CR010 Implementation Plan

## Prerequisites

- Base the application branch on current `upstream-main`.
- Work only from the CR010 temporary application worktree.
- Preserve the existing `connectedChatId` contract.

## Atomic Tasks

1. Add shared context-source types and request validation.
2. Add the `chat_context_sources` file-native table and storage operations.
3. Add chat API endpoints to list and replace a Roleplay chat's sources.
4. Compile bounded source summaries and recent transcripts for Roleplay prompts.
5. Inject the compiled source block into Roleplay generation only.
6. Add React Query hooks for reading and replacing source selections.
7. Add the simple multi-select to the Roleplay setup wizard.
8. Add the editable Source Chats section to Roleplay Chat Settings.
9. Add focused regression tests and update user documentation.
10. Run database, focused, and baseline validation.

## Expected Files

- `packages/shared/src/types/chat.ts`
- `packages/shared/src/schemas/chat.schema.ts`
- `packages/shared/src/index.ts`
- `packages/server/src/db/schema/chats.ts`
- `packages/server/src/services/storage/chats.storage.ts`
- `packages/server/src/routes/chats.routes.ts`
- `packages/server/src/routes/generate.routes.ts`
- `packages/server/src/routes/generate/*`
- `packages/client/src/hooks/use-chats.ts`
- `packages/client/src/components/chat/ChatSetupWizard.tsx`
- `packages/client/src/components/chat/ChatSettingsDrawer.tsx`
- Focused server/client regression files
- `docs/chats/connected-chats.md`

## Verification

- Run focused unit or regression coverage for source storage and prompt assembly.
- Run `pnpm db:push`.
- Run `pnpm check`.
- Manually verify the Source Chats selector in RP setup and settings when practical.

## Rollback

Revert the CR010 application commit. The new table is additive, and existing Connected Chat data remains untouched.

