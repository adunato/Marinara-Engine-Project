# CR037 — Stateful Two-Pass Context Briefing

## Status

Draft HLD for review. Updated to add a complete **Context Sources** enumeration and **Per-Source Configuration** (per-source role: Always include / Agent curated / Always exclude).

Depends on the existing Two-Pass Conversation generation pipeline introduced in **CR032**. This CR evolves that pipeline from a stateless per-turn curator into a stateful, persistent context briefing maintained by a multi-shot curation agent.

## Problem

The current Two-Pass pipeline (CR032) produces a fresh Conversation Briefing on every turn. The curator starts with no memory of what it concluded in previous turns, so it must repeatedly reconstruct continuity, relevance, and focus from the same raw sources. This is inefficient and can be inconsistent across turns.

A persistent briefing would let the curator carry forward what it has already established, update only what changed, and decide which sources to consult rather than relying on fixed inclusion rules.

## Goals

- Add a **persistent context briefing** to each Conversation chat that uses Two-Pass generation.
- Provide a **complete, explicit enumeration of the context sources supported by CR037** and let the user assign each one a **role** that controls how it reaches the writer.
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

The briefing has two clearly separated sections:

1. **SOURCES** — Extracted content from Always include sources. These blocks are immutable; the curation agent cannot edit, summarize, or drop them. They are injected verbatim by the host before the agent runs.
2. **BRIEFING** — Agent-generated analysis and synthesis of all context (both injected sources and curated tool results). This section is editable by the curation agent on every turn; sections are assessed for change and edited in place rather than rewritten wholesale.

Suggested structure (prompt-owned, not hard-coded):

```markdown
# Conversation Context Briefing

## SOURCES
[Immutable blocks injected by the host from Always include sources]
### Character Card
[Resolved card fields — description, personality, backstory, appearance, scenario, example dialogue, system prompt, post-history instructions]
### Persona
[Active user persona identity and description]
### Conversation Status
[Engine-resolved {{context}} / {{status}} block — current situation, scene framing]
### Commands
[Available commands and reminders]
### Recent Exchange (injected)
[Fixed recent message window for continuity baseline]

## BRIEFING
[Agent-generated content — editable on every turn]
### Current Situation
A concise description of the immediate situation.
### Active Threads
- Thread label: brief description, status, priority
- ...
### Key Facts
- Fact (source type, confidence: direct / summarized / inferred)
- ...
### Relationship State
How the character understands the relationship with the persona right now.
### Emotional State
Current mood, underlying tension, recent shifts.
### Recent Exchange (curated)
[Agent-determined verbatim messages needed for tone and continuity — may extend beyond injected window]
### Relevant External Context
References to memories, scenes, awareness chats, lore, etc., with source labels.
### Last Updated
Turn N, message ID, trigger classification, tools called.
```

Application code validates only size bounds, non-emptiness, and stable section markers if needed for UI rendering. The SOURCES / BRIEFING boundary is the structural invariant that prevents the agent from modifying injected content.

## Context Sources

This is the complete, explicit enumeration of the context sources supported by the CR037 stateful Two-Pass pipeline. Each source is independently configurable (see **Per-Source Configuration** below). Sources not listed here are not part of this pipeline.

CR037 intentionally defines a closed, explicit source registry rather than inheriting the complete prepared-context snapshot used by CR032. This gives the user deterministic control over which supported sources are always included, agent curated, or excluded. Marinara may currently have other prompt inputs or context contributors that CR032 can see; they are out of scope for CR037 unless they are added to this registry by a tracked change with an explicit default role.

The enumeration is grouped by origin for clarity. Source identifiers are stable configuration keys; the human labels are for UI display only.

| Source key | Human label | Origin | What it provides |
|---|---|---|---|
| `characterCard` | Character Card | Card | The active character's card fields (description, personality, backstory, appearance, scenario, example dialogue, card system prompt field, post-history instructions). In group chats, all participating characters' cards are included with labels. |
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
| `recentExchange` | Recent Exchange | Chat history | The verbatim recent messages needed for tone and continuity. Always present; **Always include** provides a fixed recent message window, while **Agent curated** lets the agent decide how far back to look based on context needs. |

### Source discovery and stability

