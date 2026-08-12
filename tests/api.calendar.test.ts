import { describe, expect, it } from "vitest";
import { baseInput, TEST_NOW, withServer } from "./helpers.js";

describe("API cheapest-date calendar (mock mode)", () => {
  it("POST /api/search/calendar scans every date and picks the cheapest COMPLETE total", async () => {
    await withServer(TEST_NOW, async (baseUrl) => {
      const input = baseInput({
        departureStart: "2029-12-01",
        departureEnd: "2029-12-07",
      });
      const res = await fetch(`${baseUrl}/api/search/calendar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.scanWindow.start).toBe("2029-12-01");
      expect(body.scanWindow.end).toBe("2029-12-07");
      expect(body.scanWindow.daysScanned).toBe(7);
      expect(body.days.length).toBe(7);

      const dates = body.days.map((d: { departureDate: string }) => d.departureDate);
      expect(dates).toEqual([
        "2029-12-01", "2029-12-02", "2029-12-03",
        "2029-12-04", "2029-12-05", "2029-12-06", "2029-12-07",
      ]);
      for (const day of body.days) {
        expect(day.hasComplete).toBe(true);
        expect(day.cheapestTotalIdrMinor).toBeGreaterThan(0);
      }

      // cheapestDate must equal the minimum total across scanned days.
      const minDay = body.days.reduce(
        (min: any, d: any) => (d.cheapestTotalIdrMinor < min.cheapestTotalIdrMinor ? d : min),
        body.days[0],
      );
      expect(body.cheapestDate).toBe(minDay.departureDate);
      expect(body.cheapestTotalIdrMinor).toBe(minDay.cheapestTotalIdrMinor);
      expect(body.disclaimer).toContain("Harga dan ketersediaan dapat berubah");
    });
  });

  it("calendar totals match a direct single-day search for the same date", async () => {
    await withServer(TEST_NOW, async (baseUrl) => {
      const target = "2029-12-05";
      const calendarRes = await fetch(`${baseUrl}/api/search/calendar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(baseInput({ departureStart: "2029-12-05", departureEnd: "2029-12-05" })),
      });
      const calendar = (await calendarRes.json()) as any;
      const day = calendar.days.find((d: { departureDate: string }) => d.departureDate === target);
      expect(day).toBeDefined();

      const directRes = await fetch(`${baseUrl}/api/search/trip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(baseInput({ departureStart: target, departureEnd: target })),
      });
      const direct = (await directRes.json()) as any;
      expect(direct.results[0]?.tripTotalIdrMinor).toBe(day.cheapestTotalIdrMinor);
    });
  });

  it("honors an explicit days limit and caps the scan window", async () => {
    await withServer(TEST_NOW, async (baseUrl) => {
      const input = baseInput({
        departureStart: "2029-12-01",
        departureEnd: "2029-12-15",
        days: 3,
      } as any);
      const res = await fetch(`${baseUrl}/api/search/calendar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.scanWindow.requestedDays).toBe(3);
      expect(body.scanWindow.daysScanned).toBe(3);
      expect(body.scanWindow.end).toBe("2029-12-03");
    });
  });

  it("invalid input returns 400 with VALIDATION_ERROR", async () => {
    await withServer(TEST_NOW, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/search/calendar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ origins: [], adults: 0 }),
      });
      expect(res.status).toBe(400);
      const body = (await res.json()) as any;
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(body.errors.length).toBeGreaterThan(0);
    });
  });
});
