// Canonical domain types from the Umrah Fare Watch specification.
// Fixed product contracts must not be renamed or weakened.

export type CurrencyCode = "IDR" | "USD" | "SAR" | "EUR" | "SGD" | "MYR";
export type CabinClass = "economy" | "premium_economy" | "business" | "first";

export type ItineraryPattern =
  | "ROUNDTRIP_JED"
  | "ROUNDTRIP_MED"
  | "OPENJAW_JED_MED"
  | "OPENJAW_MED_JED";

export type CityOrder = "AUTO" | "MAKKAH_FIRST" | "MADINAH_FIRST";
export type City = "MAKKAH" | "MADINAH";

export type PriceCompleteness =
  | "COMPLETE"
  | "PARTIAL_FEES_UNKNOWN"
  | "PARTIAL_FX_MISSING"
  | "COMPONENT_MISSING";

export type AvailabilityState =
  | "NOT_SCANNED"
  | "HAS_RESULT"
  | "NO_RESULT"
  | "NOT_YET_PUBLISHED"
  | "NOT_YET_SEARCHABLE"
  | "PROVIDER_UNAVAILABLE";

export type VerificationStatus =
  | "INDICATIVE"
  | "LIVE_VERIFIED"
  | "STALE"
  | "EXPIRED";

export type TripPlanStatus =
  | "LIVE_COMPLETE"
  | "INDICATIVE_COMPLETE"
  | "PARTIAL"
  | "STALE"
  | "EXPIRED";

export type WatchlistType = "FLIGHT" | "HOTEL" | "COMPLETE_TRIP";
export type ProviderMode = "MOCK" | "INDICATIVE" | "LIVE";

export type ErrorCategory =
  | "VALIDATION_ERROR"
  | "AUTH_REQUIRED"
  | "ACCESS_NOT_CONFIGURED"
  | "OUTSIDE_PROVIDER_FRONTIER"
  | "RATE_LIMITED"
  | "PROVIDER_UNAVAILABLE"
  | "INVALID_PROVIDER_RESPONSE"
  | "OFFER_EXPIRED"
  | "QUOTE_CHANGED"
  | "PARTIAL_PRICE"
  | "NOT_FOUND";

// Canonical search input contract (01_PRODUCT_REQUIREMENTS.md section 3).
export interface TripSearchInput {
  origins: string[];
  departureStart: string;
  departureEnd: string;
  adults: number;
  childrenAges: number[];
  rooms: number;
  makkahNights: number;
  madinahNights: number;
  patterns: ItineraryPattern[];
  cityOrder: CityOrder;
  cabin: CabinClass;
  maxStops?: number;
  maxLayoverMinutes?: number;
  maxTripDurationMinutes?: number;
  makkahRadiusKm: number;
  madinahRadiusKm: number;
  freeCancellationOnly: boolean;
  currency: "IDR";
}

export interface FlightSearchInput {
  origin: string;
  departureStart: string;
  departureEnd: string;
  adults: number;
  childrenAges: number[];
  patterns: ItineraryPattern[];
  cabin: CabinClass;
  maxStops?: number;
  maxLayoverMinutes?: number;
  maxTripDurationMinutes?: number;
}

export interface HotelSearchInput {
  providerId: string;
  city: City;
  checkIn: string;
  checkOut: string;
  adults: number;
  childrenAges: number[];
  rooms: number;
  radiusKm: number;
  freeCancellationOnly: boolean;
  currency: "IDR";
}

export interface MoneyAmount {
  amountMinor: number;
  currency: CurrencyCode;
}

export interface FxSnapshot {
  rateIdrPerMajor: number;
  base: CurrencyCode;
  quote: "IDR";
  observedAt: string;
}

export interface FlightSegment {
  carrier: string;
  flightNumber: string;
  fromAirport: string;
  toAirport: string;
  departureLocal: string;
  departureOffsetMinutes: number;
  arrivalLocal: string;
  arrivalOffsetMinutes: number;
  departureUtcInstant: string;
  arrivalUtcInstant: string;
}

export interface FlightCandidate {
  id: string;
  providerId: string;
  origin: string;
  outboundAirport: string;
  returnAirport: string;
  departureLocalDate: string;
  returnLocalDate: string;
  pattern: ItineraryPattern;
  stopCount: number;
  durationMinutes: number;
  indicativeTotalMinor: number;
  currency: CurrencyCode;
  observedAt: string;
  expiresAt: string;
  verificationStatus: "INDICATIVE";
  canonicalKey: string;
}

