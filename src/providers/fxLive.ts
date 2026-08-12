// Live FX snapshot (04_PROVIDER_AND_DATA_STRATEGY.md section 9). Requires a
// server-side API key; without one the app stays on the mock FX table.
// Pure conversion is separated so contract tests run offline.
import type { CurrencyCode, FxSnapshot } from "../domain/types.js";
import { ProviderError } from "./types.js";

interface FxApiResponse {
  result?: string;
  base_code?: string;
  rates?: Record<string, number>;
}

/**
 * Convert base-code rates to "IDR per one major unit of `currency`".
 * rates are per-one-base (e.g. USD). IDR per X = rates.IDR / rates.X.
 */
export function convertToIdrRate(rates: Record<string, number>, currency: string): number {
  const idr = rates.IDR;
  const perBase = rates[currency];
  if (idr == null || perBase == null || idr <= 0 || perBase <= 0) {
    throw new Error(`FX rate unavailable for ${currency}`);
  }
  return idr / perBase;
}

export async function liveFxSnapshot(
  currency: CurrencyCode,
  apiKey: string | null,
  apiUrl: string,
  now: Date,
): Promise<FxSnapshot> {
  if (!apiKey) {
    throw new ProviderError("ACCESS_NOT_CONFIGURED", "FX_API_KEY belum tersedia", { retryable: false });
  }
  const url = new URL(apiUrl);
  url.searchParams.set("apikey", apiKey);
  const res = await fetch(url);
  if (!res.ok) {
    throw new ProviderError("PROVIDER_UNAVAILABLE", `FX API HTTP ${res.status}`, { retryable: true });
  }
  const payload = (await res.json()) as FxApiResponse;
  if (payload.result !== "success" || !payload.rates) {
    throw new ProviderError("PROVIDER_UNAVAILABLE", "FX API menolak respons valid", { retryable: true });
  }
  return {
    rateIdrPerMajor: convertToIdrRate(payload.rates, currency),
    base: currency,
    quote: "IDR",
    observedAt: now.toISOString(),
  };
}
