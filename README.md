# Umrah Fare Watch

Web app untuk menemukan biaya perjalanan Umrah mandiri yang termurah yang ditemukan dari provider aktif: tiket pesawat untuk semua penumpang, hotel Makkah (semua kamar, semua malam), dan hotel Madinah (semua kamar, semua malam), dijumlahkan sebagai satu total transparan dalam IDR.

Spesifikasi kanonis berada di `umrah-fare-watch-spec/`. Dokumen tersebut adalah kontrak produk; folder ini adalah implementasinya.

## Status

- **Mode berjalan:** MOCK (deterministik, tanpa kredensial, tanpa jaringan). Integrasi provider real (Travelpayouts/Aviasales, Duffel Flights, Duffel Stays, Booking.com Demand API) belum diaktifkan karena akses resmi belum dikonfirmasi, sesuai aturan provider pada spesifikasi.
- **Milestone selesai:**
  - M0: Scaffold audit dan baseline (stack: TypeScript strict, Express 5, node:sqlite, Vitest, vanilla HTML/CSS/JS client).
  - M1: Domain types, mock flight/hotel providers, Trip Composer, store append-only, search API.
  - M2: UI pencarian responsif dengan headline `Cari Biaya Umrah Termurah`, progress, hasil, partial section, disclaimer, reminder reservasi hotel.
  - M3 (parsial): test suite acceptance 82 test untuk validation, dates, money, ranking, coverage, providers, composer, alerts, dan API integration.
- **Belum dikerjakan:** M4 penuh (watchlist/alerts worker, scheduler coverage), M5-M7 (provider real), M8 (booking handoff produksi), M9 (release gate penuh). Lihat `umrah-fare-watch-spec/08_IMPLEMENTATION_PLAN.md`.

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000 (mock mode)
npm run typecheck
npm run lint
npm test
npm run smoke        # mock end-to-end tanpa kredensial
npm run build        # tsc + copy UI ke dist
npm start            # jalankan hasil build (dist/api/server.js)
```

## Struktur

```text
src/
  api/          Express app, routes, error mapping, correlation ID
  composer/     Trip Composer: derive city dates, totals, snapshot, summaries
  domain/       types, money, dates, horizons, validation, canonical keys,
                completeness, ranking, alerts (pure functions)
  providers/    contracts, mock flight/hotel, runtime schemas, registry, FX
  services/     search orchestration (bounded discovery + verification +
                canonical hotel search + composition + ranking)
  store/        node:sqlite schema and append-only repositories
  ui/public/    index.html, styles.css, app.js (vanilla, no build step)
tests/          Vitest acceptance tests mapped to 09_ACCEPTANCE_TESTS.md IDs
scripts/        smoke-mock.ts, copy-ui.mjs
```

## Keputusan teknis

- **Runtime schema:** zod di boundary adapter; payload provider yang invalid ditolak dan tidak disimpan (PROV-03).
- **Uang:** integer minor units; IDR minor = rupiah, SAR minor = halala; normalisasi deterministik half-up; nilai hilang tidak pernah menjadi nol.
- **Tanggal:** local date ISO; datetime Saudi diturunkan dari UTC instant + offset eksplisit, tanpa dependensi timezone database host (kasus arrival tengah malam).
- **Horizon:** user 365 hari, technical flight 370, frontier hotel mock 330. Hari 331 untuk provider frontier 330 adalah `NOT_YET_SEARCHABLE`, bukan tanpa hasil.
- **Persistensi:** node:sqlite bawaan Node (>= 22.5), append-only observasi, dedup key unik, constraint non-negatif dan checkout >= check-in.

## Disclaimer

Harga dan ketersediaan dapat berubah. Hasil membandingkan provider yang aktif saat observasi, bukan seluruh penawaran di internet. Verifikasi total, syarat refund, detail reservasi hotel, persyaratan visa, dan kebijakan provider sebelum booking. Mode demo memakai data sintetis.
