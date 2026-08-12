// Watchlist orchestration (07_ALERTS_AND_SCHEDULER.md sections 2, 9-11).
// MVP slice: COMPLETE_TRIP watchlists with in-app alert events. FLIGHT and
// HOTEL watchlists plus the full scheduler tiers arrive with M4.
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
  TripSearchInput,
  TripPlanSummary,
  ValidationIssue,
  WatchlistRecord,
} from "../domain/types.js";
import { validateTripSearchInput } from "../domain/validation.js";
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
  plan: TripPlanSummary | null;
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
  ): Promise<WatchlistOutcome<{ watchlist: WatchlistRecord; plan: TripPlanSummary | null }>> {
    const body = (raw ?? {}) as { type?: unknown; label?: unknown; input?: unknown; thresholdIdrMinor?: unknown };
    if (body.type !== undefined && body.type !== "COMPLETE_TRIP") {
      return {
        ok: false,
        issues: [
          {
            field: "type",
            code: "VALIDATION_ERROR",
            message: "Tipe FLIGHT dan HOTEL menyusul di milestone berikutnya; gunakan COMPLETE_TRIP",
          },
        ],
      };
    }
    const validated = validateTripSearchInput(body.input, now);
    if (!validated.ok) {
      return { ok: false, issues: validated.issues };
    }
    const input = validated.data;
    const fingerprint = inputFingerprint(input);

    const existing = this.repo.listWatchlists(ownerToken).find((w) => w.searchFingerprint === fingerprint);
    if (existing) {
      return { ok: true, data: { watchlist: existing, plan: null } };
    }

    const outcome = await this.searchService.searchTrip(input, now);
    const plan = outcome.ok ? outcome.response.results[0] ?? null : null;
    const baseline = plan?.tripTotalIdrMinor ?? null;
    const thresholdRaw = body.thresholdIdrMinor;
    const threshold =
      typeof thresholdRaw === "number" && Number.isInteger(thresholdRaw) && thresholdRaw > 0
        ? thresholdRaw
        : null;

    const record: WatchlistRecord = {
      id: `wl-${randomUUID()}`,
      ownerToken,
      type: "COMPLETE_TRIP",
      input,
      searchFingerprint: fingerprint,
      label: typeof body.label === "string" && body.label.trim() !== "" ? body.label.trim().slice(0, 120) : null,
      baselineTotalIdrMinor: baseline,
      thresholdIdrMinor: threshold,
      lastAlertedTotalIdrMinor: baseline,
      lastCheckedAt: now.toISOString(),
      lastCheckedTotalIdrMinor: baseline,
      lastAlertSentAt: null,
      createdAt: now.toISOString(),
      version: 1,
    };
    this.repo.saveWatchlist(record);
    return { ok: true, data: { watchlist: record, plan } };
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
    const outcome = await this.searchService.searchTrip(watchlist.input, now);
    if (!outcome.ok) {
      return { ok: false, issues: outcome.issues };
    }
    const response = outcome.response;
    const plan = response.results[0] ?? null;
    const currentTotal = plan?.tripTotalIdrMinor ?? null;

    const createdEvents: AlertEventRecord[] = [];
    const budgetHit = currentTotal != null && watchlist.thresholdIdrMinor != null && currentTotal <= watchlist.thresholdIdrMinor;
    const dropHit =
      currentTotal != null &&
      plan != null &&
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
        const event = this.buildEvent(watchlist, plan as TripPlanSummary, currentTotal as number, drop, now);
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

    const refreshed = this.repo.getWatchlist(id, ownerToken);
    return {
      ok: true,
      data: {
        watchlist: (refreshed ?? watchlist) as WatchlistRecord,
        currentTotalIdrMinor: currentTotal,
        plan,
        createdEvents,
      },
    };
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

  private buildEvent(
    watchlist: WatchlistRecord,
    plan: TripPlanSummary,
    currentTotal: number,
    dropPercent: number,
    now: Date,
  ): AlertEventRecord {
    const fingerprint = alertEventFingerprint({
      watchlistId: watchlist.id,
      watchlistVersion: watchlist.version,
      comparablePlanKey: watchlist.searchFingerprint,
      priceBucketMinor: Math.round(currentTotal / PRICE_BUCKET_MINOR),
      verificationClass: plan.flight.verificationStatus,
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
        plan,
        coverageDisclaimer: "Harga dan ketersediaan dapat berubah. Verifikasi sebelum booking.",
      },
      createdAt: now.toISOString(),
    };
  }
}

function inputFingerprint(input: TripSearchInput): string {
  return [
    input.origins.slice().sort().join(","),
    input.departureStart,
    input.departureEnd,
    input.adults,
    input.childrenAges.slice().sort((a, b) => a - b).join(",") || "-",
    input.rooms,
    input.makkahNights,
    input.madinahNights,
    input.patterns.slice().sort().join(","),
    input.cityOrder,
    input.cabin,
    input.makkahRadiusKm.toFixed(2),
    input.madinahRadiusKm.toFixed(2),
    input.freeCancellationOnly ? "FC" : "NOFC",
    input.currency,
  ].join("|");
}
