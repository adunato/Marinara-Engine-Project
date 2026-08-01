# CR030 — Staged Character Mind Editing

## Status

Proposed. Awaiting HLD approval before implementation.

## Context

Character Mind follows Andrej Karpathy's LLM Wiki pattern:

- immutable raw Character Cards, auto-summaries, and Daily Memories;
- an LLM-maintained Markdown wiki with wikilinks;
- `SCHEMA.md` defining conventions and workflows;
- `index.md` supporting navigation;
- `log.md` recording operations; and
- direct inspection and optional editing through Obsidian.

Character response generation remains outside this scope.

The current implementation supports Build, Sync/Ingest, Query, and Lint. Build first maps the complete current corpus, then runs one isolated agent session per mapped page. CR024 provides bounded provider-request retries and CR029 resumes incomplete Builds from their persisted map and successful page log entries.

Page generation and maintenance currently use write tools whose JSON arguments contain complete Markdown documents. With Mistral Large 3 through NanoGPT, large tool arguments were not progressively delivered, one completed generation was rejected as malformed, another arrived as one complete argument, and later page requests repeatedly received upstream 504 responses. This is enough evidence to avoid relying on large content-bearing tool calls. It does not prove the exact cause of every 504.

The immediate design question is therefore narrow: how should the LLM express page creation, targeted editing, and full replacement, and how should Marinara validate and apply that work consistently across existing Character Mind operations?

## Goals

- Keep complete Markdown pages and indexes out of JSON tool-call arguments.
- Define provider-neutral contracts for initial mapping, page creation, targeted editing, full replacement, Ingest, Query, and Lint.
- Let Ingest determine an initially unknown but bounded affected-page set before applying changes.
- Express merge, split, rename, and retirement through a small set of ordinary file operations.
- Validate candidate content before it replaces live files.
- Reuse existing request retries and Build resumability.
- Prevent an operation from silently overwriting a file changed manually after the LLM read it.
- Keep the implementation local, Markdown-native, and proportionate to a small application.

## Non-goals

- A durable workflow engine, operation journal, or startup recovery protocol.
- A new database, Git repository per mind, or transaction framework.
- A new `index.md` format or generated/manual section boundary.
- Changing Query's API or result contract.
- New Character Mind UI or status controls.
- Persisting resumable Ingest or Lint candidate work across a server restart.
- A special first-class workflow for every merge, split, rename, or retirement case.
- Provider-specific fine-grained tool-input streaming.
- Character response-generation integration.

## Karpathy boundary

Karpathy specifies immutable raw sources, an LLM-owned interlinked Markdown wiki, a schema/instruction document, Ingest, Query, Lint, a content-oriented index, and an append-only log. His LLM Wiki document is intentionally an abstract idea file and leaves exact tools, formats, page lifecycle, retries, and file-editing mechanics to each implementation.

The following remain Marinara-specific decisions:

- the two-pass initial Build and corpus map;
- Sync as orchestration over pending raw revisions;
- isolated page sessions;
- streamed page output and bounded edit tools;
- temporary candidate files and manual-edit conflict checks; and
- how basic create, edit, rename, and delete operations compose into merge, split, and retirement.

Primary reference: <https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f>

## Core contract

### LLM judgement

The LLM decides:

- the subjects and source assignments in the initial corpus map;
- which existing pages new evidence affects;
- whether evidence warrants a new page;
- whether an existing page needs a targeted edit or a deliberate full rewrite;
- whether pages should be merged, split, renamed, or retired;
- the synthesis, uncertainty, contradictions, citations, and cross-links; and
- semantic findings and repairs during Lint.

### Marinara responsibility

Marinara decides and enforces:

- which operation and target paths are permitted;
- how model output is transported;
- temporary candidate storage;
- raw-source integrity, path containment, and size limits;
- Markdown, citation, link, and index validation;
- live-file change detection;
- atomic per-file replacement, move, and deletion ordering; and
- operation logging and revision completion.

### Output channels

Use the output channel that matches the payload:

1. **Read and control tool arguments** contain paths, search terms, line ranges, and other small values.
2. **Small structured decisions** such as the corpus map, an Ingest/Lint change list, and operation summaries are returned as ordinary response text containing JSON and validated by Marinara. Provider-native structured output is not required.
3. **Complete Markdown content** for a new page, deliberate full-page replacement, or complete-index replacement is returned as ordinary streamed response text. It is never placed inside a JSON tool argument.
4. **Targeted edits** use one bounded exact-replacement or patch-style tool against a temporary candidate file. Its arguments contain only the local changed fragment and sufficient matching context, never the complete document.

