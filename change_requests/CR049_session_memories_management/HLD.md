# CR049 - Character Session Memories Management

_Status: Planning; awaiting implementation._

## 1. Purpose

Give users a dedicated Character Editor tab for the roleplay session summaries
currently stored in the character card extension
`extensions.characterMemories`. This tab is separate from the existing
`Memories` tab, which manages character-owned daily memories.

## 2. Goals

- Display the character's current session-memory entries, including their
  source and creation date where those fields are valid.
- Allow a user to edit an individual entry's summary, delete one entry, or
  clear all session-memory entries with an explicit confirmation.
- Add a per-character setting that enables or disables saving new roleplay
  session summaries.
- Treat an absent setting as enabled so existing characters keep their current
  behavior without migration.
- Keep historical session memories visible and manageable when saving is
  disabled.
- Preserve unrelated character-card extension keys and tolerate malformed
  legacy array entries without breaking the editor or scene-conclusion flow.

## 3. Non-goals

- Do not merge this feature into or change the semantics of the existing daily
  `Memories` tab or its database-backed records.
- Do not delete or migrate existing session-memory entries automatically.
- Do not change memory retrieval, prompt formatting, scene planning, or daily
  memory extraction beyond the persistence gate for new session summaries.
- Do not add a database table or alter the character-card storage format beyond
  the optional per-character setting described below.

## 4. Base and branch intent

- Application base: local application `main`.
- Planned application branch: `change/CR049-session-memories-management`.
- Parent CR documentation remains in this repository; implementation must use
  a dedicated nested application worktree.

## 5. Proposed solution

### Character Editor

Add a `Session Memories` tab alongside, but independent from, the existing
`Memories` tab. It reads `data.extensions.characterMemories` and renders the
known session entry shape (`from`, `fromCharId`, `summary`, and `createdAt`)
without assuming every legacy value is present or correctly typed.

Each entry has an edit action for its summary and a delete action. Mutations
are persisted through a server-side character update path that changes only
the targeted `characterMemories` property while retaining all other extension
keys. A clear-all action requires confirmation and replaces only that array
with an empty array. Successful mutations update the local view and failures
remain visible to the user instead of being silently discarded.

Malformed entries are retained rather than silently rewritten. The UI uses a
safe fallback for missing source/date/summary fields, and index- or identity-
based mutation logic must remain bounded to the session-memory array so an
unrecognized entry can still be deleted or removed by clear-all.

### Saving control

Store an optional boolean `data.extensions.characterMemoriesEnabled`. The
effective value is `true` unless the property is explicitly `false`. Expose
this as a per-character toggle in the new tab, with explanatory text that it
controls only creation of new roleplay session summaries.

At scene conclusion, check the effective setting before the existing
session-summary persistence operation. When disabled, skip only that new
summary persistence path; do not remove historical entries and do not affect
daily memories, scene completion, or unrelated character-card extensions.
When enabled or absent, retain the current append behavior and entry shape.

### Write and concurrency boundary

Prefer a narrow server mutation helper or endpoint for session-memory edits,
deletes, clear-all, and the setting update. It must read and write the current
character extension object, merge the targeted property, and preserve unknown
extension keys. The client should serialize mutations per character and
refresh from the saved result so stale local state does not cause a second
action to overwrite an unrelated extension change.

## 6. Invariants and boundaries

- The daily `Memories` tab and database-backed daily-memory records are not
  read, written, or renamed by this feature.
- `characterMemoriesEnabled` absent means saving is enabled; only explicit
  `false` disables new session-summary persistence.
- Disabling saving never deletes historical `characterMemories` entries.
- Session-memory mutations preserve every extension key other than the one
  intentionally changed.
- Clear-all affects only `extensions.characterMemories`.
- Malformed legacy values cannot crash scene conclusion, character loading, or
  the new tab.
- No application write occurs in the primary nested checkout; implementation
  and validation use the dedicated CR worktree.

## 7. Risks and mitigations

- **The new tab could accidentally operate on daily memories.** Keep separate
  component state, labels, data access, and tests for the two storage systems.
- **A partial extension update could erase unrelated data.** Centralize the
  read/merge/write operation and add a regression asserting unknown extension
  keys survive every mutation.
- **Legacy entries may not match the current shape.** Normalize only for
  display, preserve raw entries, and use defensive rendering and mutation
  guards.
- **A toggle change could affect more than scene summaries.** Gate only the
  existing scene-summary append path and test that retrieval and daily-memory
  behavior remain unchanged.
- **Concurrent edits could lose a change.** Serialize tab mutations and use
  the server's current card state for each targeted update.

## 8. Validation expectations

- Focused server regressions cover absent/true/false saving settings, append
  behavior, historical-entry retention, malformed entries, and preservation of
  unrelated extensions.
- Focused client checks cover the separate tab, safe empty/malformed states,
  edit/delete/clear confirmation flows, toggle persistence, and error display.
- Run the client/server integrity check and production build appropriate to the
  repository's current validation guidance, plus `git diff --check`.
- No database migration, `pnpm db:push`, or release-version check is expected.
- Because this is behavior-bearing UI, propose focused Playwright E2E coverage
  for the tab and toggle after implementation; user agreement is still
  pending.

## 9. Rollback

Revert the focused CR049 application commit. The change adds no database
objects; disabling the feature setting can be removed with the code, while
existing extension entries remain in character cards unless a user explicitly
deleted them.

## 10. Approval state

The requested behavior is sufficiently defined for implementation. This CR is
registered as standalone and remains in planning until implementation begins.
