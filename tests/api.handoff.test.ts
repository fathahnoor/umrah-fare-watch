import { describe, expect, it } from "vitest";
import { baseInput, TEST_NOW, withServer } from "./helpers.js";

describe("API M8 booking handoff (mock mode)", () => {
  it("prepare with unknown plan returns 404 NOT_FOUND", async () => {
    await withServer(TEST_NOW, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/handoff/prepare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: "no-such-plan" }),
      });
      expect(res.status).toBe(404);
      const body = (await res.json()) as any;
      expect(body.code).toBe("NOT_FOUND");
      expect(body.retryable).toBe(false);
    });
  });

  it("prepare re-verifies the plan and returns a component change summary", async () => {
    await withServer(TEST_NOW, async (baseUrl) => {
      const planId = await firstPlanId(baseUrl);
      const res = await fetch(`${baseUrl}/api/handoff/prepare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.planId).toBe(planId);
      expect(typeof body.changed).toBe("boolean");
      expect(body.requiresConfirmation).toBe(body.changed);
      expect(body.components).toHaveProperty("flight");
      expect(body.components).toHaveProperty("makkah");
      expect(body.components).toHaveProperty("madinah");
      // Every component was re-checked: either an old/new price or a status.
      for (const key of ["flight", "makkah", "madinah"] as const) {
        expect(typeof body.components[key].changed).toBe("boolean");
        expect(body.components[key]).toHaveProperty("oldTotalIdrMinor");
        expect(body.components[key]).toHaveProperty("newTotalIdrMinor");
      }
      expect(body.verifiedAt).toBeDefined();
      expect(Array.isArray(body.warnings)).toBe(true);
    });
  });

  it("confirm opens only allowlisted provider URLs after price match", async () => {
    await withServer(TEST_NOW, async (baseUrl) => {
      const planId = await firstPlanId(baseUrl);
      const prepared = await fetch(`${baseUrl}/api/handoff/prepare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      }).then((r) => r.json() as Promise<any>);

      // Confirm with the verified total (new when changed, old when stable).
      const confirmPrice = prepared.changed
        ? (prepared.newTotalIdrMinor as number)
        : (prepared.oldTotalIdrMinor as number);
      const res = await fetch(`${baseUrl}/api/handoff/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, confirmPriceIdrMinor: confirmPrice }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.urls).toHaveProperty("flight");
      expect(body.urls).toHaveProperty("makkah");
      expect(body.urls).toHaveProperty("madinah");
      for (const url of Object.values(body.urls)) {
        expect(new URL(url as string).hostname).toBe("mock.example");
      }
      expect(body.disclaimer).toContain("Harga dan ketersediaan dapat berubah");
    });
  });

  it("confirm with a mismatched price returns 409 QUOTE_CHANGED", async () => {
    await withServer(TEST_NOW, async (baseUrl) => {
      const planId = await firstPlanId(baseUrl);
      const prepared = await fetch(`${baseUrl}/api/handoff/prepare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      }).then((r) => r.json() as Promise<any>);

      const base = prepared.changed ? (prepared.newTotalIdrMinor as number) : (prepared.oldTotalIdrMinor as number);
      const res = await fetch(`${baseUrl}/api/handoff/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, confirmPriceIdrMinor: base + 1 }),
      });
      expect(res.status).toBe(409);
      const body = (await res.json()) as any;
      expect(body.code).toBe("QUOTE_CHANGED");
    });
  });

  it("confirm refuses a non-integer confirm price", async () => {
    await withServer(TEST_NOW, async (baseUrl) => {
      const planId = await firstPlanId(baseUrl);
      const res = await fetch(`${baseUrl}/api/handoff/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, confirmPriceIdrMinor: "cheap" }),
      });
      expect(res.status).toBe(409);
      const body = (await res.json()) as any;
      expect(body.code).toBe("QUOTE_CHANGED");
    });
  });
});

async function firstPlanId(baseUrl: string): Promise<string> {
  const res = await fetch(`${baseUrl}/api/search/trip`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(baseInput()),
  });
  expect(res.status).toBe(200);
  const body = (await res.json()) as any;
  expect(body.results.length).toBeGreaterThan(0);
  return (body.results[0] as { id: string }).id;
}
