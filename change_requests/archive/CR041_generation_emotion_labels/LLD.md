# Low-Level Design: Per-Message Generation Emotion Labels

## 1. Change Overview

CR041 adds durable generation provenance for CR035 emotion state and exposes it as a subtle subtitle on Roleplay and Conversation assistant messages.

The implementation introduces one optional message-extra field, resolves that field from the pre-generation CR035 state/default rules, persists it on the exact generated swipe, and renders it through shared client helpers. Existing post-generation `characterEmotions`, Expression Engine behaviour, prompt macros, database structure, and generation transport remain unchanged.

The implementation must preserve this invariant:

```text
state used by generation
    -> generationCharacterEmotions on that message/swipe

state classified from completed generation
    -> characterEmotions on that message/swipe
    -> eligible to influence a later generation
```

A continuation does not establish a clean new message provenance boundary, so it must not overwrite `generationCharacterEmotions` on the existing message.

---

## 2. File Changes

### `packages/shared/src/types/chat.ts`

**Action:** Modify

Add a shared type for one persisted generation emotion entry, for example:

```text
GenerationCharacterEmotionSnapshot {
  stateId: string;
  label: string;
}
```

Extend `MessageExtra` with:

```text
generationCharacterEmotions?: Record<string, GenerationCharacterEmotionSnapshot> | null
```

Requirements:

- keep the property optional for old messages and imports;
- keep `characterEmotions?: Record<string, string> | null` unchanged;
- document the semantic distinction in comments: `generationCharacterEmotions` is the pre-generation state used by this swipe, while `characterEmotions` is CR035's post-generation classification for subsequent state;
- do not introduce a database/schema migration because message extra already persists arbitrary JSON.

---

### `packages/server/src/services/generation/character-emotion-runtime.ts`

**Action:** Modify

Add a small pure resolver for one character's generation-state provenance and/or a map-building helper used by the generation route.

The helper must accept normalized/current emotion profile data plus the historical state selected from the active branch and return the exact configured state entry that should be treated as the generation state:

1. if the profile is absent or disabled, return no result;
2. if the persisted historical state ID exists in the current profile, select that state;
3. otherwise select the profile's configured default state;
4. return the configured `id` and `label` without rewriting either value.

A suitable public shape is conceptually:

```text
resolveGenerationEmotionSnapshot(
  profile,
  persistedStateId,
) -> { stateId, label } | null
```

or an equivalent map helper if that reduces route duplication.

Reuse existing profile normalization/state-membership utilities in this module. Do not call the Expression Engine and do not read the current response.

Where practical, use this resolver in existing server emotion preparation that applies the same persisted-state/default choice, so the generation snapshot cannot develop a subtly different fallback rule. Avoid broad CR035 refactoring if a focused shared helper is sufficient.

---

### `packages/server/src/routes/generate.routes.ts`

**Action:** Modify

This is the authoritative orchestration change.

#### Pre-generation capture

Immediately after the route has the active-history `persistedCharacterEmotions` and loaded character emotion-profile information, build an in-memory `generationCharacterEmotions` snapshot for the characters whose CR035 emotion profile is enabled and whose state participates in the generation.

The chosen `stateId` must be the same state assigned to the character's generation prompt context/card conditionals. Use the resolver from `character-emotion-runtime.ts`; do not read the later Expression Engine result.

For group generations, allow the map to contain multiple character IDs. Rendering will choose only the entry belonging to the visible speaker.

#### Normal assistant-message save

After `chats.createMessage(...)` has produced the durable assistant message and its active swipe index is known, persist the snapshot using:

```text
chats.updateMessageExtraForSwipe(messageId, swipeIndex, {
  generationCharacterEmotions
})
```

Only perform the write when the snapshot contains at least one valid entry.

Persist it before or independently of the generic post-generation agent-result loop so Expression Engine failure cannot remove generation provenance.

#### Regeneration save

When `input.regenerateMessageId` creates a new swipe through `chats.addSwipe(...)`:

- use the newly calculated generation snapshot from the regeneration request;
- write it to `createdSwipe.index` / the resulting target swipe;
- never copy the active old swipe's snapshot.

The current regeneration context already excludes the message being replaced before historic emotion collection; retain that behaviour.

#### Continuation

When `input.continueMessageId` appends content to an existing assistant message:

- do not persist the current continuation's generation state over the existing message snapshot;
- do not backfill a missing snapshot on an old message;
- leave the message/swipe extra untouched with respect to `generationCharacterEmotions`.

This is intentional because one message-level label cannot accurately represent multiple generation fragments.

#### Unsupported message paths

Do not write the snapshot for:

- impersonated/user messages;
- system/narrator messages;
- Game-only generation paths outside CR035 scope;
- message creation paths that are not a model-generated Roleplay/Conversation assistant response.

#### Existing post-generation persistence

Leave the current Expression Engine block that writes `spriteExpressions` and `characterEmotions` unchanged except for any local variable naming needed to make the two concepts unambiguous.

The two fields may coexist on the same swipe with different state IDs. That is valid and expected.

---

### `packages/client/src/lib/message-emotions.ts`

**Action:** Create

Create a small pure utility for reading generation-emotion provenance from message extra.

Responsibilities:

- accept a `Message`-like value and stable `characterId`;
- defensively handle object or legacy/string extra representations where necessary;
- verify that `generationCharacterEmotions` is a record;
- verify that the selected entry contains non-blank string `stateId` and `label`;
- return the trimmed persisted label, or `null` for absent/malformed data;
- optionally expose a typed entry resolver if Roleplay merged rendering needs both ID and label.

Conceptual API:

```text
resolveMessageGenerationEmotion(
  message,
  characterId,
) -> { stateId, label } | null

resolveMessageGenerationEmotionLabel(
  message,
  characterId,
) -> string | null
```

Do not consult the live character card and do not fall back to the internal state ID for display.

Keep the module DOM-free so it can be exercised by the focused regression script.

---

### `packages/client/src/components/chat/GenerationEmotionLabel.tsx`

**Action:** Create

Create one presentation-only component shared by Conversation and Roleplay renderers.

Responsibilities:

- render nothing for `null`, `undefined`, or blank labels;
- render the persisted label as subtle secondary text;
- support an optional `className` for layout-specific alignment without changing semantics.

Base styling should use Tailwind/theme tokens and remain understated, approximately:

```text
text-[0.625rem]
font-normal or font-medium
leading-tight
text-[var(--muted-foreground)]/60
```

Roleplay dark surfaces may pass an appropriate existing muted text class if needed for contrast, but the component must not introduce emotion-specific colours, badges, icons, or tooltips.

---

### `packages/client/src/components/chat/ConversationMessageShared.tsx`

**Action:** Modify

Extend the local `MessageData.extra` typing with the shared `MessageExtra["generationCharacterEmotions"]` field so Conversation rendering does not rely on untyped access.

Extend `MessageRenderContext` with a character-aware resolver:

```text
resolveGenerationEmotionLabel: (characterId: string) => string | null
```

This mirrors the existing character-aware `resolveExpressionAvatar` pattern but remains a pure metadata lookup.

No emotion-profile/card data should be added to `CharacterMap`; the persisted message snapshot is sufficient and preserves historical labels.

---

### `packages/client/src/components/chat/ConversationMessage.tsx`

**Action:** Modify

Import the message-emotion resolver and create a memo-safe callback around the current message, analogous to the expression-avatar resolver:

```text
resolveGenerationEmotionLabel(characterId)
```

Pass the resolver through `MessageRenderContext`.

For the ordinary single-speaker message, renderers will use `resolvedCharacterId`; for merged segments they will pass each segment's already-resolved stable character ID.

Do not derive labels from `primaryCharInfo`, current card emotion profile, or speaker text alone.

---

### `packages/client/src/components/chat/ConversationMessageLine.tsx`

**Action:** Modify

For a non-user, non-grouped assistant message with a resolvable character ID:

- resolve its generation emotion label;
- replace the current single-baseline name/timestamp arrangement with a small identity column containing name then emotion subtitle, while keeping timestamp aligned with the name row rather than the subtitle;
- preserve hidden-from-AI chrome and about-me name interaction.

For `isGrouped` consecutive messages where the full identity header is currently suppressed:

- render a compact emotion-only line before the message body when a label exists;
- do not repeat the full character name solely to expose emotion;
- do not add extra vertical space when the label is absent.

User messages remain unchanged.

---

### `packages/client/src/components/chat/ConversationMessageBubble.tsx`

