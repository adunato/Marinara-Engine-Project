# CR047 — Low-Level Design: Consistent Character Daily Memory Retrieval

_Status: Approved for implementation; derived from the CR047 HLD and staging
code inspection._

## 1. Scope and design decision

Use the existing `retrieveDailyMemories` function as the canonical retrieval
algorithm. This is a wiring and contract-parity change, not a new search
algorithm or schema migration. The Memories-tab policy is the source of truth;
normalization remains in `normalizeDailyMemorySettings`, and runtime selection
remains in `resolveDailyMemoryRetrievalSettings` / the existing Daily Memory
agent runtime.

The current settings contain semantic weight, importance weight, recency
weight, minimum rank, recency half-life, and chat query message count. They do
not contain a result limit. No caller may introduce a hidden limit. Results are
all eligible indexed Daily Memories after thresholding and deterministic
ranking.

## 2. Shared contract

`retrieveDailyMemories({ db, chatId, query, settings, embeddingSource, now?, signal? })`
is the sole retrieval boundary. It must:

1. embed the caller-provided query with the selected embedding source;
2. read only Daily Memory rows for `chatId` with usable embeddings;
3. compute semantic, importance, and recency scores using normalized settings;
4. reject records below `minimumRank`;
5. sort by ranking score, then importance, then date; and
6. return `RankedDailyMemory[]` with no caller-specific truncation.

Callers provide only query and scope. They do not provide weights, thresholds,
or an alternate corpus. `extensions.characterMemories` is never read here.

The settings resolution precedence is: persisted Memories/agent settings for
the active owning scope, normalized through the shared defaults; malformed or
missing fields use those defaults. A disabled or unavailable Daily Memory
runtime follows the existing unavailable/optional-degradation behavior and
must not fall back to an unconstrained database read.

## 3. Caller adapters

### Preview Retrieval

`daily-memories.routes.ts` keeps accepting the user's manual query. It resolves
the same settings and embedding source, passes the selected chat/character
scope to `retrieveDailyMemories`, and maps `RankedDailyMemory[]` to its current
API response. Existing preview response fields and ordering semantics remain
stable.

### Conversation

The existing conversation generation path continues to call
`buildDailyMemoryRetrievalQuery(messages, settings.retrievalMessageCount)`.
It joins the resulting lines into the query and invokes the shared boundary
with the conversation's owning chat scope. Context formatting and the
`lastDailyMemoryRetrieval` snapshot remain unchanged; the snapshot is made
from the shared result.

### Character Briefing

`character-briefing.service.ts` keeps asking the generation model for a
dedicated natural-language query per briefing instruction. The host—not the
model—resolves the owning character's Daily Memory chat scope, settings, and
embedding source, then calls `retrieveDailyMemories`. The
`search_character_daily_memories` manifest remains a single `query` argument;
weights, threshold, limit, user scope, and character scope are not exposed.
The adapter maps the shared ranked result to the existing tool output and
retains its `available`/empty/error contract.

The adapter must not use the character-card ID as a Daily Memory `chatId`
unless that is the established owning scope for the character's memories. It
must resolve the same scope key used by Preview and Conversation; this is the
primary guard against the observed Jace empty-array mismatch.

## 4. Diagnostics and privacy

Add structured, privacy-safe diagnostics at the shared boundary or adapter
boundary: caller (`preview`, `conversation`, `briefing`), scope identifier
type (not a character name), availability, candidate count, eligible count,
and returned count. Do not log raw queries, memory text, embeddings, persona
data, or full scope identifiers. Phoenix traces may therefore distinguish
wrong scope, unavailable embedding, no indexed rows, and threshold rejection
without leaking content.

## 5. Files and ownership

- `packages/server/src/services/conversation/daily-memory.service.ts`: shared
  contract, normalization, ranking, and optional diagnostics.
- `packages/server/src/services/generation/daily-memory-agent-runtime.ts`:
  shared persisted-policy resolution; no duplicated defaults.
- `packages/server/src/routes/daily-memories.routes.ts`: Preview adapter.
- `packages/server/src/routes/generate.routes.ts` and the existing conversation
  memory context modules: Conversation adapter/query source.
- `packages/server/src/services/character-briefing.service.ts`,
  `character-briefing.routes.ts`, and tool executor: Briefing scope/query
  adapter.
- `packages/shared/src/features/function-calls/tools/search-character-daily-memories/manifest.ts`:
  verify the model-facing schema remains query-only.
- Focused server tests adjacent to each adapter plus shared retrieval tests.

No client behavior, database migration, legacy character-memory behavior, or
E2E test is required by this design. Focused API/server regression coverage is
required; Playwright remains optional and is not part of the agreed scope.

## 6. Invariants and acceptance criteria

- Equivalent queries for the same owning scope return identical IDs, order,
  threshold behavior, and count from Preview, Chat, and Briefing.
- Changing any persisted retrieval weight, threshold, or half-life changes all
  three callers consistently after normalization.
- Chat uses only its last configured N messages; Briefing uses its generated
  query; Preview uses its manual query.
- No caller can override policy, scope, corpus, or an undocumented limit.
- Empty, missing-embedding, disabled, and unavailable cases preserve the
  existing safe-degradation/tool response contracts.
- Legacy `extensions.characterMemories` never appears in Daily Memory search.
- Tests prove the Jace-equivalent scope no longer returns an empty result when
  Preview finds eligible Daily Memories.

## 7. Verification and rollback

Run focused server/unit tests for shared scoring, settings normalization,
scope parity, adapter response mapping, privacy-safe diagnostics, and failure
paths. Then run the repository's proportionate `pnpm check` and staging
production build. No `pnpm db:push` is expected because the design adds no
schema changes.

Rollback is a revert of the CR047 application commit(s). It does not modify
stored Daily Memories or persisted settings.
