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
import type { AvailabilityState, CoverageRecord, ItineraryPattern } from "../domain/types.js";
import type { ProviderRegistry } from "../providers/registry.js";
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
  hotel: AvailabilityState;
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
    const flightProvider = this.registry.flightProviders[0];
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
    const hotelProvider = this.registry.hotelProviders[0];
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
    const flight = await this.runFlightCoverageScan(now);
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
    const flightProvider = this.registry.flightProviders[0];
    const hotelProvider = this.registry.hotelProviders[0];
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
    const hotelByDate = new Map<string, AvailabilityState[]>();
    for (const row of hotelRows) {
      const list = hotelByDate.get(row.date) ?? [];
      list.push(row.availabilityState);
      hotelByDate.set(row.date, list);
    }

    const days: CalendarDay[] = [];
    let cursor = start;
    let guard = 0;
    const frontierDays = this.config.mockHotelFrontierDays;
    while (cursor <= end && guard < 500) {
      const flight = flightByDate.get(cursor) ?? "NOT_SCANNED";
      let hotel = mergeHotelStates(hotelByDate.get(cursor) ?? []);
      if (hotel === "NOT_SCANNED" && hotelCheckInState(cursor, now, frontierDays) === "NOT_YET_SEARCHABLE") {
        hotel = "NOT_YET_SEARCHABLE";
      }
      days.push({ date: cursor, flight, hotel });
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
