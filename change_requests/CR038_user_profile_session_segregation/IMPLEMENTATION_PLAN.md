# Implementation Plan: CR038 — User Profile Session Segregation

## 1. Implementation Summary

CR038 will be implemented by introducing a server-persisted `UserProfile` record, making `Chat` and `ChatFolder` explicitly owned by one profile, and then carrying that ownership through every chat-creation, relationship, cross-chat retrieval, import, background, and client-navigation path that can expose conversational history.

The work is intentionally layered:

- establish profile persistence, migration, and shared contracts first;
- make server-side chat ownership and relationship boundaries authoritative;
- update cross-chat readers and persona resolution so hidden histories cannot influence one another;
- add profile-aware client caches, runtime switching, and the agreed profile-specific continuity state;
- finish portability, background-behaviour, and top-level selector integration;
- validate migration, isolation, continuity restoration, and shared-resource behaviour.

The HLD remains the architectural authority. This plan does not introduce profile-specific copies of characters, persona definitions, lorebooks, presets, connections, agents/tools, themes, or general settings.

---

## 1.1 Current implementation status — 2026-08-28

Implementation is in progress on branch `change/CR038-user-profile-session-segregation` in `C:\Users\danie\projects\Marinara-Engine-Project\Marinara-Engine-cr038`. The implementation remains uncommitted.

### Atomic work status and evidence

| Atomic plan work | Status | Evidence / current boundary |
|---|---|---|
| Server profile-scoped ownership, `listAll`, and runtime propagation | Complete | Confirmed implemented in the CR038 worktree. |
| Client folder/chat cache, reorder, and timezone propagation | Complete | Confirmed implemented in the CR038 worktree. |
| Client TypeScript compilation | Complete | Client `tsc` passes. |
| Client production build | Complete | Client build passes. |
| Server lint | Complete | Server lint passes. |
| Diff integrity | Complete | `git diff --check` passes. |
| Client persona cache and global active-persona state | Outstanding | Still requires completion; profile-specific persona state is not yet fully isolated. |
| Profile status/activity/resume/Game reset, restoration, and continuity handling | Outstanding | Full profile-specific state transition and restore behaviour remains incomplete. |
| Import/backup, notifications, and background-work propagation | Outstanding | These integration surfaces still have known gaps. |
| Seven CR038 regressions | Outstanding | Seven identified regressions remain to be resolved. |
| Full validation | Blocked / pending rerun | `pnpm check` has had server TypeScript failures during migration and needs rerun/confirmation after the remaining work. |
| Commit and implementation hand-off | Pending | Must follow completion of the outstanding implementation and validation work. |

### Outstanding priorities

1. Finish client persona cache isolation and remove reliance on global active-persona state for CR038 runtime behaviour.
2. Complete profile-specific status/activity/resume/Game reset and restoration, including the remaining continuity paths.
3. Close the import/backup, notifications, and background-work gaps.
4. Resolve all seven identified CR038 regressions.
5. Rerun and confirm the full validation set, including `pnpm check`, after the migration-related server TypeScript failures are addressed.
6. Commit the completed implementation only after validation evidence is satisfactory.

### Validation and blockers

The focused evidence currently available is: client `tsc` pass, client build pass, server lint pass, and `git diff --check` pass. Full `pnpm check` is not yet confirmed because it has reported server TypeScript failures during migration. Full validation therefore remains pending and is the active blocker to implementation hand-off.

### Rollback and next steps

Rollback remains limited to the uncommitted CR038 worktree: preserve the current worktree state, isolate any corrective edits to the outstanding surfaces, and avoid changing the approved HLD or shared tracker records. The next implementation step is to complete the outstanding client and integration work, rerun the focused checks and full `pnpm check`, resolve any remaining failures, perform the required validation, and then commit the branch for hand-off.

---

## 2. HLD Reference

The implementation is constrained by these approved design decisions:

- A User Profile is a logical Conversation/Roleplay/Game history and context namespace, not a separate account or security boundary.
- `Chat` and `ChatFolder` are the primary persisted ownership boundary; descendants normally inherit ownership through their chat rather than duplicating `profileId`.
- Cross-chat relationships, derived chats, and context readers must never bridge profiles.
- Shared resources and ordinary application/system settings remain installation-global.
- Persona definitions remain shared, but active/default persona selection becomes profile-specific.
- Only the agreed non-chat continuity state moves into User Profile: active persona, last mode/chat, user status/activity/recent activities, and learned/remembered Game setup state.
- The active User Profile is a client/application selection; server-side ownership decisions must use persisted chat/profile relationships and explicit profile inputs rather than trusting UI filtering.
- Existing installations migrate into one Default profile without changing their visible chat history or reusable resources.
- The first delivery supports create, select, and rename only; profile delete, merge, move, and intentional cross-profile links remain out of scope.

