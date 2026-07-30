# CR017: Conversation Auto-Summary Controls

Status: Implemented and validated on `change/CR017-conversation-summary-controls`; awaiting E2E decision and local integration

## Goals

- Let each Conversation choose the text-generation connection used for automatic day/week summarization and manual summary backfill.
- Let each Conversation include or exclude the memory-like `keyDetails` produced by automatic summarization from model prompt context.
- Continue generating, storing, consolidating, and exposing `keyDetails` even when their prompt injection is disabled.
- Keep automatic summary prose in prompt context at all times; this CR does not add a summary-disable control.
- Preserve existing behavior for chats whose new settings are unset.

## Current Behavior

Conversation mode automatically creates a structured entry for completed days and weeks. Each entry contains:

- `summary`: short atmospheric/relational notes that replace summarized transcript history in the prompt.
- `keyDetails`: specific facts, commitments, plans, unresolved topics, and emotional events presented to the model as important memories.

Normal generation and the manual backfill endpoint currently use the Conversation's primary chat connection for this work. There is no separate connection selector in the Conversation Automatic Summarization settings.

The two entry fields are stored and edited together, but injected through distinct prompt roles. Summary prose replaces older transcript buckets. Key details are additionally formatted as important memories. Other prompt builders also consume Conversation summary entries, including cross-chat awareness, Conversation scene context, explicit Roleplay context sources, and schedule-continuity generation.

This CR concerns those automatic-summary `keyDetails`. It does not change semantic Memory Recall chunks, Daily Conversation Memories, character memories, scene memories, or the separate rolling Roleplay Summary feature.

## Product Model

Add two Conversation-scoped settings under Chat Settings > Automatic Summarization:

1. **Summary Connection** selects the text connection used to create missing day summaries and consolidate completed weeks.
2. **Include Summary Memories in Prompts** controls whether stored automatic-summary `keyDetails` are supplied as model context.

Automatic summarization itself remains mandatory. Disabling summary-memory injection is a context choice, not a data-retention or generation choice.

## Summary Connection

Persist a dedicated optional Conversation metadata field, provisionally `conversationSummaryConnectionId`.

- Missing or `null` means **Use chat connection**, matching current Conversation behavior.
- A selected connection is the primary connection for both automatic summarization during generation and manual backfill from the summaries editor.
- The selector lists eligible language-generation connections and excludes image/video connections. It should follow normal chat-generation availability rules for the local sidecar.
- A saved connection ID that is later deleted remains visible as missing so the user can repair the configuration.
- An explicit missing or unusable connection must not silently switch to the normal chat connection. Automatic summary work should be skipped/recorded without blocking the main chat response; manual backfill should return an actionable error.
- The existing configured agent-category failover may still handle a runtime failure after a valid primary summary connection has been resolved.

Connection resolution should be shared by normal Conversation generation and manual backfill so they cannot drift. The existing rolling Roleplay `summaryConnectionId` and its agent-default fallback semantics remain unchanged; the new field is intentionally separate to preserve both modes' current defaults.

## Summary-Memory Prompt Control

Persist a Conversation metadata boolean, provisionally `includeConversationSummaryMemoriesInPrompt`.

- Missing or `true` includes `keyDetails`, preserving existing chats and imports.
- `false` excludes `keyDetails` from model prompt context.
- The switch does not delete or clear any stored key details.
- Day generation, partial-day combination, week consolidation, retries, backfill, editing, and export continue to read/write the full `{ summary, keyDetails }` entry.
- The Summaries editor continues to display and edit key details regardless of the prompt setting.
- Summary token/count indicators continue to describe stored content; UI help must make clear that exclusion affects prompt injection only.

The policy belongs to the Conversation that owns the summaries. When disabled, its `keyDetails` must be omitted anywhere that Conversation supplies prompt context, including:

- its normal Conversation generation prompt;
- cross-chat Conversation awareness;
- Conversation context used for scene planning and the spawned Roleplay;
- explicit Roleplay context-source injection;
- offline/supporting prompts such as schedule-continuity generation that consume day/week summary entries.

Summary prose must remain in each of those paths. Internal summarization prompts may continue to pass daily key details into weekly consolidation because that is memory generation, not conversation-context injection.

## UI and Interaction

Extend the existing Conversation-only Automatic Summarization section in `ChatSettingsDrawer`.

- Place the connection selector near the current day-rollover control and Edit Summaries action.
- Label the default option clearly, for example `Use chat connection (current name)` when resolvable.
- Show connection name and model where space allows, consistent with other connection selectors.
- Preserve and label missing saved selections instead of resetting them.
- Add an immediately persisted toggle labeled `Include Summary Memories in Prompts`.
- Explain that turning it off keeps generating and storing memories but sends only summaries, plus unsummarized/current transcript context, to models.
- Retain the existing explanation that summaries cannot be disabled.

No new modal is required.

## Data and Compatibility

Both settings fit the existing metadata-backed chat model; no database schema change is expected.

- Existing chats, imports, branches, and copied chats behave as before because unset values use the chat connection and include key details.
- Generic chat metadata patching can persist the controls unless implementation analysis finds a validation gap.
- Summary-entry schemas and stored data do not change.
- Changing the connection affects future summary and consolidation calls only. It does not regenerate existing entries automatically.
- Changing prompt inclusion takes effect on the next applicable model request and does not mutate history.

## Out of Scope

- Disabling automatic Conversation summary generation or summary-prose injection.
- Adding custom day/week summary prompts, schedules, token limits, or separate day and week connections.
- Changing the content or schema of generated `summary` and `keyDetails` fields.
- Controlling semantic Memory Recall, Daily Conversation Memories, character memories, scene memories, or rolling Roleplay summaries.
- Automatically regenerating summaries when the selected connection changes.

## Risks

- A partial implementation could omit key details from the main Conversation prompt while still leaking them through secondary context builders.
- Confusing summary memories with Memory Recall or Daily Memories could make the new toggle appear to control unrelated features.
- Sharing the rolling Roleplay connection field would change fallback behavior for existing users; the dedicated Conversation field avoids that coupling.
- A missing selected connection could repeatedly attempt work or obscure summary gaps. Resolution errors and existing summary failure/retry metadata must remain bounded and observable.
- Removing important details from prompt context can reduce factual continuity even though summary prose remains. UI copy should state the trade-off plainly.

## Validation

- Verify unset settings preserve the current chat-connection selection and key-detail injection behavior.
- Verify a selected Conversation summary connection is used for both automatic day/week work and manual backfill, without changing the main response connection.
- Verify image/video connections are excluded, local-sidecar availability is handled consistently, and a missing saved selection is shown and reported clearly.
- Verify failure to resolve the selected summary connection does not block normal chat generation and produces an actionable manual-backfill error.
- Verify `false` continues to generate, store, edit, and consolidate key details while removing them from every prompt-context consumer listed above.
- Verify summary prose remains injected when key details are excluded, including normal Conversation history and secondary context-source paths.
- Verify `true` and unset values include key details exactly as before and do not duplicate them.
- Verify the two controls persist from Conversation Chat Settings and render correctly at desktop and narrow widths.
- Run focused shared/server/client tests and `pnpm check` for the substantive cross-cutting implementation.
- After implementation, agree whether to add focused CR017 Playwright E2E validation for settings persistence and observable prompt behavior.
