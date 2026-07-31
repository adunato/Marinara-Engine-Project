# CR019: Compiled Character Mind

Status: Proposed

## Problem

Marinara currently stores the authored character card and accumulated Daily Memories, but it does not maintain the structured, compounding synthesis described by Karpathy's LLM Wiki pattern. Each later use must reconstruct relationships and meaning from those original records.

CR019 instantiates the LLM Wiki pattern for one character in one Conversation. It implements the character mind as an isolated built-in agent and a real directory of interlinked Markdown files. It does not connect the agent's query output to response generation; that integration belongs to a separate change request.

## Outcome

For each `(chatId, characterId)` pair, Marinara can:

1. preserve character-card and Daily Memory revisions as immutable raw sources;
2. ingest those sources into an LLM-maintained Markdown wiki;
3. query the wiki and its cited raw sources to produce a detailed, cited briefing;
4. lint the wiki for drift and structural problems; and
5. let the user browse the same files in Marinara or Obsidian.

Markdown files are the character mind. There is no JSON mind document, graph database, fixed psychological ontology, embedding index, or parallel page schema.

## Framework Fidelity

| Karpathy concept | CR019 mapping | Fit or explicit extension |
| --- | --- | --- |
| Raw sources | Immutable snapshots of the character card and completed Daily Memories | Direct mapping |
| Wiki | LLM-maintained, interlinked Markdown pages | Direct mapping |
| Schema | User-editable `SCHEMA.md` containing conventions and operation workflows | Direct mapping |
| Ingest | Process one new raw source into the existing wiki | Direct mapping |
| Query | Read `index.md`, relevant wiki pages, and cited raw sources; return a cited answer | Karpathy specifies wiki-first query but does not define whether raw sources may be opened. CR019 explicitly permits it for concrete grounding. |
| Lint | Check contradictions, stale synthesis, broken links, orphans, missing pages, missing cross-references, and gaps | Direct mapping |
| `index.md` | Content-oriented catalog read first during ingest and query | Direct mapping |
| `log.md` | Append-only chronological record of ingest, query, and lint operations | Direct mapping |
| Obsidian | The mind directory is an Obsidian-compatible Markdown vault | Direct mapping |
| Query answer | A detailed briefing suitable for a later response-generation integration | Marinara-specific use of Karpathy's query operation |
| Interactive ingest | Automatic ingest after Daily Memory persistence, plus manual Build/Sync | Karpathy prefers interactive ingest personally but explicitly permits batch automation |
| Git repository | Not created by Marinara | Optional Karpathy recommendation omitted from the first iteration; Marinara backup and `log.md` provide recovery and history at this scope |
| `qmd` or vector search | Not included | Optional Karpathy recommendation; `index.md` and text search are sufficient at the expected initial scale |

Where Karpathy leaves behavior unspecified, `SCHEMA.md` is the authority. CR019 does not silently replace the framework's concepts with Marinara-specific equivalents.

## Scope

- Opt-in built-in Character Mind agent.
- Conversation mode.
- One independent mind per `(chatId, characterId)`.
- Character card and completed Daily Memories are the initial raw-source types.
- One configured agent connection and model for ingest, query, and lint.
- Actual Markdown storage below `DATA_DIR`.
- Automatic Daily Memory ingest, manual Build/Sync, manual lint, and lint after every seven successful ingests.
- In-app Markdown page browser and desktop **Open in folder** action.
- Obsidian-compatible links and directory structure.
- A standalone query API and query preview in the mind browser.

## Out of Scope

- Injecting a query answer into Conversation, Roleplay, Game, or any other response-generation prompt.
- Changing the normal character response pipeline or removing its existing context sources.
- Evaluating whether a briefing improves generated responses.
- A built-in graph view. Obsidian provides graph navigation on systems where the data directory is accessible.
- A graph database, JSON page database, embeddings, vector retrieval, typed edges, fixed psychological categories, confidence scores, or numeric affect.
- Web research or autonomous acquisition of new raw sources.
- Filing generated character replies or query briefings back into the wiki.
- Git initialization, branching, or commits inside character-mind directories.
- Cross-Conversation or globally shared character minds.

