# CR028: Cross-Chat Daily Memory Awareness

Status: Approved for implementation

## Goals

- Give each cross-chat awareness source access to its most recent formed Daily Memories day.
- Keep the memories scoped to the same qualifying source Conversation that already supplies summaries and its current logical-day transcript.
- Preserve existing Cross-Chat Awareness and Daily Memories behavior when no formed memories exist.

## Proposed Solution

When `buildAwarenessBlock` loads a qualifying source Conversation, also read that source chat's Daily Memory day records and select the latest day by Conversation date. Load the complete saved memory set for that day without semantic retrieval, ranking, or a result-count limit.

Render the selected day inside the source Conversation block as a distinct `Latest Daily Memories` section containing the date, importance, and memory text. Treat these records as historical context under the existing awareness instruction boundary.

The active and source Conversations must still satisfy the current Cross-Chat Awareness rules: Conversation mode, awareness enabled, and at least one shared character.

## Non-Goals

- Do not expose memories from more than the latest formed day.
- Do not run vector retrieval against a source Conversation.
- Do not change Daily Memories formation, storage, ranking, agent configuration, or UI.
- Do not extend Cross-Chat Awareness to unrelated chats, Roleplays, or Games.

## Risks

- A recently regenerated older day could be confused with the chronologically latest formed day. This change deliberately uses the latest Conversation date, matching the meaning of the latest completed daily memory set.
- Daily Memories may overlap with summaries or current-day transcript context and increase prompt size.
- Empty formed days must not hide the latest earlier day that contains memories.

## Validation

- Extend the focused Cross-Chat Awareness regression for latest-day selection, formatting, importance, chronological selection, sanitization, and empty-state behavior.
- Run the focused regression and server TypeScript validation.

