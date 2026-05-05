# Vector Management Design Assessment

Date: 2026-05-02

Scope: compare the vector management developed in `reference_project/SillyTavern-SceneSummariser` with Marinara Engine's native vector-related systems, with emphasis on character memories.

## Executive Summary

`SillyTavern-SceneSummariser` implements vector management as an extension-level memory index for extracted scene memories. It delegates vector storage and embedding work to SillyTavern's `/api/vector/*` backend and stores one vector collection per active chat. Its strongest fit is character-aware recall of concise long-term memory facts extracted from scene summaries.

Marinara Engine already has native semantic machinery, but it is split across different use cases:

- `memory_chunks` stores embedded conversation fragments for semantic recall.
- `lorebook_entries.embedding` stores per-entry embeddings for semantic lorebook activation.
- `agent_memory` stores persistent agent key/value memory, but not vectorized memory.
- character memories live inside character card `extensions.characterMemories`, but are not part of native vector retrieval.

The practical gap is not "no vectors"; it is "no first-class vector store for character memories." Marinara can recall past conversation chunks and semantically activate lorebook entries, but character memories are stored as raw extension data and are not searchable by vector similarity or filtered by memory holder/target at retrieval time.

## Reference Project: SillyTavern-SceneSummariser

### Available Functionality

Source files inspected:

- `reference_project/SillyTavern-SceneSummariser/src/storage/vectorHandler.js`
- `reference_project/SillyTavern-SceneSummariser/src/storage/memoryFileHandler.js`
- `reference_project/SillyTavern-SceneSummariser/src/core/injector.js`
- `reference_project/SillyTavern-SceneSummariser/src/core/engine.js`
- `reference_project/SillyTavern-SceneSummariser/src/constants.js`
- `reference_project/SillyTavern-SceneSummariser/change_requests/CR011_VectorSearchPerformanceInvestigation/investigation.md`
- `reference_project/SillyTavern-SceneSummariser/change_requests/CR012_CharacterAwareRetrieval/investigation.md`

The reference project provides a dedicated vector layer around extracted scene memories:

- Per-chat vector collection IDs via `getChatCollectionId()`, using `scene_summariser_<safeChatId>`.
- Incremental memory indexing through `persistMemoriesForChat(chatState)`.
- Hash-based insert/delete reconciliation:
  - `listVectorHashes(collectionId)` reads existing indexed items.
  - each memory item receives a hash based on `snapshot.id` plus memory text.
  - new hashes are inserted, obsolete hashes are deleted.
- Querying via `queryVectorCollection(collectionId, searchText, topK, threshold)`.
- Manual purge via `purgeVectorCollection(collectionId)`.
- Automatic cleanup of older Data Bank memory attachments.
- Runtime prompt injection of semantically retrieved memories.
- Basic query caching and cooldown:
  - 2 second retrieval cooldown.
  - skip vector query when recent query text is unchanged.
- Character-aware metadata:
  - memory facts are expected to be prefixed with character names, e.g. `Alex, Flux: ...`.
  - persisted vector metadata includes `characters: string[]`.
  - injection filters semantic results against the active character when metadata is available, with a legacy text-prefix fallback.

The extracted memories are intentionally concise facts, not raw transcripts. The default prompt asks the model to emit a `<memory>` block and requires each fact to be prefixed by the character(s) holding the memory.

### Underlying Vector Database Storage and Retrieval

The extension does not own the vector database. It calls SillyTavern's vector API:

- `/api/vector/insert`
- `/api/vector/list`
- `/api/vector/delete`
- `/api/vector/query`
- `/api/vector/purge`

The request payload includes SillyTavern vector settings from `extension_settings.vectors`; if no source is configured, it defaults `source` to `extras`. That means the actual vector database depends on the user's SillyTavern vector backend configuration, commonly Extras-backed vector storage.

Stored items have:

- `text`: snapshot title plus memory fact.
- `hash`: numeric hash for dedupe/update detection.
- `index`: fact index within the snapshot.
- `metadata.snapshotId`
- `metadata.fact`
- `metadata.characters`

Retrieval uses recent chat messages as a semantic query:

- `semanticSearchDepth` controls how many recent messages are concatenated.
- `semanticTopK` controls max returned results. `0` is treated as effectively unlimited using `1000`.
- `semanticThreshold` is passed through to the vector backend.
- returned metadata is injected as memory facts after character relevance filtering.

Important design implication: because the vector DB is external and opaque to the extension, SceneSummariser avoids schema design and vector math, but also inherits backend availability, source configuration, score semantics, and operational behavior from SillyTavern.

### External Dependencies

SceneSummariser's vector feature depends on SillyTavern host APIs rather than npm dependencies:

