#!/usr/bin/env python3
import sys
from pathlib import Path

root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(".")
path = root / "packages/client/src/lib/persona-cache.ts"
path.write_text('''import type { Persona } from "@marinara-engine/shared";\nimport type { QueryClient } from "@tanstack/react-query";\n\nexport const personaCacheKeys = {\n  list: ["personas"] as const,\n  detail: (id: string) => ["personas", "detail", id] as const,\n  active: () => ["personas", "active"] as const,\n};\n\n/**\n * Reconcile shared Persona records without allowing the legacy global\n * `isActive` flag to override the active User Profile's persona selection.\n */\nexport async function syncCachedPersona(qc: QueryClient, persona: Persona) {\n  const listState = qc.getQueryState<Persona[]>(personaCacheKeys.list);\n  const completeList = listState?.data;\n\n  await Promise.all([\n    qc.cancelQueries({ queryKey: personaCacheKeys.list, exact: true }),\n    qc.cancelQueries({ queryKey: personaCacheKeys.detail(persona.id), exact: true }),\n  ]);\n\n  qc.setQueryData<Persona>(personaCacheKeys.detail(persona.id), persona);\n  if (completeList !== undefined) {\n    qc.setQueryData<Persona[]>(personaCacheKeys.list, (old) => [\n      persona,\n      ...(old ?? completeList).filter((row) => row.id !== persona.id),\n    ]);\n  }\n\n  if (listState !== undefined && listState.data === undefined) {\n    await qc.invalidateQueries({ queryKey: personaCacheKeys.list, exact: true, refetchType: "all" });\n  }\n}\n''')

# Upstream no longer stores message arrays in ChatState; CR038's profile switch
# still needs to reset the active chat/runtime surfaces, but must not resurrect
# the removed message-state field.
chat_store = root / "packages/client/src/stores/chat.store.ts"
text = chat_store.read_text()
needle = "        messages: [],\n"
if text.count(needle) != 1:
    raise SystemExit(f"expected exactly one stale profile-reset messages field, found {text.count(needle)}")
chat_store.write_text(text.replace(needle, "", 1))
