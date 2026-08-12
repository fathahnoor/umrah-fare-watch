import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";
import { CoverageService } from "../src/services/coverageService.js";
import { MockHotelProvider } from "../src/providers/mock/mockHotelProvider.js";
import type { ProviderRegistry } from "../src/providers/registry.js";
import type {
  FlightDiscoveryInput,
  FlightDiscoveryResult,
  FlightProvider,
  FlightVerificationInput,
  FlightVerificationResult,
  ProviderHealthSnapshot,
} from "../src/providers/types.js";
import { openDb } from "../src/store/db.js";
import { SqliteCoverageRepo } from "../src/store/coverage.js";

const NOW = new Date("2029-06-01T08:00:00Z");

/** A fake "real" flight provider that fails loudly if its discover is called. */
class FakeRealFlightProvider implements FlightProvider {
  readonly id = "fake-live";
  readonly mode = "LIVE" as const;
  readonly enabled = true;
  calls = 0;

  async discover(_input: FlightDiscoveryInput): Promise<FlightDiscoveryResult> {
    this.calls += 1;
    throw new Error("discover must not be called by the coverage worker for real providers");
  }

  async verify(_input: FlightVerificationInput): Promise<FlightVerificationResult> {
    throw new Error("verify must not be called");
  }

  async health(): Promise<ProviderHealthSnapshot> {
    return {
      id: this.id,
      mode: this.mode,
      enabled: true,
      enabledReason: "test",
      disabledReason: null,
      adapterVersion: "test",
      lastSuccessAt: null,
      lastFailureCategory: null,
      frontier: null,
      calls: 0,
      failures: 0,
      cacheHits: 0,
    };
  }
}

describe("Coverage budget protection for real providers", () => {
  it("runDueScans skips the flight scan when the active flight provider is LIVE", async () => {
    const config = loadConfig({
      DB_PATH: ":memory:",
      MOCK_MODE: "true",
      MOCK_HOTEL_FRONTIER_DAYS: "330",
    });
    const db = openDb(":memory:");
    const repo = new SqliteCoverageRepo(db);
    const fakeFlight = new FakeRealFlightProvider();
    const registry: ProviderRegistry = {
      flightProviders: [fakeFlight],
      hotelProviders: [new MockHotelProvider(config.mockHotelFrontierDays)],
    };
    const service = new CoverageService(registry, repo, config);
    const result = await service.runDueScans(NOW);
    expect(fakeFlight.calls).toBe(0);
    expect(result.flightScanned).toBe(0);
    expect(result.flightRecorded).toBe(0);
    // Hotel frontier marking still runs (free, no provider calls).
    expect(result.hotelFrontierMarked).toBeGreaterThan(0);
  });

  it("config parses the real-provider call caps", () => {
    const config = loadConfig({
      REAL_PROVIDER_VERIFY_CAP: "3",
      REAL_PROVIDER_CALENDAR_DAYS_CAP: "7",
    });
    expect(config.realProviderVerifyCap).toBe(3);
    expect(config.realProviderCalendarDaysCap).toBe(7);
    const defaults = loadConfig();
    expect(defaults.realProviderVerifyCap).toBe(2);
    expect(defaults.realProviderCalendarDaysCap).toBe(5);
  });
});