---

## 3. Repository Assessment

Repository inspection supports the HLD and does not reveal a material architectural conflict.

- Conversation, Roleplay, and Game already share the common `Chat` type and `chats` table. `Chat` and `ChatFolder` currently have no profile ownership field, making them the natural place to add the boundary.
- Messages, swipes, memories, daily memories, notes, influences, context sources, Game state, calls, and media are already rooted in chat IDs. Most do not need a redundant `profileId`.
- `createChatsStorage().list()` and `listRecent()` currently enumerate all chats, and normal chat creation has no profile input. Fresh Conversation schedule inheritance also scans other chats without a profile constraint.
- Cross-Chat Awareness currently enumerates all Conversation chats sharing a character and falls back to the globally active persona. Both behaviours must become profile-aware.
- Persona definitions currently carry a global `isActive` flag. That is suitable only as migration/backward-compatibility fallback after CR038; it cannot remain the canonical runtime selector.
- `ui.store.ts` currently persists user status/activity/recent activities and learned/remembered Game setup state globally. These values must move behind the active User Profile while unrelated UI/system settings remain in the global UI store.
- React Query chat keys are currently global (`["chats", ...]`), and `useChats()` can display previous query data while a new list is loading. A profile switch therefore needs profile-qualified keys and must prevent previous-profile placeholder data from rendering.
- `chat.store.ts` has one persisted active chat ID and extensive per-chat runtime state for streams, typing, unread notifications, calls, Game state, drafts, and queues. The store already has reset patterns that can be reused during profile switching, but active/resume state must become profile-aware.
- The file-native backend loads schema-defined tables, registers them in `FILE_BACKED_TABLES`, and already supports targeted row migrations. CR038 needs a coordinated, idempotent profile bootstrap/backfill rather than relying only on independent row defaults, because existing chats and folders must all reference the same newly created Default profile.
- Existing profile migration has two storage domains: server data can migrate chats/folders and the globally active persona, while some agreed continuity values currently exist only in browser-local Zustand persistence. The implementation must therefore include a one-time client-to-server continuity migration handshake.

The repository structure therefore matches the HLD's intended split: profile ownership can be established centrally while shared libraries remain untouched.

---

## 4. Implementation Approach

### 4.1 User Profile contracts, persistence, and API

Add shared User Profile types and validation schemas covering:

- stable profile ID and name;
- active/default persona ID;
- last active mode and last active chat per Conversation/Roleplay/Game;
- manual/current user status, activity, and recent activities;
- learned Game setup options and remembered Game setup text;
- timestamps and any migration/version marker needed for legacy continuity migration.

Add a first-class `user_profiles` file-backed table and a focused storage/service layer. Register the table with the file-native storage/backup machinery and expose a small server API for:

- list/read profiles;
- create profile;
- rename profile;
- patch profile continuity state.

No delete/move/merge endpoint is added in CR038.

The server must ensure at least one profile exists. Profile names must be validated as user-visible labels, but the stable ID is the ownership key.

### 4.2 Existing-installation bootstrap and migration

Implement an idempotent server-side bootstrap that runs after file-native data is available and before normal profile-aware chat operations depend on it.

For an installation without CR038 ownership data it must:

1. create one Default User Profile;
2. assign every existing chat to Default;
3. assign every existing chat folder to Default;
4. copy the existing global active persona into `Default.activePersonaId` when one exists;
5. preserve every existing chat ID and relationship;
6. leave all globally shared resources untouched.

Because legacy status/activity and remembered Game setup values currently live in browser persistence, add a one-time client migration handshake. On the first CR038-aware client load, the client offers its legacy continuity snapshot to the Default profile; the server accepts it only if that profile has not already completed that migration. This must be atomic/idempotent so reloads or a second client cannot repeatedly overwrite profile state.

After migration, profile state becomes canonical. Legacy global persona/UI fields may remain readable only where required for backward compatibility, but normal CR038 runtime behaviour must stop depending on them.

### 4.3 Chat and folder ownership at the server boundary

Add `profileId` to the shared `Chat` and `ChatFolder` contracts and to their persisted tables.

