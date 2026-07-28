# CR016 Implementation Plan

Status: Completed

## Implementation Outcome

- Implemented on `change/CR016-daily-intentions` in application commit `24de9d16` and fast-forwarded into local application `main`.
- Corrected the offline context contract in `ece0465c` so transcript input is a rolling 24-hour timestamp window plus summaries and persisted Daily Memories, rather than prompt-preview or last-N context.
- Corrected the managed add flow and global editor in `3bee031f` so Daily Intentions explains its fixed context contract and no longer exposes generic last-N-message, output-budget, shared-connection, or shared-prompt controls.
- Stored Conversation-scoped settings and current-only outputs in existing chat metadata, so no database schema change or `db:push` was required.
- Added the built-in manifest, fixed-area normalization, single-character eligibility, clean comprehensive context snapshots, sequential independent generation, immediate replace-on-success persistence, normal Conversation context injection, and Conversation configuration/editor UI.
- Added focused CR016 Playwright API/UI coverage under `tests/e2e/specs/change-requests/CR016/`.

## Recorded Validation

- `pnpm check` passed in the CR016 application worktree (shared/server type checks, full client ESLint, and production builds). The only lint warning was pre-existing in `HomeProfessorMariChat.tsx`.
- `pnpm e2e -- tests/e2e/specs/change-requests/CR016/daily-intentions.spec.ts --project=chromium` passed in the primary checkout: 4 tests.
- Playwright evidence verified fixed ordering, disabled-area skipping, sequential partial success, failed-value preservation, prior-intention exclusion, immutable Run All context, current enabled-output injection, multi-character blocking with data preservation, and the configuration/run/edit UI flow.
- The amended Playwright evidence additionally verified inclusion of a 23-hour message, exclusion of a 25-hour message, and inclusion of summary and persisted Daily Memory markers after the Daily Memories agent was deactivated.
- The mobile Playwright regression verified the add dialog explains the fixed context and omits `Agent Budget`, `Context Size`, and `Max Output Tokens` controls.
- `pnpm --filter @marinara-engine/client lint` passed with one pre-existing `HomeProfessorMariChat.tsx` hook-dependency warning.
- `pnpm build` passed in the primary application checkout after the local-main merge.

## Prerequisites

- Base application work on nested `Marinara-Engine/main` using `change/CR016-daily-intentions` and a dedicated temporary worktree.
- Obtain approval for `HLD.md` before implementation.
- Read `AGENTS.md`, `Marinara-Engine/CONTRIBUTING.md`, and `Marinara-Engine/packages/client/.instructions.md` before editing application or client code.
- Trace the CR015 Daily Conversation Memories manifest, runtime resolution, persistence, routes, Conversation settings controls, editor modal, query hooks, context injection, and failure handling before selecting reuse points.
- Trace normal one-character Conversation context assembly so offline intention calls reuse the same enabled sources and budgets while explicitly excluding Daily Intentions.
- Confirm the canonical one-character eligibility check and the safest Conversation-scoped persistence model before modifying schemas.

## Atomic Tasks

1. Define the shared Daily Intentions agent identifier, four stable area keys, fixed order, default headings, four self-contained default prompts, per-chat settings types, current-output types, and API contracts.
2. Register Daily Intentions as an opt-in built-in agent allowed only in Conversation mode, without adding a shared behavioral prompt.
3. Add and test the canonical eligibility rule for Conversations containing exactly one character; preserve data but stop runtime behavior when a chat becomes multi-character.
4. Add Conversation-scoped persistence for connection selection, informational cutoff time, four area configurations, one current output per area, and minimal operational timestamps/state. Register new file-native tables and chat cascade relationships if dedicated tables are used.
5. Implement configuration normalization and migration-safe defaults so existing chats can activate the four fixed areas without stored data and invalid settings cannot add, remove, or reorder area keys.
6. Extract or reuse comprehensive Conversation context assembly for offline generation, using the preceding 24 hours of visible messages plus summaries and persisted Daily Memories while excluding Daily Intentions from every area call.
7. Implement single-area generation with the selected connection/fallback behavior, self-contained area prompt, first-person free-text validation, timeout/error handling, and replace-on-success persistence.
8. Implement Run All as a sequential orchestrator over enabled areas using one immutable context snapshot; persist and report each success immediately, continue after failures, and retain each failed area's previous value.
9. Add concurrency protection so overlapping full and per-area runs cannot race to replace the same output.
10. Add server routes for reading/updating per-chat configuration, reading/saving current outputs, running one area, and running all areas with progressive or per-area result reporting appropriate for immediate UI updates.
11. Inject current enabled outputs into normal eligible Conversation generation as a clearly delimited, character-identified `Daily Intentions` section, separate from memories, summaries, schedules, and transcript content.
12. Add Daily Intentions controls to Conversation agent settings: connection, clearly informational cutoff, fixed area enablement, editable heading, editable prompt, and reset-to-default behavior.
13. Add a Conversation-level Daily Intentions editor modeled on `DailyMemoriesEditorModal`, with current-only area cards, editable paragraph text, Run/Re-run per area, Run/Re-run All, save/cancel, destructive unsaved-edit protection, and per-area progress/success/error states.
14. Ensure a full run updates each successful area in the UI before continuing, leaves failed values visible, and permits failed areas to be retried individually.
15. Add focused shared/server/client tests for eligibility, normalization, context exclusion, sequential partial success, current-only replacement, manual editing, disabled areas, injection, persistence, concurrency, and failure degradation.
16. Run schema verification when applicable and `pnpm check`; record the results in this plan.
17. Add the user-approved focused CR016 Playwright E2E validation through `$marinara-e2e-validation`.
18. Commit the completed application branch, merge it into the requested local branch after approval and validation, update `change_requests/tracker.md`, and clean up the temporary worktree.

