// SerpAPI Google Hotels adapter framework (M7 replacement for Duffel Stays,
// which does not accept Indonesian registrations). Role: real-time hotel
// prices for Makkah/Madinah from Google Hotels, with links for handoff.
// Disabled until the activation gate passes; calls throw ACCESS_NOT_CONFIGURED.
import type { AppConfig } from "../../config.js";
import { addDays, todayLocalDate } from "../../domain/dates.js";
import { MOCK_HOTEL_FRONTIER_DAYS } from "../../domain/horizons.js";
import { normalizeToIdrMinor } from "../../domain/money.js";
import { mockFxSnapshot } from "../fx.js";
import { ProviderError, type HotelFrontier, type HotelProvider, type HotelSearchInput, type HotelSearchResult, type ProviderHealthSnapshot } from "../types.js";
import type { HotelObservation, ProviderMode } from "../../domain/types.js";
import { SerpapiClient } from "./serpapiClient.js";

export const SERPAPI_HOTEL_ADAPTER_VERSION = "serpapi-hotels-v1-disabled";
export const SERPAPI_HOTEL_PROVIDER_ID = "serpapi-hotels";

const CITY_CENTERS: Record<"MAKKAH" | "MADINAH", { latitude: number; longitude: number }> = {
  MAKKAH: { latitude: 21.3891, longitude: 39.8579 },
  MADINAH: { latitude: 24.5247, longitude: 39.5692 },
};

export interface GoogleHotelsProperty {
  name?: string;
  property_token?: string;
  location?: {
    latitude?: number;
    longitude?: number;
    address?: { address_line?: string };
    images?: Array<{ original_image?: string }>;
  };
  ratings?: {
    stars?: number;
    rating?: number;
    reviews?: number;
  };
  price?: { amount?: number; currency?: string; current_price?: { amount?: number; currency?: string } };
  check_in_time?: string;
  check_out_time?: string;
  [key: string]: unknown;
}

export interface GoogleHotelsPayload {
  properties?: GoogleHotelsProperty[];
  [key: string]: unknown;
}

/** Straight-line distance in km between two WGS84 points (haversine). */
export function straightLineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Pure mapping so contract tests run offline with realistic fixtures. */
export function mapGoogleHotelsPayload(
  payload: GoogleHotelsPayload,
  input: HotelSearchInput,
  now: Date,
): HotelObservation[] {
  const center = CITY_CENTERS[input.city];
  const observedAt = now.toISOString();
  const fx = mockFxSnapshot("USD", observedAt);
  const observations: HotelObservation[] = [];
  for (const prop of payload.properties ?? []) {
    const price = prop.price?.current_price?.amount ?? prop.price?.amount;
    if (price == null) {
      continue;
    }
    const lat = prop.location?.latitude ?? center.latitude;
    const lon = prop.location?.longitude ?? center.longitude;
    const totalMinor = Math.round(price * 100);
    const nights = Math.max(
      1,
      Math.round(
        (new Date(`${input.checkOut}T00:00:00Z`).getTime() -
          new Date(`${input.checkIn}T00:00:00Z`).getTime()) /
          86_400_000,
      ),
    );
    observations.push({
      id: `serpapi-hotels|${input.city}|${prop.property_token ?? prop.name ?? "?"}|${input.checkIn}|${observedAt}`,
      providerId: SERPAPI_HOTEL_PROVIDER_ID,
      providerOfferId: prop.property_token ?? prop.name ?? "unknown",
      propertyId: prop.property_token ?? prop.name ?? "unknown",
      propertyName: prop.name ?? "Hotel (Google Hotels)",
      city: input.city,
      checkInLocalDate: input.checkIn,
      checkOutLocalDate: input.checkOut,
      nights,
      adults: input.adults,
      childrenAges: input.childrenAges,
      rooms: input.rooms,
      radiusKm: input.radiusKm,
      freeCancellationOnly: input.freeCancellationOnly,
      roomName: "Standard room",
      rateName: "Harga Google Hotels",
      boardType: "ROOM_ONLY",
      originalAmountMinor: totalMinor,
      originalCurrency: "USD",
      taxAmountMinor: null,
      mandatoryFeeAmountMinor: null,
      dueNowAmountMinor: null,
      dueAtPropertyAmountMinor: totalMinor,
      normalizedIdrAmountMinor: normalizeToIdrMinor(totalMinor, "USD", fx.rateIdrPerMajor),
      fxRate: fx.rateIdrPerMajor,
      fxObservedAt: fx.observedAt,
      priceCompleteness: "PARTIAL_FEES_UNKNOWN",
      verificationStatus: "LIVE_VERIFIED",
      availabilityState: "HAS_RESULT",
      straightLineDistanceKm: straightLineKm(lat, lon, center.latitude, center.longitude),
      observedAt,
      expiresAt: new Date(now.getTime() + 6 * 3_600_000).toISOString(),
      cancellation: { freeCancellation: false, deadlineLocalDate: null, description: "Belum diverifikasi" },
      payment: { dueNow: false, dueAtProperty: true, description: "Bayar di properti (indikatif)" },
      bookingUrl: null,
    });
  }
  return observations;
}

