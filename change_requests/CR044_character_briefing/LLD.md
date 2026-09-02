# Low-Level Design: CR044 — Character Briefing

## 1. Change Overview

CR044 adds a manually generated, Character-owned Briefing that captures evolving story understanding across Conversations and is injected additively into normal Conversation generation.

Application baseline:

- repository: `adunato/Marinara-Engine`
- branch: `staging`
- planning baseline: `80f688df25b691ab3dc602c0c33470d32bf6124b`

The implementation must preserve the normal Marinara prompt pipeline. Character Briefing does not replace the Conversation prompt, Character Card, Persona, history/summaries, CR042 Daily Memories, Lorebooks, live context, or any other existing source.

V1 is manual-generation only.

## 2. Resolved V1 Architecture

### 2.1 Persisted source and generated result

Each Character has at most one Character Briefing record containing:

- editable **Source Template**;
- nullable Character Briefing generation connection ID;
- read-only **Latest Briefing**;
- latest successful generation timestamp;
- normal persistence timestamps/status as needed.

The Source Template is never replaced by generated content.

### 2.2 Host-owned replacement

`[[...]]` spans are parsed by Marinara with exact source offsets. The model generates only the replacement for the current slot. Marinara reconstructs the complete Latest Briefing from original source slices plus validated replacement strings.

The model is never asked to rewrite the complete document.

### 2.3 Deterministic application entities

Character Cards and Lorebooks are not agent-discovery domains in V1.

- the owning Character Card is always loaded by the host;
- `$Character` references in the current instruction are resolved by stable Character ID and their complete Character Cards are loaded by the host;
- `$Lorebook` references in the current instruction are resolved by stable Lorebook ID and their complete Lorebook resources are loaded by the host;
- natural-language names are never mapped to application entities by the model;
- no Character or Lorebook get/search tool is exposed.

### 2.4 One genuinely agentic retrieval capability

The only V1 tool available to the Character Briefing agent is:

```text
search_character_daily_memories(query)
```

It is implemented as a normal Marinara built-in tool, but the Character Briefing runtime exposes it through a hardcoded allowlist containing no other tools.

The tool is host-scoped to the owning Character and reuses the same CR042 Daily Memory retrieval/ranking/filtering/result-selection policy used by ordinary Conversation injection.

### 2.5 Per-slot bounded sessions

Each instruction is executed sequentially in a separate bounded tool-capable model session.

Every slot receives the same Source Template snapshot taken at the start of the run. Generated output from earlier slots is retained by the host for final reconstruction but is not substituted into the template context for later slots.

### 2.6 No Persona in briefing-generation context

Character Briefing is Character-owned and may span Conversations that use different Personas. V1 therefore does not select or inject a Persona Card into briefing generation.

### 2.7 Generation connection

Character Briefing has its own optional generation connection setting.

Resolution follows the existing Character-scoped agent pattern used by CR042 where practical:

1. explicitly configured Character Briefing generation connection;
2. normal default agent connection/fallback infrastructure when no explicit connection is configured.

The resolved connection is fixed for the entire manual generation run. CR044 never inherits an arbitrary Conversation connection.

## 3. Shared Types and Persistence Model

### 3.1 Shared state contract

Add a shared contract equivalent to:

```ts
export type CharacterBriefingState = {
  characterId: string;
  sourceTemplate: string;
  generationConnectionId: string | null;
  latestBriefing: string | null;
  latestGeneratedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};
```

An existing Character without a persisted CR044 row is represented to the client as the default state:

```ts
{
  characterId,
  sourceTemplate: "",
  generationConnectionId: null,
  latestBriefing: null,
  latestGeneratedAt: null,
  createdAt: null,
  updatedAt: null
}
```

### 3.2 Configuration patch

Use a shared request schema equivalent to:

```ts
export type CharacterBriefingPatch = {
  sourceTemplate?: string;
  generationConnectionId?: string | null;
};
```

At least one property must be present.

The server, not the client, validates that a non-null connection ID is usable according to existing connection-resolution semantics.

### 3.3 Dedicated table

Prefer a dedicated one-row-per-Character table rather than putting generated state in versioned Character Card JSON.

Logical schema:

```text
character_briefings
-------------------
character_id              PK / Character reference
generation_connection_id  nullable connection reference
source_template            text, not null
latest_briefing            nullable text
latest_generated_at        nullable timestamp
created_at                 timestamp
updated_at                 timestamp
```

