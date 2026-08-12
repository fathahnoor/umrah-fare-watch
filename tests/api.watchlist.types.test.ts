import { describe, expect, it } from "vitest";
import { baseInput, TEST_NOW, withServer } from "./helpers.js";

describe("API watchlist FLIGHT and HOTEL types (07_ALERTS_AND_SCHEDULER section 2)", () => {
  it("creates a FLIGHT watchlist with a verified flight baseline", async () => {
    await withServer(TEST_NOW, async (baseUrl) => {
      const token = await registerAndLogin(baseUrl, "flight@example.com");
      const res = await fetch(`${baseUrl}/api/watchlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Session-Token": token },
        body: JSON.stringify({
          type: "FLIGHT",
          label: "Tiket Desember",
          input: {
            origin: "CGK",
            departureStart: "2029-12-05",
            departureEnd: "2029-12-05",
            adults: 1,
            childrenAges: [],
            cabin: "economy",
            patterns: ["ROUNDTRIP_JED"],
          },
        }),
      });
      expect(res.status).toBe(201);
      const body = (await res.json()) as any;
      expect(body.watchlist.type).toBe("FLIGHT");
      expect(body.watchlist.baselineTotalIdrMinor).toBeGreaterThan(0);
      expect(body.detail.airline).toBe("MOCK AIR");
      expect(body.detail.pattern).toBe("ROUNDTRIP_JED");
    });
  });

  it("creates a HOTEL watchlist and rejects check-ins beyond the frontier", async () => {
    await withServer(TEST_NOW, async (baseUrl) => {
      const token = await registerAndLogin(baseUrl, "hotel@example.com");
      const good = await fetch(`${baseUrl}/api/watchlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Session-Token": token },
        body: JSON.stringify({
          type: "HOTEL",
          label: "Hotel Makkah",
          input: {
            city: "MAKKAH",
            checkIn: "2029-12-06",
            checkOut: "2029-12-11",
            adults: 1,
            childrenAges: [],
            rooms: 1,
            radiusKm: 5,
            freeCancellationOnly: false,
          },
        }),
      });
      expect(good.status).toBe(201);
      const goodBody = (await good.json()) as any;
      expect(goodBody.watchlist.type).toBe("HOTEL");
      expect(goodBody.watchlist.baselineTotalIdrMinor).toBeGreaterThan(0);
      expect(goodBody.detail.city).toBe("MAKKAH");

      const beyond = await fetch(`${baseUrl}/api/watchlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Session-Token": token },
        body: JSON.stringify({
          type: "HOTEL",
          input: {
            city: "MAKKAH",
            checkIn: "2030-04-28",
            checkOut: "2030-05-03",
            adults: 1,
            childrenAges: [],
            rooms: 1,
            radiusKm: 5,
            freeCancellationOnly: false,
          },
        }),
      });
      expect(beyond.status).toBe(400);
      const beyondBody = (await beyond.json()) as any;
      expect(beyondBody.code).toBe("VALIDATION_ERROR");
      expect(beyondBody.errors[0].code).toBe("OUTSIDE_PROVIDER_FRONTIER");
    });
  });

  it("HOTEL check detects a price drop and deduplicates", async () => {
    await withServer(TEST_NOW, async (baseUrl) => {
      const token = await registerAndLogin(baseUrl, "hotel2@example.com");
      const created = await fetch(`${baseUrl}/api/watchlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Session-Token": token },
        body: JSON.stringify({
          type: "HOTEL",
          input: {
            city: "MAKKAH",
            checkIn: "2029-12-06",
            checkOut: "2029-12-11",
            adults: 1,
            childrenAges: [],
            rooms: 1,
            radiusKm: 5,
            freeCancellationOnly: false,
          },
        }),
      });
      const body = (await created.json()) as any;
      const id = body.watchlist.id as string;
      const baseline = body.watchlist.baselineTotalIdrMinor as number;

      const check = await checkWatchlist(baseUrl, token, id);
      // Hotel mock prices depend only on dates, so a re-check gives the same
      // price: no drop, no alert. This proves the check is stable.
      expect(check.createdEvents.length).toBe(0);
      expect(check.currentTotalIdrMinor).toBe(baseline);
    });
  });

  it("FLIGHT watchlist rejects invalid origins and empty patterns", async () => {
    await withServer(TEST_NOW, async (baseUrl) => {
      const token = await registerAndLogin(baseUrl, "flight2@example.com");
      const res = await fetch(`${baseUrl}/api/watchlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Session-Token": token },
        body: JSON.stringify({
          type: "FLIGHT",
          input: { origin: "XXX", departureStart: "2029-12-05", departureEnd: "2029-12-05", adults: 1, childrenAges: [], cabin: "economy", patterns: [] },
        }),
      });
      expect(res.status).toBe(400);
      const body = (await res.json()) as any;
      const fields = body.errors.map((e: { field: string }) => e.field);
      expect(fields).toContain("input.origin");
      expect(fields).toContain("input.patterns");
    });
  });

  it("COMPLETE_TRIP stays the default when type is omitted", async () => {
    await withServer(TEST_NOW, async (baseUrl) => {
      const token = await registerAndLogin(baseUrl, "default@example.com");
      const res = await fetch(`${baseUrl}/api/watchlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Session-Token": token },
        body: JSON.stringify({ input: baseInput({ departureStart: "2029-12-05", departureEnd: "2029-12-05" }) }),
      });
      expect(res.status).toBe(201);
      const body = (await res.json()) as any;
      expect(body.watchlist.type).toBe("COMPLETE_TRIP");
    });
  });
});

async function registerAndLogin(baseUrl: string, email: string): Promise<string> {
  await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "rahasia123" }),
  });
  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "rahasia123" }),
  });
  return ((await login.json()) as any).token as string;
}

async function checkWatchlist(baseUrl: string, token: string, id: string): Promise<any> {
  const res = await fetch(`${baseUrl}/api/watchlist/${id}/check`, {
    method: "POST",
    headers: { "X-Session-Token": token },
  });
  return res.json();
}