An incomplete ordinary-text stream is not a candidate. Marinara accepts it only after successful provider completion and full validation.

## Candidate file handling

Write operations use a short-lived temporary candidate area for the current in-process operation. It contains only affected wiki pages and `index.md` as needed; it is not durable Character Mind state.

1. Marinara records the content hash of each affected live file when it is first read for mutation. A create records that the target is absent.
2. The LLM creates or edits temporary candidates rather than live files.
3. Marinara validates each candidate and then validates the proposed set against unaffected live pages.
4. Immediately before publication, Marinara rechecks the affected live hashes and path-existence preconditions.
5. A mismatch means a user or another process changed the wiki. The operation fails with a conflict and discards its candidates rather than overwriting the change.
6. Marinara publishes validated candidates with the existing atomic per-file replacement primitive, then performs validated moves/deletions and appends `log.md`.

This deliberately does not introduce a durable multi-file transaction. Provider failure, invalid model output, or validation failure occurs before publication and therefore leaves live synthesis unchanged. If an operating-system error occurs during the short publication phase, Marinara attempts to restore already-replaced affected files from the temporary originals and records the failure. A process crash in that narrow phase retains the existing file-based residual risk; CR030 does not add startup recovery machinery.

## Page operation contracts

### Creation

Creation is permitted only for a target absent when the operation began. The page session reads its assigned evidence and relevant map/context, then returns the complete page as ordinary streamed Markdown.

Marinara validates the target path, single H1, single `## Sources`, verified raw citations, wikilinks, and size before accepting the candidate.

### Targeted edit

Targeted editing is the default for an existing page. The LLM reads the current page and supporting evidence, then applies one or more bounded exact replacements or patches to its temporary candidate.

The edit tool rejects missing or ambiguous match context and excessive replacement fragments. Untouched content remains unchanged. If the intended change cannot be expressed safely within the bounded edit contract, the LLM must request a full replacement instead.

### Full-page replacement

Full replacement is explicit and reserved for substantial restructuring. The LLM receives the complete current page and relevant evidence, then returns the complete replacement as ordinary streamed Markdown.

Replacement requires that the target existed and still has the expected live hash at publication. The same page and complete-wiki validation applies as for creation.

### Index maintenance

`index.md` remains the existing LLM-maintained navigation document.

- Initial Build continues deriving the complete index from its validated frozen map.
- Normal Ingest or Lint should update the temporary index through bounded edits.
- If Lint genuinely needs to reorganize most of the index, it may request an explicit complete-index replacement returned as ordinary streamed text.

CR030 removes the complete-index content-bearing tool call but does not introduce a new index grammar or ownership model.

## Operation behavior

| Operation | LLM work and return | Marinara work |
| --- | --- | --- |
| Build map | Read every current raw source; return the existing small JSON corpus map with page purposes, source assignments, and exclusions. | Preserve current map validation and persistence. No page content is produced during mapping. |
| Build page | Read the mapped sources for one page; return the complete page as ordinary streamed Markdown. | Validate the candidate, check the target precondition, atomically publish the page, and record the existing successful page checkpoint. |
| Ingest discovery | Read the new raw revision, index, relevant pages, and supporting sources; return a bounded JSON list of required page/index actions. | Validate permitted paths and actions, then run the required page operations against temporary candidates. |
| Ingest editing | Create, target-edit, replace, rename, or retire the planned pages. | Validate the complete affected candidate set, check live hashes, publish it, then record the raw revision as successfully ingested. |
| Query | Navigate `index.md` to wiki pages and follow raw citations when concrete detail matters; return the existing cited JSON briefing. | Keep Query read-only, verify returned paths against actual reads, and append the compact query log. |
| Lint discovery | Read the complete wiki and relevant raw sources; combine deterministic findings with semantic judgement; return a bounded JSON repair list. | Execute repairs through the same temporary create/edit/replace/rename/delete primitives and existing complete-wiki validation. |

### Unknown affected-page count

Ingest does not need to know the affected-page count before investigation. Its read-only discovery session searches and reads until it can return a finite action list. Marinara validates and bounds that list before any candidate editing begins.

If a page operation reveals that another page must change, the discovery result is rejected as incomplete and the same discovery session may correct the list. Editing tools do not acquire arbitrary additional live targets themselves.

