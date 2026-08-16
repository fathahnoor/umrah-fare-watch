import { cpSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(here, "..", "src", "ui", "public");
const dest = path.resolve(here, "..", "dist", "ui", "public");

// ESLint ignores src/ui/public (browser globals, no build step), so gate the
// UI bundle on a real syntax check here. A broken app.js would otherwise ship
// silently and the whole page would go dead.
const appJs = path.join(src, "app.js");
readFileSync(appJs, "utf8");
const check = spawnSync(process.execPath, ["--check", appJs], { stdio: "pipe" });
if (check.status !== 0) {
  console.error(check.stderr.toString());
  console.error(`Syntax check gagal: ${appJs}`);
  process.exit(1);
}

mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });
console.log(`copied ${src} -> ${dest}`);
