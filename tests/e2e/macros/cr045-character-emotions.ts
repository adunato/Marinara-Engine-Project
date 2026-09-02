import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test, type APIRequestContext } from "@playwright/test";

const fakeProviderPort = Number(process.env.E2E_FAKE_PROVIDER_PORT ?? "57861");
let evidenceCounter = 0;

const CR045_SPRITE_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

export const CR045_EMOTION_STATE_ID = "joyful";
export const CR045_EMOTION_LABEL = "Joyful and bright";
export const CR045_MAPPED_EXPRESSION = "happy";

type CharacterProfileOptions = {
  enabled: boolean;
  name?: string;
};

type Cr045Character = {
  id: string;
  data?: { extensions?: Record<string, unknown> };
};
type Cr045Connection = { id: string };
type Cr045Chat = { id: string };
type Cr045Message = {
  id: string;
  role: string;
  content: string;
  characterId?: string | null;
  extra?: Record<string, unknown> | string | null;
};

async function attachJson(name: string, value: unknown) {
  await test.info().attach(`${name}.json`, {
    body: JSON.stringify(value, null, 2),
    contentType: "application/json",
  });
}

export async function seedCr045Connection(
  request: APIRequestContext,
): Promise<Cr045Connection> {
  return test.step("Seed deterministic CR045 fake provider connection", async () => {
    const response = await request.post("/api/connections", {
      data: {
        name: `E2E CR045 Connection ${Date.now()}`,
        provider: "custom",
        baseUrl: `http://127.0.0.1:${fakeProviderPort}`,
        apiKey: "e2e-test-key",
        model: "e2e-cr045-model",
        maxContext: 16_384,
        isDefault: true,
        defaultForAgents: true,
      },
    });
    await expect(response).toBeOK();
    return response.json();
  });
}

export async function seedCr045Character(
  request: APIRequestContext,
  options: CharacterProfileOptions,
): Promise<Cr045Character> {
  return test.step(`Create CR045 character with emotion profile (${options.enabled ? "enabled" : "disabled"})`, async () => {
    const response = await request.post("/api/characters", {
      data: {
        data: {
          name: options.name ?? `E2E CR045 Character ${Date.now()}`,
          description: "A deterministic CR045 emotion test character.",
          personality: "Warm and expressive.",
          first_mes: "Hello from the CR045 fixture.",
          extensions: {
            emotionProfile: {
              enabled: options.enabled,
              defaultStateId: CR045_EMOTION_STATE_ID,
              states: [
                {
                  id: CR045_EMOTION_STATE_ID,
                  label: CR045_EMOTION_LABEL,
                  description: "Bright, openly delighted, and happy.",
                  spriteExpression: CR045_MAPPED_EXPRESSION,
                },
              ],
            },
          },
        },
      },
    });
    await expect(response).toBeOK();
    return response.json();
  });
}

export async function seedCr045Sprite(
  request: APIRequestContext,
  characterId: string,
) {
  return test.step("Seed the native happy expression sprite", async () => {
    const response = await request.post(`/api/sprites/${characterId}`, {
      data: { expression: CR045_MAPPED_EXPRESSION, image: CR045_SPRITE_PNG },
    });
    await expect(response).toBeOK();
    return response.json();
  });
}

export async function createCr045Chat(
  request: APIRequestContext,
  characterId: string,
  connectionId: string,
): Promise<Cr045Chat> {
  return test.step("Create isolated CR045 roleplay chat", async () => {
    const response = await request.post("/api/chats", {
      data: {
        name: `E2E CR045 Chat ${Date.now()}`,
        mode: "roleplay",
        characterIds: [characterId],
        connectionId,
      },
    });
    await expect(response).toBeOK();
    return response.json();
  });
}

