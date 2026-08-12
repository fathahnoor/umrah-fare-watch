// Minimal .env loader (no dependency). Reads .env from the project root into
// process.env without overriding variables that are already set (e.g. from a
// secret manager). Secret files are gitignored; only .env.example is tracked.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

export function loadDotEnv(cwd: string = process.cwd()): void {
  const candidates = [
    path.resolve(cwd, ".env"),
    path.resolve(here, "..", ".env"),
  ];
  const file = candidates.find((p) => existsSync(p));
  if (!file) {
    return;
  }
  const raw = readFileSync(file, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) {
      continue;
    }
    const eq = trimmed.indexOf("=");
    if (eq <= 0) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}
