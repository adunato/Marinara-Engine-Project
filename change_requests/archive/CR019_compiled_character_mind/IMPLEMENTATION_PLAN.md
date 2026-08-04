# CR019 Implementation Plan

Status: Implemented

Implementation commit: `4dd9b0cdf`

Validation: focused Character Mind regression passed; shared/server TypeScript validation passed; primary-checkout production build passed. The first repository-wide `pnpm check` attempt exceeded its command time budget after the focused regression and was not repeated.

## Prerequisites

- Obtain approval for the replacement HLD before application implementation.
- Perform application work on `change/CR019-compiled-character-mind` from a dedicated temporary nested-repository worktree.
- Read `AGENTS.md` and `Marinara-Engine/CONTRIBUTING.md` before application edits.
- Confirm the current Daily Memory commit path, built-in agent manifest/runtime, multi-round tool loop, connection fallback, `DATA_DIR` security helpers, backup/restore, and deletion lifecycle.
- Do not add custom Character Mind client UI or response-generation integration.

## Atomic Tasks

1. Add the built-in Character Mind manifest and Conversation eligibility using the existing generic agent enablement/connection UI, but exclude it from pre-generation, parallel, and post-generation pipelines.
2. Add shared API contracts exactly matching the HLD: status, Build, Sync, Query, Lint, Cancel, operation traces, and the three final result contracts.
3. Add centralized constants for the approved 4 MiB raw-source bound plus the path, wiki-file, search, batch, chunked-read, tool-round, output-token, timeout, and request limits.
4. Implement the mind-root resolver with chat/character ownership checks, normalized relative paths, containment enforcement, Markdown-only access, and symlink rejection.
5. Add the exact bundled `SCHEMA.md`, `index.md`, and `log.md` contents from the HLD.
6. Implement recursive stable JSON serialization and the character-card canonical payload containing complete `CharacterData` plus the per-chat About Me override.
7. Implement the character-card raw Markdown renderer, 16-character SHA-256 revision, predecessor lookup, create-only atomic write, idempotency, and integrity parser/verifier.
8. Implement ordered Daily Memory canonical payload generation excluding embeddings and the corresponding renderer, revision, predecessor, create-only write, idempotency, and integrity verification.
9. Implement parseable `log.md` entry rendering/parsing for ingest/query/lint success and failure, including exact operation paths, revisions, trace-derived reads/writes, summaries, and compact query entries.
10. Implement pending-source discovery solely from current canonical revisions, raw snapshots, and successful ingest log entries; do not add a mind database table or JSON state file.
11. Implement the seven restricted batch tools with the exact HLD schemas and permission matrix: list, search, read, wiki write, index write, wiki move, and wiki delete.
12. Implement deterministic post-tool validation for H1/source-section requirements, wikilink resolution, inbound-link checks before delete, raw revision integrity, and accurate operation tracing.
13. Implement the Character Mind operation runner over the existing tool loop with the exact ingest/query/lint envelopes, prompt escaping, dedicated round/token/timeout limits, mandatory-read checks, result parsing, cancellation, and per-mind locking.
14. Implement single-source ingest, including final Markdown validation and runtime-authored append-only log entries based on actual tool calls rather than model claims.
15. Implement Build exactly as specified: fail when initialized, seed files, snapshot the current card and all formed Daily Memory days, then ingest card-first and days oldest-first with resumable partial success.
16. Implement Sync with `{ maxSources }`, card/day snapshot discovery, log-based pending order, sequential ingest, first-failure stop, and remaining-source response.
17. Add the best-effort `maxSources: 1` Sync trigger after successful Daily Memory create/edit/regenerate for enabled, initialized minds, without touching the response-generation path or failing Daily Memory persistence.
18. Implement query with the exact 32 KiB request bound, read-only tools, mandatory schema/index reads, raw-integrity checks, actual-read reference validation, detailed briefing result, and compact runtime log entry.
19. Implement deterministic lint prechecks, the lint tool run, safe link repair/rename/delete behavior, trace-derived log entries, and the automatic trigger after seven successful ingests since the last successful lint.
20. Add only the six manual operation routes defined in the HLD. Reuse existing application access controls and do not add file read/write/browser/open-folder/clear routes.
21. Register `character-minds` with backup/restore and add validated chat/character deletion cleanup.
22. Document the directory layout, manual API operations, Obsidian usage, Docker bind-mount requirement, Android limitation, raw immutability, and the absence of a custom UI.
23. Add focused shared/server tests for canonicalization, render/parse integrity, revisions, log parsing, pending discovery, tool permissions, paths/symlinks, operation prompts/limits, Build/Sync ordering, automatic Sync, query grounding, lint, locks/cancel, backup, and deletion.
24. Confirm through code search and tests that there is no Character Mind client implementation, Markdown renderer change, general file API, database table/state file, embedding index, or response-generation hook.
25. Run focused tests and `pnpm check` once. Run `pnpm db:push` only if implementation unexpectedly changes database schema; the approved design does not require it.
26. After behavior is complete, ask whether focused API-level CR019 Playwright validation is worthwhile. There is no UI flow to validate.
27. Commit the application branch, merge it into the requested local branch after validation, update the tracker, and remove the temporary worktree.

## Expected Areas

- Shared built-in agent manifest and API/result contracts.
- Server Character Mind canonical-source, filesystem, tool, operation, log, and route modules.
- Existing Daily Memory persistence hook for independent automatic Sync.
- Existing backup/restore and chat/character deletion paths.
- Server/shared tests and user/developer documentation.

No custom client component, hook, Markdown renderer change, mind database table, JSON state document, embedding service, graph dependency, or generation-route integration is expected.

## Verification

- Raw Markdown generation is completely deterministic, exact, revisioned, immutable, idempotent, and integrity-checked.
- The committed default schema, prompts, tool schemas, limits, APIs, and result contracts match the HLD verbatim.
- Agent operations cannot access another mind or mutate raw sources, schema, or log.
- Build/Sync derive state from Markdown and log entries and resume safely after partial failure or restart.
- Ingest maintains real Markdown pages, wikilinks, source citations, index, and trace-grounded logs.
- Query uses wiki structure to select relevant raw detail and returns a concrete briefing with verified references.
- Lint performs the defined deterministic and model-assisted checks without inventing evidence.
- Daily Memory automatic Sync and seven-ingest lint triggers use the same manually callable services.
- Backup/restore/deletion lifecycle covers the mind directory.
- Existing Conversation generation is unchanged and no Character Mind UI exists.
- Focused tests and `pnpm check` pass once.

## Rollback

Remove the built-in agent registration, operation routes, Daily Memory Sync trigger, server services, and backup/deletion registration. Leave existing `character-minds` directories intact unless the user explicitly removes them manually, preserving the Markdown wiki and immutable sources for recovery.
