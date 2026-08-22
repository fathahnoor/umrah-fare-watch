import { describe, expect, it } from "vitest";
import { createApp } from "../src/api/server.js";
import { loadConfig } from "../src/config.js";
import { createMockRegistry } from "../src/providers/registry.js";
import { ProviderError } from "../src/providers/types.js";
import type { SearchService } from "../src/services/searchService.js";
import { SqliteAuthRepo } from "../src/store/auth.js";
import { SqliteCoverageRepo } from "../src/store/coverage.js";
import { openDb } from "../src/store/db.js";
import { SqliteStore } from "../src/store/repositories.js";
import { SqliteWatchlistRepo } from "../src/store/watchlist.js";
import { baseInput, TEST_NOW } from "./helpers.js";

describe("API provider quota response", () => {
  it("returns a stable 429 response without falling back to mock data", async () => {
    const config = loadConfig({ DB_PATH: ":memory:", MOCK_MODE: "false", REAL_PROVIDERS_ENABLED: "true" });
    const db = openDb(":memory:");
    const store = new SqliteStore(db);
    const searchService = {
      async searchTrip() {
        throw new ProviderError("QUOTA_EXCEEDED", "provider detail must stay private", {
          retryable: false,
          nextEligibleAt: null,
        });
      },
    } as unknown as SearchService;
    const app = createApp({
      registry: createMockRegistry(config.mockHotelFrontierDays),
      store,
      watchlistRepo: new SqliteWatchlistRepo(db),
      coverageRepo: new SqliteCoverageRepo(db),
      authRepo: new SqliteAuthRepo(db),
      config,
      now: () => TEST_NOW,
      searchService,
    });
    const server = app.listen(0);
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const address = server.address();
    if (address === null || typeof address === "string") throw new Error("expected TCP port");

    try {
      const response = await fetch(`http://127.0.0.1:${address.port}/api/search/trip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(baseInput()),
      });
      expect(response.status).toBe(429);
      const body = (await response.json()) as Record<string, unknown>;
      expect(body).toMatchObject({
        code: "QUOTA_EXCEEDED",
        message: "Kuota API provider telah habis. Pencarian live tersedia kembali setelah kuota diperbarui.",
        retryable: false,
        nextEligibleAt: null,
      });
      expect(JSON.stringify(body)).not.toContain("provider detail must stay private");
      expect(body).not.toHaveProperty("results");
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      store.close();
    }
  });
});