export interface FlightObservation {
  id: string;
  providerId: string;
  providerOfferId: string;
  candidateId: string;
  observedAt: string;
  expiresAt: string;
  adults: number;
  childrenAges: number[];
  cabin: CabinClass;
  segments: FlightSegment[];
  stopCount: number;
  durationMinutes: number;
  outboundArrivalUtcInstant: string;
  outboundArrivalOffsetMinutes: number;
  outboundArrivalSaudiDate: string;
  returnDepartureUtcInstant: string;
  returnDepartureOffsetMinutes: number;
  returnDepartureSaudiDate: string;
  outboundAirport: string;
  returnAirport: string;
  departureLocalDate: string;
  returnLocalDate: string;
  pattern: ItineraryPattern;
  originalAmountMinor: number;
  originalCurrency: CurrencyCode;
  taxAmountMinor: number | null;
  mandatoryFeeAmountMinor: number | null;
  dueNowAmountMinor: number | null;
  normalizedIdrAmountMinor: number | null;
  fxRate: number | null;
  fxObservedAt: string | null;
  priceCompleteness: PriceCompleteness;
  verificationStatus: VerificationStatus;
  bookingUrl: string | null;
  conditions: string[];
  baggage: string[];
  schemaVersion: string;
  /** True when the provider's total already includes taxes and fees, so the
   * plan total is COMPLETE even though mandatoryFeeAmountMinor is null.
   * Real providers (Google Flights/Hotels) include fees in their total price. */
  feesIncludedInTotal?: boolean;
}

export interface HotelProperty {
  id: string;
  providerId: string;
  providerPropertyId: string;
  name: string;
  address: string;
  city: City;
  latitude: number;
  longitude: number;
  starRating: number;
  sourceUrl: string | null;
}

export interface HotelCancellation {
  freeCancellation: boolean;
  deadlineLocalDate: string | null;
  description: string;
}

export interface HotelPayment {
  dueNow: boolean;
  dueAtProperty: boolean;
  description: string;
}

export interface HotelObservation {
  id: string;
  providerId: string;
  providerOfferId: string;
  propertyId: string;
  propertyName: string;
  city: City;
  checkInLocalDate: string;
  checkOutLocalDate: string;
  nights: number;
  adults: number;
  childrenAges: number[];
  rooms: number;
  radiusKm: number;
  freeCancellationOnly: boolean;
  roomName: string;
  rateName: string;
  boardType: string;
  originalAmountMinor: number;
  originalCurrency: CurrencyCode;
  taxAmountMinor: number | null;
  mandatoryFeeAmountMinor: number | null;
  dueNowAmountMinor: number | null;
  dueAtPropertyAmountMinor: number | null;
  normalizedIdrAmountMinor: number | null;
  fxRate: number | null;
  fxObservedAt: string | null;
  priceCompleteness: PriceCompleteness;
  verificationStatus: VerificationStatus;
  availabilityState: AvailabilityState;
  straightLineDistanceKm: number;
  observedAt: string;
  expiresAt: string;
  cancellation: HotelCancellation;
  payment: HotelPayment;
  bookingUrl: string | null;
  /** True when the provider's total already includes taxes and fees, so the
   * plan total is COMPLETE even though mandatoryFeeAmountMinor is null. */
  feesIncludedInTotal?: boolean;
}

export interface CalculationSnapshot {
  formulaVersion: string;
  sourceObservationIds: {
    flight: string;
    makkahHotel: string | null;
    madinahHotel: string | null;
  };
  componentAmounts: {
    flight: { originalMinor: number; currency: CurrencyCode; normalizedIdrMinor: number | null };
    makkahHotel: { originalMinor: number | null; currency: CurrencyCode | null; normalizedIdrMinor: number | null };
    madinahHotel: { originalMinor: number | null; currency: CurrencyCode | null; normalizedIdrMinor: number | null };
  };
  fxSnapshots: Array<{ base: CurrencyCode; rateIdrPerMajor: number; observedAt: string }>;
  includedFees: string[];
  missingFields: string[];
  userConstraints: Record<string, unknown>;
  dateDerivationInputs: {
    arrivalSaudiDate: string;
    firstCity: City;
    makkahNights: number;
    madinahNights: number;
  };
  roundingPolicy: string;
  generatedReasons: string[];
}

export interface TripPlan {
  id: string;
  searchFingerprint: string;
  flightObservationId: string;
  makkahHotelObservationId: string | null;
  madinahHotelObservationId: string | null;
  pattern: ItineraryPattern;
  cityOrder: CityOrder;
  firstCity: City;
  secondCity: City;
  makkahCheckIn: string;
  makkahCheckOut: string;
  madinahCheckIn: string;
  madinahCheckOut: string;
  flightPartyTotalIdrMinor: number | null;
  makkahStayTotalIdrMinor: number | null;
  madinahStayTotalIdrMinor: number | null;
  tripTotalIdrMinor: number | null;
  perPersonEquivalentIdrMinor: number | null;
  priceCompleteness: PriceCompleteness;
  tripPlanStatus: TripPlanStatus;
  verificationStatus: VerificationStatus;
  calculationSnapshot: CalculationSnapshot;
  calculatedAt: string;
  expiresAt: string | null;
  version: number;
  components: {
    flight: FlightObservation;
    makkahHotel: HotelObservation | null;
    madinahHotel: HotelObservation | null;
  };
}

export interface HotelSummary {
  providerId: string;
  propertyName: string;
  city: City;
  roomName: string;
  rateName: string;
  boardType: string;
  straightLineDistanceKm: number;
  distanceSemantic: "STRAIGHT_LINE";
  freeCancellation: boolean;
  cancellationDeadline: string | null;
  dueNowAmountMinor: number | null;
  dueAtPropertyAmountMinor: number | null;
  verificationStatus: VerificationStatus;
  observedAt: string;
  expiresAt: string;
  bookingUrl: string | null;
}

