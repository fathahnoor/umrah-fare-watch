// Server-side activation-gate smoke test for SerpAPI Google Flights/Hotels
// (04_PROVIDER_AND_DATA_STRATEGY.md section 2). Tests the exact routes the app
// needs: CGK->JED flights and Makkah hotels. Output is REDACTED: the API key
// never appears.
import { loadDotEnv } from "../src/env.js";
import { loadConfig } from "../src/config.js";

const BASE = "https://serpapi.com/search.json";

async function probe(apiKey: string, label: string, params: Record<string, string | number>): Promise<void> {
  const url = new URL(BASE);
  url.searchParams.set("api_key", apiKey);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }
  const started = Date.now();
  const res = await fetch(url);
  const elapsedMs = Date.now() - started;
  const payload = (await res.json()) as {
    search_metadata?: { status?: string; total_time_taken?: number };
    best_flights?: Array<{ price?: number; flights?: Array<{ airline?: string; flight_number?: string }> }>;
    other_flights?: Array<{ price?: number; flights?: Array<{ airline?: string; flight_number?: string }> }>;
    properties?: Array<{ name?: string; price?: { current_price?: { amount?: number; currency?: string } } }>;
    error?: string;
    search_information?: { total_results?: number };
  };
  const flights = [...(payload.best_flights ?? []), ...(payload.other_flights ?? [])];
  const props = payload.properties ?? [];
  process.stdout.write(
    JSON.stringify(
      {
        label,
        httpStatus: res.status,
        status: payload.search_metadata?.status ?? null,
        error: payload.error ?? null,
        flightCount: flights.length,
        sampleFlights: flights.slice(0, 2).map((f) => ({
          priceUsd: f.price,
          airline: f.flights?.[0]?.airline,
          flightNumber: f.flights?.[0]?.flight_number,
        })),
        hotelCount: props.length,
        sampleHotels: props.slice(0, 2).map((h) => ({
          name: h.name,
          priceUsd: h.price?.current_price?.amount,
          currency: h.price?.current_price?.currency,
        })),
        elapsedMs,
      },
      null,
      1,
    ),
  );
  process.stdout.write("\n");
}

async function main(): Promise<void> {
  loadDotEnv();
  loadConfig();
  const apiKey = process.env.SERPAPI_API_KEY ?? "";
  if (!apiKey) {
    process.stderr.write("SERPAPI_API_KEY tidak ditemukan di env/.env\n");
    process.exit(1);
  }
  process.stdout.write(`API key tersedia: ya (${apiKey.slice(0, 4)}...${apiKey.slice(-4)})\n\n`);

  await probe(apiKey, "flight CGK->JED round trip", {
    engine: "google_flights",
    departure_id: "CGK",
    arrival_id: "JED",
    outbound_date: "2026-09-15",
    return_date: "2026-09-25",
    type: "1",
    currency: "USD",
    hl: "en",
    gl: "id",
    adults: 1,
  });

  await probe(apiKey, "hotel Makkah", {
    engine: "google_hotels",
    q: "Hotels in Makkah",
    check_in_date: "2026-09-16",
    check_out_date: "2026-09-21",
    adults: 1,
    currency: "USD",
    gl: "id",
    hl: "en",
    latitude: 21.3891,
    longitude: 39.8579,
  });
}

main().catch((err: unknown) => {
  process.stderr.write(`smoke failed: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
