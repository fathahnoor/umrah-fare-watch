// Coverage scheduler (02_LONG_HORIZON_MONITORING.md sections 5-9).
// MVP slice: rolling flight coverage per tier with deterministic jitter and
// nextEligibleAt, hotel frontier marking without calling the provider beyond
// the frontier, and per-date aggregation for the calendar UI.
import { randomUUID } from "node:crypto";
import type { AppConfig } from "../config.js";
import {
  deterministicJitterMs,
  flightCoveragePlan,
  isCoverageDue,
  tierIntervalHours,
} from "../domain/coveragePlan.js";
import { addDays } from "../domain/dates.js";
import { hotelCheckInState } from "../domain/horizons.js";
import type { AvailabilityState, City, CoverageRecord, ItineraryPattern } from "../domain/types.js";
import { activeFlightProvider, activeHotelProvider, type ProviderRegistry } from "../providers/registry.js";
import type { CoverageRepo } from "../store/coverage.js";

const COVERAGE_ORIGIN = "CGK";
const COVERAGE_PATTERNS: ItineraryPattern[] = [
  "ROUNDTRIP_JED",
  "ROUNDTRIP_MED",
  "OPENJAW_JED_MED",
  "OPENJAW_MED_JED",
];

export interface CalendarDay {
  date: string;
  flight: AvailabilityState;
  hotelMakkah: AvailabilityState;
  hotelMadinah: AvailabilityState;
}

export interface CoverageScanResult {
  scanRunId: string;
  flightScanned: number;
  flightRecorded: number;
  hotelFrontierMarked: number;
  nextEligibleAt: string;
}

export class CoverageService {
  constructor(
    private readonly registry: ProviderRegistry,
    private readonly repo: CoverageRepo,
    private readonly config: AppConfig,
  ) {}

  /** Scan every due flight date in the rolling 370-day technical plan. */
  async runFlightCoverageScan(now: Date): Promise<CoverageScanResult> {
    const flightProvider = activeFlightProvider(this.registry);
    if (!flightProvider) {
      throw new Error("no flight provider for coverage scan");
    }
    const scanRunId = `scan-${randomUUID()}`;
    const plan = flightCoveragePlan(now, this.config);
    let flightScanned = 0;
    let flightRecorded = 0;

    for (const entry of plan) {
      const existing = this.repo.getCoverage("FLIGHT", flightProvider.id, entry.date, null);
      if (existing && existing.availabilityState !== "NOT_SCANNED" && !isCoverageDue(existing.lastAttemptAt, existing.nextEligibleAt, now)) {
        continue;
      }
      flightScanned += 1;
      const observedAt = now.toISOString();
      let state: AvailabilityState = "NO_RESULT";
      let resultCount = 0;
      let errorCategory: CoverageRecord["errorCategory"] = null;
      try {
        const discovery = await flightProvider.discover({
          origin: COVERAGE_ORIGIN,
          departureStart: entry.date,
          departureEnd: entry.date,
          adults: 1,
          childrenAges: [],
          patterns: COVERAGE_PATTERNS,
          cabin: "economy",
          now,
        });
        resultCount = discovery.candidates.length;
        state = resultCount > 0 ? "HAS_RESULT" : "NO_RESULT";
      } catch {
        state = "PROVIDER_UNAVAILABLE";
        errorCategory = "PROVIDER_UNAVAILABLE";
      }
      const intervalHours = tierIntervalHours(entry.tier, this.config);
      const jitterMs = deterministicJitterMs(`flight|${entry.date}`, intervalHours);
      const nextEligibleAt = new Date(now.getTime() + intervalHours * 3_600_000 + jitterMs).toISOString();
      this.repo.upsertCoverage({
        domain: "FLIGHT",
        providerId: flightProvider.id,
        city: null,
        date: entry.date,
        availabilityState: state,
        frontierDate: null,
        lastAttemptAt: observedAt,
        lastSuccessAt: state === "HAS_RESULT" ? observedAt : null,
        nextEligibleAt,
        resultCount,
        errorCategory,
        scanRunId,
        updatedAt: observedAt,
      });
      flightRecorded += 1;
    }

    return {
      scanRunId,
      flightScanned,
      flightRecorded,
      hotelFrontierMarked: 0,
      nextEligibleAt: "",
    };
  }