Use the staging repository's file-backed schema/storage conventions rather than introducing a different database mechanism.

Character deletion must cascade/remove its Briefing according to existing Character-owned table conventions.

Connection deletion/reference cleanup should follow the existing connection-reference policy. If the repository normally clears optional deleted connection IDs, clear the Briefing reference; otherwise preserve the existing convention and let generation resolution report the invalid configuration.

### 3.4 Storage operations

Create a focused storage boundary with operations equivalent to:

```ts
get(characterId)
saveConfiguration(characterId, patch)
publishLatest(characterId, expectedSourceTemplate, latestBriefing, generatedAt)
```

`publishLatest` must compare the persisted Source Template with `expectedSourceTemplate` inside the persistence/transaction boundary and fail on mismatch.

Do not create historical generation rows in V1.

## 4. Source Template Parser

### 4.1 Parsed slot shape

Shared parser output should contain exact source coordinates:

```ts
export type CharacterBriefingInstructionSlot = {
  slotIndex: number;
  startOffset: number;
  endOffsetExclusive: number;
  raw: string;             // includes [[ and ]]
  instruction: string;     // inner text
  references: CharacterBriefingEntityReference[];
};
```

### 4.2 Entity reference shape

```ts
export type CharacterBriefingEntityReference = {
  type: "character" | "lorebook";
  id: string;
  label: string;
  startOffset: number;     // relative or absolute, choose one convention and test it
  endOffsetExclusive: number;
};
```

### 4.3 Serialized token

Use a readable typed token equivalent to:

```text
$[character:<stable-id>|Amy]
$[lorebook:<stable-id>|Asteria]
```

The parser must treat type + stable ID as authoritative. `label` is display text only.

If labels can contain token delimiters, define deterministic escaping in the shared parser/serializer. Do not permit client and server to maintain separate ad-hoc token grammars.

### 4.4 Parser rules

Generation-time parsing must:

- support multiline instructions;
- identify exact `[[...]]` ranges;
- reject nested instruction spans;
- reject an unclosed instruction;
- identify typed `$` tokens only inside instruction spans;
- reject malformed typed tokens inside executable spans;
- permit ordinary `$` text outside instructions;
- permit a Source Template with zero instructions.

The client may save temporarily malformed source while the user is editing. Strict executable validation occurs when Generate is invoked.

### 4.5 Exact reconstruction

Reconstruct from offsets, never by matching instruction text:

```text
cursor = 0
output = ""

for slot in slots ordered by startOffset:
    output += source[cursor:slot.startOffset]
    output += replacements[slot.slotIndex]
    cursor = slot.endOffsetExclusive

output += source[cursor:]
```

Repeated identical instructions must therefore remain unambiguous.

### 4.6 Zero-slot generation

A Source Template with no `[[...]]` slots is valid.

Generate performs no model call and publishes the Source Template verbatim as Latest Briefing after normal source/configuration validation.

## 5. Server API

Register Character Briefing routes under the existing Character route namespace.

### 5.1 Read state

```http
GET /api/characters/:characterId/briefing
```

Behaviour:

- unknown Character -> 404;
- Character without CR044 row -> default empty state;
- otherwise return persisted state.

### 5.2 Save configuration

```http
PATCH /api/characters/:characterId/briefing
```

Body:

```json
{
  "sourceTemplate": "optional replacement source",
  "generationConnectionId": "optional connection id or null"
}
```

Behaviour:

- validate Character exists;
- validate request schema;
- persist only fields present in the patch;
- saving Source Template does not clear Latest Briefing;
- saving/changing connection does not implicitly regenerate Latest Briefing;
- return current state.

### 5.3 Manual generation

```http
POST /api/characters/:characterId/briefing/generate
```

No model-tuning, tool, date, or entity parameters are accepted from the client. Generation uses the currently persisted Source Template and generation-connection setting.

Suggested response/error semantics:

| Status | Condition |
| --- | --- |
| `200` | complete generation succeeded |
| `400` | malformed template/reference or other invalid briefing input |
| `404` | owner Character or explicitly referenced entity does not exist |
| `409` | same Character already generating or source changed before publication |
| existing provider/runtime mapping | connection/provider/tool failure |

