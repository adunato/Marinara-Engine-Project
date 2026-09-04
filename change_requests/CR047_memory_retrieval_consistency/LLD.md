# CR047 — Low-Level Design: Consistent Character Daily Memory Tool Retrieval

_Status: Amended; approved for implementation._

## 1. Scope and correction

This is a tool-boundary and retrieval-policy parity change. It uses the
existing `createCharacterDailyMemoryRetrievalService({ db, storage })` and its
`searchForCharacter({ characterId, query, caller, signal })` method as the
canonical boundary. It does not add a new search algorithm, schema migration,
or Conversation prompt-history integration.

The prior CR047 commit (`f6d017398`) added a Daily Memory adapter to
`prepareConversationPromptHistory` and inserted a `dailyMemoryBlock` in
`generate.routes.ts`. Remove those changes. `prepareConversationPromptHistory`
must remain responsible for existing history/summary assembly only; it must
not retrieve or inject Character Daily Memories.

## 2. Shared retrieval contract

`searchForCharacter` is the only retrieval boundary for Preview, Chat, and
Briefing. It must:

1. load the owning character's persisted Character Daily Memory settings;
2. normalize missing or malformed semantic, importance, recency, and
   minimum-rank values through the shared defaults;
3. resolve the configured embedding source and embed the caller-provided query;
4. read active Daily Memory rows owned by `characterId` with usable embeddings
   in the same embedding space;
5. calculate the configured semantic/importance/recency ranking;
6. reject records below the configured minimum rank; and
7. sort deterministically and return every eligible result, without a hidden
   caller-specific limit.

Callers provide only character scope, query, caller label, and cancellation
signal. They cannot provide weights, threshold, result limit, user scope, or
an alternate corpus. `extensions.characterMemories` and Scene summaries are
not read here.

Preserve the existing `{ available, results }` semantics, including safe
empty/unavailable outcomes. Additional diagnostics may identify caller,
character scope kind, availability, and candidate/eligible/returned counts,
but must not contain raw queries, memory text, embeddings, names, or complete
scope identifiers.

## 3. Preview adapter

In `packages/server/src/routes/character-daily-memories.routes.ts`, retain the
existing Preview route behavior:

- validate the selected Conversation and owning character membership;
- load the character's persisted `retrievalMessageCount`;
- filter hidden/empty/non-visible messages;
- select the last configured `N` messages in chronological order;
- format the Preview query; and
- call `searchForCharacter({ characterId, query, caller: "preview" })`.

Preserve the current Preview response shape and diagnostics mapping.

## 4. Chat tool adapter

Retain the existing Chat custom-tool path and its host callback. Its adapter
must:

- receive the model's query request through the existing
  `search_character_daily_memories` tool contract;
- derive the query from the current Conversation's last configured `N`
  visible messages, in chronological order, using the existing visibility
  rules;
- pass the owning character ID and derived query to
  `searchForCharacter({ characterId, query, caller: "conversation" })`; and
- map the shared result using the existing Chat tool response contract.

If the current staging code has this logic in
`conversation-history-runtime.ts`, move/revert it to the existing Chat tool
host surface rather than extending prompt-history preparation. Do not add a
Daily Memory block to `finalMessages`.

## 5. Character Briefing adapter

In `packages/server/src/services/character-briefing.service.ts`, preserve the
existing per-instruction LLM tool loop. The model calls
`search_character_daily_memories` with a natural-language `query`; the host
callback supplies the owning `characterId` and invokes:

```ts
retrieval.searchForCharacter({ characterId, query, caller: "briefing" })
```

The generation model remains responsible for creating the dedicated Briefing
query. The shared tool manifest and `tool-executor.ts` must continue to expose
and validate only the non-empty `query` argument. Retrieval settings and scope
remain host-controlled.

## 6. Files and ownership

- `packages/server/src/services/character-daily-memories/retrieval.service.ts`:
  shared settings normalization, embedding, scope, ranking, threshold, no-cap
  selection, and diagnostics.
- `packages/server/src/routes/character-daily-memories.routes.ts`: Preview
  query construction and adapter mapping.
- Existing Chat generation/tool host surface: last-visible-message query
  construction and Chat callback wiring; exact path must be confirmed during
  implementation.
- `packages/server/src/services/character-briefing.service.ts`: Briefing LLM
  tool callback and owning-character binding.
- `packages/server/src/services/tools/tool-executor.ts` and
  `packages/shared/src/features/function-calls/tools/search-character-daily-memories/manifest.ts`:
  query-only model-facing contract.
- `packages/server/src/routes/generate/conversation-history-runtime.ts` and
  `packages/server/src/routes/generate.routes.ts`: remove prior CR047 Daily
  Memory retrieval/injection additions; no replacement retrieval behavior.
- Focused server tests for shared scoring and each adapter.

No client, database, legacy character-memory, or E2E changes are required.

## 7. Invariants and acceptance criteria

- Equivalent queries for the same owning character return identical IDs,
  ordering, threshold behavior, and counts through Preview, Chat, and Briefing.
- Chat uses only the last configured `N` visible messages; Briefing uses its
  LLM-generated query; Preview retains its selected Conversation query.
- All callers use the same persisted weights, threshold, corpus, character
  scope, embedding-space validation, and no-cap result selection.
- No model-facing argument can override retrieval policy or scope.
- `prepareConversationPromptHistory` performs no Character Daily Memory
  retrieval and injects no Daily Memory context.
- Legacy `extensions.characterMemories` never appears in these results.
- Disabled, empty, missing-embedding, unavailable-provider, and no-result
  cases preserve safe degradation.
- Tests cover the Jace-equivalent Preview/Briefing scenario that originally
  exposed the empty-result discrepancy.

## 8. Verification and rollback

Run focused server/unit tests for settings normalization, shared scoring,
tool adapters, query derivation, no-cap behavior, scope, unavailable/empty
paths, and prompt-history non-injection. Then run proportionate repository
checks and the staging production build; no `pnpm db:push` is expected.

Rollback is a revert of the corrected CR047 application commit(s). Stored
Daily Memories and persisted settings remain untouched.
