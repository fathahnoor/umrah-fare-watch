import { afterEach, describe, expect, it, vi } from "vitest";
import { loadConfig } from "../src/config.js";
import { convertToIdrRate, liveFxSnapshot } from "../src/providers/fxLive.js";
import {
  mapAviasalesPayload,
  TRAVELPAYOUTS_PROVIDER_ID,
  TravelpayoutsFlightProvider,
} from "../src/providers/travelpayouts/travelpayoutsFlightProvider.js";
import {
  DUFFEL_FLIGHT_PROVIDER_ID,
  mapOfferToObservation,
} from "../src/providers/duffel/duffelFlightProvider.js";
import {
  activeFlightProvider,
  createRegistry,
} from "../src/providers/registry.js";
import { MOCK_FLIGHT_PROVIDER_ID } from "../src/providers/mock/fixtures.js";
import { ProviderError, type FlightDiscoveryInput } from "../src/providers/types.js";
import { SerpapiClient } from "../src/providers/serpapi/serpapiClient.js";
import type { FlightCandidate } from "../src/domain/types.js";

const NOW = new Date("2029-06-01T08:00:00Z");

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("Provider adapter contract fixtures (offline, no tokens)", () => {
  it("Travelpayouts mapAviasalesPayload maps realistic prices_for_dates rows", () => {
    const input = {
      origin: "CGK",
      departureStart: "2029-12-01",
      departureEnd: "2029-12-31",
      adults: 1,
      childrenAges: [] as number[],
      patterns: ["ROUNDTRIP_JED", "ROUNDTRIP_MED"],
      cabin: "economy",
      now: NOW,
    } as FlightDiscoveryInput;
    const candidates = mapAviasalesPayload(
      {
        success: true,
        currency: "USD",
        data: [
          {
            origin: "CGK",
            destination: "JED",
            departure_at: "2029-12-05T02:10:00Z",
            return_at: "2029-12-15T10:40:00Z",
            price: 345.67,
            airline: "SA",
            flight_number: "SA 916",
            transfers: 0,
            duration: 570,
          },
          // Wrong destination: must be filtered out for this pattern.
          { origin: "CGK", destination: "KUL", departure_at: "2029-12-06T01:00:00Z", return_at: "2029-12-16T02:00:00Z", price: 100, airline: "AK", flight_number: "AK 123" },
          // Wrong origin: must be filtered out.
          { origin: "SUB", destination: "JED", departure_at: "2029-12-07T01:00:00Z", return_at: "2029-12-17T02:00:00Z", price: 400, airline: "SA", flight_number: "SA 900" },
        ],
      },
      input,
      NOW,
    );
    // Only the CGK->JED row survives, and only for ROUNDTRIP_JED.
    expect(candidates).toHaveLength(1);
    const c = candidates[0] as FlightCandidate;
    expect(c.providerId).toBe(TRAVELPAYOUTS_PROVIDER_ID);
    expect(c.pattern).toBe("ROUNDTRIP_JED");
    expect(c.outboundAirport).toBe("JED");
    expect(c.returnAirport).toBe("JED");
    expect(c.departureLocalDate).toBe("2029-12-05");
    expect(c.returnLocalDate).toBe("2029-12-15");
    expect(c.stopCount).toBe(0);
    expect(c.durationMinutes).toBe(570);
    expect(c.indicativeTotalMinor).toBe(34567);
    expect(c.currency).toBe("USD");
    expect(c.verificationStatus).toBe("INDICATIVE");
    expect(c.canonicalKey).toBe(`travelpayouts|CGK|JED|2029-12-05|2029-12-15|ROUNDTRIP_JED`);
    expect(new Date(c.expiresAt).getTime()).toBe(NOW.getTime() + 6 * 3_600_000);
  });

  it("Travelpayouts provider is disabled without the activation gate and throws ACCESS_NOT_CONFIGURED", async () => {
    // Token + master switch alone are not enough: the per-provider opt-in is
    // required because the route-aware smoke test showed the free tier serves
    // only the RU-market cache (empty for Indonesian routes).
    const config = loadConfig({ TRAVELPAYOUTS_TOKEN: "test-token", REAL_PROVIDERS_ENABLED: "true" });
    const provider = new TravelpayoutsFlightProvider(config);
    expect(provider.enabled).toBe(false);
    await expect(
      provider.discover({
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
  });

  it("Duffel mapOfferToObservation maps a realistic offer payload", () => {
    const candidate: FlightCandidate = {
      id: "cgk-jed-20291205-20291215",
      providerId: DUFFEL_FLIGHT_PROVIDER_ID,
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
      canonicalKey: "duffel|cgk|jed|20291205|20291215",
    };
    const observation = mapOfferToObservation(
      {
        id: "off_0000AeroX",
        total_amount: "612.35",
        total_currency: "USD",
        tax_amount: "45.00",
        slices: [
          {
            segments: [
              {
                origin: { iata_code: "CGK" },
                destination: { iata_code: "JED" },
                departing_at: "2029-12-05T02:10:00Z",
                arriving_at: "2029-12-05T07:30:00Z",
                operating_carrier: { name: "Saudia" },
                marketing_carrier: { name: "Saudia" },
                flight_number: "SA916",
              },
            ],
          },
          {
            segments: [
              {
                origin: { iata_code: "JED" },
                destination: { iata_code: "CGK" },
                departing_at: "2029-12-15T10:40:00Z",
                arriving_at: "2029-12-15T18:00:00Z",
                operating_carrier: { name: "Saudia" },
                marketing_carrier: { name: "Saudia" },
                flight_number: "SA915",
              },
            ],
          },
        ],
      },
      candidate,
      { candidate, adults: 1, childrenAges: [], cabin: "economy", now: NOW },
      NOW.toISOString(),
    );
    expect(observation.providerId).toBe(DUFFEL_FLIGHT_PROVIDER_ID);
    expect(observation.providerOfferId).toBe("off_0000AeroX");
    expect(observation.originalAmountMinor).toBe(61235);
    expect(observation.originalCurrency).toBe("USD");
    expect(observation.taxAmountMinor).toBe(4500);
    expect(observation.verificationStatus).toBe("LIVE_VERIFIED");
    expect(observation.segments).toHaveLength(2);
    expect(observation.segments[0]?.carrier).toBe("Saudia");
    expect(observation.segments[0]?.fromAirport).toBe("CGK");
    expect(observation.segments[1]?.toAirport).toBe("CGK");
    expect(observation.normalizedIdrAmountMinor).not.toBeNull();
  });

  it("convertToIdrRate derives IDR per unit from a base-rate map", () => {
    const rates = { USD: 1, IDR: 16000, SAR: 3.75 };
    expect(convertToIdrRate(rates, "USD")).toBeCloseTo(16000, 3);
    expect(convertToIdrRate(rates, "SAR")).toBeCloseTo(16000 / 3.75, 3);
    expect(() => convertToIdrRate({ USD: 1, IDR: 16000 }, "EUR")).toThrow();
  });

  it("liveFxSnapshot refuses to run without an API key", async () => {
    await expect(liveFxSnapshot("USD", null, "https://example.test", NOW)).rejects.toMatchObject({
      category: "ACCESS_NOT_CONFIGURED",
    });
  });

  it("liveFxSnapshot reports an exhausted monthly allowance as QUOTA_EXCEEDED", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            success: false,
            error: {
              code: 104,
              type: "monthly_request_limit_reached",
              info: "Your monthly request volume has been reached.",
            },
          }),
          { status: 403, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    await expect(
      liveFxSnapshot("USD", "test-key", "https://example.test/live", NOW),
    ).rejects.toMatchObject({
      category: "QUOTA_EXCEEDED",
      retryable: false,
    });
  });

  it("registry activation gate keeps mock active until REAL_PROVIDERS_ENABLED", () => {
    // Token alone: adapter present but disabled, mock still wins.
    const gated = createRegistry(
      loadConfig({ TRAVELPAYOUTS_TOKEN: "t", DUFFEL_TOKEN: "d", MOCK_MODE: "true" }),
    );
    expect(gated.flightProviders.map((p) => p.id).sort()).toEqual(["duffel-flights", "mock-flight", "travelpayouts"]);
    expect(gated.flightProviders.every((p) => p.enabled === (p.id === "mock-flight"))).toBe(true);
    expect(activeFlightProvider(gated).id).toBe(MOCK_FLIGHT_PROVIDER_ID);

    // Master switch + token + per-provider opt-in: real adapter becomes active.
    const live = createRegistry(
      loadConfig({
        TRAVELPAYOUTS_TOKEN: "t",
        TRAVELPAYOUTS_ENABLED: "true",
        REAL_PROVIDERS_ENABLED: "true",
        MOCK_MODE: "true",
      }),
    );
    expect(activeFlightProvider(live).id).toBe(TRAVELPAYOUTS_PROVIDER_ID);
  });

  it("ProviderError carries the activation category", () => {
    const err = new ProviderError("ACCESS_NOT_CONFIGURED", "disabled", { retryable: false });
    expect(err.category).toBe("ACCESS_NOT_CONFIGURED");
    expect(err.retryable).toBe(false);
  });

  it("SerpAPI maps an exhausted monthly search balance to QUOTA_EXCEEDED", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "Your account has run out of searches." }), {
          status: 429,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    const client = new SerpapiClient("test-key");
    await expect(client.get({ engine: "google_flights" })).rejects.toMatchObject({
      category: "QUOTA_EXCEEDED",
      retryable: false,
      nextEligibleAt: null,
    });
  });

  it("SerpAPI keeps hourly throughput errors distinct from exhausted quota", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "Hourly throughput limit reached." }), {
          status: 429,
          headers: { "Content-Type": "application/json", "Retry-After": "60" },
        }),
      ),
    );
    const client = new SerpapiClient("test-key");
    await expect(client.get({ engine: "google_hotels" })).rejects.toMatchObject({
      category: "RATE_LIMITED",
      retryable: true,
      nextEligibleAt: new Date(NOW.getTime() + 60_000).toISOString(),
    });
  });
});
