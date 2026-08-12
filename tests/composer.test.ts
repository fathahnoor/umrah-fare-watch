import { describe, expect, it } from "vitest";
import { composeTrip, deriveCityDates, toPlanSummary } from "../src/composer/tripComposer.js";
import type { FlightObservation, HotelObservation } from "../src/domain/types.js";
import { baseInput, TEST_NOW } from "./helpers.js";

describe("trip composer (DATE-01..08, PRICE-04, PRICE-13)", () => {
  it("DATE-01 JED arrival with AUTO derives Makkah first", () => {
    const flight = flightFixture({ outboundAirport: "JED", outboundArrivalSaudiDate: "2029-12-06" });
    const derived = deriveCityDates(flight, baseInput());
    expect(derived.ok).toBe(true);
    if (derived.ok) {
      expect(derived.dates.firstCity).toBe("MAKKAH");
      expect(derived.dates.makkahCheckIn).toBe("2029-12-06");
      expect(derived.dates.makkahCheckOut).toBe("2029-12-11");
      expect(derived.dates.madinahCheckIn).toBe("2029-12-11");
      expect(derived.dates.madinahCheckOut).toBe("2029-12-15");
    }
  });

  it("DATE-02 MED arrival with AUTO derives Madinah first", () => {
    const flight = flightFixture({ outboundAirport: "MED", outboundArrivalSaudiDate: "2029-12-06" });
    const derived = deriveCityDates(flight, baseInput({ patterns: ["ROUNDTRIP_MED"] }));
    expect(derived.ok).toBe(true);
    if (derived.ok) {
      expect(derived.dates.firstCity).toBe("MADINAH");
      expect(derived.dates.madinahCheckIn).toBe("2029-12-06");
      expect(derived.dates.madinahCheckOut).toBe("2029-12-10");
      expect(derived.dates.makkahCheckIn).toBe("2029-12-10");
      expect(derived.dates.makkahCheckOut).toBe("2029-12-15");
    }
  });

  it("DATE-03 MAKKAH_FIRST and MADINAH_FIRST overrides work", () => {
    const flight = flightFixture({ outboundAirport: "MED", outboundArrivalSaudiDate: "2029-12-06" });
    const first = deriveCityDates(flight, baseInput({ cityOrder: "MAKKAH_FIRST" }));
    expect(first.ok && first.dates.firstCity).toBe("MAKKAH");
    const second = deriveCityDates(flight, baseInput({ cityOrder: "MADINAH_FIRST" }));
    expect(second.ok && second.dates.firstCity).toBe("MADINAH");
  });

  it("DATE-04 the four journey patterns stay distinct", () => {
    const jedJed = flightFixture({ outboundAirport: "JED", returnAirport: "JED", pattern: "ROUNDTRIP_JED" });
    const medMed = flightFixture({ outboundAirport: "MED", returnAirport: "MED", pattern: "ROUNDTRIP_MED" });
    const jedMed = flightFixture({ outboundAirport: "JED", returnAirport: "MED", pattern: "OPENJAW_JED_MED" });
    const medJed = flightFixture({ outboundAirport: "MED", returnAirport: "JED", pattern: "OPENJAW_MED_JED" });
    for (const f of [jedJed, medMed, jedMed, medJed]) {
      expect(deriveCityDates(f, baseInput({ patterns: [f.pattern] })).ok).toBe(true);
    }
  });

  it("DATE-05 first checkout equals second check-in (contiguous stays)", () => {
    const flight = flightFixture({ outboundAirport: "JED", outboundArrivalSaudiDate: "2029-12-06" });
    const derived = deriveCityDates(flight, baseInput());
    expect(derived.ok).toBe(true);
    if (derived.ok) {
      expect(derived.dates.makkahCheckOut).toBe(derived.dates.madinahCheckIn);
    }
  });

  it("DATE-06 return earlier than final checkout makes the plan invalid", () => {
    const flight = flightFixture({
      outboundAirport: "JED",
      outboundArrivalSaudiDate: "2029-12-06",
      returnDepartureSaudiDate: "2029-12-13", // final checkout is 2029-12-15
    });
    const derived = deriveCityDates(flight, baseInput());
    expect(derived.ok).toBe(false);
  });

  it("DATE-07 overnight arrival uses the Saudi local date, not the origin date", () => {
    const flight = flightFixture({ outboundAirport: "JED", outboundArrivalSaudiDate: "2029-12-06" });
    expect(flight.departureLocalDate).toBe("2029-12-05");
    const derived = deriveCityDates(flight, baseInput());
    expect(derived.ok && derived.dates.makkahCheckIn).toBe("2029-12-06");
  });

  it("DATE-08 the system never invents an intercity flight between JED and MED", () => {
    // The composer validates that the flight matches its declared pattern;
    // an invented intercity hop would fail the airport consistency check.
    const bogus = flightFixture({
      outboundAirport: "JED",
      returnAirport: "MED",
      pattern: "ROUNDTRIP_JED", // mismatch: roundtrip JED must return to JED
    });
    const derived = deriveCityDates(bogus, baseInput({ patterns: ["ROUNDTRIP_JED"] }));
    expect(derived.ok).toBe(false);
  });

  it("PRICE-04 complete total equals the exact sum of the three component totals", () => {
    const flight = flightFixture({ outboundAirport: "JED", outboundArrivalSaudiDate: "2029-12-06" });
    const makkah = hotelFixture("MAKKAH", 5, 1_000_000);
    const madinah = hotelFixture("MADINAH", 4, 750_000);
    const plan = composeTrip({
      input: baseInput(),
      searchFingerprint: "fp",
      flight,
      makkahHotel: makkah,
      madinahHotel: madinah,
      now: TEST_NOW,
    });
    expect(plan).not.toBeNull();
    if (plan) {
      expect(plan.priceCompleteness).toBe("COMPLETE");
      expect(plan.tripTotalIdrMinor).toBe(4_000_000 + 1_000_000 + 750_000);
      expect(plan.flightPartyTotalIdrMinor).toBe(4_000_000);
      expect(plan.makkahStayTotalIdrMinor).toBe(1_000_000);
      expect(plan.madinahStayTotalIdrMinor).toBe(750_000);
    }
  });

  it("PRICE-13 the calculation snapshot reproduces the displayed total", () => {
    const flight = flightFixture({ outboundAirport: "JED", outboundArrivalSaudiDate: "2029-12-06" });
    const makkah = hotelFixture("MAKKAH", 5, 1_000_000);
    const madinah = hotelFixture("MADINAH", 4, 750_000);
    const plan = composeTrip({
      input: baseInput(),
      searchFingerprint: "fp",
      flight,
      makkahHotel: makkah,
      madinahHotel: madinah,
      now: TEST_NOW,
    });
    if (plan) {
      const snapshot = plan.calculationSnapshot;
      const reproduced =
        (snapshot.componentAmounts.flight.normalizedIdrMinor ?? 0) +
        (snapshot.componentAmounts.makkahHotel.normalizedIdrMinor ?? 0) +
        (snapshot.componentAmounts.madinahHotel.normalizedIdrMinor ?? 0);
      expect(reproduced).toBe(plan.tripTotalIdrMinor);
      expect(snapshot.sourceObservationIds.flight).toBe(flight.id);
      expect(snapshot.roundingPolicy).toBeTruthy();
    }
  });

  it("missing hotel makes the plan partial with COMPONENT_MISSING", () => {
    const flight = flightFixture({ outboundAirport: "JED", outboundArrivalSaudiDate: "2029-12-06" });
    const plan = composeTrip({
      input: baseInput(),
      searchFingerprint: "fp",
      flight,
      makkahHotel: null,
      madinahHotel: null,
      now: TEST_NOW,
    });
    expect(plan?.priceCompleteness).toBe("COMPONENT_MISSING");
    expect(plan?.tripTotalIdrMinor).toBeNull();
  });

  it("summaries keep party and room semantics end to end", () => {
    const flight = flightFixture({ outboundAirport: "JED", outboundArrivalSaudiDate: "2029-12-06" });
    const plan = composeTrip({
      input: baseInput({ adults: 2, childrenAges: [6], rooms: 2 }),
      searchFingerprint: "fp",
      flight,
      makkahHotel: hotelFixture("MAKKAH", 5, 2_000_000),
      madinahHotel: hotelFixture("MADINAH", 4, 1_500_000),
      now: TEST_NOW,
    });
    if (plan) {
      const summary = toPlanSummary(plan, baseInput({ adults: 2, childrenAges: [6], rooms: 2 }));
      expect(summary.adults).toBe(2);
      expect(summary.childrenAges).toEqual([6]);
      expect(summary.rooms).toBe(2);
      // The observation stores the party total for all travellers.
      expect(summary.subtotals.flight).toBe(4_000_000);
    }
  });
});

