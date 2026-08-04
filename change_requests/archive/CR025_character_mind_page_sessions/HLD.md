# CR025 — Character Mind Page Sessions

## Status

Implemented and merged into local application `main`.

## Problem

CR022 materialized every page in a frozen Character Mind map through one long agent session. A late provider failure, output failure, or tool-protocol failure therefore failed the entire materialization pass after the model had read and reasoned over multiple pages. CR024 can retry a transient provider request, but it does not reduce the size or responsibility of the surrounding agent session.

## Goals

- Preserve the corpus-wide map as the single source of page selection and structure.
- Materialize each mapped page through an isolated agent message history.
- Keep each page grounded in exactly its assigned raw sources.
- Preserve useful cross-links to other pages in the frozen map, including pages not written yet.
- Keep `index.md` deterministic and owned by Marinara.
- Make page-level success and failure visible in `log.md`.

## Design

The initial Build remains a two-pass Karpathy LLM Wiki operation.

1. **Map:** one agent session reads the complete corpus and returns the frozen page map.
2. **Materialize:** Marinara iterates over the frozen map sequentially and starts one fresh agent session per page.

Each page session receives:

- the target page path, title, purpose, and assigned raw sources;
- the complete frozen page map without other pages' source assignments;
- `SCHEMA.md` and the deterministic map in `index.md` through read tools;
- read/search tools and `mind_write_wiki`, but not `mind_write_index`.

The write tool allows cross-links to any mapped page but permits the session to write only its target path. It requires citations to every assigned source and rejects citations outside the assignment. The runtime also verifies the required reads, target write, and final result. If the model returns prematurely, the runtime identifies the missing reads or write and continues that same page session with corrective instructions.

After every page succeeds, Marinara rewrites `index.md` from the frozen map and validates the complete wiki. `build-page` log entries record individual results; the final `build` entry remains the durable successful-Build and revision ledger.

## Deliberate Limits

- Page sessions are sequential, not parallel.
- A failed Build leaves completed page files on disk, but retrying Build still performs the existing reset and corpus remap; resumable frozen plans are not introduced here.
- Cross-page prose is not shared between page sessions. Consistency comes from the shared frozen map, shared sources where assigned, deterministic validation, and later lint.
- Response-generation integration remains outside Character Mind Build.

## Risks

- More provider sessions are created for maps with many pages.
- Total Build wall time can exceed one session's timeout because each page receives its own bounded operation window.
- Independent page synthesis can produce repetition that later lint may need to reconcile.

## Validation

- Focused Character Mind regression verifies fresh per-page message histories, target-only writes, assigned-source grounding, mapped cross-links, unavailable index writes, and in-session recovery.
- Server TypeScript validation passes.
- Production build passes in the primary application checkout.

