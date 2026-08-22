---
name: marinara-change-request-ship
description: Prepare validated Marinara Engine CR work for local integration, release, or upstream contribution.
---

# Marinara CR Ship

Read the [shared contract](../marinara-change-request/SHARED_CONTRACT.md). Use this stage to prepare, never to independently publish, open a PR, or merge.

Confirm committed validation evidence and the requested destination. For upstream contribution, invoke `$marinara-upstream-pr` to make a clean `pr/CRXXX-*` branch against `upstream/staging`, excluding local-only helpers and copied CR docs. For a release, follow the version truth and synchronization rules in parent `AGENTS.md`, including the required version checks. Prepare `$marinara-pr-description` when a PR description artifact is requested.

Exit with the prepared branch/artifacts, exact validation status, and any authority still required for integration, PR creation, publishing, or release.
