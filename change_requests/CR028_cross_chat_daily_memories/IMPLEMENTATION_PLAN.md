# CR028: Cross-Chat Daily Memory Awareness Implementation Plan

Status: In progress

## Prerequisites

- Base application work on nested `Marinara-Engine/main` through `change/CR028-cross-chat-daily-memories` in a dedicated worktree.
- Preserve the CR014 source-chat boundary and CR015 Daily Memories storage contract.

## Atomic Tasks

1. Add a Daily Memories helper that returns the latest dated non-empty memory day for a Conversation without embeddings or ranking.
2. Extend awareness source formatting with a distinct latest-day Daily Memories section.
3. Load each qualifying source Conversation's latest Daily Memories while assembling awareness.
4. Extend the Cross-Chat Awareness regression for inclusion and exclusions.
5. Run focused validation, commit the application change, merge it into local application `main`, update this CR and the tracker, and remove the worktree.

## Expected Files

- `packages/server/src/services/conversation/daily-memory.service.ts`
- `packages/server/src/services/conversation/awareness.service.ts`
- `scripts/regressions/cross-chat-awareness.regression.ts`
- `change_requests/CR028_cross_chat_daily_memories/HLD.md`
- `change_requests/CR028_cross_chat_daily_memories/IMPLEMENTATION_PLAN.md`
- `change_requests/tracker.md`

## Verification

- Confirm only the latest dated non-empty Daily Memory day is included.
- Confirm all memories from that day retain their importance and source attribution.
- Confirm no awareness section is added when the source has no saved Daily Memories.
- Run `pnpm regression:cross-chat-awareness` and server TypeScript validation.

## Rollback

Revert the CR028 application commit. No storage migration or cleanup is required.

