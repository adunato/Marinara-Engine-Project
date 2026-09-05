# Low-Level Design: CR038 — User Profile Session Segregation

## 1. Change Overview

CR038 will add a server-persisted `UserProfile` ownership layer around Conversation, Roleplay, and Game history while leaving reusable libraries and application settings global. `Chat.profileId` and `ChatFolder.profileId` become the authoritative ownership fields; profile-aware server queries and cross-chat guards prevent history leakage, while a dedicated client profile store coordinates selection, continuity state, cache partitioning, and safe profile switching.

The implementation deliberately preserves existing chat IDs and chat-descendant storage. Most child records continue to derive profile ownership through their parent chat. Existing installations are upgraded through an idempotent Default-profile migration, including a one-time browser-to-server handoff for continuity values that currently exist only in persisted client state.

---

## 2. File Changes

### `packages/shared/src/types/user-profile.ts`

**Action:** Create

Define the shared User Profile contract and the small set of profile-specific continuity types. This file becomes the common type source for server storage/API code and client state.

Define `UserProfile` with:

- `id` and `name`;
- `activePersonaId: string | null`;
- `lastActiveMode: ChatMode | null`;
- `lastActiveChatByMode: Partial<Record<ChatMode, string>>`;
- `userStatusManual` and effective `userStatus`;
- `userActivity` and `recentUserActivities`;
- learned Game setup options and remembered Game setup text;
- a `legacyClientStateMigrated` marker used only to make the one-time browser continuity migration idempotent;
- `createdAt` and `updatedAt`.

Move the profile-owned `UserStatus`, `GameSetupLearnedOptions`, and `GameSetupRememberedText` type definitions out of client-only UI state into this shared contract. Export default/normalization-friendly empty values where they avoid duplicating constants between client and server.

The type must not contain themes, model/provider settings, prompt presets, lorebooks, agents, tools, connection settings, or other globally shared configuration.

---

### `packages/shared/src/schemas/user-profile.schema.ts`

**Action:** Create

Define the validation boundary for User Profile APIs.

Provide schemas for:

- creating a profile with a validated name and optional seed `activePersonaId`;
- renaming a profile;
- patching the agreed continuity state;
- the one-time legacy browser-state migration payload;
- User Profile identifiers where a reusable validator is useful.

The continuity schema should constrain status values, activity length, recent-activity count, and Game setup arrays/text consistently with the current client limits. `profileId` is never accepted as mutable continuity data.

The legacy migration payload may include the former global active chat ID plus the old browser-only status/activity/Game setup values. The server, not the browser, resolves whether the supplied active chat is valid and belongs to the migration profile.

---

### `packages/shared/src/types/chat.ts`

**Action:** Modify

Add `profileId: string` to `Chat` and `ChatFolder`.

`profileId` is an ownership field rather than editable chat metadata. It must be present on persisted/current API chat and folder records after migration.

Do not add `profileId` to messages, swipes, memories, daily memories, call records, Game state, media records, or other ordinary chat descendants; they continue to inherit ownership through `chatId`.

---

### `packages/shared/src/schemas/chat.schema.ts`

**Action:** Modify

Add required `profileId` to normal chat creation input.

Split update validation from creation validation instead of continuing to use a partial create schema for chat PATCH operations. The update schema must explicitly exclude `profileId`, preventing a normal chat edit from moving an existing chat between User Profiles.

Derived-chat routes that inherit ownership from a source chat should not trust a caller-supplied profile. They may use an internal create shape or override the profile with the source chat's persisted `profileId` before storage creation.

---

### `packages/shared/src/schemas/folder.schema.ts`

**Action:** Modify

Keep the existing generic folder schemas usable by globally shared connection folders while adding chat-folder-specific profile ownership validation.

Do not make the generic connection-folder create schema require a User Profile. Instead expose a chat-folder create/patch shape that requires `profileId` on creation and excludes profile mutation on update.

---

### `packages/shared/src/index.ts`

**Action:** Modify

Export the new User Profile types, constants, and validation schemas through the existing shared package barrel.

---

### `packages/server/src/db/schema/user-profiles.ts`

**Action:** Create

Create the `user_profiles` file-backed table.

Use first-class columns for stable identifiers and simple scalar fields, and JSON-encoded text columns for compact structured continuity values such as `lastActiveChatByMode`, recent activities, learned Game setup options, and remembered Game setup text.

Recommended stored fields:

```text
id
name
activePersonaId
lastActiveMode
lastActiveChatByMode
userStatusManual
userStatus
userActivity
recentUserActivities
learnedGameSetupOptions
rememberedGameSetupText
legacyClientStateMigrated
createdAt
updatedAt
```

`activePersonaId` should not create a schema-level circular dependency on the personas table. Validate referenced personas through the storage/service layer and clear profile references when a persona is deleted.

No profile-delete cascade is required because User Profile deletion is outside CR038.

---

### `packages/server/src/db/schema/chats.ts`

**Action:** Modify

Add `profileId` to `chats` and `chat_folders`, referencing `user_profiles.id` where the file-schema relationship model permits it.

