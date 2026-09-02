# CR044 Low-Level Design — Character Briefing

## Status

Ready for implementation after review.

## 1. Scope and Baseline

This LLD implements the approved CR044 HLD and Implementation Plan against:

- application repository: `adunato/Marinara-Engine`
- baseline branch: `staging`
- verified baseline commit: `80f688df25b691ab3dc602c0c33470d32bf6124b`
- intended application work branch: `change/CR044-character-briefing`

The design assumes the CR042 Character Daily Memories implementation already present on `staging` and does not assume unrelated Adunato `main` change requests are available.

V1 remains:

- character-owned;
- manually generated only;
- additive to existing Conversation context;
- editable Source Template plus one Latest Briefing;
- executable only through `[[...]]` instruction spans;
- ID-backed `$` references to Characters and Lorebooks inside instructions;
- read-only Character Card, CR042 Daily Memory, and Lorebook evidence;
- no deterministic `{{...}}` briefing macros;
- no scheduling, automatic regeneration, history browser, or rich-text entity chips.

## 2. Component Overview

CR044 adds the following components.

### Shared

- `packages/shared/src/character-briefing-template.ts`
  - parses `[[...]]` slots;
  - parses/serializes typed `$` entity references;
  - exposes source offsets for exact replacement;
  - exposes caret/query helpers for the editor;
  - reconstructs a generated document from source + slot results.

- shared export wiring under the existing `@marinara-engine/shared` barrel structure.

### Server persistence

- `packages/server/src/db/schema/character-briefings.ts`
- schema index export update.
- next Drizzle migration generated according to current repository practice.
- `packages/server/src/services/storage/character-briefings.storage.ts`

### Server runtime

- `packages/server/src/routes/character-briefings.routes.ts`
- route registration in `packages/server/src/routes/index.ts`.
- `packages/server/src/services/character-briefing/generation.service.ts`
- `packages/server/src/services/character-briefing/tools.ts`
- `packages/server/src/services/character-briefing/prompt.ts`
- `packages/server/src/services/generation/character-briefing-context.ts`
- narrow modification to `packages/server/src/routes/generate.routes.ts` for additive Conversation injection.

File names may be adjusted to match neighbouring staging conventions, but responsibilities and boundaries should remain as defined here.

### Client

- `packages/client/src/components/characters/CharacterBriefingTab.tsx`
- `packages/client/src/hooks/use-character-briefing.ts` or the equivalent current query-hook location.
- modification to `packages/client/src/components/characters/CharacterEditor.tsx` to register/render the new tab.

## 3. Persistence Design

### 3.1 Table

Create a dedicated `character_briefings` table rather than storing briefing state in the versioned Character Card resource.

Required logical fields:

| Field | Type | Notes |
| --- | --- | --- |
| `characterId` | text / existing character-id type | Unique owning Character; foreign key when current schema conventions permit. |
| `sourceTemplate` | text | Persistent editable source. Default empty string. |
| `latestBriefing` | text nullable | Latest fully successful generated result. |
| `latestGeneratedAt` | timestamp nullable | Timestamp for latest successful generation. |
| `createdAt` | timestamp | Existing DB timestamp convention. |
| `updatedAt` | timestamp | Updated on source save or successful generation. |

One Character has at most one CR044 record.

No briefing-history table is added.

### 3.2 Why briefing state is separate from Character Card data

The Source Template and Latest Briefing are mutable runtime state. They must not:

- create Character Card version churn;
- be exported/imported accidentally as immutable card identity unless a later CR explicitly adds that behaviour;
- require rewriting the existing Character storage model;
- couple manual briefing generation to Character Card editing transactions.

### 3.3 Storage service

`character-briefings.storage.ts` should expose a small typed interface similar to:

```text
get(characterId)
saveSourceTemplate(characterId, sourceTemplate)
publishLatest(characterId, expectedSourceTemplate, latestBriefing, generatedAt)
deleteForCharacter(characterId) // only if required by current deletion conventions
```

`get()` should allow the API layer to represent an absent row as an empty default state without eagerly inserting a database record.

`publishLatest()` must be conditional on the source still matching the source snapshot used for generation. This can be implemented either:

- as one conditional SQL update using `characterId + sourceTemplate`; or
- inside the existing database transaction abstraction after a re-read.

