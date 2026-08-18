# CR037 — Stateful Two-Pass Context Briefing

## Status

Draft HLD for review.

Depends on the existing Two-Pass Conversation generation pipeline introduced in **CR032**. This CR evolves that pipeline from a stateless per-turn curator into a stateful, persistent context briefing maintained by a multi-shot curation agent.

## Problem

The current Two-Pass pipeline (CR032) produces a fresh Conversation Briefing on every turn. The curator starts with no memory of what it concluded in previous turns, so it must repeatedly reconstruct continuity, relevance, and focus from the same raw sources. This is inefficient and can be inconsistent across turns.

A persistent briefing would let the curator carry forward what it has already established, update only what changed, and decide which sources to consult rather than relying on fixed inclusion rules.

## Goals

- Add a **persistent context briefing** to each Conversation chat that uses Two-Pass generation.
- Update the briefing **on every user message** via a multi-shot curation agent.
- Use **batched source-tool calls** so the agent requests all relevant sources in one round and receives a single combined result.
- Support a **fast path** for routine turns that avoids expensive source calls.
- Keep the persistent briefing as the **sole context artifact** passed to the response writer.
- Preserve the existing Two-Pass isolation boundary: the writer receives only the briefing and its own system prompt.
- Make human inspection and reset optional, not mandatory per change.
- Survive server restart, chat duplication, export/import, and backup/restore.

## Non-goals

- Extending this to Standard, Roleplay, Visual Novel, or Game generation.
- Writing back to memories, summaries, lorebooks, Character Mind, or any other real store.
- Adding a separate persistent context layer distinct from the briefing.
- Requiring per-change user approval.
- Defining a fixed application-owned ontology or schema for the briefing.
- Replacing existing retrieval systems for Standard generation.

## Core Concept: The Persistent Briefing

There is one artifact per chat, stored in chat metadata. It serves as both the curator's working memory and the writer's isolated context.

Suggested structure (prompt-owned, not hard-coded):

```markdown
# Conversation Context Briefing

## Current Situation
A concise description of the immediate situation.

## Active Threads
- Thread label: brief description, status, priority
- ...

## Key Facts
- Fact (source type, confidence: direct / summarized / inferred)
- ...

## Relationship State
How the character understands the relationship with the persona right now.

## Emotional State
Current mood, underlying tension, recent shifts.

## Recent Exchange
Verbatim recent messages needed for tone and continuity.

## Relevant External Context
References to memories, scenes, awareness chats, lore, etc., with source labels.

## Last Updated
Turn N, message ID, trigger classification, tools called.
```

Application code validates only size bounds, non-emptiness, and stable section markers if needed for UI rendering.

## Update Workflow

On every user message in a Two-Pass chat:

1. Load the previous briefing from chat metadata (or create an empty shell on first use).
2. Build the turn delta: new user message, previous assistant response, and generation metadata.
3. Run the curation agent:
   - Fast-path assessment.
   - If needed, issue a single batched source-tool request.
   - Update the briefing.
4. Persist the updated briefing to chat metadata.
5. Pass the updated briefing to the response writer.

The curation agent is multi-shot with tool support:

- **Shot 1**: assess the turn and decide which sources to query.
- **Shot 2**: receive batched source results and update the briefing.

No third rewrite pass.

## Batched Source Tools

The agent does not call tools one at a time. It emits a single structured request listing which sources it wants, and the host returns a combined, delimited result block.

### Example tool request

```json
{
  "query": {
    "memories": { "search": "user's sister, family", "limit": 5 },
    "dailyMemories": { "include": true },
    "dailyIntentions": { "include": true },
    "summaries": { "range": "last_14_days" },
    "awarenessChats": { "search": "Alice", "limit": 3 },
    "roleplayScenes": { "search": "lake scene", "limit": 2 },
    "lorebook": { "search": "prophecy", "limit": 3 },
    "characterMind": { "query": "prophecy", "limit": 3 }
  },
  "reason": "User asked about a prior scene and a lore topic."
}
```

### Host response format

```markdown
## Source Results

### Memories
[ ranked results with source text and relevance ]

### Daily Memories
[ current day's memories ]

### Daily Intentions
[ current intentions ]

### Summaries
[ requested summaries ]

### Awareness Chats
[ summaries/recent messages from Alice-related chats ]

### Roleplay Scenes
[ lake scene summary ]

### Lorebook
[ prophecy entries ]

### Character Mind
[ wiki pages about prophecy ]
```

The host runs all requested lookups in parallel. The agent receives the combined block and updates the briefing in one shot.

## Fast Path

A lightweight first prompt classifies the turn and decides whether full source consultation is needed.

### Fast-path triggers

The fast path runs when the turn is assessed as a **routine continuation**. Indicators include:

