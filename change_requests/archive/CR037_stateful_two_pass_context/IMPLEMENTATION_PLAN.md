# Implementation Plan: CR037 — Stateful Two-Pass Context Briefing

## 1. Implementation Summary

Implement CR037 by replacing the existing CR032 stateless Conversation curator with a stateful Two-Pass curation flow while preserving the existing writer-isolation boundary and leaving Standard Conversation generation unchanged.

The implementation will:

- add typed per-chat briefing state and per-source role configuration;
- replace CR032's broad prepared-prompt snapshot as the curator input with the explicit CR037 source registry;
- introduce source adapters for Always Include and Agent Curated sources;
- add briefing lifecycle handling for persistence, invalidation, reset, and daily rebuild;
- add the fast-path classifier and batched curated-source retrieval flow;
- update the existing Two-Pass orchestration so curation runs once per user turn and the resulting shared briefing is reused by all group responders;
- expose source controls, briefing inspection/reset, connection selection, and diagnostics in the existing Conversation settings/debug surfaces.

A separate Low-Level Design is required before development because the HLD is settled but several repository-specific contracts still need file-level design.

---

## 2. HLD Reference

The implementation is constrained by these approved CR037 decisions:

- The persistent context artifact contains two structural sections: immutable **SOURCES** and agent-maintained **BRIEFING**.
- CR037 uses the HLD's explicit closed source registry; it does not automatically inherit every prompt input visible to CR032.
- Each source has one role: **Always include**, **Agent curated**, or **Always exclude**. `recentExchange` cannot be excluded.
- Always Include sources are resolved by the host and injected verbatim into SOURCES. Agent Curated sources are available only through one batched retrieval request. Always Exclude sources are neither resolved nor exposed.
- A valid existing BRIEFING may take the fast path. First use, reset, daily rebuild, and source invalidation must force a full build.
- Excluding or losing availability of a source that previously contributed to BRIEFING invalidates the briefing; stale derived content must not reach the writer.
- The writer receives only the complete briefing artifact plus its writer system prompt and existing host technical contracts.
- Group chats intentionally share one briefing across all participating/responding characters.
- CR037 replaces the CR032 stateless curator within Two-Pass mode; it does not add a separate Stateless/Stateful selector.
- Standard Conversation generation remains unchanged.

---

## 3. Repository Assessment

Repository inspection confirms that CR037 can evolve the current Two-Pass boundary rather than creating a parallel generation pipeline.

- `packages/server/src/routes/generate/conversation-two-pass-runtime.ts` currently contains the small CR032 boundary helpers: creation of a snapshot from the fully prepared provider prompt, construction of the curator request, normalization of the returned briefing, construction of the isolated writer request, and prompt hashing. The writer helper and isolation pattern are reusable; the broad source-snapshot and stateless curator-input helpers will need to be replaced or substantially refactored.
- `packages/server/src/routes/generate.routes.ts` remains the orchestration point where Conversation context, memories, lore, agents, group-response behaviour, model connections, writer contracts, diagnostics, and provider calls converge. CR037 should keep the integration at this boundary but move stateful briefing/source responsibilities into focused helpers/services rather than expanding the route with another large inline subsystem.
- Existing Conversation source data is already produced by Marinara, but it is currently assembled through several specialised services and route helpers. CR037 therefore needs adapters over existing retrieval behaviour rather than a second implementation of memories, summaries, lore, awareness, Character Mind, etc.
- Chat metadata is already used for Conversation settings and persisted generation state. The HLD's briefing and role map can therefore use the existing metadata lifecycle rather than requiring a separate database entity, while still adding typed normalization and versioning around the CR037 fields.
- Existing per-message generation diagnostics already capture Two-Pass information. CR037 can extend this mechanism to record fast/full/forced-full path decisions, source usage, and briefing state without exposing the briefing in the visible transcript.
- Group Conversation generation can produce more than one character response for one user turn. CR037 must curate and persist the shared briefing once for the user turn, then reuse that same artifact for every responder in that turn; curation must not run independently per character.

