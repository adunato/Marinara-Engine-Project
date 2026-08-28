# Implementation Plan: Professor Mari Layered Personality Model Authoring

## 1. Implementation Summary

Implement CR040 as a deterministic application-owned personality compiler exposed through Professor Mari's existing structured `app_data` character workflow.

The work has five connected parts:

- define one canonical versioned personality model containing the approved final Enneagram, Pearson, attachment, and CR035 emotion-state definitions;
- add a pure compiler that accepts an Enneagram ID and attachment-style ID and returns the complete character `personality` text plus a valid CR035 `emotionProfile`;
- extend Professor Mari's structured character actions so the model can be applied during character creation and explicitly applied/reapplied to an existing character without requiring Mari to reproduce canonical prose or metadata;
- provision a compact Professor Mari skill containing only classification guidance and structured-action instructions;
- add focused validation proving deterministic compilation, CR035 compatibility, reversible character updates, and compact-skill behaviour.

The compiler and structured action must be established before Mari's skill is enabled, because the skill should reference stable structured IDs rather than embed fallback copies of the canonical output.

---

## 2. HLD Reference

The implementation is constrained by these approved HLD decisions:

- Professor Mari selects only one Enneagram core type and one attachment style. Pearson expression is not a Mari choice.
- The full canonical output strings and fixed emotion-state mapping are application-owned and deterministic; the LLM must not rewrite them.
- The compiled `personality` field is ordered as selected Enneagram description, all fixed `charEmotion` Pearson conditional branches, then an `Attachment Style` heading and selected attachment description.
- The compiler also produces the CR035 `data.extensions.emotionProfile` using one fixed set of state IDs, labels, classifier descriptions, enablement, and `defaultStateId: "wary-grounded"`.
- `wary-grounded` (**Wary / Grounded**, Pearson **Realist**) is the fixed pre-classification fallback because it is the most neutral, measured state in the canonical set; CR035 replaces it once a persisted Expression Engine classification exists.
- CR035 remains the runtime authority for emotion classification, persistence, swipe behaviour, `charEmotion`, and inactive-branch filtering.
- Model-based character creation should persist a complete compiled card in one coherent mutation; explicit reapplication to an existing character intentionally replaces both `personality` and `emotionProfile` through Marinara's reversible character-change path.
- Existing characters, manual character editing, and manually authored CR035 profiles remain unchanged unless the model is explicitly applied.
- The Professor Mari skill must stay compact and must not contain the Pearson catalogue or final compiled personality template.

---

## 3. Repository Assessment

Repository inspection supports the HLD without requiring an architectural redesign.

- `CharacterExtensions` already has an optional `emotionProfile?: CharacterEmotionProfile`, and `CharacterEmotionProfile` already models `enabled`, `defaultStateId`, and a list of typed states. No new per-character persistence structure is required.
- `characterEmotionProfileSchema` already validates normalized state IDs, unique IDs, bounded labels/descriptions, and the requirement that an enabled profile's default ID exists in the state list. The CR040 compiler should construct data that passes this existing schema rather than define a parallel validator.
- Character create/update schemas already accept normal character data and extensions, so the compiled output can ultimately flow through existing character persistence. Professor Mari currently exposes a narrower structured character contract, which is the correct integration point to extend.
- Professor Mari already uses the `app_data` command family for `character.create` and `character.update`, with `apply:true` mutations participating in the existing reversible Keep/Restore flow. CR040 should reuse that mutation path instead of introducing a shell script or Personal Extension.
- Professor Mari's Skills service stores user-visible `SKILL.md` content and injects every enabled skill in full into Mari's prompt. This confirms the need for a compact skill and also means bundled-skill provisioning needs explicit idempotent behaviour; the current custom-skill storage service is not itself a catalogue of immutable built-in skills.
- The approved personality definitions are documented in the parent repository at `docs/character-personality-model.md`. Implementation should copy those approved strings into the application-owned canonical model source rather than parse the parent documentation at runtime.
- CR035 already owns runtime conditional resolution and emotion persistence, so CR040 should not modify generation-time state semantics unless focused integration testing exposes a defect.

No material conflict with the HLD was found.

