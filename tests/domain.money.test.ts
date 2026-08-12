import { describe, expect, it } from "vitest";
import { normalizeToIdrMinor, perPersonEquivalent, assertNonNegativeInteger } from "../src/domain/money.js";
import { planPriceCompleteness, hotelPriceCompleteness } from "../src/domain/completeness.js";
import type { HotelObservation, PriceCompleteness } from "../src/domain/types.js";

describe("money arithmetic (PRICE-01..13)", () => {
  it("PRICE-07 normalizes original amounts with FX to exact IDR minor units", () => {
    expect(normalizeToIdrMinor(12345, "USD", 16_000)).toBe(1_975_200);
    expect(normalizeToIdrMinor(77200, "SAR", 4_266)).toBe(3_293_352);
    expect(normalizeToIdrMinor(4_410_000, "IDR", 1)).toBe(4_410_000);
  });

  it("PRICE-08 missing amounts are never converted to zero", () => {
    expect(() => normalizeToIdrMinor(-1, "IDR", 1)).toThrow();
    expect(() => assertNonNegativeInteger(0.5, "x")).toThrow();
  });

  it("per-person equivalent derives from the party total", () => {
    expect(perPersonEquivalent(14_000_000, 2, [])).toBe(7_000_000);
    expect(perPersonEquivalent(14_000_000, 2, [1])).toBe(4_666_667);
  });

  it("PRICE-09 unknown mandatory fee yields PARTIAL_FEES_UNKNOWN", () => {
    const hotel = mockHotel({ mandatoryFeeAmountMinor: null });
    expect(hotelPriceCompleteness(hotel)).toBe("PARTIAL_FEES_UNKNOWN");
  });

  it("PRICE-10 missing FX yields PARTIAL_FX_MISSING", () => {
    const hotel = mockHotel({ normalizedIdrAmountMinor: null, fxRate: null });
    expect(hotelPriceCompleteness(hotel)).toBe("PARTIAL_FX_MISSING");
  });

  it("PRICE-11 missing component yields COMPONENT_MISSING", () => {
    expect(planPriceCompleteness("COMPLETE", "COMPLETE", null)).toBe("COMPONENT_MISSING");
    expect(planPriceCompleteness("COMPLETE", null, null)).toBe("COMPONENT_MISSING");
  });

  it("PRICE-12 only COMPLETE is returned when all parts are complete", () => {
    expect(planPriceCompleteness("COMPLETE", "COMPLETE", "COMPLETE")).toBe("COMPLETE");
  });

  it("partial completeness propagates from any single component", () => {
    const partial: PriceCompleteness[] = [
      planPriceCompleteness("PARTIAL_FEES_UNKNOWN", "COMPLETE", "COMPLETE"),
      planPriceCompleteness("COMPLETE", "PARTIAL_FX_MISSING", "COMPLETE"),
      planPriceCompleteness("COMPLETE", "COMPLETE", "PARTIAL_FEES_UNKNOWN"),
    ];
    expect(partial).toEqual(["PARTIAL_FEES_UNKNOWN", "PARTIAL_FX_MISSING", "PARTIAL_FEES_UNKNOWN"]);
  });
});

function mockHotel(overrides: Partial<HotelObservation>): HotelObservation {
  return {
    id: "h",
    providerId: "p",
    providerOfferId: "o",
    propertyId: "prop",
    propertyName: "Hotel",
    city: "MAKKAH",
    checkInLocalDate: "2029-12-01",
    checkOutLocalDate: "2029-12-06",
    nights: 5,
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
    normalizedIdrAmountMinor: 500_000,
    fxRate: 4_266,
    fxObservedAt: "2029-06-01T08:00:00Z",
    priceCompleteness: "COMPLETE",
    verificationStatus: "LIVE_VERIFIED",
    availabilityState: "HAS_RESULT",
    straightLineDistanceKm: 1.2,
    observedAt: "2029-06-01T08:00:00Z",
    expiresAt: "2029-06-03T08:00:00Z",
    cancellation: { freeCancellation: true, deadlineLocalDate: "2029-11-28", description: "" },
    payment: { dueNow: false, dueAtProperty: true, description: "" },
    bookingUrl: null,
    ...overrides,
  };
}
