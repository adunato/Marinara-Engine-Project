# CR044 Implementation Plan — Character Briefing

## Status

Ready for implementation after review of this plan and the accompanying LLD.

## 1. Objective

Implement the CR044 Character Briefing defined in the approved HLD as a character-owned, manually generated context document that adds higher-order story understanding to normal Conversation generation without replacing or suppressing existing Marinara prompt/context behaviour.

V1 must let the user:

- open a Character Card and use a dedicated Character Briefing tab;
- maintain an editable Markdown-style Source Template;
- embed self-replacing `[[...]]` agent instructions in that template;
- reference Characters and Lorebooks unambiguously with `$` autocomplete inside those instructions;
- select the connection used for Character Briefing generation;
- manually generate a Latest Briefing using deterministic host-supplied Character/Lorebook context plus agentic retrieval from the owning Character's CR042 Daily Memories;
- retain the Source Template unchanged while generated content replaces only the instruction spans in the Latest Briefing;
- automatically include the latest successful briefing as additional context when that character generates a Conversation response.

Scheduling, automatic generation, briefing history, deterministic `{{...}}` briefing macros, Character/Lorebook agent discovery, Persona injection, and rich-text entity chips remain out of scope.

## 2. Implementation Baseline

Application implementation must be based on:

- repository: `adunato/Marinara-Engine`
- baseline branch: `staging`
- baseline commit verified during planning: `80f688df25b691ab3dc602c0c33470d32bf6124b`

The CR044 application working branch should be created from that staging lineage as:

- `change/CR044-character-briefing`

This is intentionally **not** based on the existing Adunato `main` branch. The staging baseline contains the upstream-derived application state selected for this work plus CR042 Character Daily Memories and the standalone Phoenix tracing addition.

The implementation must therefore be designed against what actually exists on `staging`, without assuming other fork-local CRs from `main` are present.

## 3. Current-State Dependencies Confirmed on `staging`

### 3.1 CR042 Character Daily Memories

The staging baseline contains the CR042 character-owned Daily Memory implementation, including:

- dedicated character Daily Memory persistence;
- active-memory selection by Character;
- embeddings and embedding-space handling using the existing Memory Recall embedding infrastructure;
- character-scoped formation connection configuration;
- retrieval/ranking configuration used for ordinary Conversation injection;
- server routes and the Character Card `Memories` tab.

CR044 must consume this existing evidence system rather than creating a second memory store or ranking implementation.

The new Character Briefing tool must use the **same centralized CR042 retrieval/ranking/filtering/result-selection policy used by Conversation injection**. If the current staging implementation keeps part of that policy embedded in a route/runtime function rather than exposing a reusable service, implementation should first extract the smallest shared server-side retrieval boundary and make both existing Conversation injection and the new tool call that shared path.

### 3.2 Standard Marinara agent-tool infrastructure

Staging already has:

- the shared built-in tool registry under `packages/shared/src/features/function-calls/`;
- shared tool definitions/manifests;
- `AgentToolContext` in the common agent executor;
- common tool-call execution/runtime plumbing.

CR044 must use that architecture for its only agentic tool rather than introduce briefing-specific tool dispatch.

### 3.3 Character and Lorebook resource access

Character Cards and Lorebooks already have canonical storage/access paths.

CR044 uses those paths **host-side** to resolve the owning Character and explicit ID-backed `$` references before the model runs. Character/Lorebook get/search operations are not exposed as Character Briefing agent tools in V1.

### 3.4 Character Editor tab model and connection UI

The current Character Editor already supports focused sibling tabs such as the CR042 `Memories` tab. CR044 should follow that pattern with a dedicated Briefing tab.

The CR042 Memories UI also provides the closest existing precedent for a Character-scoped generation connection selector. Reuse its connection-picker conventions/components where practical rather than creating a second interaction pattern.

### 3.5 Existing generation pipeline

Conversation generation already assembles its established character, persona, history/summary, live context, memory, lore and other configured sources. CR044 should add one narrowly formatted Character Briefing block after the responding character(s) are known and before the final model request, leaving existing source construction unchanged.

## 4. Resolved Architecture Decisions