- `extension_settings.vectors` for vector backend configuration.
- SillyTavern `/api/vector/*` routes.
- `getRequestHeaders()` for authenticated requests.
- SillyTavern extension settings and context APIs.
- SillyTavern utility hashing via `getStringHash()`.

The extension manifest has no explicit required extension dependencies. In practice, semantic retrieval only works when the SillyTavern vector backend is configured and available.

## Marinara Engine Native Vector Management

### Available Functionality

Source files inspected:

- `packages/server/src/services/memory-recall.ts`
- `packages/server/src/services/local-embedder.ts`
- `packages/server/src/db/schema/chats.ts`
- `packages/server/src/db/schema/lorebooks.ts`
- `packages/server/src/db/schema/agents.ts`
- `packages/server/src/services/lorebook/index.ts`
- `packages/server/src/services/lorebook/keyword-scanner.ts`
- `packages/server/src/routes/lorebooks.routes.ts`
- `packages/server/src/routes/generate.routes.ts`
- `packages/server/src/services/storage/agents.storage.ts`
- `packages/server/src/routes/knowledge-sources.routes.ts`
- `packages/server/src/services/agents/knowledge-retrieval.ts`

Marinara has three relevant native systems.

1. Conversation memory recall:

- `chunkAndEmbedMessages()` chunks completed messages into groups of 5.
- chunks are embedded asynchronously after generation completes.
- `recallMemories()` embeds the latest user message, scores stored chunks with cosine similarity, and injects top matches into a `<memories>` system block.
- enabled by default for conversation mode and scene chats, off by default for roleplay unless chat settings opt in.
- scoped to the current chat only.

2. Semantic lorebook activation:

- `lorebook_entries.embedding` stores an optional precomputed embedding per lorebook entry.
- `POST /lorebooks/:id/vectorize` embeds all entries in a lorebook using a configured provider/model.
- generation embeds the last roughly 10 messages when any active scoped lorebook entry has an embedding.
- `keyword-scanner.ts` uses semantic fallback for entries that did not keyword-match.
- lorebook filtering is scoped by active lorebook IDs, chat ID, character IDs, and persona ID.

3. Agent and character memory:

- `agent_memory` is persistent key/value state per agent per chat.
- the secret plot agent persists structured state such as `overarchingArc`, `sceneDirections`, `pacing`, and recently fulfilled directions.
- character command handling can append `extensions.characterMemories` to a target character card.
- these character memories are raw JSON extension data on the character, not vectorized rows.

Marinara also has a knowledge retrieval agent, but it is not a vector store. It uploads/read files, chunks source text by token budget, runs LLM extraction/consolidation, and injects the resulting context.

### Underlying Vector Database Storage and Retrieval

Marinara stores embeddings directly in its SQLite-backed application database. There is no dedicated vector database index or nearest-neighbor extension in the inspected code.

Conversation recall storage:

- table: `memory_chunks`
- columns:
  - `chat_id`
  - `content`
  - `embedding` as JSON-serialized `float[]`
  - `message_count`
  - `first_message_at`
  - `last_message_at`
- indexing behavior:
  - background chunking after generation.
  - only complete chunks of 5 messages are embedded.
  - unchunked trailing messages wait for a later generation.
- retrieval behavior:
  - embed latest user message with `localEmbed()`.
  - load up to 500 most recent embedded chunks from up to 50 chat IDs, currently called with only the current chat ID.
  - parse each JSON embedding.
  - compute cosine similarity in process.
  - filter by threshold `0.25`.
  - sort descending and return top 8 by default.

Lorebook semantic storage:

- table: `lorebook_entries`
- column: `embedding` as JSON-serialized `float[]`
- vectorization route:
  - uses a selected connection and embedding model.
  - can use connection `embeddingBaseUrl` or `embeddingConnectionId`.
  - embeds batches of 20 entry texts.
- retrieval behavior:
  - generation embeds recent chat context only if active scoped entries have embeddings.
  - keyword matches remain primary.
  - semantic fallback computes cosine similarity against entry embeddings in process.
  - entries activate when similarity meets threshold, default `0.3`.

Character memories:

- storage location: character data JSON, under `extensions.characterMemories`.
- observed shape: `{ from, fromCharId, summary, createdAt }`.
- retrieval behavior: no native vector retrieval path found.
- implication: character memories can be persisted, but they are not semantically ranked, not independently scoped by query, and not stored with embedding metadata.

### External Dependencies

Marinara native vector features use internal storage plus embedding providers:

- SQLite through Drizzle and libSQL/better-sqlite/sql.js stack.
- `@huggingface/transformers` for local embedding pipeline.
- optional `onnxruntime-node` native binding for local embeddings.
- model: `Xenova/all-MiniLM-L6-v2`, downloaded and cached under `DATA_DIR/models`.
- external LLM provider embedding APIs for lorebook vectorization through `provider.embed()`.
- optional `embeddingBaseUrl`, `embeddingModel`, and `embeddingConnectionId` connection settings.
- `MARINARA_LITE` disables local embedding based memory recall.

