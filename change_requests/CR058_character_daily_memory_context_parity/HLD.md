# CR058 - Character Daily Memory Context Parity

_Status: Approved; implementation pending._

## 1. Goal

Make eligible character-owned Daily Memories available automatically in both
Conversation and Roleplay generation while preserving the existing
`search_character_daily_memories` tool for explicit model retrieval.

## 2. Scope and non-goals

This CR covers the host-managed retrieval and transient prompt-context
injection boundary for ordinary Conversation and Roleplay generation, plus
the compatibility checks needed to ensure the existing memory tool remains
available to callers that expose it.

It does not redesign Character Daily Memory formation, persistence, ranking,
embedding behavior, Memories-tab maintenance, Character Briefing behavior,
generic memory recall, or the existing tool contract. It does not add a new
client setting, schema field, or Roleplay-specific opt-in.

## 3. Base and branch intent

- Application base: local `main`, including CR042 character-owned Daily
  Memories, CR047 shared retrieval policy, and CR057 Roleplay retrieval.
- Planned application branch: `change/CR058-character-daily-memory-context-parity`.
- Parent CR documentation remains in this repository; implementation must use
  a dedicated nested application worktree.

## 4. Current behavior

CR042 defines character-owned Daily Memories and CR047 standardizes their
retrieval policy for Preview, the Chat custom tool, and Character Briefing.
CR057 adds host-managed retrieval for ordinary single-character Roleplay.
Conversation generation currently does not automatically inject Character
Daily Memories after CR047's correction, although supported callers can still
expose the explicit `search_character_daily_memories` tool.

## 5. Proposed solution

Extend the shared host-managed generation-context integration so eligible
Character Daily Memories are retrieved and injected once for both ordinary
Conversation and Roleplay requests. Reuse CR047's character ownership,
authorization, settings, ranking, threshold, embedding, and result-limit
policy. Preserve the established Roleplay target/query rules and define the
corresponding Conversation target/query inputs during planning.

The results remain transient, clearly delimited untrusted reference data at
the approved prompt boundary. They must not be persisted as chat messages or
shown as conversation content. Empty, disabled, unavailable, mismatched, or
failed retrieval is a silent no-op that does not block an otherwise valid
generation. Shared context assembly must prevent duplicate insertion when a
mode-specific path and the common path meet.

The existing `search_character_daily_memories` tool remains available through
its current supported Chat, Character Briefing, and other configured tool
paths. Automatic injection must not remove the tool, expose unrelated tools,
or change generic Tool Use behavior; a model may still perform an explicit
follow-up search when the tool is offered.

## 6. Invariants and boundaries

- CR042 character ownership and CR047 retrieval policy remain authoritative.
- Both Conversation and Roleplay receive at most one automatic memory block
  per generation, scoped to the applicable character(s) under their approved
  target policy.
- Character Daily Memories remain distinct from summaries, session memories,
  generic memory recall, and `extensions.characterMemories`.
- Existing cards, summaries, trackers, emotions, recent dialogue, scene/source
  context, and other prompt sources retain their behavior and ordering except
  for the approved additive memory block.
- Explicit memory-tool availability and caller-specific query construction
  remain intact; no unrelated tools are exposed as a side effect.
- Retrieval failures and no-result cases preserve response generation.

## 7. Risks

- **Duplicate context:** combining common and mode-specific adapters could
  inject the same memories twice; centralize or mark the insertion boundary.
- **Prompt growth:** automatic retrieval adds tokens to qualifying requests;
  retain the existing bounded CR047 policy and document the resulting prompt
  placement.
- **Attribution leakage:** Conversation and Roleplay target resolution differ;
  planning must preserve character ownership and the existing multi-character
  safety policy.
- **Tool compatibility:** automatic context must coexist with explicit tool
  calls without removing the tool or enabling unrelated generic tools.
- **Failure coupling:** retrieval or embedding errors must not prevent normal
  generation in either mode.

## 8. Validation

- Add focused Conversation and Roleplay regressions proving automatic
  injection for enabled characters with eligible memories and no injection for
  disabled, empty, or failed retrieval cases.
- Prove the memory block is inserted once at the approved prompt boundary and
  existing context sources remain present.
- Cover Conversation and Roleplay character targeting, including the approved
  multi-character behavior and cross-character isolation.
- Verify `search_character_daily_memories` remains exposed and callable in its
  supported tool paths, with no unrelated tool exposure or changed generic
  Tool Use behavior.
- Run focused server/shared regressions, changed-surface typecheck/lint,
  `git diff --check`, and the proportionate repository check/build selected by
  validation. No database or release checks are expected.
- Because this is behavior-bearing, decide during validation whether focused
  Playwright E2E coverage is required.

## 9. Acceptance criteria

- Eligible Character Daily Memories are automatically available to the model
  in both ordinary Conversation and Roleplay generation.
- Automatic retrieval follows the CR047 policy and the approved per-mode
  target/query rules, with no cross-character leakage or duplicate block.
- The existing `search_character_daily_memories` tool remains available where
  currently supported and can still be used for explicit retrieval.
- No-result and failure paths do not block generation, and unrelated context,
  tools, persistence, and settings remain unchanged.
- Focused regressions and integrity checks provide evidence for both modes,
  tool compatibility, gating, isolation, and failure behavior.
