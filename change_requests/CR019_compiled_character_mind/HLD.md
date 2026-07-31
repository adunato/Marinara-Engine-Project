# CR019: Compiled Character Mind

Status: Implemented

## Problem

Marinara stores character cards and Daily Memories, but it does not maintain the structured, compounding synthesis described by Karpathy's LLM Wiki pattern. CR019 implements that pattern as an isolated built-in agent operating on real Markdown files.

This change ends at a standalone query result. It does not connect the query operation to response generation. It also adds no Character Mind browser, editor, graph, or operation UI. The user inspects or edits Markdown directly through the filesystem or Obsidian and invokes operations through the API.

## Outcome

For each `(chatId, characterId)` pair, Marinara can:

1. deterministically snapshot the character card and completed Daily Memories as immutable raw sources;
2. ingest one raw source at a time into an interlinked Markdown wiki;
3. query the wiki and relevant cited raw sources to return a detailed, cited briefing; and
4. lint the wiki for contradictions, stale synthesis, broken links, orphans, missing cross-references, and source gaps.

The Markdown directory is the character mind. There is no JSON page document, graph database, embedding index, or fixed psychological ontology.

## Karpathy Mapping

| Karpathy concept | CR019 mapping | Fit or highlighted difference |
| --- | --- | --- |
| Raw sources | Immutable character-card and Daily Memory Markdown snapshots | Direct mapping |
| Wiki | LLM-maintained Markdown pages with `[[wikilinks]]` | Direct mapping |
| Schema | `SCHEMA.md`, read before every operation | Direct mapping |
| Ingest | Process one raw snapshot into the wiki | Direct mapping |
| Query | Read the index and relevant wiki pages; return a cited answer | Direct mapping |
| Lint | Periodic wiki health check and repair | Direct mapping |
| `index.md` | Content catalog read first | Direct mapping |
| `log.md` | Append-only operation history | Direct mapping |
| Obsidian | External browser/editor/graph for the Markdown directory | Direct mapping; CR019 adds no equivalent UI |
| Raw-source reads during query | Query may follow wiki citations into raw snapshots for concrete details | Karpathy does not specify this either way; CR019 explicitly allows it |
| Query answer | A complete briefing intended for a later response-generation change | Marinara-specific use of query |
| Ingest trigger | Manual Build/Sync plus automatic Sync after an existing mind's Daily Memories change | Karpathy allows batch ingest; Marinara automates the existing data source |
| Git | Not initialized by Marinara | Optional Karpathy recommendation omitted |
| `qmd`/vector search | Not included | Optional Karpathy recommendation omitted until index/text search proves insufficient |

## Scope

- Conversation mode.
- One independent mind per `(chatId, characterId)`.
- Character card and completed Daily Memories as the only raw-source types.
- One built-in Character Mind agent configuration and connection.
- The Karpathy `ingest`, `query`, and `lint` operations.
- Actual Markdown files below `DATA_DIR`.
- Manual Build, Sync, Query, and Lint APIs.
- Automatic Sync after a Daily Memory day changes, but only for an already initialized and enabled mind.
- Automatic lint after seven successful ingests.
- Normal Marinara backup/restore and deletion lifecycle.
- Direct filesystem/Obsidian inspection and editing.

## Out of Scope

- Any custom Character Mind client UI, including browsing, editing, search, query preview, operation buttons, progress, open-folder, or graph views.
- Response-generation prompt changes or use of the query briefing by a character response.
- Daily Intentions, summaries, Memory Recall, lorebooks, chat transcripts, cross-chat awareness, or other source types.
- JSON page persistence, embeddings, vector retrieval, graph databases, typed links, confidence scores, or numeric affect.
- Web research or autonomous acquisition of sources.
- Filing query briefings or generated replies into the wiki.
- Git initialization or commits inside a mind.
- Globally shared or cross-Conversation minds.

## Directory Layout

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
    └── <page-slug>.md
