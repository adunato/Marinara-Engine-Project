import { test, expect } from "../../../fixtures/app";
import {
  CR032_BRIEFING_MARKER,
  CR032_CURATOR_PROMPT,
  CR032_LATEST_USER_MARKER,
  CR032_RAW_SOURCE_MARKER,
  CR032_WRITER_PROMPT,
  attachTwoPassEvidence,
  configureTwoPassConversation,
  expectCr032ProviderEvidence,
  readChatMetadata,
  readLatestAssistantEvidence,
  runTwoPassGeneration,
  seedTwoPassConversationScenario,
} from "../../../macros/cr032-two-pass-conversation";
import { ConversationTwoPassPage } from "../../../pages/conversation-two-pass.page";

function promptText(value: unknown): string {
  if (!Array.isArray(value)) return "";
  return value
    .map((message) =>
      message && typeof message === "object" && "content" in message ? String(message.content ?? "") : "",
    )
    .join("\n");
}

test("[ui] exposes and persists the two-pass Conversation controls", async ({ page }) => {
  test.info().annotations.push({
    type: "evidence",
    description:
      "Conversation General Settings expose the pipeline selector and required curator/writer controls, and preserve the selected curator connection across reload.",
  });
  const { chat, curatorConnection } = await seedTwoPassConversationScenario(page.request);
  const controls = new ConversationTwoPassPage(page);

  await controls.openChat(chat.id);
  await controls.openTwoPassControls();
  await expect(controls.pipelineSelect()).toHaveValue("standard");

  const pipelineUpdate = page.waitForResponse(
    (response) =>
      response.request().method() === "PATCH" && response.url().endsWith(`/api/chats/${chat.id}/metadata`),
  );
  await controls.pipelineSelect().selectOption("two_pass");
  expect((await pipelineUpdate).ok()).toBe(true);

  await expect(controls.curatorConnection()).toBeVisible();
  await expect(controls.curatorMaxTokens()).toBeVisible();
  await expect(controls.briefingPromptButton()).toBeVisible();
  await expect(controls.writerPromptButton()).toBeVisible();
  await expect(controls.readyStatus()).toBeVisible();

  const connectionUpdate = page.waitForResponse(
    (response) =>
      response.request().method() === "PATCH" && response.url().endsWith(`/api/chats/${chat.id}/metadata`),
  );
  await controls.curatorConnection().selectOption(curatorConnection.id);
  expect((await connectionUpdate).ok()).toBe(true);

  const persisted = await readChatMetadata(page.request, chat.id);
  expect(persisted.conversationGenerationPipeline).toBe("two_pass");
  expect(persisted.conversationCuratorConnectionId).toBe(curatorConnection.id);
  await attachTwoPassEvidence("ui-persisted-metadata", persisted);

  await page.reload();
  await controls.openTwoPassControls();
  await expect(controls.pipelineSelect()).toHaveValue("two_pass");
  await expect(controls.curatorConnection()).toHaveValue(curatorConnection.id);
  await test.info().attach("conversation-two-pass-controls.png", {
    body: await page.screenshot(),
    contentType: "image/png",
  });
});

test("[api] curates the resolved source and isolates the writer from raw context", async ({ page }) => {
  test.info().annotations.push({
    type: "evidence",
    description:
      "The curator receives the resolved character and latest-message source, while the writer receives only its own prompt and the generated briefing.",
  });
  const { chat, writerConnection, curatorConnection } = await seedTwoPassConversationScenario(page.request);
  await configureTwoPassConversation(page.request, chat.id, curatorConnection.id);

  await runTwoPassGeneration(page.request, chat.id);
  const { assistant, diagnostics, generationInfo } = await readLatestAssistantEvidence(page.request, chat.id);
  const curatorInput = promptText(diagnostics.curatorInput);
  const writerInput = promptText(diagnostics.writerInput);

  expect(assistant.content).toBe("CR032 writer response.");
  expect(diagnostics.briefing).toContain(CR032_BRIEFING_MARKER);
  expect(curatorInput).toContain(CR032_CURATOR_PROMPT);
  expect(curatorInput).toContain(CR032_RAW_SOURCE_MARKER);
  expect(curatorInput).toContain(CR032_LATEST_USER_MARKER);
  expect(curatorInput).not.toContain(CR032_WRITER_PROMPT);

  expect(writerInput).toContain(CR032_WRITER_PROMPT);
  expect(writerInput).toContain(CR032_BRIEFING_MARKER);
  expect(writerInput).not.toContain(CR032_CURATOR_PROMPT);
  expect(writerInput).not.toContain(CR032_RAW_SOURCE_MARKER);
  expect(writerInput).not.toContain(CR032_LATEST_USER_MARKER);
  expect(generationInfo.conversationPipeline).toBe("two_pass");
  expect(generationInfo.model).toBe(writerConnection.model);
  expect((generationInfo.curator as { model?: string } | undefined)?.model).toBe(curatorConnection.model);

  await expectCr032ProviderEvidence(
    "cr032 stage=curator model=e2e-cr032-curator-model raw-source=true latest-message=true writer-prompt=false",
  );
  await expectCr032ProviderEvidence(
    "cr032 stage=writer model=e2e-cr032-writer-model briefing=true raw-source=false latest-message=false curator-prompt=false",
  );
});
