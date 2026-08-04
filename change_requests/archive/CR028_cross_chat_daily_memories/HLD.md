# CR028: Cross-Chat Daily Memory Awareness

Status: Implemented and merged into local application `main`

## Goals

- Give each cross-chat awareness source access to the complete result of its most recent Daily Memories retrieval query.
- Keep the memories scoped to the same qualifying source Conversation that already supplies summaries and its current logical-day transcript.
- Preserve existing Cross-Chat Awareness and Daily Memories behavior when no formed memories exist.

## Proposed Solution

After a Conversation runs its normal Daily Memories retrieval query, persist a lightweight snapshot of every memory returned by that query. The snapshot records when the query ran and the returned memories' identifiers, dates, text, and importance. A successful empty result replaces the previous snapshot with an empty one.

When `buildAwarenessBlock` loads a qualifying source Conversation, parse that source chat's saved snapshot and render the complete result set inside its source block as a distinct `Last Daily Memory Query` section. Group the returned memories by their original memory dates for readability, but do not limit the snapshot to the newest day, query embeddings again, or apply another ranking/filter pass. Treat the result as historical context under the existing awareness instruction boundary.

The active and source Conversations must still satisfy the current Cross-Chat Awareness rules: Conversation mode, awareness enabled, and at least one shared character.

## Non-Goals

- Do not expose memories that were not selected by the source Conversation's last retrieval query.
- Do not run vector retrieval again while building Cross-Chat Awareness.
- Do not change Daily Memories formation, storage, ranking, agent configuration, or UI.
- Do not extend Cross-Chat Awareness to unrelated chats, Roleplays, or Games.

## Risks

- The saved snapshot can become stale until that source Conversation runs another Daily Memories query; its query timestamp makes that boundary explicit.
- Retrieved memories may span many days, overlap with summaries or current-day transcript context, and increase prompt size.
- Persisting query results in chat metadata must use queued metadata patching so concurrent settings or generation writes are not lost.

## Validation

- Extend the focused Cross-Chat Awareness regression for complete multi-day query-result formatting, importance, sanitization, malformed snapshot handling, and empty-state behavior.
- Run the focused regression and server TypeScript validation.
