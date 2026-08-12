// Duffel Stays adapter framework (04_PROVIDER_AND_DATA_STRATEGY.md section 4).
// First real hotel adapter once access is confirmed. Maximum documented
// check-in lead verified on 2026-08-11: 330 days. Disabled calls throw
// ACCESS_NOT_CONFIGURED; the frontier is still reported so coverage renders.
import type { AppConfig } from "../../config.js";
import { addDays, todayLocalDate } from "../../domain/dates.js";
import { MOCK_HOTEL_FRONTIER_DAYS } from "../../domain/horizons.js";
import { normalizeToIdrMinor } from "../../domain/money.js";
import { mockFxSnapshot } from "../fx.js";
import { ProviderError, type HotelFrontier, type HotelProvider, type HotelSearchInput, type HotelSearchResult, type ProviderHealthSnapshot } from "../types.js";
import type { HotelObservation, ProviderMode } from "../../domain/types.js";
import { DuffelClient } from "./duffelClient.js";

export const DUFFEL_STAYS_ADAPTER_VERSION = "duffel-stays-v1-disabled";
export const DUFFEL_STAYS_PROVIDER_ID = "duffel-stays";

const CITY_CENTERS: Record<"MAKKAH" | "MADINAH", { latitude: number; longitude: number }> = {
  MAKKAH: { latitude: 21.3891, longitude: 39.8579 },
  MADINAH: { latitude: 24.5247, longitude: 39.5692 },
};

interface DuffelStaysSearchResponse {
  data: Array<{
    accommodation_id: string;
    property: {
      id: string;
      name: string;
      latitude: number;
      longitude: number;
      address?: { line_one?: string };
    } | null;
    cheapest_accurate_total?: {
      amount: string;
      currency: string;
      accuracy?: string;
    };
  }>;
}

export class DuffelHotelProvider implements HotelProvider {
  readonly id = DUFFEL_STAYS_PROVIDER_ID;
  readonly mode: ProviderMode = "LIVE";
  readonly enabled: boolean;
  private readonly client: DuffelClient;
  private readonly frontierDays: number;
  private calls = 0;
  private failures = 0;
  private lastSuccessAt: string | null = null;

  constructor(config: AppConfig) {
    // Stays needs explicit access (documented on 2026-08-11); DUFFEL_STAYS_ENABLED
    // must be true in addition to the master switch and a token.
    this.enabled = config.realProvidersEnabled && config.duffelToken != null && config.duffelStaysEnabled;
    this.client = new DuffelClient(config.duffelToken);
    this.frontierDays = config.mockHotelFrontierDays ?? MOCK_HOTEL_FRONTIER_DAYS;
  }

  async getFrontier(now: Date): Promise<HotelFrontier> {
    return {
      providerId: this.id,
      checkInFrontierDate: addDays(todayLocalDate(now), this.frontierDays),
      observedAt: now.toISOString(),
    };
  }

