# 🕋 Umrah Fare Watch

Web app untuk menemukan biaya perjalanan Umrah mandiri yang termurah: tiket pesawat untuk semua penumpang, hotel Makkah (semua kamar, semua malam), dan hotel Madinah (semua kamar, semua malam), dijumlahkan sebagai satu total biaya dalam IDR.

Aplikasi ini dibangun terbuka untuk membantu tiga kelompok sekaligus: **calon jamaah** yang ingin berangkat mandiri dengan biaya terkendali, **pengusaha travel dan KBIHU** yang ingin membandingkan harga komponen untuk menyusun paket yang kompetitif, serta **developer** yang ingin ikut membangun. Semua diskusi, saran, dan kontribusi silakan lewat repo ini (lihat bagian Berkontribusi di bawah).

Spesifikasi kanonis berada di `umrah-fare-watch-spec/`. Dokumen tersebut adalah kontrak produk; folder ini adalah implementasinya.

## Status (per 13 Agustus 2026)

- **Mode data:** aplikasi otomatis memilih sumber data. Tanpa kredensial ia berjalan di mode demo (mock deterministik, tanpa jaringan); begitu kredensial provider real tersedia di server, ia beralih ke data live.
- **Provider live aktif:** **Google Flights** (tiket) dan **Google Hotels** (hotel Makkah/Madinah) melalui SerpAPI, dengan konversi FX live ke IDR. Provider lain tersedia sebagai adapter (Travelpayouts/Aviasales, Duffel) dan aktif sesuai kondisi pasar masing-masing.
- **Fitur inti:** pencarian kombinasi, kalender harga, kalender cakupan per kota, watchlist + alert, dan alur lanjut-booking aman (detail di seksi Fitur).
- **Kualitas:** release gate otomatis (`npm run release-gate`) yang menjalankan typecheck, lint, test, build, smoke test, dan validasi spesifikasi. Data provider real hanya ditampilkan setelah smoke test server-side untuk rute Indonesia lulus, demi menjaga keterbukaan data.

Catatan: angka fitur dan milestone berubah cepat; detail terkini ada di `umrah-fare-watch-spec/progress.md`, bukan di README ini.

## Fitur

- ✈️ **Cari kombinasi termurah:** tiket pesawat untuk semua penumpang, hotel Makkah, dan hotel Madinah dalam satu total biaya dalam IDR.
- 🏨 **Status hotel per kota:** ketersediaan Makkah (MK) dan Madinah (MD) ditampilkan terpisah, sehingga Anda bisa memutuskan lanjut memproses atau menunggu.
- 📅 **Kalender harga 365 hari:** bandingkan total lengkap untuk setiap tanggal keberangkatan dalam satu pindai.
- 📊 **Kalender cakupan berwarna:** tiap tanggal menampilkan status flight dan hotel per kota, dengan warna kartu sesuai kondisi data.
- 🔔 **Pantauan harga:** simpan kombinasi perjalanan dan terima alert in-app saat total turun atau mencapai budget Anda.
- 🔒 **Lanjut-booking aman:** harga diverifikasi ulang sebelum membuka situs provider.

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000 (mode demo tanpa kredensial)
npm run typecheck
npm run lint
npm test
npm run smoke        # end-to-end tanpa kredensial
npm run build        # tsc + copy UI ke dist
npm run release-gate # semua check berurutan: typecheck, lint, test, build, smoke, spec validator
npm start            # jalankan hasil build (dist/api/server.js)
```

Mode live diaktifkan dengan menyediakan kredensial di server (lihat `.env.example`; token tidak pernah di-commit). Tanpa kredensial, semua fitur tetap bisa dicoba di mode demo.

## Menjalankan di server (bukan github.io)

GitHub Pages hanya menyajikan file statis; aplikasi ini membutuhkan backend Node.js (API Express, SQLite, session auth, dan background worker), sehingga perlu server sendiri:

- **PaaS (Railway, Render, Fly.io):** push repo GitHub, set `NODE_VERSION` >= 22.5, run `npm install && npm run build && npm start`. Catatan: disk SQLite di PaaS bersifat ephemeral saat redeploy; gunakan volume persistent atau DB eksternal jika data pantauan harus bertahan.
- **VPS kecil (DigitalOcean, Hetzner, dan sejenisnya):** kontrol penuh; SQLite permanen di disk; jalankan dengan PM2 atau systemd. Direkomendasikan saat provider real aktif karena API key wajib tersimpan server-side.
- **Envvars penting:** `PORT`, `DB_PATH`, `MOCK_MODE`, `SESSION_TTL_DAYS`, `WATCHLIST_WORKER_INTERVAL_MS`, `COVERAGE_WORKER_INTERVAL_MS`, dan kredensial provider. Lihat `.env.example`.
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
scripts/        smoke tests, copy-ui.mjs, release-gate.ts
```

