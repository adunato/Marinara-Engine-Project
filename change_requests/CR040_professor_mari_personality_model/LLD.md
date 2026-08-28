# Low-Level Design: Professor Mari Layered Personality Model Authoring

## 1. Change Overview

CR040 will add a shared deterministic personality-model compiler, expose it through Professor Mari's existing structured character actions, and seed one compact Professor Mari skill that selects only Enneagram and attachment classifications.

The compiled result remains ordinary Character Card V2 data: the full layered text is written to `data.personality` and the fixed twelve-state configuration is written to the existing `data.extensions.emotionProfile`. No new character persistence schema, client-side character editor, or runtime emotion system is introduced.

One product value remains intentionally unresolved from the HLD: the canonical initial/default mental-state ID. The implementation must set this once in the canonical model before CR040 is considered complete; it must not infer a default per character.

---

## 2. File Changes

### `packages/shared/src/utils/character-personality-model.ts`

**Action:** Create

Create the application-owned canonical model and pure compiler in the shared package.

This file is the single source of truth for the executable CR040 model. It should export:

- a stable model ID, initially `enneagram-pearson-attachment-v1`;
- stable Enneagram IDs for types 1 through 9;
- stable attachment IDs: `secure`, `anxious-preoccupied`, `dismissive-avoidant`, and `fearful-avoidant`;
- the twelve stable mental-state IDs, in canonical order:
  - `hopeful-safe`;
  - `wary-grounded`;
  - `threatened-combative`;
  - `protective-nurturing`;
  - `restless-curious`;
  - `intimate-romantic`;
  - `defiant-rebellious`;
  - `inspired-expressive`;
  - `reflective-analytical`;
  - `playful-mischievous`;
  - `transformative-enchanted`;
  - `commanding-responsible`;
- exact approved Enneagram core descriptions from the CR040 reference model;
- exact approved Pearson runtime descriptions and the fixed mental-state-to-Pearson association;
- exact approved attachment descriptions;
- one bounded CR035 classifier description for each mental state;
- the canonical default-state ID once the outstanding product choice is resolved.

The public compiler interface should be structurally equivalent to:

```ts
type CharacterPersonalityModelSelection = {
  modelId?: "enneagram-pearson-attachment-v1";
  enneagramType: EnneagramTypeId;
  attachmentStyle: AttachmentStyleId;
};

type CompiledCharacterPersonalityModel = {
  personality: string;
  emotionProfile: CharacterEmotionProfile;
};

compileCharacterPersonalityModel(
  selection: CharacterPersonalityModelSelection,
): CompiledCharacterPersonalityModel;
```

The compiler must:

1. reject unknown model, Enneagram, or attachment IDs;
2. render the selected Enneagram paragraph first;
3. render one fixed `charEmotion` conditional chain containing all twelve Pearson descriptions in canonical order;
4. append a blank-line-separated `Attachment Style` heading and selected attachment paragraph;
5. create an enabled `CharacterEmotionProfile` using the same twelve state IDs and classifier descriptions;
6. validate the generated profile with the existing `characterEmotionProfileSchema` before returning it;
7. return fresh output objects so callers cannot mutate the canonical definitions;
8. produce byte-identical personality text for identical inputs.

The Pearson conditional text should be generated from the canonical state collection rather than separately maintained as a second large template. This prevents the card text and `emotionProfile` IDs from drifting apart.

The selected model ID, Enneagram type, and attachment style are **not** persisted as additional character metadata in CR040. They are command-time authoring inputs only.

---

### `packages/shared/src/index.ts`

**Action:** Modify

Export the new `character-personality-model` utility from the shared package public API so the Professor Mari server path and focused regressions consume the same canonical compiler.

No changes are required to `types/character.ts` or `schemas/character.schema.ts`; CR035 already defines the required `CharacterEmotionProfile` shape and validation contract.

---

### `packages/server/src/services/professor-mari/bundled-skills.ts`

