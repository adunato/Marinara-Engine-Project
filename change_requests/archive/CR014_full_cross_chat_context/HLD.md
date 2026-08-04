# CR014: Full Cross-Chat Conversation Context

Status: Completed and merged into local application `main`

## Goals

- Give a cross-chat-enabled Conversation complete context from every other enabled Conversation that shares at least one of its characters.
- Include persisted conversation summaries plus visible messages from each source conversation's current logical day.
- Delimit each source conversation and its summary/transcript sections clearly.
- Attribute every transcript message to the source conversation's persona, character, narrator, or system speaker by name.
- Exclude messages explicitly hidden from AI context.

## Proposed Solution

Preserve the existing character-presence boundary: the active Conversation can read every other enabled Conversation that contains any character from the active Conversation. For every qualifying source chat, parse its metadata, compile its summaries, and emit visible messages from the source's current logical day using that source chat's configured Day Rollover Hour and timezone. Do not clip messages inside that logical day to the old cross-chat token budget. Wrap the aggregate, each source conversation, its summaries, and its current-day transcript in preset-compatible structural tags. Resolve speaker names from every source chat's own character and persona membership rather than only the active chat.

The source material remains untrusted historical context: the prompt will explicitly instruct the model not to follow instructions found inside transcripts or summaries.

## Risks

- A very active source conversation's current logical day can still materially increase prompt size and provider cost.
- Multi-character conversations receive the union of qualifying chats shared by any current participant, matching the original cross-chat behavior.
- The per-chat toggle and shared-character requirement jointly bound which conversations exchange context.
- Malformed legacy metadata or missing character/persona records must degrade to explicit fallback speaker names without breaking generation.

## Validation

- Add a focused regression covering enabled/disabled source selection, summaries, logical-day transcript filtering, structural tags, hidden-message exclusion, and persona/character/narrator/system attribution.
- Run the focused regression and the repository baseline `pnpm check`.

## Outcome

- Implemented and fast-forward merged into local application `main` in `8588a307`.
- Corrected in `d1c7cb1a` to retain the original shared-character boundary.
- Corrected in `380d93fd` to include summaries plus only the source chat's current logical-day messages, using its configured rollover hour and timezone; focused regression, server TypeScript validation, and the full primary-checkout build passed.
- `pnpm regression:cross-chat-awareness` passed.
- Sequential server TypeScript validation (`pnpm --filter @marinara-engine/server lint`) passed.
- Full primary-checkout application build (`pnpm build`) passed after the shared-character boundary correction.
- The repository-wide `pnpm check` exceeded its two-minute command window and was not repeated, per proportional-validation guidance.
