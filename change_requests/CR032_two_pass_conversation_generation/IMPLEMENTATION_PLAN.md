# CR032 Implementation Plan — Two-Pass Conversation Generation

## Status

Implemented on `change/CR032-two-pass-conversation-generation`. Focused source-parity/writer-isolation regression, server/shared type checks, targeted client lint, and the client production build pass. The repository-wide `pnpm check` exceeded its five-minute command timeout without reporting a failing stage; `pnpm db:push` is not defined in this checkout.

Manual browser validation and the decision on focused Playwright E2E remain open.

## Prerequisites

- Preserve the approved pipeline boundary, canonical shared-source invariant, and prompt bodies recorded in `HLD.md`.
- Perform all application work from a dedicated temporary worktree on `change/CR032-two-pass-conversation-generation`.
- Read `Marinara-Engine/CONTRIBUTING.md` and `packages/client/.instructions.md` before application edits.
- Preserve Standard Conversation generation as the default and comparison baseline.

## Atomic Tasks

### 1. Add shared settings and preset contracts

1. Add the normalized `standard | two_pass` Conversation pipeline type.
2. Add typed chat-metadata helpers for curator connection, curator output budget, and chat-local Briefing/Writer prompt overrides.
3. Extend the shared prompt-preset type with optional `conversationBriefingPrompt` and `conversationWriterPrompt` fields.
4. Preserve backward-compatible parsing for chats and presets without the new fields.

### 2. Extend prompt storage and lifecycle

1. Add the two optional prompt fields to prompt storage and its database/file-backed migration path.
2. Include them in preset CRUD, import, export, duplication, and bundled-preset seeding.
3. Seed the approved default Briefing and Writer prompts without copying `conversationPrompt` into either field.
4. Ensure existing preset migrations preserve user content.

### 3. Add Preset Editor controls

1. Read the client instructions before editing client code.
2. Add distinct Standard Conversation, Conversation Briefing, and Conversation Writer prompt editors.
3. Keep the two new prompt bodies independent and clearly explain when each is used.
4. Preserve existing preset variable and macro editing behaviour only where explicitly supported by the two new templates.
5. Add client validation and save/reset behaviour for the new fields.

### 4. Add Conversation General Settings UI

1. Add the Message generation pipeline selector to the General section for Conversation chats only.
2. Default missing values to Standard.
3. When Two-pass is selected, reveal curator connection, curator maximum output tokens, effective Briefing prompt, effective Writer prompt, edit/reset actions, and configuration status.
4. Label the regular Conversation prompt as inactive without hiding, deleting, or modifying it.
5. Warn when an enabled Prompt Patch agent is incompatible with the selected pipeline.
6. Preserve settings through normal chat metadata updates and refreshes.
7. Add accessible mobile and desktop layouts using existing settings components.

### 5. Resolve curator runtime configuration

1. Resolve the optional curator connection override, falling back only to the active chat connection.
2. Apply existing connection fallback, base URL, model access, timeout, retry, and abort behaviour.
3. Normalize the curator output-token budget independently of writer generation parameters.
4. Reject unavailable connections or missing prompt templates before starting generation.

### 6. Extract a reusable Conversation source package

1. Identify the resolved inputs currently embedded during Standard Conversation prompt construction.
2. Refactor only as needed to expose one immutable canonical source snapshot without changing Standard output.
3. Include character/persona Conversation fields, attachments or captions, auto summaries/current-day history, Daily Memories, Daily Intentions, Memory Recall, lore, current status/time/schedules, awareness, connected context, behaviour/About Me, generation guides, and applicable pre-generation context results.
4. Resolve retrieval, ranking, inclusion, responder-specific audience, lore, current-context, visibility, and macro decisions once, then share the resulting snapshot between renderers.
5. Add parity assertions proving Standard and curator rendering consume the same snapshot rather than rerunning source selection.
6. Keep Character Mind integration out of the first implementation while leaving an explicit source-extension point.

### 7. Implement the curator call

1. Build a dedicated curator message array from the approved Briefing prompt and resolved source package, never from the regular Conversation prompt body.
2. Treat source content as delimited data and preserve role/source attribution.
3. Execute the hidden call with the curator runtime, transport streaming as needed, timeout/retry support, and the request abort signal.
4. Emit progress without emitting curator tokens as visible content.
5. Accept a bounded non-empty briefing string without imposing an application-owned JSON schema.
6. Stop without fallback or message persistence on curator failure.

### 8. Implement the isolated writer handover

1. Add a writer-message builder whose input type accepts the effective Writer prompt, Conversation Briefing, and approved host-owned technical contracts but cannot accept Standard prompt messages.
2. Reconstruct required group output, timestamp, commands, and tool-use instructions in the writer system layer.
3. Continue supplying provider tool definitions through the existing tool interface where enabled.
4. Fit the isolated writer messages to the writer model's context and output limits.
5. Feed the resulting messages into the existing provider call, streaming, tool loop, response cleanup, and persistence logic.
6. Do not append raw recent messages or Standard context blocks after the briefing.

