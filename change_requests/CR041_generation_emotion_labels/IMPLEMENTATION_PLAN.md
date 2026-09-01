# Implementation Plan: Per-Message Generation Emotion Labels

## 1. Implementation Summary

Implement CR041 by adding a generation-time emotion provenance field to message/swipe extra metadata, capturing it from the same CR035 state resolution used before generation, and rendering the persisted human-readable label in Roleplay and Conversation message headers.

The work has three dependent layers:

1. define and resolve the generation-emotion snapshot;
2. persist it on the exact generated message/swipe without changing CR035's post-generation `characterEmotions` flow;
3. render the correct per-character label across ordinary, grouped, and merged chat layouts.

Regeneration and continuation semantics must be handled explicitly because they differ from ordinary message creation.

---

## 2. HLD Reference

The approved HLD constrains implementation as follows:

- `generationCharacterEmotions` is separate from CR035 `characterEmotions`; the former describes the state that shaped the current generation, while the latter remains the post-generation state used by future turns.
- The snapshot stores both state ID and label so historical UI does not depend on the current character card.
- The snapshot is per swipe and must be written using existing message/swipe extra persistence.
- No extra model or Expression Engine invocation is allowed.
- Conversation and Roleplay assistant character messages are in scope; legacy messages and characters without enabled emotion profiles remain unlabeled.
- Merged/group output must resolve labels per visible character, and suppressed repeated headers must not suppress the per-message emotion indicator.
- Continuation retains the original message snapshot rather than overwriting provenance for already existing text.

---

## 3. Repository Assessment

Repository inspection confirms the change can extend existing CR035 and message-rendering patterns rather than introducing a parallel subsystem.

### Existing generation state resolution

`packages/server/src/services/generation/character-emotion-runtime.ts` already contains the history and defaulting rules needed by CR035:

- `collectLatestCharacterEmotions` reads the latest stored post-generation state per character;
- `resolveCharacterEmotionStateMap` validates stored states against the current profile and applies the configured default when necessary;
- emotion-profile state entries already contain ID and human-readable label.

`packages/server/src/routes/generate.routes.ts` resolves emotion history before prompt construction and passes it into prompt macro context. The same route later saves the assistant message/new swipe and separately persists Expression Engine `characterEmotions` onto the resulting swipe.

### Existing swipe persistence

`packages/server/src/services/storage/chats.storage.ts` already provides `updateMessageExtraForSwipe`, which updates a specific swipe and mirrors its metadata to the message record only when that swipe is active. `addSwipe` creates fresh generation metadata instead of copying expression/emotion output from the previous swipe. This is the correct persistence model for CR041.

### Existing client rendering

Conversation rendering is split through `ConversationMessage.tsx` into line, bubble, and grouped components, with shared identity/render context in `ConversationMessageShared.tsx`. Merged Conversation responses already resolve each speaker to a stable character ID.

Roleplay rendering lives primarily in `ChatMessage.tsx`. Ordinary messages resolve a stable character ID, while merged Roleplay output has an existing cycling avatar/name presentation that can also drive the emotion subtitle.

The client generation hook already reconciles persisted messages through the existing React Query message lifecycle. CR041 should not add an SSE-only emotion state unless implementation proves the normal durable-message refresh is insufficient.

### Implementation constraints discovered

- The value displayed must be captured before post-generation agents run.
- The message/swipe identifier is only available after the generated response has been saved, so generation provenance must be held in memory and persisted immediately after the durable message/swipe boundary is established.
- Regeneration filters the target message from generation context and then creates a new swipe; its snapshot must therefore be newly calculated and written to that new swipe.
- Continuation mutates an existing assistant message and cannot truthfully represent multiple generation states with one message-level label. The HLD deliberately keeps the original snapshot.
- There is no client unit-test runner in the client package; focused server/shared regression coverage plus optional Playwright UI validation is the repository-compatible validation shape.

---

## 4. Prerequisites

