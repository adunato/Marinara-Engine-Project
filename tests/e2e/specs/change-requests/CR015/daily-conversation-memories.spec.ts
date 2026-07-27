import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { test, expect } from "../../../fixtures/app";
import {
  attachDailyMemoryEvidence,
  generateDailyMemoryDay,
  previewDailyMemoryRetrieval,
  readDailyMemories,
  runDailyMemoryRetrieval,
  seedDailyMemoryScenario,
} from "../../../macros/cr015-daily-memories";
import { DailyMemoriesPage } from "../../../pages/daily-memories.page";

test("[ui] lists and configures the built-in Daily Conversation Memories agent", async ({ page, app }) => {
  test.info().annotations.push({
    type: "evidence",
    description: "The built-in agent is visible in Agent Settings and exposes its required formation and retrieval controls.",
  });
  await app.dismissOnboarding();
  await app.openRightPanel("Agents");

  const card = page.locator('[data-agent-card][data-agent-name="Daily Conversation Memories"]');
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Daily Conversation Memories" }).click();

  await expect(page.getByPlaceholder("Agent name…")).toHaveValue("Daily Conversation Memories");
  await expect(page.getByText("Connection Override", { exact: true })).toBeVisible();
  await expect(page.getByText("Daily Memory Schedule & Retrieval", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Daily memory handover time")).toHaveValue("4");
  await expect(page.getByLabel("Daily memory retrieval messages")).toHaveValue("6");
  await expect(page.getByText("Prompt Template", { exact: true })).toBeVisible();
  await expect(page.getByText("Using built-in default", { exact: true })).toBeVisible();

  await test.info().attach("daily-memory-agent-settings.png", {
    body: await page.screenshot(),
    contentType: "image/png",
  });
});

test("[ui] adds Daily Conversation Memories from Conversation settings", async ({ page }) => {
  test.info().annotations.push({
    type: "evidence",
    description: "Conversation settings list the built-in agent and allow it to be attached to the current chat.",
  });
  const { chat } = await seedDailyMemoryScenario(page.request);
  const disableResponse = await page.request.patch(`/api/chats/${chat.id}/metadata`, {
    data: { enableAgents: false, activeAgentIds: [] },
  });
  await expect(disableResponse).toBeOK();

  const dailyMemoriesPage = new DailyMemoriesPage(page);
  await dailyMemoriesPage.openChat(chat.id);
  await page.getByTitle("Chat Settings").click();
  await page.getByRole("button", { name: /^Agents Show help/ }).click();
  await page.getByRole("button", { name: /^Misc Agents/ }).click();

  const agentEntry = page.locator('[data-chat-agent-entry="daily-memory"]');
  await expect(agentEntry).toContainText("Daily Conversation Memories");
  await agentEntry.click();
  const addDialog = page.getByRole("dialog", { name: "Add Daily Conversation Memories" });
  await expect(addDialog).toBeVisible();
  await addDialog.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.locator('[data-chat-agent-entry="daily-memory"]')).toContainText("Daily Conversation Memories");
  await expect(page.getByLabel("Daily memory formation connection")).toBeVisible();
  await expect(page.getByLabel("Conversation daily memory handover time")).toHaveValue("0");
  await expect(page.getByLabel("Conversation daily memory retrieval messages")).toHaveValue("4");
  await expect(page.getByLabel("Conversation daily memory semantic weight")).toHaveValue("50");
  await expect(page.getByLabel("Conversation daily memory importance weight")).toHaveValue("35");
  await expect(page.getByLabel("Conversation daily memory recency weight")).toHaveValue("15");
  await page.getByLabel("Conversation daily memory handover time").selectOption("5");
  await expect
    .poll(async () => {
      const response = await page.request.get("/api/agents");
      const agents = await response.json();
      const dailyMemory = agents.find((agent: { type: string }) => agent.type === "daily-memory");
      const settings = typeof dailyMemory?.settings === "string" ? JSON.parse(dailyMemory.settings) : dailyMemory?.settings;
      return settings?.handoverHour;
    })
    .toBe(5);
  await expect(page.getByRole("button", { name: /^Daily Memories Show help/ })).toBeVisible();

  await test.info().attach("daily-memory-conversation-agent-picker.png", {
    body: await page.screenshot(),
    contentType: "image/png",
  });
});

test("[api] forms, persists, edits, and retrieves ranked daily memories", async ({ page }) => {
  test.info().annotations.push({
    type: "evidence",
    description: "Formation uses the configured LLM; retrieval uses embeddings and injects the ranked day-grouped block.",
  });
  const { chat, day } = await seedDailyMemoryScenario(page.request);
  const formed = await generateDailyMemoryDay(page.request, chat.id, day.date);
  expect(formed.memories).toHaveLength(2);
  expect(formed.memories[0]).toMatchObject({ importance: 5 });

  const editedResponse = await page.request.put(`/api/chats/${chat.id}/daily-memories/${encodeURIComponent(day.date)}`, {
    data: {
      memories: [
        { ...formed.memories[0], memory: "The user always chooses jasmine tea for important planning.", importance: 5 },
        { memory: "Mira proposed a future hiking trip together.", importance: 3 },
      ],
    },
  });
  await expect(editedResponse).toBeOK();
  const persisted = await readDailyMemories(page.request, chat.id);
  expect(persisted.days.find((candidate: { date: string }) => candidate.date === day.date)).toMatchObject({
    formed: true,
    memories: [
      { memory: "The user always chooses jasmine tea for important planning.", importance: 5 },
      { memory: "Mira proposed a future hiking trip together.", importance: 3 },
    ],
  });

  const preview = await previewDailyMemoryRetrieval(page.request, chat.id);
  expect(preview).toMatchObject({
    retrievalMessageCount: 4,
    queryMessages: [
      "user: I strongly prefer jasmine tea when we discuss important plans.",
      "assistant: Mira promises to remember, and suggests a relaxed hiking trip.",
    ],
  });
  expect(preview.memories).toHaveLength(2);
  expect(preview.memories[0]).toMatchObject({
    memory: "The user always chooses jasmine tea for important planning.",
    importance: 5,
  });
  expect(preview.memories[0].rankingScore).toBeGreaterThan(0);
  await attachDailyMemoryEvidence("daily-memory-retrieval-preview", preview);

  await runDailyMemoryRetrieval(page.request, chat.id);
  await expect
    .poll(async () => readFile(join(process.cwd(), "test-results", "e2e", "logs", "fake-openai.log"), "utf8"))
    .toContain("daily memory injected=true");
  await attachDailyMemoryEvidence("daily-memory-days", persisted);
});

test("[ui] previews the current ranked memory extraction from Conversation settings", async ({ page }) => {
  test.info().annotations.push({
    type: "evidence",
    description:
      "Conversation settings preview the exact recent-message query and ranked day-grouped memories without running generation.",
  });
  const { chat, day } = await seedDailyMemoryScenario(page.request);
  await generateDailyMemoryDay(page.request, chat.id, day.date);

  const dailyMemoriesPage = new DailyMemoriesPage(page);
  await dailyMemoriesPage.openChat(chat.id);
  await page.getByTitle("Chat Settings").click();
  await page.getByRole("button", { name: /^Agents Show help/ }).click();
  await page.getByTestId("preview-daily-memory-retrieval").click();

  const preview = page.getByRole("dialog", { name: "Current Memory Extraction Preview" });
  await expect(preview).toBeVisible();
  await expect(preview.getByText("Context used (2 of up to 4 messages)")).toBeVisible();
  await expect(preview.getByText("Memories that would be injected (2)")).toBeVisible();
  await expect(preview.getByText("The user strongly prefers jasmine tea during important conversations.")).toBeVisible();
  await expect(preview.getByText(/Importance 5\/5/)).toBeVisible();
  await expect(preview.getByText(/Rank \d+%/).first()).toBeVisible();

  await test.info().attach("daily-memory-retrieval-preview.png", {
    body: await page.screenshot(),
    contentType: "image/png",
  });
});

test("[ui] reviews and edits memories grouped by completed day", async ({ page }) => {
  test.info().annotations.push({
    type: "evidence",
    description: "Conversation settings expose a user-editable Daily Memories modal grouped by day and importance.",
  });
  const { chat, day } = await seedDailyMemoryScenario(page.request);
  await generateDailyMemoryDay(page.request, chat.id, day.date);
  const dailyMemoriesPage = new DailyMemoriesPage(page);
  await dailyMemoriesPage.openChat(chat.id);
  await dailyMemoriesPage.openEditor();
  const editorBox = await dailyMemoriesPage.editor().boundingBox();
  expect(editorBox?.width).toBeGreaterThan(900);
  await dailyMemoriesPage
    .editor()
    .getByRole("button", { name: new RegExp(day.date.replaceAll(".", "\\.")) })
    .click();
  const importanceSelect = dailyMemoriesPage
    .editor()
    .getByRole("combobox", { name: `Importance for memory 1 on ${day.date}` });
  const importanceBox = await importanceSelect.boundingBox();
  expect(importanceBox?.width).toBeLessThan(100);
  await expect(importanceSelect.locator("option").first()).not.toHaveCSS("background-color", "rgb(255, 255, 255)");

  await page.route(`**/api/chats/${chat.id}/daily-memories/*/generate`, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 750));
    await route.continue();
  });
  await dailyMemoriesPage.editor().getByRole("button", { name: "Regenerate day" }).click();
  await page.getByRole("dialog", { name: new RegExp(`Regenerate memories for ${day.date.replaceAll(".", "\\.")}`) })
    .getByRole("button", { name: "Regenerate", exact: true })
    .click();
  const regenerating = dailyMemoriesPage.editor().getByRole("button", { name: "Regenerating..." });
  await expect(regenerating).toHaveAttribute("aria-busy", "true");
  await expect(regenerating.locator("svg")).toHaveClass(/animate-spin/);
  await expect(dailyMemoriesPage.editor().getByRole("button", { name: "Regenerate day" })).toBeEnabled();
  await dailyMemoriesPage.editFirstMemoryAndAddAnother(day.date);

  const persisted = await readDailyMemories(page.request, chat.id);
  const savedDay = persisted.days.find((candidate: { date: string }) => candidate.date === day.date);
  expect(savedDay.memories).toHaveLength(3);
  expect(savedDay.memories[0]).toMatchObject({
    memory: "The user treasures jasmine tea for serious planning conversations.",
    importance: 4,
  });
  await test.info().attach("daily-memories-editor.png", {
    body: await page.screenshot(),
    contentType: "image/png",
  });
  await attachDailyMemoryEvidence("daily-memory-ui-save", savedDay);
});
