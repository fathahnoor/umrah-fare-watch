// Duffel Flights adapter framework (04_PROVIDER_AND_DATA_STRATEGY.md section 3).
// Role: selective LIVE verification of the top candidates, never broad scans.
// Disabled until the activation gate passes; disabled calls throw
// ACCESS_NOT_CONFIGURED so the app keeps using the mock adapter.
import type { AppConfig } from "../../config.js";
import { normalizeToIdrMinor } from "../../domain/money.js";
import { mockFxSnapshot } from "../fx.js";
import { ProviderError, type FlightDiscoveryInput, type FlightDiscoveryResult, type FlightProvider, type FlightVerificationInput, type FlightVerificationResult, type ProviderHealthSnapshot } from "../types.js";
import type { FlightCandidate, FlightObservation, ProviderMode } from "../../domain/types.js";
import { DuffelClient } from "./duffelClient.js";

export const DUFFEL_FLIGHT_ADAPTER_VERSION = "duffel-flights-v1-disabled";
export const DUFFEL_FLIGHT_PROVIDER_ID = "duffel-flights";

interface DuffelOfferResponse {
  data: {
    offers: Array<{
      id: string;
      total_amount: string;
      total_currency: string;
      tax_amount: string | null;
      slices: Array<{
        segments: Array<{
          origin: { iata_code: string };
          destination: { iata_code: string };
          departing_at: string;
          arriving_at: string;
          operating_carrier?: { name?: string };
          marketing_carrier?: { name?: string };
          flight_number?: string;
        }>;
      }>;
    }>;
  };
}

export class DuffelFlightProvider implements FlightProvider {
  readonly id = DUFFEL_FLIGHT_PROVIDER_ID;
  readonly mode: ProviderMode = "LIVE";
  readonly enabled: boolean;
  private readonly client: DuffelClient;
  private calls = 0;
  private failures = 0;
  private lastSuccessAt: string | null = null;

  constructor(config: AppConfig) {
    this.enabled = config.realProvidersEnabled && config.duffelToken != null;
    this.client = new DuffelClient(config.duffelToken);
  }

  /** Duffel is the verification stage, not the broad scanner. */
  async discover(_input: FlightDiscoveryInput): Promise<FlightDiscoveryResult> {
    this.calls += 1;
    this.failures += 1;
    throw new ProviderError(
      "ACCESS_NOT_CONFIGURED",
      "Duffel Flights tidak dipakai untuk broad discovery; gunakan Travelpayouts atau mock",
      { retryable: false },
    );
  }

  async verify(input: FlightVerificationInput): Promise<FlightVerificationResult> {
    this.calls += 1;
    if (!this.enabled) {
      this.failures += 1;
      throw new ProviderError("ACCESS_NOT_CONFIGURED", "Duffel Flights belum diaktifkan", { retryable: false });
    }
    const { candidate } = input;
    const observedAt = input.now.toISOString();
    const body = {
      slices: [
        {
          origin: candidate.outboundAirport,
          destination: candidate.outboundAirport === "JED" ? "MED" : "JED",
          departure_date: candidate.departureLocalDate,
        },
        {
          origin: candidate.returnAirport === "JED" ? "MED" : "JED",
          destination: candidate.outboundAirport,
          departure_date: candidate.returnLocalDate,
        },
      ],
      passengers: [
        ...Array.from({ length: input.adults }, () => ({ type: "adult" })),
        ...input.childrenAges.map((age) => ({ type: age >= 12 ? "adult" : age >= 2 ? "child" : "infant" })),
      ],
      cabin_class: input.cabin === "business" ? "business" : "economy",
    };
    const payload = await this.client.request<DuffelOfferResponse>("/air/offer_requests", {
      method: "POST",
      body: JSON.stringify(body),
    });
    const offer = payload.data.offers[0];
    if (!offer) {
      throw new ProviderError("NOT_FOUND", "Duffel mengembalikan tanpa offer", { retryable: false });
    }
    const observation = mapOfferToObservation(offer, candidate, input, observedAt);
    this.lastSuccessAt = observedAt;
    return { observation };
  }