Use existing repository error-envelope conventions rather than introducing a CR044-only global shape.

## 6. Generation Connection Resolution

### 6.1 Persisted setting

`generationConnectionId` belongs to Character Briefing. It is independent of:

- CR042 `formationConnectionId`;
- a Conversation's connection;
- the connection used later to generate a chat response containing Latest Briefing.

### 6.2 Run resolution

At generation start:

1. snapshot `generationConnectionId` with Source Template;
2. if non-null, resolve it through the normal connection provider/base-URL/model stack;
3. if null, resolve the normal default agent connection/fallback path used by existing agent-style background operations;
4. fail before slot execution if no usable connection can be resolved;
5. retain the resolved primary/fallback configuration for all slots in the run.

Do not re-resolve per slot except where the normal provider wrapper itself performs established fallback behaviour.

### 6.3 Reuse

Prefer extracting/reusing the connection-resolution helper already used by CR042 or the common agent runtime if the staging implementation does not expose it cleanly. Do not duplicate provider/base-URL/fallback rules inside Character Briefing.

### 6.4 Tracing snapshot

Trace/log the resolved connection ID/model/provider according to existing diagnostics conventions. Do not persist a briefing-generation history table solely for this metadata.

## 7. Reference Preflight and Deterministic Context Loading

### 7.1 Run-level preflight

Before any model call:

1. load the owning Character through canonical Character storage;
2. parse Source Template;
3. collect all typed references grouped by slot;
4. de-duplicate `(type, id)` for efficient host-side lookup;
5. resolve Character IDs through canonical Character storage;
6. resolve Lorebook IDs through canonical Lorebook storage;
7. fail immediately if any reference cannot be resolved;
8. retain a map of resolved resources keyed by `(type, id)`.

Preflight validates all explicit references before token-expensive agent work begins.

### 7.2 Complete Character Card representation

The host should supply the canonical Character Card content useful to Marinara generation, including the normal card fields rather than a search summary.

At minimum preserve the semantic card fields represented in the current Character resource, including where present:

- name;
- description;
- personality;
- backstory;
- appearance;
- scenario;
- example dialogue;
- system prompt;
- post-history instructions;
- other card-authored fields that the canonical Character representation already exposes and that are not runtime-only secrets.

Prefer a shared Character-to-context formatter if one already exists rather than inventing a CR044-specific reduced card format.

### 7.3 Complete Lorebook representation

For a `$Lorebook` reference in the current slot, load the exact Lorebook by ID and include the complete book and its entries/content in the slot context.

V1 deliberately does **not** perform semantic extraction or a query inside that Lorebook. It does not call existing `search_lorebook` on behalf of the briefing agent.

If very large Lorebooks later prove problematic, optimisation is a future design change rather than hidden V1 heuristics.

## 8. Exact Per-Slot Agent Input Context

This section is normative. Do not replace it with heuristic “relevant context” selection.

For slot `N`, construct one explicit context payload containing the following sections.

### 8.1 Owning Character Card — always present

Supply the complete owning Character Card loaded during preflight.

Mark it clearly as the Character whose Briefing is being generated. State that first-person terms such as “my” in the current instruction refer to this Character unless the instruction explicitly says otherwise.

No tool call is required to access the owner card.

### 8.2 Persona — absent

Do not include a Persona Card.

Do not infer a Persona from the most recent Conversation or from one source memory. Character Briefing is intentionally independent of a particular chat/persona pairing.

### 8.3 Complete Source Template snapshot — always present

Supply the entire Source Template snapshot exactly as persisted at run start.

Clearly label it as **context only / read-only**. Tell the model:

- it may use the whole template to understand document structure and intended coverage;
- it must not rewrite the template;
- other `[[...]]` instructions are not tasks in this model call;
- `$` tokens elsewhere in the template are contextual text only unless expanded in the current-slot entity section.

Every slot receives the same snapshot. Do not replace earlier instruction slots with their generated outputs before executing later slots.

### 8.4 Current instruction — always present

Identify the exact current instruction separately:

```text
slotIndex
instruction text without [[ ]]
```

Tell the model that this is the **only** instruction it must answer in the current session.

The model does not need source offsets; offsets remain host metadata.

### 8.5 Current-slot referenced Characters — conditional

