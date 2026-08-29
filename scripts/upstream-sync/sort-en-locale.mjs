import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.argv[2] ?? ".";
const path = join(root, "packages", "client", "src", "localization", "locales", "en.json");
const parsed = JSON.parse(await readFile(path, "utf8"));
const { _meta, ...messages } = parsed;
const entries = Object.entries(messages).sort(([left], [right]) => left.localeCompare(right, "en"));
await writeFile(path, `${JSON.stringify({ _meta, ...Object.fromEntries(entries) }, null, 2)}\n`);
