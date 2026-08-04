# CR011 Conversation Custom Tracker Implementation Plan

Status: Implemented — merged into application main
Date: 2026-07-26

## Prerequisites

- Obtain approval for `change_requests/CR011_conversation_custom_tracker/HLD.md` before application implementation.
- Base application work on `change/CR011-conversation-custom-tracker` from the current nested `main`.
- Perform application changes in a dedicated temporary worktree.
- Read `AGENTS.md`, `Marinara-Engine/CONTRIBUTING.md`, and `Marinara-Engine/packages/client/.instructions.md` before editing application code.
- Coordinate the companion `Pasta-Devs/Marinara-Agents` Custom Tracker manifest change that adds Conversation to its supported modes.

## Atomic Tasks

1. Verify current Conversation tracker plumbing
   - Trace official-agent mode filtering from installed manifest through the Conversation agent picker.
   - Confirm Conversation generation loads and commits game-state snapshots for normal replies, regeneration, swipes, branches, and group turns.
   - Confirm committed tracker-context injection already runs for Conversation and identify any hard-coded `custom-tracker` or Roleplay assumptions that require narrow generalization.

2. Enable official Custom Tracker selection
   - Update Engine host filtering or presentation only where needed to accept a manifest that includes `conversation`.
   - Keep other official tracker agents restricted to their existing supported modes.
   - Do not add an Engine-owned copy of the official agent definition.

3. Reuse the existing persistence path
   - Continue accepting `custom_tracker_update` with a `fields` array.
   - Continue persisting fields in `game_state_snapshots.playerStats.customTrackerFields`.
   - Preserve field locks and manual values using the existing reconciliation helpers.
   - Correct any Conversation-specific snapshot selection or commit issues found during verification.

4. Add Conversation Custom Tracker UI
   - Extract or reuse the shared Custom Tracker field panel rather than copying Roleplay HUD code.
   - Add a compact Conversation-surface entry point visible only while Custom Tracker is active.
   - Support multiple fields, add/remove, name/value edits, and field locking.
   - Route manual edits through the current game-state store and patch APIs.
   - Provide clear empty and loading states.

5. Confirm prompt context behavior
   - Format committed fields through the existing compact Custom Tracker formatter.
   - Inject them into the next Conversation prompt as established state, not transcript text or instructions.
   - Ensure disabled/removed Custom Tracker agents no longer cause injection.
   - Preserve Roleplay prompt placement and formatting.

6. Handle lifecycle behavior
   - Verify normal next-turn commit behavior.
   - Verify regeneration and swipe changes restore the matching tracker snapshot.
   - Verify branching starts from the selected source message's state.
   - Verify deleting messages cannot leave the UI or prompt using a removed future snapshot.
   - Verify stored fields survive temporarily disabling the agent.

7. Add regression coverage
   - Multiple-field persistence and replacement.
   - Locked-field preservation.
   - Conversation committed-context formatting and injection.
   - Disabled-agent non-injection.
   - Regeneration/swipe/branch snapshot selection where existing regression helpers support it.
   - Roleplay regression for unchanged Custom Tracker behavior.

8. Update documentation
   - Update the official agent documentation to list Conversation support after the companion agent package is available.
   - Document where Conversation users open and edit Custom Tracker fields.
   - Clarify that Custom Tracker state is scoped to one chat and differs from Memory Recall and summaries.

9. Validate
   - Run focused regression commands added or affected by this change.
   - Run `pnpm check` from `Marinara-Engine/`.
   - Manually verify a multi-field Conversation tracker across at least two turns and one regeneration/swipe.
   - Agree with the user whether to create and run focused CR011 Playwright E2E coverage.

## Expected Engine Files

- `packages/server/src/routes/generate.routes.ts`
- `packages/server/src/services/generation/committed-tracker-context.ts`
- `packages/server/src/services/agents/agent-executor.ts` if mode-neutral tracker context needs adjustment
- `packages/client/src/components/chat/ChatArea.tsx`
- Conversation surface/toolbar component selected during implementation
- `packages/client/src/features/tracker-panel/components/sections/CustomTrackerPanel.tsx`
- `packages/client/src/stores/game-state.store.ts` if Conversation hydration needs adjustment
- Focused files under `scripts/regressions/`
- `docs/agents/built-in-agents.md`
- Relevant Conversation documentation

The exact client entry-point file should be chosen after reading the client instructions and confirming the existing Conversation layout boundaries. No database schema change is expected.

## Companion Repository Change

- Repository: `Pasta-Devs/Marinara-Agents`
- Change the official Custom Tracker manifest to include Conversation mode.
- Confirm the packaged prompt and `custom_tracker_update` output remain appropriate in both Roleplay and Conversation.
- Update package-level validation and catalog metadata as required by that repository.

## Verification Commands

```powershell
cd Marinara-Engine
pnpm check
```

Add and run the focused regression command selected during implementation. `pnpm db:push` is not required unless implementation unexpectedly changes storage schema.

## Rollback

- Revert the Engine commit and the companion official-agent manifest change.
- Existing `customTrackerFields` snapshots remain compatible with Roleplay and do not require destructive cleanup.
- Do not delete user tracker data during rollback.

## Completion

- Application implementation commit: `21351e48`
- Nested `main` merge commit: `fe50fb5a`
- Conversation settings picker fix: `cf05f215`; merged into nested `main` after validation.
- Focused validation: `pnpm regression:conversation-custom-tracker` — passed
- Baseline validation: `pnpm check` — passed
- Production validation: `pnpm build` from the updated nested `main` checkout — passed
- Focused Playwright E2E: 2 passed, covering selection through Chat Settings, multiple editable fields, desktop/mobile persistence, removal, model updates, lock preservation, committed-context injection, and disabled-agent behavior.
