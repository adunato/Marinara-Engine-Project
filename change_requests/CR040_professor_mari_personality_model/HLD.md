# High-Level Design: Professor Mari Layered Personality Model Authoring

## 1. Summary

CR040 adds a deterministic personality-model authoring path for Professor Mari.

Professor Mari will use a small character-design skill to choose two fixed psychological classifications from the user's character concept: one Enneagram core type and one attachment style. Mari will not carry the complete runtime personality text or the fixed Pearson emotion mapping in its prompt. Instead, Marinara will own those canonical definitions and compile the final character personality and CR035 emotion metadata deterministically.

The intended outcome is that a user can ask Professor Mari to create a psychologically structured character without requiring Mari to reproduce large predefined text blocks, remember CR035 metadata details, or reason repeatedly about a fixed emotion-to-Pearson mapping.

---

## 2. Current State

Professor Mari can create and update characters through the structured `app_data` command family. Character writes participate in Marinara's existing reversible review flow.

Professor Mari also supports user-defined Skills. Every enabled skill is currently loaded into Mari's prompt in full. This makes a large skill containing all final Enneagram, Pearson, attachment, conditional-card, and emotion-profile text undesirable because it would consume context on every Mari turn even when character personality authoring is irrelevant.

CR035 already provides the runtime mechanism needed for state-dependent personality:

- characters may define an `emotionProfile` with author-defined emotion states;
- the post-generation Expression Engine selects and persists a character emotion;
- the selected emotion becomes `charEmotion` on the following turn;
- character-card conditionals can include only the personality fragment matching that emotion.

The layered personality model agreed for this change has three parts:

1. **Enneagram core personality** — fixed per character and focused on enduring motivations, sensitivities, priorities, and internal psychological pressures.
2. **Pearson expression mode** — dynamically selected through the character's current emotion state. The final Pearson text is written as state-agnostic tendency language so that, after conditional resolution, it reads as an organic continuation of the core personality.
3. **Attachment style** — fixed per character, but presented under a dedicated `Attachment Style` heading so relationship-regulation guidance is clearly scoped.

At present, Professor Mari's character-write interface does not provide a dedicated operation that owns this model or writes CR035 `emotionProfile` metadata from a canonical template.

---

## 3. Requirements

### Functional Requirements

- Provide Professor Mari with a compact skill for layered personality authoring.
- The skill must contain only the information Mari needs to choose an appropriate Enneagram type and attachment style from the user's character concept, plus instructions for invoking the structured personality-model operation.
- The skill must not contain the full Pearson runtime descriptions, the complete conditional personality block, or the CR035 emotion-profile template.
- Marinara must own one canonical version of the full Enneagram descriptions, Pearson state mappings/runtime descriptions, attachment descriptions, and CR035 classifier metadata used by this model.
- Professor Mari must be able to pass an Enneagram selection and attachment-style selection as structured values rather than reproducing canonical prose.
- A deterministic server-side compiler/helper must convert those selections into both:
  - the final character `personality` field; and
  - the matching `extensions.emotionProfile` configuration used by CR035.
- The generated personality field must contain, in order:
  1. the selected canonical Enneagram core description;
  2. one fixed CR035 `charEmotion` conditional block containing all Pearson expression descriptions mapped to their canonical mental-state IDs;
  3. a dedicated `Attachment Style` heading followed by the selected canonical attachment description.
- The Pearson conditional branches must use the approved tendency-oriented, state-agnostic wording. The roleplay LLM must not be told that the active Pearson paragraph is dynamically swapped.
- The emotion-profile template must use a fixed set of state IDs, labels, classifier descriptions, and Pearson mappings. Mari must not generate or reinterpret those values per character.
- The operation must enable the CR035 emotion profile and configure the canonical default state.
- The personality-model compiler must be reusable by Professor Mari character creation and by an explicit structured operation for applying/reapplying the model to an existing character.
- Applying the model to an existing character must use Marinara's normal reversible write/review behaviour.
- Manual character creation and editing must continue to work without using this model.

### Constraints and Important Conditions

- CR035 remains the runtime authority for emotion classification, persistence, `charEmotion`, swipe behaviour, and conditional-card resolution. CR040 must build on it rather than creating a parallel state system.
- Canonical output strings must be application-owned and deterministic. The LLM may select classifications but must not rewrite the approved model definitions.
- The final character card must remain valid ordinary character-card text plus existing Marinara extensions; no special runtime dependency on Professor Mari is allowed after creation.
- The model must not require the complete personality catalogue to be injected into Professor Mari's prompt on every turn.
- The compact Mari skill should remain small enough that enabling it does not materially recreate the prompt-cost problem this design is intended to avoid.
- Existing CR035-compatible characters and manually authored emotion profiles must remain valid and unchanged.
- Applying the canonical model is an explicit operation. Marinara must not silently replace manually authored personality or emotion metadata on unrelated character edits.

---

## 4. Expected Outcome

### Before

