// Coverage record persistence (02_LONG_HORIZON_MONITORING.md section 8).
// One row per domain, provider, date, and optional city. Scan failures never
// erase prior observations; they only move the record to a failed state.
import type { DatabaseSync } from "node:sqlite";
import type { AvailabilityState, City, CoverageRecord, ErrorCategory } from "../domain/types.js";

export interface CoverageRepo {
  upsertCoverage(record: CoverageRecord): void;
  getCoverage(domain: "FLIGHT" | "HOTEL", providerId: string, date: string, city: City | null): CoverageRecord | null;
  listCoverage(domain: "FLIGHT" | "HOTEL", providerId: string, startDate: string, endDate: string): CoverageRecord[];
  listAllFlightCoverage(startDate: string, endDate: string): CoverageRecord[];
  listAllHotelCoverage(startDate: string, endDate: string): CoverageRecord[];
}

export class SqliteCoverageRepo implements CoverageRepo {
  private db: DatabaseSync;

  constructor(db: DatabaseSync) {
    this.db = db;
  }

  upsertCoverage(record: CoverageRecord): void {
    this.db
      .prepare(
        `INSERT INTO coverage_records (
          domain, provider_id, city, date, availability_state, frontier_date,
          last_attempt_at, last_success_at, next_eligible_at, result_count,
          error_category, scan_run_id, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (domain, provider_id, date, city) DO UPDATE SET
          availability_state = excluded.availability_state,
          frontier_date = excluded.frontier_date,
          last_attempt_at = excluded.last_attempt_at,
          last_success_at = excluded.last_success_at,
          next_eligible_at = excluded.next_eligible_at,
          result_count = excluded.result_count,
          error_category = excluded.error_category,
          scan_run_id = excluded.scan_run_id,
          updated_at = excluded.updated_at`,
      )
      .run(
        record.domain,
        record.providerId,
        record.city,
        record.date,
        record.availabilityState,
        record.frontierDate,
        record.lastAttemptAt,
        record.lastSuccessAt,
        record.nextEligibleAt,
        record.resultCount,
        record.errorCategory,
        record.scanRunId,
        record.updatedAt,
      );
  }

  getCoverage(domain: "FLIGHT" | "HOTEL", providerId: string, date: string, city: City | null): CoverageRecord | null {
    const row = this.db
      .prepare("SELECT * FROM coverage_records WHERE domain = ? AND provider_id = ? AND date = ? AND city IS ?")
      .get(domain, providerId, date, city) as CoverageRow | undefined;
    return row ? mapCoverageRow(row) : null;
  }

  listCoverage(domain: "FLIGHT" | "HOTEL", providerId: string, startDate: string, endDate: string): CoverageRecord[] {
    const rows = this.db
      .prepare("SELECT * FROM coverage_records WHERE domain = ? AND provider_id = ? AND date BETWEEN ? AND ? ORDER BY date")
      .all(domain, providerId, startDate, endDate) as unknown as CoverageRow[];
    return rows.map(mapCoverageRow);
  }

  listAllFlightCoverage(startDate: string, endDate: string): CoverageRecord[] {
    const rows = this.db
      .prepare("SELECT * FROM coverage_records WHERE domain = 'FLIGHT' AND date BETWEEN ? AND ? ORDER BY date")
      .all(startDate, endDate) as unknown as CoverageRow[];
    return rows.map(mapCoverageRow);
  }

  listAllHotelCoverage(startDate: string, endDate: string): CoverageRecord[] {
    const rows = this.db
      .prepare("SELECT * FROM coverage_records WHERE domain = 'HOTEL' AND date BETWEEN ? AND ? ORDER BY date")
      .all(startDate, endDate) as unknown as CoverageRow[];
    return rows.map(mapCoverageRow);
  }
}

interface CoverageRow {
  domain: "FLIGHT" | "HOTEL";
  provider_id: string;
  city: City | null;
  date: string;
  availability_state: AvailabilityState;
  frontier_date: string | null;
  last_attempt_at: string | null;
  last_success_at: string | null;
  next_eligible_at: string | null;
  result_count: number;
  error_category: ErrorCategory | null;
  scan_run_id: string | null;
  updated_at: string;
}

function mapCoverageRow(row: CoverageRow): CoverageRecord {
  return {
    domain: row.domain,
    providerId: row.provider_id,
    city: row.city,
    date: row.date,
    availabilityState: row.availability_state,
    frontierDate: row.frontier_date,
    lastAttemptAt: row.last_attempt_at,
    lastSuccessAt: row.last_success_at,
    nextEligibleAt: row.next_eligible_at,
    resultCount: row.result_count,
    errorCategory: row.error_category,
    scanRunId: row.scan_run_id,
    updatedAt: row.updated_at,
  };
}
