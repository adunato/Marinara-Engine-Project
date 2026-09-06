# CR056 - Character Briefing Roleplay Injection

_Status: Planning._

## 1. Goal

Extend Character Briefing so a character's non-empty Latest Briefing is
available during Roleplay generation as well as Conversation generation.
Preserve CR044's existing Conversation injection and keep the change additive
to the Roleplay prompt/context pipeline.

## 2. Scope and non-goals

This CR covers only runtime injection of the already persisted Character
Briefing Latest Briefing into applicable Roleplay responses, together with the
focused regression coverage needed to prove the behaviour.

It does not redesign Character Briefing authoring or generation, change the
briefing storage/API contract, alter provider or connection configuration,
change Roleplay source-chat/context semantics, or remove or replace any
existing Roleplay prompt sources. No database or schema change is expected
unless code inspection during planning identifies an existing compatibility
requirement.

## 3. Base and branch intent

- Application base: local `main`, including the completed CR044 Character
  Briefing implementation.
- Planned application branch: `change/CR056-roleplay-character-briefing`.
- Parent CR documentation remains in this repository; implementation must use
  a dedicated nested application worktree.

## 4. Proposed solution

Inspect the Roleplay generation context assembly and identify the narrow seam
where resolved responding-character context is converted into the final model
request. Extend the existing Character Briefing context formatter/access path
or its shared equivalent so applicable non-empty Latest Briefings are added to
Roleplay with deterministic character attribution and the same stable-ID
targeting rules already used by CR044.

The implementation must keep Conversation behaviour unchanged, emit no
briefing content when the target has no Latest Briefing, avoid duplicate
character blocks, and preserve the established Roleplay context ordering and
prompt boundaries. Exact placement and whether a shared helper can be reused
are implementation-planning questions, not settled file-level decisions in
this intake.

## 5. Risks

- Roleplay may resolve responding characters or prompt sections differently
  from Conversation, so target filtering and attribution could be incorrect.
- An incorrect insertion boundary or ordering could weaken existing Roleplay
  instructions or cause the briefing to be interpreted as user dialogue.
- Reusing the Conversation seam without checking Roleplay-specific context
  rules could duplicate content or leak non-target character briefings.
- Prompt regressions may be subtle; focused Roleplay coverage should assert
  both presence and absence cases while retaining existing sources.

## 6. Validation

- Add a focused Roleplay generation/prompt regression for one target with a
  non-empty Latest Briefing, including deterministic attribution and expected
  placement at the chosen context seam.
- Cover empty/missing briefings, multiple resolved targets, duplicate target
  IDs, and exclusion of non-target group members where those cases are
  supported by the existing Roleplay model.
- Confirm Conversation injection remains unchanged through the existing CR044
  regression coverage or an equivalent focused check.
- Run the smallest applicable server/shared/client integrity checks, inspect
  `git diff --check`, and run the primary application build when the branch is
  ready for manual validation. No schema or release checks are expected unless
  planning evidence changes that assessment.

## 7. Acceptance criteria

- A Roleplay response target with a non-empty Latest Briefing receives that
  briefing as additive character context.
- Roleplay with no applicable Latest Briefing has no additional briefing
  prompt content.
- Multi-target Roleplay behaviour is deterministic, emits each applicable
  target once, and excludes non-target characters.
- Existing Character Briefing Conversation injection and all unrelated
  Roleplay context sources remain intact.
