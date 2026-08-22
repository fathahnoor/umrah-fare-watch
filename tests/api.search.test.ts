import { describe, expect, it } from "vitest";
import { SCENARIO } from "../src/providers/mock/fixtures.js";
import { baseInput, TEST_NOW, withServer } from "./helpers.js";

describe("API integration (mock mode, BUILD-03)", () => {
  it("GET /api/health reports MOCK mode and the fixed horizons", async () => {
    await withServer(TEST_NOW, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/health`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.ok).toBe(true);
      expect(body.mode).toBe("MOCK");
      expect(body.horizons.userDays).toBe(365);
      expect(body.horizons.mockHotelFrontierDays).toBe(330);
    });
  });

  it("POST /api/search/trip returns only COMPLETE plans with exact totals", async () => {
    await withServer(TEST_NOW, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/search/trip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(baseInput()),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.results.length).toBeGreaterThan(0);
      for (const plan of body.results) {
        expect(plan.priceCompleteness).toBe("COMPLETE");
        const sum = (plan.subtotals.flight ?? 0) + (plan.subtotals.makkah ?? 0) + (plan.subtotals.madinah ?? 0);
        expect(sum).toBe(plan.tripTotalIdrMinor);
      }
      expect(body.coverage.flight).toBe("HAS_RESULT");
      expect(body.coverage.makkahHotel).toBe("HAS_RESULT");
      expect(body.coverage.madinahHotel).toBe("HAS_RESULT");
      expect(body.disclaimer).toContain("Harga dan ketersediaan dapat berubah");
      expect(body.constraints.currency).toBe("IDR");
    });
  });

  it("repeated searches succeed and remain deterministic (no id collisions)", async () => {
    await withServer(TEST_NOW, async (baseUrl) => {
      const first = await postSearch(baseUrl, baseInput());
      const second = await postSearch(baseUrl, baseInput());
      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      const a = (await first.json()) as any;
      const b = (await second.json()) as any;
      expect(a.results.length).toBe(b.results.length);
      expect(a.results[0]?.tripTotalIdrMinor).toBe(b.results[0]?.tripTotalIdrMinor);
    });
  });

  it("invalid input returns 400 with VALIDATION_ERROR", async () => {
    await withServer(TEST_NOW, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/search/trip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ origins: ["XXX"], adults: 0 }),
      });
      expect(res.status).toBe(400);
      const body = (await res.json()) as any;
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(body.errors.length).toBeGreaterThan(0);
      expect(body.retryable).toBe(false);
    });
  });

  it("hotel provider failure becomes PROVIDER_UNAVAILABLE without erasing components", async () => {
    await withServer(TEST_NOW, async (baseUrl) => {
      // Overnight flight: departing 2030-02-14 arrives JED on 2030-02-15.
      // makkahNights 4 puts the Madinah check-in on 2030-02-19, away from the
      // expired-offer scenario date (2030-02-20), so Madinah keeps working.
      const input = baseInput({
        departureStart: "2030-02-14",
        departureEnd: "2030-02-14",
        makkahNights: 4,
      });
      const res = await postSearch(baseUrl, input);
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      // Makkah check-in (2030-02-15) hits the unavailable scenario.
      expect(body.coverage.makkahHotel).toBe("PROVIDER_UNAVAILABLE");
      // Madinah check-in (2030-02-20) is a separate date: failure isolation
      // keeps the other city working (REL-01).
      expect(body.coverage.madinahHotel).toBe("HAS_RESULT");
      expect(body.unavailableProviders.some((u: { id: string }) => u.id === "mock-hotel")).toBe(true);
      // Flight plus the surviving Madinah component stay visible as partials.
      expect(body.partialResults.length).toBeGreaterThan(0);
      expect(body.partialResults.every((p: { priceCompleteness: string }) => p.priceCompleteness === "COMPONENT_MISSING")).toBe(true);
      expect(body.partialResults.some((p: { madinahHotel: unknown }) => p.madinahHotel != null)).toBe(true);
    });
  });

  it("hotel check-in beyond the 330-day frontier becomes NOT_YET_SEARCHABLE", async () => {
    await withServer(TEST_NOW, async (baseUrl) => {
      // Departure 2030-04-27 arrives JED on 2030-04-28 (day 331).
      const input = baseInput({
        departureStart: "2030-04-27",
        departureEnd: "2030-04-27",
      });
      const res = await postSearch(baseUrl, input);
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.coverage.makkahHotel).toBe("NOT_YET_SEARCHABLE");
      expect(body.coverage.madinahHotel).toBe("NOT_YET_SEARCHABLE");
      expect(body.results.length).toBe(0);
      expect(body.partialResults.some((p: { priceCompleteness: string }) => p.priceCompleteness === "COMPONENT_MISSING")).toBe(true);
    });
  });

  it("expired flight offers never enter the primary ranking", async () => {
    await withServer(TEST_NOW, async (baseUrl) => {
      const input = baseInput({
        departureStart: SCENARIO.flightExpiredDeparture,
        departureEnd: SCENARIO.flightExpiredDeparture,
      });
      const res = await postSearch(baseUrl, input);
      const body = (await res.json()) as any;
      const allPlans = [...body.results, ...body.partialResults];
      for (const plan of allPlans) {
        expect(plan.tripPlanStatus).not.toBe("EXPIRED");
        expect(plan.flight.verificationStatus).not.toBe("EXPIRED");
      }
    });
  });

  it("GET /api/providers/health lists mock providers as enabled", async () => {
    await withServer(TEST_NOW, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/providers/health`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      const ids = body.providers.map((p: { id: string }) => p.id);
      expect(ids).toContain("mock-flight");
      expect(ids).toContain("mock-hotel");
      expect(body.providers.every((p: { enabled: boolean }) => p.enabled)).toBe(true);
    });
  });

  it("GET /api/coverage exposes frontier and disclaimer", async () => {
    await withServer(TEST_NOW, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/coverage`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.hotelFrontierDate).toBe("2030-04-27");
      expect(body.disclaimer).toContain("Harga dan ketersediaan");
    });
  });

  it("GET / serves the UI index page", async () => {
    await withServer(TEST_NOW, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/`);
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain("Cari Biaya Umrah Termurah");
      expect(html).toContain("Cari kombinasi");
      expect(html).toContain('id="histats_counter"');
      expect(html).toContain("https://sstatic1.histats.com/0.gif?5046661&101");
    });
  });
});

function postSearch(baseUrl: string, body: unknown): Promise<Response> {
  return fetch(`${baseUrl}/api/search/trip`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