For every `$Character` reference appearing inside the current instruction, include the complete pre-resolved Character Card.

Do not expand `$Character` references that occur only in other Source Template instructions.

### 8.6 Current-slot referenced Lorebooks — conditional

For every `$Lorebook` reference appearing inside the current instruction, include the complete pre-resolved Lorebook and its entries.

Do not expand `$Lorebook` references that occur only in other Source Template instructions.

### 8.7 Current date/time — always present

Supply current date/time using the same application timezone semantics used for other user-facing Conversation temporal context where practical.

This provides an anchor for words such as “current”, “recent”, “today”, or “last few days”.

It does not imply date parameters on the memory-search tool.

### 8.8 Allowed tool — always present

Expose only:

```text
search_character_daily_memories(query)
```

The model is told that the tool searches Daily Memories belonging to the owning Character.

### 8.9 Terminal result contract — always present

Require a constrained final result equivalent to:

```json
{
  "replacement": "generated Markdown/text for this instruction only"
}
```

Reject:

- missing terminal result;
- invalid structured result;
- non-string replacement;
- model output that cannot be associated with the current slot.

The prompt must explicitly prohibit:

- reproducing the full Source Template;
- explaining reasoning;
- reporting tool calls;
- restating the instruction;
- modifying neighbouring sections;
- adding generic wrappers/headings unless the instruction itself asks for them.

## 9. Standard Agent Tool: `search_character_daily_memories`

### 9.1 Why it is a tool

Daily Memories form an open evidence corpus. The model benefits from deciding what semantic query to ask, inspecting evidence, and optionally issuing a more focused follow-up query within the bounded tool-round budget.

Character Cards and Lorebooks do not share this property in V1 because every permitted application entity is already explicitly identified by an ID-backed `$` reference and preloaded by the host.

### 9.2 Shared built-in manifest

Add a standard built-in manifest under the existing shared function-call tool structure, conceptually:

```text
packages/shared/src/features/function-calls/tools/
  search-character-daily-memories/
    manifest.ts
```

Definition:

```ts
{
  name: "search_character_daily_memories",
  description: "Search the current character's Daily Memories for evidence relevant to a query.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Semantic description of the memories/evidence to retrieve."
      }
    },
    required: ["query"]
  }
}
```

No other parameters are exposed.

Run the existing shared feature-registry generation/build so the generated `BUILT_IN_TOOLS` registry includes the new manifest.

### 9.3 Common tool executor integration

Extend the normal server tool execution context with a host-injected callback analogous to existing host-bound built-in capabilities:

```ts
export type CharacterDailyMemorySearchFn = (
  query: string,
) => Promise<CharacterDailyMemoryToolResult[]>;

export interface ToolExecutionContext {
  // existing fields...
  searchCharacterDailyMemories?: CharacterDailyMemorySearchFn;
}
```

Add execution handling for `search_character_daily_memories` to the existing built-in tool executor rather than implementing a CR044-only dispatch loop.

If the callback is absent, return the normal structured tool-unavailable error. This ensures registering the standard tool does not grant memory access to every runtime automatically.

### 9.4 Character Briefing hardcoded allowlist

The CR044 slot runtime builds an `AgentToolContext` whose `tools` array contains only the standard definition for `search_character_daily_memories`.

Its execution callback must reject any tool name outside that one-name set before delegating to the common executor.

Do not include:

- `search_lorebook`;
- `web_search`;
- `read_chat_summary`;
- Character tools;
- Lorebook get/search tools;
- mutation tools;
- Spotify/game tools;
- user custom tools;
- Professor Mari workspace commands.

### 9.5 Hidden Character scope

`characterId` is never part of the model schema.

The Character Briefing runtime creates the tool callback by closing over the owning Character ID:

```ts
const searchCharacterDailyMemories = (query: string) =>
  retrieval.searchForCharacter({
    characterId: ownerCharacterId,
    query,
  });
```

The model therefore cannot request another Character's memories by changing arguments.

### 9.6 Query-only retrieval contract

Do not expose:

- `fromDate` / `toDate`;
- `limit`;
- `characterId`;
- semantic/importance/recency weights;
- minimum rank percentage;
- embedding source/model;
- active-run selection.

These remain part of CR042's central retrieval policy.

### 9.7 Reuse CR042's centralized retrieval policy

The memory tool must produce results through the same logic used for CR042 Conversation injection.

