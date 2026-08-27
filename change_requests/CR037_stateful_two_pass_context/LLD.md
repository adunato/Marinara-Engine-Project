# Low-Level Design: CR037 Stateful Two-Pass Context Briefing

## 1. Change Overview

CR037 replaces the CR032 stateless Conversation curator with one persistent briefing per Conversation chat. The implementation keeps the existing Standard/Two-Pass pipeline boundary and isolated response writer, but replaces the CR032 "prepared prompt snapshot -> one-shot curator" path with a controlled source registry, a persistent `SOURCES + BRIEFING` artifact, a fast-path classifier, and a stateful curation flow.

The design deliberately does **not** inherit every message in the current CR032 prepared-context snapshot. The only curation inputs are the 15 source keys defined in the HLD. Their per-chat roles determine whether content is host-injected verbatim, made available to the curator through one batched source request, or excluded.

The briefing is prepared **once per Conversation turn** and reused by every responder in a group turn. Standard Conversation generation remains unchanged.

Persistent state stays in chat metadata; no database schema or dedicated briefing table/file is introduced.

---

## 2. File Changes

### `packages/shared/src/types/chat.ts`

**Action:** Modify

Own the shared CR037 contracts and normalization.

Add:

- `ConversationContextSourceKey` for the closed source set: `characterCard`, `persona`, `conversationStatus`, `commands`, `reactRules`, `replyRules`, `memories`, `dailyMemories`, `dailyIntentions`, `lorebook`, `summaries`, `crossChatAwareness`, `roleplayScenes`, `characterMind`, `recentExchange`.
- `ConversationContextSourceRole = "always_include" | "agent_curated" | "always_exclude"`.
- a constant/default role map matching the HLD; `recentExchange` normalization must reject/coerce `always_exclude`.
- `ConversationBriefingState` lifecycle metadata containing a schema version, logical-day key, revision, updated timestamp, and `contributingSources`.
- source-status response types used by the client (`available`, current role, and optional unavailability reason).

Extend `ChatMetadata` with:

- `conversationFastPathConnectionId`;
- `conversationContextSourceRoles`;
- `conversationContextBriefing` — the single persisted complete Markdown artifact;
- `conversationContextBriefingState` — lifecycle/provenance metadata only, not a second context artifact.

Extend `normalizeConversationTwoPassSettings()` for the classifier connection and add dedicated normalizers for source roles and briefing state. Existing CR032 metadata must remain readable; chats without CR037 fields receive HLD defaults.

No `packages/shared/src/index.ts` change is needed because `types/chat.ts` is already re-exported.

### `packages/shared/src/constants/conversation-prompt.ts`

**Action:** Modify

Replace the default stateless CR032 curator instructions with CR037 stateful curation instructions and add `DEFAULT_CONVERSATION_FAST_PATH_PROMPT`.

The classifier prompt must return only the HLD shape:

`{ "fastPath": boolean, "reason": string }`

The curation prompt must support three explicit actions supplied by the host:

- fast update of an existing BRIEFING;
- full update of an existing BRIEFING after source retrieval;
- full build from an empty BRIEFING.

The model is asked to return **only the editable BRIEFING section**, never the complete artifact. The host reconstructs `SOURCES + BRIEFING`; this makes SOURCES immutability structural rather than dependent on model obedience.

Update the writer prompt wording so it refers to the CR037 briefing artifact rather than a briefing derived from the "complete resolved context" snapshot. Keep the existing writer output rules.

### `packages/server/src/services/generation/conversation-context-briefing-state.ts`

**Action:** Create

Own persistent-state lifecycle and per-chat serialization rules, without performing LLM calls.

Responsibilities:

- parse/split the persisted artifact at the stable `## SOURCES` / `## BRIEFING` boundary;
- assemble the complete artifact from host-rendered SOURCES and the model-produced BRIEFING;
- derive the Conversation logical-day key using the existing Conversation timezone and day-rollover semantics;
- decide whether a valid previous BRIEFING exists;
- force a rebuild when the artifact/state is missing, after reset, when the logical day changes, or when a source recorded in `contributingSources` is now excluded or unavailable;
- build the metadata patch after successful curation and increment the briefing revision;
- expose a per-chat `withConversationBriefingTurnLock()` queue used by both generation and CR037 settings/reset mutations.

