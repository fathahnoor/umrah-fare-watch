// Deterministic Mock FlightProvider. Runs without network or credentials and
// covers the required fixture scenarios (04_PROVIDER_AND_DATA_STRATEGY.md).
import { addDays, localDateAt, utcInstantAt } from "../../domain/dates.js";
import { flightPriceCompleteness } from "../../domain/completeness.js";
import { canonicalFlightKey } from "../../domain/canonical.js";
import { normalizeToIdrMinor } from "../../domain/money.js";
import type {
  FlightCandidate,
  FlightObservation,
  FlightSegment,
  ItineraryPattern,
} from "../../domain/types.js";
import { mockFxSnapshot } from "../fx.js";
import type {
  FlightDiscoveryInput,
  FlightDiscoveryResult,
  FlightProvider,
  FlightVerificationInput,
  FlightVerificationResult,
  ProviderHealthSnapshot,
} from "../types.js";
import { ProviderError } from "../types.js";
import {
  FLIGHT_ADAPTER_VERSION,
  MOCK_FLIGHT_PROVIDER_ID,
  SCENARIO,
  mockFlightPriceIdr,
} from "./fixtures.js";

const SAUDI_OFFSET = 180;
const CGK_OFFSET = 420;
const KUL_OFFSET = 480;
const MINUTE_MS = 60_000;
const OFFER_TTL_MS = 48 * 3_600_000;

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

function segment(
  carrier: string,
  flightNumber: string,
  fromAirport: string,
  toAirport: string,
  depLocal: string,
  depOffset: number,
  durationMin: number,
  arrOffset: number,
): FlightSegment {
  const departureUtcInstant = utcInstantAt(depLocal, depOffset);
  const arrivalUtcInstant = new Date(
    new Date(departureUtcInstant).getTime() + durationMin * MINUTE_MS,
  ).toISOString();
  const arrivalLocal = new Date(
    new Date(arrivalUtcInstant).getTime() + arrOffset * MINUTE_MS,
  )
    .toISOString()
    .slice(0, 19);
  return {
    carrier,
    flightNumber,
    fromAirport,
    toAirport,
    departureLocal: depLocal,
    departureOffsetMinutes: depOffset,
    arrivalLocal,
    arrivalOffsetMinutes: arrOffset,
    departureUtcInstant,
    arrivalUtcInstant,
  };
}

export function buildSegments(
  departureLocalDate: string,
  outboundAirport: string,
  returnAirport: string,
  stopCount: number,
): { segments: FlightSegment[]; outboundArrivalSaudiDate: string; returnDepartureSaudiDate: string } {
  const returnDate = addDays(departureLocalDate, 10);
  let segments: FlightSegment[];
  if (stopCount === 0) {
    segments = [
      segment("MOCK AIR", "UWF 601", "CGK", outboundAirport, `${departureLocalDate}T20:30:00`, CGK_OFFSET, 575, SAUDI_OFFSET),
      segment("MOCK AIR", "UWF 602", returnAirport, "CGK", `${returnDate}T21:45:00`, SAUDI_OFFSET, 555, CGK_OFFSET),
    ];
  } else {
    segments = [
      segment("MOCK AIR", "UWF 611", "CGK", "KUL", `${departureLocalDate}T19:00:00`, CGK_OFFSET, 270, KUL_OFFSET),
      segment("MOCK AIR", "UWF 612", "KUL", outboundAirport, `${addDays(departureLocalDate, 1)}T03:00:00`, KUL_OFFSET, 200, SAUDI_OFFSET),
      segment("MOCK AIR", "UWF 613", returnAirport, "KUL", `${returnDate}T20:15:00`, SAUDI_OFFSET, 225, KUL_OFFSET),
      segment("MOCK AIR", "UWF 614", "KUL", "CGK", `${addDays(returnDate, 1)}T07:00:00`, KUL_OFFSET, 250, CGK_OFFSET),
    ];
  }
  // Outbound legs end at the Saudi gateway; return legs start there.
  const outboundLegs = segments.slice(0, stopCount + 1);
  const returnLegs = segments.slice(stopCount + 1);
  const outboundArrival = outboundLegs[outboundLegs.length - 1]?.arrivalUtcInstant as string;
  const returnDeparture = returnLegs[0]?.departureUtcInstant as string;
  return {
    segments,
    outboundArrivalSaudiDate: localDateAt(outboundArrival, SAUDI_OFFSET),
    returnDepartureSaudiDate: localDateAt(returnDeparture, SAUDI_OFFSET),
  };
}

