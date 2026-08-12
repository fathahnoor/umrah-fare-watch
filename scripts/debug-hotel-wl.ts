import { loadConfig } from "../src/config.js";
import { createMockRegistry } from "../src/providers/registry.js";
import { SearchService } from "../src/services/searchService.js";
import { SqliteCoverageRepo } from "../src/store/coverage.js";
import { openDb } from "../src/store/db.js";
import { SqliteStore } from "../src/store/repositories.js";

async function main(): Promise<void> {
  const config = loadConfig({ DB_PATH: ":memory:" });
  const db = openDb(":memory:");
  const store = new SqliteStore(db);
  const cov = new SqliteCoverageRepo(db);
  const registry = createMockRegistry(config.mockHotelFrontierDays);
  const svc = new SearchService(registry, store, config, cov);
  const result = await svc.checkHotelWatchlist(
    {
      city: "MAKKAH",
      checkIn: "2029-12-06",
      checkOut: "2029-12-11",
      adults: 1,
      childrenAges: [],
      rooms: 1,
      radiusKm: 5,
      freeCancellationOnly: false,
    },
    new Date("2029-06-01T08:00:00Z"),
  );
  console.log(JSON.stringify(result, null, 1).slice(0, 500));
}

main().catch((err) => {
  console.error("ERR", err);
  process.exit(1);
});