Make profile scope explicit in the server API/storage paths that enumerate or create history:

- chat list/recent/search/history surfaces must require or derive a profile scope;
- folder list/create/update operations must be profile-scoped;
- normal new-chat creation must receive the active profile ID and reject an unknown profile;
- direct chat-by-ID reads may resolve any valid chat, but the returned chat always carries its owning `profileId`;
- assigning a chat to a folder must verify that both belong to the same profile.

The active profile is therefore not an implicit server-global variable. The client supplies profile scope for profile-level operations, while operations starting from an existing chat derive ownership from that chat.

Audit history consumers such as home/recent surfaces so any list that exposes Conversation, Roleplay, or Game history uses the same profile boundary.

### 4.4 Derived chats and same-profile relationship integrity

Centralise profile inheritance and same-profile validation rather than duplicating ad-hoc checks in individual routes.

Derived chats must inherit their source/parent profile automatically for:

- branches and grouped siblings;
- duplicates;
- connected Conversation/Roleplay chats;
- Scene/Roleplay derivations;
- Game party/dialogue/combat child chats;
- internal/hidden chats created on behalf of a user chat.

Relationship-writing paths must reject cross-profile references for at least:

- `connectedChatId`;
- group/branch relationships;
- Roleplay context-source links;
- Conversation notes and OOC influences with source/target chats;
- Game child-chat references;
- any other persisted source/target chat relationship discovered during the LLD inventory.

Profile choice is never offered for a derived chat because changing it would break the relationship invariant.

### 4.5 Cross-chat readers, schedule inheritance, and persona resolution

Update every deliberate cross-chat reader so candidate chats are constrained by the owning chat's profile before character, mode, date, or relevance rules are applied.

Known mandatory updates include:

- Cross-Chat Conversation Awareness;
- fresh Conversation schedule inheritance;
- Roleplay/Scene source-chat selection and retrieval;
- chat context-source resolution;
- any summary/memory helper that enumerates chats rather than starting from a single chat ID;
- internal assistant/background paths that inspect other chats.

Cross-Chat Awareness must use the source/current chat profile and must resolve persona identity from the concrete chat `personaId` first, then the owning User Profile's `activePersonaId`, rather than the global `Persona.isActive` flag.

Fresh schedule inheritance must accept the profile as part of its candidate query so a new Conversation cannot inherit schedules from another profile that happens to share the same character.

### 4.6 Client profile coordination, query partitioning, and switching

Add a small client profile coordinator/store that persists only the active profile selection and coordinates server-backed profile data. Keep general UI/application settings in their existing global store.

On application startup:

1. fetch User Profiles;
2. validate the persisted `activeProfileId`;
3. fall back deterministically to Default/first valid profile when needed;
4. complete any one-time legacy continuity migration;
5. load that profile's chat lists and continuity state.

Profile-qualify React Query keys for data that can expose profile-owned chat history. Chat/folder/history queries must not reuse previous-profile data as placeholder content during a key change. Detail/message keys should also carry sufficient profile identity wherever doing so prevents cross-profile cache reuse or stale rendering.

Implement profile switching as one coordinated transition:

1. persist the outgoing profile's resume/continuity state;
2. change the active profile selection;
3. clear or partition active chat messages, streaming/typing state, unread/notification state, active call state, Game/encounter state, response queues, and other profile-owned runtime state;
4. invalidate/remove profile-sensitive query data that is not naturally isolated by its key;
5. hydrate the incoming profile's continuity state;
6. restore its last active mode/chat only if that chat still exists and belongs to that profile/mode;
7. otherwise show the profile's normal empty/default history view.

Existing chat-ID-keyed drafts may remain globally stored because chat IDs are unique, but the active composer must always follow the active chat/profile.

A switch must not abort legitimate server-side background work solely because the user changed profile; it must prevent that work's UI/runtime state from leaking into the newly active profile.

### 4.7 Move the agreed continuity state behind User Profile

Refactor current callers so these values are read from and written to the active User Profile rather than global UI/persona state:

- active/default persona;
- last active mode;
- last active chat per Conversation/Roleplay/Game;
- manual/current user status;
- current user activity;
- recent user activities;
- learned Game setup options;
- remembered Game setup text.

Profile updates should use a bounded/debounced persistence path where navigation or activity can generate frequent changes, while low-frequency selections can persist immediately.

Persona-management and new-chat flows must display/select the active profile's persona without duplicating the Persona record. Existing chats continue to use their concrete `chat.personaId`.

