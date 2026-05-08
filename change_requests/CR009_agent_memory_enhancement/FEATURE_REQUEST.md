# Feature Request: Agent Memory Enhancement

## What problem does this solve?

Agents can persist narrow key/value state today through `agent_memory`, but they do not have a clean general-purpose way to save, search, list, and delete durable agent memory records.

The current storage surfaces each solve a different problem:

- Memory Recall stores automatic chat-history chunks in `memory_chunks`; it is derived recall, not agent-authored memory records.
- Lorebooks are user-facing knowledge books; using them as an agent scratchpad would mix agent-managed records with authored world/lore content.
- Character memory commands write into character card `extensions.characterMemories`; those entries do not have a dedicated tool API, stable record model, or flexible search/list/delete behavior.
- Existing agent memory is per-agent key/value state in `storage/tables/agent_memory.json`; it is useful for small internal state and is currently used by the secret plot agent, but it is narrow and not a general searchable record store.
- Chat metadata already stores many unrelated settings and summaries, so it should not become the generic agent memory bucket.

The enhanced storage should fit the current file-native table storage model under `DATA_DIR/storage`.

## Proposed solution

Enhance agent memory into a scoped record store and add built-in tools that let agents manage those records:

- `save_agent_memory`
- `search_agent_memory`
- `list_agent_memory`
- `delete_agent_memory`

`save_agent_memory` should let an agent store text content with optional title, namespace, metadata, scope, character selector, and optional semantic indexing.

`search_agent_memory` should support multiple search modes:

- `literal` for exact or case-insensitive text matching.
- `fuzzy` for lightweight non-vector approximate matching.
- `semantic` for embedding-backed search when semantic index data is available.

`list_agent_memory` should browse records by namespace/scope with pagination, without requiring a query.

`delete_agent_memory` should delete or disable a record by ID while enforcing scope and ownership checks.

The model should not pass raw internal IDs. The server should resolve model-facing scopes from tool execution context, including current chat, active characters, and executing agent config.

Storage should evolve the existing file-native agent memory storage where practical:

```text
DATA_DIR/storage/tables/agent_memory.json
```

The proposed record shape is:

| Field | Purpose |
| --- | --- |
| `id` | Stable record ID returned by save, search, and list tools. |
| `memoryType` | Distinguishes enhanced records from compatibility/internal key-value memory if needed. |
| `key` | Optional stable key for existing key-value style memory and upsert-by-key records. |
| `namespace` | Logical bucket, such as `continuity`, `planning`, or `secret_plot`. |
| `title` | Optional human-readable label. |
| `content` | Main text content to save and retrieve. |
| `metadata` | Optional structured data for agent-specific details. |
| `scopeType` | Scope such as chat, character, agent, chat-agent, or global-agent. |
| `chatId` | Server-resolved chat ID when the memory is chat-scoped. |
| `characterId` | Server-resolved character ID when the memory is character-scoped. |
| `agentConfigId` | Server-resolved agent ID that owns the memory. |
| `embedding` | Optional vector data for semantic search. |
| `embeddingProvider` | Provider/source used to create the embedding. |
| `embeddingModel` | Embedding model used for semantic search. |
| `contentHash` | Hash used to tell whether the embedding is stale. |
| `enabled` | Whether the record is visible to normal search/list calls. |
| `createdAt` | Creation timestamp. |
| `updatedAt` | Last update timestamp. |
| `deletedAt` | Optional soft-delete timestamp. |

The current secret plot agent should continue to work through the enhanced memory system. Its current key-value rows can map into enhanced records like this:

| Current `agent_memory` row | Mapped enhanced agent memory record |
| --- | --- |
| `key = "overarchingArc"`, `value = object/string` | `memoryType = "internal"`, `namespace = "secret_plot"`, `key = "overarchingArc"`, `scopeType = "chat_agent"`, `metadata.rawValue = value`, protected from normal clear. |
| `key = "sceneDirections"`, `value = active direction array` | `memoryType = "internal"`, `namespace = "secret_plot"`, `key = "sceneDirections"`, `scopeType = "chat_agent"`, `metadata.rawValue = value`. |
| `key = "recentlyFulfilled"`, `value = string array` | `memoryType = "internal"`, `namespace = "secret_plot"`, `key = "recentlyFulfilled"`, `scopeType = "chat_agent"`, `metadata.rawValue = value`. |
| `key = "pacing"`, `value = string/structured value` | `memoryType = "internal"`, `namespace = "secret_plot"`, `key = "pacing"`, `scopeType = "chat_agent"`, `content = string value when possible`, `metadata.rawValue = value`. |
| `key = "staleDetected"`, `value = boolean` | `memoryType = "internal"`, `namespace = "secret_plot"`, `key = "staleDetected"`, `scopeType = "chat_agent"`, `metadata.rawValue = value`. |

This should preserve current behavior while moving secret plot state onto the same enhanced memory framework used by the new tools.

## Alternatives considered

- Reuse `memory_chunks`: rejected because Memory Recall stores automatic chat chunks, not explicit agent-authored records.
- Use lorebooks: rejected because agent working memory should not silently pollute user-facing lorebooks.
- Use character card `extensions.characterMemories`: rejected because those entries lack stable tool-addressable IDs and have conversation-specific lifecycle behavior.
- Leave `agent_memory` unchanged: rejected because narrow key/value state does not support listing, searching, namespaces, metadata, or semantic retrieval.
- Use chat metadata: rejected because chat metadata is already broad and overloaded.
- Build an external vector database: rejected because the current file-native storage model can support the first version, with semantic search as an optional capability.

## Additional context

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

## Template check

Please **uncheck (untick)** the box below before submitting so we know you read the template. It is intentionally pre-checked:

- [ ] I DID NOT read this template and provide the requested details.
