# CR029: Resumable Character Mind Builds

## Status

Implemented and merged into local application `main` in `d04fd930f`.

## Goal

Make an incomplete Character Mind Build resume from its last durable checkpoint instead of deleting its synthesis and repeating the corpus map. Prevent healthy multi-turn map and page sessions from being killed by a five-minute whole-session deadline.

## Design

### The Markdown index is the build checkpoint

After a successful corpus map, `index.md` will contain the complete frozen plan in ordinary, human-readable Markdown:

- corpus summary;
- each planned wiki page, purpose, and assigned raw-source wikilinks;
- each explicitly excluded raw source and its reason.

Marinara will parse this constrained Markdown grammar to reconstruct the plan. No database record or hidden JSON plan is added.

### Build resumes by default

When Build is retried:

1. Snapshot the current Character Card, auto-summaries, and Daily Memories without deleting existing synthesis.
2. Reuse the persisted map only when it accounts for exactly the current raw-source paths.
3. Preserve pages whose latest build-page log entry for that frozen map is successful and whose Markdown file still exists.
4. Resume at the first missing or failed page, then continue sequentially.
5. Finalize and validate the complete wiki before recording Build success.

If no reusable map exists, Marinara resets only the synthesized wiki/index and creates a fresh corpus map. A separate explicit Restart Build action always performs that reset.

### Mandatory instructions are preloaded

Marinara deterministically reads `SCHEMA.md` and `index.md` before each Character Mind agent session, records those reads in the operation trace, and includes their contents in the system context. The model no longer needs to spend a tool round satisfying this invariant.

### Timeout semantics

The five-minute limit applies independently to each provider request. It no longer aborts the entire multi-turn agent session while successful tool and provider turns are still making progress. Existing maximum tool rounds and user cancellation remain the session bounds.

## UI

- `Build` resumes an incomplete build.
- `Restart Build` is shown for initialized but incomplete minds and requires destructive confirmation.
- No additional mind browsing or editing UI is introduced.

## Risks

- Manual edits can make the persisted map unparsable; ordinary Build then creates a fresh map rather than guessing.
- A raw-source revision changes its path, so a map containing the previous revision is intentionally not reused.
- Removing the whole-session timer allows a long but active build to continue across many provider turns; maximum tool rounds and Cancel prevent an unbounded loop.

## Validation

- Extend the deterministic Character Mind regression for map round-tripping, resume, completed-page skipping, source-set mismatch, explicit restart, preloaded mandatory files, and per-request timeout behavior.
- Run focused Character Mind regression, server/shared/client TypeScript validation, changed-file client lint, and the integrated primary build.

Completed validation:

- Character Mind deterministic regression passed, including Markdown plan round-tripping, source-set matching, mandatory-file preloading, fresh per-request signals, and resumable page selection.
- Server TypeScript validation passed.
- Changed Character Mind client files passed ESLint.
- Client production build passed in the CR worktree.
- Integrated production build passed in the primary application checkout after the fast-forward merge.
- The single broad `pnpm check` attempt reached its command window during the client phase and was not repeated; the focused checks above and the integrated build completed successfully.
