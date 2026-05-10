import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test, type APIRequestContext } from "@playwright/test";
import {
  createChat,
  createCustomAgent,
  enableChatAgentsAndTools,
  eventsByType,
  runGenerationAndCaptureEvents,
  seedConnection,
  type SseEvent,
} from "./cr004-memory-agent";

export const agentMemoryToolIds = [
  "save_agent_memory",
  "search_agent_memory",
  "list_agent_memory",
  "delete_agent_memory",
];

export async function seedAgentMemoryScenario(request: APIRequestContext) {
  return test.step("Seed CR009 custom agent memory scenario", async () => {
    const connection = await seedConnection(request, `E2E CR009 Provider ${Date.now()}`);
    const chat = await createChat(request, {
      connectionId: connection.id,
      name: `E2E CR009 Agent Memory ${Date.now()}`,
      summary: null,
    });
    const agent = await createCustomAgent(request, {
      type: `e2e-cr009-agent-memory-${Date.now()}`,
      name: `E2E CR009 Agent Memory ${Date.now()}`,
      enabledTools: agentMemoryToolIds,
      promptTemplate:
        "You are the CR009 agent memory validation agent. Follow the user's CR009 instruction and call the matching agent memory tool.",
    });
    await enableChatAgentsAndTools(request, chat.id, {
      activeAgentIds: [agent.type],
      activeToolIds: agentMemoryToolIds,
    });
    return { connection, chat, agent };
  });
}

export async function runCr009AgentMemoryGeneration(
  request: APIRequestContext,
  chatId: string,
  userMessage: string,
) {
  return runGenerationAndCaptureEvents(request, chatId, { userMessage, enableTools: true });
}

export async function attachAgentResultEvidence(events: SseEvent[], name: string) {
  await test.step(`Attach agent result evidence: ${name}`, async () => {
    const agentResults = eventsByType(events, "agent_result");
    await attachJson(`${name}.json`, agentResults);
    test.info().annotations.push({
      type: "evidence",
      description: `Captured ${agentResults.length} agent_result event(s) for ${name}`,
    });
    expect(agentResults.length).toBeGreaterThan(0);
  });
}

export async function expectServerLogContains(expectedText: string, stepName: string) {
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

export async function attachJson(name: string, value: unknown) {
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