1. **Dedicated persistence** — mutable Source Template, generation connection, and Latest Briefing state live outside versioned Character Card data.
2. **Host-owned transformation** — the host parses exact `[[...]]` spans, executes one bounded slot task at a time, and reconstructs the document from original source slices plus validated replacement text.
3. **Deterministic entity access** — the owning Character Card is always preloaded; Character/Lorebook `$` references in the current instruction are resolved by stable ID and their complete data is preloaded. The model cannot discover or guess application entities.
4. **No Persona context** — Character Briefing is Character-owned across potentially different Conversation Personas, so no Persona Card is automatically supplied in V1.
5. **Complete template context** — every slot receives the entire Source Template snapshot unchanged for orientation, not a heuristically trimmed surrounding excerpt.
6. **Current-slot references only** — only `$` references inside the instruction currently being executed are expanded into full Character/Lorebook data for that slot.
7. **One standard agent tool** — the hardcoded V1 allowlist contains only `search_character_daily_memories(query)`.
8. **Central CR042 retrieval** — the memory tool accepts only a semantic query; Character scope, result limits, ranking weights, filtering and other selection behaviour remain host/system concerns inherited from the centralized CR042 retrieval policy.
9. **Per-slot execution** — V1 executes slots sequentially in separate bounded sessions. Each sees the same Source Template snapshot; prior generated replacements are not fed into later slot contexts.
10. **Character-scoped connection selection** — persist an optional Briefing generation connection. Explicit selection wins; if unset, use normal default agent connection/fallback infrastructure. Never inherit an arbitrary Conversation connection.
11. **Atomic publication** — publish a new Latest Briefing only after every slot succeeds and the source snapshot still matches persisted source.
12. **Additive Conversation integration** — Latest Briefing is an additional character-specific context source only.

## 5. Implementation Phases

### Phase 1 — Persistence and API contract

Create dedicated character-level persistence for CR044 rather than adding mutable generated state to Character Card data.

Deliverables:

- new Character Briefing schema with one record per Character;
- fields for Source Template, nullable Briefing generation connection ID, Latest Briefing, latest successful generation timestamp, and timestamps/status required by UI/runtime;
- storage/service operations to read/create/update briefing state;
- source/configuration persistence independent of generation;
- Character deletion behaviour aligned with existing storage conventions;
- server API for reading state, saving Source Template + generation connection, and manually generating/updating the Latest Briefing;
- connection-reference cleanup/validation aligned with existing connection storage conventions where required.

No historical briefing table or version archive is introduced.

### Phase 2 — Shared template parsing and stable entity references

Add a deterministic parser/serializer used by server runtime and client editor logic.

Deliverables:

- parse complete `[[...]]` instruction spans, including multiline instructions;
- retain exact source offsets so reconstruction never depends on model-authored surrounding text;
- reject malformed executable syntax at generation time, including unclosed or nested instruction slots;
- identify whether a caret position is inside an open/complete instruction for UI autocomplete;
- define stable serialized Character and Lorebook `$` references;
- make entity type + stable ID authoritative while retaining a human-readable display label;
- treat `$` outside `[[...]]` as ordinary text;
- map each parsed `$` reference to the instruction slot containing it;
- support a valid template containing no instructions by copying its inert content into Latest Briefing on generation.

### Phase 3 — Standard Daily Memory agent tool

Implement `search_character_daily_memories` as a normal Marinara built-in tool.

Model-facing signature:

```text
search_character_daily_memories(query)
```

Deliverables:

- new shared built-in tool manifest/registry entry;
- common tool-executor handler/context callback using existing Marinara tool infrastructure;
- server-side hidden binding of the owning Character ID so the model cannot select another Character;
- reuse/extraction of CR042's existing Conversation Daily Memory retrieval path so the tool and Conversation injection share ranking/filtering/result-selection behaviour;
- no model parameters for Character ID, dates, result count, weights, thresholds, or embedding configuration;
- bounded serialized tool output using the result set already chosen by CR042 retrieval logic;
- relevant memory content plus existing useful provenance metadata where available;
- tests proving the tool cannot escape the owning Character scope.

Do not add Character or Lorebook tools for CR044. Do not expose custom tools or the general built-in catalogue.

