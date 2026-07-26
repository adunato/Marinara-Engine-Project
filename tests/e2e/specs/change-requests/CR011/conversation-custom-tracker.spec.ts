import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { test, expect } from "../../../fixtures/app";
import {
  attachTrackerEvidence,
  enableConversationCustomTracker,
  readTrackerFieldLocks,
  readTrackerFields,
  runConversationTrackerGeneration,
  seedConversationTrackerScenario,
  seedLockedTrackerFields,
} from "../../../macros/cr011-conversation-custom-tracker";
import { ConversationCustomTrackerPage } from "../../../pages/conversation-custom-tracker.page";

test("[ui] adds Custom Tracker to Conversation and persists multiple editable fields", async ({ page }) => {
  const { chat } = await seedConversationTrackerScenario(page.request);
  const trackerPage = new ConversationCustomTrackerPage(page);

  await trackerPage.openChat(chat.id);
  await trackerPage.addCustomTrackerToChat();
  await trackerPage.openTrackerPanel();
  await trackerPage.addAndEditTwoFields();

  await expect
    .poll(async () => readTrackerFields(page.request, chat.id))
    .toEqual([
      { name: "Trust", value: "Medium" },
      { name: "Promise", value: "Kept" },
    ]);
  await attachTrackerEvidence("ui-multiple-fields", await readTrackerFields(page.request, chat.id));
  await test.info().attach("conversation-custom-tracker-desktop.png", {
    body: await page.screenshot(),
    contentType: "image/png",
  });

  await trackerPage.closeTrackerPanel();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await trackerPage.ensureTrackerToolbarButtonVisible();
  await trackerPage.openTrackerPanel();
  await expect(trackerPage.panel().getByRole("button", { name: "Trust", exact: true })).toBeVisible();
  await expect(trackerPage.panel().getByRole("button", { name: "Promise", exact: true })).toBeVisible();
  await test.info().attach("conversation-custom-tracker-mobile.png", {
    body: await page.screenshot(),
    contentType: "image/png",
  });

  await trackerPage.removePromiseField();
  await expect.poll(async () => readTrackerFields(page.request, chat.id)).toEqual([{ name: "Trust", value: "Medium" }]);
});

test("[api] updates unlocked fields, preserves locked fields, and injects committed state", async ({ page }) => {
  const { chat } = await seedConversationTrackerScenario(page.request);
  await enableConversationCustomTracker(page.request, chat.id);
  await seedLockedTrackerFields(page.request, chat.id);

  await runConversationTrackerGeneration(
    page.request,
    chat.id,
    "Increase trust but keep the locked promise unchanged.",
  );
  await expect.poll(async () => readTrackerFields(page.request, chat.id)).toEqual([
    { name: "Trust", value: "High" },
    { name: "Promise", value: "Kept" },
  ]);
  expect(await readTrackerFieldLocks(page.request, chat.id)).toEqual({ "player.custom.name:Promise.value": true });

  await runConversationTrackerGeneration(page.request, chat.id, "Use the committed tracker state on this next turn.");
  await expect
    .poll(async () => readFile(join(process.cwd(), "test-results", "e2e", "logs", "fake-openai.log"), "utf8"))
    .toContain("custom tracker committed fields present=true");
  await attachTrackerEvidence("locked-field-result", await readTrackerFields(page.request, chat.id));

  const disableResponse = await page.request.patch(`/api/chats/${chat.id}/metadata`, {
    data: { enableAgents: false, activeAgentIds: [] },
  });
  await expect(disableResponse).toBeOK();
  const resetResponse = await page.request.patch(`/api/chats/${chat.id}/game-state`, {
    data: {
      manual: true,
      fieldLocks: { "player.custom.name:Promise.value": true },
      playerStats: {
        customTrackerFields: [
          { name: "Trust", value: "Low" },
          { name: "Promise", value: "Kept" },
        ],
      },
    },
  });
  await expect(resetResponse).toBeOK();
  await runConversationTrackerGeneration(page.request, chat.id, "Tracker is disabled now.");
  expect(await readTrackerFields(page.request, chat.id)).toEqual([
    { name: "Trust", value: "Low" },
    { name: "Promise", value: "Kept" },
  ]);
});
