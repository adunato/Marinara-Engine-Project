import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const fakeProviderPort = Number(process.env.E2E_FAKE_PROVIDER_PORT ?? "57861");
let evidenceCounter = 0;

type JsonRecord = Record<string, unknown>;

export const CR044_ALPHA_BRIEFING = "CR044 GENERATED BRIEFING FOR ALPHA";
export const CR044_BETA_BRIEFING = "CR044 GENERATED BRIEFING FOR BETA";

async function attachJson(name: string, value: unknown) {
  await test.info().attach(`${name}.json`, {
    body: JSON.stringify(value, null, 2),
    contentType: "application/json",
  });
}

export async function seedCr044Connection(request: APIRequestContext, model = "e2e-cr044-model") {
  return test.step("Seed deterministic CR044 fake provider connection", async () => {
    const response = await request.post("/api/connections", {
      data: {
        name: `E2E CR044 Connection ${Date.now()}`,
        provider: "custom",
        baseUrl: `http://127.0.0.1:${fakeProviderPort}`,
        apiKey: "e2e-test-key",
        model,
        maxContext: 16_384,
        isDefault: true,
        defaultForAgents: true,
      },
    });
    await expect(response).toBeOK();
    return response.json();
  });
}

export async function seedCr044Character(request: APIRequestContext, name: string) {
  return test.step(`Create CR044 character: ${name}`, async () => {
    const response = await request.post("/api/characters", {
      data: {
        data: {
          name,
          description: `Deterministic CR044 character ${name}.`,
          personality: "Calm and precise.",
          first_mes: `Hello from ${name}.`,
        },
      },
    });
    await expect(response).toBeOK();
    return response.json();
  });
}

export async function readCr044Briefing(request: APIRequestContext, characterId: string) {
  return test.step("Read persisted Character Briefing state", async () => {
    const response = await request.get(`/api/characters/${characterId}/briefing`);
    await expect(response).toBeOK();
    return response.json();
  });
}

export async function saveCr044Briefing(
  request: APIRequestContext,
  characterId: string,
  sourceTemplate: string,
  generationConnectionId: string | null = null,
) {
  return test.step("Save Character Briefing source configuration", async () => {
    const response = await request.patch(`/api/characters/${characterId}/briefing`, {
      data: { sourceTemplate, generationConnectionId },
    });
    await expect(response).toBeOK();
    return response.json();
  });
}

export async function generateCr044Briefing(request: APIRequestContext, characterId: string) {
  return test.step("Generate and persist Character Briefing latest", async () => {
    const response = await request.post(`/api/characters/${characterId}/briefing/generate`);
    await expect(response).toBeOK();
    const state = await response.json();
    await attachJson(`cr044-briefing-generation-${++evidenceCounter}`, state);
    return state;
  });
}

export async function createCr044Conversation(
  request: APIRequestContext,
  characterIds: string[],
  connectionId: string,
) {
  return test.step("Create isolated CR044 Conversation", async () => {
    const response = await request.post("/api/chats", {
      data: {
        name: `E2E CR044 Conversation ${Date.now()}`,
        mode: "conversation",
        characterIds,
        connectionId,
      },
    });
    await expect(response).toBeOK();
    const chat = await response.json();
    const metadata = await request.patch(`/api/chats/${chat.id}/metadata`, {
      data: { groupChatMode: "individual" },
    });
    await expect(metadata).toBeOK();
    return chat;
  });
}

export async function runCr044TargetedConversationGeneration(
  request: APIRequestContext,
  chatId: string,
  targetCharacterId: string,
) {
  return test.step("Generate Conversation response for one target character", async () => {
    const response = await request.post("/api/generate", {
      data: {
        chatId,
        userMessage: "CR044 target-scoped briefing probe",
        connectionId: null,
        streaming: false,
        forCharacterId: targetCharacterId,
        skipPresenceDelay: true,
      },
    });
    await expect(response).toBeOK();
    const raw = await response.text();
    await test.info().attach(`cr044-conversation-sse-${++evidenceCounter}.txt`, {
      body: raw,
      contentType: "text/plain",
    });
    return raw;
  });
}

export async function expectCr044ProviderEvidence(expectedLine: string) {
  return test.step(`Assert fake provider evidence: ${expectedLine}`, async () => {
    const logPath = join(process.cwd(), "test-results", "e2e", "logs", "fake-openai.log");
    await expect.poll(async () => readFile(logPath, "utf8")).toContain(expectedLine);
    const log = await readFile(logPath, "utf8");
    const matchingLines = log
      .split(/\r?\n/u)
      .filter((line) => line.includes("cr044"))
      .slice(-20);
    await attachJson(`cr044-provider-evidence-${++evidenceCounter}`, { expectedLine, matchingLines });
    test.info().annotations.push({ type: "evidence", description: expectedLine });
  });
}

export async function createCr044CharacterAndOpenBriefing(page: Page, name: string) {
  return test.step("Create and open Character Briefing in the Character Editor", async () => {
    const charactersPanel = page.locator('[data-component="CharactersPanelScroll"]');
    if (!(await charactersPanel.isVisible().catch(() => false))) {
      await page.locator('button[title="Characters"]').first().click();
    }
    await expect(charactersPanel).toBeVisible();
    await charactersPanel.locator('button[title="New"]').click({ force: true });
    const dialog = page.getByRole("dialog", { name: "Create Character" });
    await expect(dialog).toBeVisible();
    await page.getByPlaceholder("Character name...").fill(name);
    await dialog.getByRole("button", { name: "Create", exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
    const briefingTab = page.getByRole("button", { name: "Briefing", exact: true });
    if (await briefingTab.isVisible().catch(() => false)) {
      await briefingTab.click();
    } else {
      await page.getByRole("button", { name: "Editor sections", exact: true }).click();
      await page.locator('[role="menuitemradio"]').filter({ hasText: /briefing/i }).click();
    }
    await expect(page.getByRole("heading", { name: "Character Briefing", exact: true })).toBeVisible();
  });
}

export async function fillAndSaveCr044UiBriefing(page: Page, sourceTemplate: string) {
  return test.step("Save Character Briefing source from the UI", async () => {
    await page.locator("textarea").last().fill(sourceTemplate);
    const saveResponse = page.waitForResponse(
      (response) => response.request().method() === "PATCH" && response.url().includes("/briefing"),
    );
    await page.getByRole("button", { name: "Save", exact: true }).last().click();
    await expect((await saveResponse).ok()).toBe(true);
  });
}

export async function generateCr044UiBriefing(page: Page) {
  return test.step("Generate Character Briefing from the UI", async () => {
    const generationResponse = page.waitForResponse(
      (response) => response.request().method() === "POST" && response.url().includes("/briefing/generate"),
    );
    await page.getByRole("button", { name: "Generate Briefing", exact: true }).click();
    await expect((await generationResponse).ok()).toBe(true);
    await expect(page.locator("pre").filter({ hasText: "CR044 GENERATED BRIEFING" })).toBeVisible();
    await test.info().attach("cr044-character-briefing.png", {
      body: await page.screenshot(),
      contentType: "image/png",
    });
  });
}

export type Cr044JsonRecord = JsonRecord;
