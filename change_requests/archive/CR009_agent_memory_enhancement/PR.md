## Why this change

Agents currently have only narrow per-agent key/value memory, which works for internal state like the secret plot driver but does not give built-in or custom agents a clear way to save, search, list, and delete durable memory records. This change adds an owner-aware agent memory surface that keeps current secret plot behavior working while making explicit agent-authored memory available through built-in tools.

Examples of how this expanded memory agent functionality can be used are: custom memories saving and retrieval, persistent custom trackers, etc

## What changed

*Key Changes*

- Expanded `agent_memory` storage to support typed records with title, content, metadata, optional embeddings, ownership fields, timestamps, and soft deletion.
- Added built-in tools for `save_agent_memory`, `search_agent_memory`, `list_agent_memory`, and `delete_agent_memory`.

*Secondary Changes*

- Added server-side ownership resolution from the current chat, executing agent config, and active character list, without accepting raw internal IDs from tool callers.
- Added literal, fuzzy, and optional semantic search behavior; semantic search returns a clear unavailable result when embeddings are not available.
- Updated existing agent memory compatibility so current key/value use, including secret plot state, continues through the enhanced storage model.
- Added `settings.memoryScope` as an explicit opt-in for multi-agent cooperation, so writer/retriever custom agents can share records without making all agent memory chat-global.

## Validation

- [x] `pnpm check`
- [x] Manual verification completed (describe below)
- [x] playwright testing to cover regression and new test (playtest files not included in the PR)

### Manual verification notes

- UI verification was performed ensuring that agent activity was logged correctly. 
- A Playwright suite exercised save, search, list, delete, and semantic-unavailable behavior through deterministic API/tool execution (playwright files not included as not part of repo testing strategy).
- Follow-up local session verification confirmed the writer/retriever custom agents can be configured with the same `memoryScope` and that existing writer-owned `character_memory` records can be tagged with `metadata.memoryScope` for shared retrieval. The patch preserves per-agent isolation when `memoryScope` is absent.
- No regression testing was performed on agent memory functionality used by Secret Plot agent confirming both writing and reading ot its generations.

## Docs and release impact

- [ ] No docs changes needed
- [ ] Version/release files updated (only if this PR includes a version bump)

## UI evidence (if applicable)

Not applicable. This change adds server/storage/tool behavior and does not introduce a user-facing UI surface.
