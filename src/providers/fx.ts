// Deterministic mock FX table. Real adapters supply their own FX snapshots
// with source, rate, and timestamp; these values are clearly synthetic.
import type { CurrencyCode, FxSnapshot } from "../domain/types.js";

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
