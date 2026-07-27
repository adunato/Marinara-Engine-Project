# CR015: Daily Conversation Memories

Status: Proposed — awaiting detailed requirements and HLD approval

## Goals

- Add a built-in agent for creating and maintaining daily memories in Conversation mode.
- Add associated Conversation UI for configuring and using daily memories.
- Keep daily memories separate from, and complementary to, conversation summarisation.
- Allow daily memories to serve as an alternative to the current memory recall system without making the two features mutually exclusive.
- Preserve existing summarisation and memory recall behavior unless the user explicitly enables or configures the new functionality.

## Proposed Solution

Introduce a dedicated built-in daily-memory agent and Conversation-facing controls. The agent will derive durable, day-scoped memories from Conversation activity and make those memories available as generation context through a path independent from chat summaries and the existing memory recall system. Users may use daily memories alone or alongside either existing mechanism.

The detailed requirements will determine the memory schema and storage location, logical-day boundary, agent invocation cadence, prompt/context formatting, editing and deletion behavior, UI placement and controls, defaults, limits, and compatibility or migration behavior. No implementation should begin until those decisions are incorporated into this HLD and approved.

## Risks

- Overlap among summaries, daily memories, and recalled memories could duplicate context or produce contradictions.
- Automatic extraction may preserve incorrect, sensitive, or low-value information unless users have suitable visibility and control.
- Daily-memory generation and context injection may increase model usage and prompt size.
- Day-boundary and timezone behavior can create surprising grouping if it differs from existing Conversation semantics.
- New persisted data must remain compatible with existing chats, backup/export behavior, and deletion expectations.

## Validation

- Add focused unit or service-level coverage for the agreed daily-memory lifecycle and context-injection rules.
- Verify daily memories can operate independently and in combination with summarisation and current memory recall.
- Verify Conversation UI states, persistence, error handling, and relevant accessibility behavior.
- Run `pnpm check` for the substantive cross-cutting application change.
- Agree whether to add focused CR015 Playwright E2E validation once implementation is complete.