The reusable service should conceptually accept:

```ts
retrieveCharacterDailyMemories({
  characterId,
  query,
  // internally resolved settings / embedding source
})
```

and return already-selected/ranked active memories.

The implementation must preserve existing CR042 semantics for:

- active memory-set selection;
- embedding-space compatibility;
- semantic score;
- importance weighting;
- recency weighting;
- normalized configured weights;
- minimum-rank filtering;
- existing central result-selection/bounding behaviour;
- safe degradation when vector retrieval is unavailable, according to the CR042 retrieval contract.

If staging currently assembles these steps inside Conversation-generation code, extract the smallest reusable service and have **both** existing Conversation injection and the new tool call it. Do not fork/copy the algorithm.

### 9.8 Tool output

Return the selected memory records in a bounded JSON-compatible shape containing useful evidence already available in CR042, for example:

```ts
{
  id: string;
  text: string;
  importance: number;
  date?: string;
  sourceConversationId?: string | null;
  sourceConversationName?: string | null;
  score?: number;
}
```

Do not expose raw embeddings to the model.

The tool does not accept a model-chosen limit; any output-size protection is deterministic host/system behaviour.

## 10. Manual Generation Service

### 10.1 Per-Character lock

Maintain a process-local in-flight set/lock keyed by Character ID, consistent with current single-server runtime patterns.

A second generation request for the same Character returns conflict while the first is active.

Different Characters may generate independently subject to the normal provider/rate-limit infrastructure.

### 10.2 Run flow

```text
if owner character already generating:
    conflict

mark owner generating
try:
    load owner Character
    load briefing/default state
    snapshot sourceTemplate
    snapshot generationConnectionId
    parse sourceTemplate
    resolve generation connection once
    preflight all typed Character/Lorebook refs

    if no slots:
        verify source unchanged
        publish source verbatim as Latest Briefing
        return

    replacements = []

    for slot in source order:
        context = buildSlotContext(
            ownerCard,
            sourceTemplateSnapshot,
            slot,
            resolvedCurrentSlotRefs,
            currentDateTime,
            memoryTool
        )

        replacements[slot.index] = executeBoundedSlot(
            resolvedRunConnection,
            context
        )

    reconstructed = reconstruct(
        sourceTemplateSnapshot,
        slots,
        replacements
    )

    atomically publish only if persisted source still equals snapshot
    return updated state
finally:
    clear owner generating marker
```

### 10.3 Failure behaviour

Any of the following aborts the run without changing Latest Briefing:

- malformed executable template;
- invalid typed reference;
- unresolved Character/Lorebook reference;
- no usable generation connection;
- provider failure not recovered by standard fallback;
- memory tool failure that causes the slot task to fail;
- tool-round exhaustion without valid terminal result;
- invalid terminal result;
- source changed before publication.

Do not persist a partially reconstructed briefing.

### 10.4 Tool rounds

Use the existing bounded tool-round configuration/executor behaviour rather than an unlimited CR044 loop.

A slot may call `search_character_daily_memories` repeatedly if the common tool-round budget permits it.

### 10.5 Provider and tracing

Use the normal provider registry, connection fallback wrapper, rate-limit infrastructure, model parameters and Phoenix tracing available on staging.

CR044 must not introduce a separate provider client solely for briefing generation.

Trace at minimum:

- Character ID;
- slot index;
- selected/resolved connection/model;
- tool calls and duration through existing tracing hooks;
- terminal success/failure;
- no complete private model reasoning.

## 11. Character Briefing UI

### 11.1 Character Editor integration

Add **Briefing** as a sibling tab in `CharacterEditor.tsx`, following focused tab composition used by `CharacterMemoriesTab`.

Primary implementation should live in a dedicated `CharacterBriefingTab` rather than expanding the Character Editor with all logic inline.

### 11.2 Layout

The tab contains:

1. **Source Template** editor;
2. **Generation connection** selector;
3. **Generate Briefing / Update Briefing** action and status;
4. **Latest Briefing** read-only output.

No history browser is included.

### 11.3 Source editor

Use a normal textarea/Markdown-style editor.

It supports ordinary text and `[[...]]` syntax without a rich-text dependency.

Saving source does not regenerate.

### 11.4 Connection selector

