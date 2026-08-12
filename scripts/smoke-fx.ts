// Server-side smoke test for the FX_API_KEY (exchangerate.host). Proves the
// key works and prints the live USD/SAR -> IDR rates used by real adapters.
// Output is REDACTED: the key never appears.
import { loadDotEnv } from "../src/env.js";
import { loadConfig } from "../src/config.js";
import { liveFxSnapshot } from "../src/providers/fxLive.js";

async function main(): Promise<void> {
  loadDotEnv();
  const config = loadConfig();
  if (!config.fxApiKey) {
    process.stderr.write("FX_API_KEY tidak ditemukan di env/.env\n");
    process.exit(1);
  }
  process.stdout.write(`FX key tersedia: ya (${config.fxApiKey.slice(0, 4)}...${config.fxApiKey.slice(-4)})\n`);
  process.stdout.write(`FX endpoint: ${config.fxApiUrl.replace(/access_key=[^&]*/, "[REDACTED]")}\n\n`);

  const now = new Date();
  for (const currency of ["USD", "SAR"] as const) {
    const snapshot = await liveFxSnapshot(currency, config.fxApiKey, config.fxApiUrl, now);
    process.stdout.write(
      JSON.stringify({
        base: snapshot.base,
        rateIdrPerMajor: snapshot.rateIdrPerMajor,
        observedAt: snapshot.observedAt,
      }),
    );
    process.stdout.write("\n");
  }
}

main().catch((err: unknown) => {
  process.stderr.write(`smoke failed: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