The invariant is what matters: a generation started from source A must never publish against later source B.

## 4. Source Template Grammar

### 4.1 Executable syntax

Only complete, non-nested `[[...]]` spans are executable.

Examples:

```markdown
# Relationships

[[Assess my current relationship with $[character:abc123|Amy].]]
```

Multiline instructions are valid:

```markdown
[[Review recent memories involving $[character:abc123|Amy].
Summarise our current relationship and unresolved issues.]]
```

Ordinary Markdown outside the spans is inert.

`$` outside an instruction is ordinary text.

### 4.2 Invalid syntax

Generation rejects at least:

- unclosed `[[`;
- nested `[[...[[...]]...]]`;
- malformed typed entity tokens inside instructions;
- unsupported entity-reference types;
- empty/missing stable entity IDs.

Literal square brackets that are not `[[` or `]]` remain normal Markdown.

The parser should report a machine-readable error code plus source offset so the client can identify the faulty region.

### 4.3 Instruction-slot representation

The shared parser should produce ordered slots containing at least:

```text
slotIndex
startOffset        // opening '[' of '[['
endOffsetExclusive // first character after closing ']]'
instructionText    // brackets removed
entityRefs[]
```

Slots are identified by index/source offset, not by instruction text. Identical instruction text appearing twice must still map to two independent replacements.

## 5. Stable Entity Reference Format

### 5.1 Serialized form

V1 should use a readable typed token embedded directly in Source Template text:

```text
$[character:<stable-id>|<display-label>]
$[lorebook:<stable-id>|<display-label>]
```

Examples:

```text
$[character:ch_123|Amy]
$[lorebook:lb_456|Kingdom of Asteria]
```

The authoritative identity is `(type, stable-id)`.

The display label is presentation only. It may become stale after an entity rename and must never be used as a runtime lookup fallback when a valid ID is present.

### 5.2 Escaping

The shared serializer/parser should support labels containing reserved token characters by escaping at least:

- `\`
- `|`
- `]`

The serializer must be the only client path that creates tokens; the server parser remains defensive against manually edited malformed tokens.

### 5.3 Deleted entity behaviour

Before the first model call, generation resolves every explicit typed reference in every slot.

If any explicit Character or Lorebook no longer exists:

- return a deterministic generation error;
- identify the unresolved reference sufficiently for UI display;
- do not substitute a same-name object;
- do not invoke the model;
- do not change Latest Briefing.

### 5.4 Discovery versus explicit references

The briefing model may have search tools for discovering untagged evidence when an instruction is general.

However, when the user supplied an explicit `$` token, that stable reference is authoritative and search must not reinterpret it.

## 6. Shared Parser API

Suggested exported functions/types:

```text
parseCharacterBriefingTemplate(source)
parseCharacterBriefingEntityToken(token)
serializeCharacterBriefingEntityRef(ref)
getCharacterBriefingInstructionAtCaret(source, cursor)
getCharacterBriefingEntityQueryAtCaret(source, cursor)
reconstructCharacterBriefing(source, slots, replacements)
```

Suggested types:

```text
CharacterBriefingEntityRef
CharacterBriefingInstructionSlot
CharacterBriefingTemplateParseResult
CharacterBriefingTemplateError
CharacterBriefingEntityQuery
```

### 6.1 Reconstruction algorithm

The host application owns document reconstruction.

Pseudocode:

```text
cursor = 0
output = ""

for slot in slots ordered by startOffset:
    output += source[cursor:slot.startOffset]
    output += replacements[slot.slotIndex]
    cursor = slot.endOffsetExclusive