export async function seedCr045Scenario(
  request: APIRequestContext,
  options: CharacterProfileOptions,
  expressionAvatarsEnabled = true,
) {
  return test.step("Seed isolated CR045 character, sprite, connection, and chat", async () => {
    const connection = await seedCr045Connection(request);
    await ensureCr045ExpressionAgent(request);
    const character = await seedCr045Character(request, options);
    await seedCr045Sprite(request, character.id);
    const chat = await createCr045Chat(request, character.id, connection.id);
    await enableCr045ExpressionAgent(
      request,
      chat.id,
      character.id,
      expressionAvatarsEnabled,
    );
    return { connection, character, chat };
  });
}

export async function enableCr045ExpressionAgent(
  request: APIRequestContext,
  chatId: string,
  characterId: string,
  expressionAvatarsEnabled = true,
) {
  return test.step("Enable the native Expression Engine for CR045", async () => {
    const response = await request.patch(`/api/chats/${chatId}/metadata`, {
      data: {
        enableAgents: true,
        activeAgentIds: ["expression"],
        spriteCharacterIds: [characterId],
        spriteDisplayModes: ["expressions"],
        expressionAvatarsEnabled,
      },
    });
    await expect(response).toBeOK();
    return response.json();
  });
}

export async function ensureCr045ExpressionAgent(request: APIRequestContext) {
  return test.step("Seed the deterministic Expression Engine configuration", async () => {
    const response = await request.post("/api/agents", {
      data: {
        type: "expression",
        name: "Expression Engine",
        description: "Deterministic CR045 Expression Engine configuration",
        phase: "post_processing",
        enabled: true,
        connectionId: null,
        promptTemplate:
          "Return a JSON object with an expressions array containing the requested character expression and emotionStateId selections.",
        settings: {
          contextSize: 5,
          maxTokens: 4096,
          resultType: "sprite_change",
        },
      },
    });
    if (response.status() !== 409) await expect(response).toBeOK();
  });
}

function parseExtra(value: Cr045Message["extra"]): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value !== "string" || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}

export async function runCr045Generation(
  request: APIRequestContext,
  chatId: string,
  marker: "mapped" | "native-fallback",
) {
  return test.step(`Generate deterministic CR045 ${marker} response`, async () => {
    const userMessage =
      marker === "mapped"
        ? "CR045 emotion mapped probe"
        : "CR045 native fallback probe";
    const response = await request.post("/api/generate", {
      data: {
        chatId,
        userMessage,
        connectionId: null,
        streaming: false,
        skipPresenceDelay: true,
      },
    });
    await expect(response).toBeOK();
    const sse = await response.text();
    await test
      .info()
      .attach(`cr045-${marker}-generation-${++evidenceCounter}.sse`, {
        body: sse,
        contentType: "text/event-stream",
      });

    const messagesResponse = await request.get(`/api/chats/${chatId}/messages`);
    await expect(messagesResponse).toBeOK();
    const messages = (await messagesResponse.json()) as Cr045Message[];
    const assistant = [...messages]
      .reverse()
      .find((message) => message.role === "assistant");
    expect(
      assistant,
      "generation should persist an assistant message",
    ).toBeTruthy();
    const extra = parseExtra(assistant?.extra);
    await attachJson(`cr045-${marker}-message-${++evidenceCounter}`, {
      assistant,
      extra,
    });
    test.info().annotations.push({
      type: "evidence",
      description: `CR045 ${marker} generation persisted the assistant message and its Expression Engine metadata.`,
    });
    return { assistant: assistant!, extra, messages, sse };
  });
}

export async function expectCr045ProviderEvidence(expectedLine: string) {
  return test.step(`Assert CR045 fake provider evidence: ${expectedLine}`, async () => {
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
      .filter((line) => line.includes("cr045"))
      .slice(-20);
    await attachJson(`cr045-provider-evidence-${++evidenceCounter}`, {
      expectedLine,
      matchingLines,
    });
    test
      .info()
      .annotations.push({ type: "evidence", description: expectedLine });
  });
}