No material repository conflict with the HLD was identified. The main implementation risk is defining clean internal contracts around functionality that is currently distributed across the generation route and supporting services.

---

## 4. Implementation Approach

### 4.1 Shared contracts and briefing lifecycle

Add shared types and normalization for:

- the closed CR037 source-key set;
- source roles and HLD defaults;
- classifier and curator connection selection;
- persisted briefing state;
- enough lifecycle metadata to determine whether the current BRIEFING is valid and whether a full build is required.

Keep the BRIEFING's semantic headings prompt-owned as required by the HLD; application state should track lifecycle/integrity information rather than hard-coding the briefing ontology.

The lifecycle layer must support:

- initial creation from no prior briefing;
- loading a valid briefing across turns and server restarts;
- manual reset;
- daily rebuild using Marinara's existing Conversation time-zone/logical-day handling;
- invalidation when a previously contributing source becomes Always Exclude or unavailable;
- retention/restoration of a configured source role while that source is unavailable.

The exact persisted metadata shape, version/fingerprint strategy, and atomic update rules should be finalised in the LLD.

### 4.2 Explicit source registry and adapters

Introduce a central CR037 source registry keyed by the 15 HLD source identifiers. The registry should provide the implementation seam for:

- availability detection;
- Always Include resolution;
- Agent Curated retrieval/query handling;
- result bounding and attribution;
- attachment propagation where applicable.

Source adapters should reuse existing Marinara retrieval/resolution code and return source-specific data through a common CR037 contract. They must not alter Standard generation behaviour or write back to the underlying stores.

Role enforcement occurs before retrieval:

- **Always include**: resolve every turn and place in immutable SOURCES blocks;
- **Agent curated**: register for the batched curator request only;
- **Always exclude**: do not resolve and do not expose to the curator.

The current CR032 `createConversationSourceSnapshot()` behaviour must no longer define the curator's source universe because it includes context outside the approved CR037 registry.

### 4.3 Stateful curation orchestration

Build a focused stateful Two-Pass orchestration layer around the existing generation boundary.

For each new Conversation user turn:

1. Load and normalize the role map and persisted briefing state.
2. Re-evaluate source availability and determine whether the prior BRIEFING is valid.
3. Apply daily/reset/source invalidation rules and mark a forced full build when required.
4. Resolve current Always Include sources and construct the immutable SOURCES section.
5. Build the turn delta from the new user turn, previous assistant turn, and relevant generation metadata.
6. If a valid prior BRIEFING exists, invoke the dedicated fast-path classifier and consume exactly `{ fastPath, reason }`.
7. If fast path is selected, skip curated-source retrieval and update only the HLD-permitted BRIEFING sections.
8. Otherwise perform one batched request across the Agent Curated registry entries requested by the curator, execute those reads in parallel, and provide one combined source-result response to the curator.
9. Update the BRIEFING from the valid prior state or, for a forced full build, from an empty shell without retaining invalidated text.
10. Persist the complete SOURCES + BRIEFING artifact before it is handed to the writer.

The implementation should preserve the HLD's two-shot full-path contract and must not introduce a hidden third curation pass.

Failure handling must preserve the isolation boundary: a curator/source failure must not silently fall back to sending the broad CR032 prepared prompt to the writer. Exact recoverable/fatal behaviour belongs in the LLD.

### 4.4 Writer and group-generation integration

Retain the existing isolated writer construction where possible. The writer request should continue to contain:

- writer system prompt;
- existing host-owned technical contracts that CR032 already keeps outside the briefing;
- one user-role `<conversation_briefing>` payload containing the complete CR037 artifact.

No source adapter, prepared prompt block, memory, lore result, or awareness data may bypass the briefing boundary into the writer request.

