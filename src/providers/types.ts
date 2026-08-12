// Provider contracts (03_TECHNICAL_ARCHITECTURE.md section 4).
import type {
  AvailabilityState,
  ErrorCategory,
  FlightCandidate,
  FlightObservation,
  HotelObservation,
  ItineraryPattern,
  ProviderMode,
} from "../domain/types.js";

export interface FlightDiscoveryInput {
  origin: string;
  departureStart: string;
  departureEnd: string;
  adults: number;
  childrenAges: number[];
  patterns: ItineraryPattern[];
  cabin: string;
  maxStops?: number;
  maxLayoverMinutes?: number;
  maxTripDurationMinutes?: number;
  now: Date;
}

export interface FlightDiscoveryResult {
  candidates: FlightCandidate[];
  observedAt: string;
}

export interface FlightVerificationInput {
  candidate: FlightCandidate;
  adults: number;
  childrenAges: number[];
  cabin: string;
  now: Date;
}

export interface FlightVerificationResult {
  observation: FlightObservation;
}

export interface HotelFrontier {
  providerId: string;
  checkInFrontierDate: string;
  observedAt: string;
}

export interface HotelSearchInput {
  providerId: string;
  city: "MAKKAH" | "MADINAH";
  checkIn: string;
  checkOut: string;
  adults: number;
  childrenAges: number[];
  rooms: number;
  radiusKm: number;
  freeCancellationOnly: boolean;
  currency: "IDR";
  now: Date;
}

export type HotelSearchState = "HAS_RESULT" | "NO_RESULT" | "NOT_YET_SEARCHABLE";

export interface HotelSearchResult {
  state: HotelSearchState;
  observations: HotelObservation[];
  frontierDate: string;
  observedAt: string;
}

export interface ProviderHealthSnapshot {
  id: string;
  mode: ProviderMode;
  enabled: boolean;
  enabledReason: string | null;
  disabledReason: string | null;
  adapterVersion: string;
  lastSuccessAt: string | null;
  lastFailureCategory: ErrorCategory | null;
  frontier: string | null;
  calls: number;
  failures: number;
  cacheHits: number;
}

export interface FlightProvider {
  id: string;
  mode: ProviderMode;
  /** Whether this adapter may be used by the app right now. */
  readonly enabled: boolean;
  discover(input: FlightDiscoveryInput): Promise<FlightDiscoveryResult>;
  verify(input: FlightVerificationInput): Promise<FlightVerificationResult>;
  health(): Promise<ProviderHealthSnapshot>;
}

export interface HotelProvider {
  id: string;
  mode: ProviderMode;
  readonly enabled: boolean;
  getFrontier(now: Date): Promise<HotelFrontier>;
  search(input: HotelSearchInput): Promise<HotelSearchResult>;
  health(): Promise<ProviderHealthSnapshot>;
}

export interface ProviderErrorOptions {
  retryable?: boolean;
  nextEligibleAt?: string | null;
  availabilityState?: AvailabilityState;
}

export class ProviderError extends Error {
  readonly category: ErrorCategory;
  readonly retryable: boolean;
  readonly nextEligibleAt: string | null;
  readonly availabilityState: AvailabilityState;

  constructor(category: ErrorCategory, message: string, options: ProviderErrorOptions = {}) {
    super(message);
    this.name = "ProviderError";
    this.category = category;
    this.retryable = options.retryable ?? false;
    this.nextEligibleAt = options.nextEligibleAt ?? null;
    this.availabilityState = options.availabilityState ?? "PROVIDER_UNAVAILABLE";
  }
}
