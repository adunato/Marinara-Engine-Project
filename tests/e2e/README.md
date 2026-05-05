# End-to-End Tests

The Playwright suite lives in the parent tools repo and starts the nested `Marinara-Engine/` app in an isolated local runtime.

## Commands

```bash
pnpm e2e:install
pnpm e2e
pnpm e2e:ui
pnpm e2e:record
pnpm exec playwright test tests/e2e/specs/change-requests/CR004
```

Run `pnpm e2e:install` once on a new machine to install Playwright's Chromium browser.
Run app dependency setup separately from `Marinara-Engine/` with `pnpm install`.

`pnpm e2e` launches:

- the Fastify server on `127.0.0.1:57860`
- the Vite client on `127.0.0.1:55173`
- a fresh SQLite/data directory under `test-results/e2e/runtime/<process-id>`

Logs are written to `test-results/e2e/logs`:

- `server.log`
- `client.log`
- `shared-build.log`
- `fake-openai.log`

The fixture also attaches those logs to each Playwright test result, so they are available in the HTML report and trace artifacts.

## Reusable Steps

Reusable browser operations live in:

- `tests/e2e/pages/` for page objects
- `tests/e2e/macros/` for scenario-level operations
- `tests/e2e/specs/change-requests/CRXXX/` for CR-specific validation specs

Prefer scenario helpers for setup that should read like a user workflow, for example:

```ts
await app.dismissOnboarding();
await createCharacterThroughUi(page, { name: "Example" });
```

## Reviewer Evidence

- Prefix API-driven tests with `[api]` and browser-interaction tests with `[ui]`.
- Wrap reusable macros and important assertions in `test.step()` so they are visible in the Playwright UI.
- Add `test.info().annotations` for reviewer-facing evidence notes.
- Attach JSON payloads, parsed SSE events, metadata snapshots, token streams, or server-log snippets for API tests.
- Use screenshots or traces for UI tests when visual state is part of the claim.