- Use application branch `change/CR041-generation-emotion-labels` from `Marinara-Engine/main` when implementation begins.
- Create the application worktree through the repository change-request worktree workflow; do not implement in the nested primary checkout.
- Read `packages/client/.instructions.md` before client edits.
- Reconfirm the generation save/regeneration/continuation blocks in `generate.routes.ts` in the implementation worktree before editing, because that route is actively developed and line-level structure may have moved.
- Preserve CR035 behaviour as the reference baseline; no Expression Engine contract or Marinara-Agents package change is expected.

---

## 5. Implementation Approach

### 5.1 Define the generation-emotion snapshot contract

Extend shared message-extra typing with an optional per-character generation snapshot containing:

- `stateId` — the stable CR035 emotion state ID;
- `label` — the human-readable label configured on that state at generation time.

Keep the field optional and tolerant of missing data so existing stored messages require no migration.

### 5.2 Resolve generation provenance before the model call

Add a focused server helper around CR035 emotion-profile normalization/state resolution that can produce a validated generation snapshot from:

- the relevant character profiles;
- the active branch/swipe emotion history;
- the configured default state when history is absent or invalid.

The helper must use the same semantics as prompt `charEmotion`. Regression coverage should compare the resolved snapshot state against the state exposed to prompt construction for representative valid-history, missing-history, and invalid-history cases.

Do not derive the snapshot from the Expression Engine result.

### 5.3 Persist the snapshot on the generated message/swipe

In the generation route:

- calculate and retain the generation snapshot before response generation;
- after a normal assistant message is created, write the snapshot to its active swipe/message extra;
- after regeneration creates a new swipe, write the newly calculated snapshot to that new swipe;
- perform this write independently of later Expression Engine result processing;
- do not write generation emotion metadata to user, narrator, system, impersonated, or unsupported Game messages;
- on continuation, leave the existing snapshot untouched.

Use `updateMessageExtraForSwipe` so active-swipe mirroring and later swipe switching continue to use the established storage behaviour.

### 5.4 Preserve clean swipe semantics

Confirm the storage layer's fresh-swipe metadata does not retain `generationCharacterEmotions` from the previous swipe. Add regression assertions alongside the existing regeneration/swipe metadata coverage so future changes cannot accidentally copy this provenance.

No database schema change should be needed.

### 5.5 Add a shared client snapshot resolver

Add a small client utility that safely reads `generationCharacterEmotions` from a message and returns a valid label for a requested character ID.

The resolver should:

- tolerate absent or malformed legacy metadata;
- return `null` rather than expose internal IDs as UI fallback text;
- use only the persisted label, not the current live character profile.

Both Roleplay and Conversation renderers should use this helper so they share the same compatibility behaviour.

### 5.6 Render Conversation labels

Extend the Conversation message render context with generation-emotion resolution and add a small shared subtitle component/style.

Apply it to:

- ordinary line headers;
- ordinary bubble headers;
- consecutive grouped messages where the full repeated header is suppressed;
- merged/group line speaker headers;
- merged/group bubble speaker headers.

Resolve the label from the stable speaker character ID already used for expression-avatar mapping. Do not infer emotion by speaker name when a stable ID is available.

### 5.7 Render Roleplay labels

In `ChatMessage.tsx`:

- resolve the snapshot for ordinary assistant character messages and render it directly beneath the character name;
- preserve existing user/system/narrator handling;
- when normal grouping suppresses repeated identity chrome, render an emotion-only indicator for the message;
- for merged Roleplay messages, bind the subtitle to the same character-cycle identity used by the existing avatar/name presentation so the visible name/avatar/emotion remain synchronized.

Avoid introducing an independent timer or cycle index for the emotion label.

### 5.8 Preserve existing client reconciliation

Use the current durable-message/cache reconciliation path. The initial implementation should not add an SSE event solely for this metadata.

During implementation validation, confirm that a newly completed message receives its persisted snapshot in the UI without requiring a manual refresh. If the existing completion reconciliation does not fetch the new extra metadata, make the smallest necessary change in `use-generate.ts` to invalidate/reconcile messages on completion; do not add a separate transient emotion store.