### 9. Integrate generation variants

1. Apply the pipeline selection to normal and autonomous Conversation messages.
2. Apply it to regeneration/swipes at the correct historical boundary.
3. Run one two-pass pair per responding character in individual group generation and one pair for merged generation.
4. Preserve supported impersonation identity scoping.
5. Leave existing turn-game bot short-circuits on their dedicated runtime.
6. Skip incompatible Prompt Patch execution for Two-pass generation with explicit diagnostics.

### 10. Add diagnostics and generation metadata

1. Add progress stages for curator preparation and response writing.
2. Extend debug/Peek Prompt data with active pipeline, curator input, briefing, and writer input.
3. Store the briefing only in hidden generation metadata, not as a chat message or agent output.
4. Record separate curator/writer provider, model, usage, duration, output limit, and prompt-source identifiers or hashes.
5. Record whether post-processing later rewrote the writer result.
6. Apply existing privacy/export expectations to the new diagnostic data.

### 11. Add focused regression coverage

1. Prove Standard is the default for existing and new chats.
2. Snapshot or compare Standard provider messages before and after the refactor.
3. Verify call order and provider selection for Two-pass generation.
4. Verify the writer sees the briefing but not source-only card, persona, summary, memory, transcript, lore, awareness, or agent-injection canaries.
5. Verify empty/missing prompt, missing connection, curator timeout/failure, writer failure, and user cancellation behaviour.
6. Verify no Standard fallback occurs after a Two-pass failure.
7. Cover normal, autonomous, regenerate, group, supported impersonation, attachment/caption, command, tool, and post-processing paths.
8. Cover Prompt Patch incompatibility and UI warnings.
9. Cover preset/chat import, export, duplication, backup, and metadata persistence.

### 12. Document and validate

1. Update prompt preset, Chat Settings, sending/streaming, and Peek Prompt documentation.
2. Explain that the regular Conversation prompt is bypassed only when Two-pass is active.
3. Explain provider/context exposure when the curator connection differs from the writer connection.
4. Run focused regressions, affected package type checks, and `pnpm check` once.
5. Run `pnpm db:push` if the prompt-preset storage migration requires schema verification.
6. After integration into the primary checkout, run the production build there before manual validation.
7. After implementation, agree with the user whether focused Playwright E2E validation should be created with the Marinara E2E skill.

## Expected Files and Areas

- `packages/shared/src/types/chat.ts`
- `packages/shared/src/types/prompt.ts`
- shared metadata/prompt normalization helpers
- `packages/server/src/db/schema/prompts.ts`
- prompt storage, seed, migration, import, and export services
- `packages/server/src/routes/generate.routes.ts`
- new focused server helpers under `packages/server/src/routes/generate/` or `packages/server/src/services/generation/` for source packaging, curator runtime, and writer-message construction
- `packages/client/src/components/chat/ChatSettingsDrawer.tsx`
- `packages/client/src/components/presets/PresetEditor.tsx`
- `packages/client/src/components/chat/PeekPromptModal.tsx`
- affected client API/store types and chat metadata helpers
- focused regression scripts/tests
- prompt, Chat Settings, and sending/streaming documentation

No Character Mind runtime, Daily Memory format, Daily Intentions format, release metadata, dependency, or version change is expected.

## Verification

1. Standard Conversation generation remains the default and produces the same effective provider input and response lifecycle as before.
2. Chat General Settings visibly controls pipeline selection and exposes all required Two-pass settings only when selected.
3. Presets and chat-local overrides resolve the correct Briefing and Writer templates without using the regular Conversation prompt.
4. The curator receives the complete resolved source package at the correct message/responder boundary.
5. The writer receives only its system prompt, the generated briefing, and explicitly approved host technical contracts.
6. Both calls use the correct connection, model policy, token budget, retry, timeout, and abort handling.
7. Streaming begins only from the writer while progress remains visible during curation.
8. Commands, tools, persistence, swipes, group attribution, and post-processing remain operational after the writer call.
9. Debug and stored generation metadata make both passes inspectable without rendering the briefing in chat.
10. Failure never silently falls back to Standard generation.
11. Focused regressions and `pnpm check` pass once, with database schema validation when applicable.

## Rollback

Revert the CR032 application commits. Existing chats then ignore the added metadata and use Standard Conversation generation. Preserve the optional preset fields in exported data if rollback compatibility is required; otherwise the older application will ignore unknown fields. No Conversation messages, memories, summaries, or Character Mind data require migration or deletion.

## Approval Gate

Implementation is approved. Any decision to pass raw recent messages directly to the writer, add a third model call, or integrate Character Mind remains a material scope change requiring explicit approval.