### Phase 4 — Manual generation orchestration and exact context construction

Implement the specialised Character Briefing generation service while reusing normal provider/fallback/tool execution infrastructure.

Generation preflight:

1. reject/serialize concurrent generation for the same Character;
2. load the owning Character and Briefing state;
3. snapshot Source Template and generation connection configuration;
4. resolve the Briefing generation connection once for the full run;
5. parse all instruction slots and typed references;
6. resolve every referenced Character/Lorebook by stable ID before any slot model call;
7. abort clearly on malformed syntax, unresolved references, or unrecoverable connection configuration.

For each slot, construct exactly this initial context:

- complete owning Character Card;
- complete Source Template snapshot, explicitly marked contextual/read-only;
- exact current instruction text, separately identified;
- complete Character Cards for `$Character` references occurring in the current instruction only;
- complete Lorebooks for `$Lorebook` references occurring in the current instruction only;
- current date/time;
- the sole allowed tool definition, `search_character_daily_memories(query)`;
- strict terminal-output contract requiring replacement content for the current slot only.

No Persona is supplied. No Character/Lorebook discovery is possible. References elsewhere in the Source Template remain visible as text but are not expanded into full data for the current slot.

Execution/publishing deliverables:

- one bounded standard-agent-executor/tool session per slot, sequentially;
- same resolved run connection for every slot;
- constrained terminal result such as `{ replacement: string }`;
- replacements held in memory until all slots succeed;
- source-offset reconstruction entirely host-side;
- final persisted Source Template re-read/compare before publication;
- atomic Latest Briefing + generated timestamp update;
- prior Latest Briefing retained on any failure/conflict.

### Phase 5 — Character Card Briefing UI

Add a dedicated Briefing tab alongside existing Character Card tabs.

Deliverables:

- Source Template Markdown-style textarea/editor;
- helper copy describing `[[...]]` and `$` behaviour;
- Character Briefing generation connection selector following CR042 conventions;
- `$` autocomplete only when the caret is inside an instruction;
- Character and Lorebook results grouped or clearly labelled by entity type;
- duplicate-name disambiguation using existing presentation metadata where available;
- keyboard navigation and selection, plus mouse/touch selection;
- insertion of a stable ID-backed textual reference while keeping the token readable;
- explicit Save behaviour for Source Template and generation connection;
- Generate / Update Briefing action;
- disabled/busy state while generation is in progress;
- read-only Latest Briefing view with last-generated timestamp and empty state;
- generation/configuration errors surfaced without clearing the prior Latest Briefing.

V1 does not require chips/pills or a new rich-text dependency.

### Phase 6 — Conversation context integration

Add Latest Briefing as one additional character context source.

Deliverables:

- small formatter/access helper for character briefing context;
- fetch only non-empty Latest Briefings for applicable response targets;
- deterministic attribution by character name/ID;
- one distinct prompt/context block per applicable character or an equivalently unambiguous combined block;
- group Conversation behaviour aligned with the existing responding-character / visibility model;
- zero output and zero prompt impact when no Latest Briefing exists;
- no changes to existing Character Card fallback, Persona, summaries/history, CR042 Daily Memories, Lorebooks, awareness, status/context, or other configured sources.

### Phase 7 — Validation and regression hardening

Deliverables:

- parser and serialization unit coverage;
- storage/API and connection-resolution tests;
- generation-service tests with mocked provider/tool behaviour;
- standard Daily Memory tool tests and CR042 shared-retrieval regression coverage;
- client interaction tests for instruction-aware `$` completion and connection selection;
- Conversation prompt regression coverage;
- focused end-to-end flow where practical: edit → reference insertion → connection selection → manual generation → Latest Briefing → Conversation injection;
- repository checks required by the staging baseline and production build.

## 6. Detailed Behavioural Requirements

### 6.1 Source Template versus Latest Briefing

The Source Template is persistent authoring input and remains unchanged by generation.

The Latest Briefing is a generated copy. For each instruction slot, only the complete `[[...]]` span is replaced. Every character outside those spans comes from the source text, not from the model.

### 6.2 Slot context determinism

Do not optimise context by heuristically trimming the Source Template or selectively loading foundational Character context.

