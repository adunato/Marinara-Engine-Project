# CR015 Implementation Plan

Status: Complete — implemented, validated, and merged into local application `main`

## Prerequisites

- Base application work on nested `Marinara-Engine/main` using `change/CR015-daily-conversation-memories` and a dedicated temporary worktree.
- Obtain approval for the updated HLD before implementation.
- Read `packages/client/.instructions.md` before editing client code.
- Trace the built-in agent manifest/editor, chat-agent enablement, Conversation summary editor and backfill endpoint, current memory recall/vector services, timezone helpers, and generation context assembly before selecting concrete reuse points.

## Atomic Tasks

1. Define shared daily-memory records, agent settings, normalized ranking configuration, formation response validation, and API request/response contracts.
2. Add the Daily Conversation Memories built-in agent manifest, default editable formation prompt, handover setting, recent-message count, ranking-weight controls, and formation connection selection.
3. Add persistence for stable per-memory IDs, Conversation/date ownership, text, 1–5 importance, and embedding/index linkage; add a schema migration if required.
4. Implement completed-window calculation as the exact 24 hours preceding each configured handover in the Conversation timezone.
5. Implement automatic formation for newly completed windows, structured JSON parsing, server-assigned dates, retry/failure recording, and embedding-on-write.
6. Add APIs for listing all day-grouped memories and for adding, editing, or deleting individual memories.
7. Add APIs for deleting a day's complete memory set, regenerating a completed day from scratch, and generating a specific missing completed day; reject current-window operations.
8. Implement fast retrieval by embedding the configured last `N` messages, vector-prefiltering candidates, and deterministically reranking them with normalized semantic, importance, and recency factors.
9. Inject selected memories into Conversation generation context as clearly delimited, date-grouped entries without invoking an LLM during retrieval.
10. Add a Conversation-level Daily Memories editor modeled on `SummariesEditorModal`, with expandable days, editable text and score controls, add/delete actions, day deletion, missing-day generation, destructive regeneration confirmation, save/cancel, and complete loading/error/empty states.
11. Add focused server/shared/client tests for formation, lifecycle operations, ranking, feature combinations, and UI behavior.
12. Run schema verification if applicable and the repository baseline `pnpm check`; document the outcome.
13. Add the user-requested focused Playwright API and browser validation for CR015.
14. Commit the completed application branch, merge it into the requested local branch, update the tracker, and clean up the temporary worktree.

## Expected Files and Areas

Exact paths should be finalized after implementation analysis. Expected areas include:

- Built-in agent manifests, defaults, shared agent settings, and `AgentEditor` configuration controls.
- Shared daily-memory types, validation schemas, chat metadata or dedicated persistence models, and API contracts.
- Server formation scheduling, timezone/window helpers, failure tracking, embedding/index maintenance, and storage services.
- Existing memory-recall embedding/vector infrastructure where it can be reused without coupling the two features' stored data.
- Conversation generation runtime and context formatting.
- Conversation chat hooks and a Daily Memories editor modeled on `packages/client/src/components/chat/SummariesEditorModal.tsx`.
- Conversation settings or summary-management entry point used to open the editor.
- Focused unit, integration, regression, and optionally E2E tests.
- `change_requests/CR015_daily_conversation_memories/HLD.md`
- `change_requests/CR015_daily_conversation_memories/IMPLEMENTATION_PLAN.md`
- `change_requests/tracker.md`

## Verification

- Verify automatic formation reads exactly the eligible completed 24-hour window and never the current incomplete window.
- Verify the default prompt accepts zero through ten short-paragraph memories, assigns the completed-day date server-side, and rejects invalid 1–5 scores.
- Verify formation uses its selected LLM connection while retrieval makes no LLM request.
- Verify create/edit/regenerate operations refresh embeddings and delete operations remove vector-search eligibility.
- Verify manual generation and regeneration operate on one selected completed day and regeneration replaces that day's existing memories only after confirmation.
- Verify the default 50/35/15 ranking and configured alternatives change ordering predictably, including score-5 importance boosts and recency decay.
- Verify daily memories work when automatic summaries and current memory recall are independently enabled or disabled.
- Verify date-grouped runtime formatting and editor behavior across desktop and narrow layouts.
- Run focused automated coverage, `pnpm db:push` when applicable, and `pnpm check` from the temporary application worktree.
- Verify clean Git status before worktree removal.

## Completion Record

- Application commits: `5ff1fbcb` and `8da9b278`, fast-forwarded into nested application `main`.
- Shared/server/client TypeScript validation passed; focused ESLint passed for every changed client file.
- `pnpm build` passed in the primary nested checkout and produced current server and client artifacts.
- Focused Playwright validation passed: 3 tests covering built-in Agent Settings visibility/configuration, formation, embedding persistence, edited lifecycle data, ranked injection, and the day-grouped Conversation editor.
- The broad `pnpm check` could not complete because the full client ESLint process exhausted several gigabytes and timed out; its constituent server check, focused changed-file client lint, source typechecks, and production build passed.
- `pnpm db:push` is not defined by this file-native-storage checkout; the new tables are registered in the schema, file-backed table catalog, and chat cascade graph instead.

## Rollback

Revert the CR015 application commits and disable/remove the built-in agent registration and generation hook. Preserve or migrate persisted daily-memory records safely if rollback crosses a schema boundary; do not leave orphaned vector entries.