Legacy rows need a load-compatible temporary/default value so pre-CR038 storage can be normalized before normal application operations. The startup User Profile migration must replace every blank/unassigned ownership value with a real profile ID before profile-aware routes are used.

Do not add redundant profile columns to existing chat-descendant tables.

---

### `packages/server/src/db/schema/index.ts`

**Action:** Modify

Export `user_profiles` so storage, backup, migration, and route code can consume it through the existing schema barrel.

---

### `packages/server/src/db/file-backed-store.ts`

**Action:** Modify

Register `user_profiles` in `FILE_BACKED_TABLES`, before `chats` in logical load/backup ordering.

No storage-format version bump is required solely for the new table/columns. The file-native store already normalizes schema-defined rows and supports targeted migration. CR038 should use the coordinated startup migration rather than changing the root storage format contract.

Keep `user_profiles` non-sharded. Existing chat-descendant sharding remains unchanged because shard identity continues to be the chat ID.

---

### `packages/server/src/db/user-profile-migration.ts`

**Action:** Create

Implement the idempotent server-side CR038 bootstrap.

Within a transaction:

1. find the migration/default User Profile or create one named `Default` when no profile exists;
2. backfill every chat without valid ownership to that profile;
3. backfill every chat folder without valid ownership to the same profile;
4. inspect the legacy globally active persona and seed `Default.activePersonaId` when no profile-specific value exists;
5. preserve all chat IDs, folder IDs, group IDs, connected-chat IDs, Game child-chat IDs, and descendant data unchanged;
6. leave globally shared libraries/settings untouched.

A Default profile created for a legacy installation starts with `legacyClientStateMigrated = false`, because browser-only continuity still needs to be offered by the first upgraded client. Profiles created normally after CR038 start with that marker completed.

The function must be safe to run after startup and after restoring a pre-CR038 full backup. If profiles already exist, it must never duplicate them merely because the function runs again.

Expose a focused `ensureUserProfilesInitialized(db)`-style entry point returning whether persistence changed so the caller can flush when necessary.

---

### `packages/server/src/db/connection.ts`

**Action:** Modify

Run the User Profile bootstrap after the file-native database has loaded and before `getDB()` exposes it to normal route/storage consumers.

If migration changed persisted rows, ensure the file store flushes the initialized profile/chat/folder state rather than relying indefinitely on in-memory normalization.

---

### `packages/server/src/services/storage/user-profiles.storage.ts`

**Action:** Create

Provide the server-canonical User Profile storage facade.

Responsibilities:

- list and get profiles;
- create a profile;
- rename a profile;
- patch continuity state;
- set/change `activePersonaId` after validating the persona exists;
- validate `lastActiveChatByMode` entries against chat ownership and mode;
- perform the one-time legacy client-state migration atomically;
- clear `activePersonaId` references when a persona is deleted.

Profile creation should accept an optional `activePersonaId` seed, normally supplied by the current client profile. If omitted, legacy global active-persona state may be used only as a compatibility/default seed; it is not the normal runtime selector.

The legacy browser migration must be compare-and-set style: if `legacyClientStateMigrated` is already true, return the current profile without overwriting it. When accepted, normalize the supplied legacy values, resolve the legacy active chat server-side, write only valid same-profile resume state, then mark the migration complete in the same transaction.

---

### `packages/server/src/services/storage/chats.storage.ts`

**Action:** Modify

Make the chat storage facade the primary enforcement point for profile ownership and same-profile relationships.

Change user-facing collection operations to require scope:

```text
list(profileId)
listRecent(profileId, limit, offset)
create({ ..., profileId })
```

Add an explicitly named all-profile/internal enumeration method for maintenance/background workflows that genuinely operate across profiles. Do not retain an ambiguous global `list()` that can accidentally be used by conversational features.

Update fresh Conversation schedule inheritance so it searches only Conversation chats with the same `profileId` as the new/current chat.

Centralize same-profile guards for relationship writes, including:

- `connectedChatId`;
- branch/group lineage where related chats are discovered or modified;
- context source replacement;
- influence and durable-note source/target pairs;
- folder assignment;
- any Game/derived-chat relation written through chat storage.

`profileId` must be immutable on ordinary update. `getById(id)` remains a direct stable-ID read because deep links and internal operations need to resolve the owning profile before deciding how to present the chat.

Global cleanup operations for shared resources, such as removing a deleted lorebook reference from every chat, must deliberately use the internal all-profile enumeration path rather than accidentally becoming active-profile-only.

---

### `packages/server/src/services/storage/chat-folders.storage.ts`

**Action:** Modify

Scope chat-folder list/create/reorder operations by `profileId`.

Folder creation requires ownership. Reordering or moving chats must verify that the chat and target folder belong to the same User Profile. Folder deletion/unfiling must affect only chats owned by that folder's profile.

No operation in CR038 moves an existing folder to a different profile.

---

### `packages/server/src/routes/user-profiles.routes.ts`

**Action:** Create

Expose the minimal User Profile API:

```text
GET    /api/user-profiles
POST   /api/user-profiles
PATCH  /api/user-profiles/:id
POST   /api/user-profiles/:id/migrate-legacy-client-state
```

