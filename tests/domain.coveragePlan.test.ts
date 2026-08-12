import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";
import {
  deterministicJitterMs,
  flightCoveragePlan,
  flightTierForOffset,
  isCoverageDue,
  tierIntervalHours,
} from "../src/domain/coveragePlan.js";
import { TEST_NOW } from "./helpers.js";

const config = loadConfig({ MOCK_MODE: "true" });

describe("flight tier cadence (02_LONG_HORIZON_MONITORING.md section 5)", () => {
  it("maps offsets to tiers at the exact boundaries", () => {
    expect(flightTierForOffset(1, config)).toBe("A");
    expect(flightTierForOffset(90, config)).toBe("A");
    expect(flightTierForOffset(91, config)).toBe("B");
    expect(flightTierForOffset(210, config)).toBe("B");
    expect(flightTierForOffset(211, config)).toBe("C");
    expect(flightTierForOffset(370, config)).toBe("C");
  });

  it("uses the configurable 24/48/84 hour defaults", () => {
    expect(tierIntervalHours("A", config)).toBe(24);
    expect(tierIntervalHours("B", config)).toBe(48);
    expect(tierIntervalHours("C", config)).toBe(84);
  });

  it("builds a 370-day technical plan starting tomorrow", () => {
    const plan = flightCoveragePlan(TEST_NOW, config);
    expect(plan.length).toBe(370);
    expect(plan[0]?.offsetDays).toBe(1);
    expect(plan[369]?.offsetDays).toBe(370);
    // First 90 entries are Tier A, next 120 are Tier B, rest are Tier C.
    expect(plan.filter((e) => e.tier === "A").length).toBe(90);
    expect(plan.filter((e) => e.tier === "B").length).toBe(120);
    expect(plan.filter((e) => e.tier === "C").length).toBe(160);
  });

  it("jitter is deterministic and bounded by 15% of the interval", () => {
    const a = deterministicJitterMs("flight|2029-06-02", 24);
    const b = deterministicJitterMs("flight|2029-06-02", 24);
    const c = deterministicJitterMs("flight|2029-06-03", 24);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(24 * 3_600_000 * 0.15);
  });

  it("coverage is due when never attempted or past nextEligibleAt", () => {
    expect(isCoverageDue(null, null, TEST_NOW)).toBe(true);
    const past = new Date(TEST_NOW.getTime() - 1).toISOString();
    expect(isCoverageDue(past, past, TEST_NOW)).toBe(true);
    const future = new Date(TEST_NOW.getTime() + 3_600_000).toISOString();
    expect(isCoverageDue(future, future, TEST_NOW)).toBe(false);
  });
});