- This list is the closed set for this CR. Adding a new source requires a tracked change and an explicit default role.
- `recentExchange` is special: it is always required for continuity, so its role defaults to **Always include** and may only be set to **Agent curated** (never **Always exclude**). The UI enforces this.
- Sources that are globally disabled for the chat (for example, no Character Mind built, no Daily Intentions feature on, no connected chats) are reported as **unavailable** by the host and greyed out in the UI; their configured role is retained but has no effect while unavailable.
- If a source changes to **Always exclude**, or becomes unavailable after previously contributing to the BRIEFING, the existing BRIEFING is invalid because it may still contain derived information from that source. Clear the BRIEFING and force a full build before the next writer call. The configured role itself is retained when a source is unavailable and restored if that source later becomes available.
- Images and files attached to messages are carried alongside text content within `recentExchange` (and any other source that references message attachments). No separate image/file source is needed.
- In group chats, **all character cards** for participating characters are included in the SOURCES section with appropriate labels so the writer can distinguish which card applies to which response. There are no other character-specific sources beyond those enumerated here.

## Per-Source Configuration

Each context source listed above carries a **role** that controls how its content reaches the writer. Roles are per-chat, stored alongside the briefing in chat metadata, and survive duplication, export/import, and backup/restore.

### Roles

| Role | Behavior |
|---|---|
| **Always include** | The source content is resolved up front on every turn and injected into the briefing as an immutable, clearly labeled block. The curation agent cannot edit, summarize, or drop it. The writer receives it verbatim inside the briefing. |
| **Agent curated** | The source is registered as a batched tool. The curation agent decides per turn whether to request it, with what query, and how much to include. It may summarize, trim, or omit retrieved content. This is the default for retrieval-style sources. |
| **Always exclude** | The source is not registered with the curation agent and is never resolved. Its content never reaches the writer through this pipeline. |

### Defaults

The defaults provide practical initial coverage within the explicit CR037 source registry while making the curator responsible for trimming:

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
- The fast-path classifier still runs on turns with a valid existing BRIEFING; on a fast-path turn, **Agent curated** tools are skipped, but **Always include** sources are still injected (they are not optional).
- If there is no valid existing BRIEFING, the turn must use the full path and the fast-path classifier is skipped.

## Update Workflow

On every user message in a Two-Pass chat:

1. **Load state.** Load the per-source role map and the previous briefing from chat metadata. If no valid prior BRIEFING exists (first use of stateful Two-Pass, after reset, or after source-role/source-availability invalidation), initialize defaults as needed, create an empty BRIEFING shell, and mark the turn as **full build required**.
2. **Check periodic full rebuild.** If a daily rebuild is due (every day upon first message after midnight), discard the existing BRIEFING content, start from a blank shell, retain the role map, and mark the turn as **full build required**. SOURCES are rebuilt fresh.
3. **Resolve Always include sources.** Resolve all **Always include** sources up front and inject their content into the SOURCES section as immutable, labeled blocks. The agent cannot modify these.
4. **Build turn delta.** Construct the current turn context: new user message, previous assistant response, and generation metadata.
5. **Run fast-path classifier only when a valid prior BRIEFING exists.** A lightweight prompt (using a dedicated selectable connection) classifies the turn:
   - Output: `{ "fastPath": true/false, "reason": string }`.
   - If **full build required**, skip the classifier and proceed directly to step 6.
   - If `fastPath: true`, skip batched tool calls and proceed to step 7a.
   - If `fastPath: false`, proceed to step 6 (full path).
6. **Full path — batched source query.** The curation agent emits a single structured request listing which **Agent curated** sources it wants. Shot 1 is the tool request; Shot 2 receives the combined result block. The agent cannot query **Always exclude** sources (not registered) or **Always include** sources (already in SOURCES). A full build reconstructs the BRIEFING from the currently permitted sources rather than preserving content from an invalidated briefing.
7. **Update BRIEFING section.** The curation agent edits the BRIEFING section in place based on the turn delta and (if full path) batched tool results:
   - **Fast path:** Update only `Recent Exchange (curated)` (extend window if needed), `Last Updated`, and `Emotional State` if sentiment clearly shifted. Do not rewrite `Current Situation`, `Active Threads`, `Key Facts`, `Relationship State`, or `Relevant External Context`.
   - **Full path with a valid prior BRIEFING:** Assess which BRIEFING sections need change based on the turn delta and tool results. Edit only the affected sections in place; do not rewrite the entire BRIEFING section. Preserve unchanged sections verbatim.
   - **Full build required:** Populate the BRIEFING from the empty shell using the currently permitted sources. Do not carry forward text from the invalidated or cleared BRIEFING.
8. **Persist.** Save the updated briefing (SOURCES + edited BRIEFING) to chat metadata.
9. **Pass to writer.** The response writer receives only the complete briefing and its system prompt.

The curation agent is multi-shot with tool support:

