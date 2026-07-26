# CR012 Expanded Tracker Panel Implementation Plan

Status: Proposed — awaiting HLD approval
Date: 2026-07-26

## Prerequisites

- Obtain user approval for `HLD.md` before editing application code.
- Implement on `change/CR012-expanded-tracker-panel` from the current custom application `main`.
- Keep `upstream-main` untouched.
- Read the client instructions before editing frontend code.

## Atomic Tasks

1. Confirm current size-profile behavior
   - Verify the 280px, 340px, and 420px profile targets.
   - Confirm how the desktop layout constrains the preferred width beside the chat surface.

2. Increase the expanded target
   - Set the expanded desktop target to 840px.
   - Leave compact and standard unchanged.

3. Preserve responsive behavior
   - Ensure expanded width is clamped safely when the viewport cannot accommodate 840px.
   - Preserve existing mobile behavior.

4. Validate layout behavior
   - Exercise expanded Tracker layouts with custom fields, character cards, inventory, quests, and world state.
   - Confirm Conversation and Roleplay share the same size behavior.

5. Validate the application
   - Run `pnpm check`.
   - Build from the primary checkout after merge for manual validation.

## Expected Application Files

- `packages/client/src/stores/ui.store.ts`
- `packages/client/src/components/layout/AppShell.tsx` only if the existing responsive constraint prevents the expanded profile from being materially larger.
- Focused layout tests if an existing suitable test surface is available.

## Rollback

- Restore the expanded profile target to 420px.
- No data migration or cleanup is required.

