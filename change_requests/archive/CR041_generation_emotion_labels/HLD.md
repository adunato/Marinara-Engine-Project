# High-Level Design: Per-Message Generation Emotion Labels

**Status:** Approved for implementation planning

## 1. Summary

CR041 makes CR035's emotional-state mechanics visible in the chat transcript without changing how those mechanics work.

For every newly generated Roleplay or Conversation assistant message whose character has an enabled CR035 emotion profile, Marinara will persist a small generation-time snapshot of the emotional state that was actually supplied to that generation. The chat UI will display the state's human-readable label subtly beneath the character name.

The key design requirement is to distinguish the emotion that **generated the current response** from the emotion that the post-generation Expression Engine **classifies from that response**. CR035's existing `characterEmotions` metadata remains the latter and continues to drive the following turn. CR041 adds separate metadata for the former so the label shown on a message is truthful.

### Goals

- Make the emotional/personality state used for a generated response visible to the user.
- Preserve CR035's current post-generation classification, avatar, swipe, and `charEmotion` behaviour unchanged.
- Keep the label historically stable even if the character's emotion-profile labels are edited later.
- Support ordinary and grouped Roleplay and Conversation message layouts without adding another model call.

---

## 2. Current State

CR035 gives characters an optional emotion profile containing stable state IDs, human-readable labels, classifier descriptions, and optional sprite-expression mappings.

Before a generation, Marinara resolves the current emotion for each relevant character from the active message/swipe history. A valid persisted CR035 state is used when available; otherwise the character's configured default state is used. That resolved state is exposed to prompt construction as `charEmotion`, allowing character-card conditionals to select state-dependent personality text.

After the model has produced the response, the existing Expression Engine may classify the completed response. Its selected state is persisted per character in the generated message/swipe as `characterEmotions`. That post-generation state is then eligible to become `charEmotion` on the following generation. The same post-generation processing can also persist sprite expressions used for the message avatar.

This produces an intentional one-turn relationship:

- the state on an earlier selected message/swipe can influence the next generated response;
- the state classified from the newly generated response is stored on that response for later use.

The chat UI currently exposes the expression/avatar effect but does not show the emotional-state name. A user therefore cannot see which state selected the personality branch used to generate a particular response.

Using the current message's `characterEmotions` directly as the new UI label would be incorrect because that value was classified **after** the response was written and normally influences the next response instead.

---

## 3. Requirements

### Functional Requirements

- For newly generated Roleplay and Conversation assistant messages, capture the resolved CR035 emotion state that was supplied to generation for every relevant character with an enabled emotion profile.
- Persist that generation-time state independently from the existing post-generation `characterEmotions` value.
- Persist both the stable state ID and the human-readable state label so historical messages do not change meaning when the character card is edited later.
- Store the snapshot per message swipe so different regenerations can display the state actually used for each swipe.
- Display the generation emotion label beneath the character's name in a small, visually muted style.
- In merged/group responses, resolve and display the correct label independently for each visible speaker.
- Where normal consecutive-message grouping suppresses the repeated character name/header, still show the emotion label for each generated response rather than hiding the only visible indication of its state.
- Switching the active swipe must switch the displayed generation emotion with the rest of that swipe's metadata.
- A newly generated swipe must not inherit the snapshot from the previously active swipe.
- Messages created before CR041 must remain valid and render normally without an emotion label.
- Characters without an enabled CR035 emotion profile must render exactly as they do today.
- No additional LLM or Expression Engine call may be introduced.

### Constraints and Important Conditions

