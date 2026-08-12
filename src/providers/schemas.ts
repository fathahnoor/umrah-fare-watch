// Runtime validation at the adapter boundary (PROV-03, 03_TECHNICAL_ARCHITECTURE.md).
// An invalid payload must never be persisted as a valid observation.
import { z } from "zod";

const currencySchema = z.enum(["IDR", "USD", "SAR", "EUR", "SGD", "MYR"]);
const cabinSchema = z.enum(["economy", "premium_economy", "business", "first"]);
const patternSchema = z.enum(["ROUNDTRIP_JED", "ROUNDTRIP_MED", "OPENJAW_JED_MED", "OPENJAW_MED_JED"]);
const citySchema = z.enum(["MAKKAH", "MADINAH"]);
const completenessSchema = z.enum([
  "COMPLETE",
  "PARTIAL_FEES_UNKNOWN",
  "PARTIAL_FX_MISSING",
  "COMPONENT_MISSING",
]);
const verificationSchema = z.enum(["INDICATIVE", "LIVE_VERIFIED", "STALE", "EXPIRED"]);
const nonNegativeInt = z.number().int().min(0);
const optionalNonNegativeInt = z.number().int().min(0).nullable();
const isoInstant = z.string().datetime();
const localDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const flightSegmentSchema = z.object({
  carrier: z.string().min(1),
  flightNumber: z.string().min(1),
  fromAirport: z.string().length(3),
  toAirport: z.string().length(3),
  departureLocal: z.string(),
  departureOffsetMinutes: z.number().int(),
  arrivalLocal: z.string(),
  arrivalOffsetMinutes: z.number().int(),
  departureUtcInstant: isoInstant,
  arrivalUtcInstant: isoInstant,
});

export const flightObservationSchema = z.object({
  id: z.string().min(1),
  providerId: z.string().min(1),
  providerOfferId: z.string().min(1),
  candidateId: z.string().min(1),
  observedAt: isoInstant,
  expiresAt: isoInstant,
  adults: z.number().int().min(1),
  childrenAges: z.array(z.number().int().min(0).max(17)),
  cabin: cabinSchema,
  segments: z.array(flightSegmentSchema).min(2),
  stopCount: nonNegativeInt,
  durationMinutes: nonNegativeInt,
  outboundArrivalUtcInstant: isoInstant,
  outboundArrivalOffsetMinutes: z.number().int(),
  outboundArrivalSaudiDate: localDate,
  returnDepartureUtcInstant: isoInstant,
  returnDepartureOffsetMinutes: z.number().int(),
  returnDepartureSaudiDate: localDate,
  outboundAirport: z.string().length(3),
  returnAirport: z.string().length(3),
  departureLocalDate: localDate,
  returnLocalDate: localDate,
  pattern: patternSchema,
  originalAmountMinor: nonNegativeInt,
  originalCurrency: currencySchema,
  taxAmountMinor: optionalNonNegativeInt,
  mandatoryFeeAmountMinor: optionalNonNegativeInt,
  dueNowAmountMinor: optionalNonNegativeInt,
  normalizedIdrAmountMinor: optionalNonNegativeInt,
  fxRate: z.number().positive().nullable(),
  fxObservedAt: isoInstant.nullable(),
  priceCompleteness: completenessSchema,
  verificationStatus: verificationSchema,
  bookingUrl: z.string().url().nullable(),
  conditions: z.array(z.string()),
  baggage: z.array(z.string()),
  schemaVersion: z.string().min(1),
});

export const hotelObservationSchema = z.object({
  id: z.string().min(1),
  providerId: z.string().min(1),
  providerOfferId: z.string().min(1),
  propertyId: z.string().min(1),
  propertyName: z.string().min(1),
  city: citySchema,
  checkInLocalDate: localDate,
  checkOutLocalDate: localDate,
  nights: z.number().int().min(1),
  adults: z.number().int().min(1),
  childrenAges: z.array(z.number().int().min(0).max(17)),
  rooms: z.number().int().min(1),
  radiusKm: z.number().min(0),
  freeCancellationOnly: z.boolean(),
  roomName: z.string().min(1),
  rateName: z.string().min(1),
  boardType: z.string(),
  originalAmountMinor: nonNegativeInt,
  originalCurrency: currencySchema,
  taxAmountMinor: optionalNonNegativeInt,
  mandatoryFeeAmountMinor: optionalNonNegativeInt,
  dueNowAmountMinor: optionalNonNegativeInt,
  dueAtPropertyAmountMinor: optionalNonNegativeInt,
  normalizedIdrAmountMinor: optionalNonNegativeInt,
  fxRate: z.number().positive().nullable(),
  fxObservedAt: isoInstant.nullable(),
  priceCompleteness: completenessSchema,
  verificationStatus: verificationSchema,
  availabilityState: z.enum(["HAS_RESULT", "NO_RESULT", "NOT_YET_SEARCHABLE", "PROVIDER_UNAVAILABLE", "NOT_SCANNED", "NOT_YET_PUBLISHED"]),
  straightLineDistanceKm: z.number().min(0),
  observedAt: isoInstant,
  expiresAt: isoInstant,
  cancellation: z.object({
    freeCancellation: z.boolean(),
    deadlineLocalDate: localDate.nullable(),
    description: z.string(),
  }),
  payment: z.object({
    dueNow: z.boolean(),
    dueAtProperty: z.boolean(),
    description: z.string(),
  }),
  bookingUrl: z.string().url().nullable(),
});
