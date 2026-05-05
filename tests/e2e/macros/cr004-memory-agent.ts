import { expect, test, type APIRequestContext } from "@playwright/test";

const fakeProviderPort = Number(process.env.E2E_FAKE_PROVIDER_PORT ?? "57861");
const summaryToolIds = ["read_chat_summary", "append_chat_summary"];
let evidenceCounter = 0;

export type SseEvent = {
  type: string;
  data: unknown;
};

export const documentedMemoryKeeperPrompt =
  "You are the chat memory keeper. After each assistant response, review the recent conversation and the existing chat summary. If the new exchange includes durable facts, relationship changes, preferences, plans, unresolved tasks, or important story developments, update the chat summary using the available summary tool.\n\nKeep the summary concise and cumulative. Preserve important existing context. Do not include transient wording, repetitive dialogue, or details that are unlikely to matter later. If no durable memory update is needed, do not call the update tool.";

export async function seedConnection(request: APIRequestContext, name = `E2E Fake Provider ${Date.now()}`) {
  return test.step("Seed deterministic fake provider connection", async () => {
    const response = await request.post("/api/connections", {
      data: {
        name,
        provider: "custom",
        baseUrl: `http://127.0.0.1:${fakeProviderPort}`,
        apiKey: "e2e-test-key",
        model: "e2e-model",
        maxContext: 4096,
        isDefault: true,
        defaultForAgents: true,
      },
    });
    await expect(response).toBeOK();
    return response.json();
  });
}

export async function createChat(
  request: APIRequestContext,
  options: { name?: string; connectionId: string; summary?: string | null },
) {
  return test.step("Create isolated chat with optional summary", async () => {
    const response = await request.post("/api/chats", {
      data: {
        name: options.name ?? `E2E CR004 Chat ${Date.now()}`,
        mode: "roleplay",
        characterIds: [],
        connectionId: options.connectionId,
      },
    });
    await expect(response).toBeOK();
    const chat = await response.json();

    if (options.summary !== undefined) {
      const meta = await request.patch(`/api/chats/${chat.id}/metadata`, {
        data: { summary: options.summary },
      });
      await expect(meta).toBeOK();
    }

    return chat;
  });
}

export async function seedMessage(
  request: APIRequestContext,
  chatId: string,
  role: "user" | "assistant" | "system" | "narrator",
  content: string,
) {
  return test.step(`Seed ${role} message`, async () => {
    const response = await request.post(`/api/chats/${chatId}/messages`, {
      data: { role, content, characterId: null },
    });
    await expect(response).toBeOK();
    return response.json();
  });
}

export async function createCustomAgent(
  request: APIRequestContext,
  options: {
    name?: string;
    type?: string;
    enabled?: boolean;
    enabledTools?: string[];
    promptTemplate?: string;
    runInterval?: number;
  } = {},
) {
  return test.step("Create custom post-processing agent", async () => {
    const name = options.name ?? `E2E Memory Agent ${Date.now()}`;
    const type = options.type ?? `e2e-memory-agent-${Date.now()}`;
    const settings: Record<string, unknown> = {
      enabledTools: options.enabledTools ?? summaryToolIds,
      contextSize: 20,
    };
    if (options.runInterval !== undefined) {
      settings.runInterval = options.runInterval;
    }

    const response = await request.post("/api/agents", {
      data: {
        type,
        name,
        description: "E2E custom memory agent",
        phase: "post_processing",
        enabled: options.enabled ?? true,
        connectionId: null,
        promptTemplate: options.promptTemplate ?? documentedMemoryKeeperPrompt,
        settings,
      },
    });
    await expect(response).toBeOK();
    return response.json();
  });
}

export async function createBuiltInSummaryAgent(request: APIRequestContext, options: { runInterval?: number } = {}) {
  return test.step("Create built-in chat summary agent", async () => {
    const response = await request.post("/api/agents", {
      data: {
        type: "chat-summary",
        name: "Automated Chat Summary",
        description: "E2E built-in summary agent",
        phase: "post_processing",
        enabled: true,
        connectionId: null,
        promptTemplate: "",
        settings: {
          contextSize: 20,
          runInterval: options.runInterval ?? 1,
        },
      },
    });
    await expect(response).toBeOK();
    return response.json();
  });
}

