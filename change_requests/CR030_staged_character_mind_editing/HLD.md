# CR030 — Staged Character Mind Editing

## Status

Proposed. Awaiting HLD approval before implementation.

## Context

Character Mind follows Andrej Karpathy's LLM Wiki pattern:

- immutable raw sources containing Character Cards, auto-summaries, and Daily Memories;
- an LLM-maintained Markdown wiki with wikilinks;
- `SCHEMA.md` defining conventions and workflows;
- `index.md` supporting navigation;
- `log.md` recording operations; and
- direct inspection through Obsidian or another filesystem editor.

Character response generation remains outside Character Mind.

CR019 introduced Build, Sync/Ingest, Query, and Lint. CR022 made initial Build corpus-first. CR025 isolated materialization into one agent session per mapped page, CR026 enabled streaming for those sessions, CR024 added shared request retries, and CR029 made incomplete Builds resumable.

The remaining reliability problem is the mutation boundary. Page materialization and maintenance currently send complete Markdown documents inside JSON tool-call arguments, then apply accepted writes directly to the visible wiki during the agent session. Real Mistral Large 3 requests through NanoGPT showed that large arguments were not progressively delivered, one call was rejected as malformed after generation, another arrived only as a complete argument, and later page requests repeatedly received upstream 504 responses. This is sufficient reason to avoid depending on large content-bearing tool calls. It does not establish the exact cause of every 504.

The existing implementation also deliberately permits partial multi-file mutations: individual files use atomic replacement, but a later provider failure or final validation error does not roll back earlier writes. Obsidian edits cannot participate in Marinara's in-process writer lock and can race with those writes.

## Goals

- Define one coherent LLM/file contract for Build, Ingest, Query, and Lint.
- Keep large Markdown out of JSON tool-call arguments.
- Separate page creation, targeted editing, and deliberate full replacement.
- Let incremental Ingest discover an initially unknown but ultimately finite affected-page set.
- Support page creation, merging, splitting, renaming, and retirement without exposing an inconsistent intermediate wiki.
- Validate a complete candidate wiki before changing visible synthesis.
- Resume completed planning and candidate work after provider failure or process restart.
- Prevent stale operations from overwriting concurrent manual edits.
- Retain the existing small, local, Markdown-native Character Mind model.

## Non-goals

- Character response-generation integration.
- A visual wiki browser or Markdown editor.
- A generic job system, distributed workflow engine, or new database-backed knowledge store.
- A Git repository per Character Mind.
- Provider-specific fine-grained tool-input streaming as a required capability.
- A fixed psychological page taxonomy or target page count.
- Parallel page generation in the initial implementation.
- Filing Query results back into the wiki automatically.

## Design principles

### The LLM judges; Marinara mutates

The LLM decides semantic structure, relevance, synthesis, uncertainty, and topology. Marinara owns paths, operation state, staging, validation, conflict detection, commit, rollback, and logging.

No LLM tool mutates the visible `wiki/`, `index.md`, raw sources, `SCHEMA.md`, or `log.md` during an agent session.

### Match the output channel to the payload

CR030 uses three output channels deliberately:

1. **Tool arguments** contain only bounded control data: paths, search terms, read ranges, and small exact replacement fragments.
2. **Small decisions** such as corpus maps, change plans, topology decisions, findings, and summaries are returned as ordinary response text containing JSON. Marinara parses and validates it. Provider-native structured output is not required.
3. **Large content** such as a complete Markdown page, full-page replacement, or Query briefing is returned as ordinary streamed response text. It is never JSON-escaped inside a tool argument.

Streamed page content remains an incomplete temporary response until the provider reports successful completion. Marinara never applies or validates a truncated stream as a candidate page.

### Plan, stage, validate, commit

Every behavior-bearing write operation follows the same boundary:

1. take a consistent snapshot of `SCHEMA.md`, `index.md`, the current wiki, and relevant raw revisions;
2. let a read-only planning session freeze the intended finite change set;
3. create or edit candidates in a private staged copy;
4. validate each candidate and the complete staged end state;
5. compare the live files with their snapshot hashes;
6. commit the staged changes through a recovery journal; and
7. append the operation result to `log.md`.