output += source[cursor:]
return output
```

Never call `string.replace(instructionText, ...)` because repeated identical instructions would be ambiguous and model output must not determine source boundaries.

### 6.2 Zero-slot template

A Source Template containing no `[[...]]` slots is valid.

Manual generation should:

- make no model call;
- publish the Source Template verbatim as Latest Briefing;
- update `latestGeneratedAt`.

This makes inert Markdown useful without introducing a second execution syntax.

## 7. Server API

### 7.1 Read briefing state

`GET /api/characters/:characterId/briefing`

Logical response:

```json
{
  "characterId": "...",
  "sourceTemplate": "...",
  "latestBriefing": "... or null",
  "latestGeneratedAt": "... or null",
  "updatedAt": "... or null"
}
```

An existing Character with no CR044 row returns the empty/default state rather than 404.

Unknown Character returns 404.

### 7.2 Save Source Template

`PUT /api/characters/:characterId/briefing`

Body:

```json
{
  "sourceTemplate": "..."
}
```

Behaviour:

- validate Character exists;
- persist Source Template only;
- do **not** clear or regenerate Latest Briefing;
- return current briefing state.

Saving malformed executable syntax is allowed so the user can edit incrementally. Syntax validity is enforced when Generate is invoked.

Apply the repository's existing request-size/body limits; if a specific route cap is needed, use a bounded value sufficient for a human-authored briefing (for example 128 KiB) rather than allowing unbounded text.

### 7.3 Manual generation

`POST /api/characters/:characterId/briefing/generate`

The endpoint uses the currently persisted Source Template. The client should save current edits before invoking generation.

Success returns the updated briefing state.

Suggested errors:

| Status | Condition |
| --- | --- |
| `400` | Malformed template or malformed typed entity token. |
| `404` | Owning Character or an explicitly referenced entity does not exist. |
| `409` | A generation for this Character is already active, or Source Template changed before publication. |
| existing provider/runtime error mapping | LLM/provider/tool failure. |

Do not invent a new global error shape; use current route conventions.

## 8. Manual Generation Service

### 8.1 Per-character generation lock

Maintain a process-local lock/set keyed by Character ID, matching other single-server runtime patterns where appropriate.

Generation flow:

```text
if characterId is already generating:
    return conflict

mark generating
try:
    load owner Character
    load briefing state
    snapshot sourceTemplate
    parse sourceTemplate
    preflight all explicit entity refs

    replacements = []
    for slot in source order:
        replacements[slot] = executeSlot(slot, owner, resolvedRefs)

    reconstructed = reconstruct(sourceTemplate, slots, replacements)

    re-read current briefing source
    if current source != source snapshot:
        return conflict without publishing

    atomically publish reconstructed Latest Briefing + generated timestamp
    return state
finally:
    clear generating marker
