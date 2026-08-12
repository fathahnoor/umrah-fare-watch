import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";
import { SERPAPI_FLIGHT_PROVIDER_ID, mapGoogleFlightsObservation, mapGoogleFlightsPayload, SerpapiFlightProvider } from "../src/providers/serpapi/serpapiFlightProvider.js";
import { SERPAPI_HOTEL_PROVIDER_ID, mapGoogleHotelsPayload, SerpapiHotelProvider, straightLineKm } from "../src/providers/serpapi/serpapiHotelProvider.js";
import type { FlightCandidate } from "../src/domain/types.js";
import type { FlightDiscoveryInput, HotelSearchInput } from "../src/providers/types.js";

const NOW = new Date("2029-06-01T08:00:00Z");

describe("SerpAPI adapter contract fixtures (offline, no key)", () => {
  it("mapGoogleFlightsPayload maps realistic Google Flights rows", () => {
    const input: FlightDiscoveryInput = {
      origin: "CGK",
      departureStart: "2029-12-01",
      departureEnd: "2029-12-31",
      adults: 1,
      childrenAges: [],
      patterns: ["ROUNDTRIP_JED"],
      cabin: "economy",
      now: NOW,
    };
    const candidates = mapGoogleFlightsPayload(
      {
        best_flights: [
          {
            flights: [
              {
                departure_airport: { id: "CGK", time: "2029-12-05T02:10:00Z" },
                arrival_airport: { id: "JED", time: "2029-12-05T07:30:00Z" },
                airline: "Saudia",
                flight_number: "SA916",
              },
            ],
            total_duration: 570,
            price: 412.5,
            deep_link: "https://www.google.com/travel/flights/xyz",
            booking_token: "tok-1",
          },
        ],
        other_flights: [],
        price_insights: { lowest_price: 400, typical_price_range: [400, 520] },
      },
      input,
      NOW,
    );
    expect(candidates).toHaveLength(1);
    const c = candidates[0] as FlightCandidate;
    expect(c.providerId).toBe(SERPAPI_FLIGHT_PROVIDER_ID);
    expect(c.departureLocalDate).toBe("2029-12-05");
    expect(c.pattern).toBe("ROUNDTRIP_JED");
    expect(c.stopCount).toBe(0);
    expect(c.indicativeTotalMinor).toBe(41250);
    expect(c.currency).toBe("USD");
    expect(new Date(c.expiresAt).getTime()).toBe(NOW.getTime() + 6 * 3_600_000);
  });

  it("mapGoogleFlightsObservation attaches the allowlisted deep link and IDR total", () => {
    const candidate: FlightCandidate = {
      id: "serpapi-cand-1",
      providerId: SERPAPI_FLIGHT_PROVIDER_ID,
      origin: "CGK",
      outboundAirport: "JED",
      returnAirport: "JED",
      departureLocalDate: "2029-12-05",
      returnLocalDate: "2029-12-15",
      pattern: "ROUNDTRIP_JED",
      stopCount: 0,
      durationMinutes: 570,
      indicativeTotalMinor: 0,
      currency: "USD",
      observedAt: NOW.toISOString(),
      expiresAt: new Date(NOW.getTime() + 3_600_000).toISOString(),
      verificationStatus: "INDICATIVE",
      canonicalKey: "serpapi|CGK|JED|2029-12-05|2029-12-15|ROUNDTRIP_JED",
    };
    const observation = mapGoogleFlightsObservation(
      {
        flights: [
          {
            departure_airport: { id: "CGK", time: "2029-12-05T02:10:00Z" },
            arrival_airport: { id: "JED", time: "2029-12-05T07:30:00Z" },
            airline: "Saudia",
            flight_number: "SA916",
          },
        ],
        total_duration: 570,
        price: 412.5,
        deep_link: "https://www.google.com/travel/flights/xyz",
        booking_token: "tok-1",
      },
      candidate,
      { candidate, adults: 1, childrenAges: [], cabin: "economy", now: NOW },
      NOW.toISOString(),
    );
    expect(observation.providerId).toBe(SERPAPI_FLIGHT_PROVIDER_ID);
    expect(observation.providerOfferId).toBe("tok-1");
    expect(observation.originalAmountMinor).toBe(41250);
    expect(observation.verificationStatus).toBe("LIVE_VERIFIED");
    expect(observation.bookingUrl).toBe("https://www.google.com/travel/flights/xyz");
    expect(observation.segments[0]?.carrier).toBe("Saudia");
    expect(observation.normalizedIdrAmountMinor).not.toBeNull();
  });

  it("mapGoogleHotelsPayload maps properties and computes straight-line distance", () => {
    const input: HotelSearchInput = {
      providerId: SERPAPI_HOTEL_PROVIDER_ID,
      city: "MAKKAH",
      checkIn: "2029-12-06",
      checkOut: "2029-12-11",
      adults: 1,
      childrenAges: [],
      rooms: 1,
      radiusKm: 5,
      freeCancellationOnly: false,
      currency: "IDR",
      now: NOW,
    };
    const observations = mapGoogleHotelsPayload(
      {
        properties: [
          {
            name: "Swissotel Makkah",
            property_token: "swissotel-makkah",
            location: {
              latitude: 21.421,
              longitude: 39.826,
              address: { address_line: "Ibrahim Al Khalil St" },
            },
            ratings: { stars: 5, rating: 9.1, reviews: 1200 },
            price: { current_price: { amount: 180, currency: "USD" }, amount: 190 },
            check_in_time: "3:00 PM",
            check_out_time: "12:00 PM",
          },
          {
            // Outside radius: 21.5, 39.9 is ~12 km away from Makkah center.
            name: "Far Hotel",
            property_token: "far-hotel",
            location: { latitude: 21.5, longitude: 39.9 },
            price: { current_price: { amount: 60, currency: "USD" }, amount: 60 },
          },
          {
            // No price: must be skipped.
            name: "No Price",
            property_token: "no-price",
          },
        ],
      },
      input,
      NOW,
    );
    expect(observations).toHaveLength(2);
    const near = observations.find((o) => o.propertyName === "Swissotel Makkah");
    const far = observations.find((o) => o.propertyName === "Far Hotel");
    expect(near?.city).toBe("MAKKAH");
    expect(near?.straightLineDistanceKm).toBeLessThan(5);
    expect(near?.normalizedIdrAmountMinor).not.toBeNull();
    expect(near?.nights).toBe(5);
    expect(near?.verificationStatus).toBe("LIVE_VERIFIED");
    expect(far?.straightLineDistanceKm).toBeGreaterThan(10);
    expect(far?.normalizedIdrAmountMinor).not.toBeNull();
  });

  it("straightLineKm returns 0 for the same point and sane values for known pairs", () => {
    expect(straightLineKm(21.3891, 39.8579, 21.3891, 39.8579)).toBeCloseTo(0, 6);
    // Makkah -> Madinah is roughly 340 km.
    const d = straightLineKm(21.3891, 39.8579, 24.5247, 39.5692);
    expect(d).toBeGreaterThan(300);
    expect(d).toBeLessThan(400);
  });

  it("SerpAPI providers are disabled without the gate and throw ACCESS_NOT_CONFIGURED", async () => {
    const config = loadConfig({ SERPAPI_API_KEY: "test-key" });
    const flight = new SerpapiFlightProvider(config);
    const hotel = new SerpapiHotelProvider(config);
    expect(flight.enabled).toBe(false);
    expect(hotel.enabled).toBe(false);
    await expect(
      flight.discover({
        origin: "CGK",
        departureStart: "2029-12-01",
        departureEnd: "2029-12-03",
        adults: 1,
        childrenAges: [],
        patterns: ["ROUNDTRIP_JED"],
        cabin: "economy",
        now: NOW,
      }),
    ).rejects.toMatchObject({ category: "ACCESS_NOT_CONFIGURED" });
    await expect(
      hotel.search({
        providerId: SERPAPI_HOTEL_PROVIDER_ID,
        city: "MAKKAH",
        checkIn: "2029-12-06",
        checkOut: "2029-12-11",
        adults: 1,
        childrenAges: [],
        rooms: 1,
        radiusKm: 5,
        freeCancellationOnly: false,
        currency: "IDR",
        now: NOW,
      }),
    ).rejects.toMatchObject({ category: "ACCESS_NOT_CONFIGURED" });
  });
});
