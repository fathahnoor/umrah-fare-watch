import { describe, expect, it } from "vitest";
import {
  alertEventFingerprint,
  cooldownExpired,
  DEFAULT_ALERT_COOLDOWN_HOURS,
  materialDropPercent,
  mayBypassCooldown,
  normalizeWatchlistConstraints,
} from "../src/domain/alerts.js";

describe("alerts (ALERT-01..07)", () => {
  it("ALERT-01 constraints normalize deterministically with sorted child ages", () => {
    const a = normalizeWatchlistConstraints({
      type: "COMPLETE_TRIP",
      city: null,
      checkIn: null,
      checkOut: null,
      adults: 2,
      childrenAges: [6, 3],
      rooms: 1,
      radiusKm: 5,
      freeCancellationOnly: false,
      currency: "IDR",
    });
    const b = normalizeWatchlistConstraints({
      type: "COMPLETE_TRIP",
      city: null,
      checkIn: null,
      checkOut: null,
      adults: 2,
      childrenAges: [3, 6],
      rooms: 1,
      radiusKm: 5,
      freeCancellationOnly: false,
      currency: "IDR",
    });
    expect(a).toBe(b);
  });

  it("ALERT-04 default cooldown is 24 hours", () => {
    expect(DEFAULT_ALERT_COOLDOWN_HOURS).toBe(24);
    const now = new Date("2029-06-02T08:00:00Z");
    expect(cooldownExpired("2029-06-01T09:00:00Z", now, 24)).toBe(false);
    expect(cooldownExpired("2029-06-01T07:00:00Z", now, 24)).toBe(true);
    expect(cooldownExpired(null, now, 24)).toBe(true);
  });

  it("ALERT-05 a drop of at least 3 percent can bypass the cooldown", () => {
    expect(materialDropPercent(10_000_000, 9_600_000)).toBe(4);
    expect(mayBypassCooldown(10_000_000, 9_600_000, 3)).toBe(true);
    expect(mayBypassCooldown(10_000_000, 9_800_000, 3)).toBe(false);
  });

  it("ALERT-05 the 3 percent boundary uses the material drop formula", () => {
    // 3 percent of 10,000,000 is exactly 300,000.
    expect(materialDropPercent(10_000_000, 9_700_000)).toBe(3);
    expect(mayBypassCooldown(10_000_000, 9_700_000, 3)).toBe(true);
  });

  it("ALERT-06 non-comparable changes never bypass automatically", () => {
    // A rise in price is not a material drop and must not bypass the cooldown.
    expect(mayBypassCooldown(10_000_000, 10_500_000, 3)).toBe(false);
    expect(materialDropPercent(10_000_000, 10_500_000)).toBeLessThan(0);
  });

  it("ALERT-07 unique fingerprints prevent duplicates; changes create new ones", () => {
    const base = {
      watchlistId: "w1",
      watchlistVersion: 1,
      comparablePlanKey: "key|1",
      priceBucketMinor: 9_700_000,
      verificationClass: "LIVE_VERIFIED" as const,
      thresholdRuleVersion: 1,
    };
    expect(alertEventFingerprint(base)).toBe(alertEventFingerprint({ ...base }));
    expect(alertEventFingerprint({ ...base, priceBucketMinor: 9_500_000 })).not.toBe(
      alertEventFingerprint(base),
    );
    expect(alertEventFingerprint({ ...base, verificationClass: "INDICATIVE" })).not.toBe(
      alertEventFingerprint(base),
    );
  });

  it("rejects non-integer or non-positive totals for the drop formula", () => {
    expect(() => materialDropPercent(10_000_000.5, 9_000_000)).toThrow();
    expect(() => materialDropPercent(0, 0)).toThrow();
  });
});