### 5.9 Add focused regression coverage

Extend existing server regression coverage and, where clearer, add one focused CR041 regression script to prove:

- valid historical state and default fallback snapshot resolution;
- generation snapshot and post-generation `characterEmotions` remain independent concepts;
- new swipes do not inherit generation snapshots;
- per-swipe extra survives active-swipe switching;
- continuation persistence policy leaves the original snapshot unchanged;
- malformed or legacy metadata remains safe.

UI correctness should be manually checked in both layouts. Focused Playwright coverage is recommended after implementation, subject to the repository's required user decision at validation time.

---

## 6. Implementation Sequence

1. Add the shared message-extra snapshot type.
2. Add/extend the CR035 server emotion-resolution helper so generation provenance can be produced deterministically.
3. Capture the generation snapshot in `generate.routes.ts` before generation and persist it after normal/new-swipe saves.
4. Add storage/regeneration regression assertions before touching UI so swipe semantics are locked down.
5. Add the shared client resolver and Conversation render-context support.
6. Implement Conversation ordinary/grouped/merged labels.
7. Implement Roleplay ordinary/grouped/merged labels, reusing the existing merged identity cycle.
8. Verify durable client reconciliation; touch `use-generate.ts` only if the persisted extra is not naturally reflected after completion.
9. Run focused regressions and `pnpm check` once after the cross-package implementation is complete.
10. Hand off to validation and decide with the user whether to add focused Playwright E2E coverage.

The ordering matters because the UI should be built against the final persisted contract rather than a temporary client-only representation.

---

## 7. Files Affected

Expected implementation surface, subject to confirmation in the implementation worktree:

- `packages/shared/src/types/chat.ts` — generation-emotion snapshot and message-extra typing.
- `packages/server/src/services/generation/character-emotion-runtime.ts` — generation-state snapshot resolution helper.
- `packages/server/src/routes/generate.routes.ts` — capture and per-swipe persistence at normal/regeneration save boundaries; continuation policy.
- `packages/server/src/services/storage/chats.storage.ts` — likely no production logic change, but verify fresh-swipe behaviour; change only if needed to make generation provenance explicitly non-retained.
- `packages/client/src/lib/message-emotions.ts` — new shared defensive message-snapshot resolver.
- `packages/client/src/components/chat/ConversationMessageShared.tsx` — typed Conversation extra/render context and shared subtitle presentation.
- `packages/client/src/components/chat/ConversationMessage.tsx` — wire snapshot resolution into Conversation render context.
- `packages/client/src/components/chat/ConversationMessageLine.tsx` — ordinary and grouped line presentation.
- `packages/client/src/components/chat/ConversationMessageBubble.tsx` — ordinary, grouped, and per-speaker bubble presentation.
- `packages/client/src/components/chat/ConversationMessageGrouped.tsx` — merged speaker presentation.
- `packages/client/src/components/chat/ChatMessage.tsx` — Roleplay ordinary/grouped/merged presentation.
- `packages/client/src/hooks/use-generate.ts` — only if final persisted-message reconciliation proves insufficient; no change is preferred.
- `scripts/regressions/regeneration-context.regression.ts` — swipe freshness/active-swipe persistence assertions.
- a focused CR041 regression under `scripts/regressions/` if the server resolution contract is clearer as a dedicated script.
- root `package.json` only if a dedicated regression command is added.

The LLD will finalize the file-level responsibilities and distinguish required changes from conditional ones before development.

---

## 8. Development Integrity Checks

During development:

- run the focused CR041/CR035 emotion regression(s);
- run the regeneration-context regression after swipe persistence changes;
- run the smallest relevant TypeScript/build check while iterating if needed;
- after the complete shared/server/client change is assembled, run `pnpm check` once as the substantive cross-cutting repository check.

No database push is expected because the change uses existing JSON message extra. No version/release metadata check is expected unless implementation unexpectedly changes release-bearing files.

