// Deterministic Mock HotelProvider for Makkah and Madinah.
// Prices are pure functions of inputs; the provider never fabricates coverage.
import { addDays, dateDiffDays, todayLocalDate } from "../../domain/dates.js";
import { hotelCheckInState } from "../../domain/horizons.js";
import { hotelPriceCompleteness } from "../../domain/completeness.js";
import { normalizeToIdrMinor } from "../../domain/money.js";
import type { City, HotelObservation } from "../../domain/types.js";
import { mockFxSnapshot } from "../fx.js";
import type {
  HotelFrontier,
  HotelProvider,
  HotelSearchInput,
  HotelSearchResult,
  ProviderHealthSnapshot,
} from "../types.js";
import { ProviderError } from "../types.js";
import {
  CITY_AREAS,
  HOTEL_ADAPTER_VERSION,
  MOCK_HOTEL_PROVIDER_ID,
  MOCK_PROPERTIES,
  SCENARIO,
  haversineKm,
  mockHotelRateSar,
} from "./fixtures.js";
import { stableId } from "./mockFlightProvider.js";

const OFFER_TTL_MS = 48 * 3_600_000;
const MANDATORY_FEE_SAR = 25; // major units; stored as minor below
const TAX_FRACTION = 0.15;
const SAR_MINOR_PER_MAJOR = 100;

export class MockHotelProvider implements HotelProvider {
  readonly id = MOCK_HOTEL_PROVIDER_ID;
  readonly mode = "MOCK" as const;
  private frontierDays: number;
  private calls = 0;
  private failures = 0;
  private lastSuccessAt: string | null = null;

  constructor(frontierDays: number) {
    this.frontierDays = frontierDays;
  }

  async getFrontier(now: Date): Promise<HotelFrontier> {
    this.calls += 1;
    this.lastSuccessAt = now.toISOString();
    return {
      providerId: this.id,
      checkInFrontierDate: addDays(todayLocalDate(now), this.frontierDays),
      observedAt: now.toISOString(),
    };
  }

  async search(input: HotelSearchInput): Promise<HotelSearchResult> {
    this.calls += 1;
    const now = input.now;
    const observedAt = now.toISOString();
    const frontierDate = addDays(todayLocalDate(now), this.frontierDays);

    // Defensive frontier check: day frontierDays + 1 is never called.
    if (hotelCheckInState(input.checkIn, now, this.frontierDays) === "NOT_YET_SEARCHABLE") {
      return {
        state: "NOT_YET_SEARCHABLE",
        observations: [],
        frontierDate,
        observedAt,
      };
    }

    if (input.checkIn === SCENARIO.hotelUnavailableCheckIn) {
      this.failures += 1;
      throw new ProviderError(
        "PROVIDER_UNAVAILABLE",
        `Mock hotel provider unavailable for ${input.city} on ${input.checkIn}`,
        { retryable: true, nextEligibleAt: new Date(now.getTime() + 3_600_000).toISOString() },
      );
    }
    this.lastSuccessAt = observedAt;

    const center = CITY_AREAS[input.city];
    const nights = dateDiffDays(input.checkIn, input.checkOut);
    const observations: HotelObservation[] = [];

    for (const property of MOCK_PROPERTIES[input.city]) {
      const distanceKm = haversineKm(center.latitude, center.longitude, property.latitude, property.longitude);
      if (distanceKm > input.radiusKm) {
        continue;
      }
      if (input.freeCancellationOnly && !property.freeCancellation) {
        continue;
      }

      observations.push(
        this.buildObservation(input, property, nights, distanceKm, observedAt, now),
      );
    }

    observations.sort((a, b) => (a.normalizedIdrAmountMinor ?? 0) - (b.normalizedIdrAmountMinor ?? 0));
    return {
      state: observations.length > 0 ? "HAS_RESULT" : "NO_RESULT",
      observations,
      frontierDate,
      observedAt,
    };
  }

