# CR019 Implementation Plan

Status: Proposed

## Prerequisites

- Obtain approval for the replacement `HLD.md` before application implementation.
- Perform all application work on `change/CR019-compiled-character-mind` from a dedicated temporary nested-repository worktree.
- Read `AGENTS.md`, `Marinara-Engine/CONTRIBUTING.md`, and `Marinara-Engine/packages/client/.instructions.md` before editing application or client code.
- Confirm the current Daily Memory persistence/update hooks, built-in agent runtime, tool loop, `DATA_DIR` path guards, backup/restore code, Markdown renderer, and Game Assets file-browser patterns before implementation.
- Keep response-generation integration outside CR019.

## Atomic Tasks

1. Add the built-in Character Mind agent manifest, Conversation-mode eligibility, enablement, connection setting, and operation settings without registering it as a normal pre- or post-generation injection agent.
2. Add shared contracts for mind status, operation progress, filesystem nodes, and the query result `{ briefing, wikiPages, rawSources }`.
3. Implement the validated mind-root resolver for `DATA_DIR/character-minds/<chatId>/<characterId>` with ownership checks, containment enforcement, symlink rejection, Markdown-only access, and centralized file/operation limits.
4. Add bundled default templates for `SCHEMA.md`, `index.md`, and `log.md`, using the approved Karpathy terminology and minimal page grammar.
5. Implement immutable character-card snapshot creation with deterministic revisions, predecessor metadata, exact card content, and create-only writes.
6. Implement immutable completed-day Daily Memory snapshot creation with deterministic revisions, exact IDs/date/importance/text, predecessor metadata, and create-only writes.
7. Implement pending-source discovery by comparing current card/day revisions with immutable snapshots and successful ingest records in `log.md`.
8. Implement restricted mind tools for list, search, read, wiki write, wiki rename/delete, and index replacement. Enforce the HLD permission matrix separately for ingest, query, and lint.
9. Add a Character Mind operation runner over the existing multi-round agent executor, with one resolved mind, operation-specific prompt, tool context, cancellation, bounded rounds, operation trace, and per-mind writer lock.
10. Implement ingest exactly as the schema-defined workflow: read schema/index/source, inspect relevant wiki material, make Markdown edits through tools, update the index, validate the final state, and append an actual-trace log entry.
11. Implement Build by initializing the mind, snapshotting current inputs, and ingesting the card followed by Daily Memory days in chronological order. Make an interrupted build resumable through Sync.
12. Implement Sync by snapshotting pending revisions and ingesting the oldest unprocessed source until the current requested run limit is reached, with progress reporting and explicit resume behavior.
13. Trigger the same Sync service after a Daily Memory day is created, edited, or regenerated for existing minds in that Conversation. Keep failure non-destructive and visibly pending; do not hook this work to response generation.
14. Implement query as a read-only operation that starts with `index.md`, can read wiki and raw Markdown, returns the validated detailed briefing and actual file references, and appends a compact query entry to `log.md`.
15. Implement lint using the approved checks and write permissions, including safe page rename/removal, link and citation repair, index maintenance, an actual-trace log entry, and the automatic trigger after seven successful ingests.
16. Add routes for status, Build, Sync, operation progress/cancel, file tree/read/search, schema save, query, lint, desktop open-folder, and confirmed clear.
17. Add backup/restore coverage for `character-minds`, deletion cleanup for chat/character ownership, and user documentation describing the data directory and Obsidian access limitations on Docker and Android.
18. Extend the shared Markdown renderer with safe `[[wikilink]]` recognition and navigation callbacks without changing ordinary chat Markdown behavior.
19. Add the Character Mind browser with operation controls, progress/errors, file tree, rendered/raw Markdown views, clickable wikilinks, text search, schema editor, query preview with cited files, and explicit clear confirmation. Do not add an in-app graph or general wiki editor.
20. Add focused tests for snapshots, pending revision discovery, operation permissions, path security, locks, ingest traces, query references, lint changes, backup/deletion, renderer behavior, and UI operations.
21. Verify through focused tests and run `pnpm check` once. Run `pnpm db:push` only if implementation unexpectedly requires a database-schema change; the approved design does not require one.
22. Confirm by inspection/test that no Character Mind result enters the response-generation path.
23. After behavior is complete, ask whether to add focused CR019 Playwright E2E validation for Build/Sync, browsing, query, lint, and Obsidian-compatible link navigation.
24. Commit the completed application branch, merge it into the requested local branch after validation, update the tracker, and remove the temporary worktree.

## Expected Areas

- Shared built-in agent manifest and narrow Character Mind API contracts.
- Server Character Mind filesystem, snapshot, operation-runner, and route modules.
- Existing Daily Memory persistence hooks for independent Sync triggering.
- Existing backup/restore and chat/character deletion paths.
- Existing Markdown renderer and a focused Character Mind browser/hook.
- Data-storage and backup documentation.
- Focused server, shared, and client tests.

The implementation must not add a `character_minds` database table, JSON page document, embedding index, graph database, or response-generation hook.

## Verification

- The mind is an ordinary directory of Markdown files and opens correctly in Obsidian.
- Character card and Daily Memory revisions create new immutable raw files rather than overwriting old evidence.
- Agent tools cannot mutate raw sources, schema, another mind, non-Markdown files, or paths outside the resolved root.
- Ingest can touch multiple linked pages, updates the index, and records the actual operation in the append-only log.
- Query reads the wiki first, follows relevant raw-source citations for specifics, and returns a detailed briefing with accurate file references.
- Lint repairs the approved wiki problems without inventing evidence or changing raw sources.
- Build and Sync resume safely after interruption, and Daily Memory changes become pending/processed independently of response generation.
- The browser follows wikilinks, exposes raw evidence, edits only the schema, and does not require an internal graph.
- Backup/restore and deletion lifecycle include the complete mind directory.
- Existing Conversation generation behaves identically whether the Character Mind agent is enabled or disabled.
- Focused tests and `pnpm check` pass once after implementation.

## Rollback

Disable or remove the Character Mind agent registration, routes, Daily Memory Sync trigger, browser, renderer extension, and backup-directory registration. Leave existing `character-minds` directories intact unless the user explicitly clears them, so a later re-enable or corrected implementation can recover the Markdown wiki and immutable raw sources.
