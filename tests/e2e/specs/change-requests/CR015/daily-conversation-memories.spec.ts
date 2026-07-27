import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { test, expect } from "../../../fixtures/app";
import {
  attachDailyMemoryEvidence,
  generateDailyMemoryDay,
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

  await runDailyMemoryRetrieval(page.request, chat.id);
  await expect
    .poll(async () => readFile(join(process.cwd(), "test-results", "e2e", "logs", "fake-openai.log"), "utf8"))
    .toContain("daily memory injected=true");
  await attachDailyMemoryEvidence("daily-memory-days", persisted);
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
