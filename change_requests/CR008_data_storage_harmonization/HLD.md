# CR008 Data Storage Harmonization Discovery

Status: Draft design/discovery
Date: 2026-05-06

## Problem Statement

Marinara Engine now persists user data through the file-native `DATA_DIR/storage` table snapshot store by default. The app still exposes a Drizzle-shaped runtime API for compatibility, and several features keep their own storage models, embedding paths, retention rules, and prompt-injection lifecycles.

This CR assesses the current storage landscape and designs a harmonized "library" data layer that can make persisted narrative data easier to reason about, search, migrate, back up, and reuse across features.

The dedicated reader-facing assessment is `ASSESSMENT.md`. This HLD records the CR scope and design boundary; the assessment provides the top-down strategy, diagrams, bottom-up reference tables, and recommended implementation slice.

## Goals

- Inventory current storage surfaces across semantic lorebook search, memory recall, built-in trackers, custom trackers, memory commands, and adjacent persisted narrative data.
- Confirm the current durable backend model after the file-storage migration and avoid relying on stale CR007 SQLite assumptions.
- Identify where storage concepts overlap: memories, lore, tracker state, notes, agent memory, generated context, and vectorized text.
- Propose a cohesive storage direction that can be implemented incrementally without destabilizing existing user data.
- Produce design artifacts and follow-up implementation options, not production code, in this CR.

## Non-Goals

- Do not replace the file-native storage backend in this CR.
- Do not introduce a new database or vector database in this CR.
- Do not migrate user data in this CR.
- Do not change prompt behavior, tracker behavior, or memory recall behavior until a follow-up implementation CR is approved.
- Do not add broad E2E regression coverage during discovery.

## Current Storage Model

Durable storage is currently file-native by default. `docs/FILE_STORAGE_MIGRATION.md` states that `DATA_DIR/storage` is the source of truth, with table-shaped JSON snapshots under `storage/tables/*.json`. SQLite is now legacy/import or opt-in compatibility storage, while the runtime still presents Drizzle-shaped table operations through `packages/server/src/db/connection.ts` and `packages/server/src/db/file-backed-store.ts`.

The important design consequence is that "schema" still exists as TypeScript/Drizzle-shaped table definitions, but the default user data path is JSON table snapshots. A harmonized design should therefore target the storage facade and file-native data layout, not assume live SQLite indexes or migrations as the primary path.

## Current Storage Surface Inventory

### Lorebook Semantic Search

- Durable rows: `lorebooks`, `lorebook_entries`, and `lorebook_folders`.
- Current default files: `storage/tables/lorebooks.json`, `storage/tables/lorebook_entries.json`, `storage/tables/lorebook_folders.json`.
- Vector payload: `lorebook_entries.embedding` stores a JSON-serialized float array in the Drizzle-shaped schema and is parsed to `number[]` by `createLorebooksStorage`.
- Embedding source: `POST /lorebooks/:id/vectorize` uses the selected connection's embedding model/base URL or embedding connection override.
- Retrieval: `scanForActivatedEntries` keyword-matches first, then uses semantic fallback when a chat-context embedding exists and an entry embedding meets the threshold.
- Lifecycle: entry content/key edits clear the entry embedding. Re-vectorization is explicit.

### Memory Recall

- Durable rows: `memory_chunks`.
- Current default file: `storage/tables/memory_chunks.json`.
- Vector payload: chunk embeddings are stored as JSON-serialized float arrays.
- Embedding source: `localEmbed()` using `Xenova/all-MiniLM-L6-v2` through `@huggingface/transformers` and `onnxruntime-node`; disabled in lite mode or when the ONNX binding is unavailable.
- Indexing: completed chat messages are chunked in groups of five after generation.
- Retrieval: `recallMemories()` embeds the query, loads up to 500 recent embedded chunks from up to 50 supplied chat IDs, computes cosine similarity in-process, filters by `0.25`, and returns top matches.
- Scope: currently called as chat-scoped recall, not as a global or cross-library memory search.

### Built-In Trackers

- Durable rows: primarily `game_state_snapshots`, with supporting `agent_runs`.
- Current default files: `storage/tables/game_state_snapshots.json` and `storage/tables/agent_runs.json`.
- World state writes date, time, location, weather, and temperature into message/swipe-specific snapshots.
- Character tracker writes present characters, appearance, outfit, custom fields, stats, thoughts, and related per-character state into the same message/swipe snapshot.
- Persona stats writes persona status bars into the snapshot.
- Quest/combat flows can also write game state through the `update_game_state` tool path.
- Prompt expansion reads latest or committed snapshots to expose tracker state back into generation.

### Custom Trackers

- Configuration lives in chat metadata and/or agent settings, depending on the configured agent surface.
- Runtime output is persisted into `game_state_snapshots.playerStats.customTrackerFields` or related snapshot fields through the same `update_game_state` persistence path.
- Custom tracker result history is also present in `agent_runs`, but the durable user-facing state is the current game-state snapshot.
- This makes custom trackers structurally tied to game-state snapshots rather than a standalone custom tracker store.

### Character Memory Command

