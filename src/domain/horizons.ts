// Separate horizons (02_LONG_HORIZON_MONITORING.md):
// flight user horizon 365, technical flight horizon 370,
// hotel check-in frontier is provider-specific (mock: 330 days).
import { addDays, daysUntil, todayLocalDate } from "./dates.js";

export const USER_HORIZON_DAYS = 365;
export const TECHNICAL_FLIGHT_HORIZON_DAYS = 370;
export const MOCK_HOTEL_FRONTIER_DAYS = 330;

export function userHorizonEndDate(now: Date): string {
  return addDays(todayLocalDate(now), USER_HORIZON_DAYS);
}

/** Day 366 and beyond are rejected as user input; day 365 is allowed. */
export function isWithinUserHorizon(localDate: string, now: Date): boolean {
  const days = daysUntil(localDate, now);
  return days >= 0 && days <= USER_HORIZON_DAYS;
}

/** Day 370 is representable by the technical planner. */
export function technicalHorizonEndDate(now: Date): string {
  return addDays(todayLocalDate(now), TECHNICAL_FLIGHT_HORIZON_DAYS);
}

export function hotelFrontierEndDate(now: Date, frontierDays: number): string {
  return addDays(todayLocalDate(now), frontierDays);
}

export type HotelCheckInState = "ELIGIBLE" | "NOT_YET_SEARCHABLE";

/**
 * A hotel check-in on the frontier day is eligible; day frontierDays + 1 is
 * NOT_YET_SEARCHABLE and must never be sent to the provider.
 */
export function hotelCheckInState(
  checkIn: string,
  now: Date,
  frontierDays: number,
): HotelCheckInState {
  const days = daysUntil(checkIn, now);
  if (days < 0) {
    // Past check-in dates are never searched by the planner.
    return "NOT_YET_SEARCHABLE";
  }
  return days <= frontierDays ? "ELIGIBLE" : "NOT_YET_SEARCHABLE";
}
