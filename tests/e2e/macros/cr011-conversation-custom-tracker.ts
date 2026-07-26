import { expect, test, type APIRequestContext } from "@playwright/test";
import { runGenerationAndCaptureEvents, seedConnection } from "./cr004-memory-agent";

let evidenceCounter = 0;

export async function seedConversationTrackerScenario(request: APIRequestContext) {
  return test.step("Seed isolated Conversation Custom Tracker scenario", async () => {
    const connection = await seedConnection(request, `E2E CR011 Provider ${Date.now()}`);
    const characterResponse = await request.post("/api/characters", {
      data: {
        data: {
          name: `E2E CR011 Character ${Date.now()}`,
          description: "A deterministic Conversation test character.",
          first_mes: "Hello from the CR011 fixture.",
        },
      },
    });
    await expect(characterResponse).toBeOK();
    const character = (await characterResponse.json()) as { id: string };
    const response = await request.post("/api/chats", {
      data: {
        name: `E2E CR011 Conversation ${Date.now()}`,
        mode: "conversation",
        characterIds: [character.id],
        connectionId: connection.id,
      },
    });
    await expect(response).toBeOK();
    return { chat: await response.json(), connection };
  });
}

export async function ensureCustomTrackerAgentConfig(request: APIRequestContext) {
  return test.step("Create or reuse official Custom Tracker agent configuration", async () => {
    const response = await request.post("/api/agents", {
      data: {
        type: "custom-tracker",
        name: "Custom Tracker",
        description: "E2E official Custom Tracker configuration",
        phase: "post_processing",
        enabled: true,
        connectionId: null,
        promptTemplate: "",
        settings: {
          contextSize: 5,
          maxTokens: 4096,
          runInterval: 1,
        },
      },
    });
    if (response.status() !== 409) await expect(response).toBeOK();
  });
}

export async function enableConversationCustomTracker(request: APIRequestContext, chatId: string) {
  return test.step("Enable Custom Tracker for the Conversation chat", async () => {
    await ensureCustomTrackerAgentConfig(request);
    const response = await request.patch(`/api/chats/${chatId}/metadata`, {
      data: {
        enableAgents: true,
        activeAgentIds: ["custom-tracker"],
      },
    });
    await expect(response).toBeOK();
    return response.json();
  });
}

export async function seedLockedTrackerFields(request: APIRequestContext, chatId: string) {
  return test.step("Seed unlocked and locked Custom Tracker fields", async () => {
    const response = await request.patch(`/api/chats/${chatId}/game-state`, {
      data: {
        manual: true,
        fieldLocks: { "player.custom.name:Promise.value": true },
        playerStats: {
          customTrackerFields: [
            { name: "Trust", value: "Medium" },
            { name: "Promise", value: "Kept" },
          ],
        },
      },
    });
    await expect(response).toBeOK();
    return response.json();
  });
}

export async function readTrackerFields(request: APIRequestContext, chatId: string) {
  const response = await request.get(`/api/chats/${chatId}/game-state`);
  await expect(response).toBeOK();
  const state = await response.json();
  return state?.playerStats?.customTrackerFields ?? [];
}

export async function readTrackerFieldLocks(request: APIRequestContext, chatId: string) {
  const response = await request.get(`/api/chats/${chatId}/game-state`);
  await expect(response).toBeOK();
  return (await response.json())?.fieldLocks ?? {};
}

export async function runConversationTrackerGeneration(request: APIRequestContext, chatId: string, userMessage: string) {
  return runGenerationAndCaptureEvents(request, chatId, { userMessage });
}

export async function attachTrackerEvidence(name: string, value: unknown) {
  await test.info().attach(`${name}-${++evidenceCounter}.json`, {
    body: JSON.stringify(value, null, 2),
    contentType: "application/json",
  });
}
