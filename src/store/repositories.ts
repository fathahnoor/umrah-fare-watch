// Append-only observation and plan persistence. Recalculation never rewrites
// a stored observation; it creates a new versioned plan row.
import type { DatabaseSync } from "node:sqlite";
import { canonicalHotelSearchKey } from "../domain/canonical.js";
import type { FlightObservation, HotelObservation, TripPlan } from "../domain/types.js";

export interface ObservationStore {
  saveFlightObservation(obs: FlightObservation): void;
  saveHotelObservation(obs: HotelObservation): void;
  saveTripPlan(plan: TripPlan): void;
  getTripPlan(id: string): TripPlan | null;
  close(): void;
}

export class SqliteStore implements ObservationStore {
  private db: DatabaseSync;

  constructor(db: DatabaseSync) {
    this.db = db;
    this.db.prepare(
      `INSERT INTO flight_observations (
        id, provider_id, provider_offer_id, origin, outbound_airport, return_airport,
        departure_local_date, return_local_date, pattern, normalized_idr_amount_minor,
        price_completeness, verification_status, observed_at, expires_at, payload
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (provider_id, provider_offer_id, observed_at) DO NOTHING`,
    );
    this.db.prepare(
      `INSERT INTO hotel_observations (
        id, provider_id, provider_offer_id, canonical_key, city, check_in, check_out,
        nights, rooms, normalized_idr_amount_minor, price_completeness,
        verification_status, observed_at, expires_at, payload
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (provider_id, provider_offer_id, observed_at) DO NOTHING`,
    );
    this.db.prepare(
      `INSERT INTO trip_plans (
        id, search_fingerprint, flight_observation_id, makkah_hotel_observation_id,
        madinah_hotel_observation_id, makkah_check_in, makkah_check_out,
        madinah_check_in, madinah_check_out, trip_total_idr_minor,
        price_completeness, trip_plan_status, calculated_at, payload
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (id) DO NOTHING`,
    );
  }

  saveFlightObservation(obs: FlightObservation): void {
    this.db
      .prepare(
        `INSERT INTO flight_observations (
          id, provider_id, provider_offer_id, origin, outbound_airport, return_airport,
          departure_local_date, return_local_date, pattern, normalized_idr_amount_minor,
          price_completeness, verification_status, observed_at, expires_at, payload
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (provider_id, provider_offer_id, observed_at) DO NOTHING`,
      )
      .run(
        obs.id,
        obs.providerId,
        obs.providerOfferId,
        obs.segments[0]?.fromAirport ?? "CGK",
        obs.outboundAirport,
        obs.returnAirport,
        obs.departureLocalDate,
        obs.returnLocalDate,
        obs.pattern,
        obs.normalizedIdrAmountMinor,
        obs.priceCompleteness,
        obs.verificationStatus,
        obs.observedAt,
        obs.expiresAt,
        JSON.stringify(obs),
      );
  }

  saveHotelObservation(obs: HotelObservation): void {
    const key = canonicalHotelSearchKey({
      providerId: obs.providerId,
      city: obs.city,
      checkIn: obs.checkInLocalDate,
      checkOut: obs.checkOutLocalDate,
      adults: obs.adults,
      childrenAges: obs.childrenAges,
      rooms: obs.rooms,
      radiusKm: obs.radiusKm,
      freeCancellationOnly: obs.freeCancellationOnly,
      currency: "IDR",
    });
    this.db
      .prepare(
        `INSERT INTO hotel_observations (
          id, provider_id, provider_offer_id, canonical_key, city, check_in, check_out,
          nights, rooms, normalized_idr_amount_minor, price_completeness,
          verification_status, observed_at, expires_at, payload
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (provider_id, provider_offer_id, observed_at) DO NOTHING`,
      )
      .run(
        obs.id,
        obs.providerId,
        obs.providerOfferId,
        key,
        obs.city,
        obs.checkInLocalDate,
        obs.checkOutLocalDate,
        obs.nights,
        obs.rooms,
        obs.normalizedIdrAmountMinor,
        obs.priceCompleteness,
        obs.verificationStatus,
        obs.observedAt,
        obs.expiresAt,
        JSON.stringify(obs),
      );
  }

  saveTripPlan(plan: TripPlan): void {
    this.db
      .prepare(
        `INSERT INTO trip_plans (
          id, search_fingerprint, flight_observation_id, makkah_hotel_observation_id,
          madinah_hotel_observation_id, makkah_check_in, makkah_check_out,
          madinah_check_in, madinah_check_out, trip_total_idr_minor,
          price_completeness, trip_plan_status, calculated_at, payload
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (id) DO NOTHING`,
      )
      .run(
        plan.id,
        plan.searchFingerprint,
        plan.flightObservationId,
        plan.makkahHotelObservationId,
        plan.madinahHotelObservationId,
        plan.makkahCheckIn,
        plan.makkahCheckOut,
        plan.madinahCheckIn,
        plan.madinahCheckOut,
        plan.tripTotalIdrMinor,
        plan.priceCompleteness,
        plan.tripPlanStatus,
        plan.calculatedAt,
        JSON.stringify(plan),
      );
  }

  getTripPlan(id: string): TripPlan | null {
    const row = this.db
      .prepare("SELECT payload FROM trip_plans WHERE id = ?")
      .get(id) as { payload: string } | undefined;
    return row ? (JSON.parse(row.payload) as TripPlan) : null;
  }

  close(): void {
    this.db.close();
  }
}
