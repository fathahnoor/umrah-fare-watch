// M9 release gate: runs every check in order and fails fast. Mirrors the
// acceptance gate contract in 09_ACCEPTANCE_TESTS.md and 12_HANDOFF_TO_FREEBUFF.md.
// Usage: npm run release-gate
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SPEC_VALIDATOR = path.join(ROOT, "umrah-fare-watch-spec", "tools", "validate-spec.ps1");

const STEPS: Array<{ name: string; command: string }> = [
  { name: "Typecheck", command: "npx tsc --noEmit" },
  { name: "Lint", command: "npx eslint src scripts tests" },
  { name: "Tests", command: "npx vitest run" },
  { name: "Build", command: "npm run build" },
  { name: "Smoke (mock, no credentials)", command: "npm run smoke" },
];

console.log("=== Release gate ===\n");
const started = Date.now();
let failed = false;

for (let i = 0; i < STEPS.length; i += 1) {
  const step = STEPS[i] as { name: string; command: string };
  process.stdout.write(`[${i + 1}/6] ${step.name}... `);
  try {
    execFileSync(step.command, { cwd: ROOT, stdio: "pipe", encoding: "utf-8", shell: true });
    console.log("PASS");
  } catch {
    console.log("FAIL");
    failed = true;
    break;
  }
}

process.stdout.write("[6/6] Spec validator... ");
try {
  if (!existsSync(SPEC_VALIDATOR)) {
    throw new Error(`validator not found: ${SPEC_VALIDATOR}`);
  }
  execFileSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", SPEC_VALIDATOR], {
    cwd: ROOT,
    stdio: "pipe",
    encoding: "utf-8",
  });
  console.log("PASS");
} catch {
  console.log("FAIL (or validator unavailable on this host)");
  if (!failed) {
    failed = true;
  }
}

const seconds = ((Date.now() - started) / 1000).toFixed(1);
console.log(`\nRelease gate: ${failed ? "FAILED" : "PASSED"} in ${seconds}s`);
process.exit(failed ? 1 : 0);
