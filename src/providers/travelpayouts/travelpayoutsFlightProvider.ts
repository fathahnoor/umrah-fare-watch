// Travelpayouts / Aviasales Data API adapter framework (04_PROVIDER_AND_DATA_STRATEGY.md
// section 3). Role: broad INDICATIVE discovery across the rolling horizon.
// The adapter stays disabled until the activation gate passes: official docs,
// approved account, server-side token, allowed terms, tested fixtures, and a
// successful server-side smoke test. When disabled, calls throw
// ACCESS_NOT_CONFIGURED and the app keeps using the mock provider.
import { normalizeToIdrMinor } from "../../domain/money.js";
import { mockFxSnapshot } from "../fx.js";
import { ProviderError, type FlightDiscoveryInput, type FlightDiscoveryResult, type FlightProvider, type FlightVerificationInput, type FlightVerificationResult, type ProviderHealthSnapshot } from "../types.js";
import type { FlightCandidate, FlightObservation, ItineraryPattern, ProviderMode } from "../../domain/types.js";
import type { AppConfig } from "../../config.js";

export const TRAVELPAYOUTS_ADAPTER_VERSION = "travelpayouts-v1-disabled";
export const TRAVELPAYOUTS_PROVIDER_ID = "travelpayouts";

const API_BASE = "https://api.travelpayouts.com/aviasales/v3/prices_for_dates";
const OFFER_TTL_MS = 6 * 3_600_000;
const SAUDI_OFFSET = 180;

interface AviasalesPriceRow {
  origin: string;
  destination: string;
  departure_at: string;
  return_at: string;
  price: number;
  airline: string;
  flight_number: string;
  transfers?: number;
  duration?: number;
  [key: string]: unknown;
}

interface AviasalesResponse {
  success: boolean;
  currency: string;
  data: AviasalesPriceRow[];
}

export class TravelpayoutsFlightProvider implements FlightProvider {
  readonly id = TRAVELPAYOUTS_PROVIDER_ID;
  readonly mode: ProviderMode = "INDICATIVE";
  readonly enabled: boolean;
  private readonly token: string | null;
  private readonly baseUrl: string;
  private calls = 0;
  private failures = 0;
  private lastSuccessAt: string | null = null;

  constructor(config: AppConfig, baseUrl: string = API_BASE) {
    this.token = config.travelpayoutsToken;
    // Enabled requires the master switch AND a token; access terms must still
    // be confirmed before flipping REAL_PROVIDERS_ENABLED=true.
    this.enabled = config.realProvidersEnabled && this.token != null;
    this.baseUrl = baseUrl;
  }

