# CR039 Implementation Plan — Professor Mari Custom Prompt Injection

## Status

Draft implementation plan aligned to the CR039 HLD. Application implementation has not started.

## Prerequisites

- Treat `change_requests/CR039_professor_mari_custom_prompt/HLD.md` as the design authority.
- Perform application work from a dedicated temporary worktree on `change/CR039-professor-mari-custom-prompt` in the nested `Marinara-Engine` repository.
- Read `Marinara-Engine/CONTRIBUTING.md` and `Marinara-Engine/packages/client/.instructions.md` before application edits.
- Preserve the existing hard-coded `MARI_SYSTEM_PROMPT` text and existing Professor Mari command protocol, Skills, Memories, history, and continuity behavior except for the approved insertion point.
- Reuse the existing `app_settings` persistence path; do not add a new database table unless implementation discovery proves the current key/value store cannot meet the HLD.
- Preserve existing provider adapter normalization rather than constructing provider payloads directly from Professor Mari code.

## Atomic Tasks

### 1. Add the shared custom-prompt contract

1. Define `PROFESSOR_MARI_CUSTOM_PROMPT_SETTINGS_KEY`, expected value `professorMariCustomPrompt`, in the shared settings/constants area.
2. Add a shared Zod schema for:
   - `enabled: boolean`;
   - `role: "system" | "user" | "assistant"`;
   - `content: string`, maximum 100,000 characters.
3. Export the inferred TypeScript type and a default disabled value.
4. Ensure malformed/missing persisted data can resolve to the default without throwing through Professor Mari generation.
5. Export the new schema/constants through `packages/shared/src/index.ts` following existing app-settings conventions.

### 2. Add app-settings persistence and API access

1. Add the new key to the server app-settings allowlist or, if cleaner, add a dedicated typed GET/PUT branch following the existing prompt-template settings pattern.
2. Store the structured setting as validated JSON in the existing `app_settings` key/value table through `createAppSettingsStorage()`.
3. On GET:
   - return the default when no value exists;
   - parse stored JSON with the shared schema;
   - log and fall back to default on invalid stored data.
4. On PUT:
   - validate the structured payload;
   - persist the normalized JSON;
   - return the normalized saved value.
5. Do not add a database migration.
6. Verify existing backup/restore handling for `app_settings` automatically includes the new key; only change backup code if current behavior excludes newly allowed keys.

### 3. Add a server-side settings reader for Professor Mari

1. Add a small Professor Mari custom-prompt settings helper/service, or equivalent focused helper near the workspace agent.
2. Read the setting from `app_settings` when `buildPromptMessages()` starts.
3. Resolve missing/invalid values to the disabled default.
4. Do not accept the custom prompt as part of `/professor-mari/workspace/prompt` request input; the server must own retrieval so all Mari chats receive the same global configuration.
5. Treat each turn's read as a snapshot. Do not restart or mutate an active workspace run when the setting is saved mid-turn.

### 4. Inject the custom message at the approved prompt boundary

1. In `packages/server/src/services/professor-mari/workspace-agent.service.ts`, keep the first logical message as `{ role: "system", content: MARI_SYSTEM_PROMPT }`.
2. Immediately after that message, conditionally append the custom message when:
   - `enabled === true`; and
   - `content.trim()` is non-empty.
3. Use the selected role exactly as stored: `system`, `user`, or `assistant`.
4. Use the user's content as the message content without silently adding wrappers or instructions.
5. Append the existing workspace command-protocol system message after the CR039 message, followed by all other existing prompt segments unchanged.
6. Ensure command-result rounds reuse the already-built message array and do not append another custom message.
7. Ensure the custom message participates in existing context/token fitting like any other prompt message and is not independently duplicated into history.

### 5. Preserve provider serialization compatibility

1. Add focused serializer/regression coverage proving all three logical roles can pass through the existing provider abstraction.
2. For Anthropic, verify the current extraction of system messages and normalization of user/assistant turns remains valid when CR039 is present.
3. For Google Gemini, verify system-role CR039 content remains valid when system messages are combined into `systemInstruction`, and User/Assistant roles serialize normally.
4. For OpenAI/OpenAI-compatible providers, verify the resulting message sequence remains valid under the existing serializer.
5. Do not add CR039-specific raw provider payload logic.
6. If one provider rejects an otherwise valid internal sequence, fix that compatibility in the provider adapter with a focused regression and document the normalization; do not change the saved CR039 role to hide the issue.

### 6. Add the Professor Mari Custom Prompt UI

1. Add a **Custom Prompt** header button immediately beside the existing **Memories** control in `HomeProfessorMariChat.tsx`.
2. Use the same responsive/open-panel interaction pattern as Skills/Memories so only the intended Mari auxiliary panel is open at a time.
3. Add a dedicated panel/editor containing:
   - Enabled toggle;
   - Role selector: System / User / Assistant;
   - multiline Custom prompt textarea;
   - Save action;
   - loading/saving/error state;
   - character count or maximum-length validation feedback.
4. Load the saved global value when the panel is opened or through the established query lifecycle.
5. Keep edits local until Save succeeds.
6. Preserve content and role when Disabled is saved.
7. Permit empty content to persist but make clear that an empty prompt injects nothing.
8. After successful save, update/invalidate the relevant client query so reopening the panel shows the persisted value.
9. Do not call Professor Mari workspace reset solely because the setting changed; the next turn reads the setting fresh.
10. Add translation keys for button label, panel labels, helper text, role labels, validation, and save success/error messages consistent with the existing i18n structure.

