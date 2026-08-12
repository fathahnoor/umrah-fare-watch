// Trip Composer (03_TECHNICAL_ARCHITECTURE.md section 6).
// Pure functions: validations, exact arithmetic, and snapshot generation.
import { addDays } from "../domain/dates.js";
import { flightPriceCompleteness, hotelPriceCompleteness, planPriceCompleteness } from "../domain/completeness.js";
import { firstCityForFlight, patternAirports } from "../domain/itinerary.js";
import { perPersonEquivalent } from "../domain/money.js";
import type {
  CalculationSnapshot,
  City,
  FlightObservation,
  HotelObservation,
  PriceCompleteness,
  TripPlan,
  TripPlanSummary,
  TripSearchInput,
  VerificationStatus,
} from "../domain/types.js";

export const CALCULATION_FORMULA_VERSION = "trip-total-v1";
export const ROUNDING_POLICY = "half-up-to-idr-minor-unit";

export interface CityDates {
  firstCity: City;
  secondCity: City;
  makkahCheckIn: string;
  makkahCheckOut: string;
  madinahCheckIn: string;
  madinahCheckOut: string;
}

export type DeriveResult = { ok: true; dates: CityDates } | { ok: false; reason: string };

/**
 * Derive contiguous Makkah and Madinah stays from the verified Saudi-local
 * flight datetimes (01_PRODUCT_REQUIREMENTS.md section 5).
 */
export function deriveCityDates(flight: FlightObservation, input: TripSearchInput): DeriveResult {
  const expected = patternAirports(flight.pattern);
  if (flight.outboundAirport !== expected.outboundAirport || flight.returnAirport !== expected.returnAirport) {
    return { ok: false, reason: "PATTERN_AIRPORT_MISMATCH" };
  }

  const arrivalSaudiDate = flight.outboundArrivalSaudiDate;
  const firstCity = firstCityForFlight(input.cityOrder, flight.outboundAirport);
  const secondCity: City = firstCity === "MAKKAH" ? "MADINAH" : "MAKKAH";
  const firstNights = firstCity === "MAKKAH" ? input.makkahNights : input.madinahNights;
  const secondNights = firstCity === "MAKKAH" ? input.madinahNights : input.makkahNights;

  const checkIn1 = arrivalSaudiDate;
  const checkOut1 = addDays(checkIn1, firstNights);
  const checkIn2 = checkOut1;
  const checkOut2 = addDays(checkIn2, secondNights);

  if (flight.returnDepartureSaudiDate < checkOut2) {
    return { ok: false, reason: "RETURN_BEFORE_FINAL_CHECKOUT" };
  }

  const dates: CityDates =
    firstCity === "MAKKAH"
      ? {
          firstCity,
          secondCity,
          makkahCheckIn: checkIn1,
          makkahCheckOut: checkOut1,
          madinahCheckIn: checkIn2,
          madinahCheckOut: checkOut2,
        }
      : {
          firstCity,
          secondCity,
          makkahCheckIn: checkIn2,
          makkahCheckOut: checkOut2,
          madinahCheckIn: checkIn1,
          madinahCheckOut: checkOut1,
        };

  return { ok: true, dates };
}

export interface ComposeArgs {
  input: TripSearchInput;
  searchFingerprint: string;
  flight: FlightObservation;
  makkahHotel: HotelObservation | null;
  madinahHotel: HotelObservation | null;
  now: Date;
}

/**
 * Compose one bounded trip plan. Returns null when date or pattern rules make
 * the combination invalid. Missing amounts never become zero.
 */
