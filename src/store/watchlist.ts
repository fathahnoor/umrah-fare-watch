// Watchlist and alert-event persistence (07_ALERTS_AND_SCHEDULER.md section 2).
// A watchlist belongs to an owner token (device-level isolation for the mock
// MVP; full user accounts arrive with M4). Alert events are idempotent by
// fingerprint so retries never duplicate a delivered drop notification.
import type { DatabaseSync } from "node:sqlite";
import type { AlertEventRecord, TripSearchInput, WatchlistRecord } from "../domain/types.js";

export interface WatchlistRepo {
  saveWatchlist(record: WatchlistRecord): void;
  getWatchlist(id: string, ownerToken: string): WatchlistRecord | null;
  listWatchlists(ownerToken: string): WatchlistRecord[];
  deleteWatchlist(id: string, ownerToken: string): boolean;
  updateCheckResult(
    id: string,
    ownerToken: string,
    fields: {
      lastCheckedAt: string;
      lastCheckedTotalIdrMinor: number | null;
      lastAlertedTotalIdrMinor?: number;
      lastAlertSentAt?: string;
    },
  ): void;
  saveAlertEvent(event: AlertEventRecord): "inserted" | "duplicate";
  listAlertEvents(ownerToken: string, limit: number): AlertEventRecord[];
  allWatchlists(): WatchlistRecord[];
}

export class SqliteWatchlistRepo implements WatchlistRepo {
  private db: DatabaseSync;

  constructor(db: DatabaseSync) {
    this.db = db;
  }

  saveWatchlist(record: WatchlistRecord): void {
    this.db
      .prepare(
        `INSERT INTO watchlists (
          id, owner_token, type, input_json, search_fingerprint, label,
          baseline_total_idr_minor, threshold_idr_minor, last_alerted_total_idr_minor,
          last_checked_at, last_checked_total_idr_minor, last_alert_sent_at,
          created_at, version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (id) DO NOTHING`,
      )
      .run(
        record.id,
        record.ownerToken,
        record.type,
        JSON.stringify(record.input),
        record.searchFingerprint,
        record.label,
        record.baselineTotalIdrMinor,
        record.thresholdIdrMinor,
        record.lastAlertedTotalIdrMinor,
        record.lastCheckedAt,
        record.lastCheckedTotalIdrMinor,
        record.lastAlertSentAt,
        record.createdAt,
        record.version,
      );
  }

  getWatchlist(id: string, ownerToken: string): WatchlistRecord | null {
    const row = this.db
      .prepare("SELECT * FROM watchlists WHERE id = ? AND owner_token = ?")
      .get(id, ownerToken) as WatchlistRow | undefined;
    return row ? mapWatchlistRow(row) : null;
  }

  listWatchlists(ownerToken: string): WatchlistRecord[] {
    const rows = this.db
      .prepare("SELECT * FROM watchlists WHERE owner_token = ? ORDER BY created_at DESC")
      .all(ownerToken) as unknown as WatchlistRow[];
    return rows.map(mapWatchlistRow);
  }

  deleteWatchlist(id: string, ownerToken: string): boolean {
    const result = this.db
      .prepare("DELETE FROM watchlists WHERE id = ? AND owner_token = ?")
      .run(id, ownerToken);
    return result.changes > 0;
  }

  updateCheckResult(
    id: string,
    ownerToken: string,
    fields: {
      lastCheckedAt: string;
      lastCheckedTotalIdrMinor: number | null;
      lastAlertedTotalIdrMinor?: number;
      lastAlertSentAt?: string;
    },
  ): void {
    const sets = ["last_checked_at = ?", "last_checked_total_idr_minor = ?"];
    const values: Array<string | number | null> = [fields.lastCheckedAt, fields.lastCheckedTotalIdrMinor];
    if (fields.lastAlertedTotalIdrMinor !== undefined) {
      sets.push("last_alerted_total_idr_minor = ?");
      values.push(fields.lastAlertedTotalIdrMinor);
    }
    if (fields.lastAlertSentAt !== undefined) {
      sets.push("last_alert_sent_at = ?");
      values.push(fields.lastAlertSentAt);
    }
    values.push(id, ownerToken);
    this.db
      .prepare(`UPDATE watchlists SET ${sets.join(", ")} WHERE id = ? AND owner_token = ?`)
      .run(...values);
  }

  saveAlertEvent(event: AlertEventRecord): "inserted" | "duplicate" {
    const result = this.db
      .prepare(
        `INSERT INTO alert_events (
          id, watchlist_id, owner_token, event_fingerprint, current_total_idr_minor,
          previous_total_idr_minor, drop_percent, payload, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (event_fingerprint) DO NOTHING`,
      )
      .run(
        event.id,
        event.watchlistId,
        event.ownerToken,
        event.eventFingerprint,
        event.currentTotalIdrMinor,
        event.previousTotalIdrMinor,
        event.dropPercent,
        JSON.stringify(event.payload),
        event.createdAt,
      );
    return result.changes > 0 ? "inserted" : "duplicate";
  }

  listAlertEvents(ownerToken: string, limit: number): AlertEventRecord[] {
    const rows = this.db
      .prepare("SELECT * FROM alert_events WHERE owner_token = ? ORDER BY created_at DESC LIMIT ?")
      .all(ownerToken, limit) as unknown as AlertEventRow[];
    return rows.map(mapAlertEventRow);
  }

  allWatchlists(): WatchlistRecord[] {
    const rows = this.db.prepare("SELECT * FROM watchlists ORDER BY created_at DESC").all() as unknown as WatchlistRow[];
    return rows.map(mapWatchlistRow);
  }
}

interface WatchlistRow {
  id: string;
  owner_token: string;
  type: "FLIGHT" | "HOTEL" | "COMPLETE_TRIP";
  input_json: string;
  search_fingerprint: string;
  label: string | null;
  baseline_total_idr_minor: number | null;
  threshold_idr_minor: number | null;
  last_alerted_total_idr_minor: number | null;
  last_checked_at: string | null;
  last_checked_total_idr_minor: number | null;
  last_alert_sent_at: string | null;
  created_at: string;
  version: number;
}

function mapWatchlistRow(row: WatchlistRow): WatchlistRecord {
  return {
    id: row.id,
    ownerToken: row.owner_token,
    type: row.type,
    input: JSON.parse(row.input_json) as TripSearchInput,
    searchFingerprint: row.search_fingerprint,
    label: row.label,
    baselineTotalIdrMinor: row.baseline_total_idr_minor,
    thresholdIdrMinor: row.threshold_idr_minor,
    lastAlertedTotalIdrMinor: row.last_alerted_total_idr_minor,
    lastCheckedAt: row.last_checked_at,
    lastCheckedTotalIdrMinor: row.last_checked_total_idr_minor,
    lastAlertSentAt: row.last_alert_sent_at,
    createdAt: row.created_at,
    version: row.version,
  };
}

interface AlertEventRow {
  id: string;
  watchlist_id: string;
  owner_token: string;
  event_fingerprint: string;
  current_total_idr_minor: number;
  previous_total_idr_minor: number;
  drop_percent: number;
  payload: string;
  created_at: string;
}

function mapAlertEventRow(row: AlertEventRow): AlertEventRecord {
  return {
    id: row.id,
    watchlistId: row.watchlist_id,
    ownerToken: row.owner_token,
    eventFingerprint: row.event_fingerprint,
    currentTotalIdrMinor: row.current_total_idr_minor,
    previousTotalIdrMinor: row.previous_total_idr_minor,
    dropPercent: row.drop_percent,
    payload: JSON.parse(row.payload) as unknown,
    createdAt: row.created_at,
  };
}