**Action:** Create

Define application-shipped Professor Mari skills separately from user-created skill storage.

For CR040, expose one descriptor with a fixed seed key and version, conceptually:

```ts
{
  key: "character-personality-model",
  version: 1,
  id: "character-personality-model",
  name: "character-personality-model",
  enabled: true,
  description: "Selects Enneagram and attachment classifications for the canonical layered character personality model.",
  content: `...compact SKILL.md body...`,
}
```

The skill body should contain only:

- concise differentiating guidance for the nine Enneagram types, centred on underlying motivation and threat sensitivity;
- concise differentiating guidance for the four attachment styles, explicitly scoped to intimacy, distance, dependence, rejection, and relational security;
- the stable selection IDs accepted by the structured action;
- instruction to use `character.create` with `personalityModel` or `character.applyPersonalityModel` rather than writing the canonical model manually;
- instruction that Pearson selection, conditional text, and emotion metadata are fixed by Marinara and must not be recreated or paraphrased by Professor Mari.

The file must not duplicate the twelve Pearson runtime paragraphs, the full conditional block, CR035 JSON/schema instructions, or the long final card descriptions.

---

### `packages/server/src/services/professor-mari/workspace-skills.service.ts`

**Action:** Modify

Extend the existing file-backed Professor Mari Skills service with one-time bundled-skill seeding while preserving its current create/update/delete behaviour for user-managed skills.

Add a small seed-state file under the existing runtime skills root, for example:

```text
DATA_DIR/.mari-workspace/skills/bundled-seeds.json
```

The seed state records completed bundled seed versions by stable key. It is internal runtime bookkeeping and does not need to be exposed through `MariWorkspaceSkillSummary` or the UI.

During `ensureStorage()`:

1. create the existing skills root as today;
2. read the seed-state file safely, treating missing/malformed data as an empty seed-state;
3. for each bundled descriptor whose version has not been recorded:
   - read the current skill records;
   - if the bundled fixed ID is absent, create its normal skill record and `SKILL.md` using the same canonical write format as user-created skills;
   - if that ID already exists, leave the existing content, enabled state, and timestamps untouched;
   - record the bundled seed version as completed;
4. persist the updated seed-state atomically enough that repeated startup cannot create duplicate records.

After a seed version is recorded, normal user ownership wins:

- editing the seeded skill is never overwritten by startup;
- disabling it remains disabled;
- deleting it does not cause the same seed version to reappear on every restart;
- future changes to shipped skill content require an explicit new seed/migration policy rather than silently replacing user text.

Keep the seeded skill in the same `skills.json` + `skills/<id>/SKILL.md` model as every other Mari skill so the current Skills panel and prompt assembly require no client changes.

---

### `packages/server/src/services/professor-mari/workspace-agent.service.ts`

**Action:** Modify

Update Professor Mari's structured `app_data` contract and prompt guidance; do not add personality compilation logic here.

Changes:

- add `character.applyPersonalityModel` to `PROFESSOR_MARI_APP_DATA_ACTIONS`;
- add an optional top-level `personalityModel` object to the `app_data` tool schema with:
  - `modelId`, restricted initially to `enneagram-pearson-attachment-v1`;
  - `enneagramType`, restricted to the nine stable model IDs;
  - `attachmentStyle`, restricted to the four stable attachment IDs;
- document that `character.create` may receive `personalityModel` alongside ordinary `data` fields;
- document that `character.applyPersonalityModel` requires a target character plus the model-selection object and replaces the model-owned `personality` + `emotionProfile` fields together;
- add the new action to the quick-reference write list and any verification wording that enumerates character mutations;
- keep the generic `commandAppData()` forwarding behaviour unchanged.

Do not place the long canonical personality definitions in the system prompt or tool description. The compact skill provides selection guidance; the structured schema only tells Mari how to pass the selected IDs.

---

### `packages/server/src/services/mari-db/mari-db.service.ts`

**Action:** Modify