The PATCH endpoint supports rename and agreed continuity updates only. It does not expose deletion, merge, chat movement, or arbitrary profile-owned data mutation.

Return normalized `UserProfile` records so the client can hydrate its active-profile mirror directly.

---

### `packages/server/src/routes/index.ts`

**Action:** Modify

Register the new User Profile routes with the existing API route set.

---

### `packages/server/src/routes/chats.routes.ts`

**Action:** Modify

Make user-facing chat collections profile-qualified.

- `GET /api/chats` requires `profileId` and calls the scoped chat list.
- Home/recent feed endpoints used by the active UI require `profileId`.
- `POST /api/chats` requires a valid profile for ordinary new-chat creation.
- Normal PATCH uses the new update schema and cannot mutate ownership.

Derived/branch/duplicate creation must fetch the source chat and inherit its persisted `profileId`; caller input cannot override it.

Autonomous/background candidate discovery remains intentionally cross-profile, but each candidate response must carry the owning `profileId` so the client can apply the correct profile continuity and notification policy.

Professor Mari/internal hidden chat lookup must be profile-specific when the hidden chat participates in conversational continuity: locate/create the internal chat by both internal-assistant identity and `profileId`, rather than reusing one hidden history across all User Profiles.

Single-chat export remains portable. A local `profileId` may be omitted from the portable payload or explicitly treated as non-semantic; importing into another installation must not require that local profile ID to exist.

Direct `GET /api/chats/:id` remains capable of resolving a chat regardless of the currently selected client profile. The returned `profileId` lets the client switch to the correct profile before rendering it.

---

### `packages/server/src/routes/chat-folders.routes.ts`

**Action:** Modify

Require/forward `profileId` for chat-folder list and create operations, and use profile-aware chat-folder storage for mutations.

---

### `packages/server/src/routes/folder-routes.shared.ts`

**Action:** Modify

Extend the generic folder-route factory with an optional ownership/scope adapter rather than baking User Profiles into all folder types.

Chat-folder routes use the adapter to extract/validate `profileId`. Connection folders and other globally shared folder resources retain their current behavior.

---

### `packages/server/src/services/conversation/awareness.service.ts`

**Action:** Modify

Resolve the current chat's `profileId` and constrain Cross-Chat Awareness candidates to that same profile before applying the existing shared-character and enablement rules.

Include `profileId` in the internal selected chat row shape and retain an explicit same-profile check in the source selector as defense in depth.

Replace the globally active persona fallback with the owning User Profile's `activePersonaId`. A source chat's concrete `personaId` still wins. Shared character/persona definitions remain visible across profiles; their existence must never bridge histories.

---

### `packages/server/src/routes/generate/generate-route-utils.ts`

**Action:** Modify

Change active-persona resolution helpers so Conversation fallback accepts an explicit profile active persona ID rather than inferring normal runtime identity from `Persona.isActive`.

Resolution order becomes:

1. concrete chat persona when present;
2. owning User Profile's active/default persona for Conversation fallback;
3. legacy globally active persona only when profile state is unavailable during compatibility/migration paths.

Roleplay/Game behavior that intentionally permits no persona remains unchanged.

---

### `packages/server/src/routes/generate.routes.ts`

**Action:** Modify

After resolving the chat, load its owning User Profile and thread profile identity/default persona into generation paths that currently assume one global user identity.

Use profile-aware persona resolution for prompt identity and persisted user-message snapshots. Supply the current chat ownership to Cross-Chat Awareness, connected/context-source builders, and command handlers that inspect another chat.

The generation request does not need to trust an active client `profileId`; the authoritative profile is always read from the requested chat.

---

### `packages/server/src/routes/generate/roleplay-context-sources.ts`

**Action:** Modify

Add `profileId` to the minimal context-source chat shape and verify that each selected source belongs to the target Roleplay chat's profile before reading summaries/messages/Game state.

The storage layer should already prevent a new cross-profile link, but the prompt builder must still skip/reject malformed legacy/corrupt cross-profile relationships rather than injecting them.

---

### `packages/server/src/routes/generate/conversation-connected-context.ts`

**Action:** Modify

Pass the current Conversation's owning profile into connected-chat context resolution and require the connected Roleplay/Game chat to match it before reading any transcript or building influence/note instructions.

---

### `packages/server/src/routes/generate/connected-conversation-injections.ts`

**Action:** Modify

Add ownership awareness to connected Conversation/Roleplay/Game influence, note, and OOC injection handling.

Before consuming/injecting connected-chat content, verify that the connected chat belongs to the generation chat's profile. Malformed cross-profile links must not be allowed to inject or consume data.

---

### `packages/server/src/services/generation/conversation-cross-post-command-runtime.ts`

**Action:** Modify

Scope `<cross_post>` target discovery to the source Conversation's User Profile.

The current implementation searches the global chat list by target name/ID. Change the local storage interface so the handler first resolves source ownership and receives/enumerates only same-profile Conversation candidates. A character may therefore cross-post between Conversations within Profile A, but never into an identically named chat in Profile B.

---

### `packages/server/src/routes/characters.routes.ts`

**Action:** Modify

Keep existing global persona library CRUD and the legacy global active-persona endpoints for backward compatibility, but stop treating them as the new client's selector.