Each slot always receives:

- full owning Character Card;
- full Source Template snapshot;
- current instruction;
- current instruction's fully resolved `$` Character/Lorebook resources;
- current date/time;
- one memory-search tool.

This context contract should be encoded in one formatter/builder and covered directly by tests.

### 6.3 Agent output contract

The model returns replacement content for the current instruction only. It must not return the complete document, neighbouring sections, reasoning narration, or tool-use commentary.

Use a constrained structured terminal result so the host can validate the output before accepting it.

### 6.4 Atomic generation and concurrency

Generation must not progressively overwrite Latest Briefing.

A new Latest Briefing is persisted only after parsing, reference preflight, connection resolution, all slot executions, reconstruction, and source-snapshot recheck succeed.

Prevent concurrent generation for the same Character. If another client changes the Source Template while a run is active, return a conflict and preserve the prior Latest Briefing.

### 6.5 Connection semantics

The Character Briefing connection setting is independent from CR042 and Conversations.

Resolution should follow the established agent/CR042 pattern:

1. explicitly configured Character Briefing connection when present;
2. normal default agent connection/fallback infrastructure when unset or when existing fallback semantics apply.

Snapshot the resolved connection/model used by the run for logging/tracing where practical. Do not switch connection between instruction slots due to Conversation state.

### 6.6 Tool boundaries

The V1 allowlist is exactly:

```text
search_character_daily_memories
```

The model sees only the `query` parameter.

Character/Lorebook access is host-side deterministic context construction, not tool use. No general Marinara tools, custom tools, Professor Mari `app_data`, write tools, chat tools, web tools, or discovery tools are exposed.

## 7. Data Migration and Compatibility

The database change is additive.

- Existing Characters require no backfill.
- Absence of a Character Briefing record is equivalent to an empty Source Template, default/unset generation connection, and no Latest Briefing.
- Existing Conversation generation behaves exactly as before until a character has a non-empty Latest Briefing.
- Existing CR042 memory data is reused in place.
- No existing Character Card schema needs to be rewritten.

Rollback can remove feature code while leaving unused additive briefing data intact; no destructive rollback migration is required for application rollback.

## 8. Validation Plan

### Template/parser

Validate one/multiple/multiline instructions, exact source preservation, zero-slot templates, malformed/nested syntax, `$` references inside versus outside instructions, ID-backed token parsing/escaping, slot-to-reference association, and deterministic reconstruction with repeated identical instruction text.

### Entity-reference preflight and slot context

Validate:

- owning Character Card is always present;
- no Persona Card is present;
- full Source Template snapshot is present for every slot;
- only current-slot `$` references are expanded;
- valid Character/Lorebook references resolve to complete resources;
- duplicate names remain unambiguous by ID;
- renamed entities continue resolving by ID;
- deleted entities abort before model execution;
- no fallback to natural-language name guessing;
- every slot receives the same Source Template snapshot even after earlier slots complete.

### Daily Memory standard tool

Validate:

- built-in registry exposes `search_character_daily_memories`;
- Character Briefing allowlist exposes that tool and no others;
- model schema exposes only `query`;
- owning Character ID is host-bound and cannot be overridden;
- returned results follow the same CR042 retrieval policy as Conversation injection;
- no duplicate CR044 ranking/limit logic exists;
- multiple semantic searches are supported within the common bounded tool-round policy;
- tool failure is attributed cleanly to the current slot.

### Connection selection

Validate:

- selector loads/saves independently of CR042 settings;
- explicit connection is used for all slots;
- unset setting uses normal default agent/fallback resolution;
- no source Conversation connection is inherited;
- invalid/deleted unrecoverable configuration fails without modifying Latest Briefing.

### Persistence and generation

Validate Source Template/config saves without generating, successful generation updates Latest Briefing/timestamp, failure preserves previous Latest Briefing, concurrent generation is rejected, and source changed during generation causes conflict.

### Client

Validate Briefing tab states, connection selection, `$` picker scope/filtering/disambiguation, keyboard/mouse/touch insertion, stable token serialization, loading/error states, and preservation of prior Latest Briefing after failed regeneration.

