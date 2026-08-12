import { describe, expect, it } from "vitest";
import { addDays } from "../src/domain/dates.js";
import { TEST_NOW, baseInput, withServer } from "./helpers.js";

describe("coverage scheduler + calendar (02_LONG_HORIZON_MONITORING)", () => {
  it("POST /api/coverage/scan covers the full rolling flight plan and marks the hotel frontier", async () => {
    await withServer(TEST_NOW, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/coverage/scan`, { method: "POST" });
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.flightScanned).toBe(370);
      expect(body.flightRecorded).toBe(370);
      // Days 331..370 (40 dates) x 2 cities beyond the 330-day frontier.
      expect(body.hotelFrontierMarked).toBe(80);
    });
  });

  it("GET /api/coverage/calendar exposes per-date flight and hotel states", async () => {
    await withServer(TEST_NOW, async (baseUrl) => {
      await fetch(`${baseUrl}/api/coverage/scan`, { method: "POST" });
      const res = await fetch(`${baseUrl}/api/coverage/calendar?start=2029-06-02&end=2030-06-01`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.days.length).toBe(365);
      expect(body.hotelFrontierDate).toBe("2030-04-27");

      const day1 = body.days.find((d: { date: string }) => d.date === "2029-06-02");
      expect(day1.flight).toBe("HAS_RESULT");
      // No exact hotel search has run: within the frontier it stays NOT_SCANNED.
      expect(day1.hotel).toBe("NOT_SCANNED");

      const day331 = body.days.find((d: { date: string }) => d.date === "2030-04-28");
      expect(day331.hotel).toBe("NOT_YET_SEARCHABLE");
      const day364 = body.days.find((d: { date: string }) => d.date === "2030-06-01");
      expect(day364.flight).toBe("HAS_RESULT");
      expect(day364.hotel).toBe("NOT_YET_SEARCHABLE");
    });
  });

  it("a user search records HAS_RESULT hotel coverage for the derived check-in date", async () => {
    await withServer(TEST_NOW, async (baseUrl) => {
      const input = baseInput({ departureStart: "2029-12-01", departureEnd: "2029-12-01" });
      const searchRes = await fetch(`${baseUrl}/api/search/trip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      expect(searchRes.status).toBe(200);
      const body = (await searchRes.json()) as any;
      const plan = body.results[0] as any;
      const checkIn = plan.dates.makkahCheckIn as string;

      const calRes = await fetch(`${baseUrl}/api/coverage/calendar?start=2029-12-01&end=2029-12-20`);
      const cal = (await calRes.json()) as any;
      const day = cal.days.find((d: { date: string }) => d.date === checkIn);
      expect(day.hotel).toBe("HAS_RESULT");
    });
  });

  it("beyond-frontier check-ins are never recorded as NO_RESULT", async () => {
    await withServer(TEST_NOW, async (baseUrl) => {
      const input = baseInput({ departureStart: "2030-04-27", departureEnd: "2030-04-27" });
      await fetch(`${baseUrl}/api/search/trip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const calRes = await fetch(`${baseUrl}/api/coverage/calendar?start=2030-04-28&end=2030-04-29`);
      const cal = (await calRes.json()) as any;
      for (const day of cal.days) {
        expect(day.hotel).toBe("NOT_YET_SEARCHABLE");
      }
    });
  });

  it("calendar supports explicit windows and caps months", async () => {
    await withServer(TEST_NOW, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/coverage/calendar?months=2`);
      const body = (await res.json()) as any;
      expect(body.start).toBe("2029-06-01");
      expect(body.end).toBe("2029-08-01");
      expect(body.days.length).toBe(62);
    });
  });
});
