import type { ItineraryPattern } from "./types.js";

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

/**
 * City order for a flight. AUTO follows the arrival airport: JED arrival
 * means Makkah first, MED arrival means Madinah first. Overrides always win.
 */
export function firstCityForFlight(
  cityOrder: "AUTO" | "MAKKAH_FIRST" | "MADINAH_FIRST",
  outboundAirport: string,
): "MAKKAH" | "MADINAH" {
  if (cityOrder === "MAKKAH_FIRST") {
    return "MAKKAH";
  }
  if (cityOrder === "MADINAH_FIRST") {
    return "MADINAH";
  }
  return outboundAirport === "JED" ? "MAKKAH" : "MADINAH";
}
