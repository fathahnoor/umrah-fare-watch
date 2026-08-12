// Ranking rules (01_PRODUCT_REQUIREMENTS.md section 9).
// Price stays primary; constraints are explicit filters, never hidden penalties.
import type { TripPlan } from "./types.js";

export const RANK_TIE_PERCENT = 2;

export interface RankablePlan {
  tripTotalIdrMinor: number;
  flightVerification: "LIVE_VERIFIED" | "INDICATIVE" | "STALE" | "EXPIRED";
  stops: number;
  durationMinutes: number;
  refundable: boolean;
  observedAt: string;
}

export function toRankablePlan(plan: TripPlan): RankablePlan {
  const makkahRefundable = plan.components.makkahHotel?.cancellation.freeCancellation ?? false;
  const madinahRefundable = plan.components.madinahHotel?.cancellation.freeCancellation ?? false;
  return {
    tripTotalIdrMinor: plan.tripTotalIdrMinor ?? Number.MAX_SAFE_INTEGER,
    flightVerification: plan.components.flight.verificationStatus,
    stops: plan.components.flight.stopCount,
    durationMinutes: plan.components.flight.durationMinutes,
    refundable: makkahRefundable && madinahRefundable,
    observedAt: plan.calculatedAt,
  };
}

export function withinTiePercent(a: number, b: number, percent = RANK_TIE_PERCENT): boolean {
  const max = Math.max(a, b);
  if (max <= 0) {
    return true;
  }
  return Math.abs(a - b) <= (max * percent) / 100;
}

/**
 * Compare two complete, usable plans. Returns negative when `a` ranks first.
 *
 * 1. Lowest usable complete total wins when the difference is more than 2%.
 * 2. Within the 2% band: live-verified beats indicative.
 * 3. Then fewer stops, then shorter duration.
 * 4. Then refundable hotels win (still within the band).
 * 5. Then the newer observation wins.
 */
export function compareCompletePlans(a: RankablePlan, b: RankablePlan): number {
  const band = withinTiePercent(a.tripTotalIdrMinor, b.tripTotalIdrMinor);
  if (!band) {
    return a.tripTotalIdrMinor - b.tripTotalIdrMinor;
  }
  const verifiedDiff = verificationRank(b.flightVerification) - verificationRank(a.flightVerification);
  if (verifiedDiff !== 0) {
    return verifiedDiff;
  }
  if (a.stops !== b.stops) {
    return a.stops - b.stops;
  }
  if (a.durationMinutes !== b.durationMinutes) {
    return a.durationMinutes - b.durationMinutes;
  }
  if (a.refundable !== b.refundable) {
    return a.refundable ? -1 : 1;
  }
  // Newer observation first.
  return b.observedAt.localeCompare(a.observedAt);
}

function verificationRank(v: RankablePlan["flightVerification"]): number {
  switch (v) {
    case "LIVE_VERIFIED":
      return 3;
    case "INDICATIVE":
      return 2;
    case "STALE":
      return 1;
    case "EXPIRED":
      return 0;
  }
}
