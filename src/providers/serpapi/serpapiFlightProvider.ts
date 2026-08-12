// SerpAPI Google Flights adapter framework (M6 live verification replacement).
// Role: selective LIVE verification of top candidates with real-time Google
// Flights prices and booking deep links. Broad horizon discovery stays on the
// free Travelpayouts/Aviasales adapter (INDICATIVE), matching spec section 4:
// never call live verification for the whole broad result set.
// The adapter stays disabled until the activation gate passes: official docs,
// approved account, server-side key, allowed terms, tested fixtures, and a
// successful server-side smoke test. Disabled calls throw ACCESS_NOT_CONFIGURED.
import type { AppConfig } from "../../config.js";
import { addDays } from "../../domain/dates.js";
import { normalizeToIdrMinor } from "../../domain/money.js";
import { mockFxSnapshot } from "../fx.js";
import { ProviderError, type FlightDiscoveryInput, type FlightDiscoveryResult, type FlightProvider, type FlightVerificationInput, type FlightVerificationResult, type ProviderHealthSnapshot } from "../types.js";
import type { FlightCandidate, FlightObservation, ProviderMode } from "../../domain/types.js";
import { patternAirports } from "../travelpayouts/travelpayoutsFlightProvider.js";
import { SerpapiClient } from "./serpapiClient.js";

export const SERPAPI_FLIGHT_ADAPTER_VERSION = "serpapi-flights-v1-disabled";
export const SERPAPI_FLIGHT_PROVIDER_ID = "serpapi-flights";

const OFFER_TTL_MS = 6 * 3_600_000;

export interface GoogleFlightsRow {
  flights: Array<{
    departure_airport?: { id?: string; time?: string };
    arrival_airport?: { id?: string; time?: string };
    duration?: number;
    airline?: string;
    flight_number?: string;
  }>;
  total_duration?: number;
  price?: number;
  type?: string;
  deep_link?: string;
  booking_token?: string;
  [key: string]: unknown;
}

export interface GoogleFlightsPayload {
  search_metadata?: { google_url?: string; id?: string };
  best_flights?: GoogleFlightsRow[];
  other_flights?: GoogleFlightsRow[];
  price_insights?: { lowest_price?: number; typical_price_range?: number[] };
  [key: string]: unknown;
}

/** Pure mapping so contract tests run offline with realistic fixtures. */
export function mapGoogleFlightsPayload(
  payload: GoogleFlightsPayload,
  input: FlightDiscoveryInput,
  now: Date,
): FlightCandidate[] {
  const candidates: FlightCandidate[] = [];
  const rows = [...(payload.best_flights ?? []), ...(payload.other_flights ?? [])];
  for (const pattern of input.patterns) {
    const { outboundAirport, returnAirport } = patternAirports(pattern);
    rows.forEach((row, index) => {
      const segments = row.flights ?? [];
      const first = segments[0];
      const last = segments[segments.length - 1];
      const departureLocalDate = first?.departure_airport?.time?.slice(0, 10) ?? input.departureStart;
      const returnLocalDate = last?.arrival_airport?.time?.slice(0, 10) ?? input.departureEnd;
      if (row.price == null) {
        return;
      }
      candidates.push({
        id: `serpapi|${input.origin}|${outboundAirport}|${departureLocalDate}|${returnLocalDate}|${pattern}|${index}`,
        providerId: SERPAPI_FLIGHT_PROVIDER_ID,
        origin: input.origin,
        outboundAirport,
        returnAirport,
        departureLocalDate,
        returnLocalDate,
        pattern,
        stopCount: segments.length > 1 ? segments.length - 1 : 0,
        durationMinutes: row.total_duration ?? 0,
        indicativeTotalMinor: Math.round(row.price * 100),
        currency: "USD",
        observedAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + OFFER_TTL_MS).toISOString(),
        verificationStatus: "INDICATIVE",
        canonicalKey: `serpapi|${input.origin}|${outboundAirport}|${departureLocalDate}|${returnLocalDate}|${pattern}`,
      });
    });
  }
  return candidates;
}

/** Map a verified row into an observation, attaching the allowlisted deep link. */
export function mapGoogleFlightsObservation(
  row: GoogleFlightsRow,
  candidate: FlightCandidate,
  input: FlightVerificationInput,
  observedAt: string,
): FlightObservation {
  const currency = "USD" as const;
  const totalMinor = Math.round((row.price ?? 0) * 100);
  const fx = mockFxSnapshot(currency, observedAt);
  const segments = (row.flights ?? []).map((seg) => ({
    carrier: seg.airline ?? "Unknown",
    flightNumber: seg.flight_number ?? "0",
    fromAirport: seg.departure_airport?.id ?? candidate.outboundAirport,
    toAirport: seg.arrival_airport?.id ?? candidate.returnAirport,
    departureLocal: seg.departure_airport?.time ?? candidate.departureLocalDate,
    departureOffsetMinutes: 0,
    arrivalLocal: seg.arrival_airport?.time ?? candidate.returnLocalDate,
    arrivalOffsetMinutes: 0,
    departureUtcInstant: seg.departure_airport?.time ?? "",
    arrivalUtcInstant: seg.arrival_airport?.time ?? "",
  }));
  return {
    id: `${candidate.id}-obs-${observedAt}`,
    providerId: SERPAPI_FLIGHT_PROVIDER_ID,
    providerOfferId: row.booking_token ?? row.deep_link ?? candidate.id,
    candidateId: candidate.id,
    observedAt,
    expiresAt: new Date(new Date(observedAt).getTime() + OFFER_TTL_MS).toISOString(),
    adults: input.adults,
    childrenAges: input.childrenAges,
    cabin: input.cabin as FlightObservation["cabin"],
    segments,
    stopCount: segments.length > 1 ? segments.length - 1 : 0,
    durationMinutes: row.total_duration ?? candidate.durationMinutes,
    outboundArrivalUtcInstant: segments[0]?.arrivalUtcInstant ?? "",
    outboundArrivalOffsetMinutes: 180,
    outboundArrivalSaudiDate: candidate.departureLocalDate,
    returnDepartureUtcInstant: segments[1]?.departureUtcInstant ?? "",
    returnDepartureOffsetMinutes: 180,
    returnDepartureSaudiDate: candidate.returnLocalDate,
    outboundAirport: candidate.outboundAirport,
    returnAirport: candidate.returnAirport,
    departureLocalDate: candidate.departureLocalDate,
    returnLocalDate: candidate.returnLocalDate,
    pattern: candidate.pattern,
    originalAmountMinor: totalMinor,
    originalCurrency: currency,
    taxAmountMinor: null,
    mandatoryFeeAmountMinor: null,
    dueNowAmountMinor: null,
    normalizedIdrAmountMinor: normalizeToIdrMinor(totalMinor, currency, fx.rateIdrPerMajor),
    fxRate: fx.rateIdrPerMajor,
    fxObservedAt: fx.observedAt,
    priceCompleteness: "PARTIAL_FEES_UNKNOWN",
    verificationStatus: "LIVE_VERIFIED",
    bookingUrl: row.deep_link ?? null,
    conditions: ["Harga dan ketersediaan diambil langsung dari Google Flights"],
    baggage: [],
    schemaVersion: "serpapi-flights-v1",
  };
}

