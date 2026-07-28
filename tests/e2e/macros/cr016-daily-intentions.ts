import { expect, test, type APIRequestContext } from "@playwright/test";
import { runGenerationAndCaptureEvents, seedConnection } from "./cr004-memory-agent";

export const CR016_AREA_KEYS = ["work_study", "friendships", "romance", "sex"] as const;

export type DailyIntentionsResponse = {
  active: boolean;
  eligible: boolean;
  eligibilityError: string | null;
  characterName: string | null;
  settings: {
    connectionId: string | null;
    cutoffHour: number;
    areas: Array<{ key: (typeof CR016_AREA_KEYS)[number]; heading: string; prompt: string; enabled: boolean }>;
  };
  outputs: Record<string, { key: string; content: string; updatedAt: string } | undefined>;
};

export async function seedDailyIntentionsScenario(request: APIRequestContext) {
  return test.step("Seed an eligible Daily Intentions Conversation", async () => {
    const connection = await seedConnection(request, `E2E CR016 Provider ${Date.now()}`);
    const characterResponse = await request.post("/api/characters", {
      data: {
        data: {
          name: "Mira",
          description: "A thoughtful adult deciding how to move her life forward.",
          personality: "Reflective, direct, and capable of taking initiative.",
          first_mes: "I have a lot to think about today.",
        },
      },
    });
    await expect(characterResponse).toBeOK();
    const character = await characterResponse.json();

    const chatResponse = await request.post("/api/chats", {
      data: {
        name: `E2E CR016 Conversation ${Date.now()}`,
        mode: "conversation",
        characterIds: [character.id],
        connectionId: connection.id,
      },
    });
    await expect(chatResponse).toBeOK();
    const chat = await chatResponse.json();

    const metadataResponse = await request.patch(`/api/chats/${chat.id}/metadata`, {
      data: {
        enableAgents: true,
        activeAgentIds: ["daily-intentions"],
        summary: "Mira needs to finish a proposal and is unsure why Rowan has become distant.",
      },
    });
    await expect(metadataResponse).toBeOK();

    const messageResponse = await request.post(`/api/chats/${chat.id}/messages`, {
      data: {
        role: "assistant",
        characterId: character.id,
        content:
          "CR016 current context marker: I left the proposal unfinished and decided I should speak to Rowan rather than speculate.",
      },
    });
    await expect(messageResponse).toBeOK();

    return { chat, character, connection };
  });
}

export async function configureDailyIntentions(
  request: APIRequestContext,
  chatId: string,
  connectionId: string,
  options: { failFriendships?: boolean; disableRomance?: boolean } = {},
) {
  return test.step("Configure the four fixed Daily Intentions areas", async () => {
    const response = await request.put(`/api/chats/${chatId}/daily-intentions/settings`, {
      data: {
        settings: {
          connectionId,
          cutoffHour: 7,
          areas: [
            { key: "sex", heading: "Intimacy", prompt: "CR016 sex prompt", enabled: true },
            {
              key: "friendships",
              heading: "My People",
              prompt: options.failFriendships ? "CR016 force area failure" : "CR016 friendships prompt",
              enabled: true,
            },
            { key: "work_study", heading: "The Proposal", prompt: "CR016 work prompt", enabled: true },
            {
              key: "romance",
              heading: "Romantic Life",
              prompt: "CR016 romance prompt",
              enabled: !options.disableRomance,
            },
            { key: "unsupported", heading: "Ignored", prompt: "Ignored", enabled: true },
          ],
        },
      },
    });
    await expect(response).toBeOK();
    return (await response.json()) as DailyIntentionsResponse;
  });
}

export async function seedPriorDailyIntentions(request: APIRequestContext, chatId: string) {
  return test.step("Seed the current values that failed runs must preserve", async () => {
    const response = await request.put(`/api/chats/${chatId}/daily-intentions/outputs`, {
      data: {
        outputs: Object.fromEntries(
          CR016_AREA_KEYS.map((key) => [key, `CR016 prior intention must be excluded (${key}).`]),
        ),
      },
    });
    await expect(response).toBeOK();
    return (await response.json()) as DailyIntentionsResponse;
  });
}

export async function readDailyIntentions(request: APIRequestContext, chatId: string) {
  const response = await request.get(`/api/chats/${chatId}/daily-intentions`);
  await expect(response).toBeOK();
  return (await response.json()) as DailyIntentionsResponse;
}

export async function runAllDailyIntentions(request: APIRequestContext, chatId: string) {
  return test.step("Run all enabled areas and capture progressive events", async () => {
    const response = await request.post(`/api/chats/${chatId}/daily-intentions/generate-all`);
    await expect(response).toBeOK();
    const events = (await response.text())
      .split(/\r?\n\r?\n/)
      .map((block) => block.trim().replace(/^data:\s*/u, ""))
      .filter(Boolean)
      .map((payload) => JSON.parse(payload) as Record<string, unknown>);
    await attachDailyIntentionsEvidence("run-all-events", events);
    return events;
  });
}

export async function runConversationWithDailyIntentions(request: APIRequestContext, chatId: string) {
  return runGenerationAndCaptureEvents(request, chatId, {
    userMessage: "What do you want to move forward today?",
  });
}

export async function attachDailyIntentionsEvidence(name: string, value: unknown) {
  await test.info().attach(`${name}.json`, {
    body: JSON.stringify(value, null, 2),
    contentType: "application/json",
  });
}