- CR035 remains authoritative for emotion-profile configuration, post-generation classification, `characterEmotions`, `charEmotion`, and expression-avatar behaviour.
- CR041 must not reinterpret the current message's post-generation state as the state that generated that same message.
- The generation snapshot must be derived from the same validated/defaulted state semantics used by prompt construction: valid prior state first, configured default otherwise.
- The snapshot is generation provenance. It must not become a new source for future `charEmotion` resolution; future turns continue to use CR035's existing `characterEmotions` history.
- Conversation and Roleplay are in scope because they are the CR035 runtime surfaces. Game, user, narrator, and system-message emotion labels are out of scope.
- A manual edit to generated text does not remove the generation snapshot; the snapshot describes the generation context originally used, in the same spirit as other generation metadata.
- Continuing an existing assistant message is a special case because one visible message may then contain text produced by more than one generation with different emotion inputs. CR041 will retain the snapshot from the message's original generation and will not overwrite it on continuation. A legacy message with no snapshot remains unlabeled when continued. Fragment-level continuation provenance is out of scope.
- The feature must follow the existing message/swipe persistence model rather than adding a new database table or chat-level state.

---

## 4. Expected Outcome

### Before

A CR035-enabled character can change avatar and personality branch according to emotional state, but the transcript does not tell the user which state shaped a specific generated response. The only persisted emotion on that response is normally the state classified from it for subsequent use, so displaying that value on the same response would misrepresent the generation process.

### After

Each newly generated CR035-enabled assistant response carries a separate per-swipe generation snapshot such as:

```text
generationCharacterEmotions[characterId] = {
  stateId: "wary-grounded",
  label: "Wary / Grounded"
}
```

The UI can therefore render, conceptually:

```text
Mira
Wary / Grounded
<message content>
```

The subtitle is subtle rather than badge-like, but remains visible for the message. Selecting a different swipe selects its own persisted snapshot and therefore its own label.

The existing post-generation `characterEmotions` value remains separate and continues to affect later generation exactly as it does today.

---

## 5. Proposed Design

CR041 adds a second, explicitly generation-time emotion snapshot to message extra metadata.

The two emotion concepts are intentionally distinct:

| Metadata | Meaning | Used for future prompt state? | Shown as this message's generation label? |
| --- | --- | --- | --- |
| `generationCharacterEmotions` | Validated/defaulted emotion that shaped this generation | No | Yes |
| `characterEmotions` | Emotion classified from the completed response by CR035 | Yes | No |

The generation route already resolves the historical emotion state before prompt construction. CR041 will preserve the corresponding validated/defaulted state and its configured label as in-memory generation provenance. Once the generated assistant message or regeneration swipe has been durably created, Marinara will persist that snapshot onto that exact swipe using the existing swipe-aware message-extra mechanism.

Persistence should occur independently of post-generation agents. The label therefore remains available even if the Expression Engine is disabled for that turn, fails, or produces no new post-generation classification. The presence of the snapshot does not itself enable or invoke the Expression Engine.

The UI reads only the persisted generation snapshot. It does not recalculate historical labels from the live character card. This avoids historical drift when an author renames or removes an emotion state after messages have already been generated.

A small shared client-side resolver should interpret the snapshot consistently for the Roleplay and Conversation message families. Renderers then ask for the label associated with the character they are currently displaying.

### High-Level Flow

1. A Roleplay or Conversation generation begins.
2. Marinara resolves the current CR035 emotion state for each relevant enabled character using existing active-history/default rules.
3. Prompt construction receives that state through the existing `charEmotion` path.
4. CR041 records the same generation state ID plus its configured label in an in-memory snapshot for this generation.
5. The LLM produces the response.
6. Marinara creates the assistant message or new regeneration swipe.
7. Marinara persists `generationCharacterEmotions` on that specific message/swipe before or independently of post-generation Expression Engine persistence.
8. Existing post-generation processing may separately write `characterEmotions` and sprite-expression metadata.
9. The client receives/refetches the durable message through the existing message-query lifecycle.
10. The relevant message renderer resolves the visible speaker's generation snapshot and shows its label under the speaker name.
11. If the user changes swipe, existing swipe selection restores that swipe's extra metadata, including its generation snapshot, and the displayed label changes with it.

---

## 6. Backend Changes

### Generation-time provenance capture

Generation will retain a per-character snapshot representing the validated/defaulted CR035 state used for that request. The snapshot contains only stable generation provenance required by the UI: state ID and label.

