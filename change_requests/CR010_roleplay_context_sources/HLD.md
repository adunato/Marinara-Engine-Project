# CR010: Roleplay Context Sources

## Status

Approved for implementation.

## Goals

- Let users select multiple existing chats while setting up a Roleplay chat.
- Accept Conversation, Roleplay, and Game chats as read-only context sources.
- Reuse each source mode's existing summaries and recent messages.
- Keep source selection editable from Roleplay Chat Settings.
- Preserve the existing one-to-one Connected Chat feature for OOC navigation, notes, influences, and direct messages.

## Proposed Solution

Add a directional many-to-one `chat_context_sources` relation from a Roleplay target chat to existing source chats. Source chats are not modified and do not gain a reciprocal link.

Add a simple **Source Chats** step to the Roleplay setup wizard. The step presents a searchable, mode-filtered multi-select of existing Conversation, Roleplay, and Game chats. No ordering, priorities, token-budget controls, or per-source options are included in this change.

Add a matching **Source Chats** section to Roleplay Chat Settings so sources can be added or removed after creation.

During Roleplay generation, inject a clearly labelled context block for each selected source:

- Conversation: existing weekly and daily summaries plus recent messages.
- Roleplay: enabled rolling summary content plus recent messages.
- Game: previous-session summary/current state context plus recent messages.

Source context is refreshed for every Roleplay generation. Missing or deleted sources are skipped without blocking generation.

## Risks

- Large source histories can increase prompt size. This change uses bounded recent-message windows and existing summarized history, but deliberately does not introduce user-facing budget controls.
- Source transcript content must be framed as reference material rather than instructions.
- Branch, deletion, import, and export behavior must not leave invalid source references.
- Existing Connected Chat behavior must remain unchanged.

## Validation

- Shared schema and storage tests for source creation, replacement, deletion, and target validation.
- Prompt regression coverage for Conversation, Roleplay, and Game source compilation.
- Client type/lint/build validation for the setup wizard and Chat Settings multi-select.
- `pnpm db:push` for the new relation.
- `pnpm check` as the baseline application validation.