Do not opportunistically move other UI settings into User Profile during this refactor.

### 4.8 Import, export, duplication, backup, and restore

Preserve portability rules from the HLD:

- normal single-chat export must not make a local User Profile ID part of the portable semantic identity;
- normal import receives the active profile and assigns the imported chat graph to it;
- duplicate inherits the source profile;
- imported internal relationships must all resolve inside the assigned profile;
- backup/restore must include `user_profiles` plus chat/folder ownership fields through the normal file-native table snapshot mechanism;
- restore/bootstrap must repair legacy missing ownership into a Default profile but must not silently merge intentionally distinct CR038 profiles.

Any export/import schema versioning needed for optional `profileId` tolerance should be backward-compatible with pre-CR038 chat exports.

### 4.9 Notifications, autonomous/background work, and profile UI

Background jobs continue their existing scheduling semantics, but every job starting from a chat must retain that chat's profile identity through context gathering and writes.

Unread counts and notifications must be filtered/presented according to the active profile. Inactive-profile activity may be retained for later display, but message content and chat notifications from it must not appear as though they belong to the active profile.

Add the minimal top-level User Profile UI specified by the HLD:

- show active User Profile;
- switch profile;
- create profile;
- rename profile.

The selector must sit at an application-shell level that applies equally to Conversation, Roleplay, and Game. A newly created profile opens with empty history while all shared characters, personas, lorebooks, presets, connections, agents/tools, extensions, themes, and system settings remain immediately available.

Deep-link/navigation to a chat owned by a different profile should switch to that chat's owning profile before rendering it.

---

## 5. Implementation Sequence

1. Add shared User Profile contracts/schemas and the persisted `user_profiles` table/storage registration.
2. Implement the idempotent server bootstrap/backfill and the one-time legacy-continuity migration contract.
3. Add `profileId` to Chat/ChatFolder contracts and persistence, then profile-scope list/create/folder server operations.
4. Add central profile-inheritance and same-profile relationship guards for derived/connected/source-target chat paths.
5. Update Cross-Chat Awareness, Conversation schedule inheritance, source-chat retrieval, and the remaining global chat-enumeration paths identified by LLD inventory.
6. Make profile `activePersonaId` canonical for default persona resolution while retaining only the required legacy fallback.
7. Add client User Profile queries/coordinator, profile-qualified caches, and deterministic profile-switch reset/hydration behaviour.
8. Move the agreed status/activity/resume/Game setup state from global persistence to the active User Profile and complete the legacy client migration.
9. Add the top-level profile selector/create/rename UI and update import/export/duplicate/backup/background behaviour.
10. Run focused regression/integrity checks, resolve any remaining profile-boundary gaps, and hand the completed implementation to the separate validation stage.

The server ownership boundary must precede the UI selector so isolation is correct even before the client begins filtering by profile.

---

## 6. Development Integrity Checks

During implementation, complete the repository-relevant checks before the separate validation stage:

- run focused tests/regressions for new profile storage, migration, ownership, and relationship helpers while developing them;
- run `pnpm db:push` because CR038 changes server/file-backed schema and persistence;
- run `pnpm check` after the substantive cross-package implementation is complete;
- inspect the final diff for accidental profile-scoping of globally shared resources or unrelated UI settings;
- confirm no new version/release metadata is touched; `pnpm version:check` is only required if implementation unexpectedly changes version-bearing files.

A production build in the primary application checkout belongs after integration when preparing the application for manual/UAT use, consistent with the parent repository workflow; a temporary worktree build is not a substitute for that hand-off build.

---

## 7. Validation Requirements

The later validation stage must prove both visible segregation and invisible context isolation.

### Unit Validation

- Default-profile bootstrap creates exactly one profile for a legacy installation, backfills chats/folders, preserves IDs/relationships, and is idempotent.
- User Profile create/rename/continuity updates validate inputs and never allow the last profile to disappear because deletion is not exposed.
- Chat/folder list and creation paths honour profile scope.
- Folder assignment and source/target chat relationship helpers reject cross-profile combinations.
- Branch/duplicate/connected/Game child creation inherits the source profile automatically.
- Cross-Chat Awareness selects only same-profile Conversation chats even when another profile uses the same character.
- Conversation schedule inheritance selects only same-profile candidates.
- Default persona resolution uses chat `personaId`, then User Profile `activePersonaId`, with legacy `Persona.isActive` only as fallback where required.
- Import assigns the active target profile and does not preserve an unrelated local profile ID as portable identity.
- Profile continuity serialization/restoration preserves only the agreed fields.

