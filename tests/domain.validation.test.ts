import { describe, expect, it } from "vitest";
import { validateTripSearchInput, MAX_ADULTS, MAX_RADIUS_KM } from "../src/domain/validation.js";
import { baseInput, TEST_NOW } from "./helpers.js";

describe("search input validation (INPUT-01..07)", () => {
  it("INPUT-01 defaults are accepted: CGK, 1 adult, 0 children, 1 room, 5+4 nights, economy, IDR", () => {
    const result = validateTripSearchInput(baseInput(), TEST_NOW);
    expect(result.ok).toBe(true);
  });

  it("INPUT-02 requires at least one adult per room", () => {
    const result = validateTripSearchInput(
      baseInput({ adults: 1, rooms: 2 }),
      TEST_NOW,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const messages = result.issues.map((i) => i.message);
      expect(messages.join(" ")).toContain("satu dewasa");
    }
  });

  it("INPUT-03 child ages survive round-trip and invalid ages are rejected", () => {
    const ok = validateTripSearchInput(baseInput({ childrenAges: [6, 9] }), TEST_NOW);
    expect(ok.ok).toBe(true);
    const bad = validateTripSearchInput(baseInput({ childrenAges: [19] }), TEST_NOW);
    expect(bad.ok).toBe(false);
    const missing = validateTripSearchInput(baseInput({ childrenAges: [] }), TEST_NOW);
    expect(missing.ok).toBe(true);
  });

  it("INPUT-04 zero and negative nights are rejected", () => {
    expect(validateTripSearchInput(baseInput({ makkahNights: 0 }), TEST_NOW).ok).toBe(false);
    expect(validateTripSearchInput(baseInput({ madinahNights: -1 }), TEST_NOW).ok).toBe(false);
  });

  it("INPUT-05 rejects invalid IATA format and unsupported codes", () => {
    expect(validateTripSearchInput(baseInput({ origins: ["ABC"] }), TEST_NOW).ok).toBe(false);
    expect(validateTripSearchInput(baseInput({ origins: ["cgk"] }), TEST_NOW).ok).toBe(false);
    expect(validateTripSearchInput(baseInput({ origins: [] }), TEST_NOW).ok).toBe(false);
  });

  it("INPUT-06 departure end beyond day 365 is rejected for user search", () => {
    const end = new Date(TEST_NOW);
    end.setUTCDate(end.getUTCDate() + 366);
    const endDate = end.toISOString().slice(0, 10);
    const result = validateTripSearchInput(
      baseInput({ departureStart: endDate, departureEnd: endDate }),
      TEST_NOW,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => i.code === "OUTSIDE_USER_HORIZON")).toBe(true);
    }
  });

  it("INPUT-07 server-side maximums apply even when client validation is bypassed", () => {
    const result = validateTripSearchInput(
      baseInput({ adults: MAX_ADULTS + 5, makkahRadiusKm: MAX_RADIUS_KM + 10 }),
      TEST_NOW,
    );
    expect(result.ok).toBe(false);
  });

  it("rejects departureStart after departureEnd", () => {
    const result = validateTripSearchInput(
      baseInput({ departureStart: "2029-12-05", departureEnd: "2029-12-01" }),
      TEST_NOW,
    );
    expect(result.ok).toBe(false);
  });

  it("rejects date ranges longer than the server-side maximum", () => {
    const result = validateTripSearchInput(
      baseInput({ departureStart: "2029-12-01", departureEnd: "2030-04-01" }),
      TEST_NOW,
    );
    expect(result.ok).toBe(false);
  });

  it("accepts day 365 exactly", () => {
    const end = new Date(TEST_NOW);
    end.setUTCDate(end.getUTCDate() + 365);
    const endDate = end.toISOString().slice(0, 10);
    const result = validateTripSearchInput(
      baseInput({ departureStart: endDate, departureEnd: endDate }),
      TEST_NOW,
    );
    expect(result.ok).toBe(true);
  });
});
