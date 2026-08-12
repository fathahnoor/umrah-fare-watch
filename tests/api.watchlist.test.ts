import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";
import { createApp } from "../src/api/server.js";
import { createMockRegistry } from "../src/providers/registry.js";
import { SqliteAuthRepo } from "../src/store/auth.js";
import { SqliteCoverageRepo } from "../src/store/coverage.js";
import { openDb } from "../src/store/db.js";
import { SqliteStore } from "../src/store/repositories.js";
import { SqliteWatchlistRepo } from "../src/store/watchlist.js";
import { baseInput, TEST_NOW } from "./helpers.js";

const HOUR_MS = 3_600_000;

describe("API watchlist + alerts (07_ALERTS_AND_SCHEDULER MVP slice)", () => {
  it("requires a session (AUTH_REQUIRED)", async () => {
    await withServer(TEST_NOW, async (baseUrl) => {
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

  it("creates a watchlist with a baseline and isolates it per user", async () => {
    await withServer(TEST_NOW, async (baseUrl) => {
      const tokenA = await registerAndLogin(baseUrl, "a@example.com");
      const tokenB = await registerAndLogin(baseUrl, "b@example.com");

      const created = await postWatchlist(baseUrl, tokenA, {
        input: baseInput({ departureStart: "2029-12-05", departureEnd: "2029-12-05" }),
        label: "Umroh Desember",
      });
      expect(created.status).toBe(201);
      const body = (await created.json()) as any;
      expect(body.watchlist.type).toBe("COMPLETE_TRIP");
      expect(body.watchlist.baselineTotalIdrMinor).toBeGreaterThan(0);
      expect(body.detail.plan.tripTotalIdrMinor).toBe(body.watchlist.baselineTotalIdrMinor);

      const listA = await fetch(`${baseUrl}/api/watchlist`, {
        headers: { "X-Session-Token": tokenA },
      });
      expect((await listA.json() as any).watchlists.length).toBe(1);

      const listB = await fetch(`${baseUrl}/api/watchlist`, {
        headers: { "X-Session-Token": tokenB },
      });
      expect((await listB.json() as any).watchlists.length).toBe(0);
    });
  });

  it("identical input returns the existing watchlist (idempotent create)", async () => {
    await withServer(TEST_NOW, async (baseUrl) => {
      const token = await registerAndLogin(baseUrl, "c@example.com");
      const input = { input: baseInput({ departureStart: "2029-12-05", departureEnd: "2029-12-05" }) };
      const first = await postWatchlist(baseUrl, token, input);
      const second = await postWatchlist(baseUrl, token, input);
      const a = (await first.json()) as any;
      const b = (await second.json()) as any;
      expect(a.watchlist.id).toBe(b.watchlist.id);
    });
  });

  it("budget threshold fires an alert when the total is at or below it", async () => {
    await withServer(TEST_NOW, async (baseUrl) => {
      const token = await registerAndLogin(baseUrl, "d@example.com");
      const created = await postWatchlist(baseUrl, token, {
        input: baseInput({ departureStart: "2029-12-05", departureEnd: "2029-12-05" }),
        thresholdIdrMinor: 99_999_999_999,
      });
      const body = (await created.json()) as any;
      const id = body.watchlist.id as string;

      const check = await fetch(`${baseUrl}/api/watchlist/${id}/check`, {
        method: "POST",
        headers: { "X-Session-Token": token },
      });
      const checkBody = (await check.json()) as any;
      expect(checkBody.createdEvents.length).toBe(1);
      expect(checkBody.createdEvents[0].currentTotalIdrMinor).toBe(body.watchlist.baselineTotalIdrMinor);
    });
  });

  it("a real price drop past the cooldown creates one deduplicated alert", async () => {
    await withServer(TEST_NOW, async (baseUrl, setNow) => {
      const token = await registerAndLogin(baseUrl, "e@example.com");
      const created = await postWatchlist(baseUrl, token, {
        input: baseInput({ departureStart: "2029-12-05", departureEnd: "2029-12-05" }),
      });
      const body = (await created.json()) as any;
      const id = body.watchlist.id as string;
      const baseline = body.watchlist.baselineTotalIdrMinor as number;

      const sameTime = await checkWatchlist(baseUrl, token, id);
      expect(sameTime.createdEvents.length).toBe(0);

      setNow(new Date(TEST_NOW.getTime() + 24 * HOUR_MS));
      const dropped = await checkWatchlist(baseUrl, token, id);
      expect(dropped.createdEvents.length).toBe(1);
      expect(dropped.currentTotalIdrMinor).toBeLessThan(baseline);
      expect(dropped.createdEvents[0].previousTotalIdrMinor).toBe(baseline);
      expect(dropped.createdEvents[0].dropPercent).toBeGreaterThan(0);

      const again = await checkWatchlist(baseUrl, token, id);
      expect(again.createdEvents.length).toBe(0);

      const alerts = await fetch(`${baseUrl}/api/alerts`, {
        headers: { "X-Session-Token": token },
      });
      const alertsBody = (await alerts.json()) as any;
      expect(alertsBody.alerts.length).toBe(1);
      expect(alertsBody.alerts[0].watchlistId).toBe(id);
    });
  });

  it("deletes a watchlist and returns 404 for unknown ids", async () => {
    await withServer(TEST_NOW, async (baseUrl) => {
      const token = await registerAndLogin(baseUrl, "f@example.com");
      const created = await postWatchlist(baseUrl, token, {
        input: baseInput({ departureStart: "2029-12-05", departureEnd: "2029-12-05" }),
      });
      const body = (await created.json()) as any;
      const id = body.watchlist.id as string;

      const del = await fetch(`${baseUrl}/api/watchlist/${id}`, {
        method: "DELETE",
        headers: { "X-Session-Token": token },
      });
      expect(del.status).toBe(200);

      const delAgain = await fetch(`${baseUrl}/api/watchlist/${id}`, {
        method: "DELETE",
        headers: { "X-Session-Token": token },
      });
      expect(delAgain.status).toBe(404);
    });
  });
});

async function registerAndLogin(baseUrl: string, email: string): Promise<string> {
  const register = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "rahasia123" }),
  });
  expect(register.status).toBe(201);
  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "rahasia123" }),
  });
  expect(login.status).toBe(200);
  return ((await login.json()) as any).token as string;
}

function postWatchlist(baseUrl: string, token: string, body: unknown): Promise<Response> {
  return fetch(`${baseUrl}/api/watchlist`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Session-Token": token },
    body: JSON.stringify(body),
  });
}

async function checkWatchlist(baseUrl: string, token: string, id: string): Promise<any> {
  const res = await fetch(`${baseUrl}/api/watchlist/${id}/check`, {
    method: "POST",
    headers: { "X-Session-Token": token },
  });
  return res.json();
}

async function withServer(
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
  const authRepo = new SqliteAuthRepo(db);
  const registry = createMockRegistry(config.mockHotelFrontierDays);
  let current = start;
  const app = createApp({ registry, store, watchlistRepo, coverageRepo, authRepo, config, now: () => current });
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