The private operation state lives below a reserved non-wiki directory such as `.marinara/work/` inside the mind root. It contains the frozen plan, base hashes, source revisions, candidate status, and commit-recovery data. It is Marinara operational state, not a fourth knowledge layer and not part of Obsidian navigation.

## File ownership and snapshots

- `raw/` remains immutable, revision-addressed evidence. Existing integrity verification continues.
- `SCHEMA.md` remains user-editable and unavailable to mutation tools. A change during an operation invalidates the candidate rather than being overwritten.
- `wiki/` remains LLM-maintained and manually inspectable/editable. All current content, including edits made before an operation starts, is part of the operation's authoritative base.
- `index.md` remains the navigation document. Marinara owns a clearly delimited generated catalog section; manual text outside that section is preserved verbatim.
- `log.md` remains append-only and Marinara-authored.

At operation start, Marinara records content hashes for `SCHEMA.md`, `index.md`, and the complete wiki snapshot. Raw source revisions already provide immutable content identities. Agent reads use the stable snapshot, not a mixture of changing live files.

## Planning contract

### Initial corpus map

The Build planner reads every current raw source before proposing pages. It returns the existing conceptual map—summary, pages, titles, purposes, source assignments, and justified exclusions—as small validated JSON.

Marinara validates:

- every current source was successfully read and is either assigned or excluded;
- page paths are unique, flat, safe `wiki/*.md` paths;
- every page has at least one assigned source; and
- page and source limits are respected.

The in-progress map is stored in the private operation journal rather than publishing broken links in the live `index.md`. The final navigation index is published with the complete Build.

### Incremental change plan

Each Ingest processes one pending immutable raw revision, preserving Karpathy's source-by-source maintenance model. The planning session reads the source, current index, relevant wiki pages, and supporting raw citations. It decides what the new evidence changes and returns a finite change plan.

The plan can request:

- no synthesis change;
- targeted edits to existing pages;
- creation of new pages;
- deliberate full-page replacement;
- rename;
- merge;
- split; or
- retirement.

Marinara expands deterministic dependencies before freezing the plan. For example, a rename or retirement adds inbound-link owners to the affected set. If later investigation reveals another semantically affected page, the operation returns to planning while the live wiki remains unchanged; the editing phase cannot dynamically acquire arbitrary new live write targets.

## Page mutation contracts

### New-page creation

A creation session is bound by Marinara to one absent target path, its purpose, assigned evidence, and the frozen page map/change plan. It may use read and search tools but has no content write tool. Its final ordinary streamed response is the complete Markdown page.

Marinara stages the response only when it completes successfully, then validates the H1, `## Sources`, verified raw citations, wikilinks, size, and target-path precondition.

### Targeted editing

Targeted editing is the default for an existing page. A session operates on a staged copy and may use one small exact-replacement tool. The tool requires old text that matches exactly once and bounded replacement text. Marinara already knows the bound target and staged revision, so the model does not supply redundant live-path or hash authority.

Multiple small replacements are allowed. Zero matches, multiple matches, unsafe expansion, or an excessive fragment is a recoverable tool error. Untouched content remains byte-for-byte unchanged.

### Full-page replacement

Full replacement is explicit rather than an accidental consequence of the generic write tool. The planner records why local edits are inappropriate. A dedicated replacement session receives the complete current page and evidence, then returns the complete candidate as ordinary streamed Markdown.

If a targeted edit grows beyond the bounded edit contract, Marinara abandons that page candidate and reruns it as an explicit replacement. It does not accept a whole page disguised as a replacement fragment.

Creation fails if the target exists in the base. Editing and replacement fail if it does not. Every mode is also protected by the final live-hash comparison.

## Topology changes

Topology is described as a desired end state in the frozen plan. The LLM does not directly move or delete live files.

### Rename

The LLM judges that the subject is unchanged but its stable name or path should change. Marinara stages the move and rewrites unambiguous wikilink targets mechanically. Pages whose links require semantic retargeting become explicit edit targets.

### Merge

The LLM chooses the destination page, the synthesis and citations to retain, and the pages made redundant. Marinara materializes the destination and updates every inbound reference before staging retirement of the redundant pages.

### Split

The LLM chooses the new subjects, allocates evidence, and decides whether the original page is narrowed or retired. All target pages and semantically affected inbound pages are staged and validated together.

### Retirement