`contributingSources` records all available Always Include sources plus Agent Curated sources actually returned to the curator. It is used only for safe invalidation/provenance.

The lock serializes briefing curation and CR037 configuration changes for one chat. The final metadata write still uses `createChatsStorage().patchMetadata()`, preserving Marinara's existing metadata write queue.

### `packages/server/src/services/generation/conversation-context-sources.ts`

**Action:** Create

Implement the authoritative registry for the 15 HLD source keys. No source outside this registry is visible to CR037.

Each registry entry provides:

- display/diagnostic identity;
- availability resolution;
- bounded resolution for Always Include;
- bounded resolution for Agent Curated requests;
- attachment references where the source contains message images/files.

The module exposes two host operations:

1. resolve all available `always_include` sources and render immutable labeled SOURCES blocks;
2. execute one curator-produced batched request for currently available `agent_curated` sources in parallel and return one attributed combined result block.

The curator request uses the HLD structure (`query` keyed by source key plus `reason`). Reject keys that are not Agent Curated or are unavailable. Source-specific arguments are normalized and capped by the host; simple/static sources may accept only an include request, while retrieval sources may accept search/range/limit parameters.

Source adapters reuse existing Marinara capabilities rather than duplicating stores:

- `characterCard`: already-loaded participating character records, including Conversation card/profile fields defined by the HLD source.
- `persona`: active chat persona record.
- `conversationStatus`: `buildConversationCurrentContextBlock()` and the same current presence/schedule/time inputs used by Conversation generation.
- `commands`, `reactRules`, `replyRules`: already-resolved Conversation macro/command rule content supplied by the generation route.
- `memories`: existing semantic/long-term memory recall runtime.
- `dailyMemories`: `retrieveDailyMemories()`.
- `dailyIntentions`: normalized Daily Intentions state/current outputs.
- `lorebook`: existing lorebook scan/retrieval functions and current active lorebook scope.
- `summaries`: current rolling/day/week Conversation summary metadata, using existing summary normalizers.
- `crossChatAwareness`: `buildAwarenessBlock()` as the existing canonical cross-chat reader, with request bounding performed by this adapter.
- `roleplayScenes`: the structured source-chat reader exposed from `roleplay-context-sources.ts`.
- `characterMind`: existing Character Mind list/search/read query primitives; CR037 exposes read-only query behavior only.
- `recentExchange`: the CR037 recent-exchange reader exported from `conversation-history-runtime.ts`; fixed baseline for Always Include, bounded deeper lookup when Agent Curated.

Optional curated-source failures are returned as attributed unavailable/error results so the curator can continue without fabricating data. Failure to resolve a required Always Include source fails the curation turn.

Message media remain attached to their source result. Agent Curated media are visible to the curator only; Always Include media are also carried with the writer briefing request because they are part of immutable SOURCES.

### `packages/server/src/routes/generate/conversation-two-pass-runtime.ts`

**Action:** Modify

Reduce this file to low-level CR037 model-message construction, parsing and writer isolation helpers.

Remove the CR032 assumption that `createConversationSourceSnapshot(preparedMessagesForGen)` defines the curator input universe.

Add helpers for:

- classifier messages and strict classifier JSON parsing;
- full-path Shot 1 source-request messages and request parsing;
- fast-update/full-update/full-build curator messages;
- curation output normalization/size limits;
- writer messages accepting the complete artifact plus any Always Include images/files;
- prompt/diagnostic hashes.

The curator output is BRIEFING-only. `conversation-context-briefing-state.ts` owns final artifact assembly, so model output can never overwrite SOURCES.

Classifier parse/call failure is fail-safe: it selects the full path. A failed/empty final curation response is fatal for the turn; keep the previous persisted briefing unchanged and do not call the writer.

### `packages/server/src/routes/generate/conversation-two-pass-orchestrator.ts`

**Action:** Create

Own the per-turn CR037 state machine and LLM call sequence. Expose one entry point such as `prepareConversationTurnBriefing()` to `generate.routes.ts`.