When deleting a persona, clear any `UserProfile.activePersonaId` references through User Profile storage so no profile retains a dangling default. Existing chat-specific `personaId` handling should continue according to current delete semantics.

---

### `packages/server/src/routes/scene.routes.ts`

**Action:** Modify

All Scene-derived Roleplay chats inherit the originating Conversation/Roleplay chat's `profileId` from persisted server state.

Any fallback persona used during scene creation comes from the source chat's User Profile rather than the legacy globally active persona. Connected-chat relationships established by the scene flow must pass the same-profile storage guard.

---

### `packages/server/src/routes/game.routes.ts`

**Action:** Modify

For a brand-new Game, accept the selected profile through the normal creation boundary. For subsequent sessions and Game-created party/dialogue/combat child chats, inherit `profileId` from the campaign/root/source chat on the server.

When reading/writing metadata links to Game child chats, verify that every referenced child belongs to the same profile before treating it as part of the session.

---

### `packages/server/src/routes/import.routes.ts`

**Action:** Modify

Require a target `profileId` for chat-history imports initiated by the active UI and pass it to the chat importers.

Imports of globally shared resources such as characters, personas, lorebooks, presets, and connections remain installation-global and do not require profile ownership merely because they are imported through the same route group.

---

### `packages/server/src/services/import/st-chat.importer.ts`

**Action:** Modify

Add `profileId` to chat-import options and write it on every newly created imported chat/folder relationship.

For imports that append to or reuse an existing related/grouped chat, derive/validate ownership from that existing chat instead of moving it to the caller's current profile.

Imported payload IDs must never be treated as authority to select a local User Profile.

---

### `packages/server/src/services/import/st-bulk.importer.ts`

**Action:** Modify

Thread the target User Profile through bulk chat-history import operations while leaving imported shared libraries global.

Every chat created during one bulk chat import uses the selected target profile unless the importer is explicitly extending an existing local chat/group, in which case that existing ownership is authoritative.

---

### `packages/server/src/routes/backup.routes.ts`

**Action:** Modify

Because `user_profiles` is part of `FILE_BACKED_TABLES`, current full backups include it automatically.

After restoring a full backup, call the same idempotent `ensureUserProfilesInitialized` migration used at startup before normal application access resumes. This makes a pre-CR038 backup restored by a CR038+ application produce a valid Default profile and backfilled chat/folder ownership immediately.

Do not rename the repository's existing “profile import” backup terminology; that feature predates and is conceptually separate from CR038 User Profiles.

---

### `packages/client/src/stores/user-profile.store.ts`

**Action:** Create

Create a small Zustand store for client selection/runtime profile state.

Persist only the browser's `activeProfileId` under a new unambiguous storage key. Keep the hydrated active `UserProfile` and switching/bootstrap flags in runtime state; the server remains canonical for continuity values.

Expose actions needed by profile-aware consumers, including optimistic/local updates for status/activity and Game setup while the corresponding server patch is queued.

Do not duplicate the full profile list in this store; React Query owns server collection data.

---

### `packages/client/src/hooks/use-user-profiles.ts`

**Action:** Create

Own the User Profile API/query layer and the profile-switch coordinator.

Provide profile query keys and hooks for list/create/rename/continuity updates. Profile creation should seed `activePersonaId` from the currently selected profile when available so shared persona identity carries forward without duplicating the persona record.

Implement bootstrap:

1. fetch profiles;
2. choose persisted `activeProfileId` when it still exists, otherwise choose the server's first/default profile;
3. run the one-time legacy client continuity handshake if that profile requests it;
4. hydrate the active profile store;
5. restore valid profile resume state.

Implement profile switch as one coordinated operation:

1. persist outgoing `lastActiveMode`/`lastActiveChatByMode` if needed;
2. mark switching so chat surfaces cannot render mixed state;
3. clear only profile-visible chat runtime state;
4. set/persist the target `activeProfileId`;
5. hydrate target profile continuity;
6. fetch/activate target profile chat/folder/home collections;
7. restore the target profile's valid last chat/mode, or show its empty/default surface.

Do not call `queryClient.clear()`: character/persona/lorebook/preset/connection/agent caches are shared and must survive profile switching.

Provide a central “navigate to chat by ID” helper that fetches/resolves the chat, switches to `chat.profileId` when required, and only then activates the chat. Use this for deep links and notifications.

Implement debounced/coalesced continuity persistence where rapid local updates could otherwise cause avoidable PATCH traffic.

---

### `packages/client/src/hooks/use-chats.ts`

**Action:** Modify

Profile-qualify chat collection queries while preserving globally unique chat-ID detail/message caches.

Retain `chatKeys.all` as a broad invalidation prefix if useful, but introduce an actual collection key such as:

```text
chatKeys.listForProfile(profileId)
```

`useChats()` reads the active profile internally, requests `/chats?profileId=...`, and remains disabled until profile bootstrap is ready. Remove previous-profile `placeholderData` behavior for the profile collection so a switch cannot briefly render the outgoing profile's chats.

Normal create mutations inject the active profile ID. Branch/duplicate mutations do not choose ownership client-side; the server inherits it from the source.

