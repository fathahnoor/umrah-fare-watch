// Watchlist orchestration (07_ALERTS_AND_SCHEDULER.md sections 2, 8-11).
// COMPLETE_TRIP runs the full trip pipeline; FLIGHT and HOTEL watchlists check
// their component directly and match against the observation pool rules.
import { randomUUID } from "node:crypto";
import type { AppConfig } from "../config.js";
import {
  alertEventFingerprint,
  cooldownExpired,
  materialDropPercent,
  mayBypassCooldown,
} from "../domain/alerts.js";
import type {
  AlertEventRecord,
  FlightWatchlistParams,
  HotelWatchlistParams,
  TripSearchInput,
  TripPlanSummary,
  ValidationIssue,
  WatchlistRecord,
  WatchlistType,
} from "../domain/types.js";
import {
  INDONESIAN_ORIGINS,
  validateTripSearchInput,
} from "../domain/validation.js";
import { hotelCheckInState } from "../domain/horizons.js";
import type { SearchService } from "./searchService.js";
import type { WatchlistRepo } from "../store/watchlist.js";

const THRESHOLD_RULE_VERSION = 1;
const PRICE_BUCKET_MINOR = 100_000;

export type WatchlistOutcome<T> =
  | { ok: true; data: T }
  | { ok: false; issues: ValidationIssue[] };

export interface CheckResult {
  watchlist: WatchlistRecord;
  currentTotalIdrMinor: number | null;
  detail: Record<string, unknown>;
  createdEvents: AlertEventRecord[];
}

export class WatchlistService {
  constructor(
    private readonly searchService: SearchService,
    private readonly repo: WatchlistRepo,
    private readonly config: AppConfig,
  ) {}

  async create(
    ownerToken: string,
    raw: unknown,
    now: Date,
  ): Promise<WatchlistOutcome<{ watchlist: WatchlistRecord; detail: Record<string, unknown> }>> {
    const body = (raw ?? {}) as {
      type?: unknown;
      label?: unknown;
      input?: unknown;
      thresholdIdrMinor?: unknown;
    };
    const type = body.type === "FLIGHT" || body.type === "HOTEL" ? body.type : "COMPLETE_TRIP";
    const threshold = normalizeThreshold(body.thresholdIdrMinor);

    let record: WatchlistRecord;
    let detail: Record<string, unknown> = {};
    if (type === "COMPLETE_TRIP") {
      const validated = validateTripSearchInput(body.input, now);
      if (!validated.ok) {
        return { ok: false, issues: validated.issues };
      }
      const input = validated.data;
      const fingerprint = watchlistFingerprint("COMPLETE_TRIP", input);
      const existing = this.findExisting(ownerToken, fingerprint);
      if (existing) {
        return { ok: true, data: { watchlist: existing, detail } };
      }
      const outcome = await this.searchService.searchTrip(input, now);
      const plan = outcome.ok ? outcome.response.results[0] ?? null : null;
      const baseline = plan?.tripTotalIdrMinor ?? null;
      detail = plan ? { plan } : {};
      record = this.buildRecord(ownerToken, "COMPLETE_TRIP", input, fingerprint, baseline, threshold, now, body.label);
    } else if (type === "FLIGHT") {
      const issues = validateFlightParams(body.input, now);
      if (issues.length > 0) {
        return { ok: false, issues };
      }
      const input = body.input as FlightWatchlistParams;
      const fingerprint = watchlistFingerprint("FLIGHT", input);
      const existing = this.findExisting(ownerToken, fingerprint);
      if (existing) {
        return { ok: true, data: { watchlist: existing, detail } };
      }
      const check = await this.searchService.checkFlightWatchlist(input, now);
      detail = check.detail;
      record = this.buildRecord(ownerToken, "FLIGHT", input, fingerprint, check.totalMinor, threshold, now, body.label);
    } else {
      const issues = validateHotelParams(body.input, now, this.config.mockHotelFrontierDays);
      if (issues.length > 0) {
        return { ok: false, issues };
      }
      const input = body.input as HotelWatchlistParams;
      const fingerprint = watchlistFingerprint("HOTEL", input);
      const existing = this.findExisting(ownerToken, fingerprint);
      if (existing) {
        return { ok: true, data: { watchlist: existing, detail } };
      }
      const check = await this.searchService.checkHotelWatchlist(input, now);
      detail = check.detail;
      record = this.buildRecord(ownerToken, "HOTEL", input, fingerprint, check.totalMinor, threshold, now, body.label);
    }

    this.repo.saveWatchlist(record);
    return { ok: true, data: { watchlist: record, detail } };
  }