export class MockFlightProvider implements FlightProvider {
  readonly id = MOCK_FLIGHT_PROVIDER_ID;
  readonly mode = "MOCK" as const;
  readonly enabled: boolean;
  private calls = 0;
  private failures = 0;
  private cacheHits = 0;
  private lastSuccessAt: string | null = null;

  constructor(enabled: boolean = true) {
    this.enabled = enabled;
  }

  async discover(input: FlightDiscoveryInput): Promise<FlightDiscoveryResult> {
    this.calls += 1;
    this.lastSuccessAt = input.now.toISOString();
    const observedAt = input.now.toISOString();
    const candidates: FlightCandidate[] = [];
    const dates = enumerateDates(input.departureStart, input.departureEnd);

    for (const pattern of input.patterns) {
      const { outboundAirport, returnAirport } = patternAirports(pattern);
      for (const departureLocalDate of dates) {
        for (const stopCount of [0, 1]) {
          if (input.maxStops !== undefined && stopCount > input.maxStops) {
            continue;
          }
          const { segments } = buildSegments(departureLocalDate, outboundAirport, returnAirport, stopCount);
          const durationMinutes = totalDurationMinutes(segments, stopCount);
          if (input.maxTripDurationMinutes !== undefined && durationMinutes > input.maxTripDurationMinutes) {
            continue;
          }
          const layover = stopCount === 0 ? 0 : maxLayoverMinutes(segments, stopCount);
          if (input.maxLayoverMinutes !== undefined && layover > input.maxLayoverMinutes) {
            continue;
          }
          const returnDate = addDays(departureLocalDate, 10);
          const candidate: FlightCandidate = {
            id: stableId("flight", input.origin, outboundAirport, returnAirport, departureLocalDate, returnDate, pattern, stopCount),
            providerId: this.id,
            origin: input.origin,
            outboundAirport,
            returnAirport,
            departureLocalDate,
            returnLocalDate: returnDate,
            pattern,
            stopCount,
            durationMinutes,
            indicativeTotalMinor: mockFlightPriceIdr(
              departureLocalDate,
              pattern,
              input.adults,
              input.childrenAges.length,
              stopCount,
              input.now.getTime(),
            ),
            currency: "IDR",
            observedAt,
            expiresAt: new Date(input.now.getTime() + OFFER_TTL_MS).toISOString(),
            verificationStatus: "INDICATIVE",
            canonicalKey: canonicalFlightKey({
              providerId: this.id,
              origin: input.origin,
              outboundAirport,
              returnAirport,
              departureLocalDate,
              returnLocalDate: returnDate,
              pattern,
              adults: input.adults,
              childrenAges: input.childrenAges,
              cabin: input.cabin,
            }),
          };
          candidates.push(candidate);
        }
      }
    }

    return { candidates, observedAt };
  }