Reuse the CR042 Character Daily Memories connection-selection UI primitive/pattern where clean.

Requirements:

- show current explicit connection or default-agent behaviour;
- permit selecting a different available connection;
- permit returning to default/unset when supported by the existing selector convention;
- persist to `generationConnectionId`;
- clearly separate this setting from the Daily Memories formation connection;
- changing it does not mutate Latest Briefing until Generate/Update is run.

### 11.5 `$` autocomplete trigger

Autocomplete opens only when:

- the editor has focus;
- caret is inside a `[[...]]` instruction according to shared parser/caret logic;
- text before the caret represents an active `$` query rather than a completed token.

`$` elsewhere remains ordinary text.

### 11.6 Picker content

The picker contains two groups:

- Characters;
- Lorebooks.

The **editor** may search/filter application entities because the user is explicitly choosing the authoritative ID. This is not agentic entity discovery.

Duplicate names must be disambiguated before selection using existing UI metadata where possible.

Selection serializes the stable typed token and positions the caret after it.

Support Arrow Up/Down, Enter/Tab, Escape, mouse click and touch.

### 11.7 Save then generate

Generate/Update flow on the client:

1. persist latest Source Template and generation-connection selection;
2. wait for successful save;
3. call generation endpoint;
4. disable editing/generation controls while the local request is active;
5. refresh state from successful response;
6. on failure, keep displaying the previously successful Latest Briefing and show the error.

Server-side source-snapshot protection remains authoritative against other clients.

### 11.8 Latest Briefing

Show read-only content plus last successful generation timestamp.

Before first generation, show a simple empty state.

Do not allow direct editing of Latest Briefing in V1.

## 12. Client Data Hooks

Follow current TanStack Query/API-client conventions.

Logical hooks:

```text
useCharacterBriefing(characterId)
useSaveCharacterBriefing(characterId)
useGenerateCharacterBriefing(characterId)
```

The save mutation accepts Source Template and/or `generationConnectionId` patch values.

Entity autocomplete should reuse existing Character/Lorebook list/search client APIs. No new agent-facing discovery API is implied by the editor picker.

## 13. Conversation-Time Integration

### 13.1 Read-only access

Conversation generation only reads `latestBriefing`. It does not trigger briefing generation.

### 13.2 Injection rule

For each applicable responding Character:

1. read Character Briefing state;
2. if `latestBriefing` is null/empty, add nothing;
3. otherwise format a clearly attributed Character Briefing context block;
4. add it to the existing prompt/context assembly without suppressing any current sources.

### 13.3 Group Conversations

Use the existing responding-character/visibility targeting decisions. Do not inject every Character Briefing simply because the Character is a member of a group chat.

### 13.4 Failure handling

Briefing-storage read failure during ordinary Conversation generation should follow the repository's normal optional-context failure policy and must not redesign the complete generation route.

### 13.5 No prompt effect when absent

Characters with no Latest Briefing must produce byte/semantic-equivalent existing prompt behaviour apart from unavoidable internal code-path bookkeeping.

## 14. Error, Concurrency and Atomicity

### 14.1 Source/configuration edits

Source Template and connection configuration may be edited/saved independently of Latest Briefing.

A newer Source Template does not invalidate/delete the previous Latest Briefing automatically. The UI may indicate that Latest Briefing predates the source if useful, but no history/version system is required.

### 14.2 Generation lock

One active generation per Character.

### 14.3 Source snapshot conflict

The run snapshots Source Template at start. Before publication, storage verifies it is still current.

A mismatch returns 409 and leaves Latest Briefing unchanged.

A connection setting change during a run does not need to invalidate the current run because the run already snapped/resolved its connection at start; the new setting applies to the next run. Source text remains the publication conflict key because it determines generated document structure/content.

### 14.4 Atomic publication

Publish `latestBriefing` and `latestGeneratedAt` together only after complete success.

## 15. Security and Capability Boundaries

### 15.1 Tool access

Character Briefing V1 has exactly one model-callable tool:

```text
search_character_daily_memories
```

### 15.2 Character scope

Owning Character ID is host-bound in the tool callback and never model supplied.

### 15.3 Application entity scope

Only explicit ID-backed `$` references in the current instruction are expanded into full Character/Lorebook data.

Natural-language entity names never trigger application-data lookup.

### 15.4 Read-only feature

