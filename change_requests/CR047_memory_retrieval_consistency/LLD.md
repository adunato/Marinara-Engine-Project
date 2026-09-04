# CR047 — Low-Level Design: Consistent Character Daily Memory Retrieval

_Status: Approved for implementation; derived from the CR047 HLD and staging
code inspection._

## 1. Scope and design decision

Use the existing
`createCharacterDailyMemoryRetrievalService().searchForCharacter()` as the
canonical retrieval boundary. This is a wiring and contract-parity change, not
a new search algorithm or schema migration. The character Memories-tab policy
is the source of truth and is already loaded by the retrieval service through
`CharacterDailyMemoriesStorage.getSettings()`; normalize missing or malformed
values against the shared character-memory defaults. Do not use the generic
`memory-recall` service for this feature; it searches a different corpus.

The current persisted settings contain semantic weight, importance weight,
recency weight, minimum rank, and chat query message count. Recency half-life
is the retrieval service's existing fixed default (30 days), and is not a
separate persisted control. There is no persisted result limit. Remove the
retrieval service's current default top-10 slice; no caller may introduce a
hidden limit. Results are all eligible indexed Daily Memories after thresholding
and deterministic ranking.

## 2. Shared contract

`searchForCharacter({ characterId, query, signal? })` is the sole retrieval
boundary. It must:

1. read the character's persisted settings and resolve its configured
   embedding source;
2. embed the caller-provided query with that source;
3. read only active-run Daily Memory rows owned by `characterId` with usable,
   same-space embeddings;
4. compute semantic, importance, and recency scores using normalized settings;
5. reject records below `minimumRankPercent`;
6. sort deterministically by ranking score and stable recency/ID tie-breakers;
   and
7. return every selected result with no caller-specific truncation.

Callers provide only the character scope and query. They do not provide
weights, thresholds, limits, or an alternate corpus.
`extensions.characterMemories` is never read here.

Missing settings, empty queries, no active memories, missing/mismatched
embeddings, or unavailable embedding providers preserve the existing
`{ available, results }` contract. A disabled character is skipped by the Chat
adapter and does not fall back to an unconstrained database read.

## 3. Caller adapters

### Preview Retrieval

`character-daily-memories.routes.ts` continues to validate the selected
Conversation and select its visible recent messages. Its existing
`previewRetriever` callback is the adapter seam: it passes the character ID,
selected chat ID, recent messages, and persisted settings to the shared
retrieval service, then maps the ranked results to the current preview response.
The Preview query is the configured last `N` visible messages from the selected
Conversation; it does not use an LLM query.

### Conversation

Staging currently has no Character Daily Memory Chat adapter. Add a thin
adapter at `prepareConversationPromptHistory` in
`routes/generate/conversation-history-runtime.ts`, invoked by the Conversation
branch in `routes/generate.routes.ts`, where `allCharacterIds`, scoped current
messages, and prompt assembly are already available. For each enabled
character in the Conversation, select the last configured `N` visible
Conversation messages in chronological order, format speaker-attributed query
text, and call `searchForCharacter({ characterId, query, signal })`. Inject
separate character-labelled Daily Memory blocks into the prompt. Retrieval
failure remains optional and must not block generation. The existing generic
`injectMemoryRecallContext` / `recallMemories` path remains independent.

### Character Briefing

`character-briefing.service.ts` keeps asking the generation model for a
dedicated natural-language query per briefing instruction. The host—not the
model—passes the owning character ID to
`searchForCharacter({ characterId, query, signal })`. The
`search_character_daily_memories` manifest remains a single `query` argument;
weights, threshold, limit, user scope, and character scope are not exposed.
The adapter maps the shared ranked result to the existing tool output and
retains its `available`/empty/error contract. Character ID is the actual
Daily Memory ownership key; no synthetic chat ID is permitted.

## 4. Diagnostics and privacy

Add structured, privacy-safe diagnostics at the shared boundary or adapter
boundary: caller (`preview`, `conversation`, `briefing`), scope identifier
type (not a character name), availability, candidate count, eligible count,
and returned count. Do not log raw queries, memory text, embeddings, persona
data, or full scope identifiers. Phoenix traces may therefore distinguish
wrong scope, unavailable embedding, no indexed rows, and threshold rejection
without leaking content.

## 5. Files and ownership

- `packages/server/src/services/character-daily-memories/retrieval.service.ts`:
  shared settings loading, embedding, active-memory scope, ranking,
  threshold, and no-cap result selection.
- `packages/server/src/services/storage/character-daily-memories.storage.ts`:
  persisted settings and active-run memory ownership used by the boundary.
- `packages/server/src/routes/character-daily-memories.routes.ts`: Preview
  `previewRetriever` adapter and response mapping.
- `packages/server/src/routes/generate/conversation-history-runtime.ts`:
  Conversation adapter/query derivation and character-labelled prompt blocks;
  `packages/server/src/routes/generate.routes.ts` supplies its existing call
  site/context.
- `packages/server/src/services/character-briefing.service.ts` and
  `packages/server/src/services/tools/tool-executor.ts`: Briefing callback and
  existing tool response contract.
- `packages/shared/src/features/function-calls/tools/search-character-daily-memories/manifest.ts`:
  verify the model-facing schema remains query-only.
- Focused server tests adjacent to each adapter plus shared retrieval tests.

No client behavior, database migration, legacy character-memory behavior, or
E2E test is required by this design. Focused API/server regression coverage is
required; Playwright remains optional and is not part of the agreed scope.

## 6. Invariants and acceptance criteria

- Equivalent queries for the same owning scope return identical IDs, order,
  threshold behavior, and count from Preview, Chat, and Briefing.
- Changing any persisted retrieval weight or threshold changes all three
  callers consistently; the fixed 30-day recency half-life is shared by all
  callers.
- Chat and Preview use only their last configured N visible messages; Briefing
  uses its generated query.
- No caller can override policy, scope, corpus, or an undocumented limit.
- Empty, missing-embedding, disabled, and unavailable cases preserve the
  existing safe-degradation/tool response contracts.
- Legacy `extensions.characterMemories` never appears in Daily Memory search.
- Tests prove the Chat adapter uses the character scope and last-N query, and
  the Jace-equivalent scope no longer returns an empty result when Preview
  finds eligible Daily Memories.

## 7. Verification and rollback

Run focused server/unit tests for shared scoring, settings normalization,
scope parity, adapter response mapping, privacy-safe diagnostics, and failure
paths. Then run the repository's proportionate `pnpm check` and staging
production build. No `pnpm db:push` is expected because the design adds no
schema changes.

Rollback is a revert of the CR047 application commit(s). It does not modify
stored Daily Memories or persisted settings.
