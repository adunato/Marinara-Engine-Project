# CR039 — Professor Mari Custom Prompt Injection

## Status

Draft HLD for review. UX direction was agreed before CR creation; application implementation has not started.

## Problem

Professor Mari's Home workspace assistant is intentionally driven by a large hard-coded `MARI_SYSTEM_PROMPT` plus additional system messages for the workspace command protocol, dynamic workspace information, Skills, Memories, conversation history, and hidden workspace continuity. The hard-coded prompt is operationally important and should remain owned by the application rather than becoming directly user-editable.

Users can already influence Mari through Skills and Memories, but neither mechanism provides a simple, deterministic way to inject one always-present steering message with an explicitly selected LLM role. A persistent Memory is close to a custom instruction, but it remains part of the Memories model and does not give the user direct control over whether the steering text is presented as `system`, `user`, or `assistant`.

CR039 adds a small, explicit custom-prompt facility for Professor Mari only. It preserves the built-in prompt unchanged while giving the user a separate message that is automatically included in every new Professor Mari workspace turn.

## Goals

- Add one global user-configurable **Professor Mari Custom Prompt**.
- Keep the hard-coded `MARI_SYSTEM_PROMPT` unchanged and separately owned by the application.
- Let the user enable or disable the custom prompt without deleting its content.
- Let the user choose the injected message role from:
  - `system`;
  - `user`;
  - `assistant`.
- Represent the custom prompt as a distinct internal LLM message, not string-concatenate it into `MARI_SYSTEM_PROMPT`.
- Insert the custom message immediately after the hard-coded `MARI_SYSTEM_PROMPT` in Professor Mari's logical prompt assembly.
- Apply the configured message to every Professor Mari workspace conversation and every new turn, independent of which Mari chat is active.
- Keep the custom message present through Mari's multi-round workspace-agent command loop for that turn.
- Surface configuration beside the existing **Memories** control in the Professor Mari chat header.
- Persist the setting across restart using Marinara's existing synced app-settings storage.
- Preserve current behavior exactly when the feature is disabled or has no usable content.
- Preserve existing provider-specific message normalization and compatibility behavior.

## Non-goals

- Editing or replacing the hard-coded `MARI_SYSTEM_PROMPT`.
- Changing Professor Mari's character card or using the character card as the Home workspace agent's base prompt.
- Adding multiple ordered custom prompt blocks in the first version.
- Per-chat, per-connection, per-model, or per-profile custom prompts.
- Applying this setting to normal Conversation, Roleplay, Game, agents, or other generation paths.
- Replacing Skills or Memories.
- Reordering the existing command-protocol, workspace-info, Skills, Memories, history, or continuity prompt segments beyond the one insertion point defined here.
- Adding provider-specific prompt rewriting solely to make all providers expose identical wire-level message arrays.
- Allowing prompt text to bypass server-side privilege, validation, review, or workspace security controls.

## Current-State Observations

### Professor Mari prompt assembly

`packages/server/src/services/professor-mari/workspace-agent.service.ts` builds the Home workspace agent prompt from multiple logical messages. The current high-level order is:

1. hard-coded `MARI_SYSTEM_PROMPT`;
2. workspace command protocol and schemas;
3. dynamic workspace information;
4. enabled custom Skills, when present;
5. Memories prompt, when present;
6. Professor Mari chat history and attachments;
7. hidden workspace continuity injection, when present.

The user's latest Mari message is persisted before prompt construction, and the workspace agent can perform multiple command rounds. Command results are appended to the in-memory message sequence and the model is called again. A CR039 custom message added to the initial prompt therefore remains in the same turn's subsequent command rounds without being duplicated.

### Existing UI placement

`packages/client/src/components/chat/HomeProfessorMariChat.tsx` already exposes Professor Mari controls for Chats, Skills, and Memories in the chat header. Memories is the closest conceptual neighbor because it already represents standing user guidance. CR039 should appear immediately beside Memories, but remain a distinct control and panel because its semantics are different: one explicit always-injected message with a selectable role rather than a collection of memories.

### Existing persistence

Marinara already provides the `app_settings` key/value store and `/api/app-settings/:key` routes. This is an appropriate fit for one global Professor Mari preference and avoids a new database table or schema migration.

### Provider normalization

Marinara's provider adapters do not all preserve the exact internal message array on the wire:

- Anthropic extracts `system` messages into its system field and normalizes consecutive `user`/`assistant` turns as required by the Messages API.
- Google Gemini combines system messages into `systemInstruction`.
- OpenAI-compatible providers may preserve more of the internal message ordering, subject to the target API.

