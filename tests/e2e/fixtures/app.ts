import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test as base, expect, type Page, type TestInfo } from "@playwright/test";
import { AppShellPage } from "../pages/app-shell.page";

const toolsRoot = fileURLToPath(new URL("../../..", import.meta.url));
const logsRoot = join(toolsRoot, "test-results", "e2e", "logs");

async function attachLog(testInfo: TestInfo, name: string) {
  const path = join(logsRoot, `${name}.log`);
  if (!existsSync(path)) return;

  await testInfo.attach(`${name}.log`, {
    path,
    contentType: "text/plain",
  });
}

async function waitForHealth(page: Page) {
  const response = await page.request.get("/api/health");
  expect(response.ok()).toBeTruthy();
}

export const test = base.extend<{ app: AppShellPage }>({
  app: async ({ page }, use) => {
    await page.goto("/");
    await waitForHealth(page);
    const app = new AppShellPage(page);
    await app.waitForReady();
    await use(app);
  },
});

test.afterEach(async ({}, testInfo) => {
  await attachLog(testInfo, "server");
  await attachLog(testInfo, "client");
  await attachLog(testInfo, "shared-build");
  await attachLog(testInfo, "fake-openai");
});

export { expect };
