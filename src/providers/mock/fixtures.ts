// Deterministic fixtures for mock mode (04_PROVIDER_AND_DATA_STRATEGY.md).
// All values are synthetic. Prices are pure functions of the inputs so tests
// are repeatable. Scenario dates are reachable only with an injected clock.
import type { City, ItineraryPattern } from "../../domain/types.js";

export const MOCK_FLIGHT_PROVIDER_ID = "mock-flight";
export const MOCK_HOTEL_PROVIDER_ID = "mock-hotel";

export const FLIGHT_ADAPTER_VERSION = "flight-mock-v1";
export const HOTEL_ADAPTER_VERSION = "hotel-mock-v1";

export const SCENARIO = {
  /** Verification returns an already-expired offer. */
  flightExpiredDeparture: "2029-12-15",
  /** Verification throws PROVIDER_UNAVAILABLE. */
  flightUnavailableDeparture: "2029-12-20",
  /** Verified total differs from the indicative candidate total. */
  flightQuoteChangeDeparture: "2029-12-25",
  /** Mandatory fees are unknown: PARTIAL_FEES_UNKNOWN. */
  flightFeesUnknownDeparture: "2029-12-30",
  /** Hotel observations lack an FX snapshot: PARTIAL_FX_MISSING. */
  hotelFxMissingCheckIn: "2030-02-10",
  /** Hotel search throws PROVIDER_UNAVAILABLE. */
  hotelUnavailableCheckIn: "2030-02-15",
  /** Hotel observations are already expired. */
  hotelExpiredCheckIn: "2030-02-20",
  /** Check-in is one day past the 330-day frontier. */
  hotelBeyondFrontierCheckIn: "2030-04-28",
} as const;

export const CITY_AREAS: Record<City, { label: string; latitude: number; longitude: number }> = {
  MAKKAH: { label: "Makkah", latitude: 21.3891, longitude: 39.8579 },
  MADINAH: { label: "Madinah", latitude: 24.5247, longitude: 39.5692 },
};

export const DISTANCE_SEMANTIC = "STRAIGHT_LINE";

export interface MockProperty {
  propertyId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  starRating: number;
  baseRateSarPerRoomNight: number;
  freeCancellation: boolean;
  dueNowFraction: number;
  boardType: string;
  roomName: string;
  rateName: string;
  childSurchargeSarPerNight: number;
}