The snapshot must be derived before response generation, not from the Expression Engine's later result. Where the current generation route separately applies the same profile validation/default rules for macro construction and character prompt information, implementation must ensure the persisted snapshot follows those same rules and is covered by regression tests so it cannot silently diverge from `charEmotion` semantics.

### Swipe-aware persistence

The existing message storage layer already supports merging extra metadata into a specific swipe and mirroring it to the message record when that swipe is active. CR041 will use that mechanism rather than adding a new persistence model.

Normal generation writes the snapshot to the newly created assistant message's active swipe. Regeneration writes the newly resolved snapshot to the newly created swipe. Existing swipe creation already starts from a deliberately fresh generation-metadata shape rather than copying prior expression/emotion output; the CR041 snapshot must remain generation-specific and must not be copied from the previous swipe.

### Continuations

A continuation updates an existing assistant message rather than creating a clean new message/swipe provenance boundary. CR041 will not replace the existing generation snapshot during continuation. This avoids claiming that the continuation's state generated text that already existed in the message.

### No change to post-generation classification

Expression Engine input, classification, validation, `characterEmotions`, sprite mappings, and next-turn state resolution remain unchanged. CR041 persistence must not alter which state is selected on later turns.

---

## 7. UI and User Experience Changes

For supported assistant messages with a generation snapshot, the emotional-state label appears immediately below the displayed character name.

The presentation should be intentionally secondary:

- approximately 10–11 px text;
- normal or medium weight rather than bold;
- muted foreground colour/opacity;
- tight line height and minimal additional vertical spacing;
- no emoji, badge, pill, or semantic colour coding.

The existing character name remains the primary identity element.

### Conversation layouts

Both line and bubble layouts will show the subtitle beneath the character name. Merged/group Conversation responses already resolve each speaker to a stable character identity; each speaker segment will resolve its own label from the message's snapshot.

When consecutive-message grouping suppresses the repeated name/header, the message will still render a small emotion-only line so the state remains visible per response without unnecessarily repeating the full identity header.

### Roleplay layouts

Ordinary character messages will show the subtitle beneath the character name in the relevant Roleplay message header.

Merged Roleplay responses currently use a narrator-style identity presentation that cycles through participating character avatars/names. When more than one character has generation emotion metadata, the emotion subtitle should cycle in sync with the existing character identity presentation rather than presenting an ambiguous combined list.

### Streaming

No new SSE event is required solely to transport the label before the durable message exists. Existing streaming presentation can continue unchanged; the label becomes authoritative when the persisted message/swipe metadata is available through the normal message-query reconciliation. This avoids adding a parallel transient state that could disagree with persistence.

---

## 8. Data and State

CR041 adds an optional field to message extra metadata conceptually shaped as:

```text
generationCharacterEmotions?: Record<
  characterId,
  {
    stateId: string;
    label: string;
  }
> | null
```

The field is optional for backward compatibility.

### Ownership

- The server generation pipeline owns creation of the snapshot.
- Message/swipe extra owns persistence.
- The client treats the snapshot as read-only display metadata.
- Character emotion profiles remain the source of valid IDs and labels at generation time.
- CR035 `characterEmotions` remains the source used to resolve future prompt emotion state.

### State transitions

- **New message:** no historical snapshot exists; generation resolves one and persists it when applicable.
- **New swipe/regeneration:** the new swipe starts without another swipe's generation snapshot, then receives its own resolved snapshot.
- **Swipe selection:** selecting a swipe restores that swipe's existing extra metadata and therefore its label.
- **Card label rename/removal:** historical snapshot text remains unchanged.
- **Legacy message:** missing field means no label.
- **Manual edit:** snapshot remains unchanged.
- **Continuation:** existing snapshot remains unchanged; missing snapshot stays missing.

No database migration is required because message extra is already extensible JSON metadata.

---

## 9. Interfaces and Integrations

The only new internal contract is the optional `generationCharacterEmotions` message-extra field.

