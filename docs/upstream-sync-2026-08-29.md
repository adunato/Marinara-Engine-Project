# Upstream integration — 2026-08-29

## Status

Conflict analysis and resolution plan recorded **before application conflict resolution**. The application integration branch `sync/upstream-2026-08-29` remains at the pre-merge Adunato head while this plan is written.

## Baseline

| Ref | SHA |
|---|---|
| `origin/main` / integration OURS | `e95df5e09eba365ee3c696ce2d38913f8eb5e0bd` |
| `origin/upstream-main` after clean mirror refresh | `1a299369ac7025028c3ce1b80cc59f47b7b0691b` |
| `upstream/main` / integration THEIRS | `1a299369ac7025028c3ce1b80cc59f47b7b0691b` |
| merge base | `b50a007e665ff81845228c7db9d1e32e9c4dc3a2` |

Ahead/behind at the integration inputs: Adunato `main` is **82 commits ahead** and **720 commits behind** Pasta-Devs `main`.

A detached clean checkout of OURS was verified before the merge. The mechanical baseline used `git merge --no-commit --no-ff THEIRS` with `merge.conflictStyle=zdiff3` and `rerere.enabled=true`. The merge exits with conflicts, as expected.

## Conflict inventory

The real three-way merge reports **47 unmerged paths**, all `both modified`. There are no unresolved rename/delete conflicts. `professor-mari-prompt-context.ts` is classified as binary solely because the source contains one literal NUL; its BASE/OURS/THEIRS text is still available and will be reconciled as source text.

### 1. Package, build, release metadata

- `CHANGELOG.md`
- `package.json`
- `packages/server/package.json`
- `pnpm-lock.yaml`

Relevant Adunato history: CR038/CR041/CR039 regression aliases, Phoenix tracing dependency, transient LLM retry regression. Relevant upstream history: 2.4.4 release notes, current filesystem-discovered regression runner and UI lane, dependency refreshes and security/release validation changes.

### 2. Shared schemas, constants and macro contracts

- `packages/shared/src/constants/chat-mode-agent-policy.ts`
- `packages/shared/src/index.ts`
- `packages/shared/src/utils/macro-engine.ts`
- `packages/server/src/services/prompt/macro-context.ts`
- `packages/server/src/db/schema/chats.ts`

Adunato: CR035 emotion macros/Conversation expression availability, CR038 `profileId`, CR040 personality-model export. Upstream: haptic Conversation availability, inventory exports, local variables, Game experience write ordinals.

### 3. Persistence, storage and profile isolation

- `packages/server/src/db/file-backed-store.ts`
- `packages/server/src/services/storage/chats.storage.ts`
- `packages/server/src/routes/chats.routes.ts`
- `packages/server/src/routes/conversation.routes.ts`
- `packages/server/src/routes/game.routes.ts`
- `packages/client/src/stores/ui.store.ts`
- `packages/client/src/stores/chat.store.ts`
- `packages/client/src/hooks/use-background-autonomous.ts`
- `packages/client/src/hooks/use-chats.ts`
- `packages/client/src/lib/persona-cache.ts`

Adunato: CR038 session/profile ownership and migration. Upstream: file-native sharding (`#5302/#5303`), Professor Mari workspace-context cascade, Game write ordinals, Conversation presence hardening, and `f999538ec` moving Conversation schedules from per-chat to per-character storage.

### 4. Generation/runtime and Conversation two-pass behavior

- `packages/server/src/routes/generate.routes.ts`
- `packages/server/src/routes/generate/conversation-history-runtime.ts`
- `packages/server/src/routes/generate/dry-run-route.ts`
- `packages/server/src/routes/generate/retry-agents-route.ts`
- `packages/server/src/services/capability-packages/capability-agent-registry.service.ts`
- `packages/server/src/services/conversation/awareness.service.ts`
- `packages/server/src/services/import/st-chat.importer.ts`

Adunato: CR035 character emotion state, CR037 stateful two-pass Conversation briefing, CR038 profile scoping, CR041 per-message generation emotion capture, plus existing local context/memory behavior. Upstream: request-scoped encrypted reasoning, semantic summary retrieval, Beholder state, capability finalization/runtime hardening, active-character routing, SillyTavern group attribution fixes.

