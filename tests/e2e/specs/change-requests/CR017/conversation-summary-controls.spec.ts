import { test, expect } from "../../../fixtures/app";
import {
  attachConversationSummaryEvidence,
  backfillConversationSummaries,
  expectFakeProviderEvidence,
  patchConversationSummarySettings,
  readConversationSummaryMetadata,
  runConversationSummaryProbe,
  seedConversationSummaryControlsScenario,
} from "../../../macros/cr017-conversation-summary-controls";
import { ConversationSummaryControlsPage } from "../../../pages/conversation-summary-controls.page";

test("[ui] persists the Conversation summary connection and prompt-memory toggle", async ({ page }) => {
  test.info().annotations.push({
    type: "evidence",
    description:
      "Conversation Chat Settings expose backward-compatible defaults and persist both CR017 controls across a reload.",
  });
  const { chat, summaryConnection } = await seedConversationSummaryControlsScenario(page.request);
  const controls = new ConversationSummaryControlsPage(page);

  await controls.openChat(chat.id);
  await controls.openControls();
  await expect(controls.summaryConnection()).toHaveValue("");
  await expect(controls.memoryToggle()).toHaveAttribute("aria-pressed", "true");

  const connectionUpdate = page.waitForResponse(
    (response) =>
      response.request().method() === "PATCH" && response.url().endsWith(`/api/chats/${chat.id}/metadata`),
  );
  await controls.summaryConnection().selectOption(summaryConnection.id);
  expect((await connectionUpdate).ok()).toBe(true);

  await expect(controls.memoryToggle()).toBeEnabled();
  const memoryUpdate = page.waitForResponse(
    (response) =>
      response.request().method() === "PATCH" && response.url().endsWith(`/api/chats/${chat.id}/metadata`),
  );
  await controls.memoryToggle().click();
  expect((await memoryUpdate).ok()).toBe(true);

  const persisted = await readConversationSummaryMetadata(page.request, chat.id);
  expect(persisted.conversationSummaryConnectionId).toBe(summaryConnection.id);
  expect(persisted.includeConversationSummaryMemoriesInPrompt).toBe(false);
  await attachConversationSummaryEvidence("ui-persisted-metadata", persisted);

  await page.reload();
  await controls.openControls();
  await expect(controls.summaryConnection()).toHaveValue(summaryConnection.id);
  await expect(controls.memoryToggle()).toHaveAttribute("aria-pressed", "false");
  await test.info().attach("conversation-summary-controls.png", {
    body: await page.screenshot(),
    contentType: "image/png",
  });
});

test("[api] uses the selected summary connection and excludes only summary memories from prompts", async ({ page }) => {
  test.info().annotations.push({
    type: "evidence",
    description:
      "Manual backfill uses the dedicated summary model; prompt exclusion removes key details while preserving summary prose.",
  });
  const { chat, summaryConnection } = await seedConversationSummaryControlsScenario(page.request);
  await patchConversationSummarySettings(page.request, chat.id, {
    conversationSummaryConnectionId: summaryConnection.id,
  });

  const backfill = await backfillConversationSummaries(page.request, chat.id);
  expect(backfill.generatedDays).toHaveLength(1);
  await expectFakeProviderEvidence("cr017 summary model=e2e-cr017-summary-model");

  const afterBackfill = await readConversationSummaryMetadata(page.request, chat.id);
  const storedDays = Object.values(afterBackfill.daySummaries ?? {});
  expect(storedDays).toHaveLength(1);
  expect(storedDays[0]).toEqual({
    summary: "CR017 SUMMARY PROSE MARKER",
    keyDetails: ["CR017 SUMMARY MEMORY MARKER"],
  });
  await attachConversationSummaryEvidence("stored-day-summary", afterBackfill.daySummaries);

  await runConversationSummaryProbe(page.request, chat.id, "include");
  await expectFakeProviderEvidence(
    "cr017 probe=include model=e2e-cr017-chat-model summary=true memory=true",
  );

  await patchConversationSummarySettings(page.request, chat.id, {
    includeConversationSummaryMemoriesInPrompt: false,
  });
  await runConversationSummaryProbe(page.request, chat.id, "exclude");
  await expectFakeProviderEvidence(
    "cr017 probe=exclude model=e2e-cr017-chat-model summary=true memory=false",
  );

  const afterExclusion = await readConversationSummaryMetadata(page.request, chat.id);
  expect(afterExclusion.daySummaries).toEqual(afterBackfill.daySummaries);
  await attachConversationSummaryEvidence("metadata-after-exclusion", afterExclusion);
});
