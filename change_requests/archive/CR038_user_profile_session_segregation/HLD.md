# CR038 — User Profile Session Segregation

## Status

Draft HLD for review.

This change introduces a selectable **User Profile** as a logical namespace for Conversation, Roleplay, and Game history. It deliberately does **not** create separate application accounts or duplicate global configuration. The implementation plan is deferred until this HLD is reviewed and approved.

## Problem

Marinara currently treats the local installation as one continuous conversational identity. Conversation, Roleplay, and Game chats all live in one shared chat space, and several pieces of durable or semi-durable state are also global: the active persona selection, recent user activity/status, remembered Game setup choices, active chat state, and client query/runtime caches.

That is limiting when one installation is used for multiple distinct conversational contexts. Hiding chats in the sidebar is not sufficient because Marinara also deliberately reads across chats. Cross-chat Conversation awareness can inspect other Conversations sharing a character, and Conversation schedule inheritance can scan other Conversation chats for fresh schedules. Without a first-class boundary, histories that appear separate in the UI can still influence one another invisibly.

The required behavior is therefore stronger than a display filter: selecting a User Profile must establish a reliable history/context boundary across Conversation, Roleplay, and Game while keeping the application configuration and reusable content library shared.

## Goals

- Add a first-class selectable **User Profile** concept.
- Segregate Conversation, Roleplay, and Game chat histories by User Profile.
- Segregate chat folders and chat-owned artifacts with their owning profile.
- Ensure cross-chat awareness, schedule inheritance, context-source lookups, branching, connected chats, Game child chats, and other chat relationships never cross a User Profile boundary accidentally.
- Keep reusable application resources shared across profiles, including characters, persona definitions, lorebooks, presets, connections, models, agents/tools, extensions, themes, and ordinary system/UI settings.
- Make the currently selected/default persona profile-specific without duplicating persona definitions.
- Preserve a small set of non-chat conversational continuity state per profile:
  - active/default persona;
  - last active mode and last active chat per mode;
  - current user status/activity and recent user activities;
  - learned Game setup options and remembered Game setup text.
- Make profile switching deterministic and safe by clearing or re-keying client runtime/cache state that could otherwise expose the previous profile.
- Migrate existing installations without changing their visible behavior by placing all existing data in a single default profile.
- Keep the feature backward-compatible with existing chat export/import, backup/restore, duplication, branching, and connected-chat behavior.

## Non-goals

- Multi-user authentication, authorization, OS-level privacy, encryption, or security isolation.
- Separate settings, themes, model/provider configuration, connections, prompt presets, lorebooks, agents, tools, extensions, or character/persona libraries per profile.
- Duplicating persona definitions for each User Profile.
- Changing existing Conversation-mode character/persona profile features such as Conversation display name, About Me, or behavior directives.
- Providing profile-specific application configuration beyond the small conversational continuity state explicitly listed above.
- Allowing relationships or context sources to intentionally bridge two User Profiles in the first version.
- Designing a general account system suitable for networked multi-user deployment.
- Implementing profile deletion or profile merge/move workflows in the first delivery. Creation, selection, and rename are sufficient for the initial scope; destructive lifecycle operations can be added separately once ownership semantics are proven.

## Terminology

Marinara already uses the term **profile** in Conversation mode for per-character/persona presentation and behavior data. CR038 does not replace or redefine that feature.

For this CR:

- **User Profile** means the new top-level session/history namespace selected by the user.
- **Conversation Mode Profile** continues to mean the existing Conversation-specific display/About Me/behavior configuration attached to characters or personas.

The UI should consistently say **User Profile** where ambiguity is possible. Internal storage/type names may use an unambiguous identifier such as `UserProfile` or `SessionProfile`, but this HLD uses `UserProfile` for clarity.

## Current-State Observations

The existing architecture makes this change feasible without duplicating most persisted data:

- Conversation, Roleplay, and Game are already represented by the common `Chat` root model.
- Messages, swipes, summaries, memories, notes, context sources, daily memories, chat images, Game state, call history, and most other durable session data already descend from or reference a chat.
- A chat already stores its concrete `personaId`, so existing chats do not depend solely on the global active persona to preserve identity.
- Chat metadata already carries most durable Conversation and Game runtime/configuration state, including summaries, agents, lorebook state, prompt variables, schedules, Conversation status overrides, Game setup/session state, combat/dialogue child chat IDs, and other per-chat state.
- The major leakage risks are therefore at the **chat root and global selector/query layers**, not in every descendant table.

