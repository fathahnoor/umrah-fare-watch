// Price completeness semantics (01_PRODUCT_REQUIREMENTS.md section 6).
// Missing data is never converted to zero.
import type {
  FlightObservation,
  HotelObservation,
  PriceCompleteness,
} from "./types.js";

export function flightPriceCompleteness(flight: FlightObservation): PriceCompleteness {
  if (flight.mandatoryFeeAmountMinor == null) {
    return "PARTIAL_FEES_UNKNOWN";
  }
  if (flight.normalizedIdrAmountMinor == null || flight.fxRate == null) {
    return "PARTIAL_FX_MISSING";
  }
  return "COMPLETE";
}

export function hotelPriceCompleteness(hotel: HotelObservation): PriceCompleteness {
  if (hotel.mandatoryFeeAmountMinor == null) {
    return "PARTIAL_FEES_UNKNOWN";
  }
  if (hotel.normalizedIdrAmountMinor == null || hotel.fxRate == null) {
    return "PARTIAL_FX_MISSING";
  }
  return "COMPLETE";
}

export function planPriceCompleteness(
  flight: PriceCompleteness,
  makkah: PriceCompleteness | null,
  madinah: PriceCompleteness | null,
): PriceCompleteness {
  if (makkah == null || madinah == null) {
    return "COMPONENT_MISSING";
  }
  if (
    flight === "PARTIAL_FEES_UNKNOWN" ||
    makkah === "PARTIAL_FEES_UNKNOWN" ||
    madinah === "PARTIAL_FEES_UNKNOWN"
  ) {
    return "PARTIAL_FEES_UNKNOWN";
  }
  if (
    flight === "PARTIAL_FX_MISSING" ||
    makkah === "PARTIAL_FX_MISSING" ||
    madinah === "PARTIAL_FX_MISSING"
  ) {
    return "PARTIAL_FX_MISSING";
  }
  return "COMPLETE";
}

export function isExpired(expiresAt: string, now: Date): boolean {
  return new Date(expiresAt).getTime() <= now.getTime();
}
