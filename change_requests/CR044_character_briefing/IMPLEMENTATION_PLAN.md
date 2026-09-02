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
- manually generate a Latest Briefing using read-only Character Card, CR042 Character Daily Memory, and Lorebook evidence;
- retain the Source Template unchanged while generated content replaces only the instruction spans in the Latest Briefing;
- automatically include the latest successful briefing as additional context when that character generates a Conversation response.

Scheduling, automatic generation, briefing history, deterministic `{{...}}` briefing macros, and rich-text entity chips remain out of scope.

## 2. Implementation Baseline

Application implementation must be based on:

- repository: `adunato/Marinara-Engine`
- baseline branch: `staging`
- baseline commit verified during planning: `80f688df25b691ab3dc602c0c33470d32bf6124b`

The CR044 application working branch should be created from that exact staging lineage as:

- `change/CR044-character-briefing`

This is intentionally **not** based on the existing Adunato `main` branch. The staging baseline contains the upstream-derived application state selected for this work plus CR042 Character Daily Memories and the standalone Phoenix tracing addition.

The implementation must therefore be designed against what actually exists on `staging`, without assuming other fork-local CRs from `main` are present.

## 3. Current-State Dependencies Confirmed on `staging`

The implementation plan relies on the following existing primitives rather than recreating them:

### 3.1 CR042 Character Daily Memories

The staging baseline contains the CR042 character-owned Daily Memory implementation, including:

- dedicated character Daily Memory persistence;
- server routes for character Daily Memories;
- storage/service access to memories by character;
- the Character Card `Memories` tab.

CR044 will consume this existing store as evidence. It will not alter memory formation, scheduling, retrieval used by ordinary Conversation generation, or CR042 UI semantics.

### 3.2 Character resource access

Character Cards already have canonical storage/access paths. CR044 should use existing character read services rather than copying Character Card content into a new briefing-specific store.

Mutable briefing state must remain separate from the versioned Character Card resource so editing or regenerating a briefing does not create Character Card version churn.

### 3.3 Lorebook access

Existing Lorebook storage/services should back CR044's read-only Lorebook lookup and entry retrieval. No separate CR044 Lorebook representation should be created.

### 3.4 Character Editor tab model

The current Character Editor already supports focused sibling tabs such as the CR042 `Memories` tab. CR044 should follow that pattern with a dedicated Briefing tab rather than adding controls to unrelated Character Card sections.

### 3.5 Existing generation pipeline

Conversation generation already assembles its established character, persona, history/summary, live context, memory, lore and other configured sources. CR044 should add one narrowly formatted Character Briefing block after the responding character(s) are known and before the final model request, leaving existing source construction unchanged.

## 4. Architecture Summary

V1 is implemented as five cooperating capabilities:

1. **Briefing persistence** — one mutable briefing record per Character containing Source Template and Latest Briefing state.
2. **Template parser / entity-reference contract** — deterministic host-side parsing of `[[...]]` slots and stable `$` references.
3. **Manual briefing generation service** — validates the template, resolves references, runs bounded read-only agent work per instruction slot, reconstructs the document host-side, and atomically publishes a new Latest Briefing.
4. **Character Briefing UI** — Source Template editor, contextual `$` autocomplete, Generate/Update action, status/error handling, and Latest Briefing display.
5. **Conversation context integration** — fetches and injects the latest successful briefing for the applicable responding character(s) without changing other context behaviour.

## 5. Implementation Phases

### Phase 1 — Persistence and server resource contract

Create dedicated character-level persistence for CR044 rather than adding mutable generated state to Character Card data.

Deliverables:

- new Character Briefing database schema/migration with one record per Character;
- storage/service operations to read/create/update briefing state;
- source-template persistence independent of generation;
- latest successful briefing text and generation timestamp/status;
- Character deletion behaviour aligned with existing foreign-key/storage conventions;
- server API for:
  - reading the current briefing state;
  - saving Source Template text;
  - manually generating/updating the Latest Briefing.

No historical briefing table or version archive is introduced.

### Phase 2 — Shared template parsing and stable entity references

Add a deterministic parser/serializer used by both server runtime and client editor logic.

Deliverables:

- parse complete `[[...]]` instruction spans, including multiline instructions;
- retain exact source offsets so reconstruction never depends on model-authored surrounding text;
- reject malformed executable syntax at generation time, including unclosed or nested instruction slots;
- identify whether a caret position is inside a valid/open instruction for UI autocomplete;
- define stable serialized Character and Lorebook `$` references;
- make entity type + stable ID authoritative while retaining a human-readable display label;
- treat `$` outside `[[...]]` as ordinary text;
- support a valid template containing no instructions by copying its inert content into Latest Briefing on generation.

