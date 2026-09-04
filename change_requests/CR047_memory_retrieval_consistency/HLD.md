# CR047 — Consistent Character Daily Memory Retrieval

_Status: Planning complete; approved for implementation._

## 1. Purpose

Make Character Daily Memory retrieval use one persisted retrieval policy across
the Memories preview, normal Conversation memory retrieval, and the Character
Briefing `search_character_daily_memories` tool. The current inconsistency can
make a manual preview return evidence while an equivalent briefing or chat
retrieval returns an empty or differently ranked set.

## 2. Goals

- Reuse the existing character-owned Memories-tab retrieval settings as the
  canonical policy, including semantic, importance, recency, threshold, and
  the configured recent-message count. The current persisted settings do not
  define a result-limit setting; retrieval therefore remains unlimited unless
  a future, explicitly persisted limit is added. The recency half-life remains
  the existing implementation default rather than introducing a new setting.
- Ensure Preview, Chat, and Character Briefing search the same active
  character-owned Daily Memory corpus/index with the same character scope,
  eligibility rules, ranking, and result selection.
- Preserve the intended query-source difference:
  - Preview derives a query from the selected Conversation's last configured
    `N` visible messages.
  - Chat derives a query from the current Conversation's last configured `N`
    visible messages.
  - Character Briefing asks its generation model to formulate a dedicated
    query for the current briefing instruction.
- Keep legacy `extensions.characterMemories` / Scene summaries outside this
  retrieval contract.
- Keep retrieval tuning host-controlled; model tools must not choose weights,
  limits, thresholds, or scopes.

## 3. Proposed Solution

Reuse `createCharacterDailyMemoryRetrievalService().searchForCharacter()` in
`services/character-daily-memories/retrieval.service.ts` as the one
server-side retrieval boundary. It already loads the character-owned active
memory pool, reads the persisted character settings, resolves the configured
embedding source, and ranks the indexed memories. Extend that boundary only
as needed to remove caller-specific behavior and to return every memory that
passes the configured threshold. Do not create a second generic
`memory-recall` algorithm and do not add a tool-only result cap.

The existing Preview route already exposes a `previewRetriever` adapter
contract in `routes/character-daily-memories.routes.ts`; wire that callback to
the shared retrieval service. The current staging Chat path does not yet call
the character-owned retrieval service: add a thin adapter at the existing
Conversation history assembly boundary, `prepareConversationPromptHistory`
in `routes/generate/conversation-history-runtime.ts`, invoked from the
Conversation branch of `routes/generate.routes.ts`. That adapter receives the
known current Conversation messages and character IDs, derives each enabled
character's query from its configured last `N` visible messages, and injects
separate character-labelled blocks. The existing generic `memory-recall`
path remains independent.

The Character Briefing tool remains model-facing as
`search_character_daily_memories(query)`. Its implicit owning-character scope
and dedicated generated query are supplied by the host. It must not accept
retrieval parameters or fall back to an unranked/raw-memory search.

If the existing configuration cannot be safely shared by all three callers,
extend it minimally while retaining backward-compatible defaults. Do not
introduce a second set of tool-only values. Existing safe-degradation behavior
for Conversation retrieval remains intact and is applied consistently to the
other callers where the shared backend is unavailable.

## 4. Invariants and Boundaries

- A given character-owned active-memory scope, policy, and equivalent query
  produce the same eligible records and order regardless of caller.
- Query construction is caller-specific; retrieval policy and corpus scope are
  not.
- Retrieval never includes legacy character-card memories unless a future CR
  explicitly changes that boundary.
- The model cannot widen scope or override persisted retrieval settings.
- Existing Memories settings and existing Chat/Briefing contracts remain
  backward compatible unless a migration is required and documented.
- The three callers must use the same persisted character settings and
  embedding-space validation; a missing/disabled retrieval runtime produces
  the existing unavailable result rather than a raw or differently scoped
  query.

## 5. Risks and Mitigations

- **Character Daily Memories currently have a Briefing/Preview retrieval
  service but no Chat adapter.** Add the thin Chat adapter at the existing
  history assembly boundary and centralize policy in the character retrieval
  service; add fixture-based parity tests for selected records/order.
- **Persisted settings may be missing or malformed.** Normalize through the
  existing defaults and validate once at the shared boundary.
- **Embedding/index availability may differ by route.** Preserve structured
  unavailable/error results and caller-appropriate safe degradation; never
  silently return unconstrained memories.
- **Chat query derivation may yield a different natural-language query.** This
  is expected; parity tests should compare policy and corpus behavior using
  equivalent fixture queries, while separate tests cover each query source.

## 6. Validation Expectations

- Server tests prove all three callers invoke the shared retrieval boundary and
  receive identical ranked fixture results for equivalent queries.
- Tests cover persisted semantic/importance/recency/threshold settings,
  character scoping, the no-cap result contract, unavailable backends, empty
  results, and malformed configuration defaults.
- Character Briefing tool tests prove its query remains model-generated and its
  contract exposes no tuning arguments.
- Run the proportionate server/client checks and production build required by
  the staging workflow; add focused Playwright coverage only if separately
  agreed for this behavior-bearing change.

## 7. Base and Branch Intent

- Application base: local `staging`.
- Intended application branch: `change/CR047-memory-retrieval-consistency`.
- Parent documentation is maintained in this repository; application work
  must use a dedicated nested worktree in the next lifecycle stages.
