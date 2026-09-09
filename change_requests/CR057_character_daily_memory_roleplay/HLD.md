# CR057 - Character Daily Memory Retrieval in Roleplay Sessions

_Status: Draft; planning required._

## 1. Goal

Make the existing character-owned Daily Memories retrieval capability useful
in ordinary Roleplay sessions, where generic user-facing Tool Use is normally
disabled and a model therefore cannot be expected to invoke the existing
`search_character_daily_memories` tool.

The change should preserve the CR042 character-owned memory corpus and the
CR047 shared retrieval policy while defining a reliable Roleplay integration
that does not require users to enable unrelated tools.

## 2. Scope and non-goals

This CR covers retrieval of eligible Character Daily Memories during normal
Roleplay generation, construction of the Roleplay query/context used for that
retrieval, and the prompt or tool boundary needed to make the results available
to the responding model.

It includes the settings, feature-gating, character-targeting, empty/failure
behavior, and focused regression coverage needed for that integration.

It does not redesign Daily Memory formation, persistence, ranking weights,
embedding behavior, Memories-tab maintenance, Character Briefing retrieval,
generic memory recall, or the existing Chat custom-tool contract. It must not
silently expose unrelated tools or change the meaning of user-configured
Roleplay Tool Use.

## 3. Base and branch intent

- Application base: local `main`, including CR042 Character Daily Memories and
  CR047 Consistent Character Daily Memory Tool Retrieval.
- Planned application branch: `change/CR057-character-daily-memory-roleplay`.
- Parent CR documentation remains in this repository; implementation must use
  a dedicated nested application worktree.

## 4. Current behavior and design question

Character Daily Memories are character-owned and can be retrieved through the
shared deterministic retrieval service. Existing Chat and Character Briefing
adapters expose `search_character_daily_memories` as a model-invoked tool.
Ordinary Roleplay sessions generally do not enable the generic tool loop, so
those sessions currently receive no Daily Memory retrieval unless a separate
caller path is activated.

The exact Roleplay behavior is intentionally unresolved for planning. The
design must decide whether Roleplay should:

1. perform host-managed retrieval before the normal response request and add a
   clearly delimited Daily Memories context block;
2. register a Roleplay-specific memory tool in an internal, bounded tool loop
   without enabling unrelated tools or requiring the user-facing Tool Use
   setting; or
3. offer an explicit per-character/session opt-in that chooses between those
   behaviors.

The likely default direction is host-managed retrieval because it works in the
normal session path and keeps model tool invocation optional, but this is a
planning recommendation rather than an approved implementation contract.

## 5. Proposed solution direction

During planning, trace Roleplay target resolution, current-turn message
availability, prompt assembly, and any existing internal tool-loop seam. Select
one bounded integration point that calls the CR047 retrieval service with the
same character-owned corpus, persisted ranking policy, embedding-space checks,
threshold behavior, and safe degradation already used by other callers.

The selected design must define how the query is built from Roleplay context,
where retrieved memories are placed or returned, and how the model is told
that the content is reference context rather than dialogue. It must preserve
existing Roleplay cards, summaries, session memories, scene/source context,
trackers, emotions, and other prompt sources.

The design must also explicitly decide whether retrieval applies to one
responding character or every eligible character in a multi-character
Roleplay. If multiple characters are supported, each character's results must
be independently scoped, deterministically ordered, labelled, and emitted at
most once. If the feature remains single-target, non-target group members must
be excluded and the limitation must be visible in the settings/documentation.

## 6. Invariants and boundaries

- CR042 character ownership and CR047 retrieval policy remain authoritative.
- Normal Roleplay generation must not depend on the user enabling generic Tool
  Use unless that is an explicit final design choice.
- No unrelated built-in or custom tools become available as a side effect.
- Disabled characters, missing settings, empty corpora/queries, unavailable or
  mismatched embeddings, and retrieval errors degrade without blocking an
  otherwise valid Roleplay response.
- Daily Memories remain distinct from generic memory recall, summaries, and
  legacy `extensions.characterMemories` session summaries.
- Existing Conversation, Chat-tool, Preview, Briefing, and Roleplay context
  behavior outside the selected integration remains unchanged.

## 7. Risks

- **Prompt/token growth:** automatic insertion can increase every qualifying
  Roleplay request's context and may compete with character-card or recent
  dialogue content. Keep existing threshold/weights, avoid an unapproved hard
  result cap, and measure or document expected prompt growth.
- **Retrieval query quality:** Roleplay may expose different current-turn or
  speaker context than Conversation. An underspecified query can retrieve
  irrelevant memories or no memories at all.
- **Multi-character leakage:** retrieving one character's memories for another
  can change roleplay behavior or disclose private character context. Scope and
  attribution must be tested explicitly.
- **Tool-loop coupling:** enabling an internal memory tool may accidentally
  expose unrelated tools, add extra provider rounds, or change latency/error
  behavior in normal sessions.
- **Feature compatibility:** existing per-character settings and older records
  may lack any Roleplay-specific switch. Defaults, migration needs, and user
  control must be decided before implementation.
- **Prompt ordering:** placing memory context at the wrong boundary may make it
  look like user/character dialogue or weaken existing instructions.

## 8. Validation

- Add focused Roleplay generation/prompt regressions proving retrieval for an
  enabled character with eligible memories and no retrieval for a disabled or
  empty corpus.
- Cover the selected single- versus multi-character policy, including stable
  target attribution, duplicate suppression, and exclusion of non-target
  characters.
- Prove normal Roleplay works with generic Tool Use disabled and that unrelated
  tools are not exposed or invoked by the change.
- Cover empty queries, unavailable/mismatched embeddings, retrieval errors,
  and safe continuation of response generation.
- Assert the chosen prompt/tool boundary, ordering, delimiters, and bounded
  context behavior while retaining existing Roleplay sources.
- Confirm CR047 caller parity and existing Conversation/Chat/Briefing behavior
  remain unchanged through focused server checks; run proportionate typecheck,
  lint/regression checks, `git diff --check`, and the primary build when the
  implementation is ready. No schema or release checks are expected unless
  planning identifies a migration or release-surface change.
- Because this changes user-visible Roleplay behavior, agree during or after
  implementation whether focused Playwright E2E coverage is required.

## 9. Acceptance criteria

- A normal Roleplay session can use applicable Character Daily Memories without
  requiring unrelated generic Tool Use, according to the approved design.
- Retrieval uses the existing character-scoped CR047 policy and degrades safely
  when no result is available.
- The approved character-targeting policy is deterministic and prevents
  cross-character leakage or duplicate memory blocks.
- Prompt/tool integration is clearly bounded, does not expose unrelated tools,
  and preserves existing Roleplay and non-Roleplay behavior.
- Focused regressions and proportionate integrity checks provide evidence for
  the enabled, disabled, empty, failure, and multi-character cases selected in
  planning.