CR039 therefore guarantees the custom prompt's **logical role and placement inside Marinara's `ChatMessage[]`**, while existing provider adapters remain responsible for legal provider serialization. The feature must not bypass those adapters or introduce provider-specific raw payload construction.

## Proposed Solution

### 1. Add one typed global setting

Introduce a shared settings contract conceptually equivalent to:

```ts
type ProfessorMariCustomPromptRole = "system" | "user" | "assistant";

type ProfessorMariCustomPromptSettings = {
  enabled: boolean;
  role: ProfessorMariCustomPromptRole;
  content: string;
};
```

Default value:

```ts
{
  enabled: false,
  role: "system",
  content: "",
}
```

The stored payload should be schema-validated and bounded. A maximum content length of **100,000 characters** is sufficient for deliberate steering while preventing an accidental unbounded app-setting value from dominating prompt context.

Disabling the setting must retain the stored role and text so it can be re-enabled later.

### 2. Persist through `app_settings`

Add a dedicated shared settings key, for example:

```text
professorMariCustomPrompt
```

Use the existing `app_settings` storage rather than creating a new table. The setting should be exposed through the existing app-settings API pattern with a typed JSON payload serialized into the key/value store.

Required behavior:

- missing setting resolves to the default disabled value;
- invalid stored JSON resolves safely to the default and logs a warning rather than breaking Professor Mari;
- save validates role/content before persistence;
- no database migration is required;
- existing backup/restore behavior for app settings should continue to carry the value automatically.

### 3. Inject as a distinct message immediately after `MARI_SYSTEM_PROMPT`

Professor Mari prompt construction should become logically:

```text
SYSTEM     MARI_SYSTEM_PROMPT
CUSTOM     user-configured role + content       <-- CR039
SYSTEM     workspace command protocol
SYSTEM     dynamic workspace info
SYSTEM     enabled Skills, if any
SYSTEM     Memories, if any
HISTORY    Mari chat history + attachments
INJECTION  hidden workspace continuity, if any
```

Conceptually:

```ts
const messages: ChatMessage[] = [
  { role: "system", content: MARI_SYSTEM_PROMPT },
];

if (customPrompt.enabled && customPrompt.content.trim()) {
  messages.push({
    role: customPrompt.role,
    content: customPrompt.content,
  });
}

messages.push(
  { role: "system", content: workspaceCommandProtocolPrompt() },
  // existing prompt segments unchanged
);
```

Important invariants:

- never concatenate CR039 text into `MARI_SYSTEM_PROMPT`;
- do not wrap or rewrite the user's text with extra behavioral instructions;
- preserve the configured role internally;
- omit the message entirely when disabled or content is empty/whitespace;
- read the setting server-side rather than trusting the client to attach it to each prompt request;
- take one settings snapshot when constructing a turn. If the user changes the setting while Mari is already working, the in-flight turn continues with its existing prompt and the next turn uses the saved update;
- command rounds inside one Mari turn retain the same injected message and must not add another copy.

### 4. Keep provider adapters authoritative

The setting controls the internal logical role. Existing provider adapters continue to transform the message sequence as required by provider APIs.

Examples:

- two logical `system` messages may become one provider-level system instruction;
- a leading `assistant` message may require an adapter's existing compatibility normalization;
- consecutive same-role messages may be merged by an adapter.

These transformations do not change the saved CR039 role. No UI promise should claim byte-for-byte wire ordering across providers.

No new provider-specific workaround is required unless implementation testing reveals that CR039 exposes an existing unsupported sequence that currently causes a provider request to fail. Any such workaround should be minimal and belong in the normal provider adapter, not in Professor Mari prompt construction.

### 5. Add a dedicated Custom Prompt panel beside Memories

Add a Professor Mari header control immediately beside **Memories**, labeled **Custom Prompt**.

The panel contains:

- **Enabled** toggle;
- **Role** selector with `System`, `User`, and `Assistant`;
- multiline **Custom prompt** editor;
- explicit **Save** action;
- optional character count / maximum-length feedback;
- short explanatory copy that the setting is global and is sent on every new Professor Mari turn.

UX rules:

- opening the panel loads the persisted global setting;
- editing is local until Save succeeds;
- disabling does not erase text;
- role remains selectable while disabled so the user can configure before enabling;
- empty text may be saved, but produces no injected message even if Enabled is on;
- save success should take effect on the next Professor Mari turn without restart;
- panel behavior must work in the existing responsive/mobile Professor Mari layout;
- Skills and Memories behavior remains unchanged.

### 6. Do not weaken server-side safety boundaries