- **Shot 1** (full path only): assess the turn and decide which **Agent curated** sources to query via a single batched request.
- **Shot 2**: receive batched source results and edit the BRIEFING section in place, leaving SOURCES blocks intact.

No third rewrite pass.

## Batched Source Tools

Only **Agent curated** sources are exposed as batched tools. **Always include** sources are already in the briefing and are not callable; **Always exclude** sources are not registered at all. The agent does not call tools one at a time. It emits a single structured request listing which curated sources it wants, and the host returns a combined, delimited result block.

### Example tool request

The agent may only request sources configured as **Agent curated**. In this example the user has kept the retrieval-style sources curated and excluded `reactRules` / `replyRules`. Tool keys match source enumeration keys.

```json
{
  "query": {
    "memories": { "search": "user's sister, family", "limit": 5 },
    "dailyMemories": { "include": true },
    "dailyIntentions": { "include": true },
    "summaries": { "range": "last_14_days" },
    "crossChatAwareness": { "search": "Alice", "limit": 3 },
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

### Cross Chat Awareness
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

The fast path runs when the turn is assessed as a **routine continuation** and a valid existing BRIEFING is available. Indicators include:

- Short generic message with no new entities, questions, or references.
- No unresolved threads from the previous briefing.
- No notable emotional or situational shift.
- No explicit references to past sources.

### Fast-path behavior

- Skip batched tool calls.
- The fast-path classifier determines which BRIEFING sections need updating based on its assessment:
  - `Recent Exchange (curated)` — always updated with the new message window; agent may extend beyond injected baseline if context warrants.
  - `Last Updated` — always updated with turn metadata.
  - `Emotional State` — updated only if sentiment clearly shifted.
- Do not rewrite `Current Situation`, `Active Threads`, `Key Facts`, `Relationship State`, or `Relevant External Context` on fast path. These sections are assessed as unchanged and left verbatim.
- First use, reset, daily rebuild, and source-role/source-availability invalidation never use the fast path; they force a full build from the currently permitted sources.

### Implementation

The fast-path classifier uses a dedicated selectable Marinara Engine connection (independent of the curation agent's connection). It outputs a structured decision:

```json
{
  "fastPath": true,
  "reason": "routine greeting"
}
```

The `sectionsToUpdate` field is implicit in the workflow: on fast path, only `Recent Exchange (curated)`, `Last Updated`, and optionally `Emotional State` are updated. The classifier does not need to enumerate sections — the workflow dictates which BRIEFING sections are eligible for update based on the path taken.

If `fastPath` is false, the agent proceeds to Shot 1 (batched source query) and then Shot 2 (BRIEFING edit).

## Persistence

- The briefing is stored in **chat metadata**.
- It survives server restart.
- It is included in chat duplication, export/import, and full backup/restore.
- If the chat is switched back to Standard generation, the briefing is retained but not updated.
- If Two-Pass is re-enabled, the existing briefing is reused unless it has been invalidated by a source-role or source-availability change; an invalid briefing is cleared and fully rebuilt on the next Two-Pass turn.
- A user-facing **Reset Context Briefing** action clears the briefing; the next message forces a full build from the currently permitted sources.

## UI / Human Visibility

Human interaction is **optional on request**, not gated per change:

- A new action in Chat Settings or the message menu: **View Context Briefing**.
- Read-only panel showing the current briefing (SOURCES section immutable, BRIEFING section editable).
- A **Reset** button to clear it.
- Optionally a **Regenerate Briefing** action if the user thinks it has drifted.
- A **Context Sources** panel (see **Per-Source Configuration**) for configuring each source's role.
- Connection/model selection in Chat Settings:
  - **Fast-path classifier connection** — dedicated selectable Marinara Engine connection (independent of curation agent).
  - **Curation agent connection** — the model used for Shot 1 (source query) and Shot 2 (BRIEFING edit). Defaults to the chat's existing Two-Pass curator connection but is independently configurable.
- Generation metadata records whether the fast path or full path ran, which tools were batched, which sources were injected as Always include, and which connections were used.

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
| Fast path | Routine turns with a valid existing BRIEFING may skip external source calls. |
| Full-build safety | First use, reset, daily rebuild, and source-role/source-availability invalidation force a full build before the writer runs. |
| Optional inspection | The user may view or reset the briefing, but does not approve each update. |
| Bounded size | The briefing is capped by token/character budget; overflows are summarized in place. |
| Closed source set | Only the sources enumerated in **Context Sources** are part of CR037; adding one requires a tracked change and explicit default role. |
| Role enforcement | Only **Agent curated** sources are exposed as tools; **Always include** sources are injected and immutable; **Always exclude** sources are never resolved. |
| Source invalidation | If a previously contributing source becomes excluded or unavailable, the prior BRIEFING is cleared and rebuilt before it can reach the writer again. |
| Required continuity | `recentExchange` is always present and cannot be excluded. |

## Risks

| Risk | Mitigation |
|---|---|
| **Briefing drift** | Provide visible reset and optional regenerate; periodic daily full rebuild from sources. |
| **Briefing bloat** | Hard size cap; in-place summarization when sections grow. Note: **Always include** sources are injected verbatim every turn, so over-using that role is the main bloat risk; defaults and the UI description steer users toward **Agent curated** for retrieval sources. |
| **Latency** | Fast path for routine turns; batched tool calls run in parallel. **Always include** sources are resolved up front on every turn, so marking many large sources as Always include adds fixed latency. |
| **Cost** | Fast path reduces model calls; full path replaces many fixed retrievals with targeted ones. |
| **Tool hallucination** | Tool results are explicit and bounded; agent cannot fabricate source outputs. |
| **Concurrency / group chats** | One shared briefing is intentional for group chats; implementation must avoid concurrent updates overwriting newer briefing state. |
| **Export privacy** | The briefing may contain sensitive summaries; treat it like debug metadata and persisted chat data. The per-source role map is persisted alongside it and should be treated the same way. |

## Open Questions

1. **Per-character briefing in group chats?** In a multi-character Conversation, do all characters share one briefing, or does each responding character have their own? ANSWER: share one briefing.
2. **Periodic full rebuild?** Should the system occasionally rebuild the briefing from primary sources (e.g., every N turns or on reset) to limit drift? ANSWER: full rebuild every day upon first message.
3. **Fast-path trigger implementation?** Should the classifier be a cheap dedicated Marinara Engine connection/prompt, or the same curation agent connection with constrained output? ANSWER: dedicated selectable Marinara Engine connection (independent of curation agent). All available connections are candidates; user selects in Chat Settings.
4. **Tool set initial scope?** Which sources are in the first batched tool set? All existing ones, or a subset? ANSWER: All the sources in scope.
5. **Conflict with CR032 shipped implementation?** Does this replace the CR032 curator entirely, or coexist as an optional enhanced mode? ANSWER: Replaces it.
6. **Per-source configuration defaults?** Are the default roles in **Per-Source Configuration** the right starting point, or should more sources default to **Always include** for parity with the current CR032 flat source package? ANSWER: defaults as drafted; users opt into more Always include only if they want fixed verbatim inclusion.
7. **Role persistence across feature toggles?** When a source becomes unavailable (e.g., Character Mind is removed) and later available again, should its previously configured role be restored automatically? ANSWER: yes, retained and restored; unavailable sources are greyed out but keep their configured role.

## Acceptance Criteria

- Two-Pass chats store and load a persistent context briefing with clearly separated SOURCES (immutable) and BRIEFING (editable) sections.
- CR037 uses the explicit closed source registry defined in this HLD rather than automatically inheriting every context block present in the CR032 prepared-context snapshot.
- The curation agent updates the BRIEFING section on each user message by editing affected sections in place rather than rewriting wholesale when a valid prior BRIEFING exists.
- Routine turns with a valid existing BRIEFING use a fast path that skips batched source calls; only `Recent Exchange (curated)`, `Last Updated`, and optionally `Emotional State` are updated.
- First use, reset, daily rebuild, and source-role/source-availability invalidation force a full build and cannot take the fast path.
- Non-routine turns issue a single batched source request scoped to **Agent curated** sources and receive a single combined result, then edit the BRIEFING section in place.
- **Always include** sources are resolved up front, injected into the SOURCES section, and preserved unchanged by the curation agent.
- **Always exclude** sources are never resolved or registered.
- If a source that previously contributed to BRIEFING becomes **Always exclude** or unavailable, the old BRIEFING is cleared before the writer runs and rebuilt from currently permitted sources.
- A periodic full rebuild occurs every day upon first message after midnight, discarding BRIEFING content while retaining the role map.
- The writer receives only the updated briefing and its system prompt.
- Standard generation is unaffected.
- The briefing and the per-source role map survive restart, duplication, export/import, and backup/restore.
- The user can view and reset the briefing, configure each context source's role, and select connections for fast-path classifier and curation agent, on request.
- In group chats, all participating character cards are included in SOURCES with appropriate labels and the chat uses one shared briefing.
- No changes are written back to memories, summaries, lorebooks, or other stores.
