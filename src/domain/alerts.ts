// Alert rules (07_ALERTS_AND_SCHEDULER.md sections 10-11).
// Pure functions so the scheduler can be tested without a worker.
import type { VerificationStatus, WatchlistType } from "./types.js";

export const DEFAULT_ALERT_COOLDOWN_HOURS = 24;
export const DEFAULT_MATERIAL_DROP_PERCENT = 3;

/**
 * Material drop as a percentage computed from integer minor units.
 * dropPercent = ((previousTotal - currentTotal) / previousTotal) * 100
 */
export function materialDropPercent(previousMinor: number, currentMinor: number): number {
  if (!Number.isInteger(previousMinor) || !Number.isInteger(currentMinor)) {
    throw new Error("materialDropPercent requires integer minor units");
  }
  if (previousMinor <= 0) {
    throw new Error("previous total must be a positive integer");
  }
  return ((previousMinor - currentMinor) / previousMinor) * 100;
}

export function cooldownExpired(
  lastSentAt: string | null,
  now: Date,
  cooldownHours: number,
): boolean {
  if (lastSentAt == null) {
    return true;
  }
  const cooldownMs = cooldownHours * 3_600_000;
  return new Date(lastSentAt).getTime() + cooldownMs <= now.getTime();
}

/**
 * A comparable price reduction of at least `materialDropPercent` may bypass
 * the cooldown. Non-comparable composition changes never bypass automatically.
 */
export function mayBypassCooldown(
  previousTotalMinor: number,
  currentTotalMinor: number,
  materialDropPercentThreshold: number,
): boolean {
  return materialDropPercent(previousTotalMinor, currentTotalMinor) >= materialDropPercentThreshold;
}

export interface AlertEventFingerprintParts {
  watchlistId: string;
  watchlistVersion: number;
  comparablePlanKey: string;
  priceBucketMinor: number;
  verificationClass: VerificationStatus;
  thresholdRuleVersion: number;
}

export function alertEventFingerprint(parts: AlertEventFingerprintParts): string {
  return [
    parts.watchlistId,
    parts.watchlistVersion,
    parts.comparablePlanKey,
    parts.priceBucketMinor,
    parts.verificationClass,
    parts.thresholdRuleVersion,
  ].join("|");
}

export interface WatchlistConstraints {
  type: WatchlistType;
  city: "MAKKAH" | "MADINAH" | null;
  checkIn: string | null;
  checkOut: string | null;
  adults: number;
  childrenAges: number[];
  rooms: number;
  radiusKm: number;
  freeCancellationOnly: boolean;
  currency: "IDR";
}

/** Deterministic normalized constraints for watchlist matching. */
export function normalizeWatchlistConstraints(c: WatchlistConstraints): string {
  const children = [...c.childrenAges].sort((a, b) => a - b).join(",");
  return [
    c.type,
    c.city ?? "-",
    c.checkIn ?? "-",
    c.checkOut ?? "-",
    c.adults,
    children || "-",
    c.rooms,
    c.radiusKm.toFixed(2),
    c.freeCancellationOnly ? "FC" : "NOFC",
    c.currency,
  ].join("|");
}