## Expected Files and Areas

Exact paths should be finalized after implementation tracing. Expected areas include:

- `packages/shared/src/features/agents/core-agent-manifests.ts` and adjacent agent manifest/default-setting types.
- Shared chat, agent, Daily Intentions, and API contract types or schemas.
- `packages/server/src/db/schema/` and `packages/server/src/db/file-backed-store.ts` if dedicated Conversation-scoped tables are introduced.
- A new server Daily Intentions service and runtime resolver under `packages/server/src/services/conversation/` and/or `packages/server/src/services/generation/`.
- A new Daily Intentions route module and registration in `packages/server/src/routes/index.ts`.
- Conversation context assembly and `packages/server/src/routes/generate.routes.ts` or the narrower prompt-injection abstraction identified during tracing.
- `packages/client/src/components/chat/ChatSettingsDrawer.tsx` for activation, settings, and the current-output entry point.
- A new `packages/client/src/components/chat/DailyIntentionsEditorModal.tsx` and, if useful, a focused area-configuration modal.
- A new client query/mutation hook such as `packages/client/src/hooks/use-daily-intentions.ts`.
- Focused shared/server/client test files and optional CR016 Playwright artifacts if separately approved.
- Parent-only `change_requests/CR016_daily_intentions/HLD.md`, `IMPLEMENTATION_PLAN.md`, and `change_requests/tracker.md` bookkeeping.

## Verification

- Confirm Daily Intentions can be activated and used only for a Conversation with exactly one character.
- Confirm all four stable areas appear in fixed order and only heading, prompt, and enabled state are editable.
- Confirm the cutoff persists but does not schedule, gate, expire, or trigger anything.
- Confirm Run All snapshots comprehensive context once, excludes prior intentions, runs enabled areas sequentially, and never feeds earlier results to later prompts.
- Confirm each successful area persists and appears immediately, failures retain previous values, and processing continues after a failed area.
- Confirm a per-area rerun and manual save affect only the selected output.
- Confirm disabled areas retain data but do not run or inject.
- Confirm only the current value exists for each area after replacement and no history/backfill API or UI is exposed.
- Confirm eligible normal generations receive a delimited Daily Intentions section with current renamed headings and first-person text, while ineligible chats do not.
- Confirm missing connections, invalid/empty responses, timeouts, concurrent-run attempts, and persistence failures do not erase prior outputs or block ordinary chat generation.
- If schema changes are introduced, run `pnpm db:push` when the command is available for this checkout; otherwise verify file-native schema registration and cascade behavior through focused tests.
- Run `pnpm check` once as the baseline cross-cutting validation.
- If the user approves focused E2E, cover single-character eligibility, configuration, manual full/individual execution, partial failure retention, editing, disabling, and context injection with CR016 annotations and evidence.

## Rollback

- Disable or remove the Daily Intentions built-in agent registration and context-injection hook.
- Remove its routes and UI entry points while leaving unrelated Daily Memories and Conversation context behavior unchanged.
- Preserve or explicitly migrate persisted Conversation-scoped configuration and current outputs if rollback crosses a schema boundary; do not leave orphaned records or broken chat cascades.
- Revert CR016 application commits without reverting CR015 or unrelated user changes.