export function composeTrip(args: ComposeArgs): TripPlan | null {
  const { input, searchFingerprint, flight, makkahHotel, madinahHotel, now } = args;
  const derived = deriveCityDates(flight, input);
  if (!derived.ok) {
    return null;
  }
  const { dates } = derived;

  const flightCompleteness = flightPriceCompleteness(flight);
  const makkahCompleteness = makkahHotel ? hotelPriceCompleteness(makkahHotel) : null;
  const madinahCompleteness = madinahHotel ? hotelPriceCompleteness(madinahHotel) : null;
  const priceCompleteness = planPriceCompleteness(flightCompleteness, makkahCompleteness, madinahCompleteness);

  const flightPartyTotalIdrMinor = flight.normalizedIdrAmountMinor;
  const makkahStayTotalIdrMinor = makkahHotel?.normalizedIdrAmountMinor ?? null;
  const madinahStayTotalIdrMinor = madinahHotel?.normalizedIdrAmountMinor ?? null;

  let tripTotalIdrMinor: number | null = null;
  let perPersonEquivalentIdrMinor: number | null = null;
  if (priceCompleteness === "COMPLETE") {
    tripTotalIdrMinor =
      (flightPartyTotalIdrMinor as number) +
      (makkahStayTotalIdrMinor as number) +
      (madinahStayTotalIdrMinor as number);
    perPersonEquivalentIdrMinor = perPersonEquivalent(tripTotalIdrMinor, input.adults, input.childrenAges);
  }

  const status = planStatus(priceCompleteness, flight, makkahHotel, madinahHotel);
  const expiresAt = minExpiry([flight.expiresAt, makkahHotel?.expiresAt, madinahHotel?.expiresAt]);
  const calculationSnapshot = buildSnapshot(args, dates, priceCompleteness, tripTotalIdrMinor);
  const id = planId(searchFingerprint, flight.id, makkahHotel?.id ?? null, madinahHotel?.id ?? null);

  return {
    id,
    searchFingerprint,
    flightObservationId: flight.id,
    makkahHotelObservationId: makkahHotel?.id ?? null,
    madinahHotelObservationId: madinahHotel?.id ?? null,
    pattern: flight.pattern,
    cityOrder: input.cityOrder,
    firstCity: dates.firstCity,
    secondCity: dates.secondCity,
    makkahCheckIn: dates.makkahCheckIn,
    makkahCheckOut: dates.makkahCheckOut,
    madinahCheckIn: dates.madinahCheckIn,
    madinahCheckOut: dates.madinahCheckOut,
    flightPartyTotalIdrMinor,
    makkahStayTotalIdrMinor,
    madinahStayTotalIdrMinor,
    tripTotalIdrMinor,
    perPersonEquivalentIdrMinor,
    priceCompleteness,
    tripPlanStatus: status,
    verificationStatus: flight.verificationStatus,
    calculationSnapshot,
    calculatedAt: now.toISOString(),
    expiresAt,
    version: 1,
    components: { flight, makkahHotel, madinahHotel },
  };
}

function planStatus(
  completeness: PriceCompleteness,
  flight: FlightObservation,
  makkahHotel: HotelObservation | null,
  madinahHotel: HotelObservation | null,
): TripPlan["tripPlanStatus"] {
  const components = [flight, makkahHotel, madinahHotel].filter((c): c is FlightObservation | HotelObservation => c != null);
  if (components.some((c) => c.verificationStatus === "EXPIRED")) {
    return "EXPIRED";
  }
  if (components.some((c) => c.verificationStatus === "STALE")) {
    return "STALE";
  }
  if (completeness !== "COMPLETE") {
    return "PARTIAL";
  }
  return flight.verificationStatus === "LIVE_VERIFIED" ? "LIVE_COMPLETE" : "INDICATIVE_COMPLETE";
}

function minExpiry(values: Array<string | null | undefined>): string | null {
  const present = values.filter((v): v is string => v != null);
  if (present.length === 0) {
    return null;
  }
  return present.sort()[0] as string;
}

function planId(fingerprint: string, flightId: string, makkahId: string | null, madinahId: string | null): string {
  return ["plan", fingerprint, flightId, makkahId ?? "-", madinahId ?? "-"].join("|");
}