### 5. LLM provider transport

- `packages/server/src/services/llm/base-provider.ts`
- `packages/server/src/services/llm/connection-fallback-provider.ts`
- `packages/server/src/services/llm/provider-registry.ts`
- `packages/server/src/services/llm/providers/anthropic.provider.ts`
- `packages/server/src/services/llm/providers/google.provider.ts`
- `packages/server/src/services/llm/providers/openai.provider.ts`

Adunato: `7e6743925` transient transport retries and `64e9d953b` Phoenix tracing. Upstream: `6dd2fc542` connection-aware rate-limit pause/resume and structured `LLMHttpError`, plus current provider fixes.

### 6. Professor Mari / workspace functionality

- `packages/server/src/services/professor-mari/workspace-agent.service.ts`
- `packages/server/src/routes/generate/professor-mari-prompt-context.ts`
- `packages/client/src/components/chat/HomeProfessorMariChat.tsx`

Adunato: CR039 global custom prompt injection, CR040 layered personality model authoring, CR038 profile-scoped Professor Mari context. Upstream: structured chat reads, lorebook folder operations, mutation authorization fixes, rate-limit handling and attached chat-history context.

### 7. Character/personality/emotion and message UI

- `packages/client/src/components/agents/AgentCatalogView.tsx`
- `packages/client/src/components/chat/ChatMessage.tsx`
- `packages/client/src/components/chat/ConversationMessageBubble.tsx`
- `packages/client/src/components/chat/ConversationMessageGrouped.tsx`
- `packages/client/src/components/chat/ConversationMessageLine.tsx`
- `packages/shared/src/constants/chat-mode-agent-policy.ts`
- macro files listed above

Adunato: CR035 expression/emotion support in Conversation and CR041 message-generation emotion labels. Upstream: unified Conversation chrome, reasoning presentation and new capability-agent catalogue entries.

### 8. Client editors/state/diagnostics/UI

- `packages/client/src/components/chat/PeekPromptModal.tsx`
- `packages/client/src/components/layout/TopBar.tsx`
- `packages/client/src/components/presets/PresetEditor.tsx`
- `packages/client/src/features/tracker-panel/components/TrackerDataSidebar.tsx`
- `packages/client/src/localization/locales/en.json`
- client hook/store files listed under persistence

Adunato: CR037 two-pass diagnostics/editor prompts, CR038 User Profile switcher/state, Custom Tracker Conversation changes, CR039 Home Mari UI. Upstream: editor-control unification, chat chrome/help, capability-owned tracker panels and current catalogue/UI fixes.

### 9. Regression coverage

- `scripts/regressions/chat-branch-lineage.regression.ts`
- `scripts/regressions/prompt.regression.ts`
- root regression scripts in `package.json`

Adunato: profile-ownership assertion, CR035 prompt/emotion tests and dedicated CR regression files. Upstream: turn-game branch-state preservation and many new prompt/runtime regression cases.

## Resolution plan

### A. Package/build/configuration — LOW/MEDIUM risk

**Cause.** Both histories extended the same script/dependency/release sections.

**Resolution.** Keep Pasta-Devs 2.4.4 release history and current command architecture verbatim. Keep Adunato `[Unreleased]` entries above it. Use the upstream root script map as the base, retaining only still-valid Adunato focused aliases (including User Profiles, two-pass, Professor Mari custom prompt, generation-emotion labels and LLM retries) as convenience/acceptance entry points; do not restore the obsolete upstream script layout or overwrite upstream `smoke:ui -> regression:ui`. Use the upstream server manifest plus the Phoenix dependency required by existing Adunato imports. Regenerate `pnpm-lock.yaml` from the resolved manifests rather than hand-merging lock chunks.

**Validation.** `pnpm install`; `pnpm install --frozen-lockfile`; `pnpm version:check`; `pnpm check`; focused Adunato aliases.

### B. Shared schemas/types/macros — MEDIUM risk

**Cause.** Additive features touch adjacent exports/fields.