CR039 is prompt steering, not privilege configuration. User text can influence the model's behavior, including potentially encouraging it to ignore parts of its built-in operational guidance, but it cannot bypass server-side controls.

Existing protections remain authoritative, including privileged-access gates, file/security approvals, database review/restore behavior, schema validation, and command execution restrictions.

The application should not attempt to semantically police or rewrite the custom text beyond ordinary length/schema validation. The feature is explicitly intended to give the local user control over model steering.

### 7. Keep observability understandable

Where Professor Mari debug/trace tooling already exposes prompt messages, the custom message should appear as a distinct message with its selected role. It should not be silently folded into the displayed hard-coded Mari system prompt by Marinara-level debug rendering.

Provider traces may still show provider-normalized serialization.

## User Flows

### First use

1. User opens Professor Mari.
2. User selects **Custom Prompt** beside Memories.
3. The panel shows Disabled, System role, and an empty editor.
4. User enters steering text, selects a role, enables the setting, and saves.
5. The next Professor Mari turn includes the custom message immediately after the hard-coded `MARI_SYSTEM_PROMPT` in logical prompt assembly.

### Change role

1. User opens Custom Prompt.
2. User changes `System` to `User` or `Assistant` and saves.
3. Existing Mari history is not rewritten.
4. The next new turn uses the new logical role.

### Temporarily disable

1. User turns Enabled off and saves.
2. Stored content and role remain visible in the panel.
3. Future Mari turns omit the message.
4. Re-enabling restores it without re-entry.

### Change setting during an active Mari run

1. A Mari turn is already executing command rounds using the prompt snapshot created at turn start.
2. User saves a new Custom Prompt setting.
3. The active run is not mutated or restarted.
4. The following turn uses the new setting.

## Compatibility and Migration

- Existing installations require no data migration.
- Missing setting means Disabled and preserves current behavior.
- Existing Professor Mari chats require no modification.
- Skills and Memories require no migration.
- Existing provider adapters remain the sole serialization layer.
- App backups/restores should carry the setting through existing app-settings behavior; implementation should verify this rather than add a parallel backup format.

## Risks

### Prompt hierarchy and provider differences

A custom `system`, `user`, or `assistant` message does not have identical influence across models/providers. Provider adapters may also flatten or merge messages. Mitigation: define the feature in terms of Marinara's logical message role and document provider normalization rather than promising identical provider wire payloads.

### User text can degrade Mari's tool discipline

The user can deliberately add instructions that conflict with Mari's built-in agent behavior. This is an intended consequence of exposing model steering. Mitigation: keep server-side validation, privilege, review, and execution controls unchanged and authoritative.

### Large custom prompts consume context

Because the message is injected every turn, long content consumes context and tokens. Mitigation: bound content length, show length feedback, and make the setting visibly global/always-injected.

### Prompt assembly regression

Inserting a non-system role before later system segments may expose provider-specific assumptions. Mitigation: add focused prompt-array and provider-serialization regressions for all three roles before relying on manual testing.

### Accidental duplication across command rounds

The workspace agent performs iterative calls. Incorrect implementation could append the custom message once per command round. Mitigation: insert only during initial `buildPromptMessages()` construction and test that later command results reuse rather than duplicate the message.

## Validation

Implementation must verify:

1. Default/missing setting leaves Professor Mari prompt behavior unchanged.
2. Enabled System role creates exactly one distinct system `ChatMessage` immediately after `MARI_SYSTEM_PROMPT`.
3. Enabled User role creates exactly one distinct user `ChatMessage` at the same logical position.
4. Enabled Assistant role creates exactly one distinct assistant `ChatMessage` at the same logical position.
5. Disabled or blank content produces no custom message.
6. The setting applies to different Professor Mari chats because it is global, not chat-owned.
7. The message remains present exactly once throughout a multi-command Mari turn.
8. Changes take effect on the next turn without server restart or workspace reset.
9. Anthropic, Google, OpenAI/OpenAI-compatible serialization paths remain valid under their existing normalization rules.
10. UI load/edit/save/disable/re-enable behavior persists across reload.
11. Existing Skills and Memories panels remain unchanged.
12. Existing server-side privilege/review controls remain unaffected.
13. Focused tests and `cd Marinara-Engine && pnpm check` pass once for the substantive cross-cutting change.
14. After implementation, agree with the user whether to add focused Playwright E2E coverage via the repository E2E skill.

## Approval State

The UX and core behavior described here were agreed before CR creation. This HLD is ready for repository review. Application development should begin only after the CR039 planning artifacts are accepted/merged or the user explicitly directs implementation from this design.