  async search(input: HotelSearchInput): Promise<HotelSearchResult> {
    this.calls += 1;
    if (!this.enabled) {
      this.failures += 1;
      throw new ProviderError("ACCESS_NOT_CONFIGURED", "Duffel Stays belum diaktifkan (DUFFEL_STAYS_ENABLED)", {
        retryable: false,
      });
    }
    const center = CITY_CENTERS[input.city];
    const body = {
      check_in: input.checkIn,
      check_out: input.checkOut,
      guests: [
        ...Array.from({ length: input.adults }, () => ({ age: 30 })),
        ...input.childrenAges.map((age) => ({ age })),
      ],
      rooms: [{ count: input.rooms }],
      location: { lat: center.latitude, lon: center.longitude, radius_km: input.radiusKm },
    };
    const payload = await this.client.request<DuffelStaysSearchResponse>("/stays/search", {
      method: "POST",
      body: JSON.stringify(body),
    });
    const observedAt = input.now.toISOString();
    const observations: HotelObservation[] = [];
    for (const row of payload.data ?? []) {
      const property = row.property;
      if (!property) {
        continue;
      }
      const total = row.cheapest_accurate_total;
      if (!total) {
        continue;
      }
      const currency = total.currency as HotelObservation["originalCurrency"];
      const totalMinor = Math.round(Number(total.amount) * 100);
      const fx = mockFxSnapshot(currency, observedAt);
      observations.push({
        id: `${row.accommodation_id}-${input.checkIn}-obs-${observedAt}`,
        providerId: this.id,
        providerOfferId: row.accommodation_id,
        propertyId: property.id,
        propertyName: property.name,
        city: input.city,
        checkInLocalDate: input.checkIn,
        checkOutLocalDate: input.checkOut,
        nights: nightsBetween(input.checkIn, input.checkOut),
        adults: input.adults,
        childrenAges: input.childrenAges,
        rooms: input.rooms,
        radiusKm: input.radiusKm,
        freeCancellationOnly: input.freeCancellationOnly,
        roomName: "Rate terendah tersedia",
        rateName: "Cheapest accurate total",
        boardType: "Tidak dinyatakan",
        originalAmountMinor: totalMinor,
        originalCurrency: currency,
        taxAmountMinor: null,
        mandatoryFeeAmountMinor: null,
        dueNowAmountMinor: null,
        dueAtPropertyAmountMinor: null,
        normalizedIdrAmountMinor: normalizeToIdrMinor(totalMinor, currency, fx.rateIdrPerMajor),
        fxRate: fx.rateIdrPerMajor,
        fxObservedAt: fx.observedAt,
        priceCompleteness: "PARTIAL_FEES_UNKNOWN",
        verificationStatus: "LIVE_VERIFIED",
        availabilityState: "HAS_RESULT",
        straightLineDistanceKm: Math.round(haversineKm(center.latitude, center.longitude, property.latitude, property.longitude) * 100) / 100,
        observedAt,
        expiresAt: new Date(input.now.getTime() + 3_600_000).toISOString(),
        cancellation: { freeCancellation: false, deadlineLocalDate: null, description: "Kebijakan pembatalan menyusul dari detail rate" },
        payment: { dueNow: false, dueAtProperty: true, description: "Pembayaran di properti (belum dikonfirmasi)" },
        bookingUrl: null,
      });
    }
    this.lastSuccessAt = observedAt;
    observations.sort((a, b) => (a.normalizedIdrAmountMinor ?? 0) - (b.normalizedIdrAmountMinor ?? 0));
    return {
      state: observations.length > 0 ? "HAS_RESULT" : "NO_RESULT",
      observations,
      frontierDate: (await this.getFrontier(input.now)).checkInFrontierDate,
      observedAt,
    };
  }

  async health(): Promise<ProviderHealthSnapshot> {
    return {
      id: this.id,
      mode: this.mode,
      enabled: this.enabled,
      enabledReason: this.enabled ? "Akses Duffel Stays dikonfirmasi dan token tersedia" : null,
      disabledReason: this.enabled
        ? null
        : "Duffel Stays menunggu akses eksplisit dan token (DUFFEL_TOKEN + DUFFEL_STAYS_ENABLED)",
      adapterVersion: DUFFEL_STAYS_ADAPTER_VERSION,
      lastSuccessAt: this.lastSuccessAt,
      lastFailureCategory: this.failures > 0 ? "ACCESS_NOT_CONFIGURED" : null,
      frontier: (await this.getFrontier(new Date())).checkInFrontierDate,
      calls: this.calls,
      failures: this.failures,
      cacheHits: 0,
    };
  }
}

function nightsBetween(checkIn: string, checkOut: string): number {
  return Math.round(
    (new Date(`${checkOut}T00:00:00Z`).getTime() - new Date(`${checkIn}T00:00:00Z`).getTime()) / 86_400_000,
  );
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (deg: number): number => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
