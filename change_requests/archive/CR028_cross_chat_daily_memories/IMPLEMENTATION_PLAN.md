# CR028: Cross-Chat Daily Memory Awareness Implementation Plan

Status: Complete — implemented, validated, and merged into local application `main`

## Prerequisites

- Base application work on nested `Marinara-Engine/main` through `change/CR028-cross-chat-daily-memories` in a dedicated worktree.
- Preserve the CR014 source-chat boundary and CR015 Daily Memories storage contract.

## Atomic Tasks

1. Define and validate a lightweight snapshot for the complete result of the last Daily Memories retrieval query.
2. Persist every successful retrieval result, including empty results, through queued chat-metadata patching without touching chat recency.
3. Extend awareness source formatting with the snapshot's complete multi-day result set and query timestamp.
4. Read the persisted snapshot from each qualifying source Conversation without rerunning retrieval or ranking.
5. Extend the Cross-Chat Awareness regression for inclusion, full multi-day scope, malformed data, and exclusions.
6. Run focused validation, commit the application change, merge it into local application `main`, update this CR and the tracker, and remove the worktree.

## Expected Files

- `packages/server/src/services/conversation/daily-memory.service.ts`
- `packages/server/src/services/conversation/awareness.service.ts`
- `packages/server/src/routes/generate.routes.ts`
- `scripts/regressions/cross-chat-awareness.regression.ts`
- `change_requests/CR028_cross_chat_daily_memories/HLD.md`
- `change_requests/CR028_cross_chat_daily_memories/IMPLEMENTATION_PLAN.md`
- `change_requests/tracker.md`

## Verification

- Confirm the snapshot includes every memory returned by the last retrieval query, even when results span multiple dates.
- Confirm awareness does not add unrelated stored memories or rerank the saved results.
- Confirm all selected memories retain their date, importance, and source attribution.
- Confirm successful empty results clear prior results and add no awareness subsection.
- Run `pnpm regression:cross-chat-awareness` and server TypeScript validation.

## Rollback

Revert the CR028 application commit. No storage migration or cleanup is required.

## Completion Record

- Application commit `1e5be8dfd` was fast-forwarded into nested application `main`.
- Each successful Daily Memories retrieval now snapshots its complete selected result set, including results spanning multiple dates and successful empty results.
- Cross-Chat Awareness reads the source Conversation's saved snapshot without rerunning embeddings, ranking, or minimum-rank filtering.
- `pnpm regression:cross-chat-awareness` passed with complete multi-day result, formatting, malformed snapshot, and empty-result coverage.
- Server TypeScript validation passed with `pnpm --filter @marinara-engine/server lint`.
- The integrated primary-checkout `pnpm build` passed and produced current server and client artifacts.