Chat detail/message/memory/note/context keys may remain based on globally unique chat IDs, which avoids needless cache duplication and permits owner resolution for deep links. Any collection cache update after a background action must target the owning profile's collection key.

---

### `packages/client/src/hooks/use-chat-folders.ts`

**Action:** Modify

Profile-qualify chat-folder query keys and API calls using the active User Profile. Creation includes the active `profileId`; move/reorder operations rely on server same-profile validation.

Connection-folder hooks remain unchanged.

---

### `packages/client/src/hooks/use-home-feed.ts`

**Action:** Modify

Include `profileId` in the home-feed query key and request. Disable the query until active profile bootstrap is complete.

This prevents recent/home history from one profile appearing while another profile is selected.

---

### `packages/client/src/hooks/use-characters.ts`

**Action:** Modify

Keep persona list/detail queries global because persona definitions are shared.

Change `useActivePersona()` to resolve `activeProfile.activePersonaId` against the shared persona cache/list instead of querying `/personas/active` as the normal path.

Change the “activate persona” mutation used by the current client to patch the active User Profile's `activePersonaId`. It must not toggle global `Persona.isActive` for normal CR038 behavior.

After persona deletion, invalidate/reload User Profile data as well as persona data because the server may have cleared profile references.

---

### `packages/client/src/lib/persona-cache.ts`

**Action:** Modify

Stop deriving/synchronizing the client's active-persona cache from `persona.isActive` during persona list/detail updates.

Continue synchronizing ordinary shared persona list/detail data. Active persona identity now comes from User Profile state.

Legacy API responses can still contain `isActive`; the cache must not let that field override a profile-specific selection.

---

### `packages/client/src/stores/ui.store.ts`

**Action:** Modify

Remove these values from normal global UI state/actions/persistence:

- `userStatusManual`;
- `userStatus`;
- `userActivity`;
- `recentUserActivities`;
- `learnedGameSetupOptions`;
- `rememberedGameSetupText`.

All unrelated UI/application settings stay in this global store.

Increment the persisted UI-store version. In the migration function, capture the old profile-owned values into a transitional `legacyUserProfileContinuity` snapshot before deleting them from normal persisted state. Expose a minimal read/clear mechanism so `use-user-profiles.ts` can submit that snapshot once and clear it only after the server confirms migration.

This transitional snapshot is not ongoing User Profile storage; it exists solely so upgrading the client does not discard browser-only values before the server profile bootstrap can accept them.

---

### `packages/client/src/stores/chat.store.ts`

**Action:** Modify

Stop treating `marinara-active-chat-id` as ongoing global resume state. The old key is read only for one-time migration and removed after migration succeeds; ongoing resume lives in each User Profile.

Add a dedicated profile-switch reset that clears state visible on the currently mounted chat surface without destroying safe per-chat runtime keyed by globally unique chat IDs.

Clear on profile switch:

- active chat ID/object and mounted message list;
- active/global streaming/thinking display fields;
- visible typing/delay/generation labels;
- goto request;
- mounted Conversation call UI snapshot;
- visible unread/notification presentation for the outgoing profile.

Preserve where safe:

- per-chat input drafts;
- pending spatial transitions;
- per-chat abort controllers and in-flight generation bookkeeping;
- per-chat stream/thinking buffers and queued work needed to recover an inactive background generation when the user switches back.

A profile switch must not abort server generation solely because its chat became inactive.

---

### `packages/client/src/hooks/use-idle-detection.ts`

**Action:** Modify

Move idle-state reads/writes from `useUIStore` to the active User Profile state.

The existing semantics stay the same: automatic idle management only applies when the profile's manual status is `active`; activity returns effective status to active, and inactivity moves only the effective status to idle.

Persist effective status changes through the profile continuity update path without changing any global UI setting.

---

### `packages/client/src/hooks/use-generate.ts`

**Action:** Modify

Read `userStatus` and `userActivity` from the active User Profile instead of `useUIStore` when sending a foreground generation request.

For optimistic user-message persona snapshots, resolve the concrete chat persona first and then the chat's profile active persona. Do not use global `persona.isActive` as normal fallback.

All existing global generation preferences—streaming speed, debug mode, trim behavior, music settings, etc.—remain in `useUIStore` and are unchanged.

When a generation belongs to a background/inactive profile, its caller must supply/use that chat's owning profile continuity rather than the currently visible profile; `use-background-autonomous.ts` owns that case.

---

### `packages/client/src/hooks/use-background-autonomous.ts`

**Action:** Modify

Keep background/autonomous generation eligible across all User Profiles, as allowed by the HLD, but make every candidate profile-aware.

Consume `profileId` returned with each server candidate and resolve that profile's status/activity when constructing the generation request. Do not substitute the currently active profile's continuity for an inactive candidate.

Server unread state may accrue for inactive profiles. Client floating notifications, sounds, and browser/mobile notification content are emitted only for candidates whose `profileId` equals the active User Profile. Inactive-profile activity becomes visible when that profile is selected and its unread state is hydrated.

Any React Query collection updates/invalidation caused by autonomous activity must target the candidate's profile-qualified chat list/home keys.

