import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { test, expect } from "../../../fixtures/app";
import { ChatSummaryPage } from "../../../pages/chat-summary.page";
import {
  createBuiltInSummaryAgent,
  createChat,
  createCustomAgent,
  createStaticCustomTool,
  documentedMemoryKeeperPrompt,
  enableChatAgentsAndTools,
  eventsByType,
  expectChatSummary,
  getChatSummary,
  runGenerationAndCaptureEvents,
  seedConnection,
  seedMessage,
} from "../../../macros/cr004-memory-agent";

test("[api] creates a documented custom memory agent with summary tools and updates persisted summary", async ({
  page,
}) => {
  const connection = await seedConnection(page.request);
  const chat = await createChat(page.request, {
    connectionId: connection.id,
    summary: "Existing durable memory.",
  });
  const agent = await createCustomAgent(page.request, {
    promptTemplate: documentedMemoryKeeperPrompt,
    enabledTools: ["read_chat_summary", "append_chat_summary"],
  });
  await enableChatAgentsAndTools(page.request, chat.id, { activeAgentIds: [agent.type] });

  const events = await runGenerationAndCaptureEvents(page.request, chat.id, {
    userMessage: "Remember that the captain prefers tea.",
  });

  await expectEventCount(events, "metadata_patch", 1, "Assert summary tool emitted one metadata_patch event");
  await expectChatSummary(page.request, chat.id, "Existing durable memory.\n\nE2E durable memory update");
});

test("[api] runs a custom memory agent only after its cadence threshold is met", async ({ page }) => {
  const connection = await seedConnection(page.request);
  const chat = await createChat(page.request, {
    connectionId: connection.id,
    summary: "Cadence baseline.",
  });
  const agent = await createCustomAgent(page.request, { runInterval: 3 });
  await enableChatAgentsAndTools(page.request, chat.id, { activeAgentIds: [agent.type] });

  await runGenerationAndCaptureEvents(page.request, chat.id, { userMessage: "First memory-worthy detail." });
  await expectChatSummary(page.request, chat.id, "Cadence baseline.\n\nE2E durable memory update");

  const blockedEvents = await runGenerationAndCaptureEvents(page.request, chat.id, {
    userMessage: "Second memory-worthy detail.",
  });
  await expectEventCount(blockedEvents, "metadata_patch", 0, "Assert cadence blocked metadata_patch events before threshold");
  await expectChatSummary(page.request, chat.id, "Cadence baseline.\n\nE2E durable memory update");

  await seedMessage(page.request, chat.id, "user", "Third memory-worthy detail.");
  const allowedEvents = await runGenerationAndCaptureEvents(page.request, chat.id, {
    userMessage: "Fourth memory-worthy detail.",
  });
  await expectEventCount(allowedEvents, "metadata_patch", 1, "Assert cadence allowed one metadata_patch event at threshold");
  await expectChatSummary(
    page.request,
    chat.id,
    "Cadence baseline.\n\nE2E durable memory update\n\nE2E durable memory update",
  );

  await expectServerLogContains("cadence threshold", "Assert server log records cadence threshold skip");
});

test("[ui] refreshes the summary UI when a custom memory agent updates metadata", async ({ page }) => {
  const connection = await seedConnection(page.request);
  const chat = await createChat(page.request, {
    connectionId: connection.id,
    summary: "Visible baseline.",
  });
  const agent = await createCustomAgent(page.request);
  await enableChatAgentsAndTools(page.request, chat.id, { activeAgentIds: [agent.type] });

  const summaryPage = new ChatSummaryPage(page);
  await summaryPage.openChat(chat.id);
  await summaryPage.openSummaryPopover();
  await summaryPage.expectSummaryVisible("Visible baseline.");

  await test.step("Send chat message from UI", async () => {
    await page.keyboard.press("Escape");
    await page.locator(".mari-chat-input-textarea").fill("A UI-visible memory update.");
    await page.locator(".mari-chat-send-btn").click();
  });

  await test.step("Wait for metadata summary update", async () => {
    await expect
      .poll(async () => getChatSummary(page.request, chat.id))
      .toBe("Visible baseline.\n\nE2E durable memory update");
  });
  await summaryPage.openSummaryPopover();
  await summaryPage.expectSummaryVisible("E2E durable memory update");
});