The primary architectural exceptions are global selections/caches and deliberate cross-chat readers. CR038 must handle those explicitly.

## Proposed Solution

### 1. Introduce a first-class UserProfile record

Persist a small first-class User Profile entity with a stable ID and user-visible name.

Conceptually:

```text
UserProfile
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
  createdAt
  updatedAt
```

The exact column/JSON split belongs in the implementation plan. The important HLD rule is that UserProfile stores only **profile identity and conversational continuity state**, not a second copy of general application settings.

At least one User Profile must always exist.

### 2. Persist one active User Profile selection for the client/app session

The application shell maintains an `activeProfileId` selection.

Changing `activeProfileId` changes which Conversation, Roleplay, and Game histories are presented and which profile-specific continuity state is active. Shared libraries and system settings do not reload into separate copies.

The active selection is an application preference, not an authorization boundary. Server operations that depend on chat ownership must use the chat/profile relationship explicitly rather than trusting UI filtering alone.

### 3. Make Chat and ChatFolder the primary ownership boundary

Add `profileId` ownership to the common `Chat` root and to `ChatFolder`.

Conceptually:

```text
Chat
  ...
  profileId

ChatFolder
  ...
  profileId
```

Most descendants should inherit profile ownership through their chat relationship rather than receiving redundant `profileId` columns. This includes messages, swipes, summaries, memories, daily memories, call messages, Game state, chat images, and other chat-owned records.

A direct `profileId` should be added to a descendant only when implementation analysis proves that a hot/query path cannot safely or efficiently scope through the owning chat.

### 4. Enforce same-profile relationship integrity

Every relationship between chats must remain within one User Profile.

This includes, at minimum:

- branches and group siblings via `groupId`;
- connected Conversation/Roleplay chats via `connectedChatId`;
- Conversation context-source links;
- Conversation notes/influences that refer to source and target chats;
- Game party/dialogue/combat child chats;
- duplicates and derived chats;
- imported chats once assigned to a profile;
- internal/hidden chat records created on behalf of a profile.

Creation rules are inheritance-based:

- branch/duplicate/child chat: inherit the source or parent chat profile;
- connected chat: inherit the originating chat profile;
- normal new chat: use the currently active profile;
- imported chat without an embedded local profile identity: assign to the currently active profile.

The application must reject or repair attempts to create a relationship across profiles rather than silently permitting cross-profile context flow.

### 5. Scope chat and folder queries by profile

List/recent/search/sidebar queries for chats and folders must be profile-qualified at the server/data-access boundary, not merely filtered after a global list reaches the client.

Profile selection should affect all three user-facing history modes consistently:

- Conversation;
- Roleplay;
- Game.

Any internal API that intentionally fetches a chat by stable ID may still resolve that chat directly, but the caller must preserve its owning `profileId`. A UI deep-link to a chat owned by another profile should switch to that owning profile before presenting the chat rather than mixing it into the current profile view.

### 6. Make deliberate cross-chat features profile-aware

All features that deliberately inspect other chats must constrain candidates to the current chat's profile.

Known examples include:

- Cross-Chat Conversation Awareness;
- fresh Conversation schedule inheritance;
- Roleplay/Scene source-chat selection and retrieval;
- chat context-source resolution;
- summary/memory retrieval paths that enumerate chats rather than operating from a single chat ID;
- any hidden/internal assistant chat that derives continuity from user chats.

The invariant is:

> A chat may only read conversational history from another chat when both chats belong to the same User Profile.

This applies even if the same character or persona exists in both profiles. Shared characters/personas are reusable definitions; they are not a bridge between histories.

### 7. Keep shared resources truly shared

The following remain installation-global and immediately available in every User Profile:

- character definitions;
- persona definitions;
- character/persona images and shared galleries;
- lorebooks;
- prompt presets;
- model/provider connections;
- models and generation-provider configuration;
- agents and tools;
- extensions/integrations;
- themes and normal UI settings;
- ordinary system/application settings;
- global prompt defaults and other configuration that is currently system-level.

