# CR019 Implementation Plan

Status: Proposed

## Prerequisites

- Base application work on nested `Marinara-Engine/main` using `change/CR019-compiled-character-mind` and a dedicated temporary worktree.
- Obtain approval for the rewritten `HLD.md` before application implementation.
- Read `AGENTS.md`, `Marinara-Engine/CONTRIBUTING.md`, and `Marinara-Engine/packages/client/.instructions.md` before editing application or client code.
- Trace CR015 Daily Memories persistence, embeddings, editor, and pre-generation formation path.
- Trace CR016 single-character eligibility, managed-agent configuration, offline model calls, and Conversation injection path.

## Atomic Tasks

1. Define the shared `MindSourceRef`, `MindPage`, `CharacterMindDocument`, `MindPageUpsert`, compilation-result, and appraisal contracts exactly as approved in the HLD.
2. Register Compiled Character Mind as an opt-in, managed, single-character Conversation agent with one connection setting.
3. Add one file-native `character_minds` table containing the JSON document and normal chat/character ownership and cascade constraints.
4. Implement document normalization and validation, including the fixed page, content, link, and source limits.
5. Implement a small Conversation mind service for read, save page, delete page, clear, card/day revision calculation, rebuild-needed detection, candidate replacement, and changed-page embedding.
6. Implement the compilation call and strict parser for page upserts only.
7. Implement the atomic keyed upsert reducer: validate the complete batch, create or replace keyed pages, union provenance, refresh embeddings, and replace the document only on complete success.
8. Implement build/rebuild by processing existing Daily Memory days sequentially through the same reducer, preserving the old document until the complete candidate succeeds.
9. Hook bounded automatic compilation into Conversation generation for at most one changed completed Daily Memory day per reply.
10. Implement page retrieval from the last six eligible messages using cosine similarity, top-five selection, and linked expansion capped at eight pages, with title-match fallback.
11. Implement and validate the single-field transient appraisal call.
12. Inject the appraisal into eligible Conversation generation and ensure compilation/appraisal context cannot feed back into future source processing.
13. Add server routes for state read, page save/delete, build/rebuild progress, and clear.
14. Add the minimal Conversation settings entry and Character Mind modal for connection selection, page inspection/editing, build/rebuild, and clear.
15. Add focused shared/server/client tests for schema bounds, atomic upserts, provenance, source revisions, rebuild-needed detection, isolation, rebuild preservation, retrieval, appraisal exclusion, failure degradation, and the minimal editor.
16. Run `pnpm db:push` and `pnpm check` once and record the results.
17. After behaviour is complete, ask whether to add focused CR019 Playwright E2E validation through `$marinara-e2e-validation`.
18. Commit the completed application branch, merge it into the requested local branch after validation, update the tracker, and remove the temporary worktree.

## Expected Areas

- Shared built-in agent manifest and Character Mind contracts.
- One file-native chat-owned schema row and file-backed-store registration.
- One focused Conversation mind service and runtime resolver.
- One route module and narrow Conversation generation integration.
- Existing Daily Memory and embedding helpers where reuse is safe.
- Conversation agent settings, one Character Mind modal, and one client hook.
- Focused shared/server/client tests.
- Optional parent Playwright tests only after user agreement.

## Verification

- The persisted document matches the approved schema and rejects over-limit or cross-owned data atomically.
- The same character card in two Conversations produces isolated mind documents.
- A significant Daily Memory creates or updates a page; a low-value day may change nothing.
- Page updates replace content while preserving stable key and accumulated source references.
- Invalid links or source IDs reject the complete compilation batch and preserve the prior document and source revisions.
- Failed rebuild leaves the old document unchanged.
- Retrieval returns semantic pages plus only bounded linked pages; no-match appraisal is skipped.
- Appraisal enters the current response context but never persistence or later compilation.
- Missing connection, embeddings, invalid model output, and runtime errors do not block ordinary replies.
- Manual edit/delete, build/rebuild, clear, agent removal preservation, and chat deletion behave as specified.
- `pnpm db:push` and `pnpm check` pass once after implementation.

## Rollback

Remove the agent registration, routes, UI, and generation hooks while leaving Daily Memories, Daily Intentions, Memory Recall, summaries, and ordinary Conversation generation unchanged. Preserve the dedicated data row during a temporary rollback unless an explicit migration safely removes it.
