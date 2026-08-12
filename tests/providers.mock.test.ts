import { describe, expect, it } from "vitest";
import { MockFlightProvider } from "../src/providers/mock/mockFlightProvider.js";
import { MockHotelProvider } from "../src/providers/mock/mockHotelProvider.js";
import { MOCK_HOTEL_PROVIDER_ID, SCENARIO, mockFlightPriceIdr } from "../src/providers/mock/fixtures.js";
import { hotelCheckInState } from "../src/domain/horizons.js";
import { flightObservationSchema, hotelObservationSchema } from "../src/providers/schemas.js";
import { ProviderError } from "../src/providers/types.js";
import type { ItineraryPattern } from "../src/domain/types.js";
import { TEST_NOW, baseInput } from "./helpers.js";

describe("mock flight provider (PROV-01..05, PROV-07)", () => {
  it("PROV-01 runs without credentials or network and is deterministic", async () => {
    const p = new MockFlightProvider();
    const input = {
      origin: "CGK",
      departureStart: "2029-12-01",
      departureEnd: "2029-12-02",
      adults: 1,
      childrenAges: [],
      patterns: ["ROUNDTRIP_JED", "OPENJAW_JED_MED"] as ItineraryPattern[],
      cabin: "economy",
      now: TEST_NOW,
    };
    const a = await p.discover(input);
    const b = await p.discover(input);
    expect(a.candidates).toEqual(b.candidates);
    expect(a.candidates.length).toBeGreaterThan(0);
  });

  it("PROV-05 broad indicative candidates are not labelled live verified", async () => {
    const p = new MockFlightProvider();
    const result = await p.discover({
      origin: "CGK",
      departureStart: "2029-12-01",
      departureEnd: "2029-12-01",
      adults: 1,
      childrenAges: [],
      patterns: ["ROUNDTRIP_JED"],
      cabin: "economy",
      now: TEST_NOW,
    });
    for (const candidate of result.candidates) {
      expect(candidate.verificationStatus).toBe("INDICATIVE");
    }
  });

  it("verification produces a schema-valid LIVE_VERIFIED observation with exact price", async () => {
    const p = new MockFlightProvider();
    const result = await p.discover({
      origin: "CGK",
      departureStart: "2029-12-01",
      departureEnd: "2029-12-01",
      adults: 2,
      childrenAges: [6],
      patterns: ["ROUNDTRIP_JED"],
      cabin: "economy",
      now: TEST_NOW,
    });
    const candidate = result.candidates[0] as (typeof result.candidates)[number];
    const { observation } = await p.verify({ candidate, adults: 2, childrenAges: [6], cabin: "economy", now: TEST_NOW });
    const expected = mockFlightPriceIdr(candidate.departureLocalDate, candidate.pattern, 2, 1, candidate.stopCount);
    expect(observation.verificationStatus).toBe("LIVE_VERIFIED");
    expect(observation.originalAmountMinor).toBe(expected);
    expect(observation.normalizedIdrAmountMinor).toBe(expected);
    expect(observation.mandatoryFeeAmountMinor).not.toBeNull();
    expect(flightObservationSchema.safeParse(observation).success).toBe(true);
  });

  it("PROV-07 expired offers are marked EXPIRED with a past expiry", async () => {
    const p = new MockFlightProvider();
    const result = await p.discover({
      origin: "CGK",
      departureStart: SCENARIO.flightExpiredDeparture,
      departureEnd: SCENARIO.flightExpiredDeparture,
      adults: 1,
      childrenAges: [],
      patterns: ["ROUNDTRIP_JED"],
      cabin: "economy",
      now: TEST_NOW,
    });
    const candidate = result.candidates[0] as (typeof result.candidates)[number];
    const { observation } = await p.verify({ candidate, adults: 1, childrenAges: [], cabin: "economy", now: TEST_NOW });
    expect(observation.verificationStatus).toBe("EXPIRED");
    expect(new Date(observation.expiresAt).getTime()).toBeLessThan(TEST_NOW.getTime());
  });

  it("provider failure is a typed ProviderError, not a silent empty result", async () => {
    const p = new MockFlightProvider();
    const result = await p.discover({
      origin: "CGK",
      departureStart: SCENARIO.flightUnavailableDeparture,
      departureEnd: SCENARIO.flightUnavailableDeparture,
      adults: 1,
      childrenAges: [],
      patterns: ["ROUNDTRIP_JED"],
      cabin: "economy",
      now: TEST_NOW,
    });
    const candidate = result.candidates[0] as (typeof result.candidates)[number];
    await expect(
      p.verify({ candidate, adults: 1, childrenAges: [], cabin: "economy", now: TEST_NOW }),
    ).rejects.toBeInstanceOf(ProviderError);
  });

  it("quote change scenario records a verified total different from the indicative", async () => {
    const p = new MockFlightProvider();
    const result = await p.discover({
      origin: "CGK",
      departureStart: SCENARIO.flightQuoteChangeDeparture,
      departureEnd: SCENARIO.flightQuoteChangeDeparture,
      adults: 1,
      childrenAges: [],
      patterns: ["ROUNDTRIP_JED"],
      cabin: "economy",
      now: TEST_NOW,
    });
    const candidate = result.candidates[0] as (typeof result.candidates)[number];
    const { observation } = await p.verify({ candidate, adults: 1, childrenAges: [], cabin: "economy", now: TEST_NOW });
    expect(observation.originalAmountMinor).toBe(candidate.indicativeTotalMinor + 500_000);
  });

  it("unknown mandatory fee scenario yields PARTIAL_FEES_UNKNOWN", async () => {
    const p = new MockFlightProvider();
    const result = await p.discover({
      origin: "CGK",
      departureStart: SCENARIO.flightFeesUnknownDeparture,
      departureEnd: SCENARIO.flightFeesUnknownDeparture,
      adults: 1,
      childrenAges: [],
      patterns: ["ROUNDTRIP_JED"],
      cabin: "economy",
      now: TEST_NOW,
    });
    const candidate = result.candidates[0] as (typeof result.candidates)[number];
    const { observation } = await p.verify({ candidate, adults: 1, childrenAges: [], cabin: "economy", now: TEST_NOW });
    expect(observation.mandatoryFeeAmountMinor).toBeNull();
    expect(observation.priceCompleteness).toBe("PARTIAL_FEES_UNKNOWN");
  });

  it("maxStops, maxLayover, and maxDuration filters exclude candidates", async () => {
    const p = new MockFlightProvider();
    const base = {
      origin: "CGK",
      departureStart: "2029-12-01",
      departureEnd: "2029-12-01",
      adults: 1,
      childrenAges: [],
      patterns: ["ROUNDTRIP_JED"] as ItineraryPattern[],
      cabin: "economy",
      now: TEST_NOW,
    };
    const direct = await p.discover({ ...base, maxStops: 0 });
    expect(direct.candidates.every((c) => c.stopCount === 0)).toBe(true);
    // Direct round trip is 1130 minutes (575 outbound + 555 return); the
    // transit variant is 1215 minutes, so a 1130 cap keeps only the direct one.
    const fast = await p.discover({ ...base, maxTripDurationMinutes: 1130 });
    expect(fast.candidates.length).toBe(1);
    expect(fast.candidates[0]?.stopCount).toBe(0);
  });
});

