import { spawn } from "node:child_process";
import { cpSync, createWriteStream, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const toolsRoot = process.cwd();
const engineRoot = resolve(toolsRoot, process.env.MARINARA_ENGINE_DIR ?? "Marinara-Engine");
const serverPort = Number(process.env.E2E_SERVER_PORT ?? "57860");
const fakeProviderPort = Number(process.env.E2E_FAKE_PROVIDER_PORT ?? "57861");
const clientPort = Number(process.env.E2E_CLIENT_PORT ?? "55173");
const resultsRoot = resolve(toolsRoot, "test-results", "e2e");
const runtimeRoot = join(resultsRoot, "runtime", String(process.pid));
const logsRoot = join(resultsRoot, "logs");
const dataDir = join(runtimeRoot, "data");

rmSync(runtimeRoot, { recursive: true, force: true });
mkdirSync(logsRoot, { recursive: true });
mkdirSync(dataDir, { recursive: true });

const capabilityFixtureRoot = join(toolsRoot, "tests", "e2e", "fixtures", "capability-packages", "custom-tracker");
const capabilityManifest = JSON.parse(readFileSync(join(capabilityFixtureRoot, "manifest.json"), "utf8"));
const capabilityPackagesRoot = join(dataDir, "capability-packages");
const installedPackageRoot = join(
  capabilityPackagesRoot,
  "versions",
  capabilityManifest.id,
  capabilityManifest.version,
);
mkdirSync(installedPackageRoot, { recursive: true });
cpSync(capabilityFixtureRoot, installedPackageRoot, { recursive: true });
writeFileSync(
  join(capabilityPackagesRoot, "installed.json"),
  JSON.stringify(
    {
      schemaVersion: 1,
      packages: [
        {
          id: capabilityManifest.id,
          version: capabilityManifest.version,
          manifest: capabilityManifest,
          installedAt: "2026-01-01T00:00:00.000Z",
          status: "active",
          error: null,
          readiness: "ready",
          readinessError: null,
          legacy: false,
        },
      ],
    },
    null,
    2,
  ),
);

const children = new Set();
let shuttingDown = false;

function logPath(name) {
  return join(logsRoot, name);
}

function spawnLogged(name, command, args, options = {}) {
  const log = createWriteStream(logPath(`${name}.log`), { flags: "w" });
  log.write(`[e2e] ${command} ${args.join(" ")}\n`);

  const child = spawn(command, args, {
    cwd: options.cwd ?? engineRoot,
    shell: process.platform === "win32",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });

  children.add(child);

  child.stdout.on("data", (chunk) => {
    process.stdout.write(`[${name}] ${chunk}`);
    log.write(chunk);
  });
  child.stderr.on("data", (chunk) => {
    process.stderr.write(`[${name}] ${chunk}`);
    log.write(chunk);
  });
  child.on("exit", (code, signal) => {
    children.delete(child);
    log.write(`\n[e2e] exited with code=${code} signal=${signal}\n`);
    log.end();
    if (!shuttingDown && code !== 0) {
      shutdown(code ?? 1);
    }
  });

  return child;
}

function waitForExit(child) {
  return new Promise((resolveExit) => {
    child.on("exit", (code) => resolveExit(code ?? 1));
  });
}

async function waitForUrl(url, label, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (response.ok) return;
      lastError = new Error(`${label} returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 500));
  }

  throw new Error(`Timed out waiting for ${label} at ${url}: ${lastError?.message ?? "no response"}`);
}

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children) {
    child.kill("SIGTERM");
  }

  setTimeout(() => process.exit(exitCode), 500).unref();
}

process.on("SIGINT", () => shutdown(130));
process.on("SIGTERM", () => shutdown(143));
process.on("exit", () => {
  for (const child of children) {
    child.kill("SIGTERM");
  }
});

try {
  const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  const sharedBuild = spawnLogged("shared-build", pnpm, ["build:shared"]);
  const sharedBuildCode = await waitForExit(sharedBuild);
  if (sharedBuildCode !== 0) {
    process.exit(sharedBuildCode);
  }

  spawnLogged("fake-openai", "node", [join(toolsRoot, "tests/e2e/fixtures/fake-openai-provider.mjs")], {
    cwd: toolsRoot,
    env: { ...process.env, E2E_FAKE_PROVIDER_PORT: String(fakeProviderPort) },
  });
  await waitForUrl(`http://127.0.0.1:${fakeProviderPort}/health`, "fake OpenAI provider");

  const commonEnv = {
    ...process.env,
    AUTO_CREATE_DEFAULT_CONNECTION: "false",
    AUTO_OPEN_BROWSER: "false",
    CORS_ORIGINS: `http://127.0.0.1:${clientPort},http://localhost:${clientPort}`,
    DATA_DIR: dataDir,
    HOST: "127.0.0.1",
    LOG_LEVEL: process.env.E2E_LOG_LEVEL ?? "debug",
    MARINARA_LITE: "true",
    PORT: String(serverPort),
    SKIP_PWA: "true",
    E2E_FAKE_PROVIDER_PORT: String(fakeProviderPort),
    VITE_MARINARA_LITE: "true",
  };

  spawnLogged("server", pnpm, ["--filter", "@marinara-engine/server", "run", "dev"], { env: commonEnv });
  await waitForUrl(`http://127.0.0.1:${serverPort}/api/health`, "server health");

  spawnLogged(
    "client",
    pnpm,
    [
      "--dir",
      "packages/client",
      "exec",
      "vite",
      "--host",
      "127.0.0.1",
      "--port",
      String(clientPort),
      "--strictPort",
    ],
    { env: commonEnv },
  );
  await waitForUrl(`http://127.0.0.1:${clientPort}`, "client");

  console.log(`[e2e] ready: http://127.0.0.1:${clientPort}`);
  console.log(`[e2e] logs: ${logsRoot}`);

  await new Promise(() => {});
} catch (error) {
  console.error(error);
  shutdown(1);
}
