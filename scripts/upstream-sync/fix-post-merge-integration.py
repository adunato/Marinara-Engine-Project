from __future__ import annotations

import re
import sys
from pathlib import Path

root = Path(sys.argv[1] if len(sys.argv) > 1 else ".").resolve()


def read(rel: str) -> str:
    return (root / rel).read_text(encoding="utf-8")


def write(rel: str, text: str) -> None:
    (root / rel).write_text(text, encoding="utf-8")


def replace_once(text: str, old: str, new: str, *, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one exact match, found {count}")
    return text.replace(old, new, 1)


def replace_first(text: str, old: str, new: str, *, label: str) -> str:
    count = text.count(old)
    if count < 1:
        raise RuntimeError(f"{label}: expected at least one exact match")
    return text.replace(old, new, 1)


def sub_once(text: str, pattern: str, repl: str, *, label: str, flags: int = 0) -> str:
    text2, count = re.subn(pattern, repl, text, count=1, flags=flags)
    if count != 1:
        raise RuntimeError(f"{label}: expected one regex match, found {count}")
    return text2


# 1. CR038: restore profile-qualified chat list API after the upstream conflict.
rel = "packages/server/src/routes/chats.routes.ts"
text = read(rel)
text = sub_once(
    text,
    r'''  // List all chats\n  app\.get\("/", async \(\) => \{\n    await cleanupEmptyRoleplayDmChats\(\);\n    const chats = await storage\.list\(profileId\);\n    return chats\.filter\(\(chat\) => !shouldHideProfessorMariChat\(chat\)\)\.map\(normalizeChatForResponse\);\n  \}\);''',
    '''  // History collections are profile-scoped; direct stable-ID reads remain below.\n  app.get<{ Querystring: { profileId?: string } }>("/", async (req, reply) => {\n    const profileId = await requireProfileId(req.query.profileId, reply);\n    if (!profileId) return;\n    await cleanupEmptyRoleplayDmChats();\n    const chats = await storage.list(profileId);\n    return chats.filter((chat) => !shouldHideProfessorMariChat(chat)).map(normalizeChatForResponse);\n  });''',
    label="profile-scoped root chat list",
)
write(rel, text)

# 2. CR035/041: put persisted emotion collection after its inputs exist.
rel = "packages/server/src/routes/generate/dry-run-route.ts"
text = read(rel)
text = sub_once(
    text,
    r'''\n\s*const persistedCharacterEmotions = collectLatestCharacterEmotions\(\n\s*regenerateMessageId \? chatMessages\.filter\(\(message: any\) => message\.id !== regenerateMessageId\) : chatMessages,\n\s*\);''',
    "",
    label="remove misplaced dry-run emotion collection",
)
needle = '''    const regenerateMessageId =\n      typeof body.regenerateMessageId === "string" && body.regenerateMessageId.trim()\n        ? body.regenerateMessageId.trim()\n        : null;'''
replacement = needle + '''\n    const persistedCharacterEmotions = collectLatestCharacterEmotions(\n      regenerateMessageId ? chatMessages.filter((message: any) => message.id !== regenerateMessageId) : chatMessages,\n    );'''
text = replace_once(text, needle, replacement, label="insert dry-run emotion collection in scope")
write(rel, text)

# 3. LLM: keep Phoenix provider-level tracing, but drop the raw-stream hook that
# upstream removed from ChatOptions/OpenAIProvider. Also remove stale imports.
for rel in [
    "packages/server/src/services/llm/providers/openai.provider.ts",
    "packages/server/src/services/llm/providers/anthropic.provider.ts",
    "packages/server/src/services/llm/providers/google.provider.ts",
]:
    text = read(rel)
    text, count = re.subn(r'''\n\s*LLMHttpError,''', "", text, count=1)
    if count != 1:
        raise RuntimeError(f"{rel}: expected stale LLMHttpError import")
    write(rel, text)

rel = "packages/server/src/services/llm/providers/openai.provider.ts"
text = read(rel)
text = sub_once(
    text,
    r'''\n  private static emitRawStreamChunk\(options: ChatOptions, chunk: string\): void \{.*?\n  \}\n''',
    "\n",
    label="remove obsolete OpenAI raw stream observer",
    flags=re.S,
)
text, count = re.subn(r'''\n\s*OpenAIProvider\.emitRawStreamChunk\(options, decoded\);''', "", text)
if count != 4:
    raise RuntimeError(f"OpenAI raw stream callsites: expected 4, found {count}")
write(rel, text)

rel = "packages/server/src/services/llm/phoenix-tracing-provider.ts"
text = read(rel)
text = replace_once(text, 'const MAX_RAW_STREAM_TRACE_CHARS = 4 * 1024 * 1024;\n', "", label="remove Phoenix raw stream limit")
text = sub_once(
    text,
    r'''\nfunction createRawStreamCapture\(options: ChatOptions\) \{.*?\n\}\n\nfunction startLlmSpan''',
    "\nfunction startLlmSpan",
    label="remove Phoenix raw stream capture",
    flags=re.S,
)
text = replace_once(text, '    const rawStreamCapture = createRawStreamCapture(options);\n\n', "", label="remove Phoenix raw capture init")
text = replace_once(
    text,
    '      const result = await this.provider.chatComplete(messages, rawStreamCapture?.options ?? options);',
    '      const result = await this.provider.chatComplete(messages, options);',
    label="Phoenix chatComplete options",
)
text = sub_once(
    text,
    r'''\n    \} finally \{\n      try \{\n        rawStreamCapture\?\.record\(span\);\n      \} catch \(error\) \{\n        logger\.warn\(error, "\[llm-tracing\] Could not record raw Phoenix stream"\);\n      \}\n      endSpan\(span\);\n    \}''',
    '''\n    } finally {\n      endSpan(span);\n    }''',
    label="remove Phoenix raw capture finalizer",
)
write(rel, text)

# 4. Shared contract for profile-keyed character-owned Conversation schedules.
rel = "packages/shared/src/utils/conversation-presence.ts"
text = read(rel)
text = replace_once(
    text,
    'import type { ConversationPresenceStatus, ConversationStatusOverride } from "../types/chat.js";\n',
    'import type { ConversationPresenceStatus, ConversationStatusOverride } from "../types/chat.js";\nimport { DEFAULT_USER_PROFILE_ID } from "../types/user-profile.js";\n',
    label="conversation presence default profile import",
)
anchor = '''export interface CharacterSchedules {\n  [characterId: string]: WeekSchedule;\n}\n'''
addition = anchor + '''\n/** Character-card extension containing one schedule per User Profile. */\nexport const CONVERSATION_SCHEDULES_BY_PROFILE_EXTENSION = "conversationSchedulesByProfile";\n\nfunction isConversationPresenceRecord(value: unknown): value is Record<string, unknown> {\n  return !!value && typeof value === "object" && !Array.isArray(value);\n}\n\n/**\n * Read the character-owned Conversation schedule for one User Profile.\n * The old single `conversationSchedule` field is accepted only for the Default\n * profile so upgraded installations retain their existing routine without\n * allowing that routine to bridge into newly-created profiles.\n */\nexport function readConversationScheduleForProfile(\n  extensions: Record<string, unknown> | null | undefined,\n  profileId: string,\n): WeekSchedule | undefined {\n  if (!extensions || !profileId) return undefined;\n  const profileSchedules = extensions[CONVERSATION_SCHEDULES_BY_PROFILE_EXTENSION];\n  if (isConversationPresenceRecord(profileSchedules)) {\n    const scoped = profileSchedules[profileId];\n    if (isConversationPresenceRecord(scoped)) return scoped as unknown as WeekSchedule;\n  }\n  if (profileId === DEFAULT_USER_PROFILE_ID) {\n    const legacy = extensions.conversationSchedule;\n    if (isConversationPresenceRecord(legacy)) return legacy as unknown as WeekSchedule;\n  }\n  return undefined;\n}\n\n/** Return extensions with only this profile's character-owned schedule replaced. */\nexport function setConversationScheduleForProfile(\n  extensions: Record<string, unknown> | null | undefined,\n  profileId: string,\n  schedule: WeekSchedule,\n): Record<string, unknown> {\n  const current = extensions ?? {};\n  const rawProfileSchedules = current[CONVERSATION_SCHEDULES_BY_PROFILE_EXTENSION];\n  const profileSchedules = isConversationPresenceRecord(rawProfileSchedules) ? rawProfileSchedules : {};\n  return {\n    ...current,\n    [CONVERSATION_SCHEDULES_BY_PROFILE_EXTENSION]: {\n      ...profileSchedules,\n      [profileId]: schedule,\n    },\n  };\n}\n'''
text = replace_once(text, anchor, addition, label="profile schedule shared helpers")
write(rel, text)

rel = "packages/shared/src/types/character.ts"
text = read(rel)
old = '''  /** Marinara Engine (Conversation mode ONLY): the character's weekly schedule. The\n   *  character owns it; every conversation chat caches a resolved copy in\n   *  `chats.metadata.characterSchedules`. Per-chat opt-out lives on the chat as\n   *  `conversationSchedulesEnabled`. */\n  conversationSchedule?: import("../utils/conversation-presence.js").WeekSchedule;'''
new = '''  /** Marinara Engine (Conversation mode ONLY): legacy Default-profile schedule.\n   *  New writes use `conversationSchedulesByProfile`; this field remains a\n   *  migration/backward-compatibility input for the Default User Profile only. */\n  conversationSchedule?: import("../utils/conversation-presence.js").WeekSchedule;\n  /** Marinara Engine (Conversation mode ONLY): character-owned schedules keyed by\n   *  User Profile. Chats cache their owning profile's resolved copy in\n   *  `chats.metadata.characterSchedules`. */\n  conversationSchedulesByProfile?: Record<string, import("../utils/conversation-presence.js").WeekSchedule>;'''
text = replace_once(text, old, new, label="character schedule profile map type")
write(rel, text)

rel = "packages/server/src/services/storage/characters.storage.ts"
text = read(rel)
text = replace_once(
    text,
    '    conversationSchedule: _schedule,\n',
    '    conversationSchedule: _schedule,\n    conversationSchedulesByProfile: _profileSchedules,\n',
    label="exclude profile schedules from card versions",
)
write(rel, text)

# 5. Chat storage: resolve/hoist character schedules inside the owning profile.
rel = "packages/server/src/services/storage/chats.storage.ts"
text = read(rel)
text = replace_once(
    text,
    'import type { CreateChatInput, CreateMessageInput } from "@marinara-engine/shared";\n',
    'import {\n  readConversationScheduleForProfile,\n  setConversationScheduleForProfile,\n  type CreateChatInput,\n  type CreateMessageInput,\n} from "@marinara-engine/shared";\n',
    label="chat storage shared schedule imports",
)
old = '''function readCharacterSchedule(rawData: unknown): WeekSchedule | null {\n  const schedule = readCardExtension(rawData, "conversationSchedule");\n  return isValidLegacySchedule(schedule) ? schedule : null;\n}\n'''
new = '''function readCharacterSchedule(rawData: unknown, profileId: string): WeekSchedule | null {\n  if (typeof rawData !== "string") return null;\n  try {\n    const parsed: unknown = JSON.parse(rawData);\n    if (!isPlainRecord(parsed)) return null;\n    const rawExtensions = parsed.extensions;\n    if (rawExtensions !== undefined && rawExtensions !== null && !isPlainRecord(rawExtensions)) return null;\n    const schedule = readConversationScheduleForProfile(\n      isPlainRecord(rawExtensions) ? rawExtensions : undefined,\n      profileId,\n    );\n    return isValidLegacySchedule(schedule) ? schedule : null;\n  } catch {\n    return null;\n  }\n}\n\nfunction writeCharacterSchedule(rawData: unknown, profileId: string, schedule: WeekSchedule): string | null {\n  if (typeof rawData !== "string") return null;\n  try {\n    const parsed: unknown = JSON.parse(rawData);\n    if (!isPlainRecord(parsed)) return null;\n    const rawExtensions = parsed.extensions;\n    if (rawExtensions !== undefined && rawExtensions !== null && !isPlainRecord(rawExtensions)) return null;\n    const extensions = setConversationScheduleForProfile(\n      isPlainRecord(rawExtensions) ? rawExtensions : undefined,\n      profileId,\n      schedule,\n    );\n    return JSON.stringify({ ...parsed, extensions });\n  } catch {\n    return null;\n  }\n}\n'''
text = replace_once(text, old, new, label="profile-aware storage schedule helpers")
text = replace_once(
    text,
    '''  async function collectFreshConversationSchedules(\n    characterIds: string[],\n    scheduleNow: Date,\n  ): Promise<CharacterSchedules> {''',
    '''  async function collectFreshConversationSchedules(\n    characterIds: string[],\n    scheduleNow: Date,\n    profileId: string,\n  ): Promise<CharacterSchedules> {''',
    label="collect schedules signature",
)
text = replace_first(text, '      const schedule = readCharacterSchedule(row.data);', '      const schedule = readCharacterSchedule(row.data, profileId);', label="collect schedule read")
text = replace_once(
    text,
    '''  async function hoistLegacyChatSchedules(\n    cachedSchedules: CharacterSchedules,\n    activeCharacterIds: readonly string[],\n  ): Promise<boolean> {''',
    '''  async function hoistLegacyChatSchedules(\n    cachedSchedules: CharacterSchedules,\n    activeCharacterIds: readonly string[],\n    profileId: string,\n  ): Promise<boolean> {''',
    label="hoist schedules signature",
)
text = replace_once(
    text,
    '        if (!row || readCardExtension(row.data, "conversationSchedule") !== undefined) return false;\n        const nextData = writeCardExtension(row.data, "conversationSchedule", schedule);',
    '        if (!row || readCharacterSchedule(row.data, profileId)) return false;\n        const nextData = writeCharacterSchedule(row.data, profileId, schedule);',
    label="profile-aware legacy schedule hoist",
)
text = replace_once(
    text,
    '''  async function collectConversationPresence(\n    characterIds: string[],\n    scheduleNow: Date,\n  ): Promise<{ schedules: CharacterSchedules; overrides: Record<string, ConversationStatusOverride | null> }> {''',
    '''  async function collectConversationPresence(\n    characterIds: string[],\n    scheduleNow: Date,\n    profileId: string,\n  ): Promise<{ schedules: CharacterSchedules; overrides: Record<string, ConversationStatusOverride | null> }> {''',
    label="presence collect signature",
)
text = replace_once(text, '      const schedule = readCharacterSchedule(row.data);', '      const schedule = readCharacterSchedule(row.data, profileId);', label="presence schedule read")
text = replace_once(
    text,
    '.where(eq(chats.mode, "conversation"))',
    '.where(and(eq(chats.mode, "conversation"), eq(chats.profileId, input.profileId)))',
    label="profile-scoped recent conversation timezone",
)
text = replace_once(
    text,
    '''          ? await collectFreshConversationSchedules(\n              input.characterIds,\n              toZonedWallClockDate(new Date(), conversationTimeZone),\n            )''',
    '''          ? await collectFreshConversationSchedules(\n              input.characterIds,\n              toZonedWallClockDate(new Date(), conversationTimeZone),\n              input.profileId,\n            )''',
    label="new chat profile schedule inheritance",
)
text = replace_once(text, '        await hoistLegacyChatSchedules(meta.characterSchedules, characterIds);', '        await hoistLegacyChatSchedules(meta.characterSchedules, characterIds, chat.profileId);', label="presence legacy hoist profile")
text = replace_once(
    text,
    '''      const presence = await collectConversationPresence(\n        characterIds,\n        toZonedWallClockDate(new Date(), resolveConversationTimeZone(meta)),\n      );''',
    '''      const presence = await collectConversationPresence(\n        characterIds,\n        toZonedWallClockDate(new Date(), resolveConversationTimeZone(meta)),\n        chat.profileId,\n      );''',
    label="presence collect profile",
)
text = replace_once(text, '      const freshSchedules = await collectFreshConversationSchedules(characterIds, scheduleNow);', '      const freshSchedules = await collectFreshConversationSchedules(characterIds, scheduleNow, chat.profileId);', label="resolve schedules profile")
write(rel, text)

# 6. Conversation routes: profile-qualified timezone propagation and schedules.
rel = "packages/server/src/routes/conversation.routes.ts"
text = read(rel)
text = replace_once(text, 'import { createConnectionsStorage } from "../services/storage/connections.storage.js";\n', 'import { createConnectionsStorage } from "../services/storage/connections.storage.js";\nimport { createUserProfilesStorage } from "../services/storage/user-profiles.storage.js";\n', label="conversation profile storage import")
text = replace_once(
    text,
    '''  localAuthProviderBaseUrl,\n  shouldIncludeConversationSummaryMemories,''',
    '''  localAuthProviderBaseUrl,\n  readConversationScheduleForProfile,\n  setConversationScheduleForProfile,\n  shouldIncludeConversationSummaryMemories,''',
    label="conversation shared schedule imports",
)
old = '''/** The character card owns the schedule; chats only cache a resolved copy. */\nfunction readCharacterSchedule(charData: CharacterData): WeekSchedule | undefined {\n  const schedule = charData.extensions?.conversationSchedule;\n  return schedule && typeof schedule === "object" ? (schedule as WeekSchedule) : undefined;\n}\n'''
new = '''/** The character card owns schedules, namespaced by User Profile; chats cache their resolved copy. */\nfunction readCharacterSchedule(charData: CharacterData, profileId: string): WeekSchedule | undefined {\n  return readConversationScheduleForProfile(charData.extensions, profileId);\n}\n'''
text = replace_once(text, old, new, label="conversation route schedule helper")
text = replace_once(text, '  const connections = createConnectionsStorage(app.db);\n', '  const connections = createConnectionsStorage(app.db);\n  const profiles = createUserProfilesStorage(app.db);\n', label="conversation profiles storage")
text = replace_once(
    text,
    '''  async function rememberConversationTimeZone(timeZone: string): Promise<number> {\n    const allChats = await chats.list();''',
    '''  async function rememberConversationTimeZone(timeZone: string, profileId: string): Promise<number> {\n    const allChats = await chats.list(profileId);''',
    label="profile-scoped timezone propagation",
)
old = '''  async function resolveScheduleGenerationContext(chatId: string | undefined, characterId: string) {\n    const chat = chatId ? await chats.getById(chatId) : null;\n    if (chatId && !chat) return { errorStatus: 404 as const, error: "Chat not found" };\n    if (chat && chat.mode !== "conversation") return { errorStatus: 400 as const, error: "Not a conversation chat" };\n\n    const { conn, error: connectionError } = await resolveConversationScheduleConnection(\n      connections,\n      chat?.connectionId ?? null,\n    );'''
new = '''  async function resolveScheduleGenerationContext(\n    chatId: string | undefined,\n    characterId: string,\n    requestedProfileId?: string,\n  ) {\n    const chat = chatId ? await chats.getById(chatId) : null;\n    if (chatId && !chat) return { errorStatus: 404 as const, error: "Chat not found" };\n    if (chat && chat.mode !== "conversation") return { errorStatus: 400 as const, error: "Not a conversation chat" };\n\n    const profileId = chat?.profileId ?? requestedProfileId?.trim() ?? "";\n    if (!profileId || !(await profiles.getById(profileId))) {\n      return { errorStatus: 400 as const, error: "A valid profileId is required" };\n    }\n    if (chat && requestedProfileId?.trim() && requestedProfileId.trim() !== chat.profileId) {\n      return { errorStatus: 400 as const, error: "profileId does not own this chat" };\n    }\n\n    const { conn, error: connectionError } = await resolveConversationScheduleConnection(\n      connections,\n      chat?.connectionId ?? null,\n    );'''
text = replace_once(text, old, new, label="schedule generation context profile")
text = replace_once(text, '    return { chat, charData, provider, model: conn.model ?? "" };', '    return { chat, profileId, charData, provider, model: conn.model ?? "" };', label="schedule context returns profile")
text = replace_once(
    text,
    '''  app.put<{\n    Body: { timeZone?: unknown };\n  }>("/schedule/timezone", async (req, reply) => {\n    const timeZone = normalizePromptTimeZone(req.body.timeZone);\n    if (!timeZone) return reply.status(400).send({ error: "timeZone must be a valid IANA timezone" });\n    const updatedChats = await rememberConversationTimeZone(timeZone);\n    return reply.send({ timeZone, updatedChats });\n  });''',
    '''  app.put<{\n    Body: { timeZone?: unknown; profileId?: unknown };\n  }>("/schedule/timezone", async (req, reply) => {\n    const timeZone = normalizePromptTimeZone(req.body.timeZone);\n    if (!timeZone) return reply.status(400).send({ error: "timeZone must be a valid IANA timezone" });\n    const profileId = typeof req.body.profileId === "string" ? req.body.profileId.trim() : "";\n    if (!profileId || !(await profiles.getById(profileId))) {\n      return reply.status(400).send({ error: "A valid profileId is required" });\n    }\n    const updatedChats = await rememberConversationTimeZone(timeZone, profileId);\n    return reply.send({ timeZone, updatedChats });\n  });''',
    label="schedule timezone profile body",
)
text = replace_once(text, '      chatId?: string;\n      characterId: string;\n      mode: "week" | "day";', '      chatId?: string;\n      profileId?: string;\n      characterId: string;\n      mode: "week" | "day";', label="draft profile body")
text = replace_first(text, '    const context = await resolveScheduleGenerationContext(chatId, characterId);', '    const context = await resolveScheduleGenerationContext(chatId, characterId, req.body.profileId);', label="draft context profile")
text = replace_first(text, '    if (requestedTimeZone) await rememberConversationTimeZone(requestedTimeZone);', '    if (requestedTimeZone) await rememberConversationTimeZone(requestedTimeZone, context.profileId);', label="draft timezone profile")
text = replace_once(text, '      chatId?: string;\n      characterId: string;\n      schedule: WeekSchedule;', '      chatId?: string;\n      profileId?: string;\n      characterId: string;\n      schedule: WeekSchedule;', label="summary profile body")
text = replace_once(text, '    const context = await resolveScheduleGenerationContext(chatId, characterId);', '    const context = await resolveScheduleGenerationContext(chatId, characterId, req.body.profileId);', label="summary context profile")
text = replace_once(text, '    if (requestedTimeZone) await rememberConversationTimeZone(requestedTimeZone);', '    if (requestedTimeZone) await rememberConversationTimeZone(requestedTimeZone, chat.profileId);', label="generated schedule timezone profile")
text = replace_once(text, '      const existing = readCharacterSchedule(charData) ?? existingSchedules[charId];', '      const existing = readCharacterSchedule(charData, chat.profileId) ?? existingSchedules[charId];', label="generate profile schedule read")
text = replace_once(
    text,
    '''        const extensions = {\n          ...(charData.extensions ?? {}),\n          conversationStatus: status,\n          conversationSchedule: fullSchedule,\n        };''',
    '''        const extensions = {\n          ...setConversationScheduleForProfile(charData.extensions, chat.profileId, fullSchedule),\n          conversationStatus: status,\n        };''',
    label="generate profile schedule write",
)
text = replace_once(text, '          const characterOwnsSchedule = !!readCharacterSchedule(charData);', '          const characterOwnsSchedule = !!readCharacterSchedule(charData, chat.profileId);', label="status route profile schedule check")
write(rel, text)

# 7. Client schedule editors write/read the active chat/profile slot.
rel = "packages/client/src/components/chat/CharacterScheduleEditorModal.tsx"
text = read(rel)
text = replace_once(text, '  chatId?: string;\n  characterId: string;', '  chatId?: string;\n  profileId: string;\n  characterId: string;', label="schedule modal profile prop")
text = replace_once(text, '  chatId,\n  characterId,', '  chatId,\n  profileId,\n  characterId,', label="schedule modal profile destructure")
text, count = re.subn(r'(\n\s*chatId,\n)(\s*characterId,)', r'\1        profileId,\n\2', text)
if count != 3:
    raise RuntimeError(f"schedule modal profile payloads: expected 3, found {count}")
write(rel, text)

rel = "packages/client/src/components/chat/ChatArea.tsx"
text = read(rel)
text = replace_once(text, '    (savedCharacterId: string, updated: WeekSchedule) => {\n      updateCharacter.mutate(', '    (savedCharacterId: string, updated: WeekSchedule) => {\n      if (!chat?.profileId) return;\n      updateCharacter.mutate(', label="chat schedule save profile guard")
text = replace_once(text, '          data: { extensions: { conversationSchedule: updated } },', '          data: { extensions: { conversationSchedulesByProfile: { [chat.profileId]: updated } } },', label="chat schedule profile write")
text = replace_once(text, '    [chat?.id, localizeUi, queryClient, updateCharacter],', '    [chat?.id, chat?.profileId, localizeUi, queryClient, updateCharacter],', label="chat schedule callback deps")
text = replace_once(text, '        chatId={activeChatId}\n        characterId={scheduleModalCharacterId}', '        chatId={activeChatId}\n        profileId={chat?.profileId ?? ""}\n        characterId={scheduleModalCharacterId}', label="chat schedule modal profile prop")
write(rel, text)

rel = "packages/client/src/components/characters/CharacterEditor.tsx"
text = read(rel)
text = replace_once(text, 'import { useUIStore } from "../../stores/ui.store";\n', 'import { useUIStore } from "../../stores/ui.store";\nimport { useUserProfileStore } from "../../stores/user-profile.store";\n', label="character editor profile store import")
text = replace_once(text, 'import { normalizeAvatarCrop, type WeekSchedule } from "@marinara-engine/shared";', 'import { normalizeAvatarCrop, readConversationScheduleForProfile, type WeekSchedule } from "@marinara-engine/shared";', label="character editor schedule helper import")
text = replace_once(text, '  const [scheduleOpen, setScheduleOpen] = useState(false);', '  const [scheduleOpen, setScheduleOpen] = useState(false);\n  const activeProfileId = useUserProfileStore((state) => state.activeProfileId);', label="character editor active profile")
old = '''  const schedule =\n    (savedExtensions?.conversationSchedule as WeekSchedule | undefined) ??\n    (ext.conversationSchedule as WeekSchedule | undefined);'''
new = '''  const schedule = activeProfileId\n    ? (readConversationScheduleForProfile(savedExtensions, activeProfileId) ??\n      readConversationScheduleForProfile(ext, activeProfileId))\n    : undefined;'''
text = replace_once(text, old, new, label="character editor profile schedule read")
text = replace_once(text, '        onEditSchedule={kind === "character" && characterId ? () => setScheduleOpen(true) : undefined}', '        onEditSchedule={kind === "character" && characterId && activeProfileId ? () => setScheduleOpen(true) : undefined}', label="character editor schedule edit gate")
text = replace_once(text, '        open={scheduleOpen && !!characterId}\n        characterId={characterId ?? ""}', '        open={scheduleOpen && !!characterId && !!activeProfileId}\n        profileId={activeProfileId ?? ""}\n        characterId={characterId ?? ""}', label="character editor schedule modal profile")
text = replace_once(text, '              data: { extensions: { conversationSchedule: updated } },', '              data: { extensions: { conversationSchedulesByProfile: { [activeProfileId ?? ""]: updated } } },', label="character editor profile schedule write")
write(rel, text)

# 8. Extend upstream ownership regression with two-profile isolation.
rel = "scripts/regressions/character-schedule-ownership.regression.ts"
text = read(rel)
text = replace_once(text, 'import type { WeekSchedule } from "../../packages/shared/src/utils/conversation-presence.js";', 'import { readConversationScheduleForProfile, type WeekSchedule } from "../../packages/shared/src/utils/conversation-presence.js";', label="schedule regression helper import")
old = '''  const readCardSchedule = async (): Promise<WeekSchedule | undefined> => {\n    const row = await chars.getById(characterId);\n    const data = JSON.parse(row!.data as string) as { extensions?: { conversationSchedule?: WeekSchedule } };\n    return data.extensions?.conversationSchedule;\n  };'''
new = '''  const readCardSchedule = async (profileId = "default"): Promise<WeekSchedule | undefined> => {\n    const row = await chars.getById(characterId);\n    const data = JSON.parse(row!.data as string) as { extensions?: Record<string, unknown> };\n    return readConversationScheduleForProfile(data.extensions, profileId);\n  };'''
text = replace_once(text, old, new, label="schedule regression profile reader")
text = replace_once(text, '    { extensions: { ...(cardData.extensions ?? {}), conversationSchedule: shared } } as never,', '    { extensions: { ...(cardData.extensions ?? {}), conversationSchedulesByProfile: { default: shared } } } as never,', label="schedule regression default profile card write")
anchor = '''  const legacyRefreshed = (await chats.resolveConversationPresenceState(legacyChat!.id)).schedules;\n  assert.deepEqual(legacyRefreshed[characterId], shared, "the existing chat picks up the card's newer schedule");\n'''
addition = anchor + '''\n  // ── 2b. A second User Profile sharing the character gets its own card slot ──\n  const profileB = "schedule-profile-b";\n  const profileBSchedule = makeSchedule("Profile B field work");\n  const profileBCard = await chars.getById(characterId);\n  const profileBExtensions = (JSON.parse(profileBCard!.data as string) as { extensions?: Record<string, unknown> }).extensions;\n  await chars.update(\n    characterId,\n    {\n      extensions: {\n        ...(profileBExtensions ?? {}),\n        conversationSchedulesByProfile: { [profileB]: profileBSchedule },\n      },\n    } as never,\n    undefined,\n    { skipVersionSnapshot: true },\n  );\n  const profileBChat = await chats.create({\n    name: "Profile B chat",\n    mode: "conversation",\n    characterIds: [characterId],\n    profileId: profileB,\n  } as never);\n  const profileBResolved = (await chats.resolveConversationPresenceState(profileBChat!.id)).schedules;\n  assert.deepEqual(profileBResolved[characterId], profileBSchedule, "Profile B resolves only its character schedule slot");\n  assert.deepEqual(\n    (await chats.resolveConversationPresenceState(legacyChat!.id)).schedules[characterId],\n    shared,\n    "Default profile keeps its own schedule when another profile writes the shared character",\n  );\n  assert.deepEqual(await readCardSchedule(profileB), profileBSchedule, "Profile B schedule is retained on the shared card");\n'''
text = replace_once(text, anchor, addition, label="schedule regression cross-profile isolation")
text = replace_once(text, '    extensions: { ...withSchedule.extensions, conversationSchedule: makeSchedule("Rewritten") },', '    extensions: { ...withSchedule.extensions, conversationSchedulesByProfile: { default: makeSchedule("Rewritten") } },', label="schedule regression runtime version write")
write(rel, text)

for rel in [
    "packages/server/src/routes/chats.routes.ts",
    "packages/server/src/routes/conversation.routes.ts",
    "packages/server/src/routes/generate/dry-run-route.ts",
    "packages/server/src/services/storage/chats.storage.ts",
    "packages/server/src/services/llm/phoenix-tracing-provider.ts",
    "packages/server/src/services/llm/providers/openai.provider.ts",
    "packages/client/src/components/chat/ChatArea.tsx",
    "packages/client/src/components/chat/CharacterScheduleEditorModal.tsx",
    "packages/client/src/components/characters/CharacterEditor.tsx",
]:
    current = read(rel)
    if "<<<<<<<" in current or ">>>>>>>" in current:
        raise RuntimeError(f"{rel}: conflict marker remains")
if "onRawStreamChunk" in read("packages/server/src/services/llm/phoenix-tracing-provider.ts"):
    raise RuntimeError("Phoenix obsolete raw stream hook remains")
if "onRawStreamChunk" in read("packages/server/src/services/llm/providers/openai.provider.ts"):
    raise RuntimeError("OpenAI obsolete raw stream hook remains")

print("post-merge integration fixes applied")