// Positions are offset from each city center so most results fall inside the
// default 5 km radius and a few fall outside to exercise the radius filter.
export const MOCK_PROPERTIES: Record<City, MockProperty[]> = {
  MAKKAH: [
    { propertyId: "makkah-01", name: "Mock Al Noor Tower Makkah", address: "Jalan Ibrahim Khalil Mock 1", latitude: 21.4225, longitude: 39.8262, starRating: 5, baseRateSarPerRoomNight: 420, freeCancellation: true, dueNowFraction: 0.3, boardType: "Tanpa makan", roomName: "Kamar Deluxe", rateName: "Rate Fleksibel", childSurchargeSarPerNight: 12 },
    { propertyId: "makkah-02", name: "Mock Zamzam View Makkah", address: "Jalan Ajyad Mock 2", latitude: 21.4189, longitude: 39.8269, starRating: 4, baseRateSarPerRoomNight: 350, freeCancellation: true, dueNowFraction: 0.3, boardType: "Termasuk sarapan", roomName: "Kamar Superior", rateName: "Rate Fleksibel", childSurchargeSarPerNight: 10 },
    { propertyId: "makkah-03", name: "Mock Safa Residence Makkah", address: "Distrik Aziziyah Mock 3", latitude: 21.3891, longitude: 39.9019, starRating: 3, baseRateSarPerRoomNight: 260, freeCancellation: false, dueNowFraction: 0, boardType: "Tanpa makan", roomName: "Kamar Standar", rateName: "Non-refundable", childSurchargeSarPerNight: 8 },
    { propertyId: "makkah-04", name: "Mock Marwah Inn Makkah", address: "Jalan Al-Mashaer Mock 4", latitude: 21.3621, longitude: 39.8601, starRating: 3, baseRateSarPerRoomNight: 220, freeCancellation: true, dueNowFraction: 0.2, boardType: "Tanpa makan", roomName: "Kamar Standar", rateName: "Rate Fleksibel", childSurchargeSarPerNight: 6 },
    { propertyId: "makkah-05", name: "Mock Jabal Nur Lodge Makkah", address: "Jalan Ibrahim Khalil Mock 5", latitude: 21.4197, longitude: 39.8612, starRating: 2, baseRateSarPerRoomNight: 150, freeCancellation: false, dueNowFraction: 0, boardType: "Tanpa makan", roomName: "Kamar Ekonomi", rateName: "Non-refundable", childSurchargeSarPerNight: 5 },
    { propertyId: "makkah-06", name: "Mock Hira Garden Makkah", address: "Jalan Al-Hijrah Mock 6", latitude: 21.4383, longitude: 39.8217, starRating: 4, baseRateSarPerRoomNight: 380, freeCancellation: true, dueNowFraction: 0.3, boardType: "Termasuk sarapan", roomName: "Kamar Deluxe", rateName: "Rate Fleksibel", childSurchargeSarPerNight: 11 },
    { propertyId: "makkah-07", name: "Mock Arafat Field Makkah", address: "Jalan Al-Mashaer Mock 7", latitude: 21.3591, longitude: 39.9299, starRating: 2, baseRateSarPerRoomNight: 130, freeCancellation: false, dueNowFraction: 0, boardType: "Tanpa makan", roomName: "Kamar Ekonomi", rateName: "Non-refundable", childSurchargeSarPerNight: 4 },
    { propertyId: "makkah-08", name: "Mock Umm Al-Qura Makkah", address: "Jalan Ibrahim Khalil Mock 8", latitude: 21.4231, longitude: 39.8344, starRating: 5, baseRateSarPerRoomNight: 460, freeCancellation: true, dueNowFraction: 0.3, boardType: "Termasuk sarapan", roomName: "Kamar Eksekutif", rateName: "Rate Fleksibel", childSurchargeSarPerNight: 14 },
  ],
  MADINAH: [
    { propertyId: "madinah-01", name: "Mock Quba Gate Madinah", address: "Jalan Quba Mock 1", latitude: 24.4631, longitude: 39.6077, starRating: 4, baseRateSarPerRoomNight: 340, freeCancellation: true, dueNowFraction: 0.3, boardType: "Termasuk sarapan", roomName: "Kamar Superior", rateName: "Rate Fleksibel", childSurchargeSarPerNight: 10 },
    { propertyId: "madinah-02", name: "Mock Nabawi View Madinah", address: "Jalan Sultanah Mock 2", latitude: 24.4686, longitude: 39.6123, starRating: 5, baseRateSarPerRoomNight: 410, freeCancellation: true, dueNowFraction: 0.3, boardType: "Tanpa makan", roomName: "Kamar Deluxe", rateName: "Rate Fleksibel", childSurchargeSarPerNight: 12 },
    { propertyId: "madinah-03", name: "Mock Al-Haram Court Madinah", address: "Jalan Al-Haram Mock 3", latitude: 24.4672, longitude: 39.6111, starRating: 4, baseRateSarPerRoomNight: 300, freeCancellation: false, dueNowFraction: 0, boardType: "Tanpa makan", roomName: "Kamar Superior", rateName: "Non-refundable", childSurchargeSarPerNight: 9 },
    { propertyId: "madinah-04", name: "Mock Al-Anbariya Madinah", address: "Jalan Al-Anbariya Mock 4", latitude: 24.4742, longitude: 39.5861, starRating: 3, baseRateSarPerRoomNight: 230, freeCancellation: true, dueNowFraction: 0.2, boardType: "Tanpa makan", roomName: "Kamar Standar", rateName: "Rate Fleksibel", childSurchargeSarPerNight: 7 },
    { propertyId: "madinah-05", name: "Mock Masjid Nabawi Inn Madinah", address: "Jalan Sultanah Mock 5", latitude: 24.4694, longitude: 39.6065, starRating: 3, baseRateSarPerRoomNight: 250, freeCancellation: false, dueNowFraction: 0, boardType: "Tanpa makan", roomName: "Kamar Standar", rateName: "Non-refundable", childSurchargeSarPerNight: 7 },
    { propertyId: "madinah-06", name: "Mock Wadi Aqeeq Madinah", address: "Jalan Al-Aqeeq Mock 6", latitude: 24.5454, longitude: 39.5941, starRating: 4, baseRateSarPerRoomNight: 320, freeCancellation: true, dueNowFraction: 0.3, boardType: "Termasuk sarapan", roomName: "Kamar Deluxe", rateName: "Rate Fleksibel", childSurchargeSarPerNight: 10 },
    { propertyId: "madinah-07", name: "Mock Qiblatain Field Madinah", address: "Jalan Qiblatain Mock 7", latitude: 24.5745, longitude: 39.5231, starRating: 2, baseRateSarPerRoomNight: 140, freeCancellation: false, dueNowFraction: 0, boardType: "Tanpa makan", roomName: "Kamar Ekonomi", rateName: "Non-refundable", childSurchargeSarPerNight: 4 },
    { propertyId: "madinah-08", name: "Mock Kuba Oasis Madinah", address: "Jalan Quba Mock 8", latitude: 24.4582, longitude: 39.6138, starRating: 4, baseRateSarPerRoomNight: 360, freeCancellation: true, dueNowFraction: 0.3, boardType: "Termasuk sarapan", roomName: "Kamar Superior", rateName: "Rate Fleksibel", childSurchargeSarPerNight: 11 },
  ],
};

