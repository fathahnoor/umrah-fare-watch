import { describe, expect, it } from "vitest";
import { compareCompletePlans, toRankablePlan, withinTiePercent } from "../src/domain/ranking.js";
import type { HotelObservation, TripPlan } from "../src/domain/types.js";

describe("complete-trip ranking (RANK-01..06)", () => {
  it("RANK-01 the lowest usable complete total ranks first", () => {
    const cheap = plan({ tripTotalIdrMinor: 10_000_000 });
    const expensive = plan({ tripTotalIdrMinor: 12_000_000 });
    expect(compareCompletePlans(toRankablePlan(cheap), toRankablePlan(expensive))).toBeLessThan(0);
  });

  it("RANK-02 live-verified wins within the 2 percent band", () => {
    const verified = plan({ tripTotalIdrMinor: 10_000_000, verificationStatus: "LIVE_VERIFIED" });
    const indicative = plan({ tripTotalIdrMinor: 10_100_000, verificationStatus: "INDICATIVE" });
    expect(withinTiePercent(10_000_000, 10_100_000)).toBe(true);
    expect(compareCompletePlans(toRankablePlan(verified), toRankablePlan(indicative))).toBeLessThan(0);
  });

  it("RANK-02 cheaper indicative still beats a verified plan outside the band", () => {
    const verified = plan({ tripTotalIdrMinor: 11_000_000, verificationStatus: "LIVE_VERIFIED" });
    const indicative = plan({ tripTotalIdrMinor: 10_000_000, verificationStatus: "INDICATIVE" });
    expect(withinTiePercent(10_000_000, 11_000_000)).toBe(false);
    expect(compareCompletePlans(toRankablePlan(indicative), toRankablePlan(verified))).toBeLessThan(0);
  });

  it("RANK-03 fewer stops win after price ties", () => {
    const direct = plan({ tripTotalIdrMinor: 10_000_000, stops: 0 });
    const transit = plan({ tripTotalIdrMinor: 10_000_000, stops: 1 });
    expect(compareCompletePlans(toRankablePlan(direct), toRankablePlan(transit))).toBeLessThan(0);
  });

  it("RANK-03 shorter duration wins after stops tie", () => {
    const short = plan({ tripTotalIdrMinor: 10_000_000, stops: 1, duration: 600 });
    const long = plan({ tripTotalIdrMinor: 10_000_000, stops: 1, duration: 900 });
    expect(compareCompletePlans(toRankablePlan(short), toRankablePlan(long))).toBeLessThan(0);
  });

  it("RANK-04 refundable hotels win within 2 percent after flight tie rules", () => {
    const refundable = plan({ tripTotalIdrMinor: 10_000_000, stops: 1, duration: 600, refundable: true });
    const nonRefundable = plan({ tripTotalIdrMinor: 10_050_000, stops: 1, duration: 600, refundable: false });
    expect(compareCompletePlans(toRankablePlan(refundable), toRankablePlan(nonRefundable))).toBeLessThan(0);
  });

  it("RANK-06 filters exclude results instead of hidden penalties", () => {
    // Within the band, fewer stops still wins even when the transit plan is
    // cheaper by a small amount (below 2 percent).
    const transit = plan({ tripTotalIdrMinor: 10_050_000, stops: 1 });
    const direct = plan({ tripTotalIdrMinor: 10_000_000, stops: 0 });
    expect(compareCompletePlans(toRankablePlan(direct), toRankablePlan(transit))).toBeLessThan(0);
  });

  it("newer observations win when everything else ties", () => {
    const newer = plan({ tripTotalIdrMinor: 10_000_000, observedAt: "2029-06-01T09:00:00Z" });
    const older = plan({ tripTotalIdrMinor: 10_000_000, observedAt: "2029-06-01T08:00:00Z" });
    expect(compareCompletePlans(toRankablePlan(newer), toRankablePlan(older))).toBeLessThan(0);
  });
});

interface PlanOverrides {
  tripTotalIdrMinor: number;
  verificationStatus?: "LIVE_VERIFIED" | "INDICATIVE" | "STALE" | "EXPIRED";
  stops?: number;
  duration?: number;
  refundable?: boolean;
  observedAt?: string;
}

