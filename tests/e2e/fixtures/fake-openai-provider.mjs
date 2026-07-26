import { createServer } from "node:http";

const port = Number(process.env.E2E_FAKE_PROVIDER_PORT ?? "57861");
let lastAgentMemoryRecordId = "e2e-cr009-memory-record";

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function writeJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

function writeSse(res, payloads) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  for (const payload of payloads) {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  }
  res.write("data: [DONE]\n\n");
  res.end();
}

function getText(body) {
  return JSON.stringify(body.messages ?? []);
}

function hasToolResult(body) {
  return Array.isArray(body.messages) && body.messages.some((message) => message.role === "tool");
}

function toolResultsText(body) {
  return Array.isArray(body.messages)
    ? body.messages
        .filter((message) => message.role === "tool")
        .map((message) => message.content ?? "")
        .join("\n")
    : "";
}

function hasTool(body, name) {
  return Array.isArray(body.tools) && body.tools.some((tool) => tool?.function?.name === name);
}

function selectResponse(body) {
  const text = getText(body).toLowerCase();
  const toolText = toolResultsText(body);
  if (toolText) {
    try {
      const parsed = JSON.parse(toolText.split(/\n/).filter(Boolean).at(-1) ?? "{}");
      lastAgentMemoryRecordId = parsed?.record?.id ?? parsed?.records?.[0]?.id ?? parsed?.results?.[0]?.id ?? lastAgentMemoryRecordId;
    } catch {
      /* ignore non-JSON tool text */
    }
  }

  if (hasToolResult(body) && text.includes("cr009 delete") && hasTool(body, "delete_agent_memory")) {
    if (lastAgentMemoryRecordId) {
      return {
        content: null,
        toolCalls: [
          {
            id: "call_delete_agent_memory",
            type: "function",
            function: {
              name: "delete_agent_memory",
              arguments: JSON.stringify({ recordId: lastAgentMemoryRecordId }),
            },
          },
        ],
      };
    }
  }

  if (hasToolResult(body)) {
    return { content: "Tool work completed.", toolCalls: [] };
  }

  if (hasTool(body, "delete_agent_memory") && text.includes("cr009 delete") && lastAgentMemoryRecordId) {
    return {
      content: null,
      toolCalls: [
        {
          id: "call_delete_agent_memory",
          type: "function",
          function: {
            name: "delete_agent_memory",
            arguments: JSON.stringify({ recordId: lastAgentMemoryRecordId }),
          },
        },
      ],
    };
  }

  if (hasTool(body, "save_agent_memory") && text.includes("cr009 save")) {
    lastAgentMemoryRecordId = `e2e-cr009-memory-record-${Date.now()}`;
    return {
      content: null,
      toolCalls: [
        {
          id: "call_save_agent_memory",
          type: "function",
          function: {
            name: "save_agent_memory",
            arguments: JSON.stringify({
              recordId: lastAgentMemoryRecordId,
              title: "Captain tea preference",
              memoryType: "continuity",
              key: "captain-tea-preference",
              content: "The captain prefers tea before negotiations.",
              metadata: { source: "cr009-e2e" },
            }),
          },
        },
      ],
    };
  }

  if (hasTool(body, "search_agent_memory") && text.includes("cr009 search")) {
    return {
      content: null,
      toolCalls: [
        {
          id: "call_search_agent_memory",
          type: "function",
          function: {
            name: "search_agent_memory",
            arguments: JSON.stringify({ query: "captain tea", mode: "literal", memoryType: "continuity" }),
          },
        },
      ],
    };
  }

  if (hasTool(body, "search_agent_memory") && text.includes("cr009 semantic unavailable")) {
    return {
      content: null,
      toolCalls: [
        {
          id: "call_search_agent_memory_semantic",
          type: "function",
          function: {
            name: "search_agent_memory",
            arguments: JSON.stringify({ query: "captain tea", mode: "semantic", memoryType: "continuity" }),
          },
        },
      ],
    };
  }

  if (hasTool(body, "list_agent_memory") && text.includes("cr009 list")) {
    return {
      content: null,
      toolCalls: [
        {
          id: "call_list_agent_memory",
          type: "function",
          function: {
            name: "list_agent_memory",
            arguments: JSON.stringify({ memoryType: "continuity", includeContent: true }),
          },
        },
      ],
    };
  }

  if (hasTool(body, "list_agent_memory") && text.includes("cr009 delete")) {
    return {
      content: null,
      toolCalls: [
        {
          id: "call_list_before_delete_agent_memory",
          type: "function",
          function: {
            name: "list_agent_memory",
            arguments: JSON.stringify({ memoryType: "continuity", includeContent: false }),
          },
        },
      ],
    };
  }

  if (
    !body.tools?.length &&
    (text.includes("chat summary") || text.includes("chat-summary") || text.includes("chat_summary"))
  ) {
    return { content: JSON.stringify({ summary: "E2E built-in summary update" }), toolCalls: [] };
  }

  if (hasTool(body, "append_chat_summary") && text.includes("chat memory keeper")) {
    return {
      content: null,
      toolCalls: [
        {
          id: "call_append_summary",
          type: "function",
          function: {
            name: "append_chat_summary",
            arguments: JSON.stringify({ text: "E2E durable memory update" }),
          },
        },
      ],
    };
  }

  if (hasTool(body, "e2e_static_tool") && text.includes("custom tool")) {
    return {
      content: null,
      toolCalls: [
        {
          id: "call_static_tool",
          type: "function",
          function: {
            name: "e2e_static_tool",
            arguments: "{}",
          },
        },
      ],
    };
  }

  if (text.includes("track only the user's custom fields") && text.includes("customtrackerfields")) {
    const committedFieldsPresent = text.includes("trust") && text.includes("promise") && text.includes("kept");
    console.log(`[fake-openai] custom tracker committed fields present=${committedFieldsPresent}`);
    return {
      content: JSON.stringify({
        fields: [
          { name: "Trust", value: "High" },
          { name: "Promise", value: "Changed by model" },
        ],
        reasoning: "E2E tracker update",
      }),
      toolCalls: [],
    };
  }

  return { content: "E2E assistant response.", toolCalls: [] };
}