---

## 4. Implementation Approach

### 4.1 Canonical Personality Model Definition

Create a single application-owned, versioned model definition for the initial layered model, with a stable identifier such as `enneagram-pearson-attachment-v1`.

The definition should contain:

- stable IDs and labels for all nine Enneagram types;
- the exact approved Enneagram core descriptions;
- stable IDs and labels for all four attachment styles;
- the exact approved attachment descriptions;
- twelve stable mental-state IDs and labels;
- the fixed mental-state-to-Pearson association;
- the exact approved Pearson runtime descriptions;
- one classifier description for each mental state, bounded to CR035's existing description limit;
- `wary-grounded` as the canonical CR035 default-state ID;
- enough model metadata to validate/version the compiler input without placing version markers into ordinary character prose unless there is an existing appropriate extension location.

Keep the canonical definitions in normal shared/server application source, not in the Professor Mari skill and not in the parent project documentation at runtime.

Add model-level invariant checks so malformed application-owned definitions fail clearly during tests/development. At minimum, verify unique IDs, complete Enneagram/attachment catalogues, exactly one Pearson mapping per mental state, `wary-grounded` as a valid default state, and compatibility with the existing CR035 emotion-profile schema.

### 4.2 Deterministic Personality Compiler

Add a pure compiler that accepts:

- personality-model version/ID where needed by the internal interface;
- one supported Enneagram ID;
- one supported attachment-style ID.

The compiler should return a typed result containing:

- the full `personality` string;
- a complete `CharacterEmotionProfile`.

Generate the personality string from canonical definitions rather than storing a second manually maintained giant template. The compiler should render the twelve branches in canonical order using Marinara's existing conditional macro syntax and stable `charEmotion` IDs.

Compilation must be deterministic: identical model version and selections produce byte-identical personality text and equivalent emotion metadata.

The compiler should validate structured selections before rendering and should validate the generated emotion profile through the existing CR035 schema or an equivalent shared validation path before it can reach persistence.

Do not call an LLM or perform personality inference inside the compiler.

### 4.3 Professor Mari Structured Action Contract

Extend Professor Mari's `app_data` character capability with typed personality-model inputs while preserving the existing ordinary character write path.

Support two explicit flows.

#### Model-based character creation

Allow `character.create` to receive a separate model-selection object alongside ordinary character fields, conceptually containing:

- model ID/version;
- Enneagram ID;
- attachment-style ID.

These values are command inputs, not arbitrary fields persisted into the character card.

Before persistence:

1. validate ordinary character input and structured model selections;
2. compile the canonical personality output;
3. replace/set the outgoing character's `personality` and `extensions.emotionProfile` with compiled values;
4. pass the complete result through normal character creation validation/storage;
5. return/verify the completed character through the current Professor Mari read-back convention.

The operation must not create a placeholder or partially configured character if compilation fails.

#### Apply/reapply to an existing character

Add the explicit structured action `character.applyPersonalityModel`, accepting:

- character ID;
- model ID/version;
- Enneagram ID;
- attachment-style ID;
- existing `apply`/reason semantics.

The action should:

1. resolve the target character;
2. compile both owned fields;
3. patch `personality` and `extensions.emotionProfile` together through the normal character update/versioning path;
4. participate in existing preview/reversible Keep/Restore behaviour;
5. leave all unrelated character fields untouched.

Do not expose low-level arbitrary emotion-profile construction as part of this CR. The purpose of the action is to make the fixed template deterministic.

### 4.4 Professor Mari Skill

Add/provision one compact Professor Mari skill for layered character personality authoring.

The skill should contain only:

- concise differentiation guidance for the nine Enneagram options, centered on core motivation, threat, and internal psychological logic;
- concise differentiation guidance for the four attachment styles, explicitly limited to relationship regulation;
- instruction to infer the closest supported classifications from the user's character concept rather than inventing additional types;
- the stable IDs Mari must pass to the structured action;
- instruction to invoke model-based creation/application rather than manually generating the canonical personality block;
- instruction that Pearson states and their runtime mappings are fixed by Marinara and must not be selected, rewritten, or enumerated by Mari during normal character creation.