Creating a new User Profile must not duplicate any of these records.

Chat-generated assets remain visible through their owning chat/profile. Genuinely global galleries remain shared.

### 8. Move active/default persona selection to UserProfile

Persona definitions remain global, but the **selected/default persona** becomes profile-specific.

Resolution should be:

1. use the concrete `personaId` already stored on the chat when one exists;
2. when a default/active persona is needed outside a concrete chat, use `UserProfile.activePersonaId`;
3. use the legacy global `Persona.isActive` only as migration/backward-compatibility fallback until all runtime paths have moved to the profile-aware selector.

This prevents Profile A's persona choice from silently changing Profile B while preserving all existing persona content and Conversation-mode persona fields as shared definitions.

### 9. Store only the agreed small non-chat continuity state per profile

The following current global/client-persisted state becomes UserProfile-owned because it directly represents conversational continuity rather than application configuration:

| State | Profile behavior |
|---|---|
| Active/default persona | Separate per User Profile |
| Last active mode | Separate per User Profile |
| Last active chat per Conversation/Roleplay/Game | Separate per User Profile |
| Manual/current user status | Separate per User Profile |
| Current user activity | Separate per User Profile |
| Recent user activities | Separate per User Profile |
| Learned Game setup options | Separate per User Profile |
| Remembered Game setup text | Separate per User Profile |

Everything else remains global unless implementation discovery identifies a value that is demonstrably derived from or semantically part of profile history. New additions to profile state should not be made opportunistically during implementation; they should be called out explicitly.

### 10. Profile-qualify client caches and reset transient runtime state on switch

The current client caches chat queries globally. CR038 must prevent stale data from the previous profile appearing during a switch.

Chat-related query keys should therefore be profile-qualified, conceptually:

```text
["profiles", profileId, "chats", ...]
```

Equivalent profile qualification or invalidation is required for folders and any cross-chat query cache.

On profile switch, transient chat runtime state must not carry over. The client should atomically:

1. persist the outgoing profile's resume state;
2. change `activeProfileId`;
3. clear or partition active-chat runtime state, message lists, streaming/typing state, unread/notification state, active call state, Game/encounter runtime state, and other chat-scoped transient stores;
4. load the selected profile's continuity state;
5. restore its last active mode/chat when still valid, otherwise open the profile's normal empty/default view.

Drafts may continue to be keyed by chat ID because chat IDs are globally unique, but the active draft/UI state must follow the selected chat/profile.

A profile switch must never briefly render the previous profile's chat list through placeholder/previous-query data.

### 11. Scope notifications, autonomous work, and background chat behavior

Background or autonomous work may continue to operate according to existing scheduling semantics, but it must always retain the owning chat's profile identity.

Requirements:

- autonomous messages are written only to the owning chat;
- unread counts and notifications are presented only when their profile is active, or are summarized as profile-level pending activity without exposing message content across profiles;
- background context gathering may not enumerate chats from other profiles;
- switching profiles must not transfer active call/generation UI state to the new profile.

Whether inactive profiles should be globally paused is not required by this CR; isolation is the requirement. A later CR can alter scheduling semantics if desired.

### 12. Provide minimal User Profile UI

The first delivery needs a persistent profile selector accessible from the top-level application shell so it applies equally to Conversation, Roleplay, and Game.

Minimum operations:

- show the active User Profile;
- switch User Profile;
- create a User Profile with a name;
- rename a User Profile.

Profile deletion, merging, and moving existing chats between profiles are intentionally deferred. This avoids introducing destructive data-management behavior before profile ownership is established and validated.

A newly created profile starts with empty Conversation, Roleplay, and Game history while immediately seeing all shared characters, personas, lorebooks, presets, connections, agents/tools, themes, and settings.

## Data Ownership Summary

### Profile-specific

- UserProfile identity/name.
- Conversation, Roleplay, and Game chats.
- Chat folders.
- All chat descendants and chat-owned assets through the owning chat.
- Chat metadata and game/session state.
- Cross-chat relationships and context-source selections.
- Active/default persona selection.
- Last active mode and last active chat per mode.
- User status/activity/recent activity continuity.
- Learned/remembered Game setup continuity.
- Client chat/runtime/cache state while the profile is active.