test("[api] executes tools for a normal custom agent without regressing agent tool behavior", async ({ page }) => {
  const connection = await seedConnection(page.request);
  const chat = await createChat(page.request, { connectionId: connection.id, summary: "Agent tool baseline." });
  await createStaticCustomTool(page.request);
  const agent = await createCustomAgent(page.request, {
    type: `e2e-tool-agent-${Date.now()}`,
    name: `E2E Tool Agent ${Date.now()}`,
    enabledTools: ["e2e_static_tool"],
    promptTemplate: "You are a custom tool validation agent. Call the custom tool when asked.",
  });
  await enableChatAgentsAndTools(page.request, chat.id, {
    activeAgentIds: [agent.type],
    activeToolIds: ["e2e_static_tool"],
  });

  const events = await runGenerationAndCaptureEvents(page.request, chat.id, {
    userMessage: "Please trigger the custom tool from the agent.",
  });

  await test.step(`Assert agent_result evidence includes custom agent id: ${agent.type}`, async () => {
    const agentResults = eventsByType(events, "agent_result");
    await attachJson("agent-results.json", agentResults);
    test.info().annotations.push({
      type: "evidence",
      description: `Expected at least one agent_result event containing ${agent.type}`,
    });
    expect(agentResults.some((event) => JSON.stringify(event.data).includes(agent.type))).toBe(true);
  });
  await expectServerLogContains(
    "e2e_static_tool completed",
    "Assert server log records custom agent static tool execution",
  );
  await expectChatSummary(page.request, chat.id, "Agent tool baseline.");
});

test("[api] keeps the existing built-in chat summary agent working", async ({ page }) => {
  const connection = await seedConnection(page.request);
  const chat = await createChat(page.request, {
    connectionId: connection.id,
    summary: "Built-in baseline.",
  });
  await createBuiltInSummaryAgent(page.request, { runInterval: 1 });
  await enableChatAgentsAndTools(page.request, chat.id, {
    activeAgentIds: ["chat-summary"],
    enableTools: false,
    activeToolIds: [],
  });

  const events = await runGenerationAndCaptureEvents(page.request, chat.id, {
    userMessage: "Summarize this durable built-in summary detail.",
  });

  await expectEventCount(events, "chat_summary", 1, "Assert built-in summary agent emitted one chat_summary event");
  await expectChatSummary(page.request, chat.id, "Built-in baseline.\n\nE2E built-in summary update");
});

test("[api] has no side effects when custom memory-agent configuration is disabled for the chat", async ({ page }) => {
  const connection = await seedConnection(page.request);
  const chat = await createChat(page.request, {
    connectionId: connection.id,
    summary: "Inactive agent baseline.",
  });
  const agent = await createCustomAgent(page.request);
  await enableChatAgentsAndTools(page.request, chat.id, {
    activeAgentIds: [agent.type],
    enableAgents: false,
  });

  const events = await runGenerationAndCaptureEvents(page.request, chat.id);

  await expectEventCount(events, "metadata_patch", 0, "Assert disabled chat agents emitted no metadata_patch events");
  await expectChatSummary(page.request, chat.id, "Inactive agent baseline.");
});

test("[api] still generates a chat response when the custom memory agent is disabled", async ({ page }) => {
  const connection = await seedConnection(page.request);
  const chat = await createChat(page.request, {
    connectionId: connection.id,
    summary: "Disabled generation baseline.",
  });
  const agent = await createCustomAgent(page.request);
  await enableChatAgentsAndTools(page.request, chat.id, {
    activeAgentIds: [agent.type],
    enableAgents: false,
  });

  const events = await runGenerationAndCaptureEvents(page.request, chat.id, {
    userMessage: "Generation should still work.",
  });

  await test.step("Assert generation token stream contains normal assistant response", async () => {
    const tokenText = eventsByType(events, "token")
      .map((event) => event.data)
      .join("");
    await attachJson("token-stream.json", { expected: "E2E assistant response.", actual: tokenText });
    test.info().annotations.push({
      type: "evidence",
      description: "Expected token stream to contain the deterministic fake provider assistant response",
    });
    expect(tokenText).toContain("E2E assistant response.");
  });
  await expectChatSummary(page.request, chat.id, "Disabled generation baseline.");
});