Do not include:

- the twelve Pearson final descriptions;
- the full conditional personality template;
- CR035 metadata JSON/schema prose;
- copies of the long final Enneagram or attachment runtime descriptions unless a short selection description happens to match naturally. Selection guidance and final card prose are separate responsibilities.

Provision the skill idempotently using the LLD's bundled seed-version bookkeeping. Repeated startup/upgrade must not create duplicates or overwrite a user-modified/disabled skill, and deletion after the recorded seed version must not recreate the same seed automatically.

### 4.5 CR035 Integration

Use the existing `CharacterEmotionProfile` and `characterEmotionProfileSchema` contracts directly.

The compiler's twelve state IDs must exactly match the `charEmotion` values used in the generated conditional personality block. The generated profile must therefore be treated as one atomic model artifact with the conditional text.

Do not add another emotion classifier, state store, or runtime selection mechanism. Once a character is saved, CR035 continues to:

- supply `wary-grounded` before a persisted classification exists;
- persist per-swipe emotion state;
- expose `charEmotion` for the next turn;
- remove inactive conditionals before final prompt construction.

Focused integration coverage should prove that one compiled card resolves correctly through the existing macro/runtime path.

### 4.6 Documentation and Model Maintenance

Document the new Professor Mari workflow in the appropriate application documentation, including:

- what the bundled skill does;
- that Mari selects Enneagram + attachment only;
- that Pearson state mapping is fixed and runtime-driven;
- that applying/reapplying the model replaces the full personality field and emotion profile;
- that ordinary manual character authoring remains available.

Keep `docs/character-personality-model.md` in the parent project as the design/reference record, while the executable application source is authoritative for actual compiled strings after implementation. If the approved definitions change later, update the application model and reference documentation together.

---

## 5. Implementation Sequence

1. **Define the canonical model and stable IDs.** Establish all final application-owned strings, state IDs, classifier descriptions, `defaultStateId: "wary-grounded"`, and model invariants before building consumers.
2. **Implement and test the pure compiler.** Prove exact personality rendering and valid CR035 metadata independently of Professor Mari.
3. **Extend Professor Mari's structured action schema/dispatcher.** Add typed model selections for create and the explicit apply/reapply action, routing both through the compiler and normal character storage/versioning.
4. **Implement idempotent skill provisioning.** Establish the shipped compact skill only after the structured action IDs and accepted values are stable.
5. **Write the compact skill content.** Reference only the finalized structured IDs and selection guidance; avoid fallback copies of canonical output.
6. **Add focused integration and compatibility tests.** Cover create, reapply, dry-run/reversible update, malformed selections, CR035 macro resolution, existing manual profiles, and skill provisioning.
7. **Update relevant user/developer documentation.** Keep runtime ownership and reapplication semantics explicit.
8. **Run repository integrity checks once the cross-package change is complete.** Then hand off to the separate validation stage.

The sequence matters because the skill is only a consumer of the structured action, and the structured action is only safe once the canonical compiler contract is stable.

---

## 6. Development Integrity Checks

During development, run proportionate focused checks while working, followed by the repository baseline once the cross-package implementation is complete:

- shared-package type checking for new canonical model/compiler contracts;
- server type checking for Professor Mari action integration;
- focused lint for modified client/server/shared code where applicable;
- focused tests for personality compilation, emotion-profile schema compatibility, and Professor Mari action handling;
- `cd Marinara-Engine && pnpm check` once after the substantive implementation is integrated.

A production build is not required merely to author the change, but should be run in the primary application checkout if the later validation/UAT stage requires a runnable integrated build, following the repository workflow.

---

## 7. Validation Requirements

### Unit Validation

- Every supported Enneagram ID compiles to the exact approved core description.
- Every supported attachment ID compiles to the exact approved attachment description.
- All twelve canonical mental states are rendered exactly once and in stable order in the Pearson conditional block.
- Every conditional state ID has exactly one matching state in the compiled `emotionProfile`.
- The compiled profile passes existing `characterEmotionProfileSchema` validation.
- The compiled profile has `defaultStateId === "wary-grounded"`.
- Invalid model, Enneagram, or attachment IDs fail without returning partial compiled output.
- Identical compiler inputs produce identical output.
- Canonical-definition invariant tests fail for duplicate/missing state mappings or an invalid default state.
- Seeded-skill provisioning is idempotent and protects the intended user-edit semantics.