**Resolution.** Compose the additions: `Chat.profileId` **and** upstream `writeOrdinalCounter`; Conversation agent allowlist contains both `expression` and upstream `haptic`; shared index exports both personality-model and inventory helpers; macro context keeps both `characterEmotions` and upstream `localVariables`; macro engine keeps `{{charEmotion}}` while retaining current upstream formatting/macros. No semantic localization collisions exist: a leaf-key comparison found **0 overlapping changed English localization keys**, so merge upstream localization then apply all Adunato-only leaves.

**Validation.** shared build/typecheck; prompt regression; CR035 regression; localization checks.

### C. Persistence/storage/profile isolation — HIGH risk

**Cause.** CR038 introduced profile ownership while upstream substantially changed storage and moved Conversation schedule state from chats to character cards.

**Resolution.** Preserve upstream file sharding, leases, Mari workspace cascade and Game write ordinals while retaining CR038 chat/folder/profile ownership and profile-scoped list APIs. The `file-backed-store` cascade list keeps both Adunato daily-memory children and upstream `mari_workspace_context`.

For Conversation schedules, preserve both **behaviors**, not the obsolete storage detail: upstream's character-owned schedule remains the source-of-truth architecture, but it must be keyed by User Profile so the same shared character cannot bridge profile history. Introduce the smallest profile-qualified read/write helper around the character extension, hoist each legacy chat-cached schedule into its owning profile's character schedule slot, and pass the owning/active `profileId` through schedule resolution/generation. Keep legacy global character schedule only as migration/default-profile input, not a cross-profile runtime source. Remove the old Adunato cross-chat schedule-copy loops that upstream made obsolete.

Keep CR038's profile-qualified Conversation timezone propagation because it still enumerates chats. Where upstream permits Character Editor schedule drafting without a chat, pass/require the active `profileId` so the schedule has a deterministic owner.

Merge `ui.store` migrations sequentially: retain upstream v96 chat-help/reasoning migration and add the CR038 legacy-continuity extraction as the next migration version (resulting persist version 97), written so both existing Adunato v94 stores and upstream v96 stores migrate correctly. Keep `chat.store.resetForProfileSwitch`, but do not resurrect upstream-removed dead `setSwipeIndex` Zustand mirrors. Keep profile-aware background polling and query/cache scoping; use upstream formatting/structural changes around them.

**Validation.** `regression:user-profiles`; chat branch lineage; storage/presence/schedule regressions discovered by upstream runner; focused tests for two profiles sharing one character with different schedules; typecheck.

### D. Generation/runtime/two-pass/emotion — HIGH risk

**Cause.** The central generation path changed heavily upstream while CR035/037/038/041 also modify it.

**Resolution.** Treat current upstream generation flow as the structural baseline and reapply only the existing Adunato seams at their current equivalents. Keep upstream request-scoped encrypted reasoning rather than restoring the old global cache. CR037's two-pass writer must continue to suppress/restrict replay of prior encrypted reasoning exactly as the existing implementation intends, but do so against the new request-scoped variable. Keep upstream semantic Conversation summary selection and merge it with CR037's summary-runtime failure/update handling rather than choosing one side. Keep upstream Beholder state and add CR035 persisted-character-emotion collection alongside it in dry-run/retry paths. Preserve CR041 capture/persistence of generation emotion and CR038 profile-scoped data reads. Preserve upstream capability finalization/active-character routing/runtime hardening.

No old removed runtime block is restored solely because it existed on OURS.

**Validation.** `pnpm regression:prompt`; CR035 emotion regression; CR037 two-pass regression; CR041 generation-emotion-label regression; regeneration-context; upstream generation/runtime regressions; `pnpm check`.

### E. LLM provider transport — HIGH risk

**Cause.** Adunato added general transient transport retries and Phoenix tracing; upstream independently added a connection-aware rate-limit/throttle decorator and changed provider HTTP errors.

**Resolution.** Use upstream's structured `LLMHttpError`/`llmHttpErrorFromResponse` API and provider call sites, while preserving `Retry-After-Ms` recognition needed by the existing transient retry classifier. Keep Phoenix tracing around the configured provider. Compose upstream rate-limit handling and Adunato transport retry without nesting two handlers for the same 429/529 event: connection-scoped rate-limit handling owns proxy/provider throttling; the Adunato layer remains responsible for network/408/502/504 and other non-rate-limit transient transport failures. Preserve fallback/admission ownership so a retry does not book a second logical background attempt and fallback notifications remain single-shot.