  async health(): Promise<ProviderHealthSnapshot> {
    return {
      id: this.id,
      mode: this.mode,
      enabled: this.enabled,
      enabledReason: this.enabled ? "Akses Duffel dikonfirmasi dan token tersedia" : null,
      disabledReason: this.enabled
        ? null
        : "Duffel Flights menunggu akses resmi dan token (DUFFEL_TOKEN + REAL_PROVIDERS_ENABLED)",
      adapterVersion: DUFFEL_FLIGHT_ADAPTER_VERSION,
      lastSuccessAt: this.lastSuccessAt,
      lastFailureCategory: this.failures > 0 ? "ACCESS_NOT_CONFIGURED" : null,
      frontier: null,
      calls: this.calls,
      failures: this.failures,
      cacheHits: 0,
    };
  }
}

/** Pure mapping from a documented Duffel offer response; contract-tested offline. */
export function mapOfferToObservation(
  offer: DuffelOfferResponse["data"]["offers"][number],
  candidate: FlightCandidate,
  input: FlightVerificationInput,
  observedAt: string,
): FlightObservation {
  const currency = offer.total_currency as FlightObservation["originalCurrency"];
  const totalMinor = Math.round(Number(offer.total_amount) * 100);
  const fx = mockFxSnapshot(currency, observedAt);
  const segments = (offer.slices ?? []).flatMap((slice) =>
    (slice.segments ?? []).map((seg) => ({
      carrier: seg.operating_carrier?.name ?? seg.marketing_carrier?.name ?? "Duffel Air",
      flightNumber: seg.flight_number ?? "0",
      fromAirport: seg.origin.iata_code,
      toAirport: seg.destination.iata_code,
      departureLocal: seg.departing_at,
      departureOffsetMinutes: 0,
      arrivalLocal: seg.arriving_at,
      arrivalOffsetMinutes: 0,
      departureUtcInstant: seg.departing_at,
      arrivalUtcInstant: seg.arriving_at,
    })),
  );
  return {
    id: `${candidate.id}-obs-${observedAt}`,
    providerId: DUFFEL_FLIGHT_PROVIDER_ID,
    providerOfferId: offer.id,
    candidateId: candidate.id,
    observedAt,
    expiresAt: new Date(new Date(observedAt).getTime() + 6 * 3_600_000).toISOString(),
    adults: input.adults,
    childrenAges: input.childrenAges,
    cabin: input.cabin as FlightObservation["cabin"],
    segments,
    stopCount: candidate.stopCount,
    durationMinutes: candidate.durationMinutes,
    outboundArrivalUtcInstant: segments[0]?.arrivalUtcInstant ?? "",
    outboundArrivalOffsetMinutes: 180,
    outboundArrivalSaudiDate: candidate.departureLocalDate,
    returnDepartureUtcInstant: segments[1]?.departureUtcInstant ?? "",
    returnDepartureOffsetMinutes: 180,
    returnDepartureSaudiDate: candidate.returnLocalDate,
    outboundAirport: candidate.outboundAirport,
    returnAirport: candidate.returnAirport,
    origin: candidate.origin,
    departureLocalDate: candidate.departureLocalDate,
    returnLocalDate: candidate.returnLocalDate,
    pattern: candidate.pattern,
    originalAmountMinor: totalMinor,
    originalCurrency: currency,
    taxAmountMinor: offer.tax_amount != null ? Math.round(Number(offer.tax_amount) * 100) : null,
    mandatoryFeeAmountMinor: null,
    dueNowAmountMinor: null,
    normalizedIdrAmountMinor: normalizeToIdrMinor(totalMinor, currency, fx.rateIdrPerMajor),
    fxRate: fx.rateIdrPerMajor,
    fxObservedAt: fx.observedAt,
    priceCompleteness: "PARTIAL_FEES_UNKNOWN",
    verificationStatus: "LIVE_VERIFIED",
    bookingUrl: null,
    conditions: ["Harga dan ketersediaan diverifikasi langsung dari Duffel"],
    baggage: [],
    schemaVersion: "duffel-flights-v1",
  };
}
