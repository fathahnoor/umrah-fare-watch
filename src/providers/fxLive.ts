// Live FX snapshot (04_PROVIDER_AND_DATA_STRATEGY.md section 9). Requires a
// server-side API key; without one the app stays on the mock FX table.
// Pure conversion is separated so contract tests run offline.
import type { CurrencyCode, FxSnapshot } from "../domain/types.js";
import { ProviderError } from "./types.js";

interface FxApiResponse {
  // exchangerate.host (currencylayer-powered): { success, source, quotes },
  // where quotes use combined keys like "USDIDR" / "USDSAR".
  // open.er-api.com: { result: "success", base_code, rates }.
  success?: boolean;
  result?: string;
  base_code?: string;
  base?: string;
  source?: string;
  rates?: Record<string, number>;
  quotes?: Record<string, number>;
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
  // exchangerate.host authenticates via access_key; open.er-api.com ignores it.
  url.searchParams.set("access_key", apiKey);
  const res = await fetch(url);
  if (!res.ok) {
    throw new ProviderError("PROVIDER_UNAVAILABLE", `FX API HTTP ${res.status}`, { retryable: true });
  }
  const payload = (await res.json()) as FxApiResponse;
  const hasQuotes = payload.quotes != null && typeof payload.quotes === "object";
  const hasRates = payload.rates != null && typeof payload.rates === "object";
  const ok = payload.success !== false && payload.result !== "error" && (hasRates || hasQuotes);
  if (!ok) {
    throw new ProviderError("PROVIDER_UNAVAILABLE", "FX API menolak respons valid", { retryable: true });
  }
  const rates =
    hasRates
      ? (payload.rates as Record<string, number>)
      : normalizeQuotesToRates(payload.source ?? "USD", payload.quotes as Record<string, number>);
  return {
    rateIdrPerMajor: convertToIdrRate(rates, currency),
    base: currency,
    quote: "IDR",
    observedAt: now.toISOString(),
  };
}

/** Convert currencylayer-style combined quotes ("USDIDR": 17863) into a
 * per-source rates map ({ USD: 1, IDR: 17863 }) so convertToIdrRate works. */
function normalizeQuotesToRates(source: string, quotes: Record<string, number>): Record<string, number> {
  const rates: Record<string, number> = { [source]: 1 };
  for (const [pair, value] of Object.entries(quotes)) {
    if (pair.length === source.length + 3 && pair.startsWith(source)) {
      rates[pair.slice(source.length)] = Number(value);
    }
  }
  return rates;
}
