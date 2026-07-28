import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { test, expect } from "../../../fixtures/app";
import {
  CR016_AREA_KEYS,
  attachDailyIntentionsEvidence,
  configureDailyIntentions,
  readDailyIntentions,
  runAllDailyIntentions,
  runConversationWithDailyIntentions,
  seedDailyIntentionsScenario,
  seedPriorDailyIntentions,
} from "../../../macros/cr016-daily-intentions";
import { DailyIntentionsPage } from "../../../pages/daily-intentions.page";

const fakeProviderLog = join(process.cwd(), "test-results", "e2e", "logs", "fake-openai.log");

test("[api] runs fixed areas independently, preserves failures, and injects only current enabled intentions", async ({
  page,
}) => {
  test.info().annotations.push({
    type: "evidence",
    description:
      "Run All uses fixed order and clean context, persists successes immediately, preserves a failed value, skips disabled areas, and injects current enabled values.",
  });
  const { chat, connection } = await seedDailyIntentionsScenario(page.request);
  const configured = await configureDailyIntentions(page.request, chat.id, connection.id, {
    failFriendships: true,
    disableRomance: true,
  });
  expect(configured.settings.cutoffHour).toBe(7);
  expect(configured.settings.areas.map((area) => area.key)).toEqual(CR016_AREA_KEYS);
  expect(configured.settings.areas.map((area) => area.heading)).toEqual([
    "The Proposal",
    "My People",
    "Romantic Life",
    "Intimacy",
  ]);
  await seedPriorDailyIntentions(page.request, chat.id);

  const events = await runAllDailyIntentions(page.request, chat.id);
  expect(events.map((event) => `${event.type}:${event.key ?? ""}`)).toEqual([
    "area_started:work_study",
    "area_succeeded:work_study",
    "area_started:friendships",
    "area_failed:friendships",
    "area_started:sex",
    "area_succeeded:sex",
    "done:",
  ]);

  const persisted = await readDailyIntentions(page.request, chat.id);
  expect(persisted.outputs.work_study?.content).toContain("I will turn the unfinished proposal");
  expect(persisted.outputs.friendships?.content).toBe(
    "CR016 prior intention must be excluded (friendships).",
  );
  expect(persisted.outputs.romance?.content).toBe("CR016 prior intention must be excluded (romance).");
  expect(persisted.outputs.sex?.content).toContain("I will stay attentive to my own boundaries");
  await attachDailyIntentionsEvidence("persisted-current-values", persisted);

  await expect
    .poll(async () => readFile(fakeProviderLog, "utf8"))
    .toContain("daily intention context marker=true prior intention=false earlier area=false");

  await runConversationWithDailyIntentions(page.request, chat.id);
  await expect.poll(async () => readFile(fakeProviderLog, "utf8")).toContain("daily intentions injected=true");
});

test("[api] blocks multi-character generation without deleting configuration or current output", async ({ page }) => {
  test.info().annotations.push({
    type: "evidence",
    description:
      "Adding a second character makes the runtime ineligible while preserving per-Conversation settings and output.",
  });
  const { chat, character, connection } = await seedDailyIntentionsScenario(page.request);
  await configureDailyIntentions(page.request, chat.id, connection.id);
  const prior = await seedPriorDailyIntentions(page.request, chat.id);

  const secondCharacterResponse = await page.request.post("/api/characters", {
    data: { data: { name: "Rowan", description: "A second adult character.", first_mes: "Hello." } },
  });
  await expect(secondCharacterResponse).toBeOK();
  const secondCharacter = await secondCharacterResponse.json();
  const updateChatResponse = await page.request.patch(`/api/chats/${chat.id}`, {
    data: { characterIds: [character.id, secondCharacter.id] },
  });
  await expect(updateChatResponse).toBeOK();

  const ineligible = await readDailyIntentions(page.request, chat.id);
  expect(ineligible.eligible).toBe(false);
  expect(ineligible.eligibilityError).toContain("exactly one character");
  expect(ineligible.settings).toEqual(prior.settings);
  expect(ineligible.outputs).toEqual(prior.outputs);
  const runResponse = await page.request.post(`/api/chats/${chat.id}/daily-intentions/generate/work_study`);
  expect(runResponse.status()).toBe(409);
  await attachDailyIntentionsEvidence("multi-character-ineligible-state", ineligible);
});

test("[ui] configures, runs, and manually edits current Daily Intentions", async ({ page }) => {
  test.info().annotations.push({
    type: "evidence",
    description:
      "Conversation settings expose fixed area configuration and a current-only editor with manual Run All and direct save controls.",
  });
  const { chat, connection } = await seedDailyIntentionsScenario(page.request);
  const dailyIntentions = new DailyIntentionsPage(page);
  await dailyIntentions.openChat(chat.id);
  await dailyIntentions.openConfiguration();

  const config = dailyIntentions.configuration();
  await expect(config.getByLabel("Daily Intentions cutoff time")).toHaveValue("4");
  await config.getByLabel("Daily Intentions generation connection").selectOption(connection.id);
  await config.getByLabel("Daily Intentions cutoff time").selectOption("8");
  await config.getByLabel("Work or Study intention heading").fill("Creative Work");
  await config.getByLabel("Work or Study intention prompt").fill("CR016 work prompt");
  await config.getByLabel("Friendships intention prompt").fill("CR016 friendships prompt");
  await config.getByLabel("Romance intention prompt").fill("CR016 romance prompt");
  await config.getByLabel("Sex intention prompt").fill("CR016 sex prompt");
  await config.getByLabel("Enable Romance intentions").uncheck();
  const settingsResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "PUT" && response.url().endsWith(`/chats/${chat.id}/daily-intentions/settings`),
  );
  await config.getByRole("button", { name: "Save settings" }).click();
  expect((await settingsResponse).ok()).toBe(true);

  await dailyIntentions.openEditor();
  const editor = dailyIntentions.editor();
  await expect(editor.getByTestId("daily-intentions-output-work_study")).toContainText("Creative Work");
  await expect(editor.getByTestId("daily-intentions-output-romance")).toHaveCount(0);
  await editor.getByTestId("run-all-daily-intentions").click();
  await expect(editor.getByLabel("Creative Work current intention")).toContainText(
    "I will turn the unfinished proposal",
  );
  await expect(editor.getByLabel("Friendships current intention")).toContainText("I want to check in with Rowan");
  await expect(editor.getByLabel("Sex current intention")).toContainText("I will stay attentive to my own boundaries");

  await editor.getByLabel("Creative Work current intention").fill(
    "I will finish the proposal before lunch, then decide what deserves my attention next.",
  );
  const outputResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "PUT" && response.url().endsWith(`/chats/${chat.id}/daily-intentions/outputs`),
  );
  await editor.getByRole("button", { name: "Save edits" }).click();
  expect((await outputResponse).ok()).toBe(true);
  await expect(editor.getByRole("button", { name: "Save edits" })).toBeDisabled();

  const persisted = await readDailyIntentions(page.request, chat.id);
  expect(persisted.settings.cutoffHour).toBe(8);
  expect(persisted.outputs.work_study?.content).toBe(
    "I will finish the proposal before lunch, then decide what deserves my attention next.",
  );
  await test.info().attach("daily-intentions-editor.png", {
    body: await page.screenshot(),
    contentType: "image/png",
  });
  await attachDailyIntentionsEvidence("ui-saved-current-values", persisted);
});
