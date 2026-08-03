import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { runGenerationAndCaptureEvents } from "./cr004-memory-agent";

const fakeProviderPort = Number(process.env.E2E_FAKE_PROVIDER_PORT ?? "57861");

export const CR032_RAW_SOURCE_MARKER = "CR032 RAW SOURCE MARKER";
export const CR032_LATEST_USER_MARKER = "CR032 LATEST USER MARKER";
export const CR032_CURATOR_PROMPT =
  "CR032 CURATOR SYSTEM MARKER. Produce only a concise Conversation Briefing from the supplied resolved source context.";
export const CR032_WRITER_PROMPT =
  "CR032 WRITER SYSTEM MARKER. Write only the final conversational response from the supplied briefing.";
export const CR032_BRIEFING_MARKER = "CR032 CURATED BRIEFING MARKER";

type JsonRecord = Record<string, unknown>;

function parseRecord(value: unknown): JsonRecord {
  if (value && typeof value === "object" && !Array.isArray(value))
    return value as JsonRecord;
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as JsonRecord)
      : {};
  } catch {
    return {};
  }
}

async function createConnection(
  request: APIRequestContext,
  name: string,
  model: string,
) {
  const response = await request.post("/api/connections", {
    data: {
      name,
      provider: "custom",
      baseUrl: `http://127.0.0.1:${fakeProviderPort}`,
      apiKey: "e2e-test-key",
      model,
      maxContext: 16_384,
      isDefault: false,
      defaultForAgents: false,
    },
  });
  await expect(response).toBeOK();
  return response.json();
}

export async function seedTwoPassConversationScenario(
  request: APIRequestContext,
) {
  return test.step("Seed a Conversation with separate curator and writer connections", async () => {
    const suffix = Date.now();
    const writerConnection = await createConnection(
      request,
      `E2E CR032 Writer Connection ${suffix}`,
      "e2e-cr032-writer-model",
    );
    const curatorConnection = await createConnection(
      request,
      `E2E CR032 Curator Connection ${suffix}`,
      "e2e-cr032-curator-model",
    );

    const characterResponse = await request.post("/api/characters", {
      data: {
        data: {
          name: "Elena",
          description: `A deterministic CR032 test character. ${CR032_RAW_SOURCE_MARKER}`,
          personality: "Thoughtful, direct, and warm.",
          first_mes: "Hello from the CR032 fixture.",
        },
      },
    });
    await expect(characterResponse).toBeOK();
    const character = await characterResponse.json();

    const chatResponse = await request.post("/api/chats", {
      data: {
        name: `E2E CR032 Conversation ${suffix}`,
        mode: "conversation",
        characterIds: [character.id],
        connectionId: writerConnection.id,
      },
    });
    await expect(chatResponse).toBeOK();
    const chat = await chatResponse.json();

    return { chat, character, writerConnection, curatorConnection };
  });
}

export async function configureTwoPassConversation(
  request: APIRequestContext,
  chatId: string,
  curatorConnectionId: string,
) {
  return test.step("Enable the isolated two-pass Conversation pipeline", async () => {
    const response = await request.patch(`/api/chats/${chatId}/metadata`, {
      data: {
        conversationGenerationPipeline: "two_pass",
        conversationCuratorConnectionId: curatorConnectionId,
        conversationCuratorMaxOutputTokens: 1024,
        customConversationBriefingPrompt: CR032_CURATOR_PROMPT,
        customConversationWriterPrompt: CR032_WRITER_PROMPT,
        enableAgents: false,
        activeAgentIds: [],
      },
    });
    await expect(response).toBeOK();
    return response.json();
  });
}

export async function readChatMetadata(
  request: APIRequestContext,
  chatId: string,
) {
  const response = await request.get(`/api/chats/${chatId}`);
  await expect(response).toBeOK();
  const chat = await response.json();
  return parseRecord(chat.metadata);
}

export async function runTwoPassGeneration(
  request: APIRequestContext,
  chatId: string,
) {
  return runGenerationAndCaptureEvents(request, chatId, {
    userMessage: CR032_LATEST_USER_MARKER,
  });
}

export async function readLatestAssistantEvidence(
  request: APIRequestContext,
  chatId: string,
) {
  return test.step("Read persisted curator and writer diagnostics", async () => {
    const response = await request.get(`/api/chats/${chatId}/messages`);
    await expect(response).toBeOK();
    const messages = (await response.json()) as Array<JsonRecord>;
    const assistant = [...messages]
      .reverse()
      .find((message) => message.role === "assistant");
    expect(assistant).toBeTruthy();
    const extra = parseRecord(assistant?.extra);
    const diagnostics = parseRecord(extra.conversationTwoPass);
    const generationInfo = parseRecord(extra.generationInfo);
    await attachTwoPassEvidence("persisted-two-pass-diagnostics", {
      assistant,
      diagnostics,
      generationInfo,
    });
    return { assistant: assistant!, diagnostics, generationInfo };
  });
}

export async function expectCr032ProviderEvidence(expectedLine: string) {
  return test.step(`Assert fake provider evidence: ${expectedLine}`, async () => {
    const logPath = join(
      process.cwd(),
      "test-results",
      "e2e",
      "logs",
      "fake-openai.log",
    );
    await expect
      .poll(async () => readFile(logPath, "utf8"))
      .toContain(expectedLine);
    const log = await readFile(logPath, "utf8");
    const matchingLines = log
      .split(/\r?\n/u)
      .filter((line) => line.includes("cr032"))
      .slice(-20);
    await attachTwoPassEvidence("fake-provider-cr032-log", {
      expectedLine,
      matchingLines,
    });
    test
      .info()
      .annotations.push({ type: "evidence", description: expectedLine });
  });
}

export async function attachTwoPassEvidence(name: string, value: unknown) {
  await test.info().attach(`${name}.json`, {
    body: JSON.stringify(value, null, 2),
    contentType: "application/json",
  });
}