export interface TripPlanSummary {
  id: string;
  tripTotalIdrMinor: number | null;
  perPersonEquivalentIdrMinor: number | null;
  subtotals: { flight: number | null; makkah: number | null; madinah: number | null };
  priceCompleteness: PriceCompleteness;
  tripPlanStatus: TripPlanStatus;
  dates: {
    makkahCheckIn: string;
    makkahCheckOut: string;
    madinahCheckIn: string;
    madinahCheckOut: string;
  };
  pattern: ItineraryPattern;
  cityOrder: CityOrder;
  firstCity: City;
  secondCity: City;
  adults: number;
  childrenAges: number[];
  rooms: number;
  flight: {
    providerId: string;
    airline: string;
    airports: { outbound: string; returnAirport: string };
    stops: number;
    durationMinutes: number;
    verificationStatus: VerificationStatus;
    observedAt: string;
    expiresAt: string;
    bookingUrl: string | null;
  };
  makkahHotel: HotelSummary | null;
  madinahHotel: HotelSummary | null;
  included: string[];
  notIncluded: string[];
  calculationSnapshotVersion: string;
  reasons: string[];
}

export interface CoverageRecord {
  domain: "FLIGHT" | "HOTEL";
  providerId: string;
  city: City | null;
  date: string;
  availabilityState: AvailabilityState;
  frontierDate: string | null;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  nextEligibleAt: string | null;
  resultCount: number;
  errorCategory: ErrorCategory | null;
  scanRunId: string | null;
  updatedAt: string;
}

export interface TripSearchResponse {
  requestId: string;
  observedAt: string;
  results: TripPlanSummary[];
  partialResults: TripPlanSummary[];
  coverage: {
    flight: AvailabilityState;
    makkahHotel: AvailabilityState;
    madinahHotel: AvailabilityState;
    hotelFrontierDate: string | null;
  };
  activeProviders: Array<{ id: string; mode: ProviderMode; enabled: boolean }>;
  unavailableProviders: Array<{
    id: string;
    reason: string;
    retryable: boolean;
    nextEligibleAt: string | null;
  }>;
  warnings: string[];
  constraints: TripSearchInput;
  disclaimer: string;
}

export interface ValidationIssue {
  field: string;
  code: string;
  message: string;
}

/** One departure date in the cheapest-date calendar scan. */
export interface CalendarDaySummary {
  departureDate: string;
  hasComplete: boolean;
  countComplete: number;
  cheapestTotalIdrMinor: number | null;
  perPersonEquivalentIdrMinor: number | null;
  planId: string | null;
  pattern: ItineraryPattern | null;
  firstCity: City | null;
  stops: number | null;
  durationMinutes: number | null;
}

export interface CalendarResponse {
  requestId: string;
  observedAt: string;
  scanWindow: {
    start: string;
    end: string;
    requestedDays: number;
    daysScanned: number;
  };
  days: CalendarDaySummary[];
  cheapestDate: string | null;
  cheapestTotalIdrMinor: number | null;
  activeProviders: Array<{ id: string; mode: ProviderMode; enabled: boolean }>;
  warnings: string[];
  constraints: TripSearchInput;
  disclaimer: string;
}

/** FLIGHT watchlist params (07_ALERTS_AND_SCHEDULER.md section 2). */
export interface FlightWatchlistParams {
  origin: string;
  departureStart: string;
  departureEnd: string;
  adults: number;
  childrenAges: number[];
  cabin: CabinClass;
  patterns: ItineraryPattern[];
  maxStops?: number;
  maxLayoverMinutes?: number;
  maxTripDurationMinutes?: number;
}

/** HOTEL watchlist params (07_ALERTS_AND_SCHEDULER.md section 2). */
export interface HotelWatchlistParams {
  city: City;
  checkIn: string;
  checkOut: string;
  adults: number;
  childrenAges: number[];
  rooms: number;
  radiusKm: number;
  freeCancellationOnly: boolean;
}

/** One saved watchlist (07_ALERTS_AND_SCHEDULER.md section 2). */
export interface WatchlistRecord {
  id: string;
  ownerToken: string;
  type: WatchlistType;
  input: TripSearchInput | FlightWatchlistParams | HotelWatchlistParams;
  searchFingerprint: string;
  label: string | null;
  baselineTotalIdrMinor: number | null;
  thresholdIdrMinor: number | null;
  lastAlertedTotalIdrMinor: number | null;
  lastCheckedAt: string | null;
  lastCheckedTotalIdrMinor: number | null;
  lastAlertSentAt: string | null;
  createdAt: string;
  version: number;
}

/** One in-app alert event (07_ALERTS_AND_SCHEDULER.md section 12). */
export interface AlertEventRecord {
  id: string;
  watchlistId: string;
  ownerToken: string;
  eventFingerprint: string;
  currentTotalIdrMinor: number;
  previousTotalIdrMinor: number;
  dropPercent: number;
  payload: unknown;
  createdAt: string;
}
