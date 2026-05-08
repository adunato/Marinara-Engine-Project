# Feature Request: Agent Memory Enhancement

## What problem does this solve?

Agents can persist narrow key/value state today through `agent_memory`, but they do not have a clean general-purpose way to save, search, list, and delete durable agent memory records.

The current storage surfaces each solve a different problem:

- Memory Recall stores automatic chat-history chunks in `memory_chunks`; it is derived recall, not agent-authored memory records.
- Lorebooks are user-facing knowledge books; using them as an agent scratchpad would mix agent-managed records with authored world/lore content.
- Character memory commands write into character card `extensions.characterMemories`; those entries do not have a dedicated tool API, stable record model, or flexible search/list/delete behavior.
- Existing agent memory is per-agent key/value state in `storage/tables/agent_memory.json`; it is useful for small internal state and is currently used by the secret plot agent, but it is narrow and not a general searchable record store.
- Chat metadata already stores many unrelated settings and summaries, so it should not become the generic agent memory bucket.

CR008 also confirms that the current durable storage model is file-native table snapshots under `DATA_DIR/storage`, not a default live SQL database. Any agent memory enhancement should fit that structure and should explicitly decide how the current `agent_memory` table evolves.

## Proposed solution

Enhance agent memory into a more capable scoped record store and add built-in tools that let agents manage those records:

- `save_agent_memory`
- `search_agent_memory`
- `list_agent_memory`
- `delete_agent_memory`

The feature should focus on agent memory records, not vectors as the product concept. Vector storage and semantic search should be optional storage/search capabilities behind `search_agent_memory`.

`save_agent_memory` should let an agent store text content with optional title, namespace, metadata, scope, character selector, and optional semantic indexing request.

`search_agent_memory` should support multiple search modes:

- `literal` for exact or case-insensitive text matching.
- `fuzzy` for lightweight non-vector approximate matching.
- `semantic` for embedding-backed search when semantic index data is available.

`list_agent_memory` should browse records by namespace/scope with pagination, without requiring a query.

`delete_agent_memory` should delete or disable a record by ID, while enforcing scope and ownership checks.

The model should not pass raw internal IDs. The server should resolve model-facing scopes from tool execution context, including current chat, active characters, and executing agent config.

Storage should align with the current file-native table structure. The design should evaluate whether to evolve the existing file:

```text
DATA_DIR/storage/tables/agent_memory.json
```

or introduce a replacement/sibling table with a compatibility path. The server may still use a Drizzle-shaped schema/facade internally to match existing patterns, but the requested durable storage behavior is file-native JSON table storage.

The current secret plot agent should be rerouted onto the enhanced agent memory framework if the implementation can preserve current behavior. At minimum, the design must specify how its existing memory keys continue to work:

| Current key | Required continuity |
| --- | --- |
| `overarchingArc` | Long-term arc persists across agent-run clears and remains injected where it is today. |
| `sceneDirections` | Active directions continue to update each generation and clear when absent/stale. |
| `recentlyFulfilled` | Rolling list still prevents repeated fulfilled directions. |
| `pacing` | Pacing state persists and remains available to the agent. |
| `staleDetected` | Boolean state persists and remains available to the agent. |

## Alternatives considered

Reuse `memory_chunks`.

Rejected because Memory Recall stores automatic five-message chat chunks. It is not designed for explicit agent-authored records, namespaces, list/delete tools, or non-semantic browsing.

Use lorebooks.

Rejected because lorebooks are user-facing knowledge/lore authoring surfaces. Agent working memory should not silently contaminate lorebooks unless the user chooses that workflow.

Use character card `extensions.characterMemories`.

Rejected because current character memories are stored inside character card JSON, lack stable tool-addressable IDs, and have conversation-mode pruning behavior that does not match general agent memory storage.

Leave `agent_memory` unchanged.

Rejected because current agent memory is key/value state, not a record store with listing, searching, namespaces, metadata, and optional semantic retrieval. However, it is the incumbent storage surface, so the implementation design should assess whether CR009 supersedes `agent_memory`, extends it, or creates a new store with a compatibility/migration path.

Use chat metadata.

Rejected because CR008 already shows chat metadata is broad and overloaded. Adding arbitrary agent memory records would worsen that.

Create a vector-first agent store.

Rejected as the main framing. Semantic search is useful, but the requested feature is agent memory enhancement. Literal and fuzzy search should work without embeddings.

Introduce an external vector database.

Rejected for this feature request. Current app storage is file-native, and semantic search can start as optional JSON-vector support consistent with existing in-process retrieval patterns.

## Additional context

This request replaces the older vector-first framing in `change_requests/CR008_data_storage_harmonization/PREVIOUS_FEATURE_REQUEST.md`.

It depends on the current-behavior assessment in `change_requests/CR008_data_storage_harmonization/ASSESSMENT.md`, especially these findings:

- file-native storage is the default durable backend;
- semantic retrieval currently exists in separate systems;
- Memory Recall, lorebooks, character memories, tracker snapshots, agent memory, notes, and chat metadata each have different roles;
- agent memory records need a clearer storage surface than narrow per-chat KV alone.

Existing `agent_memory` behavior to account for:

- durable file: `storage/tables/agent_memory.json`;
- shape: per `agentConfigId` + `chatId` + `key` string value;
- current visible use: `secret-plot-driver` persists `overarchingArc`, `sceneDirections`, `recentlyFulfilled`, `pacing`, and `staleDetected`;
- clearing agent runs for a chat currently preserves/restores `secret-plot-driver`'s `overarchingArc`.

The enhanced agent memory work should consider rerouting the secret plot agent to the new storage layer if it can preserve the same behavior while making agent memory more general and inspectable.

Suggested scope names for tool inputs:

- `chat`
- `character`
- `agent`
- `chat_agent`
- `global_agent`

Suggested policy language for agents:

```text
Use save_agent_memory for stable facts, unresolved tasks, promises, decisions, and significant events that should persist beyond the current context.

Use search_agent_memory before answering questions about prior facts, plans, decisions, or continuity.

Use literal search for exact names or phrases.
Use fuzzy search when wording may differ.
Use semantic search when looking for conceptually related records and semantic indexing is available.

Do not save routine small talk, transient emotion, repeated facts, or information already present in active prompt context.
```

Open questions:

- Should `save_agent_memory` support update by `recordId` only, or upsert by namespace/title/scope?
- Should semantic indexing happen on save, lazily on first semantic search, or only when explicitly requested?
- Should semantic indexing use the local embedder, configured embedding connections, or a later setting?
- Should records be visible through a UI in the first implementation, or only through tools?
- Should `delete_agent_memory` soft-delete by default or hard-delete immediately?
- Should CR009 supersede `agent_memory`, extend it, or coexist with it?
- If it supersedes `agent_memory`, how should existing secret plot memory be migrated or read compatibly?

## Template check

Please **uncheck (untick)** the box below before submitting so we know you read the template. It is intentionally pre-checked:

- [ ] I DID NOT read this template and provide the requested details.