### Merge, split, rename, and retirement

These are semantic outcomes composed from the basic action list rather than separate workflow systems:

- **Merge:** create or replace the destination, edit inbound links, then delete redundant pages.
- **Split:** create the new pages, edit or delete the original, and update affected links.
- **Rename:** stage a move and update inbound links before publication.
- **Retire:** remove the page only after supported content is preserved where appropriate and no remaining page or index entry links to it.

Marinara refuses moves or deletions that leave unresolved links. Raw sources are never moved, merged, split, renamed, or retired by the LLM.

## Validation and publication

Per-candidate validation retains the existing safeguards:

- contained, flat, size-limited Markdown paths;
- exactly one H1 and one `## Sources` section for substantive wiki pages;
- raw citations only to integrity-verified sources read by the operation;
- Build-page citations matching the frozen source assignment; and
- no raw, schema, or log mutation.

Before publication, Marinara overlays all temporary candidates, planned moves, and deletions on the unaffected live wiki and runs complete validation:

- every wikilink resolves in the proposed result;
- every remaining page is represented in `index.md`;
- renamed or retired paths have no remaining inbound links; and
- every planned action has a valid candidate or filesystem operation.

Only after this validation and the live-hash check does Marinara publish the affected set. The log records actual created, updated, moved, and deleted paths rather than model claims.

## Retry, resume, and cancellation

- CR024 continues bounded transparent retries for transient provider-request failures before usable output is observed.
- A partial or invalid streamed page is discarded and retries only that page session within the existing operation limits.
- CR029 remains the durable Build resume mechanism: successfully published and logged pages are skipped on retry while missing or failed pages rerun.
- Ingest remains revision-idempotent. It is marked successful only after its complete affected set publishes and logs; otherwise the source remains pending and the next Sync replans it.
- Lint remains safely rerunnable rather than durably resumable.
- Cancellation discards unpublished temporary candidates. Already successful Build-page checkpoints remain as they do under CR029.

## Established-practice comparison

The proposed split follows common agent editing practice without adopting an external framework. Anthropic's text editor distinguishes complete creation from precise exact-string replacement and recommends unique matching, backup, validation, and verification. Codex uses context-bound patches for targeted edits. Both support keeping routine edits smaller than complete-file rewrites.

Fine-grained tool-input streaming is provider-specific and may deliver incomplete or invalid JSON, so CR030 does not depend on it.

References:

- <https://platform.claude.com/docs/en/agents-and-tools/tool-use/text-editor-tool>
- <https://platform.claude.com/docs/en/agents-and-tools/tool-use/fine-grained-tool-streaming>
- <https://github.com/openai/codex/blob/main/codex-rs/core/prompt_with_apply_patch_instructions.md>
- <https://developers.openai.com/api/docs/guides/function-calling>

The CR030 contracts are proposed Marinara behavior, not schemas established by these references.

## Risks

- Ordinary streamed Markdown can still be truncated or rejected upstream; completion and validation remain mandatory.
- Exact replacement or patch matching can fail and require a corrective model turn.
- Ingest and Lint gain a discovery step, adding one small model phase before multi-page maintenance.
- The filesystem still cannot make multiple paths change in one OS-level atomic operation.
- A manual edit during a long operation causes a conflict and re-run rather than an automatic merge.
- Independent Build page sessions can still produce repetition that later Lint must reconcile.

## Acceptance criteria

1. Complete wiki pages and complete indexes are never transported in JSON tool-call arguments.
2. Build keeps its current corpus map, sequential page sessions, and CR029 resume behavior.
3. New pages and explicit full replacements arrive as completed ordinary streamed Markdown.
4. Existing pages default to bounded targeted edits against temporary candidates.
5. Ingest discovers and validates a bounded affected-page list before editing candidates.
6. Merge, split, rename, and retirement compose the basic actions and cannot leave broken links.
7. Query remains read-only and preserves its current API/result contract.
8. Lint uses deterministic findings and the common candidate editing primitives.
9. Provider or validation failure before publication leaves live synthesis unchanged.
10. A concurrent manual edit causes a conflict instead of a stale overwrite.
11. Existing raw integrity, schema ownership, logging, request retries, and Build resumability remain intact.
12. Focused regressions cover transport channels, create/edit/replace, multi-page Ingest, topology composition, validation, retries, and manual-edit conflicts.