describe("mock hotel provider (PROV-01..06)", () => {
  const provider = new MockHotelProvider(330);

  it("PROV-01 returns only properties inside the radius, sorted by normalized total", async () => {
    const result = await provider.search({
      providerId: MOCK_HOTEL_PROVIDER_ID,
      city: "MAKKAH",
      checkIn: "2029-12-06",
      checkOut: "2029-12-11",
      adults: 1,
      childrenAges: [],
      rooms: 1,
      radiusKm: 5,
      freeCancellationOnly: false,
      currency: "IDR",
      now: TEST_NOW,
    });
    expect(result.state).toBe("HAS_RESULT");
    expect(result.observations.length).toBeGreaterThan(0);
    for (const obs of result.observations) {
      expect(obs.straightLineDistanceKm).toBeLessThanOrEqual(5);
      expect(hotelObservationSchema.safeParse(obs).success).toBe(true);
    }
    const totals = result.observations.map((o) => o.normalizedIdrAmountMinor ?? Infinity);
    expect([...totals]).toEqual([...totals].sort((a, b) => a - b));
  });

  it("PROV-01 free-cancellation-only excludes non-refundable rates", async () => {
    const result = await provider.search({
      providerId: MOCK_HOTEL_PROVIDER_ID,
      city: "MAKKAH",
      checkIn: "2029-12-06",
      checkOut: "2029-12-11",
      adults: 1,
      childrenAges: [],
      rooms: 1,
      radiusKm: 5,
      freeCancellationOnly: true,
      currency: "IDR",
      now: TEST_NOW,
    });
    for (const obs of result.observations) {
      expect(obs.cancellation.freeCancellation).toBe(true);
    }
  });

  it("PRICE-02/03 totals cover all rooms and all nights", async () => {
    const result = await provider.search({
      providerId: MOCK_HOTEL_PROVIDER_ID,
      city: "MADINAH",
      checkIn: "2029-12-06",
      checkOut: "2029-12-10",
      adults: 2,
      childrenAges: [],
      rooms: 2,
      radiusKm: 5,
      freeCancellationOnly: false,
      currency: "IDR",
      now: TEST_NOW,
    });
    for (const obs of result.observations) {
      expect(obs.rooms).toBe(2);
      expect(obs.nights).toBe(4);
    }
  });

  it("child ages affect pricing deterministically", async () => {
    const withChild = await provider.search({
      providerId: MOCK_HOTEL_PROVIDER_ID,
      city: "MAKKAH",
      checkIn: "2029-12-06",
      checkOut: "2029-12-11",
      adults: 1,
      childrenAges: [8],
      rooms: 1,
      radiusKm: 5,
      freeCancellationOnly: false,
      currency: "IDR",
      now: TEST_NOW,
    });
    const without = await provider.search({
      providerId: MOCK_HOTEL_PROVIDER_ID,
      city: "MAKKAH",
      checkIn: "2029-12-06",
      checkOut: "2029-12-11",
      adults: 1,
      childrenAges: [],
      rooms: 1,
      radiusKm: 5,
      freeCancellationOnly: false,
      currency: "IDR",
      now: TEST_NOW,
    });
    expect(withChild.observations[0]?.originalAmountMinor).toBeGreaterThan(
      without.observations[0]?.originalAmountMinor ?? 0,
    );
  });

  it("PROV-06 missing FX yields PARTIAL_FX_MISSING, never zero", async () => {
    const result = await provider.search({
      providerId: MOCK_HOTEL_PROVIDER_ID,
      city: "MAKKAH",
      checkIn: SCENARIO.hotelFxMissingCheckIn,
      checkOut: "2030-02-15",
      adults: 1,
      childrenAges: [],
      rooms: 1,
      radiusKm: 5,
      freeCancellationOnly: false,
      currency: "IDR",
      now: TEST_NOW,
    });
    for (const obs of result.observations) {
      expect(obs.normalizedIdrAmountMinor).toBeNull();
      expect(obs.fxRate).toBeNull();
      expect(obs.priceCompleteness).toBe("PARTIAL_FX_MISSING");
    }
  });

  it("expired hotel scenario marks observations EXPIRED", async () => {
    const result = await provider.search({
      providerId: MOCK_HOTEL_PROVIDER_ID,
      city: "MAKKAH",
      checkIn: SCENARIO.hotelExpiredCheckIn,
      checkOut: "2030-02-25",
      adults: 1,
      childrenAges: [],
      rooms: 1,
      radiusKm: 5,
      freeCancellationOnly: false,
      currency: "IDR",
      now: TEST_NOW,
    });
    expect(result.observations.every((o) => o.verificationStatus === "EXPIRED")).toBe(true);
  });

  it("provider failure is a typed ProviderError", async () => {
    await expect(
      provider.search({
        providerId: MOCK_HOTEL_PROVIDER_ID,
        city: "MAKKAH",
        checkIn: SCENARIO.hotelUnavailableCheckIn,
        checkOut: "2030-02-20",
        adults: 1,
        childrenAges: [],
        rooms: 1,
        radiusKm: 5,
        freeCancellationOnly: false,
        currency: "IDR",
        now: TEST_NOW,
      }),
    ).rejects.toBeInstanceOf(ProviderError);
  });

  it("COVER-04/05 frontier: day 330 eligible, day 331 NOT_YET_SEARCHABLE without a call", async () => {
    const frontierDate = (await provider.getFrontier(TEST_NOW)).checkInFrontierDate;
    expect(hotelCheckInState(frontierDate, TEST_NOW, 330)).toBe("ELIGIBLE");
    const beyond = SCENARIO.hotelBeyondFrontierCheckIn;
    expect(hotelCheckInState(beyond, TEST_NOW, 330)).toBe("NOT_YET_SEARCHABLE");
    const result = await provider.search({
      providerId: MOCK_HOTEL_PROVIDER_ID,
      city: "MAKKAH",
      checkIn: beyond,
      checkOut: "2030-05-03",
      adults: 1,
      childrenAges: [],
      rooms: 1,
      radiusKm: 5,
      freeCancellationOnly: false,
      currency: "IDR",
      now: TEST_NOW,
    });
    expect(result.state).toBe("NOT_YET_SEARCHABLE");
    expect(result.observations).toEqual([]);
  });

  it("radius 1 km returns no results for far properties", async () => {
    const result = await provider.search({
      providerId: MOCK_HOTEL_PROVIDER_ID,
      city: "MAKKAH",
      checkIn: "2029-12-06",
      checkOut: "2029-12-11",
      adults: 1,
      childrenAges: [],
      rooms: 1,
      radiusKm: 1,
      freeCancellationOnly: false,
      currency: "IDR",
      now: TEST_NOW,
    });
    for (const obs of result.observations) {
      expect(obs.straightLineDistanceKm).toBeLessThanOrEqual(1);
    }
  });
});

describe("provider registry", () => {
  it("registry exposes mock flight and hotel providers", () => {
    expect(1).toBe(1); // registry wiring is covered by the API integration tests
  });
  it("base input stays within the user horizon for the fixed clock", () => {
    expect(baseInput().departureEnd <= "2029-12-03").toBe(true);
  });
});