### 7. Keep debug/trace rendering distinct

1. Inspect Professor Mari debug/trace surfaces that render prompt messages.
2. Ensure the CR039 message appears as its own logical message with its selected role when those surfaces expose the assembled Marinara prompt.
3. Do not merge it into the displayed `MARI_SYSTEM_PROMPT` in application-level prompt previews.
4. Accept that provider-level tracing may show the provider-normalized representation.

### 8. Add focused regression coverage

Add focused tests covering at minimum:

1. missing setting -> disabled default;
2. invalid persisted JSON -> safe fallback;
3. valid save/load round trip for every role;
4. content length validation;
5. disabled setting -> no prompt message;
6. enabled blank setting -> no prompt message;
7. system role -> one CR039 message immediately after `MARI_SYSTEM_PROMPT`;
8. user role -> same position and role;
9. assistant role -> same position and role;
10. existing command protocol remains immediately after the CR039 slot;
11. Skills/Memories/history/continuity ordering after that boundary is unchanged;
12. multi-command workspace rounds retain one custom message without duplication;
13. two different Mari chat IDs receive the same global setting;
14. save during an active run affects only the next turn;
15. provider serialization remains valid for Anthropic, Google, and OpenAI/OpenAI-compatible paths;
16. UI reload and disable/re-enable preserve role/content;
17. existing Professor Mari behavior is unchanged when default/disabled.

### 9. Update user-facing documentation

1. Update `docs/home/professor-mari.md` with a short **Custom Prompt** section near Skills and Memories.
2. Explain that the setting is global to Professor Mari and injected on every new Mari turn while enabled.
3. Explain System/User/Assistant role selection at a user-facing level.
4. Clarify that the built-in Professor Mari prompt is not edited.
5. Note that providers may internally normalize message roles/order according to their API; avoid promising identical wire-level representation.
6. Warn concisely that long custom prompts consume context/tokens every turn.

### 10. Validate the completed application change

1. Inspect the focused diff for accidental changes to `MARI_SYSTEM_PROMPT`, command schemas, Skills, or Memories.
2. Run the focused CR039 regression suite.
3. Run `cd Marinara-Engine && pnpm check` once because the change spans shared/server/client layers.
4. Run `cd Marinara-Engine && pnpm db:push` only if implementation unexpectedly changes schema; it should not be needed under the approved design.
5. After integration into the primary nested checkout, run the production build there before manual UAT when required by the parent workflow.
6. After behavior-bearing implementation is complete, agree with the user whether to add focused Playwright E2E coverage with `$marinara-e2e-validation`.

## Expected Files and Areas

Primary expected areas:

- `packages/shared/src/schemas/app-settings.schema.ts`
- shared settings/constants module containing other app-settings keys
- `packages/shared/src/index.ts`
- `packages/server/src/routes/app-settings.routes.ts`
- `packages/server/src/services/storage/app-settings.storage.ts` — reuse expected; modification only if needed for typed helper behavior
- `packages/server/src/services/professor-mari/workspace-agent.service.ts`
- optional new focused Professor Mari custom-prompt settings helper under `packages/server/src/services/professor-mari/`
- `packages/client/src/components/chat/HomeProfessorMariChat.tsx`
- optional extracted Custom Prompt panel component under `packages/client/src/components/chat/` if keeping the editor inline would materially worsen the existing component
- client API/query helper area used for app settings
- i18n locale resources for the new Professor Mari UI strings
- `docs/home/professor-mari.md`
- focused shared/server/client regression tests for settings, prompt assembly, and provider serialization

No new table, migration, dependency, release metadata, version bump, Character/Persona schema, normal chat prompt path, Skills storage, or Memories storage changes are expected.

## Verification

The change is complete when all of the following are true:

1. Professor Mari shows Custom Prompt immediately beside Memories.
2. The user can save Enabled, Role, and Content globally.
3. The saved setting survives reload/restart through `app_settings`.
4. Disabled/default configuration preserves current behavior.
5. Enabled non-empty content produces one distinct logical message immediately after `MARI_SYSTEM_PROMPT`.
6. The internal role exactly matches System/User/Assistant selection.
7. Existing command protocol, workspace info, Skills, Memories, history, and continuity remain otherwise unchanged.
8. Multi-round workspace execution never duplicates the custom message.
9. The setting applies to every Professor Mari chat.
10. Changes take effect on the next turn without requiring workspace reset or restart.
11. Existing provider adapters serialize all three roles successfully or apply only their already-required compatibility normalization.
12. Existing server-side Professor Mari privilege and review controls remain authoritative.
13. Documentation explains scope, roles, provider normalization, and recurring context cost.
14. Focused regressions and `pnpm check` pass once.

## Rollback

Revert the CR039 application commits. The persisted `professorMariCustomPrompt` app-settings key can remain harmlessly in storage because older code will ignore an unknown unused value; optionally delete the key as cleanup if desired. No chat, message, Skills, Memories, character, persona, or provider data requires migration or repair.

## Approval Gate

The HLD and implementation plan define the approved planning scope only. Material changes require explicit review, including:

- making the prompt per-chat/per-model/per-profile instead of global;
- allowing multiple ordered custom messages;
- editing/replacing `MARI_SYSTEM_PROMPT`;
- moving the injection point away from immediately after `MARI_SYSTEM_PROMPT`;
- adding roles beyond System/User/Assistant;
- applying the setting outside Professor Mari;
- introducing a new persistence table;
- adding provider-specific raw prompt bypasses.