```

`<captured-at>` uses the Windows-safe UTC form `yyyyMMdd'T'HHmmssSSS'Z'`; it never contains colons. Daily Memory filenames retain the existing `YYYY-MM-DD` logical date.

The server validates that the chat exists and contains the character before resolving this path. All agent tools receive relative paths only. Resolved targets must remain inside the selected mind, must not traverse symlinks, and must use the `.md` extension.

Desktop users can open either one mind root or `character-minds` as an Obsidian vault. Docker users must bind-mount `DATA_DIR` to access it. Android application storage is normally inaccessible, and CR019 intentionally provides no in-app browsing substitute.

## Raw Source Generation

Raw sources are generated deterministically by Marinara server code, not by the LLM. The LLM only reads them during ingest, query, and lint.

### Canonicalization and revision

For either source type, the server:

1. reads the current persisted record(s);
2. builds the canonical payload defined below;
3. serializes objects with recursively sorted keys and arrays in their specified order;
4. calculates `SHA-256(UTF-8 canonical payload)` and uses the first 16 hexadecimal characters as the filename revision;
5. checks whether that source key and revision already exist, making snapshot creation idempotent;
6. locates the newest preceding revision for the same source key;
7. renders the Markdown template; and
8. creates the file with create-only semantics, refusing to overwrite an existing path.

The revision covers the canonical payload, not timestamps or the surrounding Markdown formatting. Before an operation reads a raw source, the server reparses its canonical JSON block and verifies the revision. A mismatch marks the source as corrupted and fails the operation rather than treating edited evidence as immutable.

A rendered raw snapshot is limited to 4 MiB. Build or Sync returns a source-size error rather than truncating evidence. Large files remain readable in chunks through the read tool described below.

### Character-card payload

The source key is `character-card:<characterId>:<chatId>`. The canonical payload is:

```ts
type CharacterCardRawPayload = {
  characterId: string;
  chatId: string;
  data: CharacterData; // complete stored Character Card V2 data
  conversationOverrides: {
    aboutMe: string | null; // per-chat override, when present
  };
};
```

Using the complete `CharacterData` avoids an arbitrary list of selected fields and preserves standard, extension, embedded character-book, and future unknown fields. Display-only data may remain present; ingest decides what is relevant to the wiki under `SCHEMA.md`.

The exact raw file format is:

````markdown
---
source_type: character-card
source_key: character-card:<characterId>:<chatId>
revision: <16-character revision>
captured_at: <ISO-8601 UTC timestamp>
supersedes: <relative previous raw path or null>
---

# Character Card — <character name>

This is an immutable Marinara raw source. The canonical JSON block is the
content covered by `revision`.

```json
<pretty-printed canonical CharacterCardRawPayload>
```
````

Build and Sync generate the character-card snapshot. CR019 does not add a fan-out hook to every character edit; a changed card remains pending until the next manual Sync or Daily Memory-triggered Sync for that mind.

### Daily Memory payload

The source key is `daily-memories:<chatId>:<date>`. Memories are ordered by `createdAt`, then `id`. The canonical payload excludes embeddings because they are retrieval implementation data rather than evidence:

```ts
type DailyMemoryRawPayload = {
  chatId: string;
  date: string;
  memories: Array<{
    id: string;
    memory: string;
    importance: number;
    createdAt: string;
    updatedAt: string;
  }>;
};
```

The exact raw file format is:

````markdown
---
source_type: daily-memories
source_key: daily-memories:<chatId>:<date>
revision: <16-character revision>
captured_at: <ISO-8601 UTC timestamp>
supersedes: <relative previous raw path or null>
---

# Daily Memories — <date>

This is an immutable Marinara raw source. The canonical JSON block is the
content covered by `revision`.

```json
<pretty-printed canonical DailyMemoryRawPayload>
```
````

After `replaceDailyMemoryDay` commits successfully, the server queues Sync only when the Character Mind agent is enabled and the target mind directory already exists. It never creates a mind merely because Daily Memories were formed. A failed automatic Sync leaves the new revision discoverable by the next Sync.

Daily Memories are already compressed and can omit vivid details. CR019 cannot recover a name, event, quotation, or date absent from both the character card and Daily Memories. Adding transcript snapshots or message references requires a later source-type decision.

## Seed Files

Build creates these files when the mind root does not already exist.

### Default `index.md`

```markdown
# Index

No wiki pages have been created yet.
```

### Default `log.md`

```markdown
# Log

Append-only history of ingest, query, and lint operations.
```

### Default `SCHEMA.md`

The bundled file is the actual initial instruction document, not a placeholder to be invented during implementation:

```markdown
# Character Mind Schema

## Layers