test("[api] persists a summary update to chat metadata", async ({ page }) => {
  const connection = await seedConnection(page.request);
  const chat = await createChat(page.request, { connectionId: connection.id, summary: null });
  const agent = await createCustomAgent(page.request);
  await enableChatAgentsAndTools(page.request, chat.id, { activeAgentIds: [agent.type] });

  await runGenerationAndCaptureEvents(page.request, chat.id, {
    userMessage: "Persist this memory into chat metadata.",
  });

  await expectChatSummary(page.request, chat.id, "E2E durable memory update");
});

test("[api] executes unrelated custom tools during normal generation", async ({ page }) => {
  const connection = await seedConnection(page.request);
  const chat = await createChat(page.request, { connectionId: connection.id, summary: null });
  await createStaticCustomTool(page.request);
  await enableChatAgentsAndTools(page.request, chat.id, {
    activeAgentIds: [],
    enableAgents: false,
    enableTools: true,
    activeToolIds: ["e2e_static_tool"],
  });

  const events = await runGenerationAndCaptureEvents(page.request, chat.id, {
    userMessage: "Please call the custom tool.",
    enableTools: true,
  });

  const toolResults = eventsByType(events, "tool_result");
  await test.step("Assert generation returned exactly one tool_result event", async () => {
    await attachJson("tool-results.json", toolResults);
    test.info().annotations.push({
      type: "evidence",
      description: "Expected one tool_result event from the unrelated static custom tool",
    });
    expect(toolResults).toHaveLength(1);
  });
  await test.step("Assert tool_result contains static custom tool output: E2E static tool result", async () => {
    await attachJson("tool-result-payload.json", toolResults[0]!.data);
    test.info().annotations.push({
      type: "evidence",
      description: "Expected tool_result payload to contain E2E static tool result",
    });
    expect(JSON.stringify(toolResults[0]!.data)).toContain("E2E static tool result");
  });
});

async function expectEventCount(events: ReturnType<typeof eventsByType>, type: string, count: number, stepName: string) {
  await test.step(stepName, async () => {
    const matchingEvents = eventsByType(events, type);
    await attachJson(`${slugify(stepName)}.json`, {
      eventType: type,
      expectedCount: count,
      actualCount: matchingEvents.length,
      events: matchingEvents,
    });
    test.info().annotations.push({
      type: "evidence",
      description: `${stepName}; expected ${count} ${type} event(s), observed ${matchingEvents.length}`,
    });
    expect(matchingEvents).toHaveLength(count);
  });
}

async function expectServerLogContains(expectedText: string, stepName: string) {
  await test.step(`${stepName}: ${expectedText}`, async () => {
    await expect
      .poll(async () => readFile(join(process.cwd(), "test-results", "e2e", "logs", "server.log"), "utf8"))
      .toContain(expectedText);
    const serverLog = await readFile(join(process.cwd(), "test-results", "e2e", "logs", "server.log"), "utf8");
    const matchingLines = serverLog
      .split(/\r?\n/)
      .filter((line) => line.includes(expectedText))
      .slice(-20);
    await attachJson(`${slugify(stepName)}.json`, { expectedText, matchingLines });
    test.info().annotations.push({
      type: "evidence",
      description: `${stepName}; expected server.log to contain "${expectedText}"`,
    });
  });
}

async function attachJson(name: string, value: unknown) {
  await test.info().attach(name, {
    body: JSON.stringify(value, null, 2),
    contentType: "application/json",
  });
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}
