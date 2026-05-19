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
- [ ] Manual verification completed (describe below)

Additional validation run:

- [x] `cd Marinara-Engine && pnpm db:push`
- [x] `MARINARA_ENGINE_DIR=Marinara-Engine-CR009 pnpm exec playwright test tests/e2e/specs/change-requests/CR009 --reporter=line`

### Manual verification notes

- No separate manual UI verification was performed. The focused CR009 Playwright suite exercised save, search, list, delete, and semantic-unavailable behavior through deterministic API/tool execution and attached tool-result/server-log evidence.

## Docs and release impact

- [x] No docs changes needed
- [ ] Updated docs (README / CONTRIBUTING / android/README / CHANGELOG) as needed
- [ ] Version/release files updated (only if this PR includes a version bump)

## UI evidence (if applicable)

Not applicable. This change adds server/storage/tool behavior and does not introduce a user-facing UI surface.
