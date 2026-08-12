# Umrah Fare Watch

Web app untuk menemukan biaya perjalanan Umrah mandiri yang termurah yang ditemukan dari provider aktif: tiket pesawat untuk semua penumpang, hotel Makkah (semua kamar, semua malam), dan hotel Madinah (semua kamar, semua malam), dijumlahkan sebagai satu total transparan dalam IDR.

Spesifikasi kanonis berada di `umrah-fare-watch-spec/`. Dokumen tersebut adalah kontrak produk; folder ini adalah implementasinya.

## Status

- **Mode berjalan:** MOCK (deterministik, tanpa kredensial, tanpa jaringan). Integrasi provider real (Travelpayouts/Aviasales, Duffel Flights, Duffel Stays, Booking.com Demand API) belum diaktifkan karena akses resmi belum dikonfirmasi, sesuai aturan provider pada spesifikasi.
- **Milestone selesai:**
  - M0: Scaffold audit dan baseline (stack: TypeScript strict, Express 5, node:sqlite, Vitest, vanilla HTML/CSS/JS client).
  - M1: Domain types, mock flight/hotel providers, Trip Composer, store append-only, search API.
  - M2: UI pencarian responsif dengan headline `Cari Biaya Umrah Termurah`, progress, hasil, partial section, disclaimer, reminder reservasi hotel.
  - M3: 113 test Vitest acceptance untuk validation, dates, money, ranking, coverage, providers, composer, alerts, API integration, auth, watchlist, coverage scheduler, dan kalender 365 hari.
  - UX: kalender harga termurah (cheapest-date grid), sort/filter hasil, konteks harga jujur, kalender cakupan flight/hotel 365 hari.
  - M4 (slice): watchlist COMPLETE_TRIP + FLIGHT + HOTEL dengan alert in-app (budget threshold, material drop, cooldown, dedup fingerprint), akun pengguna dengan session scrypt, scheduler coverage tier A/B/C, dan worker berkala.
- **Belum dikerjakan:** M5-M7 (provider real, menunggu akses resmi), M8 (booking handoff produksi). Release gate M9 sudah tersedia sebagai `npm run release-gate`. Lihat `umrah-fare-watch-spec/08_IMPLEMENTATION_PLAN.md`.

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000 (mock mode)
npm run typecheck
npm run lint
npm test
npm run smoke        # mock end-to-end tanpa kredensial
npm run build        # tsc + copy UI ke dist
npm run release-gate # semua check berurutan: typecheck, lint, test, build, smoke, spec validator
npm start            # jalankan hasil build (dist/api/server.js)
```

## Menjalankan di server (bukan github.io)

GitHub Pages hanya menyajikan file statis; aplikasi ini membutuhkan backend Node.js (API Express, SQLite, auth session, dan background worker), sehingga perlu server sendiri:

- **PaaS (Railway, Render, Fly.io):** push repo GitHub, set `NODE_VERSION` >= 22.5, run `npm install && npm run build && npm start`. Catatan: disk SQLite di PaaS bersifat ephemeral saat redeploy; gunakan volume persistent atau DB eksternal jika data pantauan harus bertahan.
- **VPS kecil (DigitalOcean, Hetzner, dan sejenisnya):** kontrol penuh; SQLite permanen di disk; jalankan dengan PM2 atau systemd. Direkomendasikan saat provider real aktif karena API key wajib tersimpan server-side.
- **Envvars penting:** `PORT`, `DB_PATH`, `MOCK_MODE`, `SESSION_TTL_DAYS`, `WATCHLIST_WORKER_INTERVAL_MS`, `COVERAGE_WORKER_INTERVAL_MS`. Lihat `.env.example`.
- Kredensial provider real hanya dimuat dari secret manager server-side, tidak pernah dari frontend atau file env yang di-commit.

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
