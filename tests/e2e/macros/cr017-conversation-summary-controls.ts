import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { runGenerationAndCaptureEvents } from "./cr004-memory-agent";

const fakeProviderPort = Number(process.env.E2E_FAKE_PROVIDER_PORT ?? "57861");

type ChatMetadata = Record<string, unknown> & {
  conversationSummaryConnectionId?: string | null;
  includeConversationSummaryMemoriesInPrompt?: boolean;
  daySummaries?: Record<string, { summary: string; keyDetails: string[] }>;
};

async function createConnection(request: APIRequestContext, name: string, model: string) {
  const response = await request.post("/api/connections", {
    data: {
      name,
      provider: "custom",
      baseUrl: `http://127.0.0.1:${fakeProviderPort}`,
      apiKey: "e2e-test-key",
      model,
      maxContext: 4096,
      isDefault: false,
      defaultForAgents: false,
    },
  });
  await expect(response).toBeOK();
  return response.json();
}

export async function seedConversationSummaryControlsScenario(request: APIRequestContext) {
  return test.step("Seed a Conversation with separate chat and summary connections", async () => {
    const suffix = Date.now();
    const chatConnection = await createConnection(
      request,
      `E2E CR017 Chat Connection ${suffix}`,
      "e2e-cr017-chat-model",
    );
    const summaryConnection = await createConnection(
      request,
      `E2E CR017 Summary Connection ${suffix}`,
      "e2e-cr017-summary-model",
    );

    const characterResponse = await request.post("/api/characters", {
      data: {
        data: {
          name: "Mira",
          description: "A deterministic CR017 summary-controls test character.",
          first_mes: "Hello from the CR017 fixture.",
        },
      },
    });
    await expect(characterResponse).toBeOK();
    const character = await characterResponse.json();

    const chatResponse = await request.post("/api/chats", {
      data: {
        name: `E2E CR017 Conversation ${suffix}`,
        mode: "conversation",
        characterIds: [character.id],
        connectionId: chatConnection.id,
      },
    });
    await expect(chatResponse).toBeOK();
    const chat = await chatResponse.json();

    const oldTime = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
    for (const [role, content] of [
      ["user", "Please remember the CR017 fixture plan."],
      ["assistant", "I will remember the CR017 fixture plan."],
    ] as const) {
      const messageResponse = await request.post(`/api/chats/${chat.id}/messages`, {
        data: {
          role,
          content,
          characterId: role === "assistant" ? character.id : null,
          createdAt: oldTime,
        },
      });
      await expect(messageResponse).toBeOK();
    }

    return { chat, character, chatConnection, summaryConnection };
  });
}

export async function patchConversationSummarySettings(
  request: APIRequestContext,
  chatId: string,
  settings: Pick<ChatMetadata, "conversationSummaryConnectionId" | "includeConversationSummaryMemoriesInPrompt">,
) {
  return test.step("Persist Conversation summary controls through chat metadata", async () => {
    const response = await request.patch(`/api/chats/${chatId}/metadata`, {
      data: settings,
    });
    await expect(response).toBeOK();
    return response.json();
  });
}

export async function readConversationSummaryMetadata(request: APIRequestContext, chatId: string) {
  const response = await request.get(`/api/chats/${chatId}`);
  await expect(response).toBeOK();
  const chat = await response.json();
  return (typeof chat.metadata === "string" ? JSON.parse(chat.metadata) : (chat.metadata ?? {})) as ChatMetadata;
}

export async function backfillConversationSummaries(request: APIRequestContext, chatId: string) {
  return test.step("Backfill the completed Conversation day", async () => {
    const response = await request.post(`/api/chats/${chatId}/backfill-summaries`, {
      data: { maxMissingDays: 1 },
    });
    await expect(response).toBeOK();
    const result = await response.json();
    await attachConversationSummaryEvidence("backfill-result", result);
    return result;
  });
}

export async function runConversationSummaryProbe(
  request: APIRequestContext,
  chatId: string,
  mode: "include" | "exclude",
) {
  return runGenerationAndCaptureEvents(request, chatId, {
    userMessage: `CR017 ${mode.toUpperCase()} PROBE`,
  });
}

export async function expectFakeProviderEvidence(expectedLine: string) {
  return test.step(`Assert fake provider evidence: ${expectedLine}`, async () => {
    const logPath = join(process.cwd(), "test-results", "e2e", "logs", "fake-openai.log");
    await expect.poll(async () => readFile(logPath, "utf8")).toContain(expectedLine);
    const log = await readFile(logPath, "utf8");
    const matchingLines = log
      .split(/\r?\n/u)
      .filter((line) => line.includes("cr017"))
      .slice(-20);
    await attachConversationSummaryEvidence("fake-provider-cr017-log", {
      expectedLine,
      matchingLines,
    });
    test.info().annotations.push({
      type: "evidence",
      description: `The deterministic provider log contains: ${expectedLine}`,
    });
  });
}

export async function attachConversationSummaryEvidence(name: string, value: unknown) {
  await test.info().attach(`${name}.json`, {
    body: JSON.stringify(value, null, 2),
    contentType: "application/json",
  });
}