## Keputusan teknis (ringkas)

- **Runtime schema:** zod di boundary adapter; payload provider yang invalid ditolak dan tidak disimpan.
- **Uang:** integer minor units; normalisasi deterministik half-up; nilai hilang tidak pernah menjadi nol.
- **Tanggal:** local date ISO; datetime Saudi diturunkan dari UTC instant + offset eksplisit.
- **Horizon:** user 365 hari, technical flight 370, frontier hotel 330.
- **Persistensi:** node:sqlite bawaan Node (>= 22.5), append-only observasi, dedup key unik, constraint non-negatif dan checkout >= check-in.

## Berkontribusi

Repo ini terbuka untuk siapa saja yang peduli pada keterbukaan biaya Umrah:

- **Developer:** buka issue untuk bug/ide, atau kirim pull request. Mulai dari `umrah-fare-watch-spec/10_FREEBUFF_MASTER_PROMPT.md` dan `12_HANDOFF_TO_FREEBUFF.md` untuk konteks, lalu pastikan `npm run release-gate` lulus sebelum mengajukan PR.
- **Pengusaha travel dan KBIHU:** Anda tahu kebutuhan nyata jamaah dan seluk-beluk paket. Saran fitur, data, atau koreksi asumsi bisnis sangat berharga - buka issue dengan label diskusi atau tulis di bagian saran.
- **Mantan jamaah haji/umrah:** ceritakan pengalaman nyata (biaya aktual, muslihat harga, hal yang baru disadari setelah berangkat) lewat issue "Pengalaman Jamaah". Ini membantu aplikasi menampilkan peringatan dan konteks yang jujur.
- **Calon jamaah:** usulkan hal-hal yang Anda butuhkan saat merencanakan keberangkatan mandiri - fitur, cara tampilan harga, atau pertanyaan yang sering membuat bingung.

Panduan singkat: gunakan bahasa Indonesia, jelaskan masalah dan harapan dengan jelas, dan sertakan contoh data bila relevan (tanpa data pribadi sensitif). Semua saran ditanggapi, tidak semua langsung dikerjakan - prioritas mengikuti spesifikasi dan kebutuhan mayoritas pengguna.

## Disclaimer

Harga yang ditampilkan hanya mencakup tiket pesawat serta hotel Makkah dan Madinah, belum termasuk berbagai kebutuhan lain dalam perjalanan umrah, antara lain:

- Visa
- Transportasi darat antarkota (bus atau kereta)
- Transportasi dalam kota
- Makanan (misalnya 3x makan sehari)
- Jasa muthawif atau pembimbing ibadah
- Tiket ziarah
- Bagasi atau biaya tambahan yang tidak dinyatakan provider
- Asuransi
- Pengeluaran pribadi

Harga dan ketersediaan dapat berubah. Hasil membandingkan provider yang aktif saat data diambil, bukan seluruh penawaran di internet. Periksa kembali total, syarat refund, detail reservasi hotel, persyaratan visa, dan kebijakan provider sebelum booking. Mode demo memakai data sintetis.
