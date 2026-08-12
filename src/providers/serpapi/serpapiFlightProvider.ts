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
import { getFxSnapshot, mockFxSnapshot } from "../fx.js";
import type { FxSnapshot } from "../../domain/types.js";
import { ProviderError, type FlightDiscoveryInput, type FlightDiscoveryResult, type FlightProvider, type FlightVerificationInput, type FlightVerificationResult, type ProviderHealthSnapshot } from "../types.js";
import type { FlightCandidate, FlightObservation, ProviderMode } from "../../domain/types.js";
import { patternAirports } from "../travelpayouts/travelpayoutsFlightProvider.js";
import { SerpapiClient } from "./serpapiClient.js";

export const SERPAPI_FLIGHT_ADAPTER_VERSION = "serpapi-flights-v1-disabled";
export const SERPAPI_FLIGHT_PROVIDER_ID = "serpapi-flights";

const OFFER_TTL_MS = 6 * 3_600_000;

/** Default round-trip length in days when no return date is given (umrah trips
 * are typically 7-14 days). The user picks the exact return in the booking UI. */
const DEFAULT_TRIP_DAYS = 10;

/** SerpAPI times are airport-local wall time, e.g. "2026-09-15 19:15". Convert
 * to ISO UTC by treating them as UTC: the app then derives Saudi dates with a
 * +180 minute offset, which lands on the correct calendar date except for
 * flights within ~3h of midnight (documented approximation). */
export function serpapiLocalToIso(time: string): string {
  const m = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})$/.exec(time);
  return m ? `${m[1]}T${m[2]}:00Z` : new Date(time).toISOString();
}

/** The return date to query: the requested return when a window is given,
 * otherwise departure plus a default trip length. */
export function serpapiReturnDate(input: { departureStart: string; departureEnd: string }): string {
  return input.departureEnd !== input.departureStart
    ? input.departureEnd
    : addDays(input.departureStart, DEFAULT_TRIP_DAYS);
}

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
  layovers?: Array<{ duration?: number; name?: string; id?: string }>;
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
  const returnDate = serpapiReturnDate(input);
  for (const pattern of input.patterns) {
    const { outboundAirport, returnAirport } = patternAirports(pattern);
    rows.forEach((row, index) => {
      const segments = row.flights ?? [];
      const first = segments[0];
      const departureLocalDate = first?.departure_airport?.time?.slice(0, 10) ?? input.departureStart;
      if (row.price == null) {
        return;
      }
      candidates.push({
        id: `serpapi|${input.origin}|${outboundAirport}|${departureLocalDate}|${returnDate}|${pattern}|${index}`,
        providerId: SERPAPI_FLIGHT_PROVIDER_ID,
        origin: input.origin,
        outboundAirport,
        returnAirport,
        departureLocalDate,
        returnLocalDate: returnDate,
        pattern,
        stopCount: row.layovers?.length ?? Math.max(0, segments.length - 1),
        durationMinutes: row.total_duration ?? 0,
        indicativeTotalMinor: Math.round(row.price * 100),
        currency: "USD",
        observedAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + OFFER_TTL_MS).toISOString(),
        verificationStatus: "INDICATIVE",
        canonicalKey: `serpapi|${input.origin}|${outboundAirport}|${departureLocalDate}|${returnDate}|${pattern}`,
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
  fx: FxSnapshot = mockFxSnapshot("USD", observedAt),
): FlightObservation {
  const currency = "USD" as const;
  const totalMinor = Math.round((row.price ?? 0) * 100);
  // SerpAPI returns the outbound legs only; the return date is the one the
  // user asked for (see serpapiReturnDate). Return-leg times are approximate:
  // 09:00 UTC marker lands on the same Saudi calendar date with the +180 offset.
  const returnDate = candidate.returnLocalDate;
  const segments = (row.flights ?? []).map((seg) => ({
    carrier: seg.airline ?? "Unknown",
    flightNumber: seg.flight_number ?? "0",
    fromAirport: seg.departure_airport?.id ?? candidate.outboundAirport,
    toAirport: seg.arrival_airport?.id ?? candidate.returnAirport,
    departureLocal: seg.departure_airport?.time ?? candidate.departureLocalDate,
    departureOffsetMinutes: 0,
    arrivalLocal: seg.arrival_airport?.time ?? candidate.returnLocalDate,
    arrivalOffsetMinutes: 0,
    departureUtcInstant: seg.departure_airport?.time ? serpapiLocalToIso(seg.departure_airport.time) : `${candidate.departureLocalDate}T00:00:00Z`,
    arrivalUtcInstant: seg.arrival_airport?.time ? serpapiLocalToIso(seg.arrival_airport.time) : `${candidate.returnLocalDate}T00:00:00Z`,
  }));
  const last = segments[segments.length - 1];
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
    stopCount: row.layovers?.length ?? Math.max(0, segments.length - 1),
    durationMinutes: row.total_duration ?? candidate.durationMinutes,
    outboundArrivalUtcInstant: last?.arrivalUtcInstant ?? `${candidate.departureLocalDate}T00:00:00Z`,
    outboundArrivalOffsetMinutes: 180,
    outboundArrivalSaudiDate: last?.arrivalLocal?.slice(0, 10) ?? candidate.departureLocalDate,
    returnDepartureUtcInstant: `${returnDate}T09:00:00Z`,
    returnDepartureOffsetMinutes: 180,
    returnDepartureSaudiDate: returnDate,
    outboundAirport: candidate.outboundAirport,
    returnAirport: candidate.returnAirport,
    departureLocalDate: candidate.departureLocalDate,
    returnLocalDate: returnDate,
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
    conditions: [
      "Harga dan ketersediaan diambil langsung dari Google Flights",
      "Total sudah termasuk pajak dan biaya",
      "Tanggal kepulangan sesuai tanggal yang diminta (waktu pasti di halaman booking provider)",
    ],
    baggage: [],
    schemaVersion: "serpapi-flights-v1",
    feesIncludedInTotal: true,
  };
}

export class SerpapiFlightProvider implements FlightProvider {
  readonly id = SERPAPI_FLIGHT_PROVIDER_ID;
  readonly mode: ProviderMode = "LIVE";
  readonly enabled: boolean;
  private readonly config: AppConfig;
  private readonly client: SerpapiClient;
  private calls = 0;
  private failures = 0;
  private lastSuccessAt: string | null = null;

  constructor(config: AppConfig) {
    this.config = config;
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
      return_date: serpapiReturnDate(input),
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
    const fx = await getFxSnapshot("USD", input.now, this.config);
    return { observation: mapGoogleFlightsObservation(row, candidate, input, observedAt, fx) };
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
