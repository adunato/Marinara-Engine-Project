# CR015: Daily Conversation Memories

Status: Proposed — requirements captured, awaiting HLD approval

## Goals

- Add a built-in agent that forms durable, day-scoped memories for Conversation mode.
- Retrieve relevant formed memories on every Conversation generation through fast vector and ranking logic, without an LLM retrieval call.
- Keep daily memories separate from and complementary to automatic summarisation.
- Let users enable daily memories with or instead of the current memory recall system; the features are not mutually exclusive.
- Give users full Conversation-level visibility and control over memories for every completed day.
- Preserve existing summarisation and memory recall behavior when the new agent is not added to a Conversation.

## Product Model

Daily Conversation Memories is one built-in agent with two distinct runtime activities:

1. **Memory formation** runs after each configured handover and uses an LLM to extract memories from the completed daily window.
2. **Memory retrieval** runs for every message generation and uses embeddings plus deterministic ranking to select saved memories for context.

The agent is added to and enabled for a Conversation through the existing agent model. Its operational settings belong in the agent configuration experience. Reviewing and maintaining formed memories is Conversation functionality, not an agent-editor workflow.

## Agent Configuration

The built-in agent should expose configuration consistent with other agents:

- A configurable daily handover time.
- A visible, user-editable memory-formation prompt with a built-in default and reset-to-default behavior.
- A selectable language-model connection used only for memory formation.
- A configurable count of the most recent Conversation messages used to construct the retrieval query.
- User-adjustable semantic-similarity, importance, and recency weights for retrieval ranking.

The three ranking controls should be presented as understandable relative influences and normalized before scoring so users do not need to make them add up to 100% manually.

## Memory Formation

- Each memory day is the exact 24-hour window ending at that day's configured handover time in the applicable Conversation timezone.
- Automatic formation runs only after the window has ended; the current/incomplete window is never formed or regenerated.
- Formation reads all eligible Conversation messages from the completed window.
- The configured LLM connection receives those messages and the editable formation prompt.
- The response is structured JSON containing a list of memory texts and an importance score from 1 through 5 for each memory.
- The server assigns the completed window's date to every returned memory. It does not ask the model to infer a precise time.
- The default prompt requests up to ten memories, permits fewer when appropriate, and asks for each memory to be a nuanced short paragraph. Count and verbosity remain prompt-controlled rather than separate hard-coded UI limits.
- Importance meanings range from `1` (low importance) to `5` (very important).
- A day may validly produce no memories when its messages contain nothing worth retaining.

Each stored memory needs a stable identifier, Conversation identifier, date, text, importance score, and embedding/index data required for retrieval. Creating, regenerating, or manually editing a memory must create or refresh its embedding before it becomes available to retrieval.

## Memory Retrieval

- Retrieval runs for every Conversation generation while the daily-memory agent is enabled.
- It performs no LLM inference. It embeds the configured last `N` messages as the retrieval query and searches the Conversation's pre-indexed daily memories.
- Retrieval must be designed for low latency: stored memories are embedded on write, vector search bounds the candidate set, and deterministic reranking operates only on candidates.
- Candidate ranking combines:

  - Semantic similarity between the recent-message query and stored memory.
  - The stored 1–5 importance score.
  - Recency, favoring memories from more recent completed windows.

An initial balanced default is 50% semantic similarity, 35% importance, and 15% recency, with recency using an approximately 30-day half-life. These defaults should be centralized and covered by ranking tests so they can be calibrated without changing the data model.

Importance is a ranking boost, not an unconditional pin. A score-5 memory should receive the maximum importance contribution and therefore rank strongly by default. Increasing the importance control should make the most important memories effectively dominate selection; reducing it should allow semantic fit and recency to dominate. No memory is included solely because its importance is 5.

Selected memories are injected into runtime context as an explicitly delimited list grouped by memory date. This path remains independent of both summary context and the existing memory recall system, so any combination can be enabled.

## Conversation Memory UI

Add a Daily Memories editor for Conversation mode using the existing Automatic Summarization editor as the visual and interaction framework:

- Open it as Conversation functionality from the same general area as summary management, not from the agent editor.
- Group all memories by date and show completed days in a clear chronological structure.
- Display each memory's editable text and editable importance score from 1 through 5.
- Allow users to add a memory to any completed day.
- Allow users to edit or delete each individual memory.
- Allow users to delete all memories for a selected day.
- Allow users to regenerate a selected completed day's memories from scratch using that day's original eligible messages, current prompt, and current formation connection.
- Treat regeneration as replacement of the entire day's existing memory set and require clear destructive-action confirmation.
- Show missing completed days and allow the user to generate a specific past day that has not yet been formed.
- Do not allow manual generation or regeneration for the current 24-hour window until its configured handover has passed.
- Preserve explicit save/cancel behavior for manual edits and clear pending, success, empty, and error states.
- Refresh embeddings for changed or added memories and remove deleted memories from the retrieval index.

The editor should make it possible to replace the complete contents of a day through any combination of editing, adding, deleting, or regeneration.

## Interaction With Existing Features

- Automatic summarisation continues to use its own data, scheduling, editor, and prompt-context path.
- Current memory recall continues to operate independently.
- Enabling daily memories does not automatically disable either existing feature.
- Prompt assembly must delimit each source so the model can distinguish summaries, daily memories, and current recall results and tolerate possible overlap.

## Risks

- Concurrent summaries, daily memories, and recalled memories can duplicate or contradict one another and increase prompt size.
- Automatic extraction can retain incorrect, sensitive, or low-value content, making user review and deletion essential.
- Changing handover settings can make historical window boundaries ambiguous; stored entries must keep stable dates rather than being silently regrouped.
- Regeneration is destructive and may produce different memories from the same transcript after prompt or model changes.
- Manual edits, formation failures, and partial embedding failures must not leave persisted text and the retrieval index inconsistent.
- Vector-provider availability and query latency must not block ordinary Conversation generation; retrieval needs bounded failure behavior.

## Validation

- Cover exact rolling 24-hour window boundaries at the configured handover and Conversation timezone.
- Cover structured formation output, zero-to-ten default behavior, date assignment, score validation, persistence, and embedding refresh.
- Cover manual add, edit, individual delete, day delete, regeneration, and generation of missing completed days while rejecting the current incomplete window.
- Cover weighted retrieval ordering, importance-score effects, recency decay, configurable recent-message count, and deterministic tie behavior.
- Verify retrieval performs no LLM call and degrades safely when embedding or vector search fails.
- Verify context is grouped by day and remains distinct when summaries and current memory recall are also enabled.
- Verify the Conversation editor's persistence, confirmation, loading, empty, error, and accessibility behavior.
- Run `pnpm db:push` if the implementation adds or changes database schema.
- Run `pnpm check` for the substantive cross-cutting application change.
- Agree whether to add focused CR015 Playwright E2E validation once implementation is complete.

