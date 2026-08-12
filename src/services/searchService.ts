// Search orchestration (03_TECHNICAL_ARCHITECTURE.md section 5).
// Bounded: verify maxFlightsForHotelEnrichmentPerSearch candidates, keep up to
// maxHotelResultsPerCity per city, return maxTripPlansReturned ranked plans.
import { randomUUID } from "node:crypto";
import type { AppConfig } from "../config.js";
import { composeTrip, deriveCityDates, toPlanSummary } from "../composer/tripComposer.js";
import { addDays } from "../domain/dates.js";
import { canonicalHotelSearchKey, searchFingerprint } from "../domain/canonical.js";
import { isExpired } from "../domain/completeness.js";
import { hotelCheckInState } from "../domain/horizons.js";
import { compareCompletePlans, toRankablePlan } from "../domain/ranking.js";
import type {
  AvailabilityState,
  CalendarDaySummary,
  CalendarResponse,
  City,
  CoverageRecord,
  FlightCandidate,
  FlightObservation,
  HotelObservation,
  TripPlan,
  TripSearchInput,
  TripSearchResponse,
  ValidationIssue,
} from "../domain/types.js";
import { validateTripSearchInput } from "../domain/validation.js";
import { collectHealth, type ProviderRegistry } from "../providers/registry.js";
import { enumerateDates } from "../providers/mock/mockFlightProvider.js";
import { flightObservationSchema, hotelObservationSchema } from "../providers/schemas.js";
import { ProviderError, type ProviderHealthSnapshot } from "../providers/types.js";
import type { CoverageRepo } from "../store/coverage.js";
import type { ObservationStore } from "../store/repositories.js";

export const REQUIRED_DISCLAIMER =
  "Harga dan ketersediaan dapat berubah. Hasil membandingkan provider yang aktif saat observasi, bukan seluruh penawaran di internet. Verifikasi total, syarat refund, detail reservasi hotel, persyaratan visa, dan kebijakan provider sebelum booking.";

export type SearchTripOutcome =
  | { ok: true; response: TripSearchResponse }
  | { ok: false; issues: ValidationIssue[] };

export type CalendarOutcome =
  | { ok: true; response: CalendarResponse }
  | { ok: false; issues: ValidationIssue[] };

interface HotelBucket {
  key: string;
  city: City;
  checkIn: string;
  checkOut: string;
  observations: HotelObservation[];
  state: AvailabilityState;
}

export class SearchService {
  constructor(
    private readonly registry: ProviderRegistry,
    private readonly store: ObservationStore,
    private readonly config: AppConfig,
    private readonly coverageRepo?: CoverageRepo,
  ) {}