  async verify(input: FlightVerificationInput): Promise<FlightVerificationResult> {
    this.calls += 1;
    const { candidate } = input;
    const now = input.now;
    const observedAt = now.toISOString();

    if (candidate.departureLocalDate === SCENARIO.flightUnavailableDeparture) {
      this.failures += 1;
      throw new ProviderError(
        "PROVIDER_UNAVAILABLE",
        `Mock flight provider unavailable for ${candidate.departureLocalDate}`,
        { retryable: true, nextEligibleAt: new Date(now.getTime() + 3_600_000).toISOString() },
      );
    }
    this.lastSuccessAt = observedAt;

    const { segments, outboundArrivalSaudiDate, returnDepartureSaudiDate } = buildSegments(
      candidate.departureLocalDate,
      candidate.outboundAirport,
      candidate.returnAirport,
      candidate.stopCount,
    );

    let totalIdrMinor = candidate.indicativeTotalMinor;
    let verificationStatus: FlightObservation["verificationStatus"] = "LIVE_VERIFIED";
    let expiresAt = new Date(now.getTime() + OFFER_TTL_MS).toISOString();
    let mandatoryFeeAmountMinor: number | null = 150_000;

    if (candidate.departureLocalDate === SCENARIO.flightExpiredDeparture) {
      verificationStatus = "EXPIRED";
      expiresAt = new Date(now.getTime() - 3_600_000).toISOString();
    } else if (candidate.departureLocalDate === SCENARIO.flightQuoteChangeDeparture) {
      totalIdrMinor += 500_000;
    } else if (candidate.departureLocalDate === SCENARIO.flightFeesUnknownDeparture) {
      mandatoryFeeAmountMinor = null;
    }

    const taxAmountMinor = Math.round(totalIdrMinor * 0.11);
    const fx = mockFxSnapshot("IDR", observedAt);
    const normalizedIdrAmountMinor = normalizeToIdrMinor(totalIdrMinor, "IDR", fx.rateIdrPerMajor);
    const priceCompleteness = flightPriceCompleteness({
      ...observationBase(),
      mandatoryFeeAmountMinor,
      normalizedIdrAmountMinor,
      fxRate: fx.rateIdrPerMajor,
      observedAt,
    });

    const observation: FlightObservation = {
      id: `${candidate.id}-obs-${now.getTime()}`,
      providerId: this.id,
      providerOfferId: candidate.id,
      candidateId: candidate.id,
      observedAt,
      expiresAt,
      adults: input.adults,
      childrenAges: input.childrenAges,
      cabin: input.cabin as FlightObservation["cabin"],
      segments,
      stopCount: candidate.stopCount,
      durationMinutes: candidate.durationMinutes,
      outboundArrivalUtcInstant: (segments[0] as FlightSegment).arrivalUtcInstant,
      outboundArrivalOffsetMinutes: SAUDI_OFFSET,
      outboundArrivalSaudiDate,
      returnDepartureUtcInstant: (segments[1] as FlightSegment).departureUtcInstant,
      returnDepartureOffsetMinutes: SAUDI_OFFSET,
      returnDepartureSaudiDate,
      outboundAirport: candidate.outboundAirport,
      returnAirport: candidate.returnAirport,
      origin: candidate.origin,
      departureLocalDate: candidate.departureLocalDate,
      returnLocalDate: candidate.returnLocalDate,
      pattern: candidate.pattern,
      originalAmountMinor: totalIdrMinor,
      originalCurrency: "IDR",
      taxAmountMinor,
      mandatoryFeeAmountMinor,
      dueNowAmountMinor: 0,
      normalizedIdrAmountMinor,
      fxRate: fx.rateIdrPerMajor,
      fxObservedAt: fx.observedAt,
      priceCompleteness,
      verificationStatus,
      bookingUrl: `https://mock.example/flight/offer/${candidate.id}`,
      conditions: ["Harga dapat berubah sampai verifikasi ulang", "Refund mengikuti kebijakan maskapai"],
      baggage: ["8 kg bagasi kabin", "Bagasi tercatat tidak termasuk"],
      schemaVersion: "flight-schema-v1",
    };

    return { observation };
  }

  async health(): Promise<ProviderHealthSnapshot> {
    return {
      id: this.id,
      mode: this.mode,
      enabled: this.enabled,
      enabledReason: this.enabled ? "Deterministic mock provider, always available" : null,
      disabledReason: this.enabled ? null : "Provider real aktif; mock nonaktif sebagai fallback",
      adapterVersion: FLIGHT_ADAPTER_VERSION,
      lastSuccessAt: this.lastSuccessAt,
      lastFailureCategory: this.failures > 0 ? "PROVIDER_UNAVAILABLE" : null,
      frontier: null,
      calls: this.calls,
      failures: this.failures,
      cacheHits: this.cacheHits,
    };
  }
}