Remove/rework legacy fallbacks that globally enumerate `/chats` without profile ownership.

---

### `packages/client/src/components/layout/AppShell.tsx`

**Action:** Modify

Mount User Profile bootstrap/switch coordination at the top-level shell before profile-bound chat/history surfaces become active.

Until a valid active profile is hydrated, render an existing lightweight loading/shell state rather than issuing unscoped chat/folder/home queries.

Keep globally shared resource surfaces available through the same application shell. Mount idle detection only against the hydrated active profile; keep background autonomous polling capable of processing all profile candidates.

---

### `packages/client/src/components/layout/UserProfileSwitcher.tsx`

**Action:** Create

Implement the minimal User Profile selector/manager UI.

Responsibilities:

- display the active User Profile name;
- list and switch profiles;
- create a new profile by name;
- rename an existing profile;
- show switching/loading state and actionable errors.

Do not provide delete, merge, move-chat, or duplicate-resource controls.

Use the label “User Profile” where needed to avoid collision with the existing Conversation Mode Profile terminology.

---

### `packages/client/src/components/layout/TopBar.tsx`

**Action:** Modify

Place the User Profile selector at the application-shell level so it applies uniformly to Conversation, Roleplay, and Game rather than living inside one mode-specific sidebar.

Keep the switcher usable on both desktop and mobile layouts within existing TopBar constraints.

---

### `packages/client/src/components/layout/ChatSidebar.tsx`

**Action:** Modify

The chat/folder lists inherit active-profile filtering from their hooks.

Move the user status/activity footer/editor from `useUIStore` to the active User Profile continuity API/store. Recent activity suggestions likewise come from the profile.

When importing chat history from the sidebar, pass the active profile as the target ownership scope.

Hydrate/display unread state only for chat IDs belonging to the active profile. Profile switching should clear sidebar-local selection/filter state only where stale chat IDs could otherwise remain selected; ordinary global sidebar appearance/settings remain shared.

---

### `packages/client/src/components/game/GameSetupWizard.tsx`

**Action:** Modify

Read learned Game setup chips and remembered free-text setup fields from the active User Profile.

When the user completes/updates setup, write learned/remembered values through profile continuity mutation instead of the global UI store. Creating the Game itself continues through the normal active-profile chat creation path.

---

### `packages/client/src/components/chat/ChatNotificationBubbles.tsx`

**Action:** Modify

Use the central profile-aware chat navigation helper rather than directly assigning `activeChatId`.

In normal operation this component only receives active-profile notifications, but the navigation helper provides defense in depth for a stale notification/deep link by switching to the notification chat's owning profile before mounting it.

Replace hard-coded/global chat-list invalidations with the profile-aware chat query helpers.

---

### `packages/client/src/App.tsx`

**Action:** Modify

Extend client recovery/reset flows to remove the new persisted active User Profile selector and any one-time profile migration marker when the application intentionally clears local runtime/browser state.

The old `marinara-active-chat-id` cleanup remains for compatibility until the CR038 migration has eliminated ongoing use of that key.

Do not clear server User Profile records during ordinary client runtime recovery unless the existing flow is explicitly deleting all server data.

---

### `packages/client/src/localization/locales/en.json`

**Action:** Modify

Add English strings for User Profile selection, creation, rename, switching state, validation errors, and empty-profile history where new UI text is required.

Other locales may continue to use the existing English fallback behavior unless localization tooling requires generated/placeholder entries.

---

### `scripts/regressions/user-profile-segregation.regression.ts`

**Action:** Create

Add a focused CR038 regression covering the ownership contract without relying on full UI E2E.

At minimum prove:

- legacy startup creates one Default profile and backfills chats/folders;
- migration is idempotent;
- one-time legacy client continuity cannot overwrite a profile twice;
- new profiles share reusable resources but start with no owned chat/folder history;
- scoped chat/folder list results never contain another profile's rows;
- `profileId` cannot be changed through ordinary chat update;
- invalid cross-profile connected/context/influence/note relationships are rejected;
- derived chat ownership is inherited;
- profile active persona selections are independent;
- autonomous candidates expose their owning profile.

---

### `scripts/regressions/cross-chat-awareness.regression.ts`

**Action:** Modify

Extend existing awareness coverage with two same-character Conversations in different profiles and prove the source profile is excluded from Cross-Chat Awareness despite the shared character definition.

Keep existing same-profile awareness behavior covered.

---

### `scripts/regressions/context-sources.regression.ts`

**Action:** Modify

Add a cross-profile Roleplay context-source case proving the relationship cannot be created and malformed persisted cross-profile links are not injected by the prompt builder.

---

### `scripts/regressions/character-schedule-transfer.regression.ts`

**Action:** Modify

Prove fresh Conversation schedule inheritance transfers between matching-character Conversations within one profile but not between profiles.

---

### `scripts/regressions/chat-branch-lineage.regression.ts`

**Action:** Modify

Assert that a branch/duplicate inherits the source chat's `profileId` and that branch/group operations cannot connect/move lineage across profiles.

---

### `scripts/regressions/autonomous-scheduler-gate.regression.ts`

**Action:** Modify