- Short generic message with no new entities, questions, or references.
- No unresolved threads from the previous briefing.
- No notable emotional or situational shift.
- No explicit references to past sources.

### Fast-path behavior

- Skip batched tool calls.
- Update only:
  - Recent Exchange
  - Latest Message / Trigger
  - Emotional State if sentiment clearly shifted
  - Last Updated metadata
- Do not rewrite Key Facts, Active Threads, Relationship State, or External Context sections.

### Implementation

The fast-path classifier can be a small, fast model or the same curator model with a very tight output instruction. Example output:

```json
{
  "fastPath": true,
  "reason": "routine greeting",
  "sectionsToUpdate": ["recentExchange", "latestMessage"]
}
```

If `fastPath` is false, the agent proceeds to select sources and call the batched tool.

## Persistence

- The briefing is stored in **chat metadata**.
- It survives server restart.
- It is included in chat duplication, export/import, and full backup/restore.
- If the chat is switched back to Standard generation, the briefing is retained but not updated.
- If Two-Pass is re-enabled, the existing briefing is reused.
- A user-facing **Reset Context Briefing** action clears the briefing; the next message starts from a blank shell.

## UI / Human Visibility

Human interaction is **optional on request**, not gated per change:

- A new action in Chat Settings or the message menu: **View Context Briefing**.
- Read-only panel showing the current briefing.
- A **Reset** button to clear it.
- Optionally a **Regenerate Briefing** action if the user thinks it has drifted.
- Generation metadata records whether the fast path or full path ran, and which tools were batched.

## Integration with Two-Pass Pipeline

```text
[Existing shared context resolution]
              |
              v
[Load persistent briefing from chat metadata]
              |
              v
[Curation Agent]
   |-- Fast path --> lightly update briefing
   |-- Full path --> select sources --> batch tool call --> update briefing
              |
              v
[Persist updated briefing]
              |
              v
[Writer receives updated briefing + writer system prompt]
              |
              v
[Existing shared response lifecycle]
```

The existing CR032 isolation boundary is preserved:

- The writer still receives only the briefing and the writer system prompt.
- The briefing is never rendered in the chat transcript.
- The response writer does not access raw cards, persona data, summaries, memories, lore, or awareness directly.

## Boundaries and Invariants

| Invariant | Rule |
|---|---|
| Single artifact | The persistent briefing is the only durable context object. |
| Writer isolation | The writer sees only the briefing and its system prompt. |
| No write-back | The agent may only update the briefing, not memories/summaries/lore/etc. |
| Two-pass only | Standard generation does not use or update the briefing. |
| Batched reads | All source-tool calls for a turn are requested and returned in one round trip. |
| Fast path | Routine turns skip external source calls. |
| Optional inspection | The user may view or reset the briefing, but does not approve each update. |
| Bounded size | The briefing is capped by token/character budget; overflows are summarized in place. |

## Risks

| Risk | Mitigation |
|---|---|
| **Briefing drift** | Provide visible reset and optional regenerate; consider periodic full rebuild from sources. |
| **Briefing bloat** | Hard size cap; in-place summarization when sections grow. |
| **Latency** | Fast path for routine turns; batched tool calls run in parallel. |
| **Cost** | Fast path reduces model calls; full path replaces many fixed retrievals with targeted ones. |
| **Tool hallucination** | Tool results are explicit and bounded; agent cannot fabricate source outputs. |
| **Concurrency / group chats** | Per-character briefing variant may be needed for groups. |
| **Regeneration** | Regenerating a response should not re-trigger briefing update unless the response changes materially. |
| **Export privacy** | The briefing may contain sensitive summaries; treat it like debug metadata and persisted chat data. |

## Open Questions

1. **Per-character briefing in group chats?** In a multi-character Conversation, do all characters share one briefing, or does each responding character have their own?
2. **Periodic full rebuild?** Should the system occasionally rebuild the briefing from primary sources (e.g., every N turns or on reset) to limit drift?
3. **Fast-path trigger implementation?** Should the classifier be a cheap dedicated model/prompt, or the same curator with constrained output?
4. **Tool set initial scope?** Which sources are in the first batched tool set? All existing ones, or a subset?
5. **Conflict with CR032 shipped implementation?** Does this replace the CR032 curator entirely, or coexist as an optional enhanced mode?

## Acceptance Criteria

- Two-Pass chats store and load a persistent context briefing.
- The curation agent updates the briefing on each user message.
- Routine turns use a fast path that skips batched source calls.
- Non-routine turns issue a single batched source request and receive a single combined result.
- The writer receives only the updated briefing and its system prompt.
- Standard generation is unaffected.
- The briefing survives restart, duplication, export/import, and backup/restore.
- The user can view and reset the briefing on request.
- No changes are written back to memories, summaries, lorebooks, or other stores.