### End-to-End Validation

- From Professor Mari, create a complete character using the compact skill and verify that the saved character contains the expected compiled personality plus enabled canonical emotion profile.
- Verify Professor Mari does not need the Pearson catalogue in its skill prompt to complete the creation.
- Apply/reapply the personality model to an existing character and verify both owned fields change together while unrelated fields remain untouched.
- Exercise the existing reversible review/Keep/Restore path for reapplication and confirm the previous personality/profile can be restored.
- Start/use a Conversation or Roleplay with a compiled character and confirm `wary-grounded` is used before the first CR035 classification and that later persisted states select only the matching Pearson paragraph in the final prompt.

### Other Relevant Validation

- Verify ordinary character creation and editing without CR040 model inputs are unchanged.
- Verify existing manually authored CR035 `emotionProfile` values are not migrated or overwritten automatically.
- Verify malformed structured inputs cannot bypass existing character/emotion schemas.
- Verify the skill appears once in Professor Mari Skills after repeated startup/upgrade scenarios and respects the agreed enabled/edit lifecycle.
- Inspect Professor Mari prompt/debug output to confirm the skill contains only compact selection guidance, not the large canonical Pearson/runtime template.
- Run focused Playwright coverage if agreed for the completed behavior-bearing flow, particularly Professor Mari creation/reapplication and reversible review.

---

## 8. Resolved Implementation Decisions

- **Default state:** `wary-grounded` is the fixed CR035 pre-classification default; it is never selected per character.
- **Bundled skill lifecycle:** use the LLD's internal seed-version bookkeeping under the existing Mari Skills runtime storage; once a seed version is recorded, user edits, disablement, and deletion are preserved.
- **Creation contract:** extend existing `character.create` with a nested top-level `personalityModel` input; do not create a parallel character-creation action.
- **Persisted classifications:** model ID, Enneagram, and attachment selections remain command-time inputs only in CR040 and are not added to Character Card V2 metadata.

---

## 9. Low-Level Design Decision

**LLD required:** Yes

### Rationale

A separate LLD is justified because implementation spans several tightly coupled repository-specific areas:

- shared canonical definitions and CR035 schemas;
- deterministic compilation and macro rendering;
- Professor Mari `app_data` command definitions and dispatch;
- character create/update/versioning and reversible review behaviour;
- Professor Mari Skills storage/provisioning lifecycle;
- integration with existing CR035 runtime conditional resolution.

The HLD fixes the architecture, and the completed LLD pins down the concrete modules/files, exact structured action schemas, where compilation is invoked relative to character validation/persistence, how atomic replacement of `personality` + `emotionProfile` is achieved, how the seeded skill is identified and provisioned safely, and that classification metadata is not persisted.

Without an LLD, a developer would need to make several coupled design decisions while editing the code, increasing the risk of duplicated definitions, partial mutations, or a skill lifecycle that overwrites user content.

---

## 10. Implementation Checklist

- [x] Resolve the canonical CR035 default mental state as `wary-grounded`
- [ ] Define the versioned canonical Enneagram/Pearson/attachment model and invariant checks
- [ ] Implement the deterministic personality + `emotionProfile` compiler
- [ ] Add focused compiler/schema tests
- [ ] Extend Professor Mari's structured character-create contract for personality-model selections
- [ ] Add the explicit existing-character apply/reapply structured action
- [ ] Route both flows through normal character validation, persistence, versioning, and reversible review
- [ ] Define and implement idempotent bundled-skill provisioning
- [ ] Add the compact Professor Mari Enneagram/attachment selection skill
- [ ] Add focused Professor Mari action and compatibility tests
- [ ] Add CR035 conditional-resolution integration coverage for a compiled character
- [ ] Update relevant application documentation
- [ ] Complete relevant development integrity checks, including one final `pnpm check`
- [ ] Complete implementation summary for hand-off to validation