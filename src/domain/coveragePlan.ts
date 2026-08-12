// Flight tier cadence and rolling coverage plan (02_LONG_HORIZON_MONITORING.md
// sections 5 and 12). Pure functions so the scheduler is testable without IO.
import { addDays, todayLocalDate } from "./dates.js";
import { TECHNICAL_FLIGHT_HORIZON_DAYS } from "./horizons.js";
import type { AppConfig } from "../config.js";

export type FlightTier = "A" | "B" | "C";

export interface TierPlanEntry {
  date: string;
  offsetDays: number;
  tier: FlightTier;
  intervalHours: number;
}

/**
 * Tier by offset: 0-90 days -> A (24h), 91-210 -> B (48h),
 * 211-370 -> C (84h). Boundary days belong to the closer tier.
 */
export function flightTierForOffset(offsetDays: number, _config: AppConfig): FlightTier {
  if (offsetDays <= 90) {
    return "A";
  }
  if (offsetDays <= 210) {
    return "B";
  }
  return "C";
}

export function tierIntervalHours(tier: FlightTier, config: AppConfig): number {
  return tier === "A"
    ? config.flightTierAHours
    : tier === "B"
      ? config.flightTierBHours
      : config.flightTierCHours;
}

/** Rolling technical plan: offsets 1..370 relative to today. */
export function flightCoveragePlan(now: Date, config: AppConfig): TierPlanEntry[] {
  const today = todayLocalDate(now);
  const entries: TierPlanEntry[] = [];
  for (let offset = 1; offset <= TECHNICAL_FLIGHT_HORIZON_DAYS; offset += 1) {
    const tier = flightTierForOffset(offset, config);
    entries.push({
      date: addDays(today, offset),
      offsetDays: offset,
      tier,
      intervalHours: tierIntervalHours(tier, config),
    });
  }
  return entries;
}

/**
 * Deterministic jitter for a scan key, up to 15% of the interval. Stable per
 * date and domain so tests stay repeatable and two workers converge.
 */
export function deterministicJitterMs(key: string, intervalHours: number): number {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  const maxJitterMs = intervalHours * 3_600_000 * 0.15;
  return hash % Math.max(1, Math.round(maxJitterMs));
}

/** Whether a coverage record is due for a rescan. */
export function isCoverageDue(
  lastAttemptAt: string | null,
  nextEligibleAt: string | null,
  now: Date,
): boolean {
  if (nextEligibleAt == null) {
    return true;
  }
  return new Date(nextEligibleAt).getTime() <= now.getTime();
}