  async searchTrip(raw: unknown, now: Date): Promise<SearchTripOutcome> {
    const validated = validateTripSearchInput(raw, now);
    if (!validated.ok) {
      return { ok: false, issues: validated.issues };
    }
    const input = validated.data;
    const fingerprint = searchFingerprint(input);
    const requestId = randomUUID();
    const observedAt = now.toISOString();
    const warnings: string[] = [];
    const unavailableProviders: TripSearchResponse["unavailableProviders"] = [];

    const flightProvider = this.registry.flightProviders[0];
    const hotelProvider = this.registry.hotelProviders[0];
    if (!flightProvider || !hotelProvider) {
      throw new Error("provider registry is empty");
    }

    // 1. Broad discovery across origins and patterns, bounded by price order.
    const allCandidates: FlightCandidate[] = [];
    for (const origin of input.origins) {
      const discovery = await flightProvider.discover({
        origin,
        departureStart: input.departureStart,
        departureEnd: input.departureEnd,
        adults: input.adults,
        childrenAges: input.childrenAges,
        patterns: input.patterns,
        cabin: input.cabin,
        maxStops: input.maxStops,
        maxLayoverMinutes: input.maxLayoverMinutes,
        maxTripDurationMinutes: input.maxTripDurationMinutes,
        now,
      });
      allCandidates.push(...discovery.candidates);
    }
    allCandidates.sort((a, b) => a.indicativeTotalMinor - b.indicativeTotalMinor);
    const topCandidates = allCandidates.slice(0, this.config.maxFlightsForHotelEnrichmentPerSearch);

    // 2. Selective live verification of the top candidates.
    const flightObservations: FlightObservation[] = [];
    for (const candidate of topCandidates) {
      try {
        const { observation } = await flightProvider.verify({
          candidate,
          adults: input.adults,
          childrenAges: input.childrenAges,
          cabin: input.cabin,
          now,
        });
        const parsed = flightObservationSchema.safeParse(observation);
        if (!parsed.success) {
          warnings.push("Respons provider tiket tidak valid dan tidak disimpan");
          continue;
        }
        this.store.saveFlightObservation(parsed.data);
        if (observation.verificationStatus !== "EXPIRED" && !isExpired(observation.expiresAt, now)) {
          flightObservations.push(observation);
        } else {
          warnings.push("Beberapa penawaran tiket sudah kedaluwarsa dan tidak dapat dipakai");
        }
      } catch (err) {
        if (err instanceof ProviderError) {
          unavailableProviders.push({
            id: flightProvider.id,
            reason: err.message,
            retryable: err.retryable,
            nextEligibleAt: err.nextEligibleAt,
          });
          warnings.push("Sebagian verifikasi tiket gagal, hasil lain tetap dipakai");
        } else {
          throw err;
        }
      }
    }

    // 3. Derived hotel dates and canonical hotel searches (run-level dedup).
    const hotelCache = new Map<string, HotelBucket>();
    const cityStates: Record<City, AvailabilityState> = {
      MAKKAH: "NOT_SCANNED",
      MADINAH: "NOT_SCANNED",
    };

    for (const flight of flightObservations) {
      const derived = deriveCityDates(flight, input);
      if (!derived.ok) {
        continue;
      }
      const dates = derived.dates;
      for (const city of ["MAKKAH", "MADINAH"] as const) {
        const checkIn = city === "MAKKAH" ? dates.makkahCheckIn : dates.madinahCheckIn;
        const checkOut = city === "MAKKAH" ? dates.makkahCheckOut : dates.madinahCheckOut;
        const radiusKm = city === "MAKKAH" ? input.makkahRadiusKm : input.madinahRadiusKm;

        if (hotelCheckInState(checkIn, now, this.config.mockHotelFrontierDays) === "NOT_YET_SEARCHABLE") {
          cityStates[city] = mergeCityState(cityStates[city], "NOT_YET_SEARCHABLE");
          warnings.push(
            `Hotel ${city === "MAKKAH" ? "Makkah" : "Madinah"} belum dapat dicari untuk tanggal ini (di luar jangkauan provider)`,
          );
          continue;
        }

        const key = canonicalHotelSearchKey({
          providerId: hotelProvider.id,
          city,
          checkIn,
          checkOut,
          adults: input.adults,
          childrenAges: input.childrenAges,
          rooms: input.rooms,
          radiusKm,
          freeCancellationOnly: input.freeCancellationOnly,
          currency: "IDR",
        });

        let bucket = hotelCache.get(key);
        if (!bucket) {
          bucket = await this.searchHotelBucket(hotelProvider.id, {
            providerId: hotelProvider.id,
            city,
            checkIn,
            checkOut,
            adults: input.adults,
            childrenAges: input.childrenAges,
            rooms: input.rooms,
            radiusKm,
            freeCancellationOnly: input.freeCancellationOnly,
            currency: "IDR",
            now,
          }, unavailableProviders, warnings);
          hotelCache.set(key, bucket);
        }
        cityStates[city] = mergeCityState(cityStates[city], bucket.state);
      }
    }

    // 4. Bounded composition.
    const plans: TripPlan[] = [];
    for (const flight of flightObservations) {
      const derived = deriveCityDates(flight, input);
      if (!derived.ok) {
        continue;
      }
      const makkahKey = this.hotelKey(hotelProvider.id, "MAKKAH", derived.dates, input);
      const madinahKey = this.hotelKey(hotelProvider.id, "MADINAH", derived.dates, input);
      const makkahList = freshHotels(hotelCache.get(makkahKey)?.observations ?? [], now);
      const madinahList = freshHotels(hotelCache.get(madinahKey)?.observations ?? [], now);

      const makkahOptions: Array<HotelObservation | null> = makkahList.length > 0 ? makkahList : [null];
      const madinahOptions: Array<HotelObservation | null> = madinahList.length > 0 ? madinahList : [null];

      for (const mk of makkahOptions) {
        for (const md of madinahOptions) {
          if (mk == null && md == null && (makkahList.length > 0 || madinahList.length > 0)) {
            continue;
          }
          const plan = composeTrip({
            input,
            searchFingerprint: fingerprint,
            flight,
            makkahHotel: mk,
            madinahHotel: md,
            now,
          });
          if (plan) {
            plans.push(plan);
          }
        }
      }
    }

    // 4b. Coverage recording: user searches feed the calendar (append-only,
    // failures never erase earlier rows).
    this.recordFlightCoverage(input, flightObservations, now);

    // 5. Ranking: only COMPLETE, usable plans enter the primary list.
    for (const plan of plans) {
      this.store.saveTripPlan(plan);
    }
    const usable = plans.filter((p) => p.tripPlanStatus !== "EXPIRED" && p.tripPlanStatus !== "STALE");
    const completePlans = usable
      .filter((p) => p.priceCompleteness === "COMPLETE")
      .sort((a, b) => compareCompletePlans(toRankablePlan(a), toRankablePlan(b)));
    const partialPlans = usable
      .filter((p) => p.priceCompleteness !== "COMPLETE")
      .sort((a, b) => partialAvailableTotal(a) - partialAvailableTotal(b));

    const results = completePlans.slice(0, this.config.maxTripPlansReturned).map((p) => toPlanSummary(p, input));
    const partialResults = partialPlans.slice(0, this.config.maxTripPlansReturned).map((p) => toPlanSummary(p, input));

    const hotelFrontier = await hotelProvider.getFrontier(now);
    const health = await Promise.all([
      ...this.registry.flightProviders.map((p) => p.health()),
      ...this.registry.hotelProviders.map((p) => p.health()),
    ]);

    const response: TripSearchResponse = {
      requestId,
      observedAt,
      results,
      partialResults,
      coverage: {
        flight: flightObservations.length > 0
          ? "HAS_RESULT"
          : unavailableProviders.some((u) => u.id === flightProvider.id)
            ? "PROVIDER_UNAVAILABLE"
            : "NO_RESULT",
        makkahHotel: cityStates.MAKKAH,
        madinahHotel: cityStates.MADINAH,
        hotelFrontierDate: hotelFrontier.checkInFrontierDate,
      },
      activeProviders: health.map((h) => ({ id: h.id, mode: h.mode, enabled: h.enabled })),
      unavailableProviders,
      warnings,
      constraints: input,
      disclaimer: REQUIRED_DISCLAIMER,
    };
    return { ok: true, response };
  }

  /**
   * Cheapest-date calendar scan: run the same bounded search pipeline once per
   * departure date and report the cheapest COMPLETE total per day. Each day is
   * an independent search so provider failure on one date never hides another.
   */
  async searchCalendar(raw: unknown, now: Date): Promise<CalendarOutcome> {
    const validated = validateTripSearchInput(raw, now);
    if (!validated.ok) {
      return { ok: false, issues: validated.issues };
    }
    const input = validated.data;

    const requestedDays = clampScanDays(raw, this.config.calendarScanDaysMax);
    const start = input.departureStart;
    const cappedEnd = addDays(start, requestedDays - 1);
    const end = cappedEnd < input.departureEnd ? cappedEnd : input.departureEnd;
    const dates = enumerateDates(start, end);

    const warnings = new Set<string>();
    const days: CalendarDaySummary[] = [];
    let observedAt = "";
    let activeProviders: CalendarResponse["activeProviders"] = [];

    for (const departureDate of dates) {
      const outcome = await this.searchTrip(
        { ...input, departureStart: departureDate, departureEnd: departureDate },
        now,
      );
      if (!outcome.ok) {
        continue;
      }
      const resp = outcome.response;
      observedAt = resp.observedAt;
      if (activeProviders.length === 0) {
        activeProviders = resp.activeProviders;
      }
      for (const w of resp.warnings) {
        warnings.add(w);
      }
      const best = resp.results[0];
      days.push({
        departureDate,
        hasComplete: resp.results.length > 0,
        countComplete: resp.results.length,
        cheapestTotalIdrMinor: best?.tripTotalIdrMinor ?? null,
        perPersonEquivalentIdrMinor: best?.perPersonEquivalentIdrMinor ?? null,
        planId: best?.id ?? null,
        pattern: best?.pattern ?? null,
        firstCity: best?.firstCity ?? null,
        stops: best?.flight.stops ?? null,
        durationMinutes: best?.flight.durationMinutes ?? null,
      });
    }

    const completeDays = days.filter(
      (d): d is CalendarDaySummary & { cheapestTotalIdrMinor: number } =>
        d.hasComplete && d.cheapestTotalIdrMinor != null,
    );
    const cheapest = completeDays.length > 0
      ? completeDays.reduce((min, d) =>
          d.cheapestTotalIdrMinor < (min?.cheapestTotalIdrMinor ?? Infinity) ? d : min,
          null as (CalendarDaySummary & { cheapestTotalIdrMinor: number }) | null,
        )
      : null;

    const response: CalendarResponse = {
      requestId: randomUUID(),
      observedAt,
      scanWindow: {
        start,
        end,
        requestedDays,
        daysScanned: days.length,
      },
      days,
      cheapestDate: cheapest?.departureDate ?? null,
      cheapestTotalIdrMinor: cheapest?.cheapestTotalIdrMinor ?? null,
      activeProviders,
      warnings: [...warnings],
      constraints: input,
      disclaimer: REQUIRED_DISCLAIMER,
    };
    return { ok: true, response };
  }

  private hotelKey(
    providerId: string,
    city: City,
    dates: { makkahCheckIn: string; makkahCheckOut: string; madinahCheckIn: string; madinahCheckOut: string },
    input: TripSearchInput,
  ): string {
    return canonicalHotelSearchKey({
      providerId,
      city,
      checkIn: city === "MAKKAH" ? dates.makkahCheckIn : dates.madinahCheckIn,
      checkOut: city === "MAKKAH" ? dates.makkahCheckOut : dates.madinahCheckOut,
      adults: input.adults,
      childrenAges: input.childrenAges,
      rooms: input.rooms,
      radiusKm: city === "MAKKAH" ? input.makkahRadiusKm : input.madinahRadiusKm,
      freeCancellationOnly: input.freeCancellationOnly,
      currency: "IDR",
    });
  }

  async providerHealth(): Promise<ProviderHealthSnapshot[]> {
    return collectHealth(this.registry);
  }

  async coverageOverview(now: Date): Promise<{
    providers: ProviderHealthSnapshot[];
    hotelFrontierDate: string | null;
    disclaimer: string;
  }> {
    const hotelProvider = this.registry.hotelProviders[0];
    const frontier = hotelProvider ? await hotelProvider.getFrontier(now) : null;
    return {
      providers: await collectHealth(this.registry),
      hotelFrontierDate: frontier?.checkInFrontierDate ?? null,
      disclaimer: REQUIRED_DISCLAIMER,
    };
  }

  private async searchHotelBucket(
    providerId: string,
    searchInput: {
      providerId: string;
      city: City;
      checkIn: string;
      checkOut: string;
      adults: number;
      childrenAges: number[];
      rooms: number;
      radiusKm: number;
      freeCancellationOnly: boolean;
      currency: "IDR";
      now: Date;
    },
    unavailableProviders: TripSearchResponse["unavailableProviders"],
    warnings: string[],
  ): Promise<HotelBucket> {
    const hotelProvider = this.registry.hotelProviders[0];
    if (!hotelProvider) {
      return { key: "", city: searchInput.city, checkIn: searchInput.checkIn, checkOut: searchInput.checkOut, observations: [], state: "NOT_SCANNED" };
    }
    const key = canonicalHotelSearchKey(searchInput);
    try {
      const result = await hotelProvider.search(searchInput);
      const observations: HotelObservation[] = [];
      for (const obs of result.observations.slice(0, this.config.maxHotelResultsPerCity)) {
        const parsed = hotelObservationSchema.safeParse(obs);
        if (!parsed.success) {
          warnings.push(`Satu respons hotel ${searchInput.city === "MAKKAH" ? "Makkah" : "Madinah"} tidak valid dan tidak disimpan`);
          continue;
        }
        this.store.saveHotelObservation(parsed.data);
        observations.push(parsed.data);
      }
      const state: AvailabilityState = result.state === "HAS_RESULT" ? "HAS_RESULT" : result.state === "NO_RESULT" ? "NO_RESULT" : "NOT_YET_SEARCHABLE";
      this.recordHotelCoverage(
        { providerId: searchInput.providerId, city: searchInput.city, checkIn: searchInput.checkIn },
        state,
        observations.length,
        searchInput.now,
      );
      return { key, city: searchInput.city, checkIn: searchInput.checkIn, checkOut: searchInput.checkOut, observations, state };
    } catch (err) {
      if (err instanceof ProviderError) {
        unavailableProviders.push({
          id: providerId,
          reason: err.message,
          retryable: err.retryable,
          nextEligibleAt: err.nextEligibleAt,
        });
        warnings.push(`Pencarian hotel ${searchInput.city === "MAKKAH" ? "Makkah" : "Madinah"} gagal, data lama tidak dihapus`);
        this.recordHotelCoverage(
          { providerId: searchInput.providerId, city: searchInput.city, checkIn: searchInput.checkIn },
          "PROVIDER_UNAVAILABLE",
          0,
          searchInput.now,
          err.category,
        );
        return { key, city: searchInput.city, checkIn: searchInput.checkIn, checkOut: searchInput.checkOut, observations: [], state: "PROVIDER_UNAVAILABLE" };
      }
      throw err;
    }
  }

  private recordFlightCoverage(input: TripSearchInput, observations: FlightObservation[], now: Date): void {
    if (!this.coverageRepo) {
      return;
    }
    const flightProvider = this.registry.flightProviders[0];
    if (!flightProvider) {
      return;
    }
    const byDate = new Map<string, number>();
    for (const obs of observations) {
      const key = obs.departureLocalDate;
      byDate.set(key, (byDate.get(key) ?? 0) + 1);
    }
    const observedAt = now.toISOString();
    // A bounded user search verifies only the top candidates, so it proves
    // HAS_RESULT for dates with observations but never proves NO_RESULT for
    // other dates. Writing NO_RESULT here would erase scheduler coverage.
    for (const date of enumerateDates(input.departureStart, input.departureEnd)) {
      const count = byDate.get(date) ?? 0;
      if (count === 0) {
        continue;
      }
      this.coverageRepo.upsertCoverage({
        domain: "FLIGHT",
        providerId: flightProvider.id,
        city: null,
        date,
        availabilityState: "HAS_RESULT",
        frontierDate: null,
        lastAttemptAt: observedAt,
        lastSuccessAt: observedAt,
        nextEligibleAt: null,
        resultCount: count,
        errorCategory: null,
        scanRunId: null,
        updatedAt: observedAt,
      });
    }
  }

  private recordHotelCoverage(
    searchInput: {
      providerId: string;
      city: City;
      checkIn: string;
    },
    state: AvailabilityState,
    resultCount: number,
    now: Date,
    errorCategory: CoverageRecord["errorCategory"] = null,
  ): void {
    if (!this.coverageRepo) {
      return;
    }
    const observedAt = now.toISOString();
    this.coverageRepo.upsertCoverage({
      domain: "HOTEL",
      providerId: searchInput.providerId,
      city: searchInput.city,
      date: searchInput.checkIn,
      availabilityState: state,
      frontierDate: null,
      lastAttemptAt: observedAt,
      lastSuccessAt: state === "HAS_RESULT" ? observedAt : null,
      nextEligibleAt: null,
      resultCount,
      errorCategory,
      scanRunId: null,
      updatedAt: observedAt,
    });
  }
}

function freshHotels(list: HotelObservation[], now: Date): HotelObservation[] {
  return list.filter((obs) => obs.verificationStatus !== "EXPIRED" && !isExpired(obs.expiresAt, now));
}

function mergeCityState(current: AvailabilityState, next: AvailabilityState): AvailabilityState {
  if (next === "HAS_RESULT") {
    return "HAS_RESULT";
  }
  if (current === "HAS_RESULT") {
    return "HAS_RESULT";
  }
  if (next === "PROVIDER_UNAVAILABLE") {
    return "PROVIDER_UNAVAILABLE";
  }
  if (current === "PROVIDER_UNAVAILABLE") {
    return "PROVIDER_UNAVAILABLE";
  }
  if (next === "NOT_YET_SEARCHABLE") {
    return "NOT_YET_SEARCHABLE";
  }
  if (current === "NOT_YET_SEARCHABLE") {
    return "NOT_YET_SEARCHABLE";
  }
  if (next === "NO_RESULT") {
    return "NO_RESULT";
  }
  if (current === "NO_RESULT") {
    return "NO_RESULT";
  }
  return current;
}

/** Requested scan days: explicit integer in [1, max], otherwise the max. */
function clampScanDays(raw: unknown, max: number): number {
  const value = (raw as { days?: unknown })?.days;
  if (typeof value === "number" && Number.isInteger(value) && value >= 1) {
    return Math.min(value, max);
  }
  return max;
}

function partialAvailableTotal(plan: TripPlan): number {
  return (
    (plan.flightPartyTotalIdrMinor ?? 0) +
    (plan.makkahStayTotalIdrMinor ?? 0) +
    (plan.madinahStayTotalIdrMinor ?? 0)
  );
}