  async discover(input: FlightDiscoveryInput): Promise<FlightDiscoveryResult> {
    this.calls += 1;
    if (!this.enabled) {
      this.failures += 1;
      throw new ProviderError("ACCESS_NOT_CONFIGURED", "Travelpayouts belum diaktifkan: token atau akses resmi belum tersedia", {
        retryable: false,
        nextEligibleAt: null,
      });
    }
    const token = this.token as string;
    const candidates: FlightCandidate[] = [];
    for (const pattern of input.patterns) {
      const { outboundAirport } = patternAirports(pattern);
      const url = new URL(this.baseUrl);
      url.searchParams.set("origin", input.origin);
      url.searchParams.set("destination", outboundAirport);
      url.searchParams.set("departure_at", input.departureStart);
      url.searchParams.set("return_at", input.departureEnd);
      url.searchParams.set("currency", "IDR");
      url.searchParams.set("market", "id");
      url.searchParams.set("limit", "30");
      url.searchParams.set("sorting", "price");
      url.searchParams.set("token", token);
      const res = await fetch(url);
      if (res.status === 429) {
        this.failures += 1;
        const retryAfter = res.headers.get("retry-after");
        throw new ProviderError("RATE_LIMITED", "Travelpayouts rate limit", {
          retryable: true,
          nextEligibleAt: retryAfter
            ? new Date(Date.now() + Number(retryAfter) * 1000).toISOString()
            : null,
        });
      }
      if (!res.ok) {
        this.failures += 1;
        throw new ProviderError("PROVIDER_UNAVAILABLE", `Travelpayouts HTTP ${res.status}`);
      }
      const payload = (await res.json()) as AviasalesResponse;
      this.lastSuccessAt = input.now.toISOString();
      for (const row of payload.data ?? []) {
        const departureLocalDate = row.departure_at.slice(0, 10);
        const returnLocalDate = row.return_at.slice(0, 10);
        if (departureLocalDate < input.departureStart || departureLocalDate > input.departureEnd) {
          continue;
        }
        const stopCount = row.transfers ?? 0;
        if (input.maxStops !== undefined && stopCount > input.maxStops) {
          continue;
        }
        const durationMinutes = row.duration ?? 0;
        candidates.push({
          id: stableId(input.origin, outboundAirport, row.airline, departureLocalDate, returnLocalDate, pattern),
          providerId: this.id,
          origin: input.origin,
          outboundAirport,
          returnAirport: pattern === "OPENJAW_JED_MED" || pattern === "OPENJAW_MED_JED" ? (pattern === "OPENJAW_JED_MED" ? "MED" : "JED") : outboundAirport,
          departureLocalDate,
          returnLocalDate,
          pattern,
          stopCount,
          durationMinutes,
          indicativeTotalMinor: Math.round(row.price * 100),
          currency: payload.currency === "IDR" ? "IDR" : "USD",
          observedAt: input.now.toISOString(),
          expiresAt: new Date(input.now.getTime() + OFFER_TTL_MS).toISOString(),
          verificationStatus: "INDICATIVE",
          canonicalKey: `travelpayouts|${input.origin}|${outboundAirport}|${departureLocalDate}|${returnLocalDate}|${pattern}`,
        });
      }
    }
    return { candidates, observedAt: input.now.toISOString() };
  }

  /**
   * Travelpayouts data is broad and INDICATIVE, not a bookable live fare. The
   * verification role belongs to Duffel Flights; here we return an INDICATIVE
   * observation derived from the candidate (no additional network call).
   */
  async verify(input: FlightVerificationInput): Promise<FlightVerificationResult> {
    this.calls += 1;
    if (!this.enabled) {
      this.failures += 1;
      throw new ProviderError("ACCESS_NOT_CONFIGURED", "Travelpayouts belum diaktifkan");
    }
    const { candidate } = input;
    const now = input.now;
    const observedAt = now.toISOString();
    const fx = mockFxSnapshot(candidate.currency, observedAt);
    const observation: FlightObservation = {
      id: `${candidate.id}-obs-${now.getTime()}`,
      providerId: this.id,
      providerOfferId: candidate.id,
      candidateId: candidate.id,
      observedAt,
      expiresAt: candidate.expiresAt,
      adults: input.adults,
      childrenAges: input.childrenAges,
      cabin: input.cabin as FlightObservation["cabin"],
      segments: [],
      stopCount: candidate.stopCount,
      durationMinutes: candidate.durationMinutes,
      outboundArrivalUtcInstant: "",
      outboundArrivalOffsetMinutes: SAUDI_OFFSET,
      outboundArrivalSaudiDate: candidate.departureLocalDate,
      returnDepartureUtcInstant: "",
      returnDepartureOffsetMinutes: SAUDI_OFFSET,
      returnDepartureSaudiDate: candidate.returnLocalDate,
      outboundAirport: candidate.outboundAirport,
      returnAirport: candidate.returnAirport,
      departureLocalDate: candidate.departureLocalDate,
      returnLocalDate: candidate.returnLocalDate,
      pattern: candidate.pattern,
      originalAmountMinor: candidate.indicativeTotalMinor,
      originalCurrency: candidate.currency,
      taxAmountMinor: null,
      mandatoryFeeAmountMinor: null,
      dueNowAmountMinor: null,
      normalizedIdrAmountMinor: normalizeToIdrMinor(candidate.indicativeTotalMinor, candidate.currency, fx.rateIdrPerMajor),
      fxRate: fx.rateIdrPerMajor,
      fxObservedAt: fx.observedAt,
      priceCompleteness: "PARTIAL_FEES_UNKNOWN",
      verificationStatus: "INDICATIVE",
      bookingUrl: null,
      conditions: ["Data indikatif dari Travelpayouts; verifikasi live dilakukan di provider lain"],
      baggage: [],
      schemaVersion: "travelpayouts-v1",
    };
    this.lastSuccessAt = observedAt;
    return { observation };
  }