No external API, provider, agent-package, or model contract changes are required. No Marinara-Agents package update is required because the snapshot is derived from state Marinara already resolves before model generation and is not part of the Expression Engine output contract.

Client message renderers will consume the new shared message metadata through a small common resolver so Conversation and Roleplay apply the same null/legacy handling.

---

## 10. Error and Edge-Case Behaviour

- **Emotion profile disabled or absent:** no snapshot entry and no label.
- **Persisted prior state invalid for the current profile:** use the same configured default state semantics as prompt construction; snapshot the default ID and label.
- **Profile has no resolvable label for the state:** do not invent display text. The implementation should treat this as missing/invalid snapshot data rather than displaying the raw internal ID as a user-facing fallback.
- **Expression Engine disabled or fails:** generation label still persists because it does not depend on post-generation classification.
- **Post-generation classification differs from generation state:** this is expected. The message shows the generation state while CR035 stores the newly classified state separately for subsequent turns.
- **Legacy message or swipe:** render no label.
- **Malformed snapshot metadata:** ignore the malformed entry and render normally.
- **Regeneration:** calculate and persist a fresh snapshot for the new swipe; never copy the old swipe's snapshot.
- **Continuation:** retain the original snapshot and do not claim fragment-level provenance.
- **Group response contains only some characters:** persist generation provenance as appropriate for the generation request, but render only the entries corresponding to actual visible speakers.
- **Character is later removed from the chat/card changes substantially:** the persisted label remains displayable because it is self-contained message provenance.

### Risks

- The main semantic risk is accidentally capturing the post-generation classified state instead of the pre-generation state. Tests must explicitly prove the distinction.
- Swipe metadata bugs could make one regeneration display another swipe's label. Existing swipe-extra semantics should be reused and regression-tested.
- Grouped renderers have several identity/header variants; incomplete UI coverage could make labels disappear or become associated with the wrong speaker.
- Continuation cannot be represented perfectly by one message-level snapshot; this limitation is intentionally bounded rather than hidden by overwriting provenance.

---

## 11. Validation Considerations

Implementation validation should prove:

- the snapshot uses the same valid-prior-state/default semantics as `charEmotion` for that generation;
- a response can have generation state A while its post-generation `characterEmotions` stores state B, and the UI continues to show A on that response;
- the snapshot persists even when the Expression Engine does not provide a result;
- regeneration creates a new swipe with its own snapshot and never inherits the previous swipe's snapshot;
- changing active swipe changes the visible generation emotion label accordingly;
- legacy messages and disabled profiles remain unlabeled without errors;
- normal Conversation line/bubble messages show the subtitle;
- consecutive grouped Conversation messages retain an emotion-only indicator;
- merged Conversation segments display the correct per-speaker labels;
- ordinary Roleplay character messages show the subtitle;
- merged Roleplay identity cycling keeps the emotion label synchronized with the displayed character;
- continuation does not overwrite the message's original snapshot;
- shared/server/client type checks and the normal substantive-change repository check pass.

A focused Playwright E2E scenario would be useful after implementation because the feature depends on persisted swipe metadata plus several rendered layouts. Per repository workflow, whether to add CR-specific Playwright coverage should be agreed with the user after behavior-bearing implementation is complete.

---

## 12. Open Questions

No outstanding design questions.

The continuation limitation is an explicit scope decision rather than an unresolved question.

---

## 13. Design Summary

- Add separate per-swipe `generationCharacterEmotions` provenance containing state ID and historical display label.
- Capture that provenance from the pre-generation CR035 state, never from the current response's post-generation classification.
- Keep `characterEmotions` and all CR035 future-state behaviour unchanged.
- Persist generation provenance through the existing message/swipe extra mechanism with no database migration or extra model call.
- Display a subtle label beneath each visible character name, including correct per-speaker handling for merged groups and an emotion-only indicator where repeated headers are suppressed.
- Preserve original-message provenance on continuation and do not backfill legacy messages.