The agent cannot mutate:

- Character Cards;
- Lorebooks;
- Daily Memories;
- Conversations;
- application settings;
- external systems.

Its only persisted effect is the host-controlled publication of validated replacement content into Latest Briefing after the full run succeeds.

### 15.5 No user custom tools

Do not merge `activeToolIds`, custom tools, or regular chat tool settings into the Character Briefing allowlist.

## 16. Validation Plan

### 16.1 Parser/reference tests

Cover:

- zero/one/multiple/multiline slots;
- repeated identical instructions;
- exact offsets and reconstruction;
- nested/unclosed instruction rejection;
- `$` outside instruction inert;
- valid Character/Lorebook tokens;
- malformed tokens;
- escaping/labels;
- slot-to-reference association.

### 16.2 Persistence/API tests

Cover:

- default state for existing Character;
- 404 for unknown Character;
- source-only save;
- connection-only save;
- combined save;
- saving does not clear Latest Briefing;
- atomic publish;
- source conflict;
- Character deletion cascade/reference handling.

### 16.3 Connection tests

Cover:

- explicit connection selected;
- default agent connection when unset;
- normal fallback wrapper behaviour;
- no inheritance from Conversation connection;
- all slots use same run resolution;
- invalid/unavailable configuration preserves Latest Briefing.

### 16.4 Context-construction tests

Assert the actual serialized model context for representative slots:

- full owning Character Card included;
- Persona absent;
- full Source Template snapshot included;
- current instruction separately identified;
- current-slot Character refs fully expanded;
- current-slot Lorebook refs fully expanded;
- references in another slot not expanded;
- current date/time included;
- only one tool definition included;
- later slots see the same source snapshot, not earlier generated replacements.

### 16.5 Standard tool tests

Cover:

- built-in manifest/registry includes `search_character_daily_memories`;
- schema requires only `query`;
- common executor validates query;
- callback absent -> standard unavailable failure;
- CR044 context binds owner Character ID;
- attempted extra arguments are rejected by tool schema;
- no alternate Character scope can be supplied;
- tool result excludes embeddings;
- Character Briefing allowlist rejects every other built-in/custom tool.

### 16.6 CR042 retrieval-sharing tests

Prove Conversation injection and the new agent tool use the same shared retrieval policy rather than copied algorithms.

Regression coverage should preserve CR042's configured semantic/importance/recency weighting, minimum-rank policy, active-run/embedding-space handling and central output-selection behaviour.

### 16.7 Generation tests

Cover:

- zero-slot no-model path;
- one slot no tool call;
- one/multiple Daily Memory searches;
- valid terminal replacement;
- malformed terminal result;
- tool-round exhaustion;
- one failed slot aborts complete publication;
- provider failure/fallback;
- concurrent run rejection;
- source edit during generation conflict;
- previous Latest Briefing survives all failures.

### 16.8 UI tests

Cover:

- tab load/default state;
- connection selector persistence;
- Source Template persistence;
- `$` autocomplete only inside instruction;
- Character/Lorebook groups;
- duplicate-name display;
- keyboard/pointer/touch selection;
- stable token insertion;
- Generate save-before-run behaviour;
- busy/error state;
- prior Latest Briefing retained after failed update.

### 16.9 Conversation regression tests

Cover:

- no Latest Briefing -> no added context;
- single responding Character gets its Briefing;
- group target does not leak another Character's Briefing;
- existing Character/Persona/history/summaries/CR042/Lorebook context remains unchanged;
- Briefing block is clearly attributed and additive.

## 17. Implementation Sequence

1. Create shared Character Briefing state/request/parser/reference contracts.
2. Add dedicated persistence schema/storage with nullable `generationConnectionId`.
3. Add Character Briefing GET/PATCH routes.
4. Implement/verify canonical host-side full Character Card and full Lorebook loading by stable ID.
5. Refactor/extract CR042 Conversation Daily Memory retrieval into a reusable service if necessary, preserving existing behaviour.
6. Add standard `search_character_daily_memories(query)` tool manifest and regenerate the shared built-in registry.
7. Extend common `ToolExecutionContext` / built-in executor with the host-bound Character Daily Memory search callback.
8. Implement Character Briefing connection resolution by reusing CR042/common agent connection infrastructure.
9. Implement reference preflight and the normative per-slot context builder.
10. Implement sequential bounded slot execution through the common agent executor/provider/tool stack with a one-tool allowlist.
11. Implement exact reconstruction, source-snapshot recheck and atomic Latest Briefing publication.
12. Add manual generation route.
13. Add client data hooks and Character Briefing tab.
14. Add generation connection selector using CR042 UI precedent.
15. Add instruction-aware `$` autocomplete and stable token insertion.
16. Add Latest Briefing display/generation states.
17. Add narrow additive Conversation context injection.
18. Add focused regressions across parser, context, tool scope, connection, CR042 retrieval sharing, generation and Conversation integration.
19. Run repository checks/build required by staging and resolve only CR044-related failures.