function buildSnapshot(
  args: ComposeArgs,
  dates: CityDates,
  priceCompleteness: PriceCompleteness,
  tripTotalIdrMinor: number | null,
): CalculationSnapshot {
  const { input, flight, makkahHotel, madinahHotel } = args;
  const missingFields: string[] = [];
  if (makkahHotel == null || madinahHotel == null) {
    missingFields.push("hotel component missing");
  }
  if (flight.mandatoryFeeAmountMinor == null) {
    missingFields.push("flight mandatory fees unknown");
  }
  if (makkahHotel?.mandatoryFeeAmountMinor == null) {
    missingFields.push("makkah mandatory fees unknown");
  }
  if (madinahHotel?.mandatoryFeeAmountMinor == null) {
    missingFields.push("madinah mandatory fees unknown");
  }
  if (flight.fxRate == null) {
    missingFields.push("flight fx missing");
  }
  if (makkahHotel?.fxRate == null) {
    missingFields.push("makkah fx missing");
  }
  if (madinahHotel?.fxRate == null) {
    missingFields.push("madinah fx missing");
  }

  const fxSnapshots = [
    flight.fxRate != null ? { base: flight.originalCurrency, rateIdrPerMajor: flight.fxRate, observedAt: flight.fxObservedAt ?? flight.observedAt } : null,
    makkahHotel?.fxRate != null ? { base: makkahHotel.originalCurrency, rateIdrPerMajor: makkahHotel.fxRate, observedAt: makkahHotel.fxObservedAt ?? makkahHotel.observedAt } : null,
    madinahHotel?.fxRate != null ? { base: madinahHotel.originalCurrency, rateIdrPerMajor: madinahHotel.fxRate, observedAt: madinahHotel.fxObservedAt ?? madinahHotel.observedAt } : null,
  ].filter((f): f is { base: CalculationSnapshot["fxSnapshots"][number]["base"]; rateIdrPerMajor: number; observedAt: string } => f != null);

  const includedFees = ["Pajak dan biaya wajib yang diberikan provider"];
  const reasons: string[] = [];
  if (priceCompleteness !== "COMPLETE") {
    reasons.push("Complete total tidak dihitung karena harga belum lengkap");
  }
  if (makkahHotel == null || madinahHotel == null) {
    reasons.push("Satu atau dua hotel tidak tersedia untuk kombinasi ini");
  }
  if (tripTotalIdrMinor == null && priceCompleteness === "COMPLETE") {
    reasons.push("Perhitungan total tertunda karena komponen tidak dapat dinormalisasi");
  }

  return {
    formulaVersion: CALCULATION_FORMULA_VERSION,
    sourceObservationIds: {
      flight: flight.id,
      makkahHotel: makkahHotel?.id ?? null,
      madinahHotel: madinahHotel?.id ?? null,
    },
    componentAmounts: {
      flight: { originalMinor: flight.originalAmountMinor, currency: flight.originalCurrency, normalizedIdrMinor: flight.normalizedIdrAmountMinor },
      makkahHotel: makkahHotel
        ? { originalMinor: makkahHotel.originalAmountMinor, currency: makkahHotel.originalCurrency, normalizedIdrMinor: makkahHotel.normalizedIdrAmountMinor }
        : { originalMinor: null, currency: null, normalizedIdrMinor: null },
      madinahHotel: madinahHotel
        ? { originalMinor: madinahHotel.originalAmountMinor, currency: madinahHotel.originalCurrency, normalizedIdrMinor: madinahHotel.normalizedIdrAmountMinor }
        : { originalMinor: null, currency: null, normalizedIdrMinor: null },
    },
    fxSnapshots,
    includedFees,
    missingFields,
    userConstraints: {
      origins: input.origins,
      departureStart: input.departureStart,
      departureEnd: input.departureEnd,
      adults: input.adults,
      childrenAges: input.childrenAges,
      rooms: input.rooms,
      makkahNights: input.makkahNights,
      madinahNights: input.madinahNights,
      patterns: input.patterns,
      cityOrder: input.cityOrder,
      cabin: input.cabin,
      makkahRadiusKm: input.makkahRadiusKm,
      madinahRadiusKm: input.madinahRadiusKm,
      freeCancellationOnly: input.freeCancellationOnly,
    },
    dateDerivationInputs: {
      arrivalSaudiDate: flight.outboundArrivalSaudiDate,
      firstCity: dates.firstCity,
      makkahNights: input.makkahNights,
      madinahNights: input.madinahNights,
    },
    roundingPolicy: ROUNDING_POLICY,
    generatedReasons: reasons,
  };
}

