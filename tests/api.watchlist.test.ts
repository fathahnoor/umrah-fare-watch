import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";
import { createApp } from "../src/api/server.js";
import { createMockRegistry } from "../src/providers/registry.js";
import { SqliteCoverageRepo } from "../src/store/coverage.js";
import { openDb } from "../src/store/db.js";
import { SqliteStore } from "../src/store/repositories.js";
import { SqliteWatchlistRepo } from "../src/store/watchlist.js";
import { baseInput, TEST_NOW } from "./helpers.js";

const TOKEN = "device-demo-1";
const HOUR_MS = 3_600_000;

describe("API watchlist + alerts (mock mode, 07_ALERTS_AND_SCHEDULER MVP slice)", () => {
  it("requires a watchlist token (AUTH_REQUIRED)", async () => {
    await withMutableClock(TEST_NOW, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/watchlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: baseInput() }),
      });
      expect(res.status).toBe(401);
      const body = (await res.json()) as any;
      expect(body.code).toBe("AUTH_REQUIRED");
    });
  });

  it("creates a watchlist with a baseline and lists it for its owner only", async () => {
    await withMutableClock(TEST_NOW, async (baseUrl) => {
      const created = await postWatchlist(baseUrl, TOKEN, {
        input: baseInput({ departureStart: "2029-12-05", departureEnd: "2029-12-05" }),
        label: "Umroh Desember",
      });
      expect(created.status).toBe(201);
      const body = (await created.json()) as any;
      expect(body.watchlist.type).toBe("COMPLETE_TRIP");
      expect(body.watchlist.baselineTotalIdrMinor).toBeGreaterThan(0);
      expect(body.watchlist.lastCheckedTotalIdrMinor).toBe(body.watchlist.baselineTotalIdrMinor);
      expect(body.plan.tripTotalIdrMinor).toBe(body.watchlist.baselineTotalIdrMinor);

      const list = await fetch(`${baseUrl}/api/watchlist`, {
        headers: { "X-Watchlist-Token": TOKEN },
      });
      const listBody = (await list.json()) as any;
      expect(listBody.watchlists.length).toBe(1);
      expect(listBody.watchlists[0].id).toBe(body.watchlist.id);

      const otherOwner = await fetch(`${baseUrl}/api/watchlist`, {
        headers: { "X-Watchlist-Token": "device-other" },
      });
      const otherBody = (await otherOwner.json()) as any;
      expect(otherBody.watchlists.length).toBe(0);
    });
  });

  it("identical input returns the existing watchlist (idempotent create)", async () => {
    await withMutableClock(TEST_NOW, async (baseUrl) => {
      const input = { input: baseInput({ departureStart: "2029-12-05", departureEnd: "2029-12-05" }) };
      const first = await postWatchlist(baseUrl, TOKEN, input);
      const second = await postWatchlist(baseUrl, TOKEN, input);
      expect(first.status).toBe(201);
      expect(second.status).toBe(201);
      const a = (await first.json()) as any;
      const b = (await second.json()) as any;
      expect(a.watchlist.id).toBe(b.watchlist.id);
    });
  });

  it("budget threshold fires an alert when the total is at or below it", async () => {
    await withMutableClock(TEST_NOW, async (baseUrl) => {
      const created = await postWatchlist(baseUrl, TOKEN, {
        input: baseInput({ departureStart: "2029-12-05", departureEnd: "2029-12-05" }),
        thresholdIdrMinor: 99_999_999_999, // always at or below
      });
      const body = (await created.json()) as any;
      const id = body.watchlist.id as string;

      const check = await fetch(`${baseUrl}/api/watchlist/${id}/check`, {
        method: "POST",
        headers: { "X-Watchlist-Token": TOKEN },
      });
      expect(check.status).toBe(200);
      const checkBody = (await check.json()) as any;
      expect(checkBody.createdEvents.length).toBe(1);
      expect(checkBody.createdEvents[0].currentTotalIdrMinor).toBe(body.watchlist.baselineTotalIdrMinor);
    });
  });

  it("a real price drop past the cooldown creates one deduplicated alert", async () => {
    await withMutableClock(TEST_NOW, async (baseUrl, setNow) => {
      const created = await postWatchlist(baseUrl, TOKEN, {
        input: baseInput({ departureStart: "2029-12-05", departureEnd: "2029-12-05" }),
      });
      const body = (await created.json()) as any;
      const id = body.watchlist.id as string;
      const baseline = body.watchlist.baselineTotalIdrMinor as number;

      // Same instant: identical price, no drop, no alert.
      const sameTime = await checkWatchlist(baseUrl, TOKEN, id);
      expect(sameTime.createdEvents.length).toBe(0);

      // Advance 24h: the mock price drifts into a lower 6h bucket, a real drop.
      setNow(new Date(TEST_NOW.getTime() + 24 * HOUR_MS));
      const dropped = await checkWatchlist(baseUrl, TOKEN, id);
      expect(dropped.createdEvents.length).toBe(1);
      expect(dropped.currentTotalIdrMinor).toBeLessThan(baseline);
      expect(dropped.createdEvents[0].previousTotalIdrMinor).toBe(baseline);
      expect(dropped.createdEvents[0].dropPercent).toBeGreaterThan(0);

      // Same instant again: same price bucket, fingerprint deduplicates.
      const again = await checkWatchlist(baseUrl, TOKEN, id);
      expect(again.createdEvents.length).toBe(0);

      const alerts = await fetch(`${baseUrl}/api/alerts`, {
        headers: { "X-Watchlist-Token": TOKEN },
      });
      const alertsBody = (await alerts.json()) as any;
      expect(alertsBody.alerts.length).toBe(1);
      expect(alertsBody.alerts[0].watchlistId).toBe(id);
    });
  });

  it("deletes a watchlist and returns 404 for unknown ids", async () => {
    await withMutableClock(TEST_NOW, async (baseUrl) => {
      const created = await postWatchlist(baseUrl, TOKEN, {
        input: baseInput({ departureStart: "2029-12-05", departureEnd: "2029-12-05" }),
      });
      const body = (await created.json()) as any;
      const id = body.watchlist.id as string;

      const del = await fetch(`${baseUrl}/api/watchlist/${id}`, {
        method: "DELETE",
        headers: { "X-Watchlist-Token": TOKEN },
      });
      expect(del.status).toBe(200);

      const list = await fetch(`${baseUrl}/api/watchlist`, {
        headers: { "X-Watchlist-Token": TOKEN },
      });
      const listBody = (await list.json()) as any;
      expect(listBody.watchlists.length).toBe(0);

      const delAgain = await fetch(`${baseUrl}/api/watchlist/${id}`, {
        method: "DELETE",
        headers: { "X-Watchlist-Token": TOKEN },
      });
      expect(delAgain.status).toBe(404);
    });
  });
});

