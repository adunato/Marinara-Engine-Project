# CR031 — Character Mind Build Validation Recovery

## Status

Proposed. No implementation has started.

## Problem

CR030 successfully moved complete Build pages out of tool-call arguments and into ordinary streamed Markdown. A subsequent six-page Character Mind Build completed without provider errors, malformed streams, or 504 responses, but Marinara rejected 17 complete model candidates before accepting the corpus map and pages.

The observed failures were:

- the corpus map assigned sources to pages while also listing them in `excludedSources`, and later omitted one source entirely;
- map validation exposed one partition problem per complete replacement and a generic recovery turn reread all 22 already-read sources;
- page sessions used Setext H1 headings instead of Marinara's required `# Title`, and one used `## **Sources**` instead of the required `## Sources`;
- pages cited raw sources visible elsewhere in `index.md` but outside their frozen assignment;
- one outside-assignment citation was first reported as unread, prompting the model to read it, and was only then reported as outside the map; and
- every local formatting or citation defect caused another complete streamed page rather than a bounded candidate repair.

These validation retries consumed most of the Build's elapsed time. They are application-level candidate rejections, not transport or provider failures.

## Goals

- Make the existing corpus-map and Markdown contracts explicit enough for the model to follow reliably.
- Report all source-partition defects in a proposed map together.
- Prevent unnecessary corpus rereads during map correction.
- Reject outside-assignment raw citations with the correct corrective instruction before considering read status.
- Repair local defects on the temporary candidate through CR030's bounded editing path instead of regenerating a complete page.
- Record compact validation-attempt diagnostics without storing rejected page content.
- Preserve CR030's ordinary streamed-text transport and CR029's Build checkpoints and resume behavior.

## Non-goals

- Relaxing Marinara's required `# Title` and literal `## Sources` conventions.
- Having Marinara author page titles, source sections, or substantive wiki prose for the model.
- Changing corpus-map semantics or allowing sources to disappear from the map.
- Changing Build page assignments after the map is frozen.
- Redesigning Ingest, Query, Lint, or general provider transport.
- Adding a workflow framework, database state, or new Character Mind UI.

## Proposed solution

### 1. Make page-output requirements exact

The Build-page prompt will require:

- the first non-empty line to be exactly `# <mapped title>`;
- ATX H1 syntax rather than Setext `===` syntax;
- exactly one unformatted `## Sources` heading; and
- every raw wikilink, including inline citations, to come from the target page's displayed source whitelist.

The prompt will explicitly state that raw paths visible elsewhere in `index.md` are not authorised evidence for the current page. Marinara's existing canonical heading validation remains authoritative.

### 2. Clarify and validate corpus-map partitioning

The existing JSON map shape remains unchanged. Its prompt will define the invariant in plain language:

- a source may support more than one page;
- a source assigned to any page must not appear in `excludedSources`;
- `excludedSources` contains only sources assigned to no page; and
- every manifest source must be present in at least one page or explicitly excluded.

After structurally parsing a candidate map, Marinara will collect all assigned-and-excluded overlaps and all unaccounted manifest sources and return them in one correction message. It will not silently choose assignments or exclusions for the model.

Once every required file has been read successfully, a map-partition retry will state that the corpus is already read and will run without read tools. The model will correct the complete JSON map using the existing conversation context.

### 3. Validate page source scope before read status

For Build pages, Marinara will compare every raw wikilink in the candidate against the frozen assignment before checking whether linked sources were read. An unassigned path will produce an explicit instruction to remove or replace the citation, not to read it.

Build-page read tools will reject raw-source paths outside the target assignment. Links to other mapped wiki pages remain allowed under the existing contract.

### 4. Use bounded repair for local page defects

The first complete page still arrives as ordinary streamed Markdown. If it is a safe, size-bounded candidate but fails a local heading, Sources-section, wikilink, or citation validation:

1. Marinara retains it only in CR030's temporary candidate area.
2. The model receives a specific validation finding and uses bounded candidate edits to correct the local defect.
3. Marinara revalidates the candidate after editing.
4. A complete streamed replacement is requested only when the candidate cannot be repaired safely with bounded edits.

No invalid candidate is published, and complete Markdown remains excluded from tool-call arguments.

### 5. Use specific recovery feedback

Recovery messages will be derived from the operation and validation category rather than the current generic “failed reads, edits, or result” instruction. They will state the required correction and whether reads, bounded edits, or a complete replacement are permitted.

Repeated identical validation findings will not trigger unbounded retries; the existing operation round limit remains the terminal bound.

### 6. Record compact attempt diagnostics

Build map and page log entries will include the number of validation attempts and compact rejection reasons or categories. Failed Build entries will retain the final unresolved reason. Diagnostics will distinguish Marinara validation rejection from provider-request failure and will not persist rejected candidate content or raw provider responses.

No new UI or API contract is required.

## Risks

- More explicit prompts reduce but cannot eliminate model non-compliance.
- Aggregating map partition findings requires preserving stable, understandable validation messages.
- A seemingly local page defect may require substantive prose changes; bounded repair must fall back to streamed replacement rather than force an unsafe patch.
- Additional log detail could become noisy, so it must remain compact and omit candidate content.
- Restricting Build-page reads must not affect Query, Ingest, or Lint navigation.

## Acceptance criteria

1. Build-page prompts require the exact `# <mapped title>` and literal `## Sources` forms.
2. The existing heading and Sources conventions remain enforced rather than normalised or authored by Marinara.
3. Corpus-map feedback reports every assigned/excluded overlap and every omitted manifest source in one correction turn.
4. A partition-only map correction cannot reread the already-read corpus.
5. Every Build-page raw wikilink is checked against the frozen assignment before read verification.
6. Build-page tools cannot read an unassigned raw source.
7. Validation feedback for an outside-assignment citation instructs the model to remove or replace it, not read it.
8. Local page defects can be corrected through bounded temporary-candidate edits without another complete page generation.
9. Complete initial pages and necessary full replacements continue to arrive as ordinary streamed Markdown, never as content-bearing tool arguments.
10. Invalid candidates never replace live wiki files, and CR029 resume behavior remains unchanged.
11. Build logs expose compact attempt counts and validation reasons separately from provider failures.
12. Focused regressions reproduce the observed map overlap/omission, Setext H1, formatted Sources heading, outside-map citation, misleading read recovery, and bounded-repair cases.
