import { describe, expect, it, beforeEach } from "vitest";
import { createHash } from "node:crypto";
import { resetRateLimits } from "../src/api/rateLimit.js";
import { loadConfig } from "../src/config.js";
import { createMockRegistry } from "../src/providers/registry.js";
import { SqliteAuthRepo } from "../src/store/auth.js";
import { SqliteCoverageRepo } from "../src/store/coverage.js";
import { openDb } from "../src/store/db.js";
import { SqliteStore } from "../src/store/repositories.js";
import { SqliteWatchlistRepo } from "../src/store/watchlist.js";
import { createApp } from "../src/api/server.js";
import { TEST_NOW, withServer } from "./helpers.js";

// Rate limit buckets are per-process; start every case clean so counts from
// other files or cases cannot leak in.
beforeEach(() => {
  resetRateLimits();
});

describe("API security hardening", () => {
  it("sets baseline security headers on API responses", async () => {
    await withServer(TEST_NOW, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/health`);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-security-policy")).toContain("default-src 'self'");
      expect(res.headers.get("content-security-policy")).toContain("script-src 'self' https://*.histats.com");
      expect(res.headers.get("content-security-policy")).toContain("img-src 'self' data: https://*.histats.com");
      expect(res.headers.get("x-content-type-options")).toBe("nosniff");
      expect(res.headers.get("x-frame-options")).toBe("DENY");
      expect(res.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
      expect(res.headers.get("permissions-policy")).toContain("camera=()");
      expect(res.headers.get("x-powered-by")).toBeNull();
    });
  });

  it("echoes a clean correlation id but replaces a hostile one", async () => {
    await withServer(TEST_NOW, async (baseUrl) => {
      const clean = await fetch(`${baseUrl}/api/health`, { headers: { "x-correlation-id": "abc-123_XYZ" } });
      expect(clean.headers.get("x-correlation-id")).toBe("abc-123_XYZ");

      const hostile = await fetch(`${baseUrl}/api/health`, {
        headers: { "x-correlation-id": "bad id<script>&;; way too long to be a safe identifier at all" },
      });
      const echoed = hostile.headers.get("x-correlation-id") ?? "";
      expect(echoed).not.toContain("bad id");
      expect(echoed).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });
  });

  it("rate limits repeated auth attempts per IP", async () => {
    await withServer(TEST_NOW, async (baseUrl) => {
      let lastStatus = 0;
      for (let i = 0; i < 21; i += 1) {
        const res = await fetch(`${baseUrl}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "brute@example.com", password: "salah12345" }),
        });
        lastStatus = res.status;
        if (i === 20) {
          expect(res.status).toBe(429);
          const body = (await res.json()) as { code: string; retryAfterSeconds: number };
          expect(body.code).toBe("RATE_LIMITED");
          expect(body.retryAfterSeconds).toBeGreaterThan(0);
          expect(Number(res.headers.get("retry-after"))).toBeGreaterThan(0);
        }
      }
      expect(lastStatus).toBe(429);
    });
  });

  it("rejects oversized credentials before hashing", async () => {
    await withServer(TEST_NOW, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "panjang@example.com",
          password: "x".repeat(129),
        }),
      });
      expect(res.status).toBe(400);
      const body = (await res.json()) as { errors: { field: string }[] };
      expect(body.errors.some((e) => e.field === "password")).toBe(true);
    });
  });

  it("stores sessions hashed: the raw token never appears in the sessions table", async () => {
    const config = loadConfig({ DB_PATH: ":memory:", MOCK_MODE: "true" });
    const db = openDb(":memory:");
    const app = createApp({
      registry: createMockRegistry(config.mockHotelFrontierDays),
      store: new SqliteStore(db),
      watchlistRepo: new SqliteWatchlistRepo(db),
      coverageRepo: new SqliteCoverageRepo(db),
      authRepo: new SqliteAuthRepo(db),
      config,
      now: () => TEST_NOW,
    });
    const server = app.listen(0);
    await new Promise<void>((resolve) => server.once("listening", resolve));
    try {
      const address = server.address();
      if (address === null || typeof address === "string") throw new Error("expected a TCP port");
      const baseUrl = `http://127.0.0.1:${address.port}`;
      await fetch(`${baseUrl}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "hash@example.com", password: "rahasia123" }),
      });
      const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "hash@example.com", password: "rahasia123" }),
      });
      const { token } = (await loginRes.json()) as { token: string };

      const rows = db
        .prepare("SELECT token FROM sessions")
        .all() as { token: string }[];
      expect(rows.length).toBe(1);
      const stored = rows[0]?.token;
      expect(stored).toBeDefined();
      expect(stored).not.toBe(token);
      expect(stored).toMatch(/^[0-9a-f]{64}$/);
      expect(stored).toBe(createHash("sha256").update(token).digest("hex"));

      // The raw token still authenticates (lookup hashes it again).
      const me = await fetch(`${baseUrl}/api/auth/me`, { headers: { "X-Session-Token": token } });
      expect(me.status).toBe(200);

      // Expired sessions are swept away.
      const swept = new SqliteAuthRepo(db).deleteExpiredSessions(new Date(TEST_NOW.getTime() + 31 * 86_400_000));
      expect(swept).toBe(1);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("rate limits expensive search endpoints separately from auth", async () => {
    await withServer(TEST_NOW, async (baseUrl) => {
      let rateLimited = false;
      for (let i = 0; i < 61; i += 1) {
        const res = await fetch(`${baseUrl}/api/search/trip`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ invalid: true }),
        });
        if (res.status === 429) {
          rateLimited = true;
          break;
        }
      }
      expect(rateLimited).toBe(true);
    });
  });
});