## Filesystem Layout

Each mind is a self-contained Markdown directory:

```text
DATA_DIR/character-minds/<chatId>/<characterId>/
├── SCHEMA.md
├── index.md
├── log.md
├── raw/
│   ├── character-card/
│   │   └── <captured-at>--<revision>.md
│   └── daily-memories/
│       └── <date>--<revision>.md
└── wiki/
    └── <page-name>.md
```

`chatId` and `characterId` are validated application identifiers. All file operations resolve the target path and reject traversal, symlinks escaping the mind root, unsupported extensions, oversized files, and writes outside the permitted operation area.

The complete `character-minds` directory is included in normal backup and restore. Desktop installations can open a mind root directly as an Obsidian vault. Docker users must expose `DATA_DIR` through a host bind mount. Android users browse through Marinara because application storage is not normally accessible to Obsidian.

## Raw Sources

Raw sources are immutable. Marinara creates them; the agent can read but never modify or delete them.

### Character card snapshots

A snapshot contains the exact authored fields relevant to character identity and behavior, with minimal YAML metadata identifying:

- source type;
- character ID;
- capture time;
- deterministic content revision; and
- the preceding revision when one exists.

A changed card creates a new file. It never overwrites the earlier snapshot.

### Daily Memory snapshots

One snapshot contains the ordered Daily Memories for one completed Conversation day, preserving:

- Daily Memory IDs;
- date;
- importance;
- exact stored memory text;
- capture time;
- deterministic revision; and
- the preceding revision when the day was previously captured.

Editing or regenerating a Daily Memory day creates a new immutable revision. Earlier revisions remain available so the wiki can explain and revise prior synthesis rather than losing its evidence history.

Daily Memories remain a lossy source if their formation omitted a concrete detail. CR019 does not claim that the wiki can recover information absent from every raw source. Adding source-message references or richer Daily Memory formation is a separate requirement if testing shows the stored memories are insufficiently specific.

## Wiki

The wiki is the LLM-generated synthesis. It contains normal Markdown files and `[[wikilinks]]`. Page types and psychological categories are not predefined.

A page exists when a subject is independently useful enough to be linked from other pages. Otherwise, the agent updates an existing page. The initial page grammar is deliberately small:

```markdown
# Page title

Current synthesis written as ordinary, evidence-grounded prose with
[[links to related pages]]. Uncertainty and incompatible interpretations
remain explicit when the sources do not justify resolving them.

## Sources

- [[raw/daily-memories/2026-07-18--a91f.md]]
- [[raw/character-card/2026-07-01T120000Z--4fa3.md]]
```

The `## Sources` section is a Marinara schema convention required to support source-grounded query. It is not a fixed psychological data model. Claims may cite sources inline when attribution needs to be more precise.

Wiki filenames use stable, filesystem-safe slugs. Page titles may change without changing links unnecessarily. When a page is renamed or merged, the agent updates inbound links during the same operation.

## Schema

`SCHEMA.md` is created from a bundled default and is editable by the user. The agent reads the complete file before every operation. Routine ingest, query, and lint cannot modify it.

The default schema defines:

- the three layers and their permissions;
- the page grammar and naming conventions;
- when to update a page versus create a page;
- the requirement to preserve ambiguity and contradiction;
- the requirement to ground synthesis in linked raw sources;
- the ingest, query, and lint workflows;
- the required `index.md` and `log.md` formats; and
- the query briefing contract.

Changing the schema affects later operations but does not automatically rewrite the wiki. The user can run lint after a schema change to bring existing pages into alignment.

## Index and Log

### `index.md`

`index.md` is the content-oriented catalog. The agent reads it first and updates it during ingest and lint. Each entry contains a wikilink and one-line description, grouped only where useful. The grouping may evolve with the wiki; CR019 does not impose a fixed taxonomy.

### `log.md`

`log.md` is append-only and chronological. It records:

- operation timestamp and type;
- raw sources processed or followed;
- wiki pages created, read, changed, renamed, or removed;
- the operation result; and
- failures or unresolved findings.

Entries use parseable headings such as:

```markdown
## [2026-07-31T09:14:00Z] query | 7f31
```