### Shared

- Character definitions.
- Persona definitions and their Conversation-mode profile fields.
- Character/persona images.
- Lorebooks.
- Presets and prompt configuration intended to be system-level.
- Connections/providers/models.
- Agents and tools.
- Extensions/integrations.
- Themes and normal UI/application settings.
- Global galleries and other genuinely reusable resources.

## User Flows

### Existing installation after upgrade

1. Migration creates one User Profile, named `Default` unless a better existing local identity is available.
2. All existing chats and folders are assigned to Default.
3. The current global active persona becomes `Default.activePersonaId`.
4. Existing user status/activity and remembered Game setup continuity are copied into Default.
5. `activeProfileId` is set to Default.
6. The application opens with the same chat history and visible behavior as before the migration.

No user action is required.

### Create a second profile

1. User creates `Profile B` from the profile selector/manager.
2. Profile B initially has no Conversation, Roleplay, or Game chats/folders.
3. All shared characters, personas, lorebooks, presets, connections, agents/tools, themes, and system settings are immediately available.
4. Profile B receives a default persona selection according to a deterministic rule defined in implementation planning, preferably the migrated/default active persona rather than creating a new persona.
5. New chats created while Profile B is active are owned by Profile B.

### Switch Profile A → Profile B → Profile A

1. Profile A resume state is persisted.
2. Chat-related transient stores/caches are cleared or switched to Profile B keys.
3. Profile B's chat lists and continuity state load.
4. Its last active mode/chat is restored if valid.
5. Switching back restores Profile A in the same way.

No Profile A history or profile-specific status/activity may appear in Profile B during the transition.

### Branch, duplicate, connect, or create a Game child chat

The derived chat automatically inherits the originating chat's profile. The user is not asked to choose a profile because allowing a different profile would break the relationship boundary.

### Import a chat

A normal chat import is assigned to the currently active profile. Local `profileId` values should not be treated as portable semantic identity in ordinary single-chat exports. Whole-profile export/import is not part of CR038.

## Migration and Compatibility

The database migration must be deterministic and safe for existing installations.

Required migration behavior:

- create a Default User Profile;
- backfill every existing chat with that profile ID;
- backfill every existing chat folder with that profile ID;
- migrate the active persona selection and agreed non-chat continuity state into Default;
- preserve existing chat IDs and relationships;
- preserve exports/imports and backups;
- ensure databases created after CR038 make `profileId` mandatory for new chats/folders.

During a transitional release, API/type parsing may tolerate legacy chat payloads without `profileId` only where necessary for import/backward compatibility; persisted application data should always resolve to a concrete profile.

## Export, Import, Duplication, and Backup Rules

- **Single-chat export:** include the chat content and descendants needed for portability, but do not require the local User Profile ID to exist on the receiving installation.
- **Single-chat import:** assign the imported chat and all its children/relationships to the active User Profile.
- **Duplicate/branch:** preserve the source chat's profile.
- **Connected/derived chats:** inherit the parent/originating profile.
- **Backup/restore:** preserve User Profiles, `activeProfileId` where appropriate, and every chat/folder ownership mapping so a full installation restore reconstructs the same segregation.

## API and Service Boundary

CR038 should establish a profile-aware service boundary rather than scattering UI-only filters.

High-level rules:

- create/list/recent/search chat operations receive or derive a profile ID;
- folder operations receive or derive a profile ID;
- cross-chat selectors accept the current chat/profile as a required boundary;
- services that follow a direct chat ID derive profile ownership from that chat and preserve it through nested operations;
- relationship creation validates both endpoints share the same profile;
- client profile selection is never treated as sufficient proof that a server-side cross-chat query is scoped correctly.

The implementation plan should identify every current global chat enumeration and classify it as:

1. user-visible history query — scope to active profile;
2. cross-chat context query — scope to source chat profile;
3. maintenance/global operation — intentionally global and documented.

## Security and Privacy Semantics

User Profiles are a **logical application namespace**, not a security boundary.

All profiles still belong to the same local Marinara installation and share the same application data store and reusable resources. A user with filesystem/database access can inspect all profiles. The UI and service layer should prevent accidental cross-profile context/history mixing, but CR038 must not claim separate-account privacy or authorization guarantees.

## Risks