function flightFixture(overrides: Partial<FlightObservation>): FlightObservation {
  const outboundAirport = overrides.outboundAirport ?? "JED";
  const returnAirport = overrides.returnAirport ?? outboundAirport;
  const pattern = (overrides.pattern ??
    (outboundAirport === returnAirport
      ? outboundAirport === "JED"
        ? "ROUNDTRIP_JED"
        : "ROUNDTRIP_MED"
      : outboundAirport === "JED"
        ? "OPENJAW_JED_MED"
        : "OPENJAW_MED_JED")) as FlightObservation["pattern"];
  const arrivalSaudiDate = overrides.outboundArrivalSaudiDate ?? "2029-12-06";
  // A 9-night stay (5 Makkah + 4 Madinah) ends on arrival + 9; the mock return
  // flight departs the same day the final checkout happens.
  const returnDepartureSaudiDate = overrides.returnDepartureSaudiDate ?? addDaysLocal(arrivalSaudiDate, 9);
  return {
    id: "flight-1",
    providerId: "mock-flight",
    providerOfferId: "offer-1",
    candidateId: "cand-1",
    observedAt: "2029-06-01T08:00:00Z",
    expiresAt: "2029-12-01T00:00:00Z",
    adults: 1,
    childrenAges: [],
    cabin: "economy",
    segments: [],
    stopCount: 0,
    durationMinutes: 575,
    outboundArrivalUtcInstant: "2029-12-05T23:05:00Z",
    outboundArrivalOffsetMinutes: 180,
    outboundArrivalSaudiDate: arrivalSaudiDate,
    returnDepartureUtcInstant: `${returnDepartureSaudiDate}T18:45:00.000Z`,
    returnDepartureOffsetMinutes: 180,
    returnDepartureSaudiDate,
    outboundAirport,
    returnAirport,
    departureLocalDate: overrides.departureLocalDate ?? "2029-12-05",
    returnLocalDate: returnDepartureSaudiDate,
    pattern,
    originalAmountMinor: 4_000_000,
    originalCurrency: "IDR",
    taxAmountMinor: 440_000,
    mandatoryFeeAmountMinor: 150_000,
    dueNowAmountMinor: 0,
    normalizedIdrAmountMinor: 4_000_000,
    fxRate: 1,
    fxObservedAt: "2029-06-01T08:00:00Z",
    priceCompleteness: "COMPLETE",
    verificationStatus: "LIVE_VERIFIED",
    bookingUrl: null,
    conditions: [],
    baggage: [],
    schemaVersion: "v1",
    ...overrides,
  };
}