  /**
   * Mark hotel dates beyond the active frontier as NOT_YET_SEARCHABLE with a
   * nextEligibleAt when the check-in enters the frontier. Never calls the
   * provider for these dates. Within the frontier, dates stay NOT_SCANNED
   * until an exact hotel search records them (selective enrichment).
   */
  async refreshHotelFrontier(now: Date): Promise<CoverageScanResult> {
    const hotelProvider = activeHotelProvider(this.registry);
    if (!hotelProvider) {
      throw new Error("no hotel provider for frontier refresh");
    }
    const frontier = await hotelProvider.getFrontier(now);
    const frontierDate = frontier.checkInFrontierDate;
    const plan = flightCoveragePlan(now, this.config);
    const scanRunId = `frontier-${randomUUID()}`;
    let hotelFrontierMarked = 0;

    for (const entry of plan) {
      if (hotelCheckInState(entry.date, now, this.config.mockHotelFrontierDays) !== "NOT_YET_SEARCHABLE") {
        continue;
      }
      for (const city of ["MAKKAH", "MADINAH"] as const) {
        const existing = this.repo.getCoverage("HOTEL", hotelProvider.id, entry.date, city);
        if (existing && existing.availabilityState === "NOT_YET_SEARCHABLE") {
          continue;
        }
        const daysToFrontier = entry.offsetDays - this.config.mockHotelFrontierDays;
        const nextEligibleAt =
          daysToFrontier > 0
            ? new Date(now.getTime() + daysToFrontier * 86_400_000).toISOString()
            : now.toISOString();
        this.repo.upsertCoverage({
          domain: "HOTEL",
          providerId: hotelProvider.id,
          city,
          date: entry.date,
          availabilityState: "NOT_YET_SEARCHABLE",
          frontierDate,
          lastAttemptAt: null,
          lastSuccessAt: null,
          nextEligibleAt,
          resultCount: 0,
          errorCategory: null,
          scanRunId,
          updatedAt: now.toISOString(),
        });
        hotelFrontierMarked += 1;
      }
    }

    return { scanRunId, flightScanned: 0, flightRecorded: 0, hotelFrontierMarked, nextEligibleAt: "" };
  }

  async runDueScans(now: Date): Promise<CoverageScanResult> {
    // The 370-day rolling scan is a mock/cheap-API feature. With a paid-per-call
    // real provider (e.g. SerpAPI free tier is 250 searches/month) a full fill
    // would burn the whole budget in one run, so the automated flight scan is
    // skipped while a real provider is active. Hotel frontier marking is free
    // (no provider calls) and keeps running.
    const flightProvider = activeFlightProvider(this.registry);
    const flight =
      flightProvider && flightProvider.mode === "MOCK"
        ? await this.runFlightCoverageScan(now)
        : { scanRunId: "skipped-real-provider", flightScanned: 0, flightRecorded: 0, hotelFrontierMarked: 0, nextEligibleAt: "" };
    const frontier = await this.refreshHotelFrontier(now);
    return {
      scanRunId: flight.scanRunId,
      flightScanned: flight.flightScanned,
      flightRecorded: flight.flightRecorded,
      hotelFrontierMarked: frontier.hotelFrontierMarked,
      nextEligibleAt: "",
    };
  }

  /** Per-date flight and hotel states for the calendar. */
  async calendarDays(start: string, end: string, now: Date): Promise<CalendarDay[]> {
    const flightProvider = activeFlightProvider(this.registry);
    const hotelProvider = activeHotelProvider(this.registry);
    const flightRows = flightProvider
      ? this.repo.listAllFlightCoverage(start, end)
      : [];
    const hotelRows = hotelProvider
      ? this.repo.listAllHotelCoverage(start, end)
      : [];

    const flightByDate = new Map<string, AvailabilityState>();
    for (const row of flightRows) {
      flightByDate.set(row.date, row.availabilityState);
    }
    // Hotel rows are recorded per city (MAKKAH/MADINAH); keep them separate so
    // the calendar can show that e.g. Makkah is available while Madinah is not
    // yet searched, letting the user decide whether to proceed.
    const hotelByCityDate = new Map<City, Map<string, AvailabilityState[]>>();
    for (const row of hotelRows) {
      if (!row.city) {
        continue;
      }
      const byDate = hotelByCityDate.get(row.city) ?? new Map();
      const list = byDate.get(row.date) ?? [];
      list.push(row.availabilityState);
      byDate.set(row.date, list);
      hotelByCityDate.set(row.city, byDate);
    }

    const days: CalendarDay[] = [];
    let cursor = start;
    let guard = 0;
    const frontierDays = this.config.mockHotelFrontierDays;
    while (cursor <= end && guard < 500) {
      const flight = flightByDate.get(cursor) ?? "NOT_SCANNED";
      let hotelMakkah = mergeHotelStates(hotelByCityDate.get("MAKKAH")?.get(cursor) ?? []);
      let hotelMadinah = mergeHotelStates(hotelByCityDate.get("MADINAH")?.get(cursor) ?? []);
      if (hotelCheckInState(cursor, now, frontierDays) === "NOT_YET_SEARCHABLE") {
        if (hotelMakkah === "NOT_SCANNED") {
          hotelMakkah = "NOT_YET_SEARCHABLE";
        }
        if (hotelMadinah === "NOT_SCANNED") {
          hotelMadinah = "NOT_YET_SEARCHABLE";
        }
      }
      days.push({ date: cursor, flight, hotelMakkah, hotelMadinah });
      cursor = addDays(cursor, 1);
      guard += 1;
    }
    return days;
  }
}

function mergeHotelStates(states: AvailabilityState[]): AvailabilityState {
  if (states.length === 0) {
    return "NOT_SCANNED";
  }
  if (states.includes("HAS_RESULT")) {
    return "HAS_RESULT";
  }
  if (states.includes("PROVIDER_UNAVAILABLE")) {
    return "PROVIDER_UNAVAILABLE";
  }
  if (states.includes("NOT_YET_SEARCHABLE")) {
    return "NOT_YET_SEARCHABLE";
  }
  if (states.includes("NO_RESULT")) {
    return "NO_RESULT";
  }
  return "NOT_SCANNED";
}