Update autonomous candidate contract expectations to include `profileId` while retaining eligibility for inactive-profile work. Server-side tests should prove candidate identity is preserved without imposing an active-client-profile gate on scheduling.

---

### `scripts/regressions/persona-client-contract.regression.ts`

**Action:** Modify

Update client persona contract checks so active persona selection is based on User Profile state rather than `Persona.isActive`/`/personas/active` for the current client.

Retain legacy API compatibility assertions separately where the regression already protects the old endpoints.

---

### `package.json`

**Action:** Modify

Add a focused `regression:user-profiles` command for the new regression and include it in the repository's appropriate broad regression suite.

Existing integrity commands remain authoritative for development handoff:

- `pnpm check`;
- relevant focused CR038 regressions;
- existing cross-chat/context/persona/autonomous regressions affected by the changed contracts.

---

## 3. Cross-File Dependencies

1. `types/user-profile.ts`, `schemas/user-profile.schema.ts`, and `schema/user-profiles.ts` establish the shared/persisted contract consumed by every later layer.
2. `user-profile-migration.ts` and `connection.ts` must establish at least one valid profile and backfill chat/folder ownership before profile-scoped routes are allowed to serve requests.
3. `user-profiles.storage.ts`, `chats.storage.ts`, and `chat-folders.storage.ts` are the authoritative server boundaries. Routes and generation helpers should reuse these guards rather than reimplementing ownership policy independently.
4. Chat creation/update schemas must land with storage enforcement so no transitional API can create unowned chats or mutate `profileId` after creation.
5. Cross-chat readers (`awareness`, context sources, connected context/injections, schedule inheritance, cross-post) depend on persisted `Chat.profileId`; they must be updated before the feature is considered isolated even if the UI already filters its sidebar.
6. Derived-chat routes (`scene`, `game`, branch/duplicate paths) inherit source ownership server-side. Client code must not be responsible for preserving this invariant.
7. Persona definitions stay global. `user-profiles.storage.ts` owns default-persona references; `use-characters.ts` and generation helpers consume those references, while the legacy global active-persona API remains only a compatibility path.
8. The server bootstrap handles chat/folder/global-active-persona migration; `ui.store.ts` preserves browser-only legacy continuity until `use-user-profiles.ts` completes the one-time handshake. Neither side alone can complete migration without data loss.
9. `user-profile.store.ts` and `use-user-profiles.ts` must be available before chat/folder/home hooks become profile-qualified. `AppShell.tsx` gates profile-bound rendering until bootstrap is complete.
10. Profile switching clears only visible chat state. Per-chat runtime keyed by globally unique chat IDs remains intact so `use-background-autonomous.ts` and in-flight generation can continue safely for inactive profiles.
11. Chat collection cache keys are profile-qualified; direct chat/message caches remain keyed by globally unique chat IDs. Background updates therefore need the owning `profileId` whenever they invalidate a collection.
12. Full backup restore relies on `FILE_BACKED_TABLES` including `user_profiles` and on `backup.routes.ts` rerunning the same idempotent bootstrap after old-format restore.
13. The focused CR038 regression should land with the implementation and run alongside the existing regressions whose contracts are changed. A later Validation stage should additionally exercise Profile A → Profile B → Profile A through maintained UI/E2E tooling.

No change is planned to root `storage-format.json`, chat-descendant shard identity, or the persistence model of globally shared resources.

---

## 4. File Change Summary

