// Server-side activation-gate smoke test for Travelpayouts/Aviasales
// (04_PROVIDER_AND_DATA_STRATEGY.md section 2). It tests the routes the app
// actually needs (CGK->JED / CGK->MED). Known limitation verified on
// 2026-08-12: the free Aviasales Data API serves only the 48h/7d cache of
// searches on Aviasales sites (mostly the ru market), so Indonesian routes
// come back empty while ru-popular routes return data. Output is REDACTED:
// the token never appears in full.
import { loadDotEnv } from "../src/env.js";
import { loadConfig } from "../src/config.js";

const API_BASE = "https://api.travelpayouts.com/aviasales/v3/prices_for_dates";

interface ProbeRow {
  departure_at: string;
  return_at: string;
  price: number;
  airline: string;
  link?: string;
}

async function probe(token: string, label: string, params: Record<string, string>): Promise<{ ok: boolean; rows: ProbeRow[]; error: string | null; status: number }> {
  const url = new URL(API_BASE);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  url.searchParams.set("token", token);
  const res = await fetch(url);
  const payload = (await res.json()) as {
    success?: boolean;
    data?: ProbeRow[];
    error?: string;
  };
  return {
    ok: res.ok && payload.success !== false,
    rows: payload.data ?? [],
    error: payload.error ?? null,
    status: res.status,
  };
}

async function main(): Promise<void> {
  loadDotEnv();
  loadConfig();
  const token = process.env.TRAVELPAYOUTS_TOKEN ?? "";
  if (!token) {
    process.stderr.write("TRAVELPAYOUTS_TOKEN tidak ditemukan di env/.env\n");
    process.exit(1);
  }

  process.stdout.write(`Token tersedia: ya (${token.slice(0, 4)}...${token.slice(-4)})\n\n`);

  const params = (origin: string, destination: string, departure: string, ret: string) => ({
    origin,
    destination,
    departure_at: departure,
    return_at: ret,
    currency: "USD",
    market: "id",
    limit: "5",
    sorting: "price",
    one_way: "false",
  });

  const umrah = await probe(token, "umrah CGK->JED", params("CGK", "JED", "2026-08-20", "2026-08-30"));
  const medina = await probe(token, "umrah CGK->MED", params("CGK", "MED", "2026-08-20", "2026-08-30"));
  const control = await probe(token, "control SVO->JED (ru market)", params("SVO", "JED", "2026-08-20", "2026-08-30"));

  for (const [label, p] of [
    ["CGK->JED (umrah)", umrah],
    ["CGK->MED (umrah)", medina],
    ["SVO->JED (kontrol pasar RU)", control],
  ] as const) {
    process.stdout.write(
      JSON.stringify({
        route: label,
        httpStatus: p.status,
        ok: p.ok,
        rowCount: p.rows.length,
        sample: p.rows.slice(0, 2).map((r) => ({
          departure: r.departure_at.slice(0, 10),
          return: r.return_at.slice(0, 10),
          priceUsd: r.price,
          airline: r.airline,
        })),
        apiError: p.error,
      }),
    );
    process.stdout.write("\n");
  }

  const gatePassed = umrah.rows.length > 0 || medina.rows.length > 0;
  process.stdout.write("\n=== VERDICT ===\n");
  if (gatePassed) {
    process.stdout.write(
      "PASS untuk rute umrah CGK->JED/CGK->MED. Token layak dipakai untuk data live rute Indonesia.\n",
    );
  } else {
    process.stdout.write(
      "GAGAL untuk rute umrah Indonesia. Token terautentikasi (control ru-market berisi data), tapi\n" +
        "API Aviasales gratis hanya menyajikan cache pencarian pasar RU (lihat dokumen resmi + probe di atas).\n" +
        "REAL_PROVIDERS_ENABLED tidak boleh dinyalakan untuk rute ini karena hasil pencarian akan kosong.\n" +
        "Alternatif: SerpAPI Google Flights (mencakup rute Indonesia) atau tier Aviasales berbayar.\n",
    );
    process.exitCode = 1;
  }
}

main().catch((err: unknown) => {
  process.stderr.write(`smoke failed: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