### End-to-End Validation

Focused Playwright validation should prove, subject to the normal explicit E2E agreement in the CR workflow:

- an upgraded existing installation opens in Default with its existing history intact;
- creating Profile B produces empty Conversation/Roleplay/Game history while shared characters/personas/lorebooks/settings remain available;
- creating chats in Profiles A and B and switching A → B → A shows only each profile's own history and restores its last mode/chat;
- profile-specific active persona, status/activity, and remembered Game setup state restore independently;
- switching profiles never briefly renders the outgoing profile's chat list/messages through query placeholder data;
- same-character Conversations in different profiles do not cross-feed Awareness or inherited schedules;
- context-source selection and connected/derived chat flows cannot create a cross-profile link;
- branch/duplicate/Scene/Game child flows inherit profile ownership without prompting for another profile;
- unread/background activity from an inactive profile does not surface as active-profile message content or chat notification.

### Other Relevant Validation

- Verify a backup/restore round-trip retains multiple User Profiles, their chat/folder ownership, and continuity state.
- Verify a pre-CR038 single-chat export imports into whichever profile is active.
- Verify a CR038 chat export can be imported into another profile/installation without requiring the source installation's local profile ID.
- Exercise desktop and mobile/profile-switch navigation sufficiently to ensure the top-level selector does not depend on a mode-specific shell.
- Confirm globally shared resources remain shared after profile creation and switching.

---

## 8. Open Implementation Questions

These are implementation-detail questions for the LLD, not changes to the approved HLD:

- What exact atomic marker/API handshake should be used so browser-local legacy continuity state is migrated into Default once without a later client overwriting it?
- Which complete set of internal/background chat-enumeration paths currently bypasses `createChatsStorage().list()` and therefore needs explicit profile scoping, including Professor Mari/internal chats, home/recent surfaces, and autonomous workers?
- Which chat-related React Query keys should be fully profile-qualified versus safely keyed by globally unique chat ID, and what exact invalidation/reset order prevents stale rendering during a switch?
- Which existing persona-selection UI/actions currently mutate `Persona.isActive`, and what compatibility shim is needed while `UserProfile.activePersonaId` becomes canonical?
- What is the least disruptive top-level shell location/component boundary for the User Profile selector on both desktop and mobile?

None of these questions changes the feature boundary; they require codebase-specific design before development.

---

## 9. Low-Level Design Decision

**LLD required:** Yes

### Rationale

CR038 spans several tightly coupled areas: file-native persistence and migration, shared schemas, chat/folder storage, relationship integrity, cross-chat retrieval, persona resolution, import/export, background behaviour, React Query caching, multiple Zustand runtime stores, and application-shell navigation.

The HLD defines the ownership and behavioural invariants, and this implementation plan defines the work sequence, but safe development still requires a file/component-level design for:

- the `UserProfile` storage/API contract and coordinated legacy migration;
- the complete inventory of chat-creation and cross-chat relationship paths;
- the complete inventory of global chat-enumeration/context-reader paths;
- client profile-store ownership and the exact atomic switch/reset/hydration sequence;
- migration of existing persona/UI-store callers to profile state;
- import/export/internal-chat handling and focused regression seams.

Without that LLD, a developer would have to discover important boundaries while coding, which creates a meaningful risk of invisible cross-profile context leakage. The next stage should therefore be a separate Low-Level Design using the repository-specific implementation details discovered above.

---

## 10. Implementation Checklist

- [ ] Add shared User Profile types/schemas and persisted profile storage/API
- [ ] Implement Default-profile bootstrap and one-time legacy continuity migration
- [ ] Add Chat/ChatFolder profile ownership and profile-scoped list/create/folder operations
- [ ] Add same-profile relationship guards and derived-chat ownership inheritance
- [ ] Profile-scope Awareness, schedule inheritance, source-chat retrieval, and all audited cross-chat readers
- [ ] Make User Profile active persona canonical while preserving required legacy fallback
- [ ] Add client active-profile coordination, profile-qualified caches, and deterministic switch/reset/hydration
- [ ] Move the agreed status/activity/resume/Game setup state behind User Profile
- [ ] Update profile UI, import/export/backup, notifications, and background behaviour
- [ ] Complete relevant development integrity checks
- [ ] Complete implementation summary for hand-off to validation