**Action:** Modify

#### Ordinary assistant bubble

Use `resolveGenerationEmotionLabel` for the current stable character ID and render `GenerationEmotionLabel` directly beneath the visible name. Keep timestamp on the main name row.

#### Consecutive grouped bubble

When `isGrouped` suppresses the ordinary header, render a compact emotion-only line above the bubble if a label exists.

#### Multi-speaker grouped segments rendered inside the bubble component

For each `groupedSegments` speaker:

- resolve the stable speaker character ID using the existing `charIdByName`/character lookup path;
- resolve that ID's generation emotion label;
- render it directly below the segment speaker name and above segment content.

Narration segments without a speaker do not display an emotion label.

Do not infer one message-wide label and stamp it onto every speaker.

---

### `packages/client/src/components/chat/ConversationMessageGrouped.tsx`

**Action:** Modify

Use the existing `segCharacterId` resolution already used for expression portraits.

For each speaker segment in both grouped layout branches:

- resolve `segEmotionLabel = resolveGenerationEmotionLabel(segCharacterId)`;
- render `GenerationEmotionLabel` under `segName`;
- keep the first-segment timestamp and reaction-add affordance associated with the name row;
- preserve card CSS scoping and keep the emotion text inside the same speaker display subtree as the name so custom layout boundaries remain coherent.

Narration-only segments remain unchanged.

No additional speaker-name parsing logic is required.

---

### `packages/client/src/components/chat/ChatMessage.tsx`

**Action:** Modify

Use `resolveMessageGenerationEmotionLabel` for Roleplay messages.

#### Ordinary assistant character message

After `resolvedCharacterId` is known, derive the label for the current message/swipe. In every Roleplay header variant that presents the character name:

- keep the name as the primary line;
- add `GenerationEmotionLabel` immediately below it;
- keep timestamp/generation-info chrome aligned with the primary name row where applicable.

If an `isGrouped`/compact path suppresses the repeated name, show the emotion-only subtitle for that message in the suppressed-header location, matching the HLD's per-message visibility requirement.

Do not display the label for user/system/narrator/Game-only messages.

#### Merged Roleplay group presentation

Extend the existing merged identity items derived from `mergedCharacterIds`/`mergedAvatars` with each character's persisted generation emotion label.

Add a `mergedEmotionRef` (or equivalent) to the same existing `applyMergedCycleIndex` DOM-opacity update used for avatar and name cycling. The emotion label must use the same `cycleIndexRef` and 2-second cycle; do not create another timer.

When cycling is enabled:

- render stacked emotion-label spans with stable per-character ordering;
- toggle their opacity from the existing cycle function at the same time as avatar/name opacity;
- reserve only the minimal subtitle height required.

When reduced ambient effects or narrator cycling disables cycling:

- follow the same character presentation policy already used by the merged name/avatar UI;
- avoid presenting a label that cannot be associated with the currently represented identity.

If no valid persisted labels exist, preserve the exact current layout with no empty subtitle row.

---

### `scripts/regressions/generation-emotion-labels.regression.ts`

**Action:** Create

Add a focused pure/runtime regression covering the new contract.

Required assertions:

1. enabled profile + valid prior state returns that state ID and configured label;
2. enabled profile + missing prior state returns configured default ID/label;
3. enabled profile + invalid/removed prior state returns configured default ID/label;
4. disabled/missing profile returns no generation snapshot;
5. snapshot state and CR035 post-generation state can coexist with different IDs without normalization conflating them;
6. client resolver returns the persisted label from a valid snapshot;
7. client resolver returns `null` for legacy, missing, malformed, or blank-label data;
8. changing the live profile label in test fixtures does not alter the label already persisted in a message snapshot.

Keep this regression independent from LLM/provider execution.

---

### `scripts/regressions/regeneration-context.regression.ts`

**Action:** Modify

Extend the existing message-swipe storage section.

Before `addSwipe`, add generation-only metadata to the active message, including a representative `generationCharacterEmotions` entry. Then assert:

- the newly created fresh swipe does **not** inherit `generationCharacterEmotions`;
- after explicitly writing a different snapshot to that swipe via `updateMessageExtraForSwipe`, selecting the swipe mirrors the new snapshot to the active message extra;
- selecting the original swipe restores the original snapshot;
- existing retained structural metadata assertions (`isConversationStart`, hidden-character IDs, etc.) continue to pass.