export async function enableChatAgentsAndTools(
  request: APIRequestContext,
  chatId: string,
  options: {
    activeAgentIds: string[];
    enableAgents?: boolean;
    enableTools?: boolean;
    activeToolIds?: string[];
  },
) {
  return test.step("Enable chat agents and tool access", async () => {
    const response = await request.patch(`/api/chats/${chatId}/metadata`, {
      data: {
        enableAgents: options.enableAgents ?? true,
        activeAgentIds: options.activeAgentIds,
        enableTools: options.enableTools ?? true,
        activeToolIds: options.activeToolIds ?? summaryToolIds,
      },
    });
    await expect(response).toBeOK();
    return response.json();
  });
}

export async function createStaticCustomTool(request: APIRequestContext) {
  return test.step("Create or reuse static custom tool", async () => {
    const response = await request.post("/api/custom-tools", {
      data: {
        name: "e2e_static_tool",
        description: "E2E static custom tool",
        parametersSchema: { type: "object", properties: {} },
        executionType: "static",
        staticResult: "E2E static tool result",
        enabled: true,
      },
    });

    if (response.status() === 409) {
      const existingToolsResponse = await request.get("/api/custom-tools");
      await expect(existingToolsResponse).toBeOK();
      const existingTools = await existingToolsResponse.json();
      const existingTool = existingTools.find((tool: { name?: string }) => tool.name === "e2e_static_tool");
      expect(existingTool).toBeTruthy();
      return existingTool;
    }

    await expect(response).toBeOK();
    return response.json();
  });
}

export async function runGenerationAndCaptureEvents(
  request: APIRequestContext,
  chatId: string,
  options: { userMessage?: string; enableTools?: boolean } = {},
) {
  return test.step("Run generation and capture SSE events", async () => {
    const response = await request.post("/api/generate", {
      data: {
        chatId,
        userMessage: options.userMessage ?? "Please continue.",
        connectionId: null,
        streaming: false,
        enableTools: options.enableTools,
      },
    });
    await expect(response).toBeOK();
    const body = await response.text();
    const events = parseSseEvents(body);
    await attachJson(`sse-events-${++evidenceCounter}.json`, {
      chatId,
      userMessage: options.userMessage ?? "Please continue.",
      events,
    });
    return events;
  });
}

export async function expectChatSummary(request: APIRequestContext, chatId: string, expected: string) {
  return test.step(`Assert persisted chat summary equals: ${expected}`, async () => {
    const response = await request.get(`/api/chats/${chatId}`);
    await expect(response).toBeOK();
    const chat = await response.json();
    const metadata = typeof chat.metadata === "string" ? JSON.parse(chat.metadata) : (chat.metadata ?? {});
    await attachJson(`chat-summary-${++evidenceCounter}.json`, {
      chatId,
      expected,
      actual: metadata.summary,
      metadata,
    });
    expect(metadata.summary).toBe(expected);
    return metadata.summary as string;
  });
}

export async function getChatSummary(request: APIRequestContext, chatId: string) {
  return test.step("Read persisted chat summary", async () => {
    const response = await request.get(`/api/chats/${chatId}`);
    await expect(response).toBeOK();
    const chat = await response.json();
    const metadata = typeof chat.metadata === "string" ? JSON.parse(chat.metadata) : (chat.metadata ?? {});
    return typeof metadata.summary === "string" ? metadata.summary : "";
  });
}

export function eventsByType(events: SseEvent[], type: string) {
  return events.filter((event) => event.type === type);
}

function parseSseEvents(raw: string): SseEvent[] {
  return raw
    .split(/\r?\n\r?\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => block.replace(/^data:\s*/gm, "").trim())
    .filter((payload) => payload && payload !== "[DONE]")
    .map((payload) => JSON.parse(payload) as SseEvent);
}

async function attachJson(name: string, value: unknown) {
  await test.info().attach(name, {
    body: JSON.stringify(value, null, 2),
    contentType: "application/json",
  });
}