```

The client should also disable Generate while its own request is active, but server-side locking is authoritative.

### 8.2 One bounded session per slot

V1 executes instruction slots sequentially with a separate bounded tool-capable model session per slot.

Reasons:

- deterministic mapping between one source slot and one terminal result;
- failure attribution is straightforward;
- tool context stays focused;
- no model-owned whole-document state is required;
- partial results can be held in memory and discarded if a later slot fails.

A later CR may optimise batching if evidence shows the extra calls are problematic.

### 8.3 Slot prompt contract

Each slot invocation receives host-generated context containing:

- owning Character identity and stable ID;
- the exact instruction text without `[[` / `]]`;
- resolved explicit entity references as structured metadata;
- current date/time;
- limited surrounding Source Template text when needed for headings/semantic context;
- tool descriptions;
- strict terminal-output instructions.

The model is told that first-person references such as “my” refer to the owning Character unless the instruction explicitly says otherwise.

It is **not** sent the complete normal Conversation prompt.

### 8.4 Terminal result

Use a constrained structured terminal result equivalent to:

```json
{
  "replacement": "generated Markdown/text for this slot only"
}
```

The service must reject:

- no terminal result;
- invalid structure;
- non-string replacement;
- protocol output that cannot be associated with the current slot.

The model must not be asked to echo the instruction, return a full Markdown document, or add generic commentary.

## 9. Read-Only Agent Tools

CR044 should define its own narrow tool set while reusing existing underlying storage/services.

### 9.1 Character Card tools

Suggested tool surface:

```text
briefing_character_get(characterId)
briefing_character_search(query, limit)
```

`briefing_character_get` returns the fields useful for contextual understanding from the canonical Character Card, bounded according to existing server practices.

`briefing_character_search` is optional discovery support for instructions that refer generally to another Character without a `$` token. Explicit references remain authoritative.

No create/update/delete Character capability is exposed.

### 9.2 Lorebook tools

Suggested surface:

```text
briefing_lorebook_get(lorebookId)
briefing_lorebook_search(query, limit)
briefing_lorebook_entries(lorebookId, query?, limit?)
briefing_lorebook_entry_get(lorebookId, entryId)
```

Prefer staged retrieval:

1. identify Lorebook;
2. inspect bounded entry summaries/index;
3. read selected entry bodies.

Do not preload entire large Lorebooks into every slot prompt.

No Lorebook mutation capability is exposed.

### 9.3 Character Daily Memory tool

Expose a briefing-specific read/search tool backed by the CR042 character-owned memory store.

Suggested model-facing contract:

```text
briefing_memory_search(query?, fromDate?, toDate?, limit?)
```

Important security/scope rule:

- **do not expose `characterId` as a model-supplied argument**;
- the generation service injects the owning Character ID into the tool implementation;
- the tool can therefore read only the briefing owner's CR042 memory corpus.

Return bounded active memory records containing useful evidence such as:

- memory text/content;
- logical date/date range;
- source Conversation attribution where stored by CR042;
- other existing non-sensitive metadata useful for interpreting chronology.

The implementation should use the actual CR042 storage/query primitives present on staging. If CR042 does not expose a reusable semantic-search API, CR044 should add only the smallest adapter necessary for bounded date/text filtering or reuse existing embedding utilities if there is already an appropriate query path. The LLD does **not** require inventing a second independent vector-memory subsystem.

### 9.4 Tool limits

All list/search tools must:

- cap result counts;
- cap serialized output size;
- support narrowing rather than returning complete corpora;
- count toward a bounded maximum tool-round limit per slot.

The slot runtime should reuse existing provider/tool execution and tracing facilities where possible, including staging's current Phoenix tracing path rather than implementing CR044-specific LLM transport.

## 10. Explicit Reference Preflight

Before invoking any slot model session:

1. collect every typed entity token from parsed slots;
2. de-duplicate by `(type, id)`;
3. resolve Characters through canonical Character storage;
4. resolve Lorebooks through canonical Lorebook storage;
5. construct a resolved-reference map;
6. fail immediately if any reference is unresolved.

This provides:

- zero token cost for deterministically broken references;
- stable behaviour with duplicate names;
- no accidental LLM disambiguation;
- the ability to give every relevant slot exact resolved metadata.

## 11. Character Briefing UI

### 11.1 Tab integration

Modify `CharacterEditor.tsx` to add **Briefing** as a sibling Character tab, following the same lifecycle/loading conventions used by existing focused tabs such as `CharacterMemoriesTab`.

The Briefing tab should not be hidden behind Conversation settings because the resource belongs to the Character.

### 11.2 Layout

`CharacterBriefingTab` contains three logical regions:

1. **Source Template**
   - explanatory helper text;
   - editable textarea/Markdown-style editor;
   - Save action/status.

2. **Generation controls**
   - `Generate Briefing` when no Latest Briefing exists;
   - `Update Briefing` when one exists;
   - busy state while generation runs;
   - error/status feedback.

3. **Latest Briefing**
   - read-only rendered/preformatted content;
   - last successful generated timestamp;
   - empty state before first generation.

Do not add history navigation.

### 11.3 Save semantics

The Source Template must be saveable without generating.

Generate should:

1. ensure the latest editor text is persisted;
2. wait for successful save;
3. invoke the manual generation endpoint;
4. refresh the query state from the server response.

While the local generation request is active, disable Source Template editing and generation controls in that tab to avoid misleading local edits. Server source-snapshot protection still handles cross-client changes.

### 11.4 `$` autocomplete trigger

Autocomplete opens only when all conditions hold:

- editor has focus;
- caret is inside an open/complete `[[...]]` instruction region according to shared parser/caret logic;
- the text immediately preceding the caret represents an active `$` query rather than an already completed typed token.

`$` elsewhere remains ordinary text.

### 11.5 Picker contents

Picker shows two clearly differentiated groups:

- Characters;
- Lorebooks.

Filtering should use the query typed after `$` and existing client-side list/search primitives where practical.

Duplicate names must be disambiguated before selection. Prefer existing available metadata:

- Character: avatar plus secondary identifier/detail if available;
- Lorebook: category/description or another existing secondary label.

Do not expose raw stable IDs as the primary user-facing differentiator unless no better metadata exists.

### 11.6 Keyboard and pointer behaviour

Support at minimum:

- Arrow Up / Down: move selection;
- Enter or Tab: choose active result;
- Escape: close picker;
- mouse click;
- touch selection.

Selection calls the shared serializer and inserts the complete stable token at the active `$` query range. The caret moves immediately after the inserted token.

### 11.7 Existing mention UI precedent

`ConversationInput.tsx` already contains mention/completion interaction patterns. Reuse utility or interaction logic where doing so remains clean, but do not couple CR044 to chat-specific composer state merely for code sharing.

A small shared completion utility is preferable only if extraction materially reduces duplicate keyboard/query-position logic without dragging Conversation-specific dependencies into CharacterEditor.

## 12. Client Data Hooks

The Briefing tab should use TanStack Query / existing API client conventions.

Logical hooks:

```text
useCharacterBriefing(characterId)
useSaveCharacterBriefingSource(characterId)
useGenerateCharacterBriefing(characterId)
```

Query key should be Character-specific, for example:

```text
["character-briefing", characterId]
```

Successful source save updates/invalidates the briefing query.

Successful generation replaces cached briefing state with the server response.

Failure does not clear cached Latest Briefing.

For autocomplete, prefer existing Character/Lorebook list hooks. Add a dedicated search endpoint only if current APIs cannot support bounded picker discovery cleanly.

## 13. Conversation Context Injection

### 13.1 Context helper

Add a generation-side helper such as:

`packages/server/src/services/generation/character-briefing-context.ts`

Responsibilities:

- receive applicable responding/visible Character IDs from the existing generation flow;
- load non-empty Latest Briefings in deterministic Character order;
- format clear Character attribution;
- return no block when none exist.

Suggested semantic format:

```markdown
## Character Briefing — Amy

