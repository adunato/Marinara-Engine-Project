---
name: marinara-pr-description
description: Create or update Marinara-Engine pull request description artifacts in change_requests/CRXXX_*/PR.md using the repository PR template. Use when Codex needs to draft, fill out, refresh, or prepare a PR description for a Marinara change request, including why, what changed, validation, docs and release impact, and UI evidence.
---

# Marinara PR Description

## Purpose

Use this skill to prepare a reviewer-ready PR description for a Marinara-Engine change request and store it with the change request artifacts.

## Workflow

1. Confirm the working directory is `Marinara-Engine-Project/`.
2. Determine the change request ID:
   - Prefer an explicit user-provided `CRXXX`.
   - Otherwise parse the current branch when it starts with `change/CRXXX-` or `pr/CRXXX-`.
   - If no CR can be determined, ask the user for the CR ID.
3. Find the matching folder under `change_requests/` whose name starts with the CR ID, such as `change_requests/CR005_chat_summary_auto_trim`.
4. Create a temporary `git worktree` checked out to the branch that owns the PR description update.
5. Gather source material before writing:
   - Read the CR HLD/IP and any existing PR draft in the CR folder.
   - Inspect parent `git status --short --branch` and nested app `git -C Marinara-Engine status --short --branch`.
   - Inspect the relevant nested app branch diff and commit log against the intended baseline when available.
   - Check validation evidence from the current task/session or repository notes. Do not claim commands were run unless they were actually run.
6. Create or update `change_requests/CRXXX_*/PR.md` using the template below.
7. Remove placeholder comments from the filled PR description unless the section is intentionally left blank.
8. Commit the completed PR description update before handing work back to the user, unless the user explicitly asks to leave changes uncommitted.
9. Remove the temporary worktree after the successful commit and validation, unless the user explicitly asks to keep it.
10. Before removing a worktree, verify `git status --short --branch` in that worktree is clean.

## Content Rules

- Write the "Why this change" section around the user problem, bug, or goal, not around implementation mechanics.
- Keep "What changed" as concise bullets that reflect the PR surface area reviewers need to inspect.
- Mark `cd Marinara-Engine && pnpm check` as `[x]` only when it passed for this change in the current work record.
- Mark manual verification as `[x]` only when manual checks were performed and described in the notes.
- Include focused CR E2E validation in the validation notes when it was agreed and run. Mention the target spec path and evidence type, such as Playwright annotations, JSON attachments, traces, screenshots, or server-log snippets.
- For docs and release impact, choose checkboxes based on actual touched files and behavior:
  - Mark "No docs changes needed" when the change does not require user-facing docs, release notes, or version metadata.
  - Mark "Updated docs..." when docs or changelog files were updated because the PR requires them.
  - Mark "Version/release files updated..." only when the PR includes a version bump or release metadata update.
- For UI evidence, include screenshot or recording paths when UI behavior changed and evidence exists. Use `Not applicable.` when there are no UI changes.
- Never invent validation, screenshots, or release impact.

## Template

```markdown
## Why this change

<!-- What user problem, bug, or goal does this solve? -->

## What changed

<!-- List the key changes in this PR -->
- 

## Validation

<!-- Required: include commands run and/or manual checks performed -->

- [ ] `cd Marinara-Engine && pnpm check`
- [ ] Manual verification completed (describe below)

### Manual verification notes

<!-- Describe what you manually verified -->
- 

## Docs and release impact

- [ ] No docs changes needed
- [ ] Updated docs (README / CONTRIBUTING / android/README / CHANGELOG) as needed
- [ ] Version/release files updated (only if this PR includes a version bump)

## UI evidence (if applicable)

<!-- Add screenshots or recordings for UI changes -->
```