---

## 9. Validation Requirements

### Unit / Focused Regression Validation

- A valid previous CR035 state resolves to the same state used for generation and is snapshotted with its configured label.
- Missing or invalid previous state falls back to the profile default and snapshots the default label.
- Disabled/missing profiles produce no snapshot.
- A generated message can persist generation state A and post-generation state B simultaneously without either field overwriting the other.
- A regeneration creates a fresh swipe and does not inherit the prior swipe's generation snapshot.
- Selecting a different swipe restores the corresponding generation snapshot through existing message-extra mirroring.
- Continuation does not overwrite an existing snapshot or create misleading provenance on a legacy message.

### End-to-End Validation

If focused Playwright E2E is agreed after implementation, it should prove at minimum:

- a CR035-enabled character produces a visible subtle emotion subtitle on a completed response;
- two swipes with distinct generation snapshots display the matching label when toggled;
- a merged/group Conversation response associates different labels with the correct speakers;
- a Roleplay message displays the subtitle without disrupting existing avatar/name/message layout.

### Other Relevant Validation

Manual visual checks should cover desktop and compact/mobile widths, light/dark themes where practical, Conversation line and bubble styles, ordinary Roleplay, and merged Roleplay identity cycling.

---

## 10. Open Implementation Questions

No product/design questions remain.

One implementation-time check remains conditional: whether existing generation completion reconciliation automatically exposes the newly persisted extra metadata immediately. The preferred design is to reuse the current message refresh path; `use-generate.ts` should only change if validation demonstrates a real stale-cache gap.

---

## 11. Low-Level Design Decision

**LLD required:** Yes

### Rationale

A separate LLD is justified because the change spans several tightly coupled implementation areas despite its small visible UI:

- shared message metadata;
- CR035 state resolution;
- normal, regeneration, and continuation save semantics;
- per-swipe storage behaviour;
- two different message-rendering families;
- multiple grouped/merged identity variants.

The most important risk is semantic rather than visual: the implementation must never confuse the pre-generation state with CR035's post-generation state. File-level design is also needed to make the exact group-speaker and Roleplay merged-cycle integration explicit before coding.

The LLD should therefore finalize the required file inventory, the exact helper responsibilities, the save-boundary ordering, and the renderer-specific placement rules.

---

## 12. Verification

Implementation is ready for validation when:

- the shared snapshot contract is typed and backward compatible;
- server regression evidence proves generation-state/default semantics and independent post-generation state;
- normal and regenerated message/swipe snapshots persist correctly;
- continuation retains original provenance;
- all in-scope Conversation and Roleplay render variants show the correct label without affecting unsupported messages;
- switching swipes updates the label from durable metadata;
- `pnpm check` passes.

---

## 13. Rollback

Rollback is straightforward because the new message-extra field is optional and ignored by older code.

Revert the CR041 application commits. Existing messages that already contain `generationCharacterEmotions` remain readable; older builds will ignore the unknown JSON extra field. No data migration or cleanup is required, and CR035 `characterEmotions`, `charEmotion`, and Expression Engine behaviour remain intact.

---

## 14. Implementation Checklist

- [ ] Add the shared `generationCharacterEmotions` message-extra contract.
- [ ] Add deterministic generation-state/label snapshot resolution using CR035 semantics.
- [ ] Persist snapshots on normal assistant messages and newly generated swipes.
- [ ] Preserve continuation and fresh-swipe provenance rules.
- [ ] Add shared client snapshot resolution.
- [ ] Render Conversation labels in ordinary, grouped, and merged layouts.
- [ ] Render Roleplay labels in ordinary, grouped, and merged/cycling layouts.
- [ ] Verify existing client message reconciliation and change it only if required.
- [ ] Add focused server/storage regression coverage.
- [ ] Complete relevant development integrity checks, including `pnpm check`.
- [ ] Complete implementation summary for hand-off to validation and decide on focused Playwright E2E coverage.
