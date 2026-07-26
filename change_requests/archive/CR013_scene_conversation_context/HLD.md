# CR013: Scene Conversation Context Continuity

## Status

Closed on 2026-07-26. Implemented, validated, built, and merged into local application `main`.

## Goals

- Give a roleplay scene started from a Conversation with `/scene` the same historical continuity available to a normal Conversation generation.
- Include the Conversation summaries currently eligible for prompt context: consolidated weekly summaries, daily summaries not superseded by a weekly summary, and their important key details.
- Include every eligible message from the current logical conversation day rather than an arbitrary last-message or character-count slice.
- Respect the Conversation's timezone, configured day rollover, summary-tail behavior, hidden-message rules, speaker attribution, timestamp cleanup, and other existing context-selection policy.
- Use the same compiled context for scene planning and for subsequent generation inside the created roleplay scene.
- Preserve the context snapshot in `sceneConversationContext` so scene forks retain the same pre-scene continuity.

## Non-Goals

- Changing the `/scene` UI, prompt-preference modal, scene lifecycle, conclusion behavior, or character-initiated scene command UX.
- Adding a new user-configurable scene context size or token budget.
- Copying origin Conversation messages into the visible roleplay transcript.
- Regenerating historical summaries solely because a scene is being started.

## Current Problem

The scene planner currently reads only the last 20 origin messages and truncates them to the final 2,000 characters. Scene creation then independently rebuilds a different snapshot from the last 30 messages and truncates it to the final 3,000 characters. Neither path includes the Conversation's day/week summaries or guarantees the whole current conversation day. As a result, the planner and the roleplay scene can lose relationship history, earlier events from the same day, and facts that normal Conversation generation still receives.

## Proposed Solution

Extract a reusable, read-only Conversation-to-scene context compiler from the existing Conversation history policy. Given an origin Conversation and a capture time, it will produce a structured prompt-safe snapshot containing:

1. Important key details from the summary records currently used by Conversation generation.
2. Consolidated weekly summaries in chronological order.
3. Daily summaries in chronological order when they have not been superseded by a weekly summary.
4. The configured verbatim tail from summarized prior days, when enabled.
5. Every eligible message from the current logical day, using the chat's timezone and rollover hour.
6. Any older unsummarized history that the normal Conversation prompt would still pass through rather than silently dropping it.

The compiler should reuse or extract the existing bucketing, summary selection, speaker attribution, membership-event, reaction, hidden-message, timestamp, and formatting rules instead of establishing a second approximation. Prompt leaf content remains verbatim in accordance with `CONTRIBUTING.md`; structural wrappers are framework-owned.

`POST /scene/plan` will compile this snapshot and provide it to the planner instead of the current 20-message/2,000-character excerpt. The plan response will carry an opaque context snapshot (or stable server-owned equivalent) into `POST /scene/create`, so the created roleplay stores the same context the planner actually saw. The create route will retain a server-side fallback that recompiles from the origin for compatibility with older clients or callers that do not provide a snapshot.

`sceneConversationContext` remains the persisted handoff into roleplay prompt assembly. Its framing will describe a structured conversation-history snapshot rather than only a recent transcript. Existing scene context injection and fork continuity will consume the richer value without making the source messages visible in the scene chat.

Because the character-initiated scene flow uses the same plan/create endpoints, it may receive the same continuity improvement without a separate command-specific implementation. `/scene` remains the acceptance path for this CR.

## Risks

- Full current-day transcripts and accumulated summaries can materially increase prompt size. The implementation must rely on provider context budgeting or a documented deterministic truncation strategy that preserves summaries and the newest current-day turns while never returning to arbitrary fixed 2,000/3,000-character caps.
- Reusing generation history logic could accidentally trigger auto-summary writes during scene creation. The scene compiler must be read-only and consume summaries already present at capture time.
- Passing the snapshot through the client can expose it to accidental mutation or oversized request bodies. Treat it as opaque data, validate it, and prefer a server-issued capture identifier if that fits the existing architecture better.
- Planning and creation can race with new Conversation messages. The captured snapshot must be the source of truth for the resulting scene so both stages remain consistent.
- Summary and transcript content is untrusted prompt material. Keep it clearly framed as historical continuity, not instructions.

## Validation

- Focused server tests proving the snapshot includes weekly summaries, uncovered daily summaries, key details, configured summary tails, older unsummarized history, and every message in the current logical day.
- Boundary tests for timezone/day-rollover behavior, empty summaries, no current-day messages, hidden messages, narrator/membership events, group speaker names, and very large current days.
- Route tests proving `/scene/plan` receives the compiled snapshot and `/scene/create` persists that exact snapshot rather than independently selecting a different history slice.
- Compatibility coverage for create callers that omit the new snapshot field.
- Prompt regression coverage proving `injectSceneContextMessages` exposes the richer history once and scene forks preserve it once.
- Run the dedicated scene-context regression, shared contract build, and a server-only TypeScript check.

## Validation Result

- `pnpm regression:scene-context` passed. This builds `@marinara-engine/shared` and runs the dedicated CR013 regression.
- A server-only `tsc --noEmit` check passed against the worktree's generated shared declarations.
- Whole-project validation, client build, database checks, and E2E were intentionally not run because CR013 changes only the shared scene plan type and server-side context selection/injection.
