# CR035 Implementation Plan

## Prerequisites

- Approve the CR035 HLD, especially the intentional next-turn semantics of post-generation emotion classification.
- Identify the Engine-host changes and the package-owned Expression Engine prompt/manifest changes that require a coordinated Pasta-Devs/Marinara-Agents release while preserving legacy installed packages.
- Read `packages/client/.instructions.md` before editing client code.
- Reconfirm the current Expression Engine result, persistence, SSE, swipe, and avatar-rendering paths in the CR worktree.

## Tasks

1. Define the shared emotion-profile schema and types.
   - Add the typed character extension.
   - Normalize and validate enabled state, stable IDs, default state, descriptions, and optional sprite mappings.
   - Preserve backward compatibility for cards without the extension.

2. Add character-editor Emotional States controls.
   - Support enable/disable, add, rename, reorder, remove, default selection, descriptions, and optional sprite mappings.
   - Add an insertion helper for `{{#if charEmotion == "state-id"}}...{{/if}}`.
   - Warn when configured-state changes leave card references unresolved.

3. Extend message/swipe persistence.
   - Add a per-character emotion map to message extra.
   - Ensure generation, regeneration, swipe selection, serialization, import/export where applicable, and client cache updates retain it.
   - Resolve the latest applicable state from the selected conversation history.

4. Extend the built-in Expression Engine contract without adding another call.
   - Supply each relevant character's previous state and configured allowed-emotion enum alongside available sprites.
   - Extend the structured result with an optional emotion state per character.
   - Keep legacy expression-only output valid.
   - Classify configured emotion targets even when they have no sprite assets.

5. Validate and apply the combined result.
   - Reject unknown characters, emotion IDs, and expressions.
   - Apply valid configured sprite mappings deterministically where specified.
   - Preserve existing expression completion/fallback behavior.
   - Persist the expression for the current avatar and emotion for the following turn.
   - Share validation/finalization between normal generation and agent retry paths where practical.

6. Add `charEmotion` to prompt resolution.
   - Bind the operand per currently expanded character.
   - Use latest selected-swipe state, then configured default, then empty string.
   - Ensure inactive conditional branches are removed before nested macro effects and token fitting.

7. Cover every supported Roleplay prompt construction path.
   - Preset character markers and group expansion.
   - Identity fallback character-card injection.
   - Regeneration and dry-run/Peek Prompt.
   - Empty `charEmotion` behavior outside Roleplay.
   - Any additional Roleplay card-field consumer identified during implementation discovery.

8. Add focused automated coverage and user documentation.
   - Document authoring syntax, post-generation/next-turn behavior, default and failure semantics, and interaction with Expression Engine.
   - Add schema, macro, server pipeline, persistence, and focused client tests.

9. Run proportionate validation.
   - Run the focused tests added for the shared, server, and client layers.
   - Run `pnpm check` once after the cross-package implementation is complete.
   - Agree with the user whether to add and run focused Playwright E2E validation.
   - If manual app validation is requested in the primary checkout, build there before starting the app and stop all Codex-started processes afterward.

## Files Expected

Exact filenames should follow implementation discovery, but likely areas include:

- `packages/shared/src/types/character.ts`
- `packages/shared/src/schemas/character.schema.ts`
- `packages/shared/src/types/chat.ts`
- `packages/shared/src/types/agent.ts`
- `packages/shared/src/utils/macro-engine.ts`
- `packages/server/src/services/agents/agent-executor.ts`
- `packages/server/src/routes/generate.routes.ts`
- `packages/server/src/routes/generate/expression-agent-utils.ts`
- `packages/server/src/routes/generate/retry-agents-route.ts`
- `packages/server/src/services/generation/character-prompt-context.ts`
- `packages/server/src/services/generation/agent-event-dispatcher.ts`, if combined events require adaptation
- `packages/server/src/services/prompt/marker-expander.ts`
- `packages/server/src/services/prompt/macro-context.ts`
- `packages/client/src/components/characters/CharacterEditor.tsx` and a focused extracted emotion editor if appropriate
- `packages/client/src/components/ui/MacroTextarea.tsx`, if macro insertion/reference warnings belong in the shared editor
- existing expression-avatar consumers under `packages/client/src/`, only where combined live-result handling requires changes
- focused shared/server/client test files
- relevant prompt/character-card documentation under `docs/`

## Verification

- Character profile schema accepts valid configurations and safely normalizes legacy/malformed data.
- Expression-only legacy results remain valid.
- Emotion-only characters without sprites are classified, while sprite-only characters preserve current behavior.
- A combined result updates the current swipe avatar and persists its emotion.
- The next turn includes only the active `charEmotion` branch.
- No profile, disabled profile, invalid output, agent failure, and removed state all use the specified fallback.
- Group characters receive independent states.
- Selecting another swipe changes the state source used by the next prompt.
- Roleplay generation, regeneration, and prompt preview do not expose inactive fragments; other modes resolve `charEmotion` empty.
- `pnpm check` passes.

## Rollback

Revert the CR035 implementation commit(s). Existing cards remain readable because the extension is optional and conditional text is stored as ordinary card text. Remove or ignore persisted `characterEmotions` fields; legacy Expression Engine `spriteExpressions` behavior remains intact.