Query entries remain compact: they record page and source links but do not duplicate the query text or resulting briefing. The runtime appends the entry from the actual operation trace so `log.md` remains accurate even when the agent's final prose is incomplete.

## Built-In Agent

CR019 uses one built-in Character Mind agent with three operation modes rather than three independently configured agents. This is the smallest mapping to Karpathy's single LLM wiki agent and keeps one schema and model configuration authoritative.

The existing Marinara agent tool loop executes model calls, tool calls, tool results, and follow-up model calls. CR019 adds tools restricted to one resolved mind root:

- list Markdown files;
- search Markdown files;
- read a Markdown file;
- create or replace a wiki Markdown file;
- rename or remove a wiki Markdown file;
- replace `index.md`; and
- append an operation record to `log.md` through the runtime.

Tool availability depends on the operation:

| Operation | Read schema/index/wiki | Read raw | Write wiki/index | Rename/delete wiki | Append log |
| --- | --- | --- | --- | --- | --- |
| Ingest | Yes | Yes | Yes | No | Runtime |
| Query | Yes | Yes | No | No | Runtime |
| Lint | Yes | Yes | Yes | Yes | Runtime |

No operation may alter raw sources. No routine operation may alter `SCHEMA.md`.

A single-operation lock serializes ingest and lint for a mind. Query waits for an active writer to finish and then runs read-only; multiple read-only queries may run concurrently.

## Ingest

Ingest processes one immutable raw source at a time:

1. Read `SCHEMA.md` and `index.md`.
2. Read the new raw source.
3. Search and read relevant existing wiki pages and their cited sources.
4. Update existing pages before creating new ones.
5. Maintain `[[wikilinks]]` and `## Sources` citations across every affected page.
6. Update `index.md`.
7. Return a short operation summary.
8. Append the actual operation trace to `log.md`.

One source may update many pages. An ingest that finds nothing worth adding may validly change only `log.md`.

### Build and Sync

**Build** initializes the directory, snapshots the current character card and existing completed Daily Memory days, then ingests the snapshots one at a time: character card first, followed by Daily Memory days in chronological order.

**Sync** detects current card or Daily Memory revisions without a corresponding successful ingest entry, creates any missing immutable snapshots, and resumes ingest from the oldest pending source.

After a Daily Memory day is created, edited, or regenerated, Marinara queues the same Sync operation for each existing mind affected by that Conversation day. A failed or interrupted run remains pending and is recoverable through Sync; there is no separate durable job platform.

A character-card change is detected on the next manual Sync or Daily Memory-triggered Sync. CR019 does not add a global fan-out background service for card edits.

## Query

Query accepts a caller-provided question or current-situation text. In this CR it is invoked only through the standalone API and browser preview.

The operation:

1. Read `SCHEMA.md` and `index.md`.
2. Identify and read relevant wiki pages.
3. Follow their citations into raw sources whenever concrete events, dates, wording, biographical details, or attribution would improve grounding.
4. Search raw sources directly only when the relevant wiki synthesis identifies a gap but lacks an adequate citation.
5. Produce a complete briefing with citations.
6. Append a compact query entry to `log.md`.

The query result contract is intentionally small:

```ts
type CharacterMindQueryResult = {
  briefing: string;
  wikiPages: string[];
  rawSources: string[];
};
```

`briefing` is the Karpathy query answer adapted to Marinara's future response-generation use. It must be self-contained, detailed enough to support concrete language, explicit about relevant uncertainty, and grounded by `wikiPages` and `rawSources`. It is not written into the wiki and is not treated as evidence.

CR019 stops after returning and displaying this result. It does not decide how a later response-generation change will supply current messages, cache the briefing, or place it in a generation prompt.

## Lint

Lint reads the complete schema, index, wiki, and linked raw sources. It checks for the issues identified by Karpathy:

- contradictions between pages;
- synthesis made stale by later sources;
- broken or missing links;
- orphan pages;
- important concepts without pages;
- missing cross-references; and
- gaps in the available sources.

For CR019, lint may repair wiki pages, links, citations, filenames, and `index.md`. It may not conduct web research, invent missing evidence, alter raw sources, or alter `SCHEMA.md`.

