# CR037 — Stateful Two-Pass Context Briefing

## Status

Draft HLD for review. Updated to add a complete **Context Sources** enumeration and **Per-Source Configuration** (per-source role: Always include / Agent curated / Always exclude).

Depends on the existing Two-Pass Conversation generation pipeline introduced in **CR032**. This CR evolves that pipeline from a stateless per-turn curator into a stateful, persistent context briefing maintained by a multi-shot curation agent.

## Problem

The current Two-Pass pipeline (CR032) produces a fresh Conversation Briefing on every turn. The curator starts with no memory of what it concluded in previous turns, so it must repeatedly reconstruct continuity, relevance, and focus from the same raw sources. This is inefficient and can be inconsistent across turns.

A persistent briefing would let the curator carry forward what it has already established, update only what changed, and decide which sources to consult rather than relying on fixed inclusion rules.

## Goals

- Add a **persistent context briefing** to each Conversation chat that uses Two-Pass generation.
- Provide a **complete, explicit enumeration of all context sources** and let the user assign each one a **role** that controls how it reaches the writer.
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
- Making per-source configuration apply to Standard generation; it governs only the Two-Pass stateful curation path.

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

## Context Sources

This is the complete, explicit enumeration of every context source the Two-Pass stateful pipeline can draw from. Each source is independently configurable (see **Per-Source Configuration** below). Sources not listed here are not part of this pipeline.

The enumeration is grouped by origin for clarity. Source identifiers are stable configuration keys; the human labels are for UI display only.

| Source key | Human label | Origin | What it provides |
|---|---|---|---|
| `characterCard` | Character Card | Card | The active character's card fields (description, personality, backstory, appearance, scenario, example dialogue, system prompt, post-history instructions). |
| `persona` | Persona | Card / chat | The active user persona identity and description. |
| `conversationStatus` | Conversation Status | Chat | The engine-resolved `{{context}}` / `{{status}}` block (current situation, scene framing). |
| `commands` | Commands | Chat | The `{{commands}}` command list and reminders available to the character. |
| `reactRules` | Emoji / React Rules | Chat | The `{{reactRules}}` custom-emoji and sticker reply rules. |
| `replyRules` | Reply Rules | Chat | The `{{replyRules}}` reply advertisement rules. |
| `memories` | Character Memories | Memory store | Ranked recall from the character's long-term memory store. |
| `dailyMemories` | Daily Memories | Memory store | The current logical day's Conversation Daily Memories (CR015). |
| `dailyIntentions` | Daily Intentions | Memory store | The current first-person Daily Intentions across life areas (CR016). |
| `lorebook` | Lorebook | Lore store | Matching lorebook entries for the current context. |
| `summaries` | Conversation Summaries | Summary store | Auto-generated Conversation summaries for the configured retention window. |
| `crossChatAwareness` | Cross-Chat Awareness | Connected chats | Summaries and recent messages from other Conversations sharing the current character (CR014), including their last Daily Memories retrieval (CR028). |
| `roleplayScenes` | Roleplay Source Chats | Connected chats | Explicitly selected Roleplay / Scene source chats included in active Scene generation (CR036). |
| `characterMind` | Character Mind | Character Mind store | Wiki pages and schema query results from the compiled Character Mind (CR019–CR031). |
| `recentExchange` | Recent Exchange | Chat history | The verbatim recent messages needed for tone and continuity. Always present; role only controls whether the agent may extend the window. |

### Source discovery and stability

- This list is the closed set for this CR. Adding a new source requires a tracked change and an explicit default role.
- `recentExchange` is special: it is always required for continuity, so its role defaults to **Always include** and may only be set to **Agent curated** (never **Always exclude**). The UI enforces this.
- Sources that are globally disabled for the chat (for example, no Character Mind built, no Daily Intentions feature on, no connected chats) are reported as **unavailable** by the host and greyed out in the UI; their configured role is retained but has no effect while unavailable.

## Per-Source Configuration

Each context source listed above carries a **role** that controls how its content reaches the writer. Roles are per-chat, stored alongside the briefing in chat metadata, and survive duplication, export/import, and backup/restore.

### Roles

