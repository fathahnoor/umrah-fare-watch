// Deterministic canonical keys for deduplication (02_LONG_HORIZON_MONITORING.md section 7).
import type { City, TripSearchInput } from "./types.js";

export const HOTEL_ADAPTER_VERSION = "hotel-mock-v1";

export interface CanonicalHotelSearchKeyParts {
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

export function canonicalHotelSearchKey(parts: CanonicalHotelSearchKeyParts): string {
  const children = [...parts.childrenAges].sort((a, b) => a - b);
  return [
    parts.providerId,
    parts.city,
    parts.checkIn,
    parts.checkOut,
    parts.adults,
    children.length > 0 ? children.join(",") : "-",
    parts.rooms,
    parts.radiusKm.toFixed(2),
    parts.freeCancellationOnly ? "FC" : "NOFC",
    parts.currency,
    HOTEL_ADAPTER_VERSION,
  ].join("|");
}

export function canonicalFlightKey(input: {
  providerId: string;
  origin: string;
  outboundAirport: string;
  returnAirport: string;
  departureLocalDate: string;
  returnLocalDate: string;
  pattern: string;
  adults: number;
  childrenAges: number[];
  cabin: string;
}): string {
  const children = [...input.childrenAges].sort((a, b) => a - b);
  return [
    input.providerId,
    input.origin,
    input.outboundAirport,
    input.returnAirport,
    input.departureLocalDate,
    input.returnLocalDate,
    input.pattern,
    input.adults,
    children.length > 0 ? children.join(",") : "-",
    input.cabin,
  ].join("|");
}

/** Stable fingerprint of a normalized TripSearchInput for watchlist matching. */
export function searchFingerprint(input: TripSearchInput): string {
  const origins = [...input.origins].sort().join(",");
  const patterns = [...input.patterns].sort().join(",");
  const children = [...input.childrenAges].sort((a, b) => a - b).join(",");
  return [
    origins,
    input.departureStart,
    input.departureEnd,
    input.adults,
    children || "-",
    input.rooms,
    input.makkahNights,
    input.madinahNights,
    patterns,
    input.cityOrder,
    input.cabin,
    input.maxStops ?? "-",
    input.maxLayoverMinutes ?? "-",
    input.maxTripDurationMinutes ?? "-",
    input.makkahRadiusKm.toFixed(2),
    input.madinahRadiusKm.toFixed(2),
    input.freeCancellationOnly ? "FC" : "NOFC",
    input.currency,
  ].join("|");
}