  private buildObservation(
    input: HotelSearchInput,
    property: (typeof MOCK_PROPERTIES)[City][number],
    nights: number,
    distanceKm: number,
    observedAt: string,
    now: Date,
  ): HotelObservation {
    const totalSar = mockHotelRateSar(property, input.checkIn, nights, input.rooms, input.childrenAges);
    const totalSarMinor = Math.round(totalSar * SAR_MINOR_PER_MAJOR);
    const taxAmountMinor = Math.round(totalSar * TAX_FRACTION * SAR_MINOR_PER_MAJOR);
    const mandatoryFeeAmountMinor = MANDATORY_FEE_SAR * SAR_MINOR_PER_MAJOR;
    const dueNowAmountMinor = Math.round(totalSar * property.dueNowFraction * SAR_MINOR_PER_MAJOR);
    const dueAtPropertyAmountMinor =
      totalSarMinor + taxAmountMinor + mandatoryFeeAmountMinor - dueNowAmountMinor;

    let normalizedIdrAmountMinor: number | null;
    let fxRate: number | null;
    let fxObservedAt: string | null;
    let verificationStatus: HotelObservation["verificationStatus"] = "LIVE_VERIFIED";
    let expiresAt = new Date(now.getTime() + OFFER_TTL_MS).toISOString();

    if (input.checkIn === SCENARIO.hotelFxMissingCheckIn) {
      normalizedIdrAmountMinor = null;
      fxRate = null;
      fxObservedAt = null;
    } else {
      const fx = mockFxSnapshot("SAR", observedAt);
      fxRate = fx.rateIdrPerMajor;
      fxObservedAt = fx.observedAt;
      normalizedIdrAmountMinor = normalizeToIdrMinor(
        totalSarMinor + taxAmountMinor + mandatoryFeeAmountMinor,
        "SAR",
        fx.rateIdrPerMajor,
      );
    }

    if (input.checkIn === SCENARIO.hotelExpiredCheckIn) {
      verificationStatus = "EXPIRED";
      expiresAt = new Date(now.getTime() - 3_600_000).toISOString();
    }

    const priceCompleteness = hotelPriceCompleteness({
      id: "base",
      providerId: this.id,
      providerOfferId: "base",
      propertyId: "base",
      propertyName: "base",
      city: input.city,
      checkInLocalDate: input.checkIn,
      checkOutLocalDate: input.checkOut,
      nights,
      adults: input.adults,
      childrenAges: input.childrenAges,
      rooms: input.rooms,
      radiusKm: input.radiusKm,
      freeCancellationOnly: input.freeCancellationOnly,
      roomName: "base",
      rateName: "base",
      boardType: "base",
      originalAmountMinor: totalSarMinor + taxAmountMinor + mandatoryFeeAmountMinor,
      originalCurrency: "SAR",
      taxAmountMinor,
      mandatoryFeeAmountMinor,
      dueNowAmountMinor,
      dueAtPropertyAmountMinor,
      normalizedIdrAmountMinor,
      fxRate,
      fxObservedAt,
      priceCompleteness: "COMPLETE",
      verificationStatus,
      availabilityState: "HAS_RESULT",
      straightLineDistanceKm: distanceKm,
      observedAt,
      expiresAt,
      cancellation: { freeCancellation: false, deadlineLocalDate: null, description: "" },
      payment: { dueNow: false, dueAtProperty: true, description: "" },
      bookingUrl: null,
    });

    const children = input.childrenAges.join("-");
    const providerOfferId = stableId("offer", property.propertyId, input.checkIn, input.checkOut, input.rooms, input.adults, children || "0");

    return {
      id: `${providerOfferId}-obs`,
      providerId: this.id,
      providerOfferId,
      propertyId: property.propertyId,
      propertyName: property.name,
      city: input.city,
      checkInLocalDate: input.checkIn,
      checkOutLocalDate: input.checkOut,
      nights,
      adults: input.adults,
      childrenAges: input.childrenAges,
      rooms: input.rooms,
      radiusKm: input.radiusKm,
      freeCancellationOnly: input.freeCancellationOnly,
      roomName: property.roomName,
      rateName: property.rateName,
      boardType: property.boardType,
      originalAmountMinor: totalSarMinor + taxAmountMinor + mandatoryFeeAmountMinor,
      originalCurrency: "SAR",
      taxAmountMinor,
      mandatoryFeeAmountMinor,
      dueNowAmountMinor,
      dueAtPropertyAmountMinor,
      normalizedIdrAmountMinor,
      fxRate,
      fxObservedAt,
      priceCompleteness,
      verificationStatus,
      availabilityState: "HAS_RESULT",
      straightLineDistanceKm: distanceKm,
      observedAt,
      expiresAt,
      cancellation: {
        freeCancellation: property.freeCancellation,
        deadlineLocalDate: property.freeCancellation ? addDays(input.checkIn, -3) : null,
        description: property.freeCancellation
          ? "Pembatalan gratis sebelum batas waktu"
          : "Tidak refundable",
      },
      payment: {
        dueNow: dueNowAmountMinor > 0,
        dueAtProperty: dueAtPropertyAmountMinor > 0,
        description: dueNowAmountMinor > 0
          ? "Sebagian dibayar saat booking, sisanya di properti"
          : "Dibayar di properti saat check-in",
      },
      bookingUrl: `https://mock.example/stays/${property.propertyId}/rate/${providerOfferId}`,
    };
  }

  async health(): Promise<ProviderHealthSnapshot> {
    return {
      id: this.id,
      mode: this.mode,
      enabled: true,
      enabledReason: "Deterministic mock provider, always available",
      disabledReason: null,
      adapterVersion: HOTEL_ADAPTER_VERSION,
      lastSuccessAt: this.lastSuccessAt,
      lastFailureCategory: this.failures > 0 ? "PROVIDER_UNAVAILABLE" : null,
      frontier: addDays(todayLocalDate(new Date()), this.frontierDays),
      calls: this.calls,
      failures: this.failures,
      cacheHits: 0,
    };
  }
}
