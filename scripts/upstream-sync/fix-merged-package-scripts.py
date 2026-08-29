#!/usr/bin/env python3
import json
import runpy
import sys
from pathlib import Path

root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(".")
path = root / "package.json"
data = json.loads(path.read_text())
scripts = data.get("scripts", {})
command = scripts.get("regression:user-profiles")
if not isinstance(command, str):
    raise SystemExit("regression:user-profiles is missing")
command = command.replace(
    "pnpm regression:character-schedule-transfer",
    "pnpm --filter @marinara-engine/server exec tsx ../../scripts/regressions/character-schedule-transfer.regression.ts",
).replace(
    "pnpm regression:persona-client:run",
    "pnpm --filter @marinara-engine/server exec tsx ../../scripts/regressions/persona-client-contract.regression.ts",
)
scripts["regression:user-profiles"] = command
path.write_text(json.dumps(data, indent=2) + "\n")

# CR038 makes UserProfile.activePersonaId canonical. Apply the focused cache
# reconciliation after the generic conflict resolver so upstream's legacy
# global Persona.isActive cache does not regain runtime authority.
runpy.run_path(str(Path(__file__).with_name("fix-cr038-persona-cache.py")), run_name="__main__")