export class SerpapiFlightProvider implements FlightProvider {
  readonly id = SERPAPI_FLIGHT_PROVIDER_ID;
  readonly mode: ProviderMode = "LIVE";
  readonly enabled: boolean;
  private readonly client: SerpapiClient;
  private calls = 0;
  private failures = 0;
  private lastSuccessAt: string | null = null;

  constructor(config: AppConfig) {
    this.enabled = config.realProvidersEnabled && config.serpapiKey != null;
    this.client = new SerpapiClient(config.serpapiKey);
  }

  async discover(input: FlightDiscoveryInput): Promise<FlightDiscoveryResult> {
    this.calls += 1;
    if (!this.enabled) {
      this.failures += 1;
      throw new ProviderError(
        "ACCESS_NOT_CONFIGURED",
        "SerpAPI Google Flights menunggu akses resmi dan API key (SERPAPI_API_KEY + REAL_PROVIDERS_ENABLED)",
        { retryable: false },
      );
    }
    const observedAt = input.now.toISOString();
    const payload = (await this.client.get({
      engine: "google_flights",
      departure_id: input.origin,
      arrival_id: "JED",
      outbound_date: input.departureStart,
      return_date: input.departureEnd,
      type: "1",
      currency: "USD",
      hl: "en",
      gl: "ID",
      adults: input.adults,
    })) as GoogleFlightsPayload;
    const candidates = mapGoogleFlightsPayload(payload, input, input.now);
    if (candidates.length === 0) {
      this.failures += 1;
      throw new ProviderError("NOT_FOUND", "Google Flights tanpa hasil", { retryable: false });
    }
    this.lastSuccessAt = observedAt;
    return { candidates, observedAt };
  }

  async verify(input: FlightVerificationInput): Promise<FlightVerificationResult> {
    this.calls += 1;
    if (!this.enabled) {
      this.failures += 1;
      throw new ProviderError(
        "ACCESS_NOT_CONFIGURED",
        "SerpAPI Google Flights menunggu akses resmi dan API key (SERPAPI_API_KEY + REAL_PROVIDERS_ENABLED)",
        { retryable: false },
      );
    }
    const { candidate } = input;
    const observedAt = input.now.toISOString();
    const payload = (await this.client.get({
      engine: "google_flights",
      departure_id: candidate.origin,
      arrival_id: candidate.outboundAirport,
      outbound_date: candidate.departureLocalDate,
      return_date: candidate.returnLocalDate,
      type: "1",
      currency: "USD",
      hl: "en",
      gl: "ID",
      adults: input.adults,
    })) as GoogleFlightsPayload;
    const rows = [...(payload.best_flights ?? []), ...(payload.other_flights ?? [])];
    const row = rows.find((r) => r.price != null);
    if (!row) {
      this.failures += 1;
      throw new ProviderError("NOT_FOUND", "Offer Google Flights tidak ditemukan saat verifikasi", { retryable: false });
    }
    this.lastSuccessAt = observedAt;
    return { observation: mapGoogleFlightsObservation(row, candidate, input, observedAt) };
  }

  async health(): Promise<ProviderHealthSnapshot> {
    return {
      id: this.id,
      mode: this.mode,
      enabled: this.enabled,
      enabledReason: this.enabled ? "Akses SerpAPI dikonfirmasi dan API key tersedia" : null,
      disabledReason: this.enabled
        ? null
        : "SerpAPI Google Flights menunggu akses resmi dan API key (SERPAPI_API_KEY + REAL_PROVIDERS_ENABLED)",
      adapterVersion: SERPAPI_FLIGHT_ADAPTER_VERSION,
      lastSuccessAt: this.lastSuccessAt,
      lastFailureCategory: this.failures > 0 ? "ACCESS_NOT_CONFIGURED" : null,
      frontier: null,
      calls: this.calls,
      failures: this.failures,
      cacheHits: 0,
    };
  }
}

/** Small helper re-exported so callers can compute horizons without the provider. */
export function serpapiFlightFrontierDate(now: Date, technicalHorizonDays: number): string {
  return addDays(now.toISOString().slice(0, 10), technicalHorizonDays);
}