export class SerpapiHotelProvider implements HotelProvider {
  readonly id = SERPAPI_HOTEL_PROVIDER_ID;
  readonly mode: ProviderMode = "LIVE";
  readonly enabled: boolean;
  private readonly client: SerpapiClient;
  private readonly frontierDays: number;
  private calls = 0;
  private failures = 0;
  private lastSuccessAt: string | null = null;

  constructor(config: AppConfig) {
    this.enabled = config.realProvidersEnabled && config.serpapiKey != null;
    this.client = new SerpapiClient(config.serpapiKey);
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
      throw new ProviderError(
        "ACCESS_NOT_CONFIGURED",
        "SerpAPI Google Hotels menunggu akses resmi dan API key (SERPAPI_API_KEY + REAL_PROVIDERS_ENABLED)",
        { retryable: false },
      );
    }
    const frontier = await this.getFrontier(input.now);
    if (input.checkIn > frontier.checkInFrontierDate) {
      return {
        state: "NOT_YET_SEARCHABLE",
        observations: [],
        frontierDate: frontier.checkInFrontierDate,
        observedAt: input.now.toISOString(),
      };
    }
    const observedAt = input.now.toISOString();
    const center = CITY_CENTERS[input.city];
    const payload = (await this.client.get({
      engine: "google_hotels",
      q: `Hotels in ${input.city === "MAKKAH" ? "Makkah" : "Madinah"}`,
      check_in_date: input.checkIn,
      check_out_date: input.checkOut,
      adults: input.adults,
      currency: "USD",
      gl: "id",
      hl: "en",
      latitude: center.latitude,
      longitude: center.longitude,
    })) as GoogleHotelsPayload;
    let observations = mapGoogleHotelsPayload(payload, input, input.now);
    observations = observations
      .filter((o) => o.straightLineDistanceKm <= input.radiusKm)
      .slice(0, 50);
    this.lastSuccessAt = observedAt;
    return {
      state: observations.length > 0 ? "HAS_RESULT" : "NO_RESULT",
      observations,
      frontierDate: frontier.checkInFrontierDate,
      observedAt,
    };
  }

  async health(): Promise<ProviderHealthSnapshot> {
    return {
      id: this.id,
      mode: this.mode,
      enabled: this.enabled,
      enabledReason: this.enabled ? "Akses SerpAPI dikonfirmasi dan API key tersedia" : null,
      disabledReason: this.enabled
        ? null
        : "SerpAPI Google Hotels menunggu akses resmi dan API key (SERPAPI_API_KEY + REAL_PROVIDERS_ENABLED)",
      adapterVersion: SERPAPI_HOTEL_ADAPTER_VERSION,
      lastSuccessAt: this.lastSuccessAt,
      lastFailureCategory: this.failures > 0 ? "ACCESS_NOT_CONFIGURED" : null,
      frontier: await this.getFrontier(new Date()).then((f) => f.checkInFrontierDate),
      calls: this.calls,
      failures: this.failures,
      cacheHits: 0,
    };
  }
}