Integrate the compiler into the existing `executeCharacterAction()` path so both creation and reapplication flow through the current mutation review engine.

Import the shared compiler and its supported IDs/types.

Add a focused parser/helper for the top-level `personalityModel` command object. It should:

- require an object when the caller invokes `character.applyPersonalityModel`;
- allow omission for ordinary `character.create`;
- default an omitted `modelId` to the single current CR040 model only if the object otherwise exists;
- validate Enneagram and attachment selections through the compiler/shared model contract;
- never accept arbitrary final personality prose or arbitrary emotion states as part of the model-selection object.

#### `character.create`

Keep the existing `character.create` action and extend it rather than creating a separate creation action.

After ordinary character input is normalized but before `buildMinimalCharacterData()` creates the full row:

1. inspect `args.personalityModel`;
2. if absent, preserve current behavior exactly;
3. if present, compile it;
4. force the normalized outgoing `personality` field to the compiled personality;
5. preserve any unrelated caller-supplied extensions, but force `extensions.emotionProfile` to the compiled complete profile;
6. build the full row and pass it through the existing single `executeMutation(kind: "insert")` call.

If the LLM also supplies a `personality` or `extensions.emotionProfile` while `personalityModel` is present, the compiler output wins. This makes model ownership deterministic rather than dependent on argument ordering.

Compilation failure must occur before `executeMutation`, so no partially configured character or review entry is created.

#### `character.applyPersonalityModel`

Add a new `executeCharacterAction()` switch case normalized from `character.applyPersonalityModel`.

The action should:

1. require `characterId`/`id` and resolve the existing character row;
2. require and compile `personalityModel`;
3. parse the existing CharacterData object;
4. construct a replacement CharacterData that preserves every existing field except:
   - replace `personality` with the compiled personality string;
   - replace `extensions.emotionProfile` as a complete object with the compiled profile;
5. build a complete replacement row preserving comment, avatar path, sprite-folder path, and creation timestamp;
6. submit one `executeMutation(kind: "replace")` request using the existing `apply` and `reason` semantics.

The `emotionProfile` replacement must be whole-object replacement, not a nested merge with the previous profile. Old state IDs, classifier descriptions, and mappings must not survive a canonical reapplication.

Do not persist `modelId`, `enneagramType`, or `attachmentStyle` into Character Card V2 extensions in this CR. A later feature can add inspectable authoring metadata if it has a concrete user requirement.

No changes should be made to `characters.storage.ts`: the Mari DB mutation layer already provides the required coherent row replacement, validation, history, Keep/Restore review, and conflict protection.

---

### `scripts/regressions/character-personality-model.regression.ts`

**Action:** Create

Add a focused pure-model regression that imports the shared compiler and proves the canonical model independently of Professor Mari.

Cover at minimum:

- every supported Enneagram ID resolves to the exact approved final paragraph;
- every supported attachment ID resolves to the exact approved final paragraph;
- the personality string contains all twelve state conditionals exactly once and in canonical order;
- conditional state IDs exactly match the generated `emotionProfile.states` IDs;
- the generated profile passes `characterEmotionProfileSchema`;
- all state IDs and labels are unique;
- each state has a non-empty classifier description within CR035's 500-character limit;
- the configured default exists in the canonical state set;
- unsupported model/type/style IDs fail;
- repeated compilation of the same input is byte/object equivalent.

The test should compare important canonical strings directly so accidental wording changes are visible rather than merely checking that output is non-empty.

---

### `scripts/regressions/professor-mari-personality-model.regression.ts`

**Action:** Create

Add focused server-side integration coverage around the structured action and bundled-skill lifecycle.

Exercise the real `MariDbService.executeAction()` path with isolated test storage where practical.

Cover:

- ordinary `character.create` without `personalityModel` remains unchanged;
- model-based `character.create` produces one complete inserted character whose `personality` and `emotionProfile` match the shared compiler;
- compiler output overrides conflicting caller-supplied `personality`/`emotionProfile` when the model is explicitly requested;
- invalid selections produce no character mutation;
- `character.applyPersonalityModel` replaces exactly the personality and complete emotion profile while retaining unrelated CharacterData, extensions, comment, avatar, and sprite metadata;
- dry-run does not persist;
- applied reapplication participates in the existing review/restore path and can restore the prior character row;
- malformed selection input fails before any partial mutation;
- first bundled-skill provisioning creates exactly one skill;
- repeated service initialization does not duplicate or overwrite it;
- a user edit/disable survives later initialization;
- deletion after the seed version has been recorded is not automatically undone on every restart.

The test should also inspect seeded skill content and fail if the fixed Pearson runtime catalogue or complete conditional template is embedded there, protecting the prompt-size purpose of the change.

---

### `docs/characters/creating-and-editing-characters.md`

**Action:** Modify

Add a concise Professor Mari subsection explaining the optional layered personality workflow:

- Professor Mari can choose an Enneagram core and attachment style when the bundled skill is enabled;
- Marinara generates the fixed Pearson conditional personality and emotion states automatically;
- Pearson state selection happens later through the Expression Engine/CR035, not during character creation;
- applying the model to an existing character replaces the full Personality field and emotion-state profile, with the normal Keep/Restore review available;
- ordinary manual personality and Emotional States editing remain supported.

Do not reproduce the entire personality catalogue in user documentation.

---

## 3. Cross-File Dependencies

1. `packages/shared/src/utils/character-personality-model.ts` defines the stable IDs and deterministic compiled output used by every other CR040 component.
2. `packages/shared/src/index.ts` exposes that compiler to the server and regression scripts.
3. `mari-db.service.ts` consumes the compiler and establishes the actual `character.create` + `character.applyPersonalityModel` behavior through the existing reviewed mutation engine.
4. `workspace-agent.service.ts` exposes only the corresponding structured action names and selection shape to Professor Mari; it must use the same IDs as the shared model and must not duplicate final prose.
5. `bundled-skills.ts` teaches Professor Mari how to choose those structured IDs; `workspace-skills.service.ts` provisions that compact content into the existing Skills store exactly once.
6. The regression scripts lock the shared compiler, Mari action contract, CR035 compatibility, reversible mutation behavior, and non-destructive seed lifecycle before development is considered complete.
7. No client changes are required because the seeded skill appears through the existing Skills list and the compiled emotion profile appears through CR035's existing Emotional States UI.

The canonical default mental-state ID must be resolved before the shared model/compiler tests can pass and before CR040 development can be marked complete.

---

## 4. File Change Summary

| File | Action | Purpose |
| --- | --- | --- |
| `packages/shared/src/utils/character-personality-model.ts` | Create | Own canonical definitions and compile personality + CR035 emotion profile deterministically. |
| `packages/shared/src/index.ts` | Modify | Export the canonical personality-model compiler. |
| `packages/server/src/services/professor-mari/bundled-skills.ts` | Create | Define the compact shipped Professor Mari personality-selection skill. |
| `packages/server/src/services/professor-mari/workspace-skills.service.ts` | Modify | Seed the bundled skill once without overwriting later user edits/deletion. |
| `packages/server/src/services/professor-mari/workspace-agent.service.ts` | Modify | Expose model-selection inputs and `character.applyPersonalityModel` through `app_data`. |
| `packages/server/src/services/mari-db/mari-db.service.ts` | Modify | Compile model-based character creation/reapplication and route both through reviewed atomic mutations. |
| `scripts/regressions/character-personality-model.regression.ts` | Create | Lock canonical compiler output and CR035 profile invariants. |
| `scripts/regressions/professor-mari-personality-model.regression.ts` | Create | Validate Mari actions, reversible updates, and bundled-skill seeding. |
| `docs/characters/creating-and-editing-characters.md` | Modify | Document the optional Professor Mari layered-personality workflow. |
