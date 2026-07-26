# Change Request Tracker

Last updated: 2026-07-26

## States

- `standalone`: Work exists on a CR branch but is not merged into `main` and has no open PR into `origin/main`.
- `merged into main`: Work has been merged into local `main`, but not into `origin/main`.
- `PR open into origin main`: A pull request is open against `origin/main`.
- `merged into origin main`: Work has been merged into `origin/main`.
- `archived`: Work is retained for reference only and should not be continued as an active CR.

## CRs

| CR | State | Title | Short Description | Depends On | Notes |
| --- | --- | --- | --- | --- | --- |
| CR001 | archived | Read & Append Chat Summary Built-In Tools | Adds `read_chat_summary` and `append_chat_summary` tools so agents can read and update persisted chat summaries. | None | Superseded by CR004. Archived under `change_requests/archive/CR001_chat_summary_tools/`. |
| CR002 | archived | Universal Agent Tool Support | Enables built-in and custom agents to receive configured tool definitions instead of limiting tool execution to Spotify agents. | None | Merged into `pastadevs/main`. Archived under `change_requests/archive/CR002_universal_agent_tool_support/`. |
| CR003 | archived | Generalized Tool Metadata I/O & Context Repair | Replaces route-specific metadata plumbing with a shared tool context for chat metadata reads, writes, and frontend sync. | CR001, CR002 | Superseded by CR004. Archived under `change_requests/archive/CR003_tool_context_cleanup/`. |
| CR004 | merged into main | Enable Custom Chat Memory Agents | Enables user-built custom agents to maintain chat memory using summary tools, metadata updates, client refresh, and agent cadence controls. | None | Supersedes CR001 and CR003. Rebased onto latest `upstream-main` and included in local `main` for testing. |
| CR005 | merged into origin main | Chat Summary Auto Trim | Adds trusted chat summary snapshot metadata and an optional context mode that excludes already-summarized messages from generation context. | CR004 |  |
| CR006 | standalone | E2E Playwright Harness | Adds the Playwright end-to-end smoke harness for application-level validation. | None | Branch: `change/CR006-e2e-playwright-harness`. Placeholder folder tracked under `change_requests/CR006_e2e_playwright_harness/`. |
| CR007 | standalone | Vector Agent Tools | Placeholder change request for vector agent tools. | None | Branch: `change/CR007-vector-agent-tools`. Placeholder only; no HLD or implementation plan created yet. |
| CR008 | standalone | Data Storage Harmonization Discovery | Assesses current file-native storage, semantic search, memory recall, trackers, memory commands, and adjacent persisted narrative data to design a cohesive library storage model. | None | Design/discovery only; no application branch opened yet. |
| CR009 | implementation | Agent Memory Enhancement | Enhances existing agent memory beyond narrow per-chat key/value storage with save, search, list, and delete tools, while evaluating whether to supersede or extend `agent_memory`. | CR008 | Application branch `change/CR009-agent-memory-enhancement` opened; implementation and focused E2E validation added. |
| CR010 | merged into main | Roleplay Context Sources | Lets a Roleplay use multiple Conversation, Roleplay, or Game chats as read-only summary and recent-message context. | None | Implemented in `681e8ce6`; merged into application `main` by `cd14732a`. |
| CR011 | merged into main | Conversation Custom Tracker | Extends the existing Roleplay Custom Tracker to Conversation mode with multiple user-defined fields, existing snapshot persistence, committed prompt context, and a Conversation-appropriate editor. | None | Implemented in `21351e48` and merged by `fe50fb5a`; picker fix `cf05f215` passed focused Playwright E2E and was merged by `bc56b622`. Official package description metadata remains a companion `Pasta-Devs/Marinara-Agents` follow-up. |
| CR012 | merged into main | Expanded Tracker Panel | Makes the desktop Tracker panel's expanded profile materially larger while keeping compact, standard, tracker behavior, and data unchanged. | CR011 | Expanded target changed from 420px to 840px in `6a4d94cf`; merged into custom application `main` by `df1d4a11`. |
| CR013 | archived | Scene Conversation Context Continuity | Gives `/scene` planning and the created roleplay the same summary-rich history and full current-day context available to normal Conversation generation. | None | Closed on 2026-07-26 after implementation in `d62923e8`, fast-forward merge into local application `main`, focused validation, and primary-checkout build. Archived under `change_requests/archive/CR013_scene_conversation_context/`. |
| CR014 | merged into main | Full Cross-Chat Conversation Context | Gives a Conversation complete summaries and visible transcripts from enabled Conversations sharing any current character, with explicit source and speaker attribution. | None | Implemented in `8588a307`; shared-character boundary restored in `d1c7cb1a`, validated, and fast-forward merged into local application `main`. |
