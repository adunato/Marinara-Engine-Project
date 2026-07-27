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