function completionPayload(body) {
  const response = selectResponse(body);
  const finishReason = response.toolCalls.length > 0 ? "tool_calls" : "stop";
  return {
    id: `chatcmpl-e2e-${Date.now()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: body.model ?? "e2e-model",
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: response.content,
          ...(response.toolCalls.length > 0 ? { tool_calls: response.toolCalls } : {}),
        },
        finish_reason: finishReason,
      },
    ],
    usage: {
      prompt_tokens: 1,
      completion_tokens: 1,
      total_tokens: 2,
    },
  };
}

function streamingPayloads(body) {
  const payload = completionPayload(body);
  const choice = payload.choices[0];
  if (choice.message.tool_calls?.length) {
    const call = choice.message.tool_calls[0];
    return [
      {
        choices: [
          {
            index: 0,
            delta: {
              tool_calls: [
                {
                  index: 0,
                  id: call.id,
                  type: "function",
                  function: {
                    name: call.function.name,
                    arguments: call.function.arguments,
                  },
                },
              ],
            },
            finish_reason: "tool_calls",
          },
        ],
      },
      { choices: [], usage: payload.usage },
    ];
  }

  return [
    {
      choices: [
        {
          index: 0,
          delta: { content: choice.message.content ?? "" },
          finish_reason: "stop",
        },
      ],
    },
    { choices: [], usage: payload.usage },
  ];
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/health") {
      writeJson(res, 200, { status: "ok" });
      return;
    }

    if (req.method === "POST" && req.url === "/chat/completions") {
      const body = await readBody(req);
      if (body.stream === true) {
        writeSse(res, streamingPayloads(body));
        return;
      }
      writeJson(res, 200, completionPayload(body));
      return;
    }

    writeJson(res, 404, { error: "Not found" });
  } catch (error) {
    writeJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`[fake-openai] ready: http://127.0.0.1:${port}`);
});

process.on("SIGTERM", () => server.close(() => process.exit(0)));
process.on("SIGINT", () => server.close(() => process.exit(130)));