### Hidden cross-chat query paths

The largest correctness risk is a service that enumerates chats globally and is missed during implementation. That could cause invisible cross-profile context contamination even when the UI looks correct.

Mitigation: implementation planning must inventory all chat enumerations and relationship traversals; validation must include deliberate same-character histories in different profiles and prove they remain isolated.

### Client cache bleed during switching

Global React Query keys and persisted runtime stores can briefly render or retain data from the previous profile.

Mitigation: profile-qualified keys plus an atomic switch/reset path; test rapid repeated switching and placeholder-data behavior.

### Legacy global active persona behavior

Code paths that still query global `Persona.isActive` could select the wrong identity after profiles exist.

Mitigation: centralize profile-aware active-persona resolution and audit all global-active-persona lookups.

### Relationship corruption

A branch, connected chat, context source, or Game child accidentally assigned to another profile would undermine isolation.

Mitigation: inherit profile ownership automatically and validate same-profile endpoints when creating or updating relationships.

### Migration mistakes

A partial backfill could make existing histories disappear or fail to load.

Mitigation: transactional/default-profile migration, non-null ownership after migration, and validation against a seeded pre-CR038 database.

### Terminology collision

Existing Conversation Mode Profiles may be confused with the new User Profile concept.

Mitigation: use `User Profile` consistently in user-facing copy and unambiguous type/table names internally.

## Validation

CR038 is persistence- and behavior-bearing and requires substantive validation.

### Schema and migration

- Upgrade a populated pre-CR038 database.
- Verify exactly one Default profile is created.
- Verify all existing chats/folders are assigned and no history disappears.
- Verify existing active persona and agreed non-chat continuity state migrate correctly.
- Run the repository's database schema verification required by the CR workflow.

### Core history segregation

Create Profile A and Profile B with:

- Conversation chats using the same character;
- Roleplay chats using the same characters;
- Game sessions using shared characters/personas.

Verify each profile lists only its own chats/folders and switching restores each profile's last active mode/chat.

### Cross-chat isolation

- Give Profile A and Profile B same-character Conversations containing contradictory facts.
- Trigger Cross-Chat Awareness in each profile and verify only same-profile source chats are considered.
- Exercise Conversation schedule inheritance and verify it never inherits from another profile.
- Exercise Roleplay/Scene context-source selection and verify cross-profile source chats cannot be selected or read.

### Derived-chat ownership

Verify profile inheritance for:

- branch;
- duplicate;
- connected Conversation/Roleplay;
- Game party/dialogue/combat child chats;
- imported chat.

Verify attempts to establish a cross-profile relationship are rejected or normalized safely.

### Persona and non-chat continuity

- Set different active/default personas in Profile A and Profile B.
- Set distinct user status/activity/recent activities.
- Set distinct learned/remembered Game setup state.
- Switch repeatedly and confirm exact restoration with no shared mutation.

### Client switching and caches

- Switch profiles while chat lists are cached.
- Switch rapidly A → B → A.
- Confirm previous-profile chat lists/messages never flash through placeholder data.
- Confirm unread/notification state and active chat runtime do not bleed between profiles.
- Confirm a direct deep-link to a chat in another profile switches to the owning profile before rendering.

### Shared-resource regression

Verify both profiles see and use the same:

- characters/personas;
- lorebooks;
- connections/providers;
- presets;
- agents/tools;
- themes/settings.

Changing a shared resource should be reflected in both profiles, while changing profile continuity state should not.

### Export/import and backup

- Export a chat from Profile A and import while Profile B is active; verify the imported copy belongs entirely to Profile B.
- Restore a full backup and verify profile ownership mappings and separation survive.

### Baseline repository checks

Because this is a cross-cutting database/server/client change, implementation validation should include `pnpm check` and `pnpm db:push` in addition to focused automated tests. Focused Playwright E2E coverage should be agreed during implementation/validation planning because the change is strongly user-visible and persistence-bearing.

## Implementation-Planning Boundary

This HLD intentionally does not prescribe exact migration filenames, API payloads, store module names, component locations, or task ordering. The next stage will convert these invariants into an implementation plan that inventories affected chat enumeration paths, profile-aware persona resolution, persistence migrations, client cache/store changes, UI components, and focused validation work.
