import { test, expect } from "../../../fixtures/app";
import {
  CR045_EMOTION_LABEL,
  CR045_EMOTION_STATE_ID,
  CR045_MAPPED_EXPRESSION,
  expectCr045ProviderEvidence,
  runCr045Generation,
  seedCr045Scenario,
} from "../../../macros/cr045-character-emotions";

test("[api] persists CR035 emotion state and its mapped native expression", async ({ page }) => {
  test.info().annotations.push({
    type: "evidence",
    description:
      "A configured CR035 emotion state returned by the Expression Engine is persisted with its mapped native expression on the generated message.",
  });
  const { character, chat } = await seedCr045Scenario(page.request, { enabled: true });
  const { extra } = await runCr045Generation(page.request, chat.id, "mapped");

  expect(extra.characterEmotions).toMatchObject({ [character.id]: CR045_EMOTION_STATE_ID });
  expect(extra.spriteExpressions).toMatchObject({ [character.id]: CR045_MAPPED_EXPRESSION });
  expect(extra.generationCharacterEmotions).toMatchObject({
    [character.id]: { stateId: CR045_EMOTION_STATE_ID, label: CR045_EMOTION_LABEL },
  });
  await expectCr045ProviderEvidence(`cr045 expression mode=mapped character=${character.id}`);
});
test("[ui] displays CR041's immutable generated emotion label", async ({ page, app }) => {
  test.info().annotations.push({
    type: "evidence",
    description:
      "The roleplay message UI displays the generation-time CR041 emotion label from the persisted message snapshot.",
  });
  const { chat } = await seedCr045Scenario(page.request, { enabled: true });
  await runCr045Generation(page.request, chat.id, "mapped");

  await page.addInitScript((id) => window.localStorage.setItem("marinara-active-chat-id", id), chat.id);
  await page.reload();
  await app.waitForReady();
  const label = page.locator(".mari-message-generation-emotion");
  await expect(label).toContainText(CR045_EMOTION_LABEL);
  await test.info().attach("cr045-generation-emotion-label.png", {
    body: await page.screenshot(),
    contentType: "image/png",
  });
  await expectCr045ProviderEvidence(`cr045 expression mode=mapped character=`);
});

test("[api] retains native expression selection when the emotion profile is disabled", async ({ page }) => {
  test.info().annotations.push({
    type: "evidence",
    description:
      "With the CR035 profile disabled, native Expression Engine sprite selection still persists while no custom emotion state is recorded.",
  });
  const { character, chat } = await seedCr045Scenario(page.request, { enabled: false });
  const { extra } = await runCr045Generation(page.request, chat.id, "native-fallback");

  expect(extra.spriteExpressions).toMatchObject({ [character.id]: CR045_MAPPED_EXPRESSION });
  expect(extra.characterEmotions ?? null).toBeNull();
  expect(extra.generationCharacterEmotions ?? null).toBeNull();
  await expectCr045ProviderEvidence(`cr045 expression mode=native-fallback character=${character.id}`);
});
