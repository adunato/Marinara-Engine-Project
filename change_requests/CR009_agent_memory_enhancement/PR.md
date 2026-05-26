## Why this change

Agents currently have only narrow per-agent key/value memory, which works for internal state like the secret plot driver but does not give built-in or custom agents a clear way to save, search, list, and delete durable memory records. This adds an owner-aware agent memory surface that keeps current secret plot behavior working while making explicit agent-authored memory available through built-in tools.

## What changed

- Expanded `agent_memory` storage to support typed records with title, content, metadata, optional embeddings, ownership fields, timestamps, and soft deletion.
- Added built-in tools for `save_agent_memory`, `search_agent_memory`, `list_agent_memory`, and `delete_agent_memory`.
- Added server-side ownership resolution from the current chat, executing agent config, and active character list, without accepting raw internal IDs from tool callers.
- Added literal, fuzzy, and optional semantic search behavior; semantic search returns a clear unavailable result when embeddings are not available.
- Updated existing agent memory compatibility so current key/value use, including secret plot state, continues through the enhanced storage model.
- Added `settings.memoryScope` as an explicit opt-in for multi-agent cooperation, so writer/retriever custom agents can share records without making all agent memory chat-global.
- Treat omitted `characterName` as no character filter during search/list, while explicit character names still resolve against active characters.

## Validation

- [x] `cd Marinara-Engine && pnpm check`
- [x] Manual verification completed (describe below)

Additional validation run:

- [x] `cd Marinara-Engine && pnpm db:push`
- [x] `MARINARA_ENGINE_DIR=Marinara-Engine-CR009 pnpm exec playwright test tests/e2e/specs/change-requests/CR009 --reporter=line`
- [x] Follow-up `cd Marinara-Engine && pnpm check` after adding `settings.memoryScope`
- [x] Rebased `upstream-main` onto `upstream/main` and confirmed `upstream/main` is an ancestor of the CR009 branch
- [x] `cd Marinara-Engine && git diff --check upstream/main..upstream-main`
- [x] `cd Marinara-Engine && pnpm install`
- [x] `cd Marinara-Engine && pnpm check` on the rebased `v1.6.1` stack
- [x] Force-with-lease updated `origin/change/CR009-agent-memory-enhancement` to the rebased CR009 tip
- [x] Confirmed the remote CR009 branch contains only the five CR009 commits over `upstream/main`

### Manual verification notes

- No separate manual UI verification was performed. The focused CR009 Playwright suite exercised save, search, list, delete, and semantic-unavailable behavior through deterministic API/tool execution and attached tool-result/server-log evidence.
- Follow-up local session verification confirmed the CR009 writer/retriever custom agents can be configured with the same `memoryScope` and that existing writer-owned `character_memory` records can be tagged with `metadata.memoryScope` for shared retrieval. The patch preserves per-agent isolation when `memoryScope` is absent.
- Rebase conflict review confirmed CR009 agent-memory behavior remained intact: agent-memory tools still run only in agent contexts, `memoryScope` is passed into tool execution, main generation does not expose agent-memory tools, secret plot runs as pre-generation, and secret plot memory is persisted before prompt injection and before writer-output review returns.

## Docs and release impact

- [ ] No docs changes needed
- [x] Updated CR009 design, implementation, and manual verification docs for `settings.memoryScope`
- [ ] Version/release files updated (only if this PR includes a version bump)

## UI evidence (if applicable)

Not applicable. This change adds server/storage/tool behavior and does not introduce a user-facing UI surface.
