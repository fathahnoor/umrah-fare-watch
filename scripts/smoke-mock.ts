// Mock mode end-to-end smoke test (MUST BUILD-03).
// Runs entirely in-process; no provider credentials and no network required.
import { loadConfig } from "../src/config.js";
import { createMockRegistry } from "../src/providers/registry.js";
import { SearchService } from "../src/services/searchService.js";
import { openDb } from "../src/store/db.js";
import { SqliteStore } from "../src/store/repositories.js";

const NOW = new Date();

function assert(condition: boolean, label: string): void {
  if (!condition) {
    process.stderr.write(`SMOKE FAIL: ${label}\n`);
    process.exit(1);
  }
  process.stdout.write(`SMOKE PASS: ${label}\n`);
}

const config = loadConfig({
  DB_PATH: ":memory:",
  MOCK_MODE: "true",
});
const db = openDb(":memory:");
const store = new SqliteStore(db);
const registry = createMockRegistry(config.mockHotelFrontierDays);
const service = new SearchService(registry, store, config);

const today = new Date().toISOString().slice(0, 10);
const input = {
  origins: ["CGK"],
  departureStart: today,
  departureEnd: today,
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
};

const outcome = await service.searchTrip(input, NOW);
assert(outcome.ok, "search trip validates");
if (!outcome.ok) {
  process.exit(1);
}
const r = outcome.response;
assert(r.results.length > 0, `complete plans found (${r.results.length})`);
assert(r.coverage.makkahHotel === "HAS_RESULT", "makkah hotel coverage is HAS_RESULT");
assert(r.coverage.madinahHotel === "HAS_RESULT", "madinah hotel coverage is HAS_RESULT");

const top = r.results[0] as (typeof r.results)[number];
assert(top.priceCompleteness === "COMPLETE", "top plan is COMPLETE");
const sum = (top.subtotals.flight ?? 0) + (top.subtotals.makkah ?? 0) + (top.subtotals.madinah ?? 0);
assert(sum === (top.tripTotalIdrMinor ?? -1), "component subtotals add up to the exact total");
assert(
  top.dates.madinahCheckIn === top.dates.makkahCheckOut,
  "first checkout equals second check-in",
);
assert(r.disclaimer.includes("Harga dan ketersediaan dapat berubah"), "required disclaimer present");

const health = await service.providerHealth();
assert(health.every((h) => h.enabled && h.mode === "MOCK"), "only enabled mock providers");

db.close();
process.stdout.write("SMOKE PASS: mock mode end-to-end (no credentials, no network)\n");
