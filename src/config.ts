// Validated runtime configuration (03_TECHNICAL_ARCHITECTURE.md section 12).
import path from "node:path";
import { fileURLToPath } from "node:url";

export interface AppConfig {
  port: number;
  dbPath: string;
  publicDir: string;
  mockMode: boolean;
  userHorizonDays: number;
  technicalFlightHorizonDays: number;
  mockHotelFrontierDays: number;
  maxFlightsForHotelEnrichmentPerSearch: number;
  maxHotelResultsPerCity: number;
  maxTripPlansReturned: number;
  maxConcurrentProviderRequests: number;
  calendarScanDaysMax: number;
  flightTierAHours: number;
  flightTierBHours: number;
  flightTierCHours: number;
  coverageWorkerIntervalMs: number;
  sessionTtlDays: number;
  alertCooldownHours: number;
  materialDropPercent: number;
  requestCacheTtlMs: number;
}

function intFromEnv(env: NodeJS.ProcessEnv, key: string, fallback: number, min: number, max: number): number {
  const raw = env[key];
  if (raw == null || raw === "") {
    return fallback;
  }
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`invalid config ${key}: expected integer in [${min}, ${max}]`);
  }
  return value;
}

const here = path.dirname(fileURLToPath(import.meta.url));

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    port: intFromEnv(env, "PORT", 3000, 1, 65535),
    dbPath: env.DB_PATH ?? path.resolve(process.cwd(), "data", "umrah-fare-watch.db"),
    publicDir: env.PUBLIC_DIR ?? path.resolve(here, "ui", "public"),
    mockMode: (env.MOCK_MODE ?? "true").toLowerCase() !== "false",
    userHorizonDays: intFromEnv(env, "USER_HORIZON_DAYS", 365, 30, 730),
    technicalFlightHorizonDays: intFromEnv(env, "TECHNICAL_FLIGHT_HORIZON_DAYS", 370, 31, 800),
    mockHotelFrontierDays: intFromEnv(env, "MOCK_HOTEL_FRONTIER_DAYS", 330, 30, 730),
    maxFlightsForHotelEnrichmentPerSearch: intFromEnv(
      env,
      "MAX_FLIGHTS_FOR_HOTEL_ENRICHMENT_PER_SEARCH",
      5,
      1,
      20,
    ),
    maxHotelResultsPerCity: intFromEnv(env, "MAX_HOTEL_RESULTS_PER_CITY", 10, 1, 50),
    maxTripPlansReturned: intFromEnv(env, "MAX_TRIP_PLANS_RETURNED", 20, 1, 100),
    maxConcurrentProviderRequests: intFromEnv(env, "MAX_CONCURRENT_PROVIDER_REQUESTS", 3, 1, 10),
    calendarScanDaysMax: intFromEnv(env, "CALENDAR_SCAN_DAYS_MAX", 30, 1, 60),
    flightTierAHours: intFromEnv(env, "FLIGHT_TIER_A_HOURS", 24, 1, 168),
    flightTierBHours: intFromEnv(env, "FLIGHT_TIER_B_HOURS", 48, 1, 336),
    flightTierCHours: intFromEnv(env, "FLIGHT_TIER_C_HOURS", 84, 1, 504),
    coverageWorkerIntervalMs: intFromEnv(env, "COVERAGE_WORKER_INTERVAL_MS", 600_000, 10_000, 3_600_000),
    sessionTtlDays: intFromEnv(env, "SESSION_TTL_DAYS", 30, 1, 365),
    alertCooldownHours: intFromEnv(env, "ALERT_COOLDOWN_HOURS", 24, 1, 720),
    materialDropPercent: intFromEnv(env, "MATERIAL_DROP_PERCENT", 3, 1, 50),
    requestCacheTtlMs: intFromEnv(env, "REQUEST_CACHE_TTL_MS", 15 * 60_000, 1_000, 86_400_000),
  };
}
