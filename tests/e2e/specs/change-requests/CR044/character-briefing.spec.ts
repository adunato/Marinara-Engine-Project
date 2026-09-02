import { test, expect } from "../../../fixtures/app";
import {
  CR044_ALPHA_BRIEFING,
  CR044_BETA_BRIEFING,
  createCr044CharacterAndOpenBriefing,
  createCr044Conversation,
  expectCr044ProviderEvidence,
  fillAndSaveCr044UiBriefing,
  generateCr044Briefing,
  generateCr044UiBriefing,
  readCr044Briefing,
  runCr044TargetedConversationGeneration,
  saveCr044Briefing,
  seedCr044Character,
  seedCr044Connection,
} from "../../../macros/cr044-character-briefing";

test("[api] returns and persists a zero-slot briefing without a provider", async ({ page }) => {
  test.info().annotations.push({
    type: "evidence",
    description: "A source template with no instruction slots publishes unchanged as the latest briefing without a generation connection.",
  });
  const character = await seedCr044Character(page.request, "CR044 Zero Slot");
  const sourceTemplate = "Static CR044 briefing text with no dynamic instructions.";

  await saveCr044Briefing(page.request, character.id, sourceTemplate);
  const generated = await generateCr044Briefing(page.request, character.id);
  const persisted = await readCr044Briefing(page.request, character.id);

  expect(generated.sourceTemplate).toBe(sourceTemplate);
  expect(generated.generationConnectionId).toBeNull();
  expect(generated.latestBriefing).toBe(sourceTemplate);
  expect(persisted).toMatchObject({
    characterId: character.id,
    sourceTemplate,
    generationConnectionId: null,
    latestBriefing: sourceTemplate,
  });
});

test("[api] generates valid terminal JSON and preserves the source snapshot", async ({ page }) => {
  test.info().annotations.push({
    type: "evidence",
    description: "The Character Briefing agent receives one slot and returns a terminal JSON replacement that is atomically published beside the unchanged source template.",
  });
  const connection = await seedCr044Connection(page.request);
  const character = await seedCr044Character(page.request, "CR044 Slot Character");
  const sourceTemplate = "Before [[Write the concise briefing section.]] After";

  await saveCr044Briefing(page.request, character.id, sourceTemplate, connection.id);
  const generated = await generateCr044Briefing(page.request, character.id);
  const persisted = await readCr044Briefing(page.request, character.id);

  expect(generated.sourceTemplate).toBe(sourceTemplate);
  expect(generated.latestBriefing).toContain("CR044 GENERATED BRIEFING");
  expect(generated.latestBriefing).not.toContain("[[");
  expect(persisted).toMatchObject({
    characterId: character.id,
    sourceTemplate,
    latestBriefing: generated.latestBriefing,
  });
  await expectCr044ProviderEvidence("cr044 briefing owner=unknown terminal-json=true");
});

test("[api] injects only the responding character briefing into Conversation generation", async ({ page }) => {
  test.info().annotations.push({
    type: "evidence",
    description: "A targeted Conversation response includes the responding character's briefing and excludes the non-target character's briefing, as proven by fake-provider request evidence.",
  });
  const connection = await seedCr044Connection(page.request, "e2e-cr044-conversation-model");
  const alpha = await seedCr044Character(page.request, "Alpha");
  const beta = await seedCr044Character(page.request, "Beta");
  await saveCr044Briefing(page.request, alpha.id, "Alpha [[Write Alpha's briefing.]]", connection.id);
  await saveCr044Briefing(page.request, beta.id, "Beta [[Write Beta's briefing.]]", connection.id);
  await generateCr044Briefing(page.request, alpha.id);
  await generateCr044Briefing(page.request, beta.id);
  const chat = await createCr044Conversation(page.request, [alpha.id, beta.id], connection.id);

  await runCr044TargetedConversationGeneration(page.request, chat.id, beta.id);
  await expectCr044ProviderEvidence("cr044 conversation alpha-briefing=false beta-briefing=true");
});

test("[ui] saves, generates, and displays the latest Character Briefing", async ({ page, app }) => {
  test.info().annotations.push({
    type: "evidence",
    description: "The Character Editor's Briefing tab saves the source template, runs generation, and visibly renders the persisted latest briefing.",
  });
  await seedCr044Connection(page.request, "e2e-cr044-ui-model");
  await app.dismissOnboarding();
  await app.openRightPanel("Characters");
  await createCr044CharacterAndOpenBriefing(page, `CR044 UI ${Date.now()}`);
  await fillAndSaveCr044UiBriefing(page, "UI source [[Write the UI briefing.]]");
  await generateCr044UiBriefing(page);
});
