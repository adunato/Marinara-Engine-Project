# Feature Request: Custom Agent Data Storage Tools

## What problem does this solve?

Custom agents can call tools during generation, but they do not have a clean general-purpose way to save, search, list, and delete their own durable custom data.

The current storage surfaces each solve a different problem:

- Memory Recall stores automatic chat-history chunks in `memory_chunks`; it is derived recall, not agent-authored custom data.
- Lorebooks are user-facing knowledge books; using them as an agent scratchpad would mix agent-managed records with authored world/lore content.
- Character memory commands write into character card `extensions.characterMemories`; those entries do not have a dedicated tool API, stable record model, or flexible search/list/delete behavior.
- Agent memory is per-agent key/value state; it is useful for small internal state, but not for many searchable text records with namespaces, scopes, and metadata.
- Chat metadata already stores many unrelated settings and summaries, so it should not become the generic custom data bucket.

CR008 also confirms that the current durable storage model is file-native table snapshots under `DATA_DIR/storage`, not a default live SQL database. Any new custom agent data store should fit that structure.

## Proposed solution

Add built-in tools that let agents manage scoped custom data records:

- `save_custom_data`
- `search_custom_data`
- `list_custom_data`
- `delete_custom_data`

The feature should focus on custom agent data, not vectors as the product concept. Vector storage and semantic search should be optional storage/search capabilities behind `search_custom_data`.

`save_custom_data` should let an agent store text content with optional title, namespace, metadata, scope, character selector, and optional semantic indexing request.

`search_custom_data` should support multiple search modes:

- `literal` for exact or case-insensitive text matching.
- `fuzzy` for lightweight non-vector approximate matching.
- `semantic` for embedding-backed search when semantic index data is available.

`list_custom_data` should browse records by namespace/scope with pagination, without requiring a query.

`delete_custom_data` should delete or disable a record by ID, while enforcing scope and ownership checks.

The model should not pass raw internal IDs. The server should resolve model-facing scopes from tool execution context, including current chat, active characters, and executing agent config.

Storage should align with the current file-native table structure, for example:

```text
DATA_DIR/storage/tables/custom_agent_data.json
```

The server may still use a Drizzle-shaped schema/facade internally to match existing patterns, but the requested durable storage behavior is file-native JSON table storage.

## Alternatives considered

Reuse `memory_chunks`.

Rejected because Memory Recall stores automatic five-message chat chunks. It is not designed for explicit agent-authored records, namespaces, list/delete tools, or non-semantic browsing.

Use lorebooks.

Rejected because lorebooks are user-facing knowledge/lore authoring surfaces. Custom-agent working data should not silently contaminate lorebooks unless the user chooses that workflow.

Use character card `extensions.characterMemories`.

Rejected because current character memories are stored inside character card JSON, lack stable tool-addressable IDs, and have conversation-mode pruning behavior that does not match general custom data storage.

Use `agent_memory`.

Rejected as the complete solution because current agent memory is key/value state, not a record store with listing, searching, namespaces, metadata, and optional semantic retrieval.

Use chat metadata.

Rejected because CR008 already shows chat metadata is broad and overloaded. Adding arbitrary custom-agent data would worsen that.

Create a vector-first agent store.

Rejected as the main framing. Semantic search is useful, but the requested feature is custom data storage. Literal and fuzzy search should work without embeddings.

Introduce an external vector database.

Rejected for this feature request. Current app storage is file-native, and semantic search can start as optional JSON-vector support consistent with existing in-process retrieval patterns.

## Additional context

This request replaces the older vector-first framing in `change_requests/CR008_data_storage_harmonization/PREVIOUS_FEATURE_REQUEST.md`.

It depends on the current-behavior assessment in `change_requests/CR008_data_storage_harmonization/ASSESSMENT.md`, especially these findings:

- file-native storage is the default durable backend;
- semantic retrieval currently exists in separate systems;
- Memory Recall, lorebooks, character memories, tracker snapshots, agent memory, notes, and chat metadata each have different roles;
- custom-agent durable records need their own clearer storage surface.

Suggested scope names for tool inputs:

- `chat`
- `character`
- `agent`
- `chat_agent`
- `global_agent`

Suggested policy language for agents:

```text
Use save_custom_data for stable facts, unresolved tasks, promises, decisions, and significant events that should persist beyond the current context.

Use search_custom_data before answering questions about prior facts, plans, decisions, or continuity.

Use literal search for exact names or phrases.
Use fuzzy search when wording may differ.
Use semantic search when looking for conceptually related records and semantic indexing is available.

Do not save routine small talk, transient emotion, repeated facts, or information already present in active prompt context.
```

Open questions:

- Should `save_custom_data` support update by `recordId` only, or upsert by namespace/title/scope?
- Should semantic indexing happen on save, lazily on first semantic search, or only when explicitly requested?
- Should semantic indexing use the local embedder, configured embedding connections, or a later setting?
- Should records be visible through a UI in the first implementation, or only through tools?
- Should `delete_custom_data` soft-delete by default or hard-delete immediately?

## Template check

Please **uncheck (untick)** the box below before submitting so we know you read the template. It is intentionally pre-checked:

- [ ] I DID NOT read this template and provide the requested details.