Professor Mari can write a character personality as free text, but implementing the agreed layered model requires Mari to know and reproduce the canonical descriptions, build a large conditional Pearson block correctly, and separately configure CR035 emotion metadata. Keeping all of that knowledge in an enabled skill would load a large amount of fixed text into every Professor Mari turn.

### After

Professor Mari reasons only about which Enneagram core and attachment style best fit the user's character concept. It passes those selections to a structured Marinara operation.

Marinara then generates the complete personality field and emotion profile from its canonical model definitions. Every character created through this path receives the same correct emotion-to-Pearson mapping and metadata shape without LLM reconstruction or variation.

The resulting character is self-contained. During ordinary Conversation or Roleplay generation, the roleplay LLM sees the selected Enneagram core, only the currently active Pearson expression paragraph after CR035 conditional resolution, and the separately headed attachment guidance.

---

## 5. Proposed Design

### Canonical personality-model compiler

Introduce one application-owned layered personality model, initially versioned as a single canonical model such as `enneagram-pearson-attachment-v1`.

The model owns:

- the nine approved Enneagram IDs, labels, and final core descriptions;
- the four approved attachment-style IDs, labels, and final descriptions;
- the twelve fixed mental-state IDs and user-facing labels;
- the one-to-one mental-state-to-Pearson mapping;
- the twelve approved Pearson runtime descriptions;
- the fixed CR035 classifier descriptions for those mental states;
- the canonical CR035 default state;
- the exact conditional personality template generated from those definitions.

A deterministic compiler accepts only the variable selections required for a character, conceptually:

- Enneagram type;
- attachment style.

It returns the model-controlled character fields:

- compiled `personality` text;
- compiled `emotionProfile` metadata.

The compiler contains no LLM call and performs no character interpretation. Its output for the same model version and inputs is identical every time.

### Professor Mari skill

Provide a compact Professor Mari skill dedicated to selecting and applying the model.

The skill contains:

- concise selection guidance for the nine Enneagram types, focused on differentiating underlying motivations;
- concise selection guidance for the four attachment styles, explicitly scoped to relationship regulation;
- instructions to infer those classifications from the user's character brief and conversation;
- instructions to pass the selected IDs to Marinara's structured personality-model operation;
- instructions not to manually recreate or paraphrase the canonical output strings.

The skill deliberately contains no Pearson catalogue. Pearson selection is not a Professor Mari decision: the mapping is fixed and CR035 selects the active state at runtime.

The skill should be exposed through the existing Professor Mari Skills model and normal enable/disable semantics. It should be provisioned as a bundled/seeded skill without introducing a second prompt-instruction subsystem. Provisioning must avoid creating duplicate copies across upgrades and must not silently overwrite a user's later edits to the seeded skill.

### Structured character operation

Expose the compiler through Professor Mari's existing structured `app_data` path rather than an arbitrary shell script or Personal Extension.

The operation should support two uses:

1. **Character creation** — Professor Mari supplies ordinary character-card fields plus the selected personality-model inputs. The server compiles the model-controlled fields before the character is persisted, allowing creation to complete as one coherent character mutation.
2. **Existing character application** — an explicit structured action applies/reapplies the model to a target character using selected Enneagram and attachment IDs.

For an existing character, applying the model intentionally replaces the full `personality` field and the CR035 `emotionProfile` because those two fields are jointly owned by the canonical template. Marinara must not attempt an LLM-driven merge with arbitrary existing personality text. The normal reversible review/snapshot path provides recovery when the user wants to restore the prior card.

### High-Level Flow

1. The user asks Professor Mari to create a character using the layered personality model.
2. Mari uses the compact skill and the character discussion to select one Enneagram type and one attachment style.
3. Mari submits the character data and those two structured selections through `app_data`.
4. The server validates the selections against the canonical model.
5. The personality compiler produces the final personality string and the fixed CR035 emotion profile.
6. Marinara persists the complete character through the normal character storage/review path.
7. On later roleplay turns, CR035 classifies the character's current emotion and resolves the matching Pearson conditional branch.
8. The roleplay LLM receives an organic personality description consisting of the fixed Enneagram core, the currently active Pearson tendency, and the separately scoped attachment style.

---

## 6. Backend Changes

### Canonical model ownership

Add a server/shared personality-model definition that is the single source of truth for all final text and fixed state metadata. The Mari skill must reference model IDs conceptually but must not duplicate the final output catalogue.

The canonical model should validate its own invariants, including:

- every supported Enneagram ID has exactly one core description;
- every supported attachment ID has exactly one attachment description;
- every mental-state ID is unique and valid for CR035;
- every mental state maps to exactly one Pearson expression;
- every Pearson branch referenced by the generated conditional block exists;
- the configured default emotion is one of the canonical states.

### Personality compilation

Add deterministic application logic that builds the exact `personality` field and `emotionProfile` object from the canonical model plus the two selected fixed classifications.

Compilation must happen before persistence so character creation does not rely on a temporary partially configured card.

### Professor Mari `app_data`

Extend Professor Mari's structured character mutation contract so model-based character creation can pass the Enneagram and attachment selections without placing them in the persisted character-card data as ad hoc fields.

