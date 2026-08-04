# CR022 — Implementation Plan

## 1. Source snapshots

- Extend Character Mind raw-source utilities with `auto-summary` payloads.
- Snapshot Conversation `daySummaries` and `weekSummaries` as independent immutable Markdown documents.
- Create `raw/auto-summaries/day/` and `raw/auto-summaries/week/` during initialization.
- Build a current-source manifest from the snapshots created or reused during the operation.
- Filter status and Sync pending work to current revisions rather than every historical raw file.

## 2. Corpus planning pass

- Add shared page-plan/result contracts.
- Add the read-only `plan` runtime operation and prompt.
- Pass the full current source-path manifest to the planner.
- Validate that the planner read every manifest source, planned unique safe `wiki/*.md` paths, assigned valid sources, and accounted for every source through a page or an explicit exclusion.
- Deterministically render the accepted plan into provisional `index.md`.
- Log planning success or failure as `build-map`.

## 3. Materialization pass

- Add the writable `build` runtime operation and prompt containing the accepted map.
- Permit planned not-yet-written wiki links during materialization while retaining final strict validation.
- Require the builder to read all mapped raw sources, create every planned page, and update `index.md`.
- Run complete wiki/link/index validation before recording Build success.
- Record all current source revisions in the successful Build log so they are not replayed by Sync.

## 4. Lifecycle gating and retry

- Add `built` to Character Mind status, derived from a successful Build log entry.
- Reject Sync, Query, and Lint until Build has succeeded.
- Allow Build retry when the directory exists but has no successful Build.
- On retry, clear only `wiki/` and reset `index.md`; keep raw snapshots and `log.md`.
- Keep the existing Build/Sync response shape for client compatibility, representing the corpus sources covered by Build as processed source runs.

## 5. Runtime reliability

- Extend operation limits for `plan` and `build`.
- Resolve the configured Character Mind agent `maxTokens` and use it for all Character Mind operations, with operation-specific ceilings only where necessary.
- Keep existing tool/result hardening and final trace-derived change reporting.

## 6. Minimal UI copy

- Use `status.built`, rather than directory existence alone, to choose Build versus Sync/Query controls.
- Update Build confirmation and agent-connection copy to describe corpus mapping/materialization and the additional operations.
- Do not add browsing, editing, or graph UI.

## 7. Validation

- Extend `scripts/regressions/character-mind.regression.ts` for auto-summary snapshots, source-accounting plan validation, planned-page materialization, and Build-complete log semantics.
- Run the focused Character Mind regression.
- Run shared, server, and changed-client validation in proportion to the touched files.
- Run the primary checkout production build after local integration.

## Completion

- Implemented in application commit `5b7fd02b7` and fast-forwarded into local application `main`.
- `pnpm regression:character-mind` passed in the integrated primary checkout.
- Full `pnpm check` passed, including shared/server TypeScript validation, client ESLint, and production server/client builds. Client lint reported one unrelated pre-existing React Hooks warning in `HomeProfessorMariChat.tsx` and no errors.
