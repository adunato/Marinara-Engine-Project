# CR027 standalone Phoenix tracing: staging integration

This record preserves the tracing-only slice integrated into the local
`staging` branch so it can be found and reapplied when staging is rebuilt from
a clean upstream baseline. It is deliberately separate from the archived
CR027 implementation record, whose original scope was coupled to Character
Mind streaming.

## Current integration

- Target branch: local `staging`
- Integrated commit: `80f688df2` (`feat: add standalone Phoenix LLM tracing`)
- Staging parent at integration: CR042 commit `71e9204b5`
- Original change request: CR027, archived as `change_requests/archive/CR027_phoenix_raw_stream_tracing/`
- The integration commit is a self-contained tracing slice. It does not require
  CR026 or any Character Mind implementation.

## Included scope

- Adds an opt-in `PhoenixTracingProvider` at the configured-provider registry
  boundary. It wraps text-generation `chat` and `chatComplete` calls while
  leaving provider behavior, streaming, errors, and cancellation intact.
- Records OpenInference LLM spans with provider/model, input and output text,
  invocation parameters, tools, token usage, finish reasons, errors, and
  timing. Streamed output is accumulated from the normal provider chunks for
  the completed or cancelled span.
- Omits binary image, file, and media bodies while recording attachment counts.
  Embedding and local-sidecar calls are not traced.
- Fails open: Phoenix registration, span creation, attribute recording, and
  span completion failures are logged as warnings and never prevent the
  underlying LLM request from running or returning its original error.
- Adds the `@arizeai/phoenix-otel` dependency and lockfile update, restart
  handling for Phoenix settings, configuration documentation, and a changelog
  entry.

## Explicitly excluded

- CR026 Character Mind Page Streaming and all Character Mind generation,
  persistence, validation, or prompt logic.
- The archived CR027 raw-stream enhancement: raw network/SSE body capture,
  malformed-event and chunk counters, tool/content character measurements,
  `[DONE]` tracking, and the 4 MiB raw-response cap. This staging integration
  traces the provider-facing request and the assembled normal output only.
- Any new UI, API, database, memory, retry, or model-behavior change.

## Configuration and Phoenix launcher

Tracing is disabled by default. In the application `.env`, enable it with:

```dotenv
PHOENIX_LLM_TRACING_ENABLED=true
PHOENIX_COLLECTOR_ENDPOINT=http://localhost:6007
PHOENIX_PROJECT=marinara-engine
# PHOENIX_API_KEY=  # only for an authenticated/hosted collector
```

The committed launcher and compose definition are:

- `start_phoenix.bat` — runs `pnpm phoenix:up` from the application root.
- `docker-compose.phoenix.yml` — starts `arizephoenix/phoenix:version-19.3.0`,
  maps Phoenix UI `localhost:6007` to container port `6006`, exposes OTLP gRPC
  on `4317`, and persists Phoenix data in the `phoenix-data` Docker volume.
- `pnpm phoenix:down` stops the container; `pnpm phoenix:logs` follows its
  logs.

Traces contain prompts and model responses. Treat the Phoenix volume and any
hosted collector as sensitive application data. The copied Marinara data under
the local staging worktree is unrelated runtime test data and is not part of
this Git integration record.

## Validation

On the integrated staging tree at `80f688df2`:

- `pnpm --filter @marinara-engine/server lint` passed (shared and server
  TypeScript checks plus the character-activity regression typecheck).
- `pnpm build` passed for shared, server, and client production artifacts.
- The Docker launcher/configuration and opt-in environment path are covered by
  the committed compose, launcher, example environment, and configuration
  documentation. No external Phoenix service is required for the checks above.

## Reapplication to a fresh upstream baseline

When creating a new staging branch, first refresh the mirror and create the
branch from the same clean baseline:

```powershell
git fetch upstream main
git switch -C upstream-main upstream/main
git switch -c staging upstream-main
git cherry-pick 80f688df2
```

If the commit is not available in the new clone, fetch the fork or copy the
commit from the old repository before cherry-picking it. Resolve only ordinary
context conflicts in the provider registry, root/server package manifests,
lockfile, environment example, changelog, and configuration documentation.
Do not resolve conflicts by bringing in CR026 or Character Mind files.

After applying the commit, verify that the provider registry still decorates
all configured text providers at the shared boundary and that embeddings are
not wrapped. Run the validation commands above, then enable Phoenix in `.env`
and make one ordinary non-stream provider request to confirm a trace appears.
Keep tracing disabled when the collector is not trusted or prompts/responses
must not leave the application process.

The commit was originally created on top of CR042, but its functional patch is
independent of CR042 and is intended to be reapplied onto a fresh
`upstream-main` without legacy Character Mind code.