| Role | Behavior |
|---|---|
| **Always include** | The source content is resolved up front on every turn and injected into the briefing as an immutable, clearly labeled block. The curation agent cannot edit, summarize, or drop it. The writer receives it verbatim inside the briefing. |
| **Agent curated** | The source is registered as a batched tool. The curation agent decides per turn whether to request it, with what query, and how much to include. It may summarize, trim, or omit retrieved content. This is the default for retrieval-style sources. |
| **Always exclude** | The source is not registered with the curation agent and is never resolved. Its content never reaches the writer through this pipeline. |

### Defaults

The defaults are chosen to preserve CR032-equivalent coverage while making the curator responsible for trimming:

| Source | Default role | Rationale |
|---|---|---|
| `characterCard` | Always include | Card identity must reach the writer unchanged. |
| `persona` | Always include | Persona identity must reach the writer unchanged. |
| `conversationStatus` | Always include | Current framing is core context. |
| `commands` | Always include | Available actions are operational, not editorial. |
| `reactRules` | Always exclude | Two-Pass Conversation writing rarely needs react-rule advertising; users can opt in. |
| `replyRules` | Always exclude | Same as above. |
| `memories` | Agent curated | Retrieval relevance is the curator's job. |
| `dailyMemories` | Agent curated | Same as above. |
| `dailyIntentions` | Agent curated | Same as above. |
| `lorebook` | Agent curated | Same as above. |
| `summaries` | Agent curated | Same as above. |
| `crossChatAwareness` | Agent curated | Same as above. |
| `roleplayScenes` | Agent curated | Same as above. |
| `characterMind` | Agent curated | Same as above. |
| `recentExchange` | Always include | Required for continuity; cannot be excluded. |

### UI surface

A dedicated **Context Sources** panel in Conversation Chat Settings lists every source with:

- Its current role as a three-state selector (**Always include / Agent curated / Always exclude**).
- An **unavailable** badge when the source is globally disabled for the chat, with the selector disabled.
- For `recentExchange`, the exclude option is disabled and labeled *required for continuity*.
- A short description of what each source provides (from the table above).
- A **Reset to defaults** action.

The panel sits next to the persistent-briefing inspection panel so users manage *what feeds the briefing* and *what the briefing currently says* in one place.

### Effect on the curation flow

- **Always include** sources are resolved by the host before the curation agent runs, packed into a labeled `## Injected Sources` block, and merged into the briefing. The agent prompt is told these blocks are immutable.
- **Agent curated** sources are the only ones exposed as batched tools.
- **Always exclude** sources are neither resolved nor registered.
- The fast-path classifier still runs; on a fast-path turn, **Agent curated** tools are skipped, but **Always include** sources are still injected (they are not optional).

## Update Workflow

On every user message in a Two-Pass chat:

1. Load the per-source role map and the previous briefing from chat metadata (or initialize defaults and an empty shell on first use).
2. Resolve all **Always include** sources up front and inject their content into the briefing shell as immutable blocks.
3. Build the turn delta: new user message, previous assistant response, and generation metadata.
4. Run the curation agent:
   - Fast-path assessment.
   - If needed, issue a single batched source-tool request scoped to the **Agent curated** sources only.
   - Update the briefing, preserving the injected **Always include** blocks unchanged.
5. Persist the updated briefing to chat metadata.
6. Pass the updated briefing to the response writer.

The curation agent is multi-shot with tool support:

- **Shot 1**: assess the turn and decide which **Agent curated** sources to query. It cannot query **Always exclude** sources (not registered) or **Always include** sources (already in the briefing).
- **Shot 2**: receive batched source results and update the briefing, leaving injected **Always include** blocks intact.

No third rewrite pass.

## Batched Source Tools

Only **Agent curated** sources are exposed as batched tools. **Always include** sources are already in the briefing and are not callable; **Always exclude** sources are not registered at all. The agent does not call tools one at a time. It emits a single structured request listing which curated sources it wants, and the host returns a combined, delimited result block.

### Example tool request