- `raw/` contains immutable source documents. Never change or delete them.
- `wiki/` contains the current LLM-maintained synthesis.
- `SCHEMA.md` defines these rules and workflows.
- `index.md` catalogs the wiki. Read it first.
- `log.md` is append-only operation history maintained by Marinara.

## Wiki conventions

1. Use ordinary Markdown files and `[[wikilinks]]`.
2. Create a page only for a distinct subject that is useful to link from more
   than one place. Otherwise update the most relevant existing page.
3. Prefer updating existing pages over creating near-duplicates.
4. Write current synthesis as concise, natural prose. Do not impose a fixed
   taxonomy of beliefs, emotions, goals, relationships, or other concepts.
5. Preserve uncertainty, ambivalence, and contradictory evidence when the raw
   sources do not justify resolving them.
6. Do not turn an inference into a fact. Attribute interpretations where needed.
7. Every substantive page ends with `## Sources` containing wikilinks to the raw
   sources supporting it. Use inline source links when attribution must be exact.
8. Keep filenames as stable, filesystem-safe slugs. Update every inbound link
   when lint renames or merges a page.
9. Keep `index.md` current. Each entry has a wikilink and one-line description.

## Ingest

1. Read this file, `index.md`, and the specified new raw source.
2. Search and read relevant existing wiki pages and their cited raw sources.
3. Decide what the source changes in the existing synthesis.
4. Update all affected pages and cross-references. Create a page only under the
   page-creation rule above.
5. Update `index.md` after all wiki writes.
6. Never modify raw sources, this schema, or `log.md`.
7. Return the required ingest result. Marinara writes the log from actual tools.

## Query

1. Read this file and `index.md`.
2. Use the query to find and read relevant wiki pages.
3. Follow wiki source links into raw documents whenever concrete names, dates,
   wording, events, or attribution would improve the answer.
4. Search raw documents directly only when the wiki identifies a relevant gap
   but does not provide an adequate citation.
5. Return a self-contained, detailed briefing. Combine the wiki's synthesis with
   concrete raw-source detail, preserve relevant uncertainty, and cite every file
   used in the required result.
6. Do not modify any file. Marinara writes a compact query log entry.

## Lint

1. Read this file, `index.md`, the complete wiki, and relevant raw sources.
2. Check contradictions, stale synthesis, broken links, orphan pages, duplicate
   pages, missing pages, missing cross-references, weak citations, and source gaps.
3. Repair wiki pages, links, filenames, citations, and `index.md` when supported
   by existing sources.
4. Never invent missing evidence, conduct external research, modify raw sources,
   modify this schema, or modify `log.md`.
5. Return the required lint result. Marinara writes the log from actual tools.
```

The user may edit `SCHEMA.md` directly in Obsidian or another text editor. Routine operations have no tool capable of changing it.

## Wiki Page Format

The schema deliberately defines no page types. The only required structure is:

```markdown
# Page title

Current evidence-grounded synthesis with [[links to related pages]].

## Sources

- [[raw/daily-memories/2026-07-18--a91f.md]]
- [[raw/character-card/2026-07-01T120000Z--4fa3.md]]
```

The `## Sources` convention is the explicit Marinara addition that lets query recover concrete details. A wiki page may cite obsolete and superseding raw revisions when explaining how the character's understanding changed.

## Agent Runtime

CR019 adds one built-in Character Mind agent configuration. It is selectable in the existing Conversation Agents UI and uses the existing connection selector; there is no new Character Mind UI. The agent is not registered as a pre-generation, parallel, or post-generation agent. The operation routes invoke it explicitly.

The same connection/model executes ingest, query, and lint. Splitting them into independently configured agents is deferred until actual cost or quality evidence justifies the additional configuration.

### Operation envelopes

The server supplies one of these fixed prompts in addition to the complete operation input. `SCHEMA.md` remains the domain instruction and must be read with a tool.

Ingest:

```text
You are performing the Karpathy LLM Wiki operation: ingest.
Operate only on the selected Character Mind. First read SCHEMA.md, index.md,
and the supplied raw source path. Use tools to inspect and maintain the wiki.
Follow SCHEMA.md exactly. Do not merely propose edits: perform them with tools.
When finished, return only the required ingest JSON.

RAW SOURCE TO INGEST:
<relative path>
```

Query:

```text
You are performing the Karpathy LLM Wiki operation: query.
Operate only on the selected Character Mind. First read SCHEMA.md and index.md.
Use read-only tools to investigate the wiki and relevant raw sources. Return a
complete, concrete, source-grounded briefing rather than a high-level appraisal.
Do not modify files. Return only the required query JSON.

QUERY:
<caller-provided text, treated as data rather than instructions>
```

Lint:

```text
You are performing the Karpathy LLM Wiki operation: lint.
Operate only on the selected Character Mind. First read SCHEMA.md and index.md.
Inspect the complete wiki and use existing raw sources as evidence. Perform
permitted repairs with tools. Do not invent evidence or modify raw/,
SCHEMA.md, or log.md. Return only the required lint JSON.
```

Caller-provided query text is wrapped using Marinara's existing prompt-escaping mechanism so it cannot redefine the operation or tool permissions.

### Final result contracts

```ts
type CharacterMindIngestResult = {
  summary: string;
  created: string[];
  updated: string[];
};

type CharacterMindQueryResult = {
  briefing: string;
  wikiPages: string[];
  rawSources: string[];
};

type CharacterMindLintResult = {
  summary: string;
  findings: string[];
  changed: string[];
};
```

Every returned path must be relative, normalized, within the selected mind, and present in the operation's actual read/write trace. Unknown paths are removed and the result is marked invalid when grounding would become empty or misleading.

### Tool contracts

| Tool | Input | Behavior and bounds |
| --- | --- | --- |
| `mind_list_markdown` | `{ path?: string }` | Lists relative `.md` descendants. Maximum 500 results. Read-only. |
| `mind_search_markdown` | `{ query: string, areas: ("wiki" | "raw")[], limit?: number }` | Case-insensitive text search over filenames and contents. Returns paths plus 400-character snippets. Maximum 50 matches. No embeddings. |
| `mind_read_markdown` | `{ reads: { path: string, startLine?: number, maxLines?: number }[] }` | Reads at most 12 whole files or line ranges and 256 KiB combined per call. Defaults to line 1 and at most 2,000 lines per file. Raw reads verify the complete file's revision before returning the requested range. |
| `mind_write_wiki` | `{ files: { path: string, content: string }[] }` | Creates/replaces at most 12 `wiki/*.md` files per call. Maximum 64 KiB each. Ingest/lint only. Each file uses temporary write plus atomic rename. |
| `mind_write_index` | `{ content: string }` | Replaces only `index.md`, maximum 128 KiB. Ingest/lint only. |
| `mind_move_wiki` | `{ moves: { from: string, to: string }[] }` | Moves at most 12 wiki pages after validating all targets. Lint only. |
| `mind_delete_wiki` | `{ paths: string[] }` | Deletes at most 12 wiki pages after validating that no remaining inbound links exist. Lint only. |

There is no agent tool for writing raw sources, `SCHEMA.md`, or `log.md`.

Dedicated operation limits are:

- ingest: 16 tool rounds;
- query: 8 tool rounds;
- lint: 24 tool rounds;
- 4,000 final output tokens for query and 1,500 for ingest/lint; and
- one five-minute timeout per operation, excluding a multi-source Build sequence.

If a model exhausts its rounds, Marinara makes the existing final no-tools call. The operation succeeds only when its final result validates and all mandatory reads occurred.

## Operation State and `log.md`

Markdown remains the only persistent mind state. CR019 adds no database table or JSON state file.

The runtime records the actual tool trace and appends a parseable entry to `log.md` after every operation. Successful ingest headings contain the raw revision, allowing pending-source discovery without a second state store:

```markdown
## [2026-07-31T02:00:00Z] ingest | raw/daily-memories/2026-07-30--a91f.md

- status: success
- revision: a91f...
- created: [[wiki/feeling-deprioritized]]
- updated: [[wiki/relationship-with-alex]], [[index]]
- summary: Integrated the new day into the existing relationship synthesis.
```

Query entries omit the query text and briefing:

```markdown
## [2026-07-31T09:14:00Z] query | 7f31

- status: success
- read: [[wiki/relationship-with-alex]], [[raw/daily-memories/2026-07-18--83cd.md]]
```

The runtime serializes log appends through the per-mind lock. It never accepts log Markdown from the model.

## Ingest

Ingest processes exactly one raw file per agent run:

