// Typography guard: reject em dash, en dash, and horizontal bar in repo text.
// Matches the "no em dash" rule in profil-fathah: use comma, period, colon,
// parentheses, or a plain hyphen instead. Run via npm run lint.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const TARGETS = ["README.md", "src", "tests", "scripts", "umrah-fare-watch-spec", ".env.example"];
const SKIP_DIRS = new Set(["node_modules", "dist", "data", ".git", ".freebuff"]);
const BAD = new Map([
  ["\u2014", "em dash"],
  ["\u2013", "en dash"],
  ["\u2015", "horizontal bar"],
]);

function collectFiles(target) {
  const abs = path.resolve(ROOT, target);
  if (!existsSync(abs)) {
    return [];
  }
  if (statSync(abs).isFile()) {
    return [abs];
  }
  const out = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) {
          walk(path.join(dir, entry.name));
        }
      } else {
        out.push(path.join(dir, entry.name));
      }
    }
  };
  walk(abs);
  return out;
}

let violations = 0;
for (const target of TARGETS) {
  for (const file of collectFiles(target)) {
    let text;
    try {
      text = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    const lines = text.split("\n");
    lines.forEach((line, idx) => {
      for (const [ch, name] of BAD) {
        if (line.includes(ch)) {
          violations += 1;
          process.stdout.write(`${path.relative(ROOT, file)}:${idx + 1} [${name}]: ${line.trim().slice(0, 140)}\n`);
        }
      }
    });
  }
}

if (violations > 0) {
  process.stdout.write(`\nTypography guard: ${violations} forbidden dash(es) found.\n`);
  process.exit(1);
}
console.log("Typography guard: no em dash, en dash, or horizontal bar found.");