Inside `withConversationBriefingTurnLock(chatId)`:

1. reload current chat metadata and normalize roles/state;
2. inspect current source availability;
3. determine whether a full build is forced;
4. resolve current Always Include SOURCES;
5. construct the turn delta (new user/trigger, previous assistant message, relevant generation metadata);
6. if a valid prior briefing exists, call the dedicated classifier;
7. fast path: skip source retrieval and make one constrained curation-agent BRIEFING update;
8. full path: curation Shot 1 returns one batched source request, host executes requested adapters in parallel, Shot 2 returns the updated/new BRIEFING;
9. assemble the host-owned complete artifact;
10. persist artifact + lifecycle metadata atomically through `patchMetadata()`;
11. return the artifact, media and diagnostics to the generation route.

Forced full builds skip the classifier. They begin from an empty BRIEFING and cannot copy text from invalidated state.

Connection resolution:

- fast classifier uses `conversationFastPathConnectionId`, falling back to the selected curator connection when unset;
- curation uses the existing `conversationCuratorConnectionId`, then the normal chat generation connection fallback already used by CR032.

Call count is therefore:

- fast: classifier + one curator edit + writer;
- normal full: classifier + curator Shot 1 + curator Shot 2 + writer;
- forced full: curator Shot 1 + curator Shot 2 + writer.

The orchestrator prepares one briefing per incoming Conversation turn, not per responding character.

### `packages/server/src/routes/generate/conversation-history-runtime.ts`

**Action:** Modify

Expose a CR037 recent-exchange resolver that reuses current Conversation history visibility and speaker handling rather than creating a second interpretation of transcript history.

It must support:

- the fixed Always Include recent window;
- Agent Curated bounded look-back parameters;
- chronological speaker-labelled text;
- hidden-from-AI filtering and existing membership/system-event rules;
- associated message images/files.

Existing CR032/Standard summary and prompt-history behavior stays intact.

### `packages/server/src/routes/generate/roleplay-context-sources.ts`

**Action:** Modify

Retain `buildRoleplayContextSourcesBlock()` for existing consumers, but extract/export the underlying selected-source-chat read operation so CR037 can request source chats without parsing a preformatted prompt block.

The structured resolver should accept bounded search/limit criteria, resolve only chats already linked through the existing context-source relationship, and return the same Conversation/Roleplay/Game summary, state and recent-message material currently formatted by this module.

No write behavior is added.

### `packages/server/src/routes/generate.routes.ts`

**Action:** Modify

Replace the current per-response CR032 curator block with the CR037 orchestrator.

The integration point is after Conversation responder selection/common turn context has been established and before `generateForCharacter()` begins producing responses. This is essential for group chats: call the orchestrator once, then capture the returned briefing for every responder.

Inside `generateForCharacter()`:

- remove `createConversationSourceSnapshot()` and the current one-shot curator call;
- when Two-Pass is active, build only the writer request from the already-prepared shared CR037 artifact plus the responder-specific writer system prompt/technical contracts;
- retain Standard generation unchanged;
- retain writer-level command/output technical contracts outside the briefing exactly as CR032 does.

Per-assistant generation metadata should reference the shared turn diagnostics and add the responder's exact writer input/hash. All responders in the same group turn therefore point to the same briefing revision/path/source set.

The current broad prepared-message snapshot must never be used as a fallback curator input when a CR037 source is unavailable.

### `packages/server/src/routes/conversation.routes.ts`

**Action:** Modify

Add Conversation-specific CR037 management endpoints so source policy and briefing invalidation stay server-owned.

Expose operations for:

- reading the current briefing plus the registry's current per-source availability/roles;
- replacing/updating the per-source role map;
- resetting the briefing;
- resetting source roles to HLD defaults.

Role mutation and reset operations run through `withConversationBriefingTurnLock()` before `patchMetadata()`.

When a source currently recorded in `contributingSources` changes to `always_exclude`, clear `conversationContextBriefing` and its lifecycle state immediately while retaining the new role map. Other role changes retain the briefing unless normal validity rules require a rebuild.