function postWatchlist(baseUrl: string, token: string, body: unknown): Promise<Response> {
  return fetch(`${baseUrl}/api/watchlist`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Watchlist-Token": token },
    body: JSON.stringify(body),
  });
}

async function checkWatchlist(baseUrl: string, token: string, id: string): Promise<any> {
  const res = await fetch(`${baseUrl}/api/watchlist/${id}/check`, {
    method: "POST",
    headers: { "X-Watchlist-Token": token },
  });
  return res.json();
}

async function withMutableClock(
  start: Date,
  fn: (baseUrl: string, setNow: (d: Date) => void) => Promise<void>,
): Promise<void> {
  const config = loadConfig({
    DB_PATH: ":memory:",
    MOCK_MODE: "true",
    MOCK_HOTEL_FRONTIER_DAYS: "330",
    ALERT_COOLDOWN_HOURS: "1",
    MATERIAL_DROP_PERCENT: "50",
  });
  const db = openDb(":memory:");
  const store = new SqliteStore(db);
  const watchlistRepo = new SqliteWatchlistRepo(db);
  const coverageRepo = new SqliteCoverageRepo(db);
  const registry = createMockRegistry(config.mockHotelFrontierDays);
  let current = start;
  const app = createApp({ registry, store, watchlistRepo, coverageRepo, config, now: () => current });
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") {
    server.close();
    throw new Error("expected a TCP port");
  }
  try {
    await fn(`http://127.0.0.1:${address.port}`, (d) => {
      current = d;
    });
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}