- Command parser recognizes `[memory: target="CharName", summary="..."]`.
- Persistence writes to the target character card's `extensions.characterMemories` array.
- Current shape is effectively `{ from, fromCharId, summary, createdAt }`.
- Retrieval/injection in conversation mode reads each active character's `characterMemories`, filters to memories created today or later, appends them inside conversation awareness, and deletes expired memories from the character card.
- Scene conclusion also appends scene summaries to participating characters' `extensions.characterMemories`.
- Schedule generation may read recent `characterMemories` for schedule continuity.
- This is not vectorized, not in a dedicated storage table, and not scoped by a formal holder/subject schema.

### Agent Memory And Runs

- Durable rows: `agent_configs`, `agent_runs`, `agent_memory`.
- Current default files: `storage/tables/agent_configs.json`, `storage/tables/agent_runs.json`, `storage/tables/agent_memory.json`.
- `agent_memory` is per-agent, per-chat key/value state. Values are JSON when possible.
- `agent_runs` stores execution history and result data; some prompt markers read recent or latest successful runs.
- This is operational state, but several features treat it as durable narrative context.

### Chat Metadata And Summaries

- Durable row: `chats.metadata`.
- Current default file: `storage/tables/chats.json`.
- Stores rolling summaries, active lorebook IDs, memory recall enablement, tracker/manual settings, scene lifecycle state, schedules, linked chat state, and other feature-specific metadata.
- Metadata is a broad JSON bag with feature-specific ownership rather than a discriminated domain model.

### Conversation Notes And OOC Influences

- Durable rows: `conversation_notes` and `ooc_influences`.
- Current default files: `storage/tables/conversation_notes.json` and `storage/tables/ooc_influences.json`.
- `<note>` persists cross-chat context until cleared, with pruning by character budget.
- `<influence>` queues one-shot context for a connected roleplay and marks it consumed after use.
- These are memory-like narrative artifacts but live separately from memory chunks and character memories.

### Other Persistent Library Data

- Characters, personas, lorebooks, prompt presets, regex scripts, custom tools, app settings, chat presets, assets, galleries, game checkpoints, and theme data all use the file-native table store.
- Some of these are clearly library/catalog objects; others are runtime state. The current table list does not consistently distinguish content library, generated narrative memory, operational state, and media metadata.

## Key Findings

1. Storage is already centralized at the backend infrastructure level, but not at the narrative-data concept level.
2. Vectorized text exists in at least two domain-specific forms: lorebook entry embeddings and memory chunk embeddings.
3. Embedding providers are split: lorebooks use configured embedding providers, while memory recall uses the local embedder.
4. Character memories are persisted as character-card extension JSON, not as first-class memory records.
5. Trackers persist structured state as game-state snapshots, which is appropriate for current-turn state but awkward for reusable library recall.
6. Chat metadata is carrying too many unrelated storage responsibilities.
7. The current file-native backend favors portable snapshots over indexed retrieval, so any harmonization must account for scan cost and future file layout.

## Proposed Direction

Introduce a cohesive library storage design in a follow-up CR, centered on typed durable records rather than feature-owned JSON fragments.

The likely target is a `library_items` or `narrative_records` abstraction with:

- `id`
- `kind`: lore_entry, memory_chunk, character_memory, tracker_state, note, influence, agent_memory, asset_reference, etc.
- `scope`: chat, character, persona, agent, lorebook, global, or composite.
- `subjectIds` and `ownerIds` for character-aware memory and tracker relationships.
- `source`: user, command, agent, import, scene, generation, system.
- `text` or `summary`
- `structuredData`
- `embedding`
- `embeddingProvider`, `embeddingModel`, `embeddingVersion`, and content hash
- `createdAt`, `updatedAt`, and optional `expiresAt`
- retention and visibility flags

This does not require all existing tables to disappear. A safer path is to add a service-level abstraction first, then gradually move features onto it while preserving existing file snapshots and export behavior.

## Design Questions

- Should lorebook entries remain the canonical authoring surface while their embeddings move to a shared vector index?
- Should memory chunks be treated as generated library records, or stay as a recall cache derived from messages?
- Should character memories be durable long-term records, short-lived awareness hints, or both with explicit expiry?
- Should tracker snapshots remain message/swipe state while selected stable facts are promoted into the library?
- Which embedding path should be canonical for app-owned records: local embedder, configured embedding connection, or per-record provider metadata?
- How should deletion cascade when a chat, character, or lorebook is removed?
- What is the acceptable retrieval cost for file-native JSON snapshots before a vector index or sharded layout becomes necessary?

## Risks

- Premature unification could blur important differences between authored lore, generated memories, runtime tracker state, and operational agent state.
- Moving character memories out of character card extensions could break import/export expectations unless compatibility is explicit.
- Shared vector search without provider/version metadata can compare incompatible embedding spaces.
- A single library table could become another broad JSON bag if record kinds and ownership rules are not strict.
- File-native storage may need layout changes before broad semantic search scales well.

## Validation Plan For This CR

- Review current code paths for every storage surface listed above.
- Compare current behavior against CR007's older vector assessment.
- Document confirmed storage locations, retrieval mechanisms, and harmonization options.
- No `pnpm check` is required for documentation-only discovery unless docs start referencing generated code or scripts.

## Expected Follow-Up Outputs

- A storage harmonization implementation CR with a concrete target schema/service design.
- Migration compatibility notes for existing `characterMemories`, `memory_chunks`, `lorebook_entries.embedding`, `game_state_snapshots`, and `agent_memory`.
- A scoped validation plan covering storage reads/writes, migration/import/export behavior, and prompt-injection compatibility.
