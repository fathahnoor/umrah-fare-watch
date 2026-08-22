// Deterministic mock FX table. Real adapters supply their own FX snapshots
// with source, rate, and timestamp; these values are clearly synthetic.
import type { CurrencyCode, FxSnapshot } from "../domain/types.js";
import { liveFxSnapshot } from "./fxLive.js";
import { ProviderError } from "./types.js";

export const MOCK_FX_RATES: Record<CurrencyCode, number> = {
  IDR: 1,
  USD: 16_000,
  SAR: 4_266,
  EUR: 17_300,
  SGD: 11_900,
  MYR: 3_400,
};

export function mockFxSnapshot(currency: CurrencyCode, observedAt: string): FxSnapshot {
  return {
    rateIdrPerMajor: MOCK_FX_RATES[currency] ?? MOCK_FX_RATES.USD,
    base: currency,
    quote: "IDR",
    observedAt,
  };
}

export interface FxConfig {
  fxApiKey: string | null;
  fxApiUrl: string;
  fxCacheTtlMs: number;
}

// Live-rate cache keyed by currency. The free exchangerate.host tier is only
// ~100 requests/month, so a snapshot is reused for fxCacheTtlMs (default 1h)
// instead of being fetched per search.
const fxCache = new Map<string, { snapshot: FxSnapshot; expiresAt: number }>();

/**
 * Best-effort snapshot: live cached rate when FX_API_KEY is configured,
 * otherwise the deterministic mock table. A transient live failure falls back
 * to mock, but quota/rate-limit errors are surfaced so LIVE mode never hides
 * exhausted capacity behind synthetic exchange rates.
 */
export async function getFxSnapshot(
  currency: CurrencyCode,
  now: Date,
  config: FxConfig,
): Promise<FxSnapshot> {
  if (!config.fxApiKey) {
    return mockFxSnapshot(currency, now.toISOString());
  }
  const cached = fxCache.get(currency);
  if (cached && cached.expiresAt > now.getTime()) {
    return cached.snapshot;
  }
  try {
    const snapshot = await liveFxSnapshot(currency, config.fxApiKey, config.fxApiUrl, now);
    fxCache.set(currency, { snapshot, expiresAt: now.getTime() + config.fxCacheTtlMs });
    return snapshot;
  } catch (error) {
    if (
      error instanceof ProviderError &&
      (error.category === "QUOTA_EXCEEDED" || error.category === "RATE_LIMITED")
    ) {
      throw error;
    }
    return mockFxSnapshot(currency, now.toISOString());
  }
}
