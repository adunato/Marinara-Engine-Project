---
name: marinara-change-request-close
description: Close, supersede, or archive a Marinara Engine change request with accurate parent tracking.
---

# Marinara CR Close

Read the [shared contract](../marinara-change-request/SHARED_CONTRACT.md). Use this stage only after an authorized completion, integration, supersession, or archive decision.

Update `change_requests/tracker.md` for fork-main integration, fork PR opening/merge when fork PRs are used, supersession, or archive. For archival, move the CR folder to `change_requests/archive/CRXXX_short_title/` and record the archived state and relevant notes. Preserve `ALIGNMENT.md` with an implemented CR when its behavior remains part of the maintained fork, even if the CR's active development lifecycle is closed. Do not continue active work from archived folders, and do not claim validation the user did not perform.

Periodic upstream alignment may later classify a retained CR as absorbed by upstream or no longer required. Record that outcome without rewriting historical facts about how the CR was originally implemented.

Exit with the exact tracker state, artifact location, and remaining follow-up or authority requirement.