Retirement removes a wiki page from the current synthesis only when its supported content is redundant, superseded, or preserved elsewhere. It never removes raw evidence. Marinara refuses retirement while a remaining page or index entry links to the target.

Moves and deletions become visible only during the final operation commit.

## Index maintenance

The LLM supplies semantic page metadata—title, one-line description, and any grouping decision—in the Build or change plan. Marinara renders the delimited generated catalog section deterministically and preserves text outside it.

This keeps Karpathy's content-oriented `index.md` while removing the complete-index content-bearing tool call. Initial Build renders the complete catalog. Incremental operations change only affected catalog entries unless an explicit Lint plan reorganizes the catalog.

## Query

Query remains read-only and waits for any writer commit/recovery to finish. It reads the stable `SCHEMA.md` and index snapshot, navigates relevant wiki pages, and follows raw citations when concrete names, dates, wording, events, or attribution matter.

The final briefing is ordinary streamed text with inline `[[wikilinks]]`, not a large JSON string. Marinara derives the API's `wikiPages` and `rawSources` arrays by intersecting cited links with the actual verified read trace. Unknown or unread citations fail validation or are omitted when doing so cannot misrepresent grounding.

Query writes no knowledge files. Marinara appends only its compact chronological log entry. Filing a useful Query result back into the wiki remains a separate future action.

## Lint and repair

Marinara first computes deterministic structural findings such as broken links, uncatalogued pages, invalid required sections, and unsafe or missing targets. The LLM then reads the complete wiki snapshot and relevant raw evidence to judge semantic findings such as contradictions, stale synthesis, duplicates, missing subjects, missing cross-references, and weak citations.

The LLM returns a small repair plan. Repairs use the same creation, targeted edit, replacement, and topology executor as Ingest. Mechanical link corrections remain deterministic where the intended target is unambiguous. Lint does not receive special authority to bypass staging or commit validation.

## Validation

Candidate validation occurs at two levels.

Per-document validation checks:

- safe bounded paths and sizes;
- exactly one H1 for substantive pages;
- exactly one `## Sources` section;
- citations only to verified raw evidence read by the relevant session;
- assigned-source constraints during Build; and
- no mutation of raw sources, schema, log, or private operation metadata by the LLM.

Complete staged validation checks:

- every wikilink resolves in the proposed end state;
- every wiki page is catalogued exactly as required;
- no retired path has remaining inbound links;
- topology targets and paths are unique;
- the generated index section matches the plan; and
- every planned change has a completed, hashed candidate.

Only the complete staged end state is eligible for commit.

## Commit, conflict, and crash recovery

The existing in-process per-mind writer lock continues to serialize Marinara writers. Immediately before commit, Marinara re-hashes the live schema, index, and affected wiki files and verifies create/move/delete path preconditions.

If a user or external editor changed relevant live state after the snapshot, the operation records a conflict and commits nothing. The staged work can be inspected diagnostically but is reused only after replanning against the new base. This is optimistic coordination because Obsidian cannot honor Marinara's lock.

Plain files cannot provide a true multi-file transaction. Marinara therefore uses a small durable commit journal and before-images:

1. record the intended replacements, moves, and deletions plus their before/after hashes;
2. save recoverable before-images;
3. apply atomic per-file replacements and staged topology changes;
4. validate the visible result;
5. append the success log and clear the journal; or
6. restore before-images if application or validation fails.

On startup or before the next mind operation, an unfinished commit journal is recovered before work continues. The guarantee is crash-recoverable all-or-nothing operation state, not a claim that multiple filesystem paths change in one atomic OS instruction.

## Retry and resumability

Retries have distinct boundaries:

- **Request retry:** CR024 continues retrying transient provider failures only when no usable response has been observed.
- **Candidate retry:** a partial stream, malformed plan, failed exact edit, or invalid candidate retries only the current plan/page session from its stable base. Partial page text never becomes a candidate.
- **Operation resume:** after bounded candidate failures or process restart, Marinara resumes from the frozen plan and completed staged candidates when the source revisions and base hashes still match.

If sources or the base wiki changed, Marinara replans instead of replaying stale work. After bounded repeated upstream failures, the operation stops and retains resumable staged progress rather than immediately hammering the provider or restarting the complete Build.