Unlike SceneSummariser, Marinara does not require a separately configured vector database service for its native recall. The tradeoff is that retrieval is brute-force JSON-vector scanning in the application process, which is simple and portable but not a scalable vector index.

## Character Memory Comparison

| Area | SceneSummariser | Marinara native |
| --- | --- | --- |
| Unit of memory | LLM-extracted scene memory fact | raw conversation chunk, lorebook entry, agent KV, or character extension memory |
| Character ownership | explicit character-name prefix plus `metadata.characters` | character IDs scope chats/lorebooks; `characterMemories` has target character and source character, but no vector metadata |
| Vector storage | external SillyTavern vector backend collection per chat | SQLite JSON embeddings in `memory_chunks` and `lorebook_entries` |
| Character memory vector search | yes, for extracted scene facts | no first-class vectorized character memory search found |
| Retrieval query | recent messages concatenated by configured depth | latest user message for memory recall; recent messages for lorebook embedding |
| Retrieval filtering | topK, threshold, per-active-character relevance filter | threshold/topK for conversation chunks; semantic fallback for lorebooks; no holder/target filter for character memory vectors |
| Update model | hash-based incremental insert/delete for extracted facts | append new message chunks; lorebook manual vectorize/update; raw character memories append to character JSON |
| Prompt injection | semantic facts are injected into summary/context block | conversation chunks injected into `<memories>`; lorebooks injected via prompt assembler; character memories not clearly injected as a vector source |

## Assessment by Requested Criteria

### Available Functionality

SceneSummariser is more specialized:

- It has a complete loop for extracted memory facts: extract, index, query, character-filter, inject, purge.
- It treats character memory as a first-class semantic retrieval unit.
- It provides user-facing controls for semantic enablement, search depth, topK, threshold, and purge.

Marinara is broader but less unified:

- It supports semantic recall of conversation fragments.
- It supports semantic activation of lorebook entries.
- It supports persistent agent memory.
- It supports character-memory append commands.
- It does not unify those into a single vector memory management layer, and character memories are not vectorized.

### Underlying Vector Database Storage and Retrieval

SceneSummariser:

- uses an external vector API and backend configured by SillyTavern.
- stores compact memory facts with metadata.
- delegates nearest-neighbor search and score filtering to the backend.
- uses hash reconciliation for incremental updates.

Marinara:

- stores JSON vectors in SQLite.
- computes cosine similarity in application code.
- limits loaded conversation chunks to avoid memory blowup.
- has no ANN index or dedicated vector DB abstraction.
- currently has two separate embedding paths:
  - local HuggingFace/ONNX for conversation recall.
  - configured external embedding provider for lorebook entry vectorization.

### External Dependencies

SceneSummariser:

- low code-level dependency footprint inside the extension.
- hard runtime dependency on SillyTavern vector APIs and configured vector backend.
- backend behavior is outside the extension's control.

Marinara:

- no external vector database service required for native recall.
- local embedding depends on `@huggingface/transformers`, `onnxruntime-node`, and model download/cache availability.
- lorebook vectorization depends on configured embedding-capable providers.
- local recall is disabled in lite mode or when ONNX native bindings are unavailable.

## Design Implications for CR007

If CR007 aims to add "vector agent tools", Marinara should probably not copy SceneSummariser's external vector API shape directly. Marinara already owns the server, DB, model connections, and prompt assembly, so a native design can be cleaner:

- Introduce a first-class vector memory table rather than overloading `character.extensions`.
- Store typed memory records with owner/target metadata:
  - `scopeType`: chat, character, agent, lorebook, global.
  - `chatId`, `characterId`, `agentConfigId`, optional `sourceMessageId`.
  - `text`, `summary`, `metadata`, `embedding`, timestamps, hash/content version.
- Provide vector agent tools around CRUD and search:
  - `memory.vector.upsert`
  - `memory.vector.search`
  - `memory.vector.delete`
  - `memory.vector.list`
  - `memory.vector.reindex`
- Keep provider selection consistent:
  - either use `localEmbed()` as the default for app-owned memories,
  - or route through configured embedding connections like lorebooks.
- Add character-aware retrieval as a query-level filter, not only post-filtered prompt text.
- Reuse the existing cosine-similarity implementation initially, but keep the storage API abstract enough to later swap in sqlite-vss, libSQL vector support, or another vector backend if scale requires it.

The closest reusable pattern from SceneSummariser is the memory fact lifecycle: compact extracted facts, hash-based incremental indexing, metadata-rich records, and character-aware filtering. The least transferable part is the dependency on SillyTavern `/api/vector/*`, because Marinara has native server-side control and should avoid introducing an opaque external vector service unless there is a clear portability reason.