export function toPlanSummary(plan: TripPlan, input: TripSearchInput): TripPlanSummary {
  const { flight, makkahHotel, madinahHotel } = plan.components;
  return {
    id: plan.id,
    tripTotalIdrMinor: plan.tripTotalIdrMinor,
    perPersonEquivalentIdrMinor: plan.perPersonEquivalentIdrMinor,
    subtotals: {
      flight: plan.flightPartyTotalIdrMinor,
      makkah: plan.makkahStayTotalIdrMinor,
      madinah: plan.madinahStayTotalIdrMinor,
    },
    priceCompleteness: plan.priceCompleteness,
    tripPlanStatus: plan.tripPlanStatus,
    dates: {
      makkahCheckIn: plan.makkahCheckIn,
      makkahCheckOut: plan.makkahCheckOut,
      madinahCheckIn: plan.madinahCheckIn,
      madinahCheckOut: plan.madinahCheckOut,
    },
    pattern: plan.pattern,
    cityOrder: plan.cityOrder,
    firstCity: plan.firstCity,
    secondCity: plan.secondCity,
    adults: input.adults,
    childrenAges: input.childrenAges,
    rooms: input.rooms,
    flight: {
      providerId: flight.providerId,
      airline: flight.segments[0]?.carrier ?? "Mock Air",
      airports: { outbound: flight.outboundAirport, returnAirport: flight.returnAirport },
      stops: flight.stopCount,
      durationMinutes: flight.durationMinutes,
      verificationStatus: flight.verificationStatus,
      observedAt: flight.observedAt,
      expiresAt: flight.expiresAt,
      bookingUrl: flight.bookingUrl,
    },
    makkahHotel: makkahHotel ? toHotelSummary(makkahHotel) : null,
    madinahHotel: madinahHotel ? toHotelSummary(madinahHotel) : null,
    included: ["Pajak dan biaya wajib yang diberikan provider", ...(makkahHotel?.boardType === "Termasuk sarapan" ? ["Sarapan Makkah"] : []), ...(madinahHotel?.boardType === "Termasuk sarapan" ? ["Sarapan Madinah"] : [])],
    notIncluded: ["Transfer darat", "Visa", "Makanan di luar rate", "Bagasi atau fee yang tidak dinyatakan provider", "Asuransi", "Pengeluaran pribadi"],
    calculationSnapshotVersion: plan.calculationSnapshot.formulaVersion,
    reasons: plan.calculationSnapshot.generatedReasons,
  };
}

function toHotelSummary(hotel: HotelObservation): TripPlanSummary["makkahHotel"] {
  return {
    providerId: hotel.providerId,
    propertyName: hotel.propertyName,
    city: hotel.city,
    roomName: hotel.roomName,
    rateName: hotel.rateName,
    boardType: hotel.boardType,
    straightLineDistanceKm: hotel.straightLineDistanceKm,
    distanceSemantic: "STRAIGHT_LINE",
    freeCancellation: hotel.cancellation.freeCancellation,
    cancellationDeadline: hotel.cancellation.deadlineLocalDate,
    dueNowAmountMinor: hotel.dueNowAmountMinor,
    dueAtPropertyAmountMinor: hotel.dueAtPropertyAmountMinor,
    verificationStatus: hotel.verificationStatus,
    observedAt: hotel.observedAt,
    expiresAt: hotel.expiresAt,
    bookingUrl: hotel.bookingUrl,
  };
}