## 18. Expected Files and Areas

Exact names may adjust to existing conventions during implementation.

### Shared

- `packages/shared/src/types/character-briefing.ts` or equivalent.
- shared Character Briefing schema/parser exports.
- `packages/shared/src/features/function-calls/tools/search-character-daily-memories/manifest.ts`.
- `packages/shared/src/features/function-calls/tool-registry.generated.ts` regenerated, not hand-maintained beyond the repository's normal generator workflow.

### Server persistence

- `packages/server/src/db/schema/character-briefings.ts`.
- schema barrel/file-backed-store registration as required.
- `packages/server/src/services/storage/character-briefings.storage.ts`.

### Server Character Briefing services

- `packages/server/src/services/character-briefing/parser/context` modules as separation warrants.
- generation/orchestration service.
- connection-resolution adapter/reused helper.

### CR042/shared retrieval

- existing `packages/server/src/services/character-daily-memories/...` area for the reusable retrieval service if one is not already isolated.
- existing Conversation Daily Memory injection call site changed only to call the shared retrieval service rather than duplicate logic.

### Standard tool runtime

- `packages/server/src/services/tools/tool-executor.ts` for `searchCharacterDailyMemories` callback type/context and built-in execution case.
- generation/agent tool-context builder only where required to expose the new standard built-in to runtimes that explicitly allow it.

CR044 itself should construct a one-tool `AgentToolContext`; it should not adopt the complete chat tool resolver with chat/custom-tool state merely to obtain one definition.

### Server routes/runtime

- Character Briefing routes under `/api/characters`.
- route registration.
- narrow Conversation prompt-injection integration point.

### Client

- `CharacterBriefingTab.tsx`.
- Character Editor tab registration.
- `use-character-briefing.ts` or equivalent API hook.
- reuse/adaptation of connection-selector/autocomplete primitives where clean.

### Validation

- focused unit/regression coverage following current repository conventions.

## 19. Resolved LLD Decisions

The following are settled for CR044 V1:

1. Character Briefing state is persisted separately from versioned Character Card content.
2. Source Template and Latest Briefing are separate persisted views.
3. `[[...]]` is the only executable Source Template syntax.
4. `$` typed references are special only inside instructions and persist stable entity IDs.
5. Character/Lorebook references are resolved by the host; the agent cannot discover or guess application entities.
6. The complete owning Character Card is always supplied directly.
7. No Persona Card is supplied.
8. Every slot receives the complete, unchanged Source Template snapshot.
9. Only entity references contained in the current instruction are expanded into complete Character Cards/Lorebooks for that slot.
10. Complete referenced Lorebooks are supplied in V1; no hidden semantic Lorebook extraction/query is performed.
11. Slots execute sequentially in separate bounded sessions and do not see earlier generated replacements.
12. The Character Briefing generation connection is persisted per Character Briefing and resolved once per run.
13. The only Character Briefing agent tool is the standard built-in `search_character_daily_memories(query)`.
14. The memory tool exposes only `query`; owner Character scope and all retrieval tuning/bounding are host/system controlled.
15. The memory tool reuses the same centralized CR042 retrieval policy as Conversation injection; no duplicate CR044 ranking implementation is permitted.
16. Character Briefing never inherits the complete normal/custom agent tool catalogue.
17. Host-controlled source-offset reconstruction and atomic publication are mandatory.
18. Previous Latest Briefing remains intact on any failed or conflicting generation.
19. Conversation integration is additive and character-specific.
20. Scheduling, automatic generation, Persona selection, Character/Lorebook agent tools, entity discovery, briefing history and deterministic `{{...}}` macros are out of V1.