| File | Action | Purpose |
| --- | --- | --- |
| `packages/shared/src/types/user-profile.ts` | Create | Shared User Profile and continuity contracts |
| `packages/shared/src/schemas/user-profile.schema.ts` | Create | User Profile API validation schemas |
| `packages/shared/src/types/chat.ts` | Modify | Add profile ownership to Chat and ChatFolder |
| `packages/shared/src/schemas/chat.schema.ts` | Modify | Require ownership on create and prevent ownership mutation |
| `packages/shared/src/schemas/folder.schema.ts` | Modify | Add profile-aware chat-folder validation without affecting global folders |
| `packages/shared/src/index.ts` | Modify | Export new shared contracts |
| `packages/server/src/db/schema/user-profiles.ts` | Create | Persist User Profiles |
| `packages/server/src/db/schema/chats.ts` | Modify | Persist chat/folder profile IDs |
| `packages/server/src/db/schema/index.ts` | Modify | Export User Profile schema |
| `packages/server/src/db/file-backed-store.ts` | Modify | Register User Profile table in file storage/backup |
| `packages/server/src/db/user-profile-migration.ts` | Create | Idempotent Default-profile/backfill migration |
| `packages/server/src/db/connection.ts` | Modify | Run profile migration before exposing DB |
| `packages/server/src/services/storage/user-profiles.storage.ts` | Create | Canonical profile CRUD/continuity/migration storage |
| `packages/server/src/services/storage/chats.storage.ts` | Modify | Profile-scope chat collections and enforce relationship integrity |
| `packages/server/src/services/storage/chat-folders.storage.ts` | Modify | Profile-scope chat folder storage |
| `packages/server/src/routes/user-profiles.routes.ts` | Create | Minimal User Profile API |
| `packages/server/src/routes/index.ts` | Modify | Register User Profile routes |
| `packages/server/src/routes/chats.routes.ts` | Modify | Profile-aware lists/create/derived chats/home/autonomous/internal chats |
| `packages/server/src/routes/chat-folders.routes.ts` | Modify | Profile-aware chat folder API |
| `packages/server/src/routes/folder-routes.shared.ts` | Modify | Optional scoped folder routing for chat folders only |
| `packages/server/src/services/conversation/awareness.service.ts` | Modify | Same-profile Cross-Chat Awareness and persona fallback |
| `packages/server/src/routes/generate/generate-route-utils.ts` | Modify | Explicit profile active-persona resolution |
| `packages/server/src/routes/generate.routes.ts` | Modify | Thread chat ownership/profile persona through generation |
| `packages/server/src/routes/generate/roleplay-context-sources.ts` | Modify | Defense-in-depth profile checks for source chats |
| `packages/server/src/routes/generate/conversation-connected-context.ts` | Modify | Same-profile connected context only |
| `packages/server/src/routes/generate/connected-conversation-injections.ts` | Modify | Same-profile influence/note/OOC injection only |
| `packages/server/src/services/generation/conversation-cross-post-command-runtime.ts` | Modify | Restrict cross-post targets to source profile |
| `packages/server/src/routes/characters.routes.ts` | Modify | Clear profile persona references on delete; retain legacy API |
| `packages/server/src/routes/scene.routes.ts` | Modify | Inherit source profile for Scene-created chats |
| `packages/server/src/routes/game.routes.ts` | Modify | Own new Games and inherit profile for Game child/session chats |
| `packages/server/src/routes/import.routes.ts` | Modify | Accept target profile for chat imports |
| `packages/server/src/services/import/st-chat.importer.ts` | Modify | Assign imported chats to target/derived profile |
| `packages/server/src/services/import/st-bulk.importer.ts` | Modify | Thread target profile through bulk chat imports |
| `packages/server/src/routes/backup.routes.ts` | Modify | Re-run profile bootstrap after full restore |
| `packages/client/src/stores/user-profile.store.ts` | Create | Persist active profile selector and mirror active continuity |
| `packages/client/src/hooks/use-user-profiles.ts` | Create | Profile API, bootstrap, switching, migration and navigation coordinator |
| `packages/client/src/hooks/use-chats.ts` | Modify | Profile-qualified chat collections and creation |
| `packages/client/src/hooks/use-chat-folders.ts` | Modify | Profile-qualified chat folders |
| `packages/client/src/hooks/use-home-feed.ts` | Modify | Profile-qualified recent/home history |
| `packages/client/src/hooks/use-characters.ts` | Modify | Resolve/activate persona through User Profile |
| `packages/client/src/lib/persona-cache.ts` | Modify | Stop global isActive from controlling current profile persona |
| `packages/client/src/stores/ui.store.ts` | Modify | Remove ongoing profile continuity from global UI persistence and preserve migration snapshot |
| `packages/client/src/stores/chat.store.ts` | Modify | Replace global active-chat resume and add safe switch reset |
| `packages/client/src/hooks/use-idle-detection.ts` | Modify | Apply idle status to active User Profile |
| `packages/client/src/hooks/use-generate.ts` | Modify | Use profile status/activity/persona for generation |
| `packages/client/src/hooks/use-background-autonomous.ts` | Modify | Preserve owning profile in background generation/notifications/cache updates |
| `packages/client/src/components/layout/AppShell.tsx` | Modify | Bootstrap/gate profile-bound UI |
| `packages/client/src/components/layout/UserProfileSwitcher.tsx` | Create | Select/create/rename User Profiles |
| `packages/client/src/components/layout/TopBar.tsx` | Modify | Host application-level profile selector |
| `packages/client/src/components/layout/ChatSidebar.tsx` | Modify | Profile status/activity, imports and unread presentation |
| `packages/client/src/components/game/GameSetupWizard.tsx` | Modify | Store learned/remembered setup per profile |
| `packages/client/src/components/chat/ChatNotificationBubbles.tsx` | Modify | Profile-aware notification navigation/invalidation |
| `packages/client/src/App.tsx` | Modify | Reset/recovery handling for profile selector/migration keys |
| `packages/client/src/localization/locales/en.json` | Modify | User Profile UI strings |
| `scripts/regressions/user-profile-segregation.regression.ts` | Create | Focused CR038 ownership/migration regression |
| `scripts/regressions/cross-chat-awareness.regression.ts` | Modify | Prove awareness cannot cross profiles |
| `scripts/regressions/context-sources.regression.ts` | Modify | Prove context sources cannot cross profiles |
| `scripts/regressions/character-schedule-transfer.regression.ts` | Modify | Prove schedule inheritance is profile-scoped |
| `scripts/regressions/chat-branch-lineage.regression.ts` | Modify | Prove branches inherit profile ownership |
| `scripts/regressions/autonomous-scheduler-gate.regression.ts` | Modify | Carry profile identity through autonomous candidates |
| `scripts/regressions/persona-client-contract.regression.ts` | Modify | Pin profile-based client active-persona contract |
| `package.json` | Modify | Register focused User Profile regression |