### Conversation integration

Validate no briefing means no prompt change; applicable Character receives its Latest Briefing; group/targeted generation exposes only applicable briefing context; and existing CR042/standard Conversation context remains present and unmodified.

## 9. Expected Files and Areas

Exact paths may vary slightly after code inspection, but implementation is expected to touch these areas.

### Shared

- Character Briefing public types/schema/parser module.
- `packages/shared/src/features/function-calls/tools/search-character-daily-memories/manifest.ts` — new standard built-in tool manifest.
- generated built-in tool registry output after running the shared registry generator/build.

### Server persistence/services

- dedicated Character Briefing schema/storage.
- Character Briefing generation/orchestration service.
- Character Briefing context formatter/parser integration.
- CR042 Daily Memory retrieval service extraction/reuse if current Conversation retrieval logic is not already reusable.
- common tool executor/runtime extension for a host-bound Character Daily Memory search callback.
- connection resolution reuse from existing agent/CR042 infrastructure.

### Server routes/runtime

- Character Briefing character-scoped API routes.
- route registration.
- narrow Conversation-generation context injection point.

### Client

- focused `CharacterBriefingTab` component.
- Character Editor tab registration.
- Character Briefing data hook/API boundary.
- reuse/adaptation of existing connection-selector and autocomplete interaction primitives where clean.

### Validation

- focused parser/generation/tool/context tests and package regression script if consistent with current repository practice.
- end-to-end coverage only where the staging harness supports it without excessive fixture work.

## 10. Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| Model rewrites user Markdown | Never ask it to return the document; host reconstructs from exact source offsets. |
| Ambiguous application entities | Only ID-backed `$` references grant Character/Lorebook context; no name-based discovery. |
| Stale/deleted references | Preflight stable IDs before any model call. |
| Tool architecture divergence | Register the sole memory tool in Marinara's standard built-in tool system. |
| CR042 retrieval divergence | Extract/reuse one centralized retrieval policy for both Conversation injection and tool execution. |
| Agent over-tunes retrieval | Expose only `query`; keep limits/weights/filters host-controlled. |
| Excessive deterministic context | V1 knowingly loads complete current-slot referenced cards/lorebooks for clarity; optimise only in a later CR if evidence requires it. |
| Wrong Persona assumptions | Supply no Persona in Character-level generation. |
| Partial/stale generated output | All-or-nothing publication plus source-snapshot recheck. |
| Connection ambiguity | Persist Character Briefing-specific selection and resolve it once per run. |
| Fork maintenance overhead | Reuse staging primitives and keep Conversation integration additive/narrow. |

## 11. Rollback Strategy

If CR044 needs to be backed out:

1. remove/disable the Character Briefing tab and API registration;
2. remove the additive Conversation briefing-context injection;
3. remove Character Briefing generation orchestration and its hardcoded tool allowlist;
4. remove the new standard memory tool registration only if no other feature has adopted it;
5. leave additive briefing data in place until a later deliberate cleanup.

Because normal Conversation context is not replaced by CR044, disabling the feature returns generation behaviour to the staging baseline without reconstructing prior prompt logic.

## 12. Completion Criteria

CR044 implementation is complete when:

- the application branch is based on the agreed `staging` baseline;
- a Character can persist a Source Template and generation connection independently of Character Card versioned data;
- `[[...]]` slots and `$` Character/Lorebook references follow the approved syntax/UX contract;
- every slot receives the approved deterministic initial context: owning Character Card, complete Source Template snapshot, current instruction, current-slot referenced Character Cards/Lorebooks, current date/time, and no Persona;
- `search_character_daily_memories(query)` exists as a standard Marinara built-in tool, is the **only** tool exposed to Character Briefing, is host-scoped to the owner Character, and reuses the centralized CR042 retrieval policy;
- all slots in a run use the resolved Character Briefing generation connection;
- Latest Briefing is reconstructed host-side by exact instruction-span replacement and published atomically;
- failed/conflicting generation preserves the previous Latest Briefing;
- normal Conversation generation receives the applicable Latest Briefing as additive character context;
- existing Conversation context behaviour remains unchanged;
- focused tests, regressions and production build pass on the CR044 branch.