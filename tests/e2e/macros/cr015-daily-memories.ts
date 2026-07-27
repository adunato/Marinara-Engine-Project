import { expect, test, type APIRequestContext } from "@playwright/test";
import { runGenerationAndCaptureEvents } from "./cr004-memory-agent";

const fakeProviderPort = Number(process.env.E2E_FAKE_PROVIDER_PORT ?? "57861");

export async function seedDailyMemoryScenario(request: APIRequestContext) {
  return test.step("Seed a completed Conversation day with Daily Memories enabled", async () => {
    const connectionResponse = await request.post("/api/connections", {
      data: {
        name: `E2E CR015 Provider ${Date.now()}`,
        provider: "custom",
        baseUrl: `http://127.0.0.1:${fakeProviderPort}`,
        apiKey: "e2e-test-key",
        model: "e2e-model",
        embeddingModel: "e2e-embedding",
        maxContext: 4096,
        isDefault: true,
        defaultForAgents: true,
      },
    });
    await expect(connectionResponse).toBeOK();
    const connection = await connectionResponse.json();

    const characterResponse = await request.post("/api/characters", {
      data: {
        data: {
          name: "Mira",
          description: "A deterministic Daily Memories test character.",
          first_mes: "Hello from the CR015 fixture.",
        },
      },
    });
    await expect(characterResponse).toBeOK();
    const character = await characterResponse.json();

    const chatResponse = await request.post("/api/chats", {
      data: {
        name: `E2E CR015 Conversation ${Date.now()}`,
        mode: "conversation",
        characterIds: [character.id],
        connectionId: connection.id,
      },
    });
    await expect(chatResponse).toBeOK();
    const chat = await chatResponse.json();

    const agentResponse = await request.patch("/api/agents/type/daily-memory", {
      data: {
        connectionId: connection.id,
        promptTemplate:
          'You create durable memories from one completed day of a private conversation. Return only JSON as {"memories":[{"memory":"short paragraph","importance":1}]}.',
        settings: {
          handoverHour: 0,
          retrievalMessageCount: 4,
          semanticWeight: 50,
          importanceWeight: 35,
          recencyWeight: 15,
          retrievalLimit: 8,
          recencyHalfLifeDays: 30,
        },
      },
    });
    await expect(agentResponse).toBeOK();

    const metadataResponse = await request.patch(
      `/api/chats/${chat.id}/metadata`,
      {
        data: { enableAgents: true, activeAgentIds: ["daily-memory"] },
      },
    );
    await expect(metadataResponse).toBeOK();

    const oldTime = new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString();
    for (const [role, content] of [
      [
        "user",
        "I strongly prefer jasmine tea when we discuss important plans.",
      ],
      [
        "assistant",
        "Mira promises to remember, and suggests a relaxed hiking trip.",
      ],
    ] as const) {
      const messageResponse = await request.post(
        `/api/chats/${chat.id}/messages`,
        {
          data: {
            role,
            content,
            characterId: role === "assistant" ? character.id : null,
            createdAt: oldTime,
          },
        },
      );
      await expect(messageResponse).toBeOK();
    }

    const listResponse = await request.get(
      `/api/chats/${chat.id}/daily-memories`,
    );
    await expect(listResponse).toBeOK();
    const list = await listResponse.json();
    const day = list.days.find(
      (candidate: { formed: boolean }) => !candidate.formed,
    );
    expect(day).toBeTruthy();
    return { chat, connection, day };
  });
}

export async function generateDailyMemoryDay(
  request: APIRequestContext,
  chatId: string,
  date: string,
) {
  return test.step(`Generate Daily Memories for ${date}`, async () => {
    const response = await request.post(
      `/api/chats/${chatId}/daily-memories/${encodeURIComponent(date)}/generate`,
    );
    await expect(response).toBeOK();
    return response.json();
  });
}

export async function readDailyMemories(
  request: APIRequestContext,
  chatId: string,
) {
  const response = await request.get(`/api/chats/${chatId}/daily-memories`);
  await expect(response).toBeOK();
  return response.json();
}

export async function previewDailyMemoryRetrieval(
  request: APIRequestContext,
  chatId: string,
) {
  return test.step("Preview the current Daily Memories retrieval", async () => {
    const response = await request.get(
      `/api/chats/${chatId}/daily-memories/preview`,
    );
    await expect(response).toBeOK();
    return response.json();
  });
}

export async function runDailyMemoryRetrieval(
  request: APIRequestContext,
  chatId: string,
) {
  return runGenerationAndCaptureEvents(request, chatId, {
    userMessage:
      "What tea should we have while revisiting our important plans?",
  });
}

export async function attachDailyMemoryEvidence(name: string, value: unknown) {
  await test.info().attach(`${name}.json`, {
    body: JSON.stringify(value, null, 2),
    contentType: "application/json",
  });
}
