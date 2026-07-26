# CR011 Conversation Custom Tracker HLD

Status: Implemented — merged into application main
Date: 2026-07-26

Approved by the user on 2026-07-26.

Implemented by application commit `21351e48` and merged into nested `main` by `fe50fb5a` on 2026-07-26. Follow-up validation found that the Conversation picker still excluded tracker-category agents; fix `cf05f215` exposes the official Custom Tracker in Chat Settings.

## Problem Statement

Conversation mode already has automatic Memory Recall, daily and weekly summaries, cross-chat awareness, and short-lived character memories. Those systems are useful for broad history, but they do not provide a compact, deterministic set of user-defined facts that is updated over time and injected into the next turn.

Roleplay already has an official **Custom Tracker** agent for this purpose. Users can maintain several named fields, the tracker agent updates their values after a reply, the values persist in the chat's game-state snapshots, and the latest committed values can be injected into later prompts. The official Custom Tracker and its visible tracker panel are currently presented as Roleplay-only.

CR011 extends that existing Custom Tracker experience to Conversation mode. It is an adaptation of the current tracker path, not a new memory database or a second tracker implementation.

## Goals

- Allow the official Custom Tracker agent to be selected and run in Conversation chats.
- Let Conversation users create, remove, rename, edit, and lock several custom tracker fields.
- Reuse the existing `custom_tracker_update` result contract and `game_state_snapshots.playerStats.customTrackerFields` persistence.
- Inject the latest committed Custom Tracker fields into subsequent Conversation prompts as concise established context.
- Preserve Conversation branching, regeneration, swipe, and commit semantics by using the existing message/swipe snapshot model.
- Reuse shared tracker UI and state-management code instead of copying the Roleplay HUD implementation.
- Preserve current Roleplay Custom Tracker behavior.

## Non-Goals

- Do not redesign Memory Recall, summaries, cross-chat awareness, or character memories.
- Do not add semantic search, vector storage, or CR009 agent-memory tools.
- Do not create cross-chat, character-global, persona-global, or account-global tracker state. CR011 is chat-scoped.
- Do not make the Custom Tracker prompt user-editable as part of this change. Users continue to define the tracker fields; the official agent package continues to own its prompt and output instructions.
- Do not introduce a new tracker schema, table, or storage backend.
- Do not enable the other Roleplay tracker agents in Conversation mode.

## Current Architecture

The existing path already provides most of the required behavior:

1. The official Custom Tracker returns `custom_tracker_update` data containing a `fields` array.
2. Generation result handling merges those fields into `playerStats.customTrackerFields` in the message/swipe game-state snapshot.
3. The committed tracker-context builder formats active Custom Tracker fields for prompt injection.
4. Roleplay tracker components display and edit several fields and their locks.
5. Agent selection respects installed package mode metadata.

The main gaps are official-package mode eligibility and a Conversation-appropriate UI entry point. Implementation must also verify that current snapshot loading, committed-context injection, retry, branching, and regeneration paths behave correctly in Conversation mode rather than assuming that mode-independent server code is sufficient.

## Proposed Solution

### Engine host support

- Treat the official `custom-tracker` agent as supported in Conversation when its installed manifest includes `conversation`.
- Keep the existing `custom_tracker_update` permission check and result application path.
- Continue storing multiple `{ name, value, ... }` fields in the existing game-state snapshot.
- Use the existing committed tracker-context injection for the next turn. If any path is hard-coded to Roleplay UI assumptions, generalize it narrowly for Custom Tracker rather than enabling unrelated trackers.
- Keep field edits and agent-produced updates subject to existing lock reconciliation.

### Conversation UI

- Show a compact **Custom Tracker** control in the Conversation surface when the official Custom Tracker is active for that chat.
- Open a panel/popover that reuses the shared Custom Tracker field editor.
- Support adding, removing, renaming, editing, and locking multiple fields.
- Persist manual edits through the same game-state patch path used by the existing tracker UI.
- Do not render the full Roleplay HUD in Conversation mode.

### Official agent package dependency

The Custom Tracker definition belongs to the separate `Pasta-Devs/Marinara-Agents` repository. The installed 1.0.1 package used for local validation has no restrictive mode allowlist and its prompt/output contract is mode-neutral, so Engine can run it in Conversation without duplicating the definition. A companion package metadata follow-up should update its Roleplay-only description and may declare the supported modes explicitly.

## Implementation Result

- Conversation mode permits only the official `custom-tracker` pipeline agent; other Roleplay agents remain excluded.
- The existing responsive Tracker Panel is available in Conversation only while Custom Tracker is active.
- Conversation gets a compact **Custom Tracker** toolbar entry point on desktop and mobile.
- The existing multi-field editor, add/remove/rename/value editing, locks, snapshot patching, agent result application, and committed prompt context are reused.
- An empty Conversation can create its first tracker field before any game-state snapshot exists; the existing manual patch route creates that first snapshot.
- Deterministic coverage is available as `pnpm regression:conversation-custom-tracker`.
- Focused Playwright coverage validates the user-facing Conversation setup flow and persisted/model-updated tracker behavior on desktop and mobile.

## Data Flow

1. User enables Custom Tracker for a Conversation chat and defines one or more fields.
2. The latest committed field values are injected into the Conversation prompt as established context.
3. The normal Conversation reply is generated.
4. Custom Tracker runs in its existing post-processing phase and returns the complete updated field array.
5. Engine applies unlocked changes to the current message/swipe snapshot.
6. That snapshot becomes the source for the next committed turn, branch, regeneration, and UI display according to existing snapshot rules.

## Risks

- Some tracker code is mode-independent on the server but only exercised through Roleplay UI, so Conversation-specific branch or regeneration defects may be latent.
- Rendering a second copy of the tracker editor would cause behavior drift; shared components must be reused or extracted.
- The tracker replaces the field array, so lock reconciliation and preservation of user-defined field names are essential.
- Running a post-processing tracker adds an extra model call at its configured cadence.
- Too many or overly verbose fields can increase prompt size; formatting should remain compact and bounded by the existing tracker representation.
- Engine and official-agent package releases must remain compatible while the supported-mode change is rolled out.

## Validation

- Verify the official Custom Tracker can be selected for a Conversation chat when its manifest permits Conversation mode.
- Verify several fields can be added, edited, renamed, locked, unlocked, and removed from the Conversation UI.
- Verify agent output updates unlocked values and preserves locked fields.
- Verify the latest committed fields are injected into the following Conversation prompt.
- Verify regeneration, alternate swipes, message deletion, and branching select the correct snapshot without leaking future state backward.
- Verify group Conversation mode retains the same chat-scoped tracker state.
- Verify disabling or removing Custom Tracker stops its execution and prompt injection without deleting stored fields.
- Verify existing Roleplay Custom Tracker behavior remains unchanged.
- Add focused deterministic regression coverage for persistence and prompt formatting.
- Run `pnpm check` from `Marinara-Engine/`.
- After implementation, agree whether to add and run focused CR011 Playwright E2E validation from the parent repository.