function plan(overrides: PlanOverrides): TripPlan {
  const flight = {
    id: "f1", providerId: "mock-flight", providerOfferId: "o", candidateId: "c",
    observedAt: "2029-06-01T08:00:00Z", expiresAt: "2029-12-01T00:00:00Z",
    adults: 1, childrenAges: [], cabin: "economy" as const, segments: [], stopCount: overrides.stops ?? 0,
    durationMinutes: overrides.duration ?? 600,
    outboundArrivalUtcInstant: "2029-11-30T23:05:00Z", outboundArrivalOffsetMinutes: 180,
    outboundArrivalSaudiDate: "2029-12-01", returnDepartureUtcInstant: "2029-12-09T18:45:00Z",
    returnDepartureOffsetMinutes: 180, returnDepartureSaudiDate: "2029-12-09",
    outboundAirport: "JED", returnAirport: "JED", departureLocalDate: "2029-11-30",
    returnLocalDate: "2029-12-09", pattern: "ROUNDTRIP_JED" as const, originalAmountMinor: 4_000_000,
    originalCurrency: "IDR" as const, taxAmountMinor: 440_000, mandatoryFeeAmountMinor: 150_000,
    dueNowAmountMinor: 0, normalizedIdrAmountMinor: 4_000_000, fxRate: 1,
    fxObservedAt: "2029-06-01T08:00:00Z", priceCompleteness: "COMPLETE" as const,
    verificationStatus: overrides.verificationStatus ?? "LIVE_VERIFIED",
    bookingUrl: null, conditions: [], baggage: [], schemaVersion: "v1",
  };
  const refundable = overrides.refundable ?? false;
  const makkahHotel: HotelObservation = hotelFixture("h1", "MAKKAH", refundable);
  const madinahHotel: HotelObservation = hotelFixture("h2", "MADINAH", refundable);
  return {
    id: "p",
    searchFingerprint: "f",
    flightObservationId: "f1",
    makkahHotelObservationId: "h1",
    madinahHotelObservationId: "h2",
    pattern: "ROUNDTRIP_JED",
    cityOrder: "AUTO",
    firstCity: "MAKKAH",
    secondCity: "MADINAH",
    makkahCheckIn: "2029-12-01",
    makkahCheckOut: "2029-12-06",
    madinahCheckIn: "2029-12-06",
    madinahCheckOut: "2029-12-10",
    flightPartyTotalIdrMinor: 4_000_000,
    makkahStayTotalIdrMinor: 3_000_000,
    madinahStayTotalIdrMinor: 3_000_000,
    tripTotalIdrMinor: overrides.tripTotalIdrMinor,
    perPersonEquivalentIdrMinor: overrides.tripTotalIdrMinor,
    priceCompleteness: "COMPLETE",
    tripPlanStatus: "LIVE_COMPLETE",
    verificationStatus: overrides.verificationStatus ?? "LIVE_VERIFIED",
    calculationSnapshot: {
      formulaVersion: "v1",
      sourceObservationIds: { flight: "f1", makkahHotel: "h1", madinahHotel: "h2" },
      componentAmounts: {
        flight: { originalMinor: 4_000_000, currency: "IDR", normalizedIdrMinor: 4_000_000 },
        makkahHotel: { originalMinor: 100_000, currency: "SAR", normalizedIdrMinor: 3_000_000 },
        madinahHotel: { originalMinor: 100_000, currency: "SAR", normalizedIdrMinor: 3_000_000 },
      },
      fxSnapshots: [],
      includedFees: [],
      missingFields: [],
      userConstraints: {},
      dateDerivationInputs: { arrivalSaudiDate: "2029-12-01", firstCity: "MAKKAH", makkahNights: 5, madinahNights: 4 },
      roundingPolicy: "half-up",
      generatedReasons: [],
    },
    calculatedAt: overrides.observedAt ?? "2029-06-01T08:00:00Z",
    expiresAt: "2029-12-01T00:00:00Z",
    version: 1,
    components: { flight, makkahHotel, madinahHotel },
  };
}

function hotelFixture(id: string, city: "MAKKAH" | "MADINAH", freeCancellation: boolean): HotelObservation {
  return {
    id, providerId: "mock-hotel", providerOfferId: `oh-${id}`, propertyId: `ph-${id}`,
    propertyName: `Hotel ${city}`, city, checkInLocalDate: "2029-12-01",
    checkOutLocalDate: "2029-12-06", nights: 5, adults: 1, childrenAges: [], rooms: 1,
    radiusKm: 5, freeCancellationOnly: false, roomName: "Standar", rateName: "Rate",
    boardType: "Tanpa makan", originalAmountMinor: 100_000, originalCurrency: "SAR",
    taxAmountMinor: 15_000, mandatoryFeeAmountMinor: 2_500, dueNowAmountMinor: 0,
    dueAtPropertyAmountMinor: 117_500, normalizedIdrAmountMinor: 3_000_000, fxRate: 4_266,
    fxObservedAt: "2029-06-01T08:00:00Z", priceCompleteness: "COMPLETE",
    verificationStatus: "LIVE_VERIFIED", availabilityState: "HAS_RESULT",
    straightLineDistanceKm: 1.2, observedAt: "2029-06-01T08:00:00Z",
    expiresAt: "2029-12-01T00:00:00Z",
    cancellation: {
      freeCancellation,
      deadlineLocalDate: freeCancellation ? "2029-11-28" : null,
      description: "",
    },
    payment: { dueNow: false, dueAtProperty: true, description: "" },
    bookingUrl: null,
  };
}