  async health(): Promise<ProviderHealthSnapshot> {
    return {
      id: this.id,
      mode: this.mode,
      enabled: this.enabled,
      enabledReason: this.enabled ? "Akses dikonfirmasi dan token tersedia" : null,
      disabledReason: this.enabled
        ? null
        : this.token == null
          ? "Token Travelpayouts belum tersedia (TRAVELPAYOUTS_TOKEN)"
          : "Akses resmi belum dikonfirmasi (REAL_PROVIDERS_ENABLED=false)",
      adapterVersion: TRAVELPAYOUTS_ADAPTER_VERSION,
      lastSuccessAt: this.lastSuccessAt,
      lastFailureCategory: this.failures > 0 ? "ACCESS_NOT_CONFIGURED" : null,
      frontier: null,
      calls: this.calls,
      failures: this.failures,
      cacheHits: 0,
    };
  }
}

export function patternAirports(pattern: ItineraryPattern): { outboundAirport: string; returnAirport: string } {
  switch (pattern) {
    case "ROUNDTRIP_JED":
      return { outboundAirport: "JED", returnAirport: "JED" };
    case "ROUNDTRIP_MED":
      return { outboundAirport: "MED", returnAirport: "MED" };
    case "OPENJAW_JED_MED":
      return { outboundAirport: "JED", returnAirport: "MED" };
    case "OPENJAW_MED_JED":
      return { outboundAirport: "MED", returnAirport: "JED" };
  }
}

/** Pure mapping so contract tests run without network or tokens. */
export function mapAviasalesPayload(
  payload: AviasalesResponse,
  input: FlightDiscoveryInput,
  now: Date,
): FlightCandidate[] {
  const candidates: FlightCandidate[] = [];
  for (const pattern of input.patterns) {
    const { outboundAirport, returnAirport } = patternAirports(pattern);
    for (const row of payload.data ?? []) {
      if (row.origin !== input.origin || row.destination !== outboundAirport) {
        continue;
      }
      const departureLocalDate = row.departure_at.slice(0, 10);
      const returnLocalDate = row.return_at.slice(0, 10);
      candidates.push({
        id: stableId(input.origin, outboundAirport, row.airline, departureLocalDate, returnLocalDate, pattern),
        providerId: TRAVELPAYOUTS_PROVIDER_ID,
        origin: input.origin,
        outboundAirport,
        returnAirport,
        departureLocalDate,
        returnLocalDate,
        pattern,
        stopCount: row.transfers ?? 0,
        durationMinutes: row.duration ?? 0,
        indicativeTotalMinor: Math.round(row.price * 100),
        currency: payload.currency === "IDR" ? "IDR" : "USD",
        observedAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + OFFER_TTL_MS).toISOString(),
        verificationStatus: "INDICATIVE",
        canonicalKey: `travelpayouts|${input.origin}|${outboundAirport}|${departureLocalDate}|${returnLocalDate}|${pattern}`,
      });
    }
  }
  return candidates;
}

function stableId(...parts: Array<string | number>): string {
  return parts.map((p) => String(p)).join("-").toLowerCase();
}