The agent may only request sources configured as **Agent curated**. In this example the user has kept the retrieval-style sources curated and excluded `reactRules` / `replyRules`.

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
- A **Context Sources** panel (see **Per-Source Configuration**) for configuring each source's role.
- Generation metadata records whether the fast path or full path ran, which tools were batched, and which sources were injected as Always include.

## Integration with Two-Pass Pipeline

```text
[Existing shared context resolution]
              |
              v
[Load per-source role map + previous briefing from chat metadata]
              |
              v
[Resolve Always include sources → inject immutable labeled blocks into briefing]
              |
              v
[Curation Agent]
   |-- Fast path --> lightly update briefing (Always include blocks preserved)
   |-- Full path --> select Agent curated sources --> batch tool call --> update briefing
              |
              v
[Persist updated briefing + role map]
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
| Closed source set | Only the sources enumerated in **Context Sources** are configurable; adding one requires a tracked change. |
| Role enforcement | Only **Agent curated** sources are exposed as tools; **Always include** sources are injected and immutable; **Always exclude** sources are never resolved. |
| Required continuity | `recentExchange` is always present and cannot be excluded. |

## Risks

| Risk | Mitigation |
|---|---|
| **Briefing drift** | Provide visible reset and optional regenerate; consider periodic full rebuild from sources. |
| **Briefing bloat** | Hard size cap; in-place summarization when sections grow. Note: **Always include** sources are injected verbatim every turn, so over-using that role is the main bloat risk; defaults and the UI description steer users toward **Agent curated** for retrieval sources. |
| **Latency** | Fast path for routine turns; batched tool calls run in parallel. **Always include** sources are resolved up front on every turn, so marking many large sources as Always include adds fixed latency. |
| **Cost** | Fast path reduces model calls; full path replaces many fixed retrievals with targeted ones. |
| **Tool hallucination** | Tool results are explicit and bounded; agent cannot fabricate source outputs. |
| **Concurrency / group chats** | Per-character briefing variant may be needed for groups. |
| **Regeneration** | Regenerating a response should not re-trigger briefing update unless the response changes materially. |
| **Export privacy** | The briefing may contain sensitive summaries; treat it like debug metadata and persisted chat data. The per-source role map is persisted alongside it and should be treated the same way. |

## Open Questions

1. **Per-character briefing in group chats?** In a multi-character Conversation, do all characters share one briefing, or does each responding character have their own? ANSWER: share one briefing.
2. **Periodic full rebuild?** Should the system occasionally rebuild the briefing from primary sources (e.g., every N turns or on reset) to limit drift? ANSWER: full reubuild every day upon first message.
3. **Fast-path trigger implementation?** Should the classifier be a cheap dedicated model/prompt, or the same curator with constrained output? ANSWER: dedicated selectable model
4. **Tool set initial scope?** Which sources are in the first batched tool set? All existing ones, or a subset? ANSWER: All the sources in scope
5. **Conflict with CR032 shipped implementation?** Does this replace the CR032 curator entirely, or coexist as an optional enhanced mode? ANSWER: Replaces it.
6. **Per-source configuration defaults?** Are the default roles in **Per-Source Configuration** the right starting point, or should more sources default to **Always include** for parity with the current CR032 flat source package? ANSWER: defaults as drafted; users opt into more Always include only if they want fixed verbatim inclusion.
7. **Role persistence across feature toggles?** When a source becomes unavailable (e.g., Character Mind is removed) and later available again, should its previously configured role be restored automatically? ANSWER: yes, retained and restored; unavailable sources are greyed out but keep their configured role.

## Acceptance Criteria

- Two-Pass chats store and load a persistent context briefing.
- The curation agent updates the briefing on each user message.
- Routine turns use a fast path that skips batched source calls.
- Non-routine turns issue a single batched source request scoped to **Agent curated** sources and receive a single combined result.
- **Always include** sources are resolved up front, injected into the briefing, and preserved unchanged by the curation agent.
- **Always exclude** sources are never resolved or registered.
- The writer receives only the updated briefing and its system prompt.
- Standard generation is unaffected.
- The briefing and the per-source role map survive restart, duplication, export/import, and backup/restore.
- The user can view and reset the briefing, and configure each context source's role, on request.
- No changes are written back to memories, summaries, lorebooks, or other stores.
