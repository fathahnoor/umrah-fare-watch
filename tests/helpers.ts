import { loadConfig, type AppConfig } from "../src/config.js";
import { createApp } from "../src/api/server.js";
import { createMockRegistry, type ProviderRegistry } from "../src/providers/registry.js";
import { SqliteCoverageRepo } from "../src/store/coverage.js";
import { openDb } from "../src/store/db.js";
import { SqliteStore, type ObservationStore } from "../src/store/repositories.js";
import { SqliteWatchlistRepo } from "../src/store/watchlist.js";
import { SearchService } from "../src/services/searchService.js";
import type { TripSearchInput } from "../src/domain/types.js";
import type { Express } from "express";

/** Fixed clock so every fixture is deterministic. */
export const TEST_NOW = new Date("2029-06-01T08:00:00Z");

export function baseInput(overrides: Partial<TripSearchInput> = {}): TripSearchInput {
  return {
    origins: ["CGK"],
    departureStart: "2029-12-01",
    departureEnd: "2029-12-03",
    adults: 1,
    childrenAges: [],
    rooms: 1,
    makkahNights: 5,
    madinahNights: 4,
    patterns: ["ROUNDTRIP_JED"],
    cityOrder: "AUTO",
    cabin: "economy",
    makkahRadiusKm: 5,
    madinahRadiusKm: 5,
    freeCancellationOnly: false,
    currency: "IDR",
    ...overrides,
  };
}

export interface TestContext {
  config: AppConfig;
  registry: ProviderRegistry;
  store: ObservationStore;
  service: SearchService;
}

export function createTestContext(): TestContext {
  const config = loadConfig({
    DB_PATH: ":memory:",
    MOCK_MODE: "true",
    MOCK_HOTEL_FRONTIER_DAYS: "330",
  });
  const db = openDb(":memory:");
  const store = new SqliteStore(db);
  const registry = createMockRegistry(config.mockHotelFrontierDays);
  const service = new SearchService(registry, store, config);
  return { config, registry, store, service };
}

export interface AppContext {
  app: Express;
  config: AppConfig;
  store: ObservationStore;
  registry: ProviderRegistry;
}

export function createTestApp(now: Date = TEST_NOW): AppContext {
  const config = loadConfig({
    DB_PATH: ":memory:",
    MOCK_MODE: "true",
    MOCK_HOTEL_FRONTIER_DAYS: "330",
  });
  const db = openDb(":memory:");
  const store = new SqliteStore(db);
  const watchlistRepo = new SqliteWatchlistRepo(db);
  const coverageRepo = new SqliteCoverageRepo(db);
  const registry = createMockRegistry(config.mockHotelFrontierDays);
  const app = createApp({ registry, store, watchlistRepo, coverageRepo, config, now: () => now });
  return { app, config, store, registry };
}

export async function withServer(
  now: Date = TEST_NOW,
  fn: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const { app } = createTestApp(now);
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") {
    server.close();
    throw new Error("expected a TCP port");
  }
  try {
    await fn(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}