**Validation.** Adunato `regression:llm-retries`; upstream rate-limit/connection fallback regressions; provider regressions; `pnpm check`.

### F. Professor Mari / layered authoring — HIGH risk

**Cause.** Both sides extended the workspace protocol and Home Mari flow.

**Resolution.** Keep upstream's expanded `app_data` chat reads, lorebook folder operations, exact-ID guidance and mutation authorization text. Add CR040's `personalityModel` / `character.applyPersonalityModel` protocol and guidance to that expanded list rather than replacing it. Preserve CR039 `insertProfessorMariCustomPrompt`; also retain upstream's exported `workspaceCommandProtocolPrompt`. Preserve CR038 profile-scoped workspace prompt context; remove the accidental NUL during textual reconciliation without changing prompt content. In Home Mari, keep upstream UI/history behavior and retain `activeProfileId` in the dependencies/data scope required by CR038.

**Validation.** `regression:professor-mari-custom-prompt`; CR040 personality-model regression; upstream Professor Mari workspace/mutation/rate-limit regressions; `pnpm check`.

### G. Character/emotion/message rendering — MEDIUM/HIGH risk

**Cause.** CR041 added emotion labels exactly where upstream changed Conversation chrome/layout.

**Resolution.** Retain upstream Conversation chrome classes/layout and insert the existing `GenerationEmotionLabel` beneath the existing speaker metadata in Bubble/Grouped/Line renderers. Preserve segment-character resolution needed for grouped multi-character labels. In `ChatMessage`, use upstream imports/structure and add only the message-emotion helper. Agent catalogue and policy retain upstream inventory/memory/gacha additions plus Conversation availability for Adunato `custom-tracker`/`expression` as applicable.

**Validation.** CR035 + CR041 regressions; Conversation rendering/type checks; manual UAT for single/grouped Conversation labels and Roleplay label behavior.

### H. Editors/client state/diagnostics — MEDIUM risk

**Cause.** Current upstream editor/control rewrites overlap the UI added by CR037/038/039.

**Resolution.** Preserve upstream editor/chrome/control structure. Add the User Profile switcher into the current TopBar without resurrecting the removed Music DJ fallback. Retain CR037 two-pass Prompt Peek diagnostics and preset writer/briefing prompt fields inside the current upstream modal/editor sections. Keep upstream capability-owned tracker panels and retain the existing Custom Tracker Conversation behavior where its small local delta remains applicable. Formatting-only conflicts (`persona-cache`, portions of hooks) take upstream formatting while retaining local profile logic.

**Validation.** `pnpm check`; CR037/CR038 focused regressions; upstream UI regression lane where practical; manual profile switch + Prompt Peek UAT.

### I. Regression files — LOW risk

**Cause.** Both sides added independent assertions at the same insertion point.

**Resolution.** Keep both assertions/cases: branch lineage must assert inherited `profileId` **and** upstream turn-game/bootstrap state; prompt regression keeps CR035 emotion/macro case and upstream Storyboard/default-merging cases. Dedicated Adunato regression files remain intact unless an upstream API move requires mechanical test adaptation.

**Validation.** complete `pnpm regression` after focused checks.

## Dependency order

1. package/manifests and shared contracts
2. profile/storage/schema and schedule namespacing
3. LLM transport composition
4. generation/runtime/Conversation two-pass
5. Professor Mari / personality / character systems
6. client hooks/stores
7. UI/rendering/editors
8. regression reconciliation and lockfile regeneration
9. broad validation and staged diff audit

## Escalation threshold

The plan does not intentionally introduce new product semantics. The only material storage adaptation is profile-qualifying upstream's relocated Conversation schedule state to preserve CR038's already-established isolation invariant. If implementation reveals another upstream relocation that cannot preserve an Adunato behavior through mechanical namespacing/interface adaptation, stop before inventing a new behavior.