A successful commit remains idempotent through the existing raw revision ledger. An Ingest revision is marked processed only after its complete staged change set commits and its success entry is appended.

## Relationship to Karpathy's LLM Wiki

Karpathy specifies immutable raw sources, an LLM-owned interlinked Markdown wiki, a co-evolved schema/instruction document, Ingest, Query, Lint, a content-oriented index, and an append-only chronological log. He explicitly leaves exact directory structure, formats, tools, and workflows to each implementation.

The following remain Marinara-specific:

- two-pass initial Build and corpus mapping;
- Sync as orchestration over pending raw revisions;
- isolated page sessions;
- staged edit and replacement contracts;
- merge, split, rename, and retirement semantics;
- operation journals, retries, resumability, conflict checks, and crash recovery;
- `SCHEMA.md` as the instruction filename; and
- read-only Query without automatic promotion into the wiki.

Primary design references:

- Andrej Karpathy, LLM Wiki idea file: <https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f>
- Anthropic text editor tool, including exact replacement, backup, validation, and verification guidance: <https://platform.claude.com/docs/en/agents-and-tools/tool-use/text-editor-tool>
- Anthropic fine-grained tool streaming limitations: <https://platform.claude.com/docs/en/agents-and-tools/tool-use/fine-grained-tool-streaming>
- OpenAI function-calling guidance on small, explicit tools and moving known work into application code: <https://developers.openai.com/api/docs/guides/function-calling>
- OpenAI Codex's context-bound patch editing model: <https://github.com/openai/codex/blob/main/codex-rs/core/prompt_with_apply_patch_instructions.md>

These sources inform the design principles. The CR030 contracts are proposed Marinara behavior, not schemas established by Karpathy or those tools.

## Compatibility and migration

- Completed Character Minds remain ordinary Markdown and require no knowledge migration.
- Existing immutable raw snapshots and successful revision ledger remain authoritative.
- A legacy incomplete CR029 Build checkpoint in `index.md` may be imported into the new private operation journal only when its map, source set, page files, and successful page log entries validate. Otherwise Build requires a fresh plan without deleting visible synthesis before the replacement Build commits.
- Existing custom `SCHEMA.md` content is preserved. The bundled default schema is updated to describe the new contracts, but routine operations still cannot write it.
- Existing backup, restore, chat deletion, and character deletion lifecycles must include private operation/recovery state.

## Risks

- Staging a complete candidate tree duplicates a bounded amount of Markdown on disk during an operation.
- Ordinary streamed Markdown avoids JSON argument fragility but can still be truncated or rejected upstream; completion and validation remain mandatory.
- Exact replacements can fail when the model selects non-unique text, requiring correction or explicit replacement.
- Independent per-page Build sessions can still introduce semantic repetition that later Lint must reconcile.
- A large topology change can require many sequential page sessions and remain expensive.
- Optimistic conflict detection prevents silent overwrite but can force replanning when the user edits during a long operation.
- Journal recovery adds filesystem state that must be tested carefully on Windows, Docker, and Android storage.
- Automatically generated index boundaries must remain readable and unobtrusive in Obsidian.

## Acceptance criteria

1. No complete page or complete index is transported in a JSON tool-call argument.
2. Build planning reads and accounts for the complete current corpus before any visible wiki mutation.
3. New pages and deliberate replacements arrive as successfully completed ordinary streamed Markdown responses.
4. Existing-page maintenance defaults to bounded exact edits on a staged copy.
5. Ingest freezes and validates a finite affected-page/topology plan before editing.
6. Merge, split, rename, and retirement produce a completely valid end state or no visible change.
7. Query returns a streamed briefing and derives cited paths from actual reads without modifying knowledge files.
8. Lint uses deterministic findings plus the common staged repair executor.
9. Provider failure, invalid output, cancellation, or final validation failure leaves the visible wiki unchanged.
10. A restart resumes compatible planning/candidate work and recovers any interrupted commit journal.
11. A concurrent manual edit causes a conflict rather than a stale overwrite.
12. Raw sources, `SCHEMA.md`, manual index text outside the generated section, and `log.md` retain their ownership guarantees.
13. Focused regressions cover output-channel contracts, staging, conflicts, recovery, retries, topology, grounding, and legacy incomplete-Build handling.
