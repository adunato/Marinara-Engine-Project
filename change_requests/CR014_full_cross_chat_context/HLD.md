# CR014: Full Cross-Chat Conversation Context

Status: Completed and merged into local application `main`

## Goals

- Give a cross-chat-enabled Conversation complete context from every other enabled Conversation that shares at least one of its characters.
- Include both persisted conversation summaries and the full visible transcript from each source conversation.
- Delimit each source conversation and its summary/transcript sections clearly.
- Attribute every transcript message to the source conversation's persona, character, narrator, or system speaker by name.
- Exclude messages explicitly hidden from AI context.

## Proposed Solution

Preserve the existing character-presence boundary while removing its recent-time-window and prompt-budget truncation: the active Conversation can read every other enabled Conversation that contains any character from the active Conversation. For every qualifying source chat, parse its metadata, compile its daily and weekly summaries, and emit the complete visible transcript. Wrap the aggregate, each source conversation, its summaries, and its transcript in preset-compatible structural tags. Resolve speaker names from every source chat's own character and persona membership rather than only the active chat.

The source material remains untrusted historical context: the prompt will explicitly instruct the model not to follow instructions found inside transcripts or summaries.

## Risks

- Large conversation histories can materially increase prompt size and provider cost; this is an intentional consequence of requesting full context.
- Multi-character conversations receive the union of qualifying chats shared by any current participant, matching the original cross-chat behavior.
- The per-chat toggle and shared-character requirement jointly bound which conversations exchange context.
- Malformed legacy metadata or missing character/persona records must degrade to explicit fallback speaker names without breaking generation.

## Validation

- Add a focused regression covering enabled/disabled source selection, summaries, complete transcripts, structural tags, hidden-message exclusion, and persona/character/narrator/system attribution.
- Run the focused regression and the repository baseline `pnpm check`.

## Outcome

- Implemented and fast-forward merged into local application `main` in `8588a307`.
- Corrected in `d1c7cb1a` to retain the original shared-character boundary while keeping CR014's complete summaries and transcripts; fast-forward merged into local application `main`.
- `pnpm regression:cross-chat-awareness` passed.
- Sequential server TypeScript validation (`pnpm --filter @marinara-engine/server lint`) passed.
- The repository-wide `pnpm check` exceeded its two-minute command window and was not repeated, per proportional-validation guidance.
