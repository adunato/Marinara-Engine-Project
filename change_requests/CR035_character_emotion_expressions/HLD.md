# CR035: Character Emotion States and Expression Integration

## Status

Proposed; awaiting HLD approval.

## Problem

Character cards can describe a stable personality, but they cannot currently make selected personality guidance conditional on the character's emotional state. Authors can write angle-bracket sections such as `<happy>...</happy>`, but Marinara deliberately passes card text through verbatim, so those tags do not filter prompt content.

The existing post-generation Expression Engine already judges the visible expression of each relevant character, selects a sprite, updates the current response, and persists the selection per swipe. Running a separate emotion classifier would duplicate that LLM work and could produce an emotion state that conflicts with the displayed avatar.

## Goals

- Extend the existing built-in post-generation Expression Engine result so one call selects both a configured character emotion and the current response's sprite expression.
- Persist emotion per character and per assistant message/swipe so the selected conversation branch determines subsequent prompt behavior.
- Expose the persisted state to character-card conditional prompts through a built-in `charEmotion` operand.
- Include only the active emotion branch in the next turn's main prompt while preserving all untagged card text.
- Add character-editor controls for defining allowed emotions, their classifier descriptions, a default emotion, and optional sprite mappings.
- Preserve current Expression Engine avatar behavior for characters without emotion configuration.
- Keep the initial behavior scoped to Roleplay, matching the existing Expression Engine lifecycle.

## Non-goals

- Do not add a second pre-generation or post-generation LLM call.
- Do not make the latest user message change the gated personality fragment for the response currently being generated. This design is intentionally post-generation: the classified emotion affects the following turn.
- Do not assign control semantics to arbitrary tags such as `<happy>...</happy>`.
- Do not replace free-text Character Tracker mood or make it the authority for conditional personality.
- Do not introduce a universal fixed emotion taxonomy; character authors define the allowed states.
- Do not add persona emotion profiles in the initial scope; existing persona sprite-expression behavior remains compatible.
- Do not populate emotion state in Conversation, Visual Novel, or Game modes in the initial scope.
- Do not add emotion-controlled filtering to fields that do not pass through the normal card macro engine unless implementation discovery proves they already share the same safe resolution path.

## User Experience

### Character-card text

Authors use Marinara's existing conditional-prompt syntax:

```text
Kate is normally thoughtful and reserved.

{{#if charEmotion == "happy"}}
Kate becomes bubbly, playful, and laughs easily.
{{else if charEmotion == "angry"}}
Kate becomes terse, direct, and difficult to reassure.
{{/if}}
```

Untagged text is always included. An emotion branch is included only when its state ID matches the character's active emotion.

The editor should offer an insertion action that creates a correctly formed conditional block for a configured state, but authors may also type the macro directly.

### Emotional States editor

Add an **Emotional States** section to the character editor with:

- an enable/disable control;
- a required default state while enabled;
- add, rename, reorder, and remove controls;
- a stable normalized state ID used by card macros;
- a user-facing label;
- a short classifier description explaining when the state applies to this character;
- an optional mapping to one of the character's available sprite expressions.

State IDs must be unique within the card and bounded to a safe identifier format. Renaming a label must not silently change its stable ID. Removing or changing an ID referenced by card text must produce a warning.

## State and Card Contract

Store the author configuration as a typed Marinara character-card extension, conceptually:

```ts
type CharacterEmotionProfile = {
  enabled: boolean;
  defaultStateId: string;
  states: Array<{
    id: string;
    label: string;
    description: string;
    spriteExpression?: string | null;
  }>;
};
```

The exact extension key and limits are implementation details, but import, export, validation, cloning, and snapshot handling must preserve the configuration.

Persist the result used by each generated swipe in message extra, conceptually:

```ts
characterEmotions?: Record<string, string> | null;
```

The key is the stable character ID and the value is a validated configured state ID. Message/swipe state is authoritative because it naturally follows selected swipes, conversation branches, deletion, and regeneration. Chat-global mutable state must not be the sole source of truth.

### Resolution semantics

For each character during prompt construction:

1. Use the emotion stored on the latest applicable selected assistant message/swipe when it remains valid for the current card configuration.
2. Otherwise use the configured default state when the profile is enabled.
3. Otherwise resolve `charEmotion` to the empty string.

Therefore:

- no emotion profile: emotion conditionals are false;
- disabled profile: emotion conditionals are false;
- configured default with no prior agent result: the default branch is active;
- configured but inactive state: that state's branch is omitted;
- unknown or removed state referenced by a card: its branch is omitted and the editor/preview warns;
- ordinary untagged card text is unaffected.

Filtering must occur before inactive branches can affect nested macro side effects, token accounting, or the final provider prompt.

## Combined Emotion and Expression Execution

The existing built-in Expression Engine remains a post-generation agent. After the main response has streamed, its single LLM request receives the normal expression-selection context plus the emotion configuration for every relevant character that has an enabled profile.

Conceptually, the managed prompt contains an enum-constrained block like:

```json
{
  "characterId": "kate-id",
  "previousStateId": "neutral",
  "availableEmotions": [
    {
      "id": "neutral",
      "description": "Kate's ordinary settled disposition",
      "spriteExpression": "neutral"
    },
    {
      "id": "happy",
      "description": "Pleased, excited, amused, or warmly affectionate",
      "spriteExpression": "smile"
    }
  ],
  "availableSprites": ["neutral", "smile", "glare"]
}
```

The agent returns one entry per required character, conceptually:

```json
{
  "expressions": [
    {
      "characterId": "kate-id",
      "emotionStateId": "happy",
      "expression": "smile",
      "transition": "bounce"
    }
  ]
}
```

The host validates character identity, emotion ID, and sprite expression against the supplied enums. A valid configured sprite mapping may deterministically supply or correct the avatar expression. When no mapping exists, existing Expression Engine selection and fallback behavior remains available.

The validated expression continues through the existing `spriteExpressions` persistence and client update path, so the current response's avatar changes as soon as post-processing completes. The validated emotion is persisted beside that swipe and becomes `charEmotion` for the following turn.

Characters without an enabled emotion profile remain in the expression request as required by existing behavior, but they do not need to return an emotion state.

Characters with an enabled emotion profile must be emotion targets even when they have no uploaded sprite assets. Emotion targeting must therefore be decoupled from the current available-sprites list. A character may produce emotion only, expression only, or both according to its configuration and assets.

## Failure, Regeneration, and Compatibility

- If emotion output is missing, invalid, or the agent fails, keep the current/previous valid emotion for future resolution; use the default when no valid prior state exists.
- Expression selection must retain its existing validation and fallback behavior even when emotion selection fails.
- A regenerated swipe stores its own combined result. Selecting a different swipe must select that swipe's persisted emotion for subsequent turns.
- Editing assistant content must clear or deliberately recompute stale combined affect metadata rather than retaining an emotion inferred from superseded text.
- Existing messages without emotion metadata resolve through the configured default.
- Existing cards without an emotion profile and existing chats with Expression Engine enabled behave exactly as they do today.
- If Expression Engine is disabled for a chat, no new post-generation emotion is produced; an enabled profile remains at its last valid state or default.
- Imported literal `<happy>` tags remain ordinary verbatim card content and are not automatically migrated.

## Prompt and Mode Boundaries

`charEmotion` must resolve against the character currently being expanded, not a chat-global value. Roleplay group chats therefore receive independent conditional-card resolution for each character. Non-speaking characters carry forward their latest valid state rather than being forced through the current-response classifier.

All Roleplay prompt construction paths that expand character-card macros must agree on the operand's value, including standard prompt markers, identity fallback injection where applicable, prompt preview/dry run, and regeneration. Outside Roleplay, `charEmotion` resolves to the empty string in the initial scope so conditional branches remain inactive.

## Risks

- Extending the Expression Engine schema could break older downloadable agent definitions or cached results unless the new emotion field is optional and host parsing remains backward compatible.
- Card state IDs and sprite filenames are different namespaces; implicit name matching alone would be fragile.
- Resolving state globally rather than per character would produce incorrect group-chat prompts.
- Reading the wrong historical swipe would leak an emotion across branches.
- Applying conditionals after ordinary macro expansion could allow inactive branches to mutate variables or consume prompt budget.
- Users may expect an insult to change the same response's personality immediately. The UI and documentation must state that this post-generation design affects the next turn.
- The official Expression Engine package source belongs to the separate Pasta-Devs/Marinara-Agents repository. Engine host contracts and UI belong here, but any package-owned prompt or manifest change requires a coordinated package contribution and release. Legacy installed expression-only output must remain accepted.
- Normal generation and agent-retry routes currently validate and persist expression results separately; changing one path without the other would create contract drift. Shared affect finalization should be extracted where practical.

## Validation

- Shared-schema tests for valid, invalid, disabled, imported, and backward-compatible emotion profiles.
- Macro tests proving `charEmotion` selects only the correct branch, is character-scoped in groups, and resolves false when unavailable.
- Server tests for combined Expression Engine input, output validation, missing/unknown state fallback, and optional sprite mapping.
- Generation tests for first-turn default, next-turn persisted state, selected swipe behavior, regeneration, Roleplay prompt paths, and empty-state behavior outside Roleplay.
- Targeting tests proving emotion-only characters without sprites and legacy sprite-only characters both remain supported.
- Client tests for character emotion configuration, stable IDs, deletion/reference warnings, and current-avatar updates.
- Prompt preview tests confirming inactive branches never reach the displayed or provider prompt.
- `pnpm check` as the baseline cross-package validation.
- Focused Playwright E2E should be agreed after implementation because this is behavior-bearing UI and generation work.

## Acceptance Criteria

1. A character author can configure custom emotion states, descriptions, a default, and optional sprite mappings.
2. The existing Expression Engine makes one post-generation LLM call and can return both a valid emotion state and sprite expression for each relevant character.
3. The current response avatar updates through the existing expression path.
4. The selected emotion is persisted per character on the generated swipe.
5. The following turn exposes that state as `charEmotion` while expanding that character's card.
6. Only the matching conditional branch reaches the final prompt; untagged text always remains.
7. Disabled, absent, unknown, and failed emotion cases follow the deterministic fallback rules above.
8. Existing Expression Engine behavior and cards without emotion configuration remain backward compatible.
