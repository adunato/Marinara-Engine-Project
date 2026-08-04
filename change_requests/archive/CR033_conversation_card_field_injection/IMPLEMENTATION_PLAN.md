# CR033 Implementation Plan

## Prerequisites

- Start from local nested application `main`.
- Use a dedicated `change/CR033-conversation-card-field-injection` worktree.
- Confirm the reported card has populated Description and Personality fields and that the selected Conversation prompt reproduces the false macro matches.

## Atomic Tasks

1. Restrict macro-alias matching to one `{{...}}` token.
2. Add a regression covering ordinary field-name prose between unrelated macros.
3. Inspect the focused diff and run the requested production build.
4. Commit the application change and fast-forward local nested `main`.
5. Remove the temporary worktree and archive the completed CR documentation.

## Files Affected

- `packages/server/src/services/generation/character-prompt-context.ts`
- `scripts/regressions/prompt.regression.ts`
- `change_requests/archive/CR033_conversation_card_field_injection/HLD.md`
- `change_requests/archive/CR033_conversation_card_field_injection/IMPLEMENTATION_PLAN.md`
- `change_requests/tracker.md`

## Verification

- Production application build completes successfully.
- Prompt regression fixture documents the reported bug shape and expected card-field inclusion.
- Local nested application `main` points at the committed fix.

## Rollback

Revert application commit `0d2808120` and remove the CR033 tracker/documentation entry if the constrained macro detection causes an unexpected compatibility issue.