1. Validate the raw file and revision.
2. Acquire the per-mind writer lock.
3. Run the fixed ingest envelope with the source path.
4. Require reads of `SCHEMA.md`, `index.md`, and that source before allowing the final result.
5. Allow the agent to search/read and then write the wiki and index.
6. Validate modified Markdown: safe paths, one H1, one `## Sources`, resolvable local wikilinks, and no raw/schema/log mutation.
7. Append the actual trace to `log.md` with success or failure.
8. Release the lock.

A source may change many pages. An ingest may validly make no wiki change, but it must still return a grounded summary and receive a successful log entry so it is not repeatedly treated as pending.

### Build

`POST /api/chats/:chatId/character-minds/:characterId/build`:

1. Requires the built-in agent to be enabled with a usable connection.
2. Returns `409` if the mind root already exists; the caller must use Sync.
3. Creates the directory and seed files.
4. Snapshots the current complete character-card payload.
5. Snapshots every currently formed Daily Memory day.
6. Ingests the character card first and Daily Memory snapshots oldest-first.
7. Returns operation summaries and any remaining pending sources if a later ingest fails.

Build is sequential because later sources must update the synthesis produced by earlier sources. Successfully ingested sources remain durable; rerunning Sync resumes rather than rebuilding from scratch.

### Sync

`POST /api/chats/:chatId/character-minds/:characterId/sync` accepts `{ maxSources?: number }`, defaulting to all pending sources and clamped to `1..100`.

Sync:

1. creates a new card snapshot if its current revision is missing;
2. creates missing snapshots for formed Daily Memory revisions;
3. scans successful ingest entries in `log.md`;
4. orders pending sources as the oldest card revision first, then Daily Memory date and capture time;
5. invokes ingest sequentially up to `maxSources`; and
6. stops on the first failure, returning the remaining paths.

After a Daily Memory day commits, automatic Sync calls the same service with `maxSources: 1` for each enabled, initialized mind in that Conversation. This is best-effort and does not fail the Daily Memory write.

## Query

`POST /api/chats/:chatId/character-minds/:characterId/query` accepts:

```ts
type CharacterMindQueryRequest = {
  query: string; // non-empty, maximum 32 KiB
};
```

Query waits for any ingest/lint writer, then runs read-only. It must read `SCHEMA.md` and `index.md`, navigate wiki pages, and follow raw citations when detail matters. The result parser verifies that `wikiPages` and `rawSources` were actually read and that every `rawSources` entry passed integrity verification.

The returned briefing may cite paths using `[[...]]`; the structured arrays are authoritative for diagnostics. Query never writes wiki content. Only the runtime appends its compact log record.

CR019 exposes this result through the API and stops. It does not supply current chat messages automatically or inject anything into response generation.

## Lint

`POST /api/chats/:chatId/character-minds/:characterId/lint` runs the fixed lint operation under the writer lock.

Lint lists and reads the complete wiki, validates every wikilink and source citation deterministically, then gives the agent the resulting file set and permission to repair wiki/index content. Deterministic broken-link/orphan findings are included in the operation input so the model does not need to rediscover them.

Lint may rename or delete wiki pages only after repairing inbound links. It cannot alter raw sources, schema, or log. The runtime appends the actual findings and changes.

The service queues the same lint operation after every seventh successful ingest recorded since the last successful lint. Automatic lint failure is logged and remains manually rerunnable.

## Manual Operation Surface

CR019 adds no custom client UI and no public file browser/editor routes.

The only new routes are:

| Method and path | Purpose |
| --- | --- |
| `GET /api/chats/:chatId/character-minds/:characterId/status` | Initialized state, resolved filesystem path, current/pending revisions, active operation, last result |
| `POST /api/chats/:chatId/character-minds/:characterId/build` | Initialize, snapshot, and ingest existing sources |
| `POST /api/chats/:chatId/character-minds/:characterId/sync` | Snapshot and ingest pending revisions |
| `POST /api/chats/:chatId/character-minds/:characterId/query` | Return the standalone detailed briefing |
| `POST /api/chats/:chatId/character-minds/:characterId/lint` | Check and repair the wiki |
| `POST /api/chats/:chatId/character-minds/:characterId/cancel` | Abort the active model operation without deleting files |

The API response contracts are:

```ts
type CharacterMindOperationName = "build" | "sync" | "ingest" | "query" | "lint";

type CharacterMindStatus = {
  initialized: boolean;
  path: string | null;
  currentRevisions: string[];
  pendingSources: string[];
  activeOperation: { name: CharacterMindOperationName; startedAt: string } | null;
  lastLogEntry: { operation: string; timestamp: string; status: "success" | "failure" } | null;
};

type CharacterMindSourceRun = {
  source: string;
  result: CharacterMindIngestResult | null;
  error: string | null;
};

type CharacterMindBuildOrSyncResult = {
  snapshotsCreated: string[];
  processed: CharacterMindSourceRun[];
  pendingSources: string[];
};

type CharacterMindCancelResult = {
  cancelled: boolean;
  operation: CharacterMindOperationName | null;
};
```

Build and Sync return `CharacterMindBuildOrSyncResult`; Query and Lint return their previously defined result contracts. An ownership error is `404`, invalid input is `400`, an already active writer or existing Build target is `409`, unavailable agent configuration is `422`, and an unexpected operation failure is `500` with no raw model response exposed.

These routes use the existing application access controls and validate chat/character ownership. They are intended for manual API use, tests, and later response-generation integration.

The only existing UI involved is the generic Conversation Agents UI used to enable the built-in agent and select its connection. Browsing, schema changes, and optional manual wiki edits occur directly in the filesystem or Obsidian. Clearing a mind is also a deliberate manual filesystem action in this iteration; no delete route or UI is added.

## Concurrency, Failure, and Recovery

- One in-process writer lock per mind serializes Build, Sync, ingest, and lint. Query waits for a writer. Log appends serialize through the same lock.
- Each file write uses a same-directory temporary file and atomic rename. A multi-file operation is not transactional; the trace identifies partial changes and later Sync/lint repairs them.
- Abort stops further model/tool rounds but does not revert valid completed file writes.
- Invalid output, missing mandatory reads, corrupt raw sources, unsafe paths, broken post-write links, or unavailable connections fail the operation and are logged.
- Server restart loses only active-operation state. Raw revisions without a successful ingest log entry remain pending.
- Backup includes `character-minds`. Restore replaces it using the existing backup lifecycle.
- Chat deletion removes that chat's directory. Character deletion removes matching character directories after path/ownership validation.

## Relationship to Existing Features

- Character cards and Daily Memories remain unchanged; snapshot generation only reads them.
- Daily Memory persistence gains a best-effort automatic Sync trigger for existing minds.
- Daily Intentions, summaries, Memory Recall, lorebooks, and normal response generation are not read or modified.
- No Character Mind query result enters a generation prompt.

## Risks

- Daily Memories may be too compressed to provide desired concrete detail.
- Models may under-update cross-references or create duplicate pages; lint is the framework's recovery mechanism.
- Direct user edits can race with agent writes because Obsidian cannot participate in Marinara's lock.
- Editing raw files breaks integrity and blocks operations until the source is repaired or regenerated.
- A user-edited `SCHEMA.md` can degrade later operations.
- Build and lint can require many model/tool rounds and have noticeable cost.
- `log.md` grows with every query, although query entries are compact.

## Validation

- Snapshot renderers produce byte-stable canonical payloads and deterministic revisions.
- Identical content is idempotent; edited cards/days create new files with correct `supersedes` paths.
- Complete Character Card V2 data and per-chat About Me overrides appear in card sources; Daily Memory IDs, dates, importance, exact text, and timestamps appear in day sources.
- Raw integrity verification detects manual mutation and every agent tool rejects raw writes.
- The bundled `SCHEMA.md`, operation envelopes, result parsers, tool permissions, and operation limits match this HLD.
- Build orders sources correctly and Sync resumes from successful `log.md` entries.
- Daily Memory automatic Sync is independent of response generation and never fails the underlying memory write.
- Ingest performs actual Markdown edits and maintains valid index entries, wikilinks, and raw citations.
- Query reads the index/wiki first, follows raw citations for concrete details, and returns only actually read paths.
- Lint receives deterministic link/orphan findings and safely repairs the wiki without touching raw/schema/log.
- Seven successful ingests trigger the same lint operation exposed by the API.
- Path containment, symlink rejection, size limits, atomic writes, cancellation, and per-mind locking work as specified.
- Backup/restore and chat/character deletion include mind directories.
- No custom Character Mind UI, client file APIs, Markdown-renderer changes, or response-generation hooks are present.
- Focused server/shared tests and `pnpm check` pass once after implementation.