/** Minimal base used only to compute completeness from the final fee/fx fields. */
function observationBase(): FlightObservation {
  return {
    id: "base",
    providerId: MOCK_FLIGHT_PROVIDER_ID,
    providerOfferId: "base",
    candidateId: "base",
    observedAt: "",
    expiresAt: "",
    adults: 1,
    childrenAges: [],
    cabin: "economy",
    segments: [],
    stopCount: 0,
    durationMinutes: 0,
    outboundArrivalUtcInstant: "",
    outboundArrivalOffsetMinutes: 180,
    outboundArrivalSaudiDate: "2000-01-01",
    returnDepartureUtcInstant: "",
    returnDepartureOffsetMinutes: 180,
    returnDepartureSaudiDate: "2000-01-01",
    outboundAirport: "JED",
    returnAirport: "JED",
    origin: "CGK",
    departureLocalDate: "2000-01-01",
    returnLocalDate: "2000-01-10",
    pattern: "ROUNDTRIP_JED",
    originalAmountMinor: 1,
    originalCurrency: "IDR",
    taxAmountMinor: null,
    mandatoryFeeAmountMinor: null,
    dueNowAmountMinor: null,
    normalizedIdrAmountMinor: null,
    fxRate: null,
    fxObservedAt: null,
    priceCompleteness: "COMPLETE",
    verificationStatus: "LIVE_VERIFIED",
    bookingUrl: null,
    conditions: [],
    baggage: [],
    schemaVersion: "base",
  };
}

/**
 * Total journey time: flying time plus intra-direction layovers. The stay in
 * Saudi Arabia between outbound and return is not travel time and is excluded.
 */
function totalDurationMinutes(segments: FlightSegment[], stopCount: number): number {
  const outbound = segments.slice(0, stopCount + 1);
  const inbound = segments.slice(stopCount + 1);
  return directionDuration(outbound) + directionDuration(inbound);
}

function directionDuration(legs: FlightSegment[]): number {
  let total = 0;
  for (let i = 0; i < legs.length; i += 1) {
    const seg = legs[i] as FlightSegment;
    total += durationOf(seg);
    const next = legs[i + 1];
    if (next) {
      total += gapMinutes(seg, next);
    }
  }
  return total;
}

function maxLayoverMinutes(segments: FlightSegment[], stopCount: number): number {
  const outbound = segments.slice(0, stopCount + 1);
  const inbound = segments.slice(stopCount + 1);
  let max = 0;
  for (let i = 0; i < outbound.length - 1; i += 1) {
    max = Math.max(max, gapMinutes(outbound[i] as FlightSegment, outbound[i + 1] as FlightSegment));
  }
  for (let i = 0; i < inbound.length - 1; i += 1) {
    max = Math.max(max, gapMinutes(inbound[i] as FlightSegment, inbound[i + 1] as FlightSegment));
  }
  return max;
}

function durationOf(seg: FlightSegment): number {
  return (
    (new Date(seg.arrivalUtcInstant).getTime() - new Date(seg.departureUtcInstant).getTime()) /
    MINUTE_MS
  );
}

function gapMinutes(a: FlightSegment, b: FlightSegment): number {
  return (
    (new Date(b.departureUtcInstant).getTime() - new Date(a.arrivalUtcInstant).getTime()) /
    MINUTE_MS
  );
}

export function enumerateDates(start: string, end: string): string[] {
  const dates: string[] = [];
  let current = start;
  let guard = 0;
  while (current <= end && guard < 500) {
    dates.push(current);
    current = addDays(current, 1);
    guard += 1;
  }
  return dates;
}

export function stableId(...parts: Array<string | number>): string {
  return parts.map((p) => String(p)).join("-").toLowerCase();
}