This locks down the distinction between metadata that should survive swipe creation and generation provenance that must be freshly written.

---

### `package.json`

**Action:** Modify

Add a focused script for the new regression, for example:

```text
regression:generation-emotion-labels
```

The command should build shared types first and run `scripts/regressions/generation-emotion-labels.regression.ts` through the server workspace's `tsx`, consistent with existing regression commands.

Do not add redundant broad validation commands. The focused CR041 command and existing `regression:regeneration-context` should be run during development, followed by one `pnpm check` after the complete change.

Adding the new focused script to the repository-wide aggregate `regression` command is optional and should only be done if that aggregate is intended to include every focused contract regression; it is not required for CR041 correctness.

---

## 3. Cross-File Dependencies

1. `packages/shared/src/types/chat.ts` establishes the persisted snapshot contract consumed by server and client.
2. `character-emotion-runtime.ts` establishes the single-state resolution rule used to produce generation provenance.
3. `generate.routes.ts` captures the pre-generation state and writes it through the existing swipe-aware storage boundary.
4. `message-emotions.ts` interprets only the persisted message contract; it has no dependency on live character profiles.
5. `ConversationMessage.tsx` exposes the resolver through `MessageRenderContext`; line/bubble/grouped renderers consume it with their existing stable character-ID resolution.
6. `ChatMessage.tsx` consumes the same client resolver directly for Roleplay and synchronizes merged labels with its existing identity cycle.
7. The dedicated regression validates the semantic state contract; `regeneration-context.regression.ts` validates the swipe-storage contract.

### Intentionally unchanged implementation areas

- `packages/server/src/services/storage/chats.storage.ts`: its existing fresh-swipe and `updateMessageExtraForSwipe` behaviour is sufficient; CR041 should validate rather than redesign it.
- `packages/client/src/hooks/use-generate.ts`: existing completion handling primes persisted messages and then performs an authoritative background message refresh, so the durable snapshot should arrive without a new SSE event or transient store. Change this file only if implementation validation disproves that current behaviour.
- Expression Engine result types/prompts/agent packages: no contract change is required.
- character-card emotion profile schema/editor: no change is required.

---

## 4. File Change Summary

| File | Action | Purpose |
| --- | --- | --- |
| `packages/shared/src/types/chat.ts` | Modify | Add optional per-swipe generation emotion snapshot contract. |
| `packages/server/src/services/generation/character-emotion-runtime.ts` | Modify | Resolve valid/default generation state ID and historical label using CR035 rules. |
| `packages/server/src/routes/generate.routes.ts` | Modify | Capture pre-generation provenance and persist it on normal/new-swipe assistant outputs while preserving continuation semantics. |
| `packages/client/src/lib/message-emotions.ts` | Create | Defensively resolve persisted generation emotion entries/labels by character ID. |
| `packages/client/src/components/chat/GenerationEmotionLabel.tsx` | Create | Shared subtle emotion subtitle presentation. |
| `packages/client/src/components/chat/ConversationMessageShared.tsx` | Modify | Type generation metadata and expose the character-aware resolver through Conversation render context. |
| `packages/client/src/components/chat/ConversationMessage.tsx` | Modify | Wire the current message's generation-emotion resolver into Conversation layouts. |
| `packages/client/src/components/chat/ConversationMessageLine.tsx` | Modify | Show ordinary and grouped/consecutive line-layout emotion labels. |
| `packages/client/src/components/chat/ConversationMessageBubble.tsx` | Modify | Show ordinary, consecutive-grouped, and inline multi-speaker bubble labels. |
| `packages/client/src/components/chat/ConversationMessageGrouped.tsx` | Modify | Show per-speaker labels in merged Conversation line/bubble layouts. |
| `packages/client/src/components/chat/ChatMessage.tsx` | Modify | Show Roleplay labels and synchronize merged-group labels with the existing identity cycle. |
| `scripts/regressions/generation-emotion-labels.regression.ts` | Create | Prove state/default semantics and defensive client snapshot reading. |
| `scripts/regressions/regeneration-context.regression.ts` | Modify | Prove fresh swipes do not inherit generation provenance and active-swipe switching restores it correctly. |
| `package.json` | Modify | Expose the focused CR041 regression command. |
