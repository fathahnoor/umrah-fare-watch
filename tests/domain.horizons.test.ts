import { describe, expect, it } from "vitest";
import { addDays, daysUntil, localDateAt, todayLocalDate } from "../src/domain/dates.js";
import {
  USER_HORIZON_DAYS,
  TECHNICAL_FLIGHT_HORIZON_DAYS,
  MOCK_HOTEL_FRONTIER_DAYS,
  hotelCheckInState,
  isWithinUserHorizon,
  userHorizonEndDate,
  technicalHorizonEndDate,
  hotelFrontierEndDate,
} from "../src/domain/horizons.js";
import { TEST_NOW } from "./helpers.js";

describe("horizons (COVER-01..08)", () => {
  it("COVER-01 flight day 364 can be represented", () => {
    const day364 = addDays(todayLocalDate(TEST_NOW), 364);
    expect(isWithinUserHorizon(day364, TEST_NOW)).toBe(true);
  });

  it("COVER-02 flight day 366 is outside the user horizon", () => {
    const day366 = addDays(todayLocalDate(TEST_NOW), 366);
    expect(isWithinUserHorizon(day366, TEST_NOW)).toBe(false);
  });

  it("COVER-03 the technical planner represents day 370", () => {
    const techEnd = technicalHorizonEndDate(TEST_NOW);
    expect(daysUntil(techEnd, TEST_NOW)).toBe(TECHNICAL_FLIGHT_HORIZON_DAYS);
  });

  it("COVER-04 hotel day 330 is eligible for a 330-day frontier", () => {
    const frontier = hotelFrontierEndDate(TEST_NOW, MOCK_HOTEL_FRONTIER_DAYS);
    expect(daysUntil(frontier, TEST_NOW)).toBe(330);
    expect(hotelCheckInState(frontier, TEST_NOW, 330)).toBe("ELIGIBLE");
  });

  it("COVER-05 hotel day 331 is NOT_YET_SEARCHABLE and never called", () => {
    const day331 = addDays(hotelFrontierEndDate(TEST_NOW, 330), 1);
    expect(daysUntil(day331, TEST_NOW)).toBe(331);
    expect(hotelCheckInState(day331, TEST_NOW, 330)).toBe("NOT_YET_SEARCHABLE");
  });

  it("past check-in dates are never searchable", () => {
    const past = addDays(todayLocalDate(TEST_NOW), -2);
    expect(hotelCheckInState(past, TEST_NOW, 330)).toBe("NOT_YET_SEARCHABLE");
  });

  it("user horizon end equals 365 days", () => {
    expect(daysUntil(userHorizonEndDate(TEST_NOW), TEST_NOW)).toBe(USER_HORIZON_DAYS);
  });

  it("localDateAt derives Saudi-local arrival date for an overnight flight", () => {
    // CGK 2029-12-05T20:30 +420 => UTC 13:30; +575 min => UTC 23:05; +180 => 02:05 next day
    expect(localDateAt("2029-12-05T13:30:00.000Z", 420)).toBe("2029-12-05");
    expect(localDateAt("2029-12-05T23:05:00.000Z", 180)).toBe("2029-12-06");
  });
});
