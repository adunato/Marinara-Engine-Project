import { test } from "../../../fixtures/app";
import {
  attachAgentResultEvidence,
  expectServerLogContains,
  runCr009AgentMemoryGeneration,
  seedAgentMemoryScenario,
} from "../../../macros/cr009-agent-memory";

test("[api] saves searches and lists custom agent memory through built-in tools", async ({ page }) => {
  const { chat } = await seedAgentMemoryScenario(page.request);

  const saveEvents = await runCr009AgentMemoryGeneration(page.request, chat.id, "CR009 save this memory.");
  await attachAgentResultEvidence(saveEvents, "save-agent-memory-events");
  await expectServerLogContains("save_agent_memory completed", "Assert save_agent_memory tool executed");
  await expectServerLogContains("Captain tea preference", "Assert saved memory title is visible in tool evidence");

  const searchEvents = await runCr009AgentMemoryGeneration(page.request, chat.id, "CR009 search agent memory.");
  await attachAgentResultEvidence(searchEvents, "search-agent-memory-events");
  await expectServerLogContains("search_agent_memory completed", "Assert search_agent_memory tool executed");
  await expectServerLogContains(
    "The captain prefers tea before negotiations.",
    "Assert literal search returned the persisted memory content",
  );

  const listEvents = await runCr009AgentMemoryGeneration(page.request, chat.id, "CR009 list agent memory.");
  await attachAgentResultEvidence(listEvents, "list-agent-memory-events");
  await expectServerLogContains("list_agent_memory completed", "Assert list_agent_memory tool executed");
  await expectServerLogContains("captain-tea-preference", "Assert list returned the stable memory key");
});

test("[api] deletes custom agent memory by returned record id", async ({ page }) => {
  const { chat } = await seedAgentMemoryScenario(page.request);

  await runCr009AgentMemoryGeneration(page.request, chat.id, "CR009 save this memory before deletion.");
  const deleteEvents = await runCr009AgentMemoryGeneration(page.request, chat.id, "CR009 delete agent memory.");

  await attachAgentResultEvidence(deleteEvents, "delete-agent-memory-events");
  await expectServerLogContains("delete_agent_memory completed", "Assert delete_agent_memory tool executed");
  await expectServerLogContains('"deleted":true', "Assert delete tool reported a soft-deleted record");
});

test("[api] reports semantic search unavailable without blocking literal memory tools", async ({ page }) => {
  const { chat } = await seedAgentMemoryScenario(page.request);

  await runCr009AgentMemoryGeneration(page.request, chat.id, "CR009 save this memory.");
  const semanticEvents = await runCr009AgentMemoryGeneration(
    page.request,
    chat.id,
    "CR009 semantic unavailable search.",
  );

  await attachAgentResultEvidence(semanticEvents, "semantic-unavailable-events");
  await expectServerLogContains("search_agent_memory completed", "Assert semantic search tool executed");
  await expectServerLogContains(
    "Semantic search is unavailable because embeddings are not available.",
    "Assert semantic-unavailable behavior is explicit",
  );
});