const PATTERN_OFFSET_IDR: Record<ItineraryPattern, number> = {
  ROUNDTRIP_JED: 0,
  ROUNDTRIP_MED: 1_850_000,
  OPENJAW_JED_MED: 3_150_000,
  OPENJAW_MED_JED: 4_900_000,
};

/** Days since 2000-01-01 (UTC) for a local date, used only for stable pricing. */
export function dayNumber(localDate: string): number {
  return Math.round(
    (new Date(`${localDate}T00:00:00Z`).getTime() - Date.UTC(2000, 0, 1)) / 86_400_000,
  );
}

/** Deterministic indicative flight total in IDR minor units. */
export function mockFlightPriceIdr(
  departureLocalDate: string,
  pattern: ItineraryPattern,
  adults: number,
  childrenCount: number,
  stopCount: number,
): number {
  const dayNum = dayNumber(departureLocalDate);
  const adultFare = 4_200_000 + (dayNum % 17) * 210_000;
  const childFare = 3_600_000 + (dayNum % 11) * 150_000;
  const transitAdjust = stopCount === 0 ? 0 : -300_000;
  return (
    adultFare * adults +
    childFare * childrenCount +
    (PATTERN_OFFSET_IDR[pattern] ?? 0) +
    transitAdjust
  );
}

/** Deterministic SAR room total for all rooms and nights plus child surcharge. */
export function mockHotelRateSar(
  property: MockProperty,
  checkIn: string,
  nights: number,
  rooms: number,
  childrenAges: number[],
): number {
  const dayNum = dayNumber(checkIn);
  const ratePerNight = property.baseRateSarPerRoomNight + (dayNum % 5) * 10;
  const childSurcharge =
    childrenAges.filter((age) => age >= 6).length * property.childSurchargeSarPerNight;
  return ratePerNight * nights * rooms + childSurcharge * nights;
}

export function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371;
  const toRad = (deg: number): number => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 100) / 100;
}
