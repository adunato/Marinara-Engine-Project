from pathlib import Path
import sys

root = Path(sys.argv[1] if len(sys.argv) > 1 else ".").resolve()
path = root / "scripts/regressions/character-schedule-ownership.regression.ts"
text = path.read_text(encoding="utf-8")

for label in ("Legacy chat", "Other chat", "Never used schedules"):
    old = f'''    name: "{label}",\n    mode: "conversation",'''
    new = f'''    name: "{label}",\n    mode: "conversation",\n    profileId: "default",'''
    if text.count(old) != 1:
        raise RuntimeError(f"{label}: expected one chat fixture")
    text = text.replace(old, new, 1)

path.write_text(text, encoding="utf-8")
print("schedule ownership regression fixtures assigned to Default profile")
