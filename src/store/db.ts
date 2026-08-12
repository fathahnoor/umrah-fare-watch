// Persistence via node:sqlite (built into Node >= 22.5). Zero native deps.
import { DatabaseSync } from "node:sqlite";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS flight_observations (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL,
  provider_offer_id TEXT NOT NULL,
  origin TEXT NOT NULL,
  outbound_airport TEXT NOT NULL,
  return_airport TEXT NOT NULL,
  departure_local_date TEXT NOT NULL,
  return_local_date TEXT NOT NULL,
  pattern TEXT NOT NULL,
  normalized_idr_amount_minor INTEGER CHECK (normalized_idr_amount_minor IS NULL OR normalized_idr_amount_minor >= 0),
  price_completeness TEXT NOT NULL,
  verification_status TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  expires_at TEXT,
  payload TEXT NOT NULL,
  UNIQUE (provider_id, provider_offer_id, observed_at)
);

CREATE TABLE IF NOT EXISTS hotel_observations (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL,
  provider_offer_id TEXT NOT NULL,
  canonical_key TEXT NOT NULL,
  city TEXT NOT NULL,
  check_in TEXT NOT NULL,
  check_out TEXT NOT NULL,
  nights INTEGER NOT NULL CHECK (nights > 0),
  rooms INTEGER NOT NULL CHECK (rooms > 0),
  normalized_idr_amount_minor INTEGER CHECK (normalized_idr_amount_minor IS NULL OR normalized_idr_amount_minor >= 0),
  price_completeness TEXT NOT NULL,
  verification_status TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  expires_at TEXT,
  payload TEXT NOT NULL,
  UNIQUE (provider_id, provider_offer_id, observed_at),
  CHECK (check_out >= check_in)
);

CREATE TABLE IF NOT EXISTS trip_plans (
  id TEXT PRIMARY KEY,
  search_fingerprint TEXT NOT NULL,
  flight_observation_id TEXT NOT NULL,
  makkah_hotel_observation_id TEXT,
  madinah_hotel_observation_id TEXT,
  makkah_check_in TEXT,
  makkah_check_out TEXT,
  madinah_check_in TEXT,
  madinah_check_out TEXT,
  trip_total_idr_minor INTEGER CHECK (trip_total_idr_minor IS NULL OR trip_total_idr_minor >= 0),
  price_completeness TEXT NOT NULL,
  trip_plan_status TEXT NOT NULL,
  calculated_at TEXT NOT NULL,
  payload TEXT NOT NULL,
  CHECK (makkah_check_in IS NULL OR makkah_check_out IS NULL OR makkah_check_out >= makkah_check_in),
  CHECK (madinah_check_in IS NULL OR madinah_check_in IS NULL OR madinah_check_out >= madinah_check_in),
  CHECK (
    trip_total_idr_minor IS NULL OR
    (
      makkah_hotel_observation_id IS NOT NULL AND
      madinah_hotel_observation_id IS NOT NULL
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_flight_obs_offer ON flight_observations (provider_id, provider_offer_id, observed_at);
CREATE INDEX IF NOT EXISTS idx_hotel_obs_key ON hotel_observations (canonical_key, observed_at);
CREATE INDEX IF NOT EXISTS idx_trip_plans_fp ON trip_plans (search_fingerprint, calculated_at);
`;

export function openDb(path: string): DatabaseSync {
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(SCHEMA);
  return db;
}
