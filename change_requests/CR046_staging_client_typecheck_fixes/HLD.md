# CR046 — Staging Client TypeScript Build Fixes

## Status

Intake. Application implementation is authorized by the user's direct request;
the later implementation, review, and validation stages remain to be completed.

## Goal

Restore a clean production client TypeScript build on the `staging` branch by
correcting the regressions currently reported by `pnpm build`. The change must
preserve the existing runtime behavior of the affected chat and layout UI.

## Base and branch intent

- Application base: local `staging` at `cac782f1b06539c2c354f864ed0acc4bfd410b7c`.
- Planned application branch: `change/CR046-staging-client-typecheck-fixes`.
- Implementation must use a dedicated temporary application worktree based on
  `staging`; the primary nested checkout remains protected coordination context.
- The completed application commit is intended for local integration into
  `staging`; no remote push is part of this request.

## Dependencies

- None. The errors are existing staging client typecheck regressions and are
  independent of CR044 Character Briefing behavior.

## Proposed solution

1. Correct the `ChatModeIcon` prop contract so its existing Lucide-compatible
   presentation props, including `className`, are accepted by callers.
2. Add the narrow, semantically correct DOM event or element parameter types to
   the affected callbacks in `EncounterModal`, `QuickReplyMenu`, `ChatSidebar`,
   and `ConnectionsPanel`.
3. Keep the fixes limited to type contracts and annotations; do not weaken
   strict TypeScript settings, suppress diagnostics, or change UI behavior.
4. Verify the complete client build and focused diff before staging integration.

The known diagnostics trace to four pre-existing staging commits: `fd5a467d0`
introduced the icon-prop mismatch, `08583a7e79` introduced the sidebar and
connections callback errors, `8038e96c1` introduced the Encounter callback
errors, and `73222fc5a4` introduced the QuickReply callback errors. CR044 did
not introduce these diagnostics.

## Risks

- An inaccurate event type could hide a real handler contract or require a
  small component-specific adjustment.
- The icon prop correction must remain compatible with all current
  `ChatModeIcon` call sites and Lucide rendering.
- The staging checkout contains unrelated local/runtime artifacts; the CR
  worktree must keep those out of the application commit.

## Validation

- Run the client production build that currently fails, confirming all listed
  `TS2322` and `TS7006` diagnostics are gone.
- Run the repository's proportional baseline check (`pnpm check`) if the
  focused build exposes no remaining issue.
- Inspect `git diff --check` and confirm no unrelated application files changed.

## Completion criteria

The CR is ready for review when the staging-based application branch builds the
client successfully under the existing strict TypeScript configuration, the
affected handlers retain their runtime behavior, and the focused application
commit is ready for local integration into `staging`.
