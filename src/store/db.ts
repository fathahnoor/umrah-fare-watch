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

CREATE TABLE IF NOT EXISTS watchlists (
  id TEXT PRIMARY KEY,
  owner_token TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('FLIGHT', 'HOTEL', 'COMPLETE_TRIP')),
  input_json TEXT NOT NULL,
  search_fingerprint TEXT NOT NULL,
  label TEXT,
  baseline_total_idr_minor INTEGER CHECK (baseline_total_idr_minor IS NULL OR baseline_total_idr_minor >= 0),
  threshold_idr_minor INTEGER CHECK (threshold_idr_minor IS NULL OR threshold_idr_minor >= 0),
  last_alerted_total_idr_minor INTEGER CHECK (last_alerted_total_idr_minor IS NULL OR last_alerted_total_idr_minor >= 0),
  last_checked_at TEXT,
  last_checked_total_idr_minor INTEGER CHECK (last_checked_total_idr_minor IS NULL OR last_checked_total_idr_minor >= 0),
  last_alert_sent_at TEXT,
  created_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS coverage_records (
  domain TEXT NOT NULL CHECK (domain IN ('FLIGHT', 'HOTEL')),
  provider_id TEXT NOT NULL,
  city TEXT,
  date TEXT NOT NULL,
  availability_state TEXT NOT NULL,
  frontier_date TEXT,
  last_attempt_at TEXT,
  last_success_at TEXT,
  next_eligible_at TEXT,
  result_count INTEGER NOT NULL DEFAULT 0,
  error_category TEXT,
  scan_run_id TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (domain, provider_id, date, city)
);

CREATE TABLE IF NOT EXISTS alert_events (
  id TEXT PRIMARY KEY,
  watchlist_id TEXT NOT NULL,
  owner_token TEXT NOT NULL,
  event_fingerprint TEXT NOT NULL,
  current_total_idr_minor INTEGER NOT NULL CHECK (current_total_idr_minor >= 0),
  previous_total_idr_minor INTEGER NOT NULL CHECK (previous_total_idr_minor >= 0),
  drop_percent REAL NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (event_fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_flight_obs_offer ON flight_observations (provider_id, provider_offer_id, observed_at);
CREATE INDEX IF NOT EXISTS idx_hotel_obs_key ON hotel_observations (canonical_key, observed_at);
CREATE INDEX IF NOT EXISTS idx_trip_plans_fp ON trip_plans (search_fingerprint, calculated_at);
CREATE INDEX IF NOT EXISTS idx_watchlists_owner ON watchlists (owner_token, created_at);
CREATE INDEX IF NOT EXISTS idx_alert_events_owner ON alert_events (owner_token, created_at);
CREATE INDEX IF NOT EXISTS idx_coverage_date ON coverage_records (domain, date);
`;

export function openDb(path: string): DatabaseSync {
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(SCHEMA);
  return db;
}