Availability is derived server-side from the same registry used during generation; the client must not reimplement it. A source becoming unavailable outside this endpoint is detected by the orchestrator before the next writer call and forces a rebuild.

### `packages/server/src/routes/chats.routes.ts`

**Action:** Modify

Update Peek Prompt / cached Two-Pass decoding for the CR037 diagnostic shape.

Replace the CR032-only `curatorInput + briefing + writerInput` expectation with diagnostics that can represent:

- path: `fast`, `full`, or `forced_full`;
- classifier input/result when run;
- previous briefing revision;
- turn delta;
- Always Include source keys;
- requested/returned Agent Curated source keys and combined source result;
- curation model inputs/outputs for the applicable shot(s);
- final complete briefing artifact;
- writer input.

The normal chat metadata CRUD/export/import path continues to treat CR037 fields as ordinary metadata; no custom export format or database migration is required.

### `packages/client/src/hooks/use-chats.ts`

**Action:** Modify

Add React Query hooks for the new Conversation briefing endpoints:

- briefing/source-status query;
- source-role update mutation;
- reset briefing mutation;
- reset roles mutation.

Successful mutations update/invalidate the existing chat detail/list caches plus the new briefing query key so Chat Settings reflects server-normalized roles and invalidation immediately.

Do not implement source availability calculations in the client.

### `packages/client/src/features/chat-settings/sections/ConversationPromptSection.tsx`

**Action:** Modify

Keep the existing Standard/Two-Pass selector, curation connection, max-output-token control and prompt editors.

Add the **Fast-path classifier connection** selector as a separate setting from the curation connection. Its unset/default state means "use curator connection".

Update labels/help text that currently describe the CR032 curator as stateless/complete-snapshot curation. Do not add a Stateless/Stateful Two-Pass selector; CR037 replaces CR032 Two-Pass behavior.

### `packages/client/src/features/chat-settings/sections/ConversationContextBriefingSection.tsx`

**Action:** Create

Implement the HLD's Context Sources and briefing-management UI for Two-Pass Conversation chats.

Render:

- the 15 sources in registry order;
- three-state role selection using server-returned roles;
- disabled `Always exclude` option for `recentExchange`;
- unavailable badge/reason and disabled selector for currently unavailable sources;
- Reset to defaults;
- View Context Briefing (read-only complete artifact);
- Reset Context Briefing.

A role mutation waits for the server response and then displays normalized state. If the server invalidates the briefing, the UI shows that the next Two-Pass turn will perform a full build.

No local editable copy of BRIEFING is persisted.

### `packages/client/src/components/chat/ChatSettingsDrawer.tsx`

**Action:** Modify

Wire the new classifier metadata setting and `ConversationContextBriefingSection` into Conversation settings.

Show the new section only when the active chat is Conversation mode and `conversationGenerationPipeline === "two_pass"`.

Continue using the existing metadata mutation path for ordinary prompt/connection settings; source roles and briefing reset use the dedicated hooks above.

### `packages/client/src/components/chat/PeekPromptModal.tsx`

**Action:** Modify

Extend `GenerationInfo`/`twoPass` display typing and rendering for CR037 diagnostics.

Show separate collapsible blocks for classifier, turn delta, prior briefing/revision, injected SOURCES, batched source request/results, curation update, final artifact and writer request as applicable. Fast path must clearly show that no Agent Curated batch ran; forced-full must clearly show that no classifier ran.

Keep exact writer prompt display and token estimates. The briefing remains diagnostic UI only and never appears in the chat transcript.

### `packages/client/src/localization/locales/en.json`

**Action:** Modify

Add English UI strings for the classifier connection, Context Sources roles, source names/descriptions, unavailable state, briefing inspection/reset and fast/full/forced-full diagnostics.

Other locale files may continue to fall back to English under the existing partial-locale system; do not duplicate untranslated English into every locale.

### `scripts/regressions/conversation-two-pass.regression.ts`

**Action:** Modify

Replace CR032 source-snapshot assertions with focused CR037 contract coverage.

Cover at minimum:

