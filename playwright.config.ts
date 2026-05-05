import { defineConfig, devices } from "@playwright/test";

const clientPort = Number(process.env.E2E_CLIENT_PORT ?? "55173");

export default defineConfig({
  testDir: "./tests/e2e/specs",
  fullyParallel: false,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  outputDir: "test-results/e2e/artifacts",
  reporter: [
    ["list"],
    ["html", { outputFolder: "test-results/e2e/html-report", open: "never" }],
  ],
  use: {
    baseURL: `http://127.0.0.1:${clientPort}`,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: "node ./scripts/e2e-dev-server.mjs",
    url: `http://127.0.0.1:${clientPort}`,
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
