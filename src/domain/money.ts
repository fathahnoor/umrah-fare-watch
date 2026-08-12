// Money rules: integer minor units, exact arithmetic, missing never becomes zero.
import type { CurrencyCode } from "./types.js";

export const CURRENCY_DECIMALS: Record<CurrencyCode, number> = {
  IDR: 0,
  USD: 2,
  SAR: 2,
  EUR: 2,
  SGD: 2,
  MYR: 2,
};

/**
 * Normalize an original amount (minor units) to IDR minor units using a
 * deterministic rounding policy: half-up on the final IDR minor value.
 * fxRateIdrPerMajor is the number of IDR per one major unit of `currency`.
 */
export function normalizeToIdrMinor(
  amountMinor: number,
  currency: CurrencyCode,
  fxRateIdrPerMajor: number,
): number {
  assertNonNegativeInteger(amountMinor, "amountMinor");
  if (!Number.isFinite(fxRateIdrPerMajor) || fxRateIdrPerMajor <= 0) {
    throw new Error("fxRateIdrPerMajor must be a positive finite number");
  }
  const decimals = CURRENCY_DECIMALS[currency] ?? 2;
  const majorUnits = amountMinor / 10 ** decimals;
  return Math.round(majorUnits * fxRateIdrPerMajor);
}

/** Per-person equivalent is secondary display info, never an authoritative total. */
export function perPersonEquivalent(totalMinor: number, adults: number, childrenAges: number[]): number {
  const pax = adults + childrenAges.length;
  if (pax <= 0) {
    throw new Error("perPersonEquivalent requires at least one traveller");
  }
  return Math.round(totalMinor / pax);
}

export function assertNonNegativeInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer, got ${value}`);
  }
}

const idrFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

export function formatIdrMinor(minor: number): string {
  return idrFormatter.format(minor);
}

export function formatMoneyMinor(minor: number, currency: CurrencyCode): string {
  if (currency === "IDR") {
    return formatIdrMinor(minor);
  }
  const decimals = CURRENCY_DECIMALS[currency] ?? 2;
  return `${currency} ${(minor / 10 ** decimals).toFixed(decimals)}`;
}