The user can run lint manually. Marinara also queues lint after every seven successful ingest operations for that mind. Failed lint does not roll back already valid wiki content; it records the failure and can be rerun.

## API and UI

Server routes provide:

- mind status and pending-source inspection;
- Build and Sync;
- directory tree and Markdown file reads;
- schema update;
- query;
- lint;
- clear with explicit confirmation; and
- desktop open-folder support where available.

The Character Mind browser provides:

- Build, Sync, Query, Lint, Open Folder, and Clear actions;
- a file tree for `wiki`, `raw`, `index.md`, `log.md`, and `SCHEMA.md`;
- rendered Markdown with clickable `[[wikilinks]]`;
- text search;
- a raw Markdown view;
- an editor for `SCHEMA.md`; and
- a query input with the returned briefing and cited files.

Raw sources are read-only. Wiki content is LLM-maintained and read-only in the initial Marinara UI. Users may inspect the files externally in Obsidian; external edits are visible on the next read and are subject to later lint or ingest maintenance.

There is no in-app graph. Obsidian derives its graph directly from the same `[[wikilinks]]`.

## Failure and Recovery

- Every write uses temporary-file plus atomic-rename semantics.
- A tool failure is returned to the agent, which may retry within the bounded operation loop.
- An invalid path, non-Markdown target, oversized write, or raw-source mutation is rejected before filesystem mutation.
- Successful file operations remain durable if a later step fails; Sync or lint repairs partial maintenance. CR019 does not add transactional filesystem snapshots.
- A missing connection or invalid model result fails only the requested mind operation.
- Clearing a mind removes exactly its validated mind root after confirmation. Recovery then requires a Marinara backup or a new Build.
- Chat deletion removes that chat's mind directories. Character deletion removes matching character directories after ownership validation.

## Relationship to Existing Features

- Daily Memories remain the existing authored/formed records. CR019 snapshots but does not modify them.
- Character cards remain authored records. CR019 snapshots but does not modify them.
- Daily Intentions, summaries, Memory Recall, lorebooks, cross-chat awareness, and existing generation agents are neither read nor changed in the first iteration.
- The built-in Character Mind agent has its own enablement and connection setting.
- No code in the response-generation path consumes Character Mind query results in CR019.

## Risks

- Daily Memories may omit the exact details needed for vivid query answers.
- LLM file edits may under-update related pages or create duplicates; lint is the recovery mechanism prescribed by the framework.
- A user-edited schema may produce incompatible conventions or poorer maintenance.
- Repeated queries will grow `log.md`, although entries are deliberately compact.
- External Obsidian edits can race with agent writes; the per-mind operation lock protects Marinara operations but cannot lock another desktop application.
- Build and lint may require several tool/model rounds and therefore incur noticeable cost.
- Provider models vary in tool-calling and multi-file editing reliability.

## Validation

- Verify isolation between minds sharing a character or Conversation.
- Verify raw snapshots are revisioned, immutable, exact, and never writable through agent tools.
- Verify Build ingests the card and Daily Memory sources in the defined order and can resume after failure.
- Verify automatic Daily Memory Sync detects new and edited days without depending on message generation.
- Verify ingest updates multiple Markdown pages, `index.md`, citations, links, and `log.md` through bounded tools.
- Verify query begins with the index, follows wiki links and raw citations, and returns a detailed briefing plus only actually read files.
- Verify lint detects and repairs broken links, orphans, duplicates, stale synthesis, and missing citations without changing raw sources or schema.
- Verify the seven-ingest lint trigger and manual lint use the same operation.
- Verify path containment, extension restrictions, symlink rejection, size limits, atomic writes, and per-mind writer locking.
- Verify backup/restore and chat/character deletion include the new directory.
- Verify Markdown rendering and `[[wikilinks]]` work in Marinara and Obsidian-compatible files remain ordinary Markdown.
- Verify schema editing changes later agent behavior without silently rewriting the wiki.
- Verify no Character Mind output is added to any response-generation prompt.
- Run focused server/client tests and `pnpm check` once after implementation.
- After implementation, agree whether focused CR019 Playwright E2E validation is worthwhile for the browser and operation flows.