<latest briefing text>
```

If existing staging prompt helpers use XML-like context delimiters, use that existing convention instead. The invariant is unambiguous source/Character attribution.

### 13.2 Integration point

Modify `generate.routes.ts` only after the existing flow has resolved which Character(s) are applicable to the response and before final provider submission.

CR044 should append its prepared context as a distinct generated context message/block in the same broad phase as other contextual injections.

It must **not**:

- replace the Conversation system prompt;
- suppress Character Card fallback;
- suppress Persona;
- suppress current history or automatic summaries;
- change CR042 Daily Memory injection/retrieval;
- change Lorebook activation;
- change Cross-Chat Awareness;
- change current live status/context;
- change response-target selection.

### 13.3 Group Conversations

For group Conversation generation:

- use the existing response-target / visibility decision as source of truth;
- inject only briefing(s) belonging to applicable responding Character(s);
- never dump every group member's briefing merely because they are present in the chat;
- preserve deterministic attribution/order.

### 13.4 Empty briefing

No row, null Latest Briefing, empty string, or whitespace-only Latest Briefing produces no CR044 prompt block.

This guarantees zero behavioural/prompt difference for Characters that do not use CR044.

## 14. Error and Failure Handling

### Template errors

- generation stops before model work;
- return location/code/message;
- previous Latest remains.

### Missing explicit entity

- generation stops during preflight;
- indicate type/display label where possible;
- no name fallback;
- previous Latest remains.

### Tool/model failure

- current slot fails;
- discard all in-memory replacements from this run;
- previous Latest remains.

### Invalid terminal output

- treat as failed generation;
- use existing bounded protocol-repair behaviour only if there is a reusable standard mechanism;
- do not accept a whole-document response as a replacement.

### Concurrent generation

- return conflict for the second run;
- do not queue hidden background work.

### Source changed during run

- reconstruct result in memory;
- conditional publish fails / source comparison detects change;
- return conflict;
- previous Latest remains.

### Character deleted during run

- publication must fail cleanly through current storage/foreign-key semantics;
- no orphaned Latest Briefing should be published.

## 15. Observability

Reuse staging's existing logging and LLM tracing.

Useful non-content metadata to record:

- character ID;
- instruction-slot count;
- current slot index;
- tool name/count;
- generation success/failure category;
- elapsed timing;
- stale-source conflict.

Do not add a second independent tracing framework.

Prompt/tool outputs may contain roleplay/private narrative content; follow the existing tracing configuration and data-handling rules rather than increasing logging scope specifically for CR044.

## 16. Migration and Backward Compatibility

Migration is additive.

After migration:

- existing Characters have no briefing rows;
- GET returns an empty logical briefing state;
- normal Conversation generation is unchanged until Latest Briefing exists;
- CR042 tables/data are untouched;
- Character Card JSON/version history is untouched.

No data backfill is necessary.

## 17. Test Design

### Shared parser tests

Cover:

- no slots;
- one slot;
- multiple slots;
- multiline slot;
- identical instruction strings at different offsets;
- text preservation before/between/after slots;
- unclosed slot;
- nested slot;
- valid typed Character ref;
- valid typed Lorebook ref;
- escaped labels;
- malformed token;
- `$` outside instruction;
- caret/query detection for autocomplete;
- reconstruction by slot index/offset.

### Storage tests

Cover:

- absent row default;
- source upsert;
- successful latest publication;
- publication conditional on expected source;
- failed stale-source publication;
- no Latest clearing on source save.

### Route tests

Cover:

- GET missing Character vs empty briefing;
- PUT source save;
- POST successful generation;
- malformed source;
- deleted referenced entity;
- concurrent generation conflict;
- stale-source conflict;
- provider/tool failure leaves previous Latest.

### Tool tests

Cover:

- Character read/search bounds;
- Lorebook staged retrieval;
- memory result bounds/date filtering;
- owning Character ID cannot be overridden by tool arguments;
- no mutation tools registered.

### Generation-service tests

Use mocked provider/tool results to verify:

- one slot;
- several slots execute in order;
- terminal JSON accepted;
- malformed terminal result rejected;
- slot 2 failure discards slot 1 in-memory result;
- exact source reconstruction;
- zero-slot generation skips provider;
- preflight happens before provider call.

### Client tests

Cover:

- Briefing tab rendering;
- load/empty state;
- source save;
- `$` picker blocked outside instruction;
- picker opens inside instruction;
- query filtering;
- grouped Character/Lorebook results;
- duplicate-name secondary labels;
- keyboard/pointer selection;
- stable token insertion;
- Generate waits for Save;
- busy state;
- failed generation preserves displayed Latest.

### Conversation regression

Add/extend focused prompt regression coverage:

- no Latest => prompt equivalent to baseline;
- one responding Character => one attributed briefing block;
- group target => only target briefing(s);
- existing standard context still present;
- CR042 Daily Memory behaviour unchanged.

### Integrated validation

Run:

- shared/server/client typechecks;
- lint checks required by staging;
- focused CR044 tests/regressions;
- existing Conversation prompt regression suite;
- production build;
- focused Playwright manual-generation path where harness support is available.

## 18. Implementation Order

Recommended order:

1. shared template parser + tests;
2. DB schema/migration + storage + tests;
3. read/save briefing routes;
4. narrow Character/Lorebook/CR042 memory tool adapters;
5. slot generation service + atomic publication + tests;
6. manual generation endpoint;
7. client query hooks + Briefing tab;
8. `$` autocomplete behaviour;
9. Conversation context helper + narrow `generate.routes.ts` integration;
10. prompt regression / Playwright / full validation.

This order keeps each layer independently testable and avoids building UI against unstable server contracts.

## 19. Development Guardrails

During implementation:

- branch from the verified `staging` baseline, not Adunato `main`;
- do not pull unrelated fork CR behaviour into CR044;
- do not redesign CR042 memory formation;
- do not introduce scheduling infrastructure;
- do not reintroduce `{{...}}` briefing macros;
- do not add a rich-text editor dependency for V1;
- do not let the model rewrite the complete Source Template;
- do not expose broad application mutation tools;
- do not let explicit `$` references fall back to name resolution;
- keep Conversation integration additive and narrowly scoped.

## 20. LLD Completion Criteria

The implementation satisfies this LLD when:

- Character Briefing state is persisted independently of Character Card versioned data;
- shared parsing provides exact deterministic instruction boundaries and stable typed entity references;
- the Character Card Briefing tab supports Source Template authoring, contextual `$` autocomplete, manual generation, and Latest Briefing display;
- each `[[...]]` slot is executed as a bounded read-only agent task and returns one validated replacement;
- CR042 memory access is scoped to the owning Character server-side;
- all explicit entity references are preflighted by stable ID;
- the host reconstructs the complete Latest Briefing and publishes it only after complete success and source-snapshot validation;
- no failure destroys the previous Latest Briefing;
- normal Conversation generation receives only the applicable responding Character briefing as additive context;
- the application remains behaviourally identical to the staging baseline for Characters without a Latest Briefing.