For group Conversations, curation is a **turn-level** operation rather than a responder-level operation. Build/persist one shared briefing before the responder loop and reuse it unchanged as the context artifact for every character response generated from that user turn. Character-specific writer instructions that are already host-owned may continue to be applied outside the briefing where required by the existing group-generation contract.

### 4.5 Conversation settings and briefing inspection

Extend the existing Conversation settings UI with:

- Context Sources panel with the three-state role selector;
- unavailable-source indication while preserving the stored role;
- disabled Always Exclude option for `recentExchange`;
- reset-to-default source roles;
- classifier connection selection;
- curator connection selection;
- View Context Briefing;
- Reset Context Briefing.

Changing a role in a way that invalidates the current briefing should update the persisted lifecycle state immediately so the next Two-Pass turn is guaranteed to rebuild before the writer runs.

The briefing inspection surface remains informational/read-only to the user for this CR; reset/regenerate controls are the supported correction mechanisms.

### 4.6 Diagnostics and persistence integration

Extend existing generation/debug metadata to record enough information to understand each CR037 turn without exposing internal context in the transcript, including:

- fast, full, or forced-full path;
- classifier reason where applicable;
- Agent Curated sources requested and returned;
- Always Include sources injected;
- selected classifier/curator connection;
- relevant briefing/input hashes or lifecycle version information.

Ensure the CR037 metadata participates correctly in existing chat duplication, export/import, backup/restore, and metadata patch/update flows.

---

## 5. Implementation Sequence

1. **Define shared CR037 contracts and defaults.** Establish source keys/roles, persisted briefing lifecycle types, connection settings, and normalization before server/client code depends on them.
2. **Implement briefing lifecycle and invalidation.** Provide a testable state layer for load, reset, daily rebuild, source invalidation, and full-build eligibility.
3. **Implement the source registry and adapters.** Map the approved HLD source keys onto existing Marinara retrieval/resolution behaviour and define the common batched-read seam.
4. **Implement classifier and curator orchestration.** Add fast/full/forced-full execution using the source registry and persisted briefing state.
5. **Integrate with the existing Two-Pass generation boundary.** Replace the CR032 stateless snapshot curator while preserving writer isolation, technical contracts, Standard behaviour, and turn-level sharing for group generation.
6. **Add settings, inspection, and reset UI.** Bind the source role map and connection selection to chat metadata and expose briefing lifecycle controls.
7. **Extend diagnostics and persistence paths.** Add turn metadata/debug visibility and verify duplication/export/import/backup behaviour.
8. **Add focused regression coverage and documentation.** Complete development integrity checks and hand the implementation to the separate validation stage.

The source registry and lifecycle contracts should be established before generation-route integration; otherwise the route would become the de facto design location for unresolved state/source behaviour.

---

## 6. Development Integrity Checks

During development, run the repository's relevant integrity checks before separate validation:

- focused unit/integration tests for the modified server/shared/client areas;
- TypeScript/type checking through the repository's standard check command;
- lint/format checks included by the repository tooling;
- `cd Marinara-Engine && pnpm check` once after the implementation is integrated;
- production build from the primary checkout after integration, before manual UAT.

Do not run unrelated exhaustive suites repeatedly during implementation when focused tests provide the necessary feedback.

---

## 7. Validation Requirements

### Unit Validation

Validation must prove at minimum:

- source-role normalization and defaults match the HLD;
- `recentExchange` cannot become Always Exclude;
- unavailable sources retain their configured role;
- first use, reset, daily rebuild, source exclusion, and source unavailability correctly force a full build;
- invalidated briefing content is not carried into the rebuilt BRIEFING;
- fast path is available only with a valid prior BRIEFING;
- classifier output is constrained to `{ fastPath, reason }`;
- only Agent Curated sources can be requested through the batch interface;
- Always Include sources are injected into immutable SOURCES blocks;
- Always Exclude sources are never resolved;
- batched source reads are bounded and attributed;
- writer construction cannot include raw CR037 source inputs outside the briefing artifact.

### End-to-End Validation

Validation should cover representative user flows:

- enable/use Two-Pass and observe the first turn performing a full briefing build;
- send a routine continuation and observe a fast-path update without curated-source reads;
- send a context-heavy turn and observe one full batched-source path;
- change a contributing source to Always Exclude and confirm the next turn rebuilds without stale information from that source;
- make a source unavailable and confirm role retention plus briefing invalidation/rebuild;
- reset the briefing and confirm the next turn performs a full build;
- cross the configured daily boundary and confirm the first subsequent message performs a full rebuild;
- configure source roles and classifier/curator connections through Conversation settings;
- inspect the current briefing and generation diagnostics;
- use a multi-character Conversation and confirm one shared briefing is curated once per user turn and reused for all responders.

### Other Relevant Validation

- Standard Conversation generation remains behaviourally unchanged.
- CR037 replaces the CR032 stateless curator; no duplicate stateless/stateful selector is introduced.
- restart, duplication, export/import, and backup/restore retain the briefing and role map.
- no CR037 operation writes back to memories, summaries, lorebooks, Character Mind, or other source stores.
- the writer never receives context outside the approved briefing/system-contract boundary.
- focused Playwright coverage should be considered during validation for the settings/reset/inspection flows, following the existing Marinara E2E practice.

---

## 8. Open Implementation Questions

No HLD-level design questions remain. The following repository-specific choices should be resolved in the LLD before development:

- What exact shared metadata shape/version/fingerprint should represent briefing validity, source contribution, and daily rebuild state?
- Which existing Marinara function/service is the canonical adapter point for each of the 15 source keys, and what bounded query/result shape should each expose to the batch contract?
- What exact request/response contracts and failure semantics should be used for the fast-path classifier and the two-shot curator flow?
- How should turn-level briefing writes be serialized or guarded so simultaneous/autonomous/group generation cannot overwrite a newer shared briefing state?
- Which responsibilities should move out of `generate.routes.ts` into dedicated CR037 modules so the route remains orchestration rather than source/state implementation?

---

## 9. Low-Level Design Decision

**LLD required: Yes**

### Rationale

CR037 spans shared metadata, Conversation source resolution, LLM orchestration, persistent state, the central generation route, group-generation behaviour, client settings, diagnostics, and tests. The HLD establishes the product architecture, but safe implementation still depends on several tightly coupled repository-specific decisions.

The LLD should resolve, at minimum:

- concrete file/module ownership and any extraction required from `generate.routes.ts`;
- persisted briefing/role-map types, versioning, validity/invalidation, and atomic update semantics;
- the adapter mapping for every approved source key and the common batch request/result contracts;
- classifier and curator prompts/protocols, structured parsing, limits, and failure handling;
- exact once-per-user-turn integration for shared group briefings;
- writer-isolation enforcement and diagnostic/test seams;
- detailed client component/state changes for source controls, inspection, reset, and connection selection.

Without this LLD, development would require designing important internal contracts while editing the central generation path, creating unnecessary regression risk.

---

## 10. Implementation Checklist

- [ ] Define CR037 shared source-role, settings, and persisted briefing lifecycle contracts
- [ ] Implement briefing load/reset/daily rebuild/source-invalidation handling
- [ ] Implement the closed source registry and adapters over existing Marinara retrieval logic
- [ ] Implement fast-path classifier and full batched-source curator flow
- [ ] Replace CR032 stateless curator integration while preserving writer isolation and Standard behaviour
- [ ] Ensure one shared briefing is curated once per group user turn
- [ ] Add Conversation settings, briefing inspection, and reset controls
- [ ] Extend diagnostics and persistence/export paths
- [ ] Add focused regression coverage and documentation
- [ ] Complete relevant development integrity checks
- [ ] Complete implementation summary for hand-off to validation
