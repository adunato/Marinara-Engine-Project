# CR020: Character Mind Controls

Status: Implemented

## Problem

CR019 exposes Character Mind only through HTTP endpoints. That keeps the Markdown model deliberately manual, but it also means a normal Marinara user cannot initialize or operate the agent from the application.

## Goal

Add the smallest UI needed to operate an enabled Character Mind without creating a mind browser or editor.

## Design

Chat Settings gains a **Character Mind** section when the managed agent is active. It opens one Conversation-scoped modal containing:

- one global Character Mind connection selector, using the existing agent configuration and the existing fallback order;
- one selector/card per character in the Conversation;
- live initialization, pending-source, active-operation, and last-result status;
- Build, Sync, Lint, Cancel, and Open Folder controls;
- a query field and transient cited briefing result.

The UI calls the existing CR019 operation APIs through React Query. Status polls only while the modal is open, more frequently while an operation is active. Build and Sync remain the existing long-running server requests; Cancel is independently callable.

**Open Folder** adds one loopback/admin-gated server endpoint that opens the selected mind directory in the host file manager. The absolute path remains visible and copyable for Docker or other environments where opening the server host's file manager is not useful.

## Connection Semantics

The selector edits the existing global `character-mind` agent configuration. Its choices are:

1. agent default, falling back to the Conversation connection;
2. any configured text-generation connection; or
3. the local sidecar where available.

The modal states that this choice applies to every Character Mind and to ingest, query, and lint. CR020 does not introduce per-chat, per-character, or per-operation connection state.

## Scope Boundaries

- No Markdown browser, editor, graph, file contents, or delete/reset operation.
- No response-generation integration.
- No new Character Mind schema or runtime settings.
- No operation history beyond the status already exposed by CR019.
- No persisted query results in the client.

## Risks

- A full Build can be expensive and long-running; the UI warns before it starts and exposes Cancel.
- The connection is global although the control is reached from a Conversation; the label and helper copy make this explicit.
- Open Folder operates on the server host, so remote and container users may need to copy the path and access the mounted data directory manually.

## Validation

- Focused Character Mind regression passed.
- Changed client files passed ESLint and client TypeScript validation; server/shared TypeScript validation passed.
- The broad `pnpm check` exceeded the command window while running the full client lint, after the focused checks had passed. It was not repeated.
- The integrated primary-checkout production build passed.
- Follow-up `eb05263b4` adds Character Mind to Conversation mode's explicit agent allowlist so the Chat Settings picker and management card can render. The Conversation agent-policy regression and integrated production build passed.
- Focused Playwright UI validation remains optional follow-up evidence.