- source role defaults/normalization and `recentExchange` exclusion guard;
- host-owned SOURCES immutability/artifact assembly;
- classifier JSON parsing and failure-to-full fallback;
- batched request rejection of excluded/unavailable/unregistered keys;
- fast path omits Agent Curated retrieval;
- first use/reset/day change/source invalidation require a full build;
- contribution tracking and source-role invalidation;
- writer isolation: no raw Agent Curated result bypasses the artifact;
- shared briefing object/revision can be reused for multiple group writer requests;
- Standard pipeline setting remains unaffected.

Retain the existing `regression:conversation-two-pass` package script; no `package.json` change is required.

---

## 3. Cross-File Dependencies

- `types/chat.ts` defines the source keys/roles/state used by server registry, API and client. Source keys must not be redeclared independently elsewhere.
- `conversation-context-sources.ts` is the single source of availability and retrieval behavior. Both the generation orchestrator and Conversation settings endpoint consume it.
- `conversation-context-briefing-state.ts` is the single owner of artifact assembly, validity and the CR037 per-chat turn lock. Generation and role/reset API mutations use the same lock.
- `conversation-two-pass-orchestrator.ts` is the only component that decides fast/full/forced-full execution and writes a new briefing revision.
- `generate.routes.ts` must invoke the orchestrator before the individual/merged responder branches split; moving it back inside `generateForCharacter()` would violate the shared-group-briefing requirement.
- `conversation-two-pass-runtime.ts` builds/parses model requests but does not retrieve sources or persist state.
- `chats.storage.ts` requires no modification: the existing `patchMetadata()` queue and opaque metadata persistence are reused.
- Existing memory, Daily Memory, Daily Intentions, lorebook, cross-chat awareness and Character Mind services remain authoritative stores/readers. CR037 wraps them read-only; it does not change their persisted formats.
- Export/import, backup/restore and duplication require no bespoke CR037 storage path because the artifact, lifecycle metadata and role map are chat metadata.

---

## 4. File Change Summary

| File | Action | Purpose |
|---|---|---|
| `packages/shared/src/types/chat.ts` | Modify | CR037 source-role, state and API contracts |
| `packages/shared/src/constants/conversation-prompt.ts` | Modify | Classifier/stateful curator/writer default prompts |
| `packages/server/src/services/generation/conversation-context-briefing-state.ts` | Create | Persistent artifact lifecycle, invalidation and turn lock |
| `packages/server/src/services/generation/conversation-context-sources.ts` | Create | Closed 15-source registry, availability and batched reads |
| `packages/server/src/routes/generate/conversation-two-pass-runtime.ts` | Modify | CR037 LLM request/parsing and isolated writer helpers |
| `packages/server/src/routes/generate/conversation-two-pass-orchestrator.ts` | Create | Once-per-turn fast/full/forced-full curation state machine |
| `packages/server/src/routes/generate/conversation-history-runtime.ts` | Modify | Fixed/curated recent-exchange resolver with attachments |
| `packages/server/src/routes/generate/roleplay-context-sources.ts` | Modify | Structured bounded source-chat reader for `roleplayScenes` |
| `packages/server/src/routes/generate.routes.ts` | Modify | Replace CR032 curator and reuse one briefing across responders |
| `packages/server/src/routes/conversation.routes.ts` | Modify | Source status/role/reset briefing API |
| `packages/server/src/routes/chats.routes.ts` | Modify | CR037 Peek Prompt/cached diagnostics |
| `packages/client/src/hooks/use-chats.ts` | Modify | Query/mutations for briefing and source policy |
| `packages/client/src/features/chat-settings/sections/ConversationPromptSection.tsx` | Modify | Fast-path connection and CR037 wording |
| `packages/client/src/features/chat-settings/sections/ConversationContextBriefingSection.tsx` | Create | Context Sources, view and reset UI |
| `packages/client/src/components/chat/ChatSettingsDrawer.tsx` | Modify | Wire CR037 settings UI |
| `packages/client/src/components/chat/PeekPromptModal.tsx` | Modify | Render stateful curation diagnostics |
| `packages/client/src/localization/locales/en.json` | Modify | New CR037 UI strings |
| `scripts/regressions/conversation-two-pass.regression.ts` | Modify | CR037 source/state/isolation regression contracts |
