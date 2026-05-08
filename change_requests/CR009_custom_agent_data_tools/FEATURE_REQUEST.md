# Feature Request: Custom Agent Data Storage Tools

Date: 2026-05-08

## Summary

Add built-in tools that let custom agents save, search, list, and delete their own durable data without overloading memory recall, lorebooks, chat summaries, tracker snapshots, or character card extension memories.

The feature is about custom agent data storage, not about vectors as the primary product concept. Vector storage and semantic search are optional retrieval capabilities behind the search tool.

## Problem

Custom agents can call tools during generation, but they do not have a general-purpose data store for durable custom records.

Current storage surfaces do not fit this need cleanly:

- Memory recall stores automatic five-message chat chunks in `memory_chunks`. It is derived from chat history and shaped for recall fragments, not tool-written custom records.
- Lorebooks are user-authored or agent-authored knowledge books. Using them as a scratchpad for agent-managed records would mix different product concepts.
- Character memories live inside character card `extensions.characterMemories`. They are not stable tool-addressable records and currently have date-pruning behavior in conversation generation.
- Agent memory is per-agent key/value state. It is useful for structured internal state, but not enough for browsing, searching, metadata-filtering, or storing multiple text records.
- Chat metadata already carries many responsibilities and should not become a generic custom data bucket.

Agents need a bounded, inspectable, tool-driven store for custom text or JSON-ish data, with explicit scope and retrieval controls.

## User Value

This would let custom agents maintain durable working memory and task-specific data without modifying unrelated app features.

Examples:

- A continuity agent saves unresolved promises, decisions, open loops, and recurring facts.
- A planning agent stores long-running task notes and later searches them.
- A custom NPC manager stores generated NPC details without writing them to a lorebook unless the user chooses that workflow.
- A house-rules agent stores reusable rulings for one chat, one character, or one agent.
- A personal assistant-style custom agent stores checklist items, preferences, and prior decisions.

## Requested Built-In Tools

### `save_custom_data`

Creates or updates a custom data record.

Expected inputs:

| Field | Purpose |
| --- | --- |
| `content` | Required text content to store. |
| `namespace` | Optional logical bucket, such as `continuity`, `npc_notes`, or `planning`. |
| `title` | Optional human-readable label. |
| `metadata` | Optional structured metadata object. |
| `scope` | Optional model-facing scope selector. |
| `characterName` | Optional active character selector when saving character-scoped data. |
| `recordId` | Optional existing record ID for update/upsert behavior. |
| `enableSemanticIndex` | Optional boolean to request embedding/indexing for semantic retrieval. |

The model should not provide raw internal chat IDs, character IDs, or agent config IDs. The server should resolve those from tool execution context.

### `search_custom_data`

Searches custom data records.

Expected inputs:

| Field | Purpose |
| --- | --- |
| `query` | Required query text. |
| `namespace` | Optional namespace filter. |
| `scope` | Optional model-facing scope filter. |
| `characterName` | Optional active character selector for character-scoped search. |
| `mode` | Search mode: `literal`, `fuzzy`, or `semantic`. |
| `topK` | Optional result count. |
| `similarityThreshold` | Optional semantic threshold when `mode` is `semantic`. |
| `metadataFilter` | Optional simple metadata filter, if feasible in the first implementation. |

Search modes:

- `literal`: exact or case-insensitive substring matching over content/title/namespace.
- `fuzzy`: non-vector text matching, such as token overlap or lightweight approximate matching.
- `semantic`: embedding-backed search over records that have semantic indexes available.

Semantic search should be optional. The tool should return a clear result when semantic search is unavailable or a record has not been indexed.

### `list_custom_data`

Lists records without requiring a query.

Expected inputs:

| Field | Purpose |
| --- | --- |
| `namespace` | Optional namespace filter. |
| `scope` | Optional model-facing scope filter. |
| `characterName` | Optional active character selector for character-scoped listing. |
| `limit` | Optional page size. |
| `cursor` | Optional pagination cursor. |
| `includeContent` | Optional boolean to include full content or summaries only. |

### `delete_custom_data`

Deletes or disables a custom data record.

Expected inputs:

| Field | Purpose |
| --- | --- |
| `recordId` | Required custom data record ID returned by save/search/list. |
| `hardDelete` | Optional boolean; default should be soft delete if the app wants recovery/audit behavior. |

Deletion must enforce scope and ownership. A custom agent should not be able to delete records outside the allowed scope for the current execution context.

## Storage Expectations

Based on CR008, the durable storage path should align with the current file-native storage model.

The feature should persist through the app's file-backed table store, producing a table snapshot such as:

```text
DATA_DIR/storage/tables/custom_agent_data.json
```

The server may still define a Drizzle-shaped table/schema for compatibility with the existing runtime API, but the feature request should not assume a live SQL database as the primary durable store.

Possible row shape:

```text
custom_agent_data
- id
- namespace
- title
- content
- metadata
- scopeType
- chatId
- characterId
- agentConfigId
- embedding
- embeddingProvider
- embeddingModel
- contentHash
- enabled
- createdAt
- updatedAt
- deletedAt
```

The exact schema can change during HLD, but it should support:

- stable record IDs
- namespace filtering
- model-facing scopes resolved to internal IDs by the server
- optional semantic index data
- literal/fuzzy search without embeddings
- list and delete operations
- file-native backup/export behavior consistent with other tables

## Scope Model

The tools should support model-facing scope names rather than raw IDs.

Suggested scopes:

| Scope | Meaning |
| --- | --- |
| `chat` | Data belongs to the current chat. |
| `character` | Data belongs to one active character, selected by `characterName`. |
| `agent` | Data belongs to the executing agent config. |
| `chat_agent` | Data belongs to this agent in this chat. |
| `global_agent` | Data belongs to this agent across chats, if allowed. |

The server should resolve concrete IDs from tool execution context:

- current chat ID
- active character IDs and names
- executing agent config ID

If the context is missing, the tool should fail clearly rather than letting the model invent IDs.

## Tool Policy Example

```text
Use namespace "continuity".

Call save_custom_data for stable facts, unresolved tasks, promises, decisions, and significant events that should persist beyond the current context.

Use scope "chat" for records that only matter in this chat.
Use scope "character" plus characterName for records about one active character.
Use scope "agent" for records owned by this agent workflow.

Before answering questions about prior facts, plans, decisions, or continuity, call search_custom_data.

Use mode "literal" when looking for exact names or phrases.
Use mode "fuzzy" when the wording may differ but embeddings are unnecessary.
Use mode "semantic" when looking for conceptually related records and semantic indexing is available.

Do not save routine small talk, transient emotion, repeated facts, or data already present in active prompt context.
```

## Out Of Scope

- Replacing memory recall.
- Replacing lorebooks.
- Automatically injecting custom data into prompts without an explicit agent/tool call.
- Making vector storage the core user-facing concept.
- Adding an external vector database.
- Reworking tracker snapshot storage.
- Migrating existing character memories into this store.

## Open Questions

- Should `save_custom_data` update by `recordId` only, or also support upsert by `namespace` + `title` + `scope`?
- Should semantic indexing happen eagerly on save, lazily on first semantic search, or only when `enableSemanticIndex` is true?
- Should semantic indexing use the local embedder by default, configured embedding connections, or a setting per agent/tool call?
- Should custom data records be visible in a UI immediately, or only through tools in the first implementation?
- Should soft-deleted records be recoverable or only hidden from tool results?
- Should metadata filtering be included in the first implementation or deferred until there is a clear query syntax?