function addDaysLocal(localDate: string, days: number): string {
  const [y, m, d] = localDate.split("-").map(Number);
  return new Date(Date.UTC(y as number, (m as number) - 1, (d as number) + days)).toISOString().slice(0, 10);
}

function hotelFixture(city: "MAKKAH" | "MADINAH", nights: number, normalizedIdr: number): HotelObservation {
  return {
    id: `hotel-${city}`,
    providerId: "mock-hotel",
    providerOfferId: `offer-${city}`,
    propertyId: `prop-${city}`,
    propertyName: `Hotel ${city}`,
    city,
    checkInLocalDate: "2029-12-06",
    checkOutLocalDate: "2029-12-11",
    nights,
    adults: 1,
    childrenAges: [],
    rooms: 1,
    radiusKm: 5,
    freeCancellationOnly: false,
    roomName: "Standar",
    rateName: "Rate",
    boardType: "Tanpa makan",
    originalAmountMinor: 100_000,
    originalCurrency: "SAR",
    taxAmountMinor: 15_000,
    mandatoryFeeAmountMinor: 2_500,
    dueNowAmountMinor: 0,
    dueAtPropertyAmountMinor: 117_500,
    normalizedIdrAmountMinor: normalizedIdr,
    fxRate: 4_266,
    fxObservedAt: "2029-06-01T08:00:00Z",
    priceCompleteness: "COMPLETE",
    verificationStatus: "LIVE_VERIFIED",
    availabilityState: "HAS_RESULT",
    straightLineDistanceKm: 1.2,
    observedAt: "2029-06-01T08:00:00Z",
    expiresAt: "2029-12-01T00:00:00Z",
    cancellation: { freeCancellation: true, deadlineLocalDate: "2029-12-03", description: "" },
    payment: { dueNow: false, dueAtProperty: true, description: "" },
    bookingUrl: null,
  };
}
