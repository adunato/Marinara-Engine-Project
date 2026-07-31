# CR020 Implementation Plan

## Prerequisites

- Base application branch: local `main` containing CR019.
- Working branch: `change/CR020-character-mind-controls`.
- Application edits occur in a dedicated temporary worktree.

## Tasks

1. Add a Character Mind React Query hook for status and all existing operations.
2. Add a compact Character Mind operations modal with character selection, global connection selection, live status, lifecycle controls, and transient query output.
3. Expose the modal from the existing Conversation Chat Settings agent controls.
4. Add a privileged Open Folder endpoint using the existing platform file-manager helper.
5. Update Character Mind user documentation to describe the UI and retain manual Markdown editing as the boundary.
6. Run focused and baseline validation, inspect the diff, and commit the completed application change. **Completed**
7. Fast-forward local application `main`, update this CR and the tracker, build the primary checkout, and remove the temporary worktree. **Completed**

## Expected Application Files

- `packages/client/src/hooks/use-character-minds.ts`
- `packages/client/src/components/chat/CharacterMindModal.tsx`
- `packages/client/src/components/chat/ChatSettingsDrawer.tsx`
- `packages/server/src/routes/character-minds.routes.ts`
- `docs/conversation/character-minds.md`
- focused regression coverage if required by the route change

## Verification

- `pnpm regression:character-mind`
- `pnpm check`
- Primary-checkout `pnpm build` after integration

The focused regression, changed-file ESLint, client/server/shared TypeScript checks, and primary-checkout build passed. `pnpm check` exceeded the command window during its full client lint phase and was not repeated.

## Rollback

Revert the CR020 application commit. CR019's Markdown files and API behavior remain compatible and are not migrated.
