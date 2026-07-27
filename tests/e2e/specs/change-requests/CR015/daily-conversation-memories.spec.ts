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
  await expect(page.getByLabel("Daily memory minimum rank")).toHaveValue("30");
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
  const minimumRank = page.getByLabel("Conversation daily memory minimum rank");
  await expect(minimumRank).toHaveValue("30");
  await minimumRank.press("End");
  await expect(minimumRank).toHaveValue("100");
  await page.getByLabel("Conversation daily memory handover time").selectOption("5");
  await expect
    .poll(async () => {
      const response = await page.request.get("/api/agents");
      const agents = await response.json();
      const dailyMemory = agents.find((agent: { type: string }) => agent.type === "daily-memory");
      const settings = typeof dailyMemory?.settings === "string" ? JSON.parse(dailyMemory.settings) : dailyMemory?.settings;
      return { handoverHour: settings?.handoverHour, minimumRank: settings?.minimumRank };
    })
    .toEqual({ handoverHour: 5, minimumRank: 100 });
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
        ...Array.from({ length: 9 }, (_, index) => ({
          memory: `The user values jasmine tea detail ${index + 1} during important planning.`,
          importance: 5,
        })),
      ],
    },
  });
  await expect(editedResponse).toBeOK();
  const persisted = await readDailyMemories(page.request, chat.id);
  const persistedDay = persisted.days.find((candidate: { date: string }) => candidate.date === day.date);
  expect(persistedDay.formed).toBe(true);
  expect(persistedDay.memories).toHaveLength(10);
  expect(persistedDay.memories[0]).toMatchObject({
    memory: "The user always chooses jasmine tea for important planning.",
    importance: 5,
  });

  const preview = await previewDailyMemoryRetrieval(page.request, chat.id);
  expect(preview).toMatchObject({
    retrievalMessageCount: 4,
    messagesConsidered: 2,
  });
  expect(preview.memories).toHaveLength(10);
  expect(preview.memories[0]).toMatchObject({
    memory: "The user always chooses jasmine tea for important planning.",
    importance: 5,
  });
  expect(preview.memories[0].rankingScore).toBeGreaterThan(0);
  await attachDailyMemoryEvidence("daily-memory-retrieval-preview", preview);

  const agentsResponse = await page.request.get("/api/agents");
  await expect(agentsResponse).toBeOK();
  const agents = await agentsResponse.json();
  const dailyMemoryAgent = agents.find((agent: { type: string }) => agent.type === "daily-memory");
  const dailyMemorySettings =
    typeof dailyMemoryAgent.settings === "string" ? JSON.parse(dailyMemoryAgent.settings) : dailyMemoryAgent.settings;
  const setMinimumRank = async (minimumRank: number) => {
    const response = await page.request.patch("/api/agents/type/daily-memory", {
      data: { settings: { ...dailyMemorySettings, minimumRank } },
    });
    await expect(response).toBeOK();
  };
  await setMinimumRank(100);
  const filteredPreview = await previewDailyMemoryRetrieval(page.request, chat.id);
  expect(filteredPreview.memories).toHaveLength(0);
  await attachDailyMemoryEvidence("daily-memory-minimum-rank-filter", filteredPreview);
  await setMinimumRank(30);

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
      "Conversation settings preview only ranked day-grouped daily memories without exposing the source conversation text.",
  });
  const { chat, day } = await seedDailyMemoryScenario(page.request);
  await generateDailyMemoryDay(page.request, chat.id, day.date);

  const dailyMemoriesPage = new DailyMemoriesPage(page);
  await dailyMemoriesPage.openChat(chat.id);
  await page.route(`**/api/chats/${chat.id}/daily-memories/preview`, async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    const memory = body.memories[0];
    await route.fulfill({
      response,
      json: {
        ...body,
        memories: Array.from({ length: 8 }, (_, index) => ({
          ...memory,
          id: `preview-memory-${index}`,
          date: `${String(26 - index).padStart(2, "0")}.07.2026`,
          memory: index === 0 ? "A newer daily memory." : index === 7 ? "An older daily memory." : `Daily memory ${index}.`,
        })),
      },
    });
  });
  await page.getByTitle("Chat Settings").click();
  await page.getByRole("button", { name: /^Agents Show help/ }).click();
  await page.getByTestId("preview-daily-memory-retrieval").click();

  const preview = page.getByRole("dialog", { name: "Current Daily Memories" });
  await expect(preview).toBeVisible();
  await expect(preview.getByText("Daily memories that would be injected (8)")).toBeVisible();
  await expect(preview.getByText("Based on 2 recent messages")).toBeVisible();
  const previewDays = preview.getByTestId("daily-memory-preview-day");
  await expect(previewDays).toHaveCount(8);
  await expect(previewDays.nth(0)).toHaveAttribute("data-date", "19.07.2026");
  await expect(previewDays.nth(7)).toHaveAttribute("data-date", "26.07.2026");
  await expect(preview.getByText("An older daily memory.")).toBeVisible();
  const scrollSurface = page.getByTestId("daily-memory-preview-scroll");
  await expect.poll(() => scrollSurface.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
  const scrollTopBefore = await scrollSurface.evaluate((element) => element.scrollTop);
  await previewDays.nth(3).hover();
  await page.mouse.wheel(0, 500);
  await expect.poll(() => scrollSurface.evaluate((element) => element.scrollTop)).toBeGreaterThan(scrollTopBefore);
  await expect(preview.getByText("A newer daily memory.")).toBeVisible();
  await expect(preview.getByText(/Importance 5\/5/).first()).toBeVisible();
  await expect(preview.getByText(/Rank \d+%/).first()).toBeVisible();
  await expect(preview).not.toContainText("user: I strongly prefer jasmine tea");
  await expect(preview).not.toContainText("assistant: Mira promises to remember");

  await test.info().attach("daily-memory-retrieval-preview.png", {
    body: await page.screenshot(),
    contentType: "image/png",
  });
});