Also expose an explicit apply/reapply operation for an existing character. It must follow current `apply:true` / dry-run semantics and the existing reversible character-change review path.

Invalid type IDs, missing targets, or invalid canonical-model configuration must fail before any partial character mutation is committed.

### Skill provisioning

Ship the compact character-personality skill through the existing Professor Mari Skills subsystem. Provisioning should be idempotent and preserve user control over whether the skill remains enabled.

---

## 7. UI and User Experience Changes

No new character-editor controls are required by CR040. CR035's existing Emotional States UI remains available for inspection or subsequent manual editing.

The new Professor Mari skill should appear in the existing Skills interface like other Mari skills and use the existing enable/disable workflow.

From the Professor Mari chat, the intended experience is conversational:

- the user describes the desired character;
- Mari may ask normal character-design questions when genuinely necessary;
- Mari selects the Enneagram and attachment classifications internally;
- Mari creates the character through the structured action;
- the existing Keep/Restore behaviour applies to reversible changes.

Mari does not need to display or ask the user to manually enter the twelve Pearson states unless the user explicitly asks to inspect the model.

---

## 8. Data and State

CR040 reuses the existing character card and CR035 data model.

The primary persisted outputs are:

- `data.personality` — compiled canonical personality text containing the Enneagram core, Pearson conditionals, and attachment section;
- `data.extensions.emotionProfile` — the fixed CR035 profile used by the Expression Engine.

No new runtime conversation state is introduced. The active emotional state continues to be persisted and resolved by CR035.

The canonical model itself is application-owned configuration/code rather than per-character duplicated source data beyond the generated card text and emotion profile.

Existing characters receive no migration. The model is applied only when explicitly selected during creation or explicitly applied to an existing character.

---

## 9. Interfaces and Integrations

### Professor Mari to character storage

The existing `app_data` interface remains the boundary between Professor Mari and character persistence. CR040 extends that interface with typed personality-model selections and an explicit apply/reapply capability rather than giving Mari direct low-level access to arbitrary character extension metadata.

### CR035 integration

The compiler produces a normal CR035 `emotionProfile`. CR035 remains responsible for:

- Expression Engine classification;
- state persistence per generated swipe;
- default-state fallback;
- `charEmotion` prompt context;
- filtering inactive conditional branches.

CR040 does not change those runtime contracts unless implementation discovery identifies a compatibility defect.

---

## 10. Error and Edge-Case Behaviour

- Unknown Enneagram or attachment IDs are rejected before any write.
- A missing target character causes the explicit apply operation to fail without mutation.
- A malformed canonical model is treated as an application error and must not produce a partially configured character.
- If model-based creation fails during compilation, the character must not be saved in a partially compiled state.
- Reapplying the model to an existing character replaces its current personality and emotion profile intentionally; the operation must be reversible through the existing review/version mechanism.
- Manual edits made after model application remain untouched by unrelated character updates. They are replaced only if the user explicitly requests model reapplication.
- Characters without CR035 support/configuration continue to behave exactly as before.
- If the Professor Mari skill is disabled, no automatic model-selection behaviour is expected; the underlying structured action remains available to valid callers.

---

## 11. Validation Considerations

Implementation planning should cover evidence that:

- each Enneagram and attachment selection produces the exact approved description;
- the compiled personality always contains all twelve Pearson conditional branches in the canonical mapping;
- the final prompt includes only the CR035-active Pearson branch at runtime;
- the compiled `emotionProfile` contains the exact canonical state IDs, labels, classifier descriptions, default, and enablement state;
- the same inputs produce identical compiled output;
- Professor Mari can create a complete character using only the compact skill plus structured selections;
- the full Pearson/output catalogue is not duplicated into the Mari skill prompt;
- existing-character application is reversible and does not partially update on failure;
- normal character creation/editing and existing CR035 profiles remain unaffected when the model is not used;
- skill provisioning is idempotent and does not create duplicate skills;
- focused shared/server tests and `pnpm check` pass;
- focused Professor Mari/character-creation E2E coverage should be considered after implementation because the change spans model guidance, structured commands, persistence, and CR035 runtime behaviour.

---

## 12. Open Questions

- Which of the twelve canonical mental states should be the fixed CR035 default before a character has a persisted Expression Engine result? The choice must be made once for the model and then owned by the canonical template; Professor Mari must never choose it per character.

---

## 13. Design Summary

- Professor Mari chooses only **Enneagram core type** and **attachment style**.
- The fixed Pearson state mapping and all final runtime prose live outside the Mari skill in an application-owned canonical model.
- A deterministic compiler turns the two selected classifications into both the complete `personality` field and the CR035 `emotionProfile`.
- Model-based character creation compiles those fields before persistence; an explicit structured action can apply/reapply the same model to existing characters.
- The compact skill uses the existing Professor Mari Skills subsystem and never carries the large Pearson/conditional template.
- CR035 remains the sole runtime state engine; CR040 is an authoring/configuration layer on top of it.