The Source Template remains user-authored text. It is not converted into a rich-text document model.

### Phase 3 — Read-only evidence tools and generation orchestration

Implement a dedicated Character Briefing agent runtime using existing provider/tool infrastructure.

Deliverables:

- narrow read-only Character lookup capability;
- narrow read-only Lorebook lookup / entry retrieval capability;
- narrow CR042 memory retrieval capability scoped server-side to the **owning Character's** memory corpus;
- generation preflight that resolves all explicit ID-backed references before any model call;
- clear failure when a referenced Character or Lorebook no longer exists, with no fallback to name guessing;
- bounded multi-shot tool execution using the existing LLM provider/tool-call mechanisms;
- one deterministic replacement result associated with each source instruction slot;
- host-controlled reconstruction of the Latest Briefing from original source slices plus slot outputs;
- all-or-nothing publication of the new Latest Briefing;
- previous Latest Briefing retained on any failure.

For V1, implement instruction slots sequentially using one bounded agent/tool session per slot. This is intentionally simpler and more deterministic than asking one model response to rewrite or coordinate the complete document.

### Phase 4 — Character Card Briefing UI

Add a dedicated Briefing tab alongside existing Character Card tabs.

Deliverables:

- Source Template Markdown-style textarea/editor;
- helper copy describing `[[...]]` and `$` behaviour;
- `$` autocomplete only when the caret is inside an instruction;
- Character and Lorebook results grouped or clearly labelled by entity type;
- duplicate-name disambiguation using existing presentation metadata where available;
- keyboard navigation and selection, plus mouse/touch selection;
- insertion of a stable ID-backed textual reference while keeping the token readable;
- explicit Save behaviour consistent with the Character Editor's existing persistence model;
- Generate / Update Briefing action;
- disabled/busy state while generation is in progress;
- read-only Latest Briefing view with last-generated timestamp and empty state;
- generation errors surfaced without clearing the prior Latest Briefing.

V1 does not require chips/pills or a new rich-text dependency.

### Phase 5 — Conversation context integration

Add Latest Briefing as one additional character context source.

Deliverables:

- small formatter/access helper for character briefing context;
- fetch only non-empty Latest Briefings for applicable response targets;
- deterministic attribution by character name/ID;
- one distinct prompt/context block per applicable character or an equivalently unambiguous combined block;
- group Conversation behaviour aligned with the existing responding-character / visibility model;
- zero output and zero prompt impact when no Latest Briefing exists;
- no changes to existing Character Card fallback, Persona, summaries/history, CR042 Daily Memories, Lorebooks, awareness, status/context, or other configured sources.

This phase should change the Conversation generation route only at the narrow integration point necessary to append the prepared block.

### Phase 6 — Validation, migration verification and regression hardening

Deliverables:

- parser and serialization unit coverage;
- storage/API tests;
- generation-service tests with mocked provider/tool behaviour;
- client interaction tests for instruction-aware `$` completion;
- Conversation prompt regression coverage;
- focused Playwright flow covering edit → reference insertion → manual generation → Latest Briefing → Conversation injection;
- repository typecheck/lint/regression suite required by the staging baseline;
- production build.

## 6. Detailed Behavioural Requirements to Preserve During Implementation

### 6.1 Source Template versus Latest Briefing

The Source Template is persistent authoring input and must remain unchanged by generation.

The Latest Briefing is a generated copy. For each instruction slot, only the complete `[[...]]` span is replaced. Every character outside those spans comes from the source text, not from the model.

### 6.2 Agent output contract

The model must return replacement content for the current instruction only. It must not return the complete document or conversational commentary.

A constrained structured terminal result should be used so the host can validate the output before accepting it.

### 6.3 Atomic generation

Generation must not progressively overwrite Latest Briefing as slots complete.

A new Latest Briefing is persisted only after:

1. template parsing succeeds;
2. entity-reference preflight succeeds;
3. all instruction slots produce valid replacement outputs;
4. the host reconstructs the full result;
5. the persisted Source Template still matches the source snapshot used to start generation.

If any condition fails, retain the previous Latest Briefing.

### 6.4 Concurrent generation/edit protection

V1 should prevent two generation runs for the same Character from executing concurrently.

If another client changes the Source Template while a generation is running, the generated result must not be committed against the newer source. Re-read/compare the source before publication and return a conflict instead.

### 6.5 Evidence boundaries

CR044 does not need broad application introspection. Tool access is intentionally limited to:

- Character Card reads;
- owning-character CR042 Daily Memory reads/search;
- Lorebook/Lorebook-entry reads.

No mutation tools are exposed to the briefing model.