test("[ui] scrolls the Daily Memories editor over editable text on desktop and mobile", async ({ page }) => {
  test.info().annotations.push({
    type: "evidence",
    description:
      "Wheel input over an editable memory textarea scrolls the editor's single dialog scroll surface on desktop and mobile layouts.",
  });
  const { chat, day } = await seedDailyMemoryScenario(page.request);
  await generateDailyMemoryDay(page.request, chat.id, day.date);
  await page.route(`**/api/chats/${chat.id}/daily-memories`, async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const response = await route.fetch();
    const body = await response.json();
    const sourceMemory = body.days[0].memories[0];
    await route.fulfill({
      response,
      json: {
        ...body,
        days: body.days.map((candidate: { date: string }) =>
          candidate.date === day.date
            ? {
                ...candidate,
                memories: Array.from({ length: 10 }, (_, index) => ({
                  ...sourceMemory,
                  id: `scroll-memory-${index}`,
                  memory: `Editable daily memory ${index + 1} with enough detail to occupy the card body.`,
                })),
              }
            : candidate,
        ),
      },
    });
  });

  const dailyMemoriesPage = new DailyMemoriesPage(page);
  await dailyMemoriesPage.openChat(chat.id);
  await dailyMemoriesPage.openEditor();
  const editor = dailyMemoriesPage.editor();
  await editor.getByRole("button", { name: new RegExp(day.date.replaceAll(".", "\\.")) }).click();

  const scrollSurface = page.getByTestId("daily-memories-editor-scroll");
  const firstMemory = editor.getByRole("textbox", { name: `Memory 1 for ${day.date}` });
  const assertCardSurfaceScrolls = async () => {
    await scrollSurface.evaluate((element) => {
      element.scrollTop = 0;
    });
    await expect.poll(() => scrollSurface.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
    const memoryBox = await firstMemory.boundingBox();
    expect(memoryBox).not.toBeNull();
    const point = { x: memoryBox!.x + memoryBox!.width / 2, y: memoryBox!.y + memoryBox!.height / 2 };
    await page.mouse.move(point.x, point.y);
    expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName, point)).toBe("TEXTAREA");
    const scrollTopBefore = await scrollSurface.evaluate((element) => element.scrollTop);
    await page.mouse.wheel(0, 500);
    await expect.poll(() => scrollSurface.evaluate((element) => element.scrollTop)).toBeGreaterThan(scrollTopBefore);
  };

  await assertCardSurfaceScrolls();
  await page.setViewportSize({ width: 390, height: 844 });
  await assertCardSurfaceScrolls();
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