  list(ownerToken: string): WatchlistRecord[] {
    return this.repo.listWatchlists(ownerToken);
  }

  remove(ownerToken: string, id: string): boolean {
    return this.repo.deleteWatchlist(id, ownerToken);
  }

  alerts(ownerToken: string, limit = 20): AlertEventRecord[] {
    return this.repo.listAlertEvents(ownerToken, limit);
  }

  async check(ownerToken: string, id: string, now: Date): Promise<WatchlistOutcome<CheckResult>> {
    const watchlist = this.repo.getWatchlist(id, ownerToken);
    if (!watchlist) {
      return {
        ok: false,
        issues: [{ field: "id", code: "NOT_FOUND", message: "Pantauan tidak ditemukan untuk pengguna ini" }],
      };
    }

    let currentTotal: number | null = null;
    let verificationClass: TripPlanSummary["flight"]["verificationStatus"] | null = null;
    let detail: Record<string, unknown> = {};
    let failed = false;

    if (watchlist.type === "FLIGHT") {
      const check = await this.searchService.checkFlightWatchlist(watchlist.input as FlightWatchlistParams, now);
      currentTotal = check.totalMinor;
      verificationClass = check.verificationStatus;
      detail = check.detail;
      failed = check.unavailable;
    } else if (watchlist.type === "HOTEL") {
      const check = await this.searchService.checkHotelWatchlist(watchlist.input as HotelWatchlistParams, now);
      currentTotal = check.totalMinor;
      verificationClass = check.verificationStatus;
      detail = check.detail;
      failed = check.unavailable;
    } else {
      const outcome = await this.searchService.searchTrip(watchlist.input as TripSearchInput, now);
      if (!outcome.ok) {
        return { ok: false, issues: outcome.issues };
      }
      const plan = outcome.response.results[0] ?? null;
      currentTotal = plan?.tripTotalIdrMinor ?? null;
      verificationClass = plan?.flight.verificationStatus ?? null;
      detail = plan ? { plan } : {};
    }

    const createdEvents = this.evaluateAlert(watchlist, ownerToken, currentTotal, verificationClass, detail, failed, now);

    const refreshed = this.repo.getWatchlist(id, ownerToken);
    return {
      ok: true,
      data: {
        watchlist: (refreshed ?? watchlist) as WatchlistRecord,
        currentTotalIdrMinor: currentTotal,
        detail,
        createdEvents,
      },
    };
  }

  private evaluateAlert(
    watchlist: WatchlistRecord,
    ownerToken: string,
    currentTotal: number | null,
    verificationClass: string | null,
    detail: Record<string, unknown>,
    failed: boolean,
    now: Date,
  ): AlertEventRecord[] {
    const createdEvents: AlertEventRecord[] = [];
    const budgetHit = currentTotal != null && watchlist.thresholdIdrMinor != null && currentTotal <= watchlist.thresholdIdrMinor;
    const dropHit =
      currentTotal != null &&
      !failed &&
      verificationClass != null &&
      watchlist.lastAlertedTotalIdrMinor != null &&
      currentTotal < watchlist.lastAlertedTotalIdrMinor;
    if (budgetHit || dropHit) {
      const cooldownHours = this.config.alertCooldownHours;
      const dropThreshold = this.config.materialDropPercent;
      const canSend =
        cooldownExpired(watchlist.lastAlertSentAt, now, cooldownHours) ||
        (dropHit && mayBypassCooldown(watchlist.lastAlertedTotalIdrMinor as number, currentTotal as number, dropThreshold));
      if (canSend) {
        const drop = dropHit
          ? materialDropPercent(watchlist.lastAlertedTotalIdrMinor as number, currentTotal as number)
          : 0;
        const event = this.buildEvent(
          watchlist,
          verificationClass as TripPlanSummary["flight"]["verificationStatus"],
          currentTotal as number,
          drop,
          detail,
          now,
        );
        const status = this.repo.saveAlertEvent(event);
        if (status === "inserted") {
          createdEvents.push(event);
          this.repo.updateCheckResult(watchlist.id, ownerToken, {
            lastCheckedAt: now.toISOString(),
            lastCheckedTotalIdrMinor: currentTotal,
            lastAlertedTotalIdrMinor: currentTotal,
            lastAlertSentAt: now.toISOString(),
          });
        } else {
          this.repo.updateCheckResult(watchlist.id, ownerToken, {
            lastCheckedAt: now.toISOString(),
            lastCheckedTotalIdrMinor: currentTotal,
          });
        }
      } else {
        this.repo.updateCheckResult(watchlist.id, ownerToken, {
          lastCheckedAt: now.toISOString(),
          lastCheckedTotalIdrMinor: currentTotal,
        });
      }
    } else {
      this.repo.updateCheckResult(watchlist.id, ownerToken, {
        lastCheckedAt: now.toISOString(),
        lastCheckedTotalIdrMinor: currentTotal,
      });
    }
    return createdEvents;
  }

  /** Worker sweep: check every watchlist once. Never throws for one bad row. */
  async checkAll(now: Date): Promise<{ checked: number; eventsCreated: number }> {
    let checked = 0;
    let eventsCreated = 0;
    for (const wl of this.repo.allWatchlists()) {
      const result = await this.check(wl.ownerToken, wl.id, now);
      if (result.ok) {
        checked += 1;
        eventsCreated += result.data.createdEvents.length;
      }
    }
    return { checked, eventsCreated };
  }

  private findExisting(ownerToken: string, fingerprint: string): WatchlistRecord | null {
    return this.repo.listWatchlists(ownerToken).find((w) => w.searchFingerprint === fingerprint) ?? null;
  }

  private buildRecord(
    ownerToken: string,
    type: WatchlistType,
    input: WatchlistRecord["input"],
    fingerprint: string,
    baseline: number | null,
    threshold: number | null,
    now: Date,
    labelRaw: unknown,
  ): WatchlistRecord {
    return {
      id: `wl-${randomUUID()}`,
      ownerToken,
      type,
      input,
      searchFingerprint: fingerprint,
      label: typeof labelRaw === "string" && labelRaw.trim() !== "" ? labelRaw.trim().slice(0, 120) : null,
      baselineTotalIdrMinor: baseline,
      thresholdIdrMinor: threshold,
      lastAlertedTotalIdrMinor: baseline,
      lastCheckedAt: now.toISOString(),
      lastCheckedTotalIdrMinor: baseline,
      lastAlertSentAt: null,
      createdAt: now.toISOString(),
      version: 1,
    };
  }

  private buildEvent(
    watchlist: WatchlistRecord,
    verificationClass: TripPlanSummary["flight"]["verificationStatus"],
    currentTotal: number,
    dropPercent: number,
    detail: Record<string, unknown>,
    now: Date,
  ): AlertEventRecord {
    const fingerprint = alertEventFingerprint({
      watchlistId: watchlist.id,
      watchlistVersion: watchlist.version,
      comparablePlanKey: watchlist.searchFingerprint,
      priceBucketMinor: Math.round(currentTotal / PRICE_BUCKET_MINOR),
      verificationClass,
      thresholdRuleVersion: THRESHOLD_RULE_VERSION,
    });
    return {
      id: `alert-${randomUUID()}`,
      watchlistId: watchlist.id,
      ownerToken: watchlist.ownerToken,
      eventFingerprint: fingerprint,
      currentTotalIdrMinor: currentTotal,
      previousTotalIdrMinor: watchlist.lastAlertedTotalIdrMinor as number,
      dropPercent,
      payload: {
        type: watchlist.type,
        detail,
        coverageDisclaimer: "Harga dan ketersediaan dapat berubah. Verifikasi sebelum booking.",
      },
      createdAt: now.toISOString(),
    };
  }
}

function normalizeThreshold(raw: unknown): number | null {
  return typeof raw === "number" && Number.isInteger(raw) && raw > 0 ? raw : null;
}

function watchlistFingerprint(type: WatchlistType, input: unknown): string {
  const parts: string[] = [type];
  if (type === "COMPLETE_TRIP") {
    const i = input as TripSearchInput;
    parts.push(
      i.origins.slice().sort().join(","),
      i.departureStart,
      i.departureEnd,
      String(i.adults),
      i.childrenAges.slice().sort((a, b) => a - b).join(",") || "-",
      String(i.rooms),
      String(i.makkahNights),
      String(i.madinahNights),
      i.patterns.slice().sort().join(","),
      String(i.cityOrder),
      String(i.cabin),
      i.makkahRadiusKm.toFixed(2),
      i.madinahRadiusKm.toFixed(2),
      i.freeCancellationOnly ? "FC" : "NOFC",
      String(i.currency),
    );
  } else if (type === "FLIGHT") {
    const i = input as FlightWatchlistParams;
    parts.push(
      String(i.origin),
      String(i.departureStart),
      String(i.departureEnd),
      String(i.adults),
      i.childrenAges.slice().sort((a, b) => a - b).join(",") || "-",
      i.patterns.slice().sort().join(","),
      String(i.cabin),
      String(i.maxStops ?? "-"),
      String(i.maxLayoverMinutes ?? "-"),
      String(i.maxTripDurationMinutes ?? "-"),
    );
  } else {
    const i = input as HotelWatchlistParams;
    parts.push(
      String(i.city),
      String(i.checkIn),
      String(i.checkOut),
      String(i.adults),
      i.childrenAges.slice().sort((a, b) => a - b).join(",") || "-",
      String(i.rooms),
      i.radiusKm.toFixed(2),
      i.freeCancellationOnly ? "FC" : "NOFC",
    );
  }
  return parts.join("|");
}

function validateFlightParams(raw: unknown, _now: Date): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const input = (raw ?? {}) as Partial<FlightWatchlistParams>;
  if (typeof input.origin !== "string" || !(INDONESIAN_ORIGINS as readonly string[]).includes(input.origin)) {
    issues.push({ field: "input.origin", code: "VALIDATION_ERROR", message: "Bandara asal tidak valid" });
  }
  if (typeof input.departureStart !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(input.departureStart)) {
    issues.push({ field: "input.departureStart", code: "VALIDATION_ERROR", message: "Tanggal mulai diperlukan" });
  }
  if (typeof input.departureEnd !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(input.departureEnd)) {
    issues.push({ field: "input.departureEnd", code: "VALIDATION_ERROR", message: "Tanggal akhir diperlukan" });
  }
  if (typeof input.departureStart === "string" && typeof input.departureEnd === "string" && input.departureStart > input.departureEnd) {
    issues.push({ field: "input.departureEnd", code: "VALIDATION_ERROR", message: "Tanggal akhir tidak boleh sebelum tanggal awal" });
  }
  if (!(typeof input.adults === "number" && input.adults >= 1)) {
    issues.push({ field: "input.adults", code: "VALIDATION_ERROR", message: "Minimal satu dewasa" });
  }
  if (
    !Array.isArray(input.patterns) ||
    input.patterns.length === 0 ||
    !input.patterns.every((p) => ["ROUNDTRIP_JED", "ROUNDTRIP_MED", "OPENJAW_JED_MED", "OPENJAW_MED_JED"].includes(p))
  ) {
    issues.push({ field: "input.patterns", code: "VALIDATION_ERROR", message: "Pilih minimal satu pola perjalanan" });
  }
  if (!(typeof input.cabin === "string" && ["economy", "premium_economy", "business", "first"].includes(input.cabin))) {
    issues.push({ field: "input.cabin", code: "VALIDATION_ERROR", message: "Kelas kabin tidak valid" });
  }
  return issues;
}

function validateHotelParams(raw: unknown, _now: Date, frontierDays: number): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const input = (raw ?? {}) as Partial<HotelWatchlistParams>;
  if (input.city !== "MAKKAH" && input.city !== "MADINAH") {
    issues.push({ field: "input.city", code: "VALIDATION_ERROR", message: "Kota hotel harus MAKKAH atau MADINAH" });
  }
  if (typeof input.checkIn !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(input.checkIn)) {
    issues.push({ field: "input.checkIn", code: "VALIDATION_ERROR", message: "Tanggal check-in diperlukan" });
  }
  if (typeof input.checkOut !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(input.checkOut)) {
    issues.push({ field: "input.checkOut", code: "VALIDATION_ERROR", message: "Tanggal check-out diperlukan" });
  }
  if (typeof input.checkIn === "string" && typeof input.checkOut === "string" && input.checkOut <= input.checkIn) {
    issues.push({ field: "input.checkOut", code: "VALIDATION_ERROR", message: "Check-out harus setelah check-in" });
  }
  if (!(typeof input.adults === "number" && input.adults >= 1)) {
    issues.push({ field: "input.adults", code: "VALIDATION_ERROR", message: "Minimal satu dewasa" });
  }
  if (!(typeof input.rooms === "number" && input.rooms >= 1)) {
    issues.push({ field: "input.rooms", code: "VALIDATION_ERROR", message: "Minimal satu kamar" });
  }
  if (!(typeof input.radiusKm === "number" && input.radiusKm >= 1 && input.radiusKm <= 25)) {
    issues.push({ field: "input.radiusKm", code: "VALIDATION_ERROR", message: "Radius hotel harus 1 sampai 25 km" });
  }
  if (typeof input.checkIn === "string" && hotelCheckInState(input.checkIn, _now, frontierDays) === "NOT_YET_SEARCHABLE") {
    issues.push({
      field: "input.checkIn",
      code: "OUTSIDE_PROVIDER_FRONTIER",
      message: "Tanggal check-in di luar jangkauan pencarian hotel (frontier)",
    });
  }
  return issues;
}