## 7. Data Migration and Compatibility

The database change is additive.

- Existing Characters require no backfill.
- Absence of a Character Briefing record is equivalent to an empty Source Template and no Latest Briefing.
- Existing Conversation generation behaves exactly as before until a character has a non-empty Latest Briefing.
- Existing CR042 memory data is reused in place.
- No existing Character Card schema needs to be rewritten.

Rollback can remove the feature code while leaving the unused additive briefing table/data intact; no destructive rollback migration is required for application rollback.

## 8. Validation Plan

### Template/parser

Validate:

- one instruction;
- multiple instructions;
- multiline instructions;
- exact preservation of text between/before/after slots;
- zero-slot template;
- unclosed instruction;
- nested instruction rejection;
- `$` references inside versus outside instructions;
- Character/Lorebook token parsing and escaped display labels;
- deterministic reconstruction independent of repeated identical instruction text.

### Entity-reference preflight

Validate:

- valid Character reference;
- valid Lorebook reference;
- duplicate display names remain unambiguous by ID;
- renamed entity continues resolving by ID;
- deleted entity aborts before model execution;
- no fallback to name guessing.

### Agent runtime

Validate:

- tool call followed by valid replacement result;
- multiple tool rounds;
- malformed terminal result;
- provider failure/retry behaviour through existing transport abstractions;
- tool-round limit;
- one failed slot aborts full publication;
- CR042 memory tool cannot access another Character's memory corpus;
- no write/mutation tools available.

### Persistence and concurrency

Validate:

- Source Template saves without generating;
- successful generation updates Latest Briefing and timestamp;
- failure preserves previous Latest Briefing;
- concurrent generation is rejected;
- source changed during generation causes conflict and preserves previous Latest Briefing.

### Client

Validate:

- Briefing tab load/save/empty states;
- `$` picker only opens inside `[[...]]`;
- grouped Character/Lorebook completion;
- filtering and duplicate-name presentation;
- keyboard/mouse/touch selection;
- stable serialized token insertion;
- generation loading state and error state;
- Latest Briefing remains visible after failed regeneration.

### Conversation integration

Validate:

- no briefing means no prompt change;
- single responding Character gets its own Latest Briefing;
- group/targeted generation exposes only applicable briefing context;
- existing CR042 and standard Conversation context remain present and unmodified;
- prompt inspection demonstrates clear attribution and boundary of briefing text.

### Integrated checks

Run the staging branch's required project checks, focused regressions, and production build. Add a focused Playwright scenario if the existing harness supports the Character Editor + generation path on this baseline.

## 9. Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| Model rewrites user Markdown | Never ask it to return the document; host reconstructs from source offsets and per-slot replacement values. |
| Ambiguous names | Persist stable typed IDs; display names are cosmetic only. |
| Stale/deleted references | Resolve all explicit references during preflight and fail before LLM work. |
| Runaway tool use | Narrow read-only tools, bounded results, bounded rounds, one slot session at a time. |
| Excessive memory context | Query/bound CR042 results rather than preloading the complete corpus. |
| Character Card version churn | Persist Source Template/Latest Briefing in dedicated CR044 storage. |
| Partial or stale generated output | All-or-nothing commit plus source-snapshot recheck before publication. |
| Fork maintenance overhead | Reuse staging services/components and touch Conversation generation only at one additive injection point. |
| Group prompt leakage | Resolve briefing context only for existing response targets/visibility decisions. |

## 10. Rollback Strategy

If CR044 needs to be backed out:

1. remove/disable the Character Briefing tab and API registration;
2. remove the additive Conversation briefing-context injection;
3. stop registering the generation service/tools;
4. leave the additive briefing table/data in place until a later deliberate cleanup, avoiding destructive rollback work.

Because normal Conversation context is not replaced by CR044, disabling the feature returns generation behaviour to the staging baseline without needing to reconstruct prior prompt logic.

## 11. Completion Criteria

CR044 implementation is complete when:

- the application branch is based on the agreed `staging` baseline;
- a Character can persist a Source Template independently of its Character Card data;
- `[[...]]` slots and `$` Character/Lorebook references follow the approved syntax/UX contract;
- manual generation selectively reads Character Cards, the owning Character's CR042 Daily Memories, and Lorebooks through bounded read-only tools;
- Latest Briefing is reconstructed host-side by exact instruction-span replacement and published atomically;
- failed or conflicting generation preserves the previous Latest Briefing;
- the Character Card Briefing tab exposes Source Template and Latest Briefing cleanly;
- normal Conversation generation receives the applicable Latest Briefing as additive character context;
- existing Conversation context behaviour remains unchanged;
- focused tests, regressions and production build pass on the CR044 branch.