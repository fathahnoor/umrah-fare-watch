// M8 booking handoff (04_PROVIDER_AND_DATA_STRATEGY.md section 11).
// Before opening a provider URL: re-verify the flight offer and hotel rates,
// compare price and availability with the stored snapshot, show a change
// summary, require explicit confirmation for the new price, then open only
// allowlisted provider URLs. The app never processes payments or bookings.
import type { AppConfig } from "../config.js";
import { REQUIRED_DISCLAIMER } from "./searchService.js";
import { activeFlightProvider, activeHotelProvider, type ProviderRegistry } from "../providers/registry.js";
import type { FlightCandidate, HotelObservation, TripPlan } from "../domain/types.js";
import type { ObservationStore } from "../store/repositories.js";

export type HandoffOutcome<T> = { ok: true; data: T } | { ok: false; code: string; message: string };

export interface ComponentChange {
  changed: boolean;
  oldTotalIdrMinor: number | null;
  newTotalIdrMinor: number | null;
  verificationStatus: string | null;
}

export interface HandoffPrepare {
  planId: string;
  changed: boolean;
  requiresConfirmation: boolean;
  oldTotalIdrMinor: number | null;
  newTotalIdrMinor: number | null;
  deltaIdrMinor: number | null;
  components: {
    flight: ComponentChange;
    makkah: ComponentChange;
    madinah: ComponentChange;
  };
  verifiedAt: string;
  warnings: string[];
}

export class HandoffService {
  constructor(
    private readonly registry: ProviderRegistry,
    private readonly store: ObservationStore,
    private readonly config: AppConfig,
  ) {}

  async prepare(planIdRaw: unknown, now: Date): Promise<HandoffOutcome<HandoffPrepare>> {
    const planId = typeof planIdRaw === "string" ? planIdRaw : "";
    const plan = planId ? this.store.getTripPlan(planId) : null;
    if (!plan) {
      return { ok: false, code: "NOT_FOUND", message: "Plan tidak ditemukan atau belum diverifikasi server-side" };
    }

    const flightProvider = activeFlightProvider(this.registry);
    const hotelProvider = activeHotelProvider(this.registry);
    const warnings: string[] = [];

    // Re-verify the flight offer from the stored observation's candidate data.
    const candidate = candidateFromObservation(plan);
    let flightCheck: ComponentChange;
    try {
      const { observation } = await flightProvider.verify({
        candidate,
        adults: plan.components.flight.adults,
        childrenAges: plan.components.flight.childrenAges,
        cabin: plan.components.flight.cabin,
        now,
      });
      flightCheck = {
        changed: (observation.normalizedIdrAmountMinor ?? 0) !== (plan.flightPartyTotalIdrMinor ?? 0),
        oldTotalIdrMinor: plan.flightPartyTotalIdrMinor,
        newTotalIdrMinor: observation.normalizedIdrAmountMinor,
        verificationStatus: observation.verificationStatus,
      };
      if (flightCheck.changed) {
        warnings.push("Harga tiket berubah sejak pencarian; total lama tidak lagi valid.");
      }
    } catch (err) {
      return {
        ok: false,
        code: err instanceof Error && err.message.includes("ACCESS_NOT_CONFIGURED") ? "ACCESS_NOT_CONFIGURED" : "PROVIDER_UNAVAILABLE",
        message: "Verifikasi ulang tiket gagal; tautan tidak dibuka.",
      };
    }

    // Re-check both hotel components with their exact canonical parameters.
    const makkah = plan.components.makkahHotel
      ? await this.recheckHotel(plan.components.makkahHotel, hotelProvider, now)
      : { changed: false, oldTotalIdrMinor: null, newTotalIdrMinor: null, verificationStatus: null };
    const madinah = plan.components.madinahHotel
      ? await this.recheckHotel(plan.components.madinahHotel, hotelProvider, now)
      : { changed: false, oldTotalIdrMinor: null, newTotalIdrMinor: null, verificationStatus: null };
    if (makkah.changed || madinah.changed) {
      warnings.push("Harga hotel berubah sejak pencarian.");
    }

    const newTotal =
      flightCheck.newTotalIdrMinor != null && makkah.newTotalIdrMinor != null && madinah.newTotalIdrMinor != null
        ? flightCheck.newTotalIdrMinor + makkah.newTotalIdrMinor + madinah.newTotalIdrMinor
        : null;
    const oldTotal = plan.tripTotalIdrMinor;
    const changed =
      flightCheck.changed || makkah.changed || madinah.changed || (oldTotal != null && newTotal != null && oldTotal !== newTotal);

    return {
      ok: true,
      data: {
        planId,
        changed,
        requiresConfirmation: changed,
        oldTotalIdrMinor: oldTotal,
        newTotalIdrMinor: newTotal,
        deltaIdrMinor: changed && oldTotal != null && newTotal != null ? newTotal - oldTotal : null,
        components: { flight: flightCheck, makkah, madinah },
        verifiedAt: now.toISOString(),
        warnings,
      },
    };
  }

  async confirm(planIdRaw: unknown, confirmPriceRaw: unknown, now: Date): Promise<HandoffOutcome<{ urls: Record<string, string>; disclaimer: string }>> {
    const prepared = await this.prepare(planIdRaw, now);
    if (!prepared.ok) {
      return prepared;
    }
    const p = prepared.data;
    const confirmPrice = typeof confirmPriceRaw === "number" && Number.isInteger(confirmPriceRaw) ? confirmPriceRaw : null;
    // Explicit confirmation is always required: the client must send the exact
    // integer total it was shown, so a stale or fabricated price never opens URLs.
    if (confirmPrice == null) {
      return {
        ok: false,
        code: "QUOTE_CHANGED",
        message: "Total konfirmasi tidak cocok dengan harga terverifikasi.",
      };
    }
    if (p.changed) {
      if (confirmPrice !== p.newTotalIdrMinor) {
        return {
          ok: false,
          code: "QUOTE_CHANGED",
          message: "Harga berubah; konfirmasikan total baru untuk melanjutkan.",
        };
      }
    } else if (p.oldTotalIdrMinor != null && confirmPrice !== p.oldTotalIdrMinor) {
      return {
        ok: false,
        code: "QUOTE_CHANGED",
        message: "Total konfirmasi tidak cocok dengan harga terverifikasi.",
      };
    }

    const plan = this.store.getTripPlan(p.planId);
    if (!plan) {
      return { ok: false, code: "NOT_FOUND", message: "Plan tidak ditemukan" };
    }
    const urls: Record<string, string> = {};
    const violations = this.collectAllowlistedUrls(plan, urls);
    if (violations.length > 0) {
      return {
        ok: false,
        code: "INVALID_PROVIDER_RESPONSE",
        message: `Tautan provider tidak ada dalam allowlist: ${violations.join(", ")}`,
      };
    }
    return { ok: true, data: { urls, disclaimer: REQUIRED_DISCLAIMER } };
  }

  /** Returns host names that failed the allowlist; fills `urls` for safe ones. */
  private collectAllowlistedUrls(plan: TripPlan, urls: Record<string, string>): string[] {
    const violations: string[] = [];
    const allowed = this.config.handoffAllowedHosts;
    const add = (key: string, url: string | null): void => {
      if (!url) {
        return;
      }
      let host: string;
      try {
        host = new URL(url).hostname;
      } catch {
        violations.push(key);
        return;
      }
      if (allowed.includes(host)) {
        urls[key] = url;
      } else {
        violations.push(`${key}:${host}`);
      }
    };
    add("flight", plan.components.flight.bookingUrl);
    add("makkah", plan.components.makkahHotel?.bookingUrl ?? null);
    add("madinah", plan.components.madinahHotel?.bookingUrl ?? null);
    return violations;
  }

  private async recheckHotel(
    hotel: HotelObservation,
    hotelProvider: ReturnType<typeof activeHotelProvider>,
    now: Date,
  ): Promise<ComponentChange> {
    try {
      const result = await hotelProvider.search({
        providerId: hotel.providerId,
        city: hotel.city,
        checkIn: hotel.checkInLocalDate,
        checkOut: hotel.checkOutLocalDate,
        adults: hotel.adults,
        childrenAges: hotel.childrenAges,
        rooms: hotel.rooms,
        radiusKm: hotel.radiusKm,
        freeCancellationOnly: hotel.freeCancellationOnly,
        currency: "IDR",
        now,
      });
      const best = result.observations[0] ?? null;
      return {
        changed: (best?.normalizedIdrAmountMinor ?? 0) !== (hotel.normalizedIdrAmountMinor ?? 0),
        oldTotalIdrMinor: hotel.normalizedIdrAmountMinor,
        newTotalIdrMinor: best?.normalizedIdrAmountMinor ?? null,
        verificationStatus: best?.verificationStatus ?? null,
      };
    } catch {
      return {
        changed: false,
        oldTotalIdrMinor: hotel.normalizedIdrAmountMinor,
        newTotalIdrMinor: null,
        verificationStatus: "EXPIRED",
      };
    }
  }
}

/** Rebuild a verification candidate from the stored flight observation. */
function candidateFromObservation(plan: TripPlan): FlightCandidate {
  const f = plan.components.flight;
  return {
    id: f.candidateId,
    providerId: f.providerId,
    origin: f.origin ?? f.segments[0]?.fromAirport ?? f.outboundAirport,
    outboundAirport: f.outboundAirport,
    returnAirport: f.returnAirport,
    departureLocalDate: f.departureLocalDate,
    returnLocalDate: f.returnLocalDate,
    pattern: f.pattern,
    stopCount: f.stopCount,
    durationMinutes: f.durationMinutes,
    indicativeTotalMinor: f.originalAmountMinor,
    currency: f.originalCurrency,
    observedAt: f.observedAt,
    expiresAt: f.expiresAt,
    verificationStatus: "INDICATIVE",
    canonicalKey: `handoff|${f.providerOfferId}`,
  };
}
