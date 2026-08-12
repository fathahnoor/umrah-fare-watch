# Umrah Fare Watch

## Product Promise

Umrah Fare Watch membantu pengguna menemukan kombinasi tiket pesawat dan hotel termurah yang ditemukan untuk perjalanan Umrah ke Makkah dan Madinah. Produk membandingkan komponen flight, hotel Makkah, hotel Madinah, dan complete trip secara transparan. Produk tidak menjual tiket, memproses pembayaran, atau menjamin bahwa satu hasil adalah yang termurah di seluruh internet.

## Meaning of Cheapest

Termurah berarti harga terendah yang dapat dibandingkan dan ditemukan dari provider yang sedang aktif untuk constraint user, bukan harga termurah absolut di seluruh internet.

Setiap hasil wajib menunjukkan provider yang tercakup, waktu observasi, status verifikasi, kelengkapan biaya, dan batasan data. Istilah termurah yang ditemukan selalu merujuk pada constraint pencarian user dan provider aktif pada saat observasi.

## Core Components

Produk memiliki empat keluaran utama:

1. flight untuk seluruh penumpang;
2. hotel Makkah untuk semua kamar dan semua malam;
3. hotel Madinah untuk semua kamar dan semua malam;
4. complete trip yang menjumlahkan ketiga komponen di atas.

Complete trip hanya masuk ranking utama jika semua komponen tersedia, dapat dinormalisasi ke IDR, dan berstatus `PriceCompleteness = COMPLETE`. Ground transfer, visa, makanan yang tidak termasuk rate, dan pengeluaran pribadi tampil sebagai `Not included` dan tidak boleh diam-diam dimasukkan ke total.

## Default Journey Assumptions

- Bandara asal awal: CGK.
- Bandara Saudi: JED dan MED.
- Penumpang: 1 dewasa, tanpa anak, 1 kamar.
- Durasi: 5 malam Makkah dan 4 malam Madinah.
- Kelas kabin: economy.
- Mata uang perbandingan: IDR.
- Radius hotel: 5 km dari titik referensi yang dikonfigurasi untuk setiap kota.
- Urutan kota otomatis mengikuti bandara kedatangan, tetapi dapat diubah user.
- Transfer darat antara bandara, Makkah, dan Madinah tidak dihitung dalam MVP.

## Supported Journey Patterns

- `ROUNDTRIP_JED`
- `ROUNDTRIP_MED`
- `OPENJAW_JED_MED`
- `OPENJAW_MED_JED`

Sistem tidak boleh mengarang penerbangan antarkota JED dan MED. Tanggal hotel diturunkan dari datetime lokal Saudi pada flight yang sudah diverifikasi.

## Data and Provider Principles

- Mock flight dan hotel provider wajib selalu tersedia agar aplikasi dapat diuji tanpa kredensial.
- Provider real hanya aktif setelah API resmi, hak akses, kredensial, rate limit, caching, atribusi, dan redirect rights dikonfirmasi.
- Jangan scraping halaman OTA atau maskapai.
- Simpan harga asli, mata uang asli, nilai IDR, rate FX, timestamp FX, pajak, fee wajib, due now, dan due at property jika diberikan provider.
- Data yang hilang tidak pernah diubah menjadi nol.
- Observasi historis dipertahankan ketika provider gagal dan diberi status yang benar.
- Komentar komunitas adalah masukan kualitatif, bukan skor permanen provider atau fakta harga produksi.

## Canonical File Order

1. `00_README.md` sebagai start page.
2. `01_PRODUCT_REQUIREMENTS.md` untuk kontrak produk.
3. `02_LONG_HORIZON_MONITORING.md` untuk horizon dan coverage.
4. `03_TECHNICAL_ARCHITECTURE.md` untuk komponen dan alur sistem.
5. `04_PROVIDER_AND_DATA_STRATEGY.md` untuk adapter dan aturan data.
6. `05_DATA_MODEL_AND_BACKEND.md` untuk entitas, endpoint, dan invariant.
7. `06_UI_UX_SPEC.md` untuk pengalaman pengguna.
8. `07_ALERTS_AND_SCHEDULER.md` untuk scan dan notifikasi.
9. `08_IMPLEMENTATION_PLAN.md` untuk milestone pengembangan Freebuff.
10. `09_ACCEPTANCE_TESTS.md` untuk release gate.
11. `10_FREEBUFF_MASTER_PROMPT.md` untuk instruksi model.
12. `11_REFERENCE_SOURCES.md` untuk sumber dan tanggal verifikasi.
13. `12_HANDOFF_TO_FREEBUFF.md` untuk prosedur serah-terima.

Design yang disetujui berada di `docs/superpowers/specs/2026-08-11-umrah-trip-cost-optimizer-design.md`. Dokumen arsip bukan sumber requirement aktif.

## Build and Verification Rule

Freebuff harus membaca file kanonis secara berurutan, menginspeksi scaffold aktual, lalu mengerjakan satu milestone terbatas pada satu waktu. Mock mode harus tetap berfungsi pada setiap checkpoint. Tidak boleh mengklaim integrasi provider live tanpa uji server-side yang berhasil. Sebelum menyatakan selesai, jalankan:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/validate-spec.ps1
```

Release MVP hanya boleh diklaim setelah seluruh Mandatory Release Gate di `09_ACCEPTANCE_TESTS.md` lulus dengan bukti.

## Required Disclaimer

Harga dan ketersediaan dapat berubah. Umrah Fare Watch membandingkan data dari provider yang aktif pada waktu observasi, bukan seluruh penawaran di internet. Verifikasi kembali total, syarat refund, metode pembayaran, detail reservasi hotel, persyaratan visa, dan kebijakan provider sebelum membuat keputusan booking.
