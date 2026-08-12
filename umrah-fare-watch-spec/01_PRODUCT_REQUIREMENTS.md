# Product Requirements

## 1. Product Summary

Umrah Fare Watch adalah web app pencarian dan pemantauan biaya perjalanan Umrah mandiri. Produk menemukan flight, hotel Makkah, hotel Madinah, dan complete trip termurah yang ditemukan dari provider aktif. Hasil wajib transparan tentang komponen biaya, cakupan sumber, freshness, dan risiko perubahan harga.

## 2. Primary User and Core Job

Pengguna utama adalah calon jamaah Indonesia yang dapat memesan perjalanan secara mandiri atau ingin mempunyai pembanding sebelum memakai agen. Core job:

> Ketika merencanakan Umrah, saya ingin membandingkan flight dan dua hotel sebagai satu total yang lengkap agar saya dapat memilih kombinasi termurah yang masih sesuai tanggal, jumlah tamu, durasi, transit, jarak, dan kebijakan pembatalan saya.

Keputusan sukses dapat dibuat tanpa mengira bahwa harga per orang adalah harga rombongan, tanpa menganggap biaya yang belum diketahui sebagai nol, dan tanpa menganggap provider yang tidak dipindai sebagai tidak memiliki hasil.

## 3. Search Inputs and Validation

Kontrak input kanonis:

```ts
type TripSearchInput = {
  origins: string[];
  departureStart: string;
  departureEnd: string;
  adults: number;
  childrenAges: number[];
  rooms: number;
  makkahNights: number;
  madinahNights: number;
  patterns: ItineraryPattern[];
  cityOrder: "AUTO" | "MAKKAH_FIRST" | "MADINAH_FIRST";
  cabin: CabinClass;
  maxStops?: number;
  maxLayoverMinutes?: number;
  maxTripDurationMinutes?: number;
  makkahRadiusKm: number;
  madinahRadiusKm: number;
  freeCancellationOnly: boolean;
  currency: "IDR";
};
```

Default: `origins = [CGK]`, `adults = 1`, `childrenAges = []`, `rooms = 1`, `makkahNights = 5`, `madinahNights = 4`, `cityOrder = AUTO`, `cabin = economy`, connection diperbolehkan, radius setiap kota 5 km, free cancellation tidak diwajibkan, dan currency IDR.

Validasi server dan client harus konsisten:

- `adults >= rooms` dan minimal satu dewasa.
- `makkahNights >= 1` dan `madinahNights >= 1`.
- Umur setiap anak wajib ada jika anak disertakan.
- Kode origin mengikuti `^[A-Z]{3}$` dan ada pada daftar bandara Indonesia yang dipelihara.
- `departureStart <= departureEnd` dan akhir rentang tidak melebihi horizon user 365 hari.
- rooms, penumpang, radius, dan ukuran rentang tanggal memiliki batas maksimum server-side.
- total malam hotel harus sama dengan malam perjalanan yang diminta.

## 4. Journey Patterns and City Order

```ts
type ItineraryPattern =
  | "ROUNDTRIP_JED"
  | "ROUNDTRIP_MED"
  | "OPENJAW_JED_MED"
  | "OPENJAW_MED_JED";
```

Mode `AUTO` memilih Makkah terlebih dahulu ketika flight tiba di JED dan Madinah terlebih dahulu ketika flight tiba di MED. User dapat memilih `MAKKAH_FIRST` atau `MADINAH_FIRST`. Sistem tidak boleh menambahkan flight antarkota JED dan MED. Transfer darat berada di luar total MVP.

## 5. Hotel Date Derivation

Tanggal hotel wajib berasal dari flight detail dengan datetime lokal Saudi yang valid:

1. tanggal kedatangan outbound menjadi check-in kota pertama;
2. tambahkan jumlah malam kota pertama untuk checkout;
3. tanggal checkout itu menjadi check-in kota kedua agar stay berurutan;
4. tambahkan jumlah malam kota kedua untuk checkout akhir;
5. departure return tidak boleh lebih awal dari checkout akhir.

Jika exact local datetimes belum ada, hotel enrichment menunggu detail flight. Plan boleh tampil sebagai indikatif, tetapi tidak boleh diberi status `LIVE_COMPLETE`.

## 6. Component and Complete Price Semantics

```ts
flightPartyTotalIdr = normalized flight total for all travellers;
makkahStayTotalIdr = normalized room total for all rooms and all Makkah nights;
madinahStayTotalIdr = normalized room total for all rooms and all Madinah nights;
tripTotalIdr = flightPartyTotalIdr + makkahStayTotalIdr + madinahStayTotalIdr;

type PriceCompleteness =
  | "COMPLETE"
  | "PARTIAL_FEES_UNKNOWN"
  | "PARTIAL_FX_MISSING"
  | "COMPONENT_MISSING";
```

Hanya `COMPLETE` yang bersaing pada ranking complete trip utama. Partial plan tampil terpisah dengan label `Mungkin lebih murah, tetapi biaya belum lengkap`. Nilai yang hilang tidak pernah menjadi nol.

Setiap komponen menyimpan original amount, original currency, normalized IDR amount, FX rate, FX timestamp, taxes, mandatory fees, due now, dan due at property bila tersedia. Harga per orang hanya informasi sekunder yang diturunkan dari total rombongan, bukan pengganti total.

`Not included`: ground transfer, visa, makanan yang tidak tercakup rate, bagasi atau fee yang tidak dinyatakan provider, asuransi, dan pengeluaran pribadi. Item yang provider sudah nyatakan termasuk tidak boleh diduplikasi sebagai exclusion.

## 7. Core Features

- Pencarian flight lintas rentang tanggal dan empat pola itinerary.
- Verifikasi flight terpilih untuk memperoleh segmen serta datetime lokal.
- Pencarian hotel exact-date di Makkah dan Madinah berdasarkan occupancy dan radius.
- Komposisi complete trip dari bounded candidate set.
- Breakdown total dan kebijakan rate.
- Kalender harga flight serta status coverage hotel.
- Watchlist `FLIGHT`, `HOTEL`, dan `COMPLETE_TRIP`.
- Alert threshold, cooldown, dan material price drop.
- Redirect ke booking source resmi setelah re-verification, tanpa pemrosesan pembayaran.
- Mock mode deterministik yang mencakup semua alur utama.

## 8. Availability and Verification States

```ts
type AvailabilityState =
  | "NOT_SCANNED"
  | "HAS_RESULT"
  | "NO_RESULT"
  | "NOT_YET_PUBLISHED"
  | "NOT_YET_SEARCHABLE"
  | "PROVIDER_UNAVAILABLE";

type VerificationStatus =
  | "INDICATIVE"
  | "LIVE_VERIFIED"
  | "STALE"
  | "EXPIRED";

type TripPlanStatus =
  | "LIVE_COMPLETE"
  | "INDICATIVE_COMPLETE"
  | "PARTIAL"
  | "STALE"
  | "EXPIRED";
```

`NO_RESULT` hanya dipakai setelah provider aktif berhasil menjawab pencarian kanonis. `NOT_YET_SEARCHABLE` berarti tanggal berada di luar frontier provider, bukan tidak ada hotel. Data lama tetap terlihat sebagai `STALE` ketika refresh gagal.

## 9. Ranking

Urutan ranking complete trip:

1. ketiga komponen ada;
2. `PriceCompleteness = COMPLETE`;
3. offer belum expired dan masih dapat dipakai;
4. `tripTotalIdr` terendah;
5. plan live-verified menang jika selisih total maksimal 2 persen;
6. total stop flight lebih sedikit;
7. durasi flight lebih singkat;
8. hotel refundable menang jika selisih total maksimal 2 persen;
9. observasi lebih baru.

Harga tetap kriteria utama. Constraint seperti stop, layover, radius, cancellation, board type, dan rating diterapkan sebagai filter eksplisit, bukan penalti tersembunyi.

## 10. Watchlists and Alerts

```ts
type WatchlistType = "FLIGHT" | "HOTEL" | "COMPLETE_TRIP";
```

Alert complete trip hanya dibuat ketika semua constraint cocok, semua komponen ada, normalisasi IDR tersedia, completeness `COMPLETE`, seluruh observasi masih fresh, dan total memenuhi threshold. Cooldown default 24 jam. Penurunan minimal 3 persen dapat melewati cooldown. Nilai ini configurable.

## 11. Authentication and Roles

- Guest dapat mencari, melihat hasil, dan menjalankan mock demo.
- User terautentikasi dapat menyimpan watchlist, preferensi, dan kanal alert.
- Admin dapat melihat provider health, usage, scan coverage, dan disabled reason.
- Credential provider hanya berada di server dan tidak pernah dikirim ke client atau log.

MVP tidak membutuhkan marketplace role, agent role, atau akses data paspor.

## 12. MVP Non-Goals

- Booking, pembayaran, refund handling, dan penerbitan tiket.
- Pemrosesan visa, paspor, biometrik, atau data keluarga sensitif.
- Harga transfer darat, kereta, bus, makan, ziarah, dan paket agen.
- Scraping OTA, maskapai, atau hotel.
- Klaim inventori universal atau harga termurah absolut.
- Scoring provider permanen dari komentar sosial.
- Prediksi harga berbasis AI yang tidak mempunyai evaluasi dan bukti.
- Intercity flight buatan untuk memindahkan user antara JED dan MED.

## 13. Community Insight Policy

Diskusi Threads dipakai sebagai masukan kualitatif untuk kebutuhan membandingkan banyak sumber resmi, direct versus transit, open-jaw, promo alert, cancellation, after-sales, konfirmasi reservasi ke hotel, dan pemisahan harga murah dari reliabilitas booking.

Nama provider, contoh harga, tanggal promo, lama refund, pujian, dan kritik pada komentar sosial tidak boleh menjadi fakta produksi atau skor. Integrasi hanya boleh dilakukan melalui API resmi dengan akses dan persyaratan yang dikonfirmasi.

## 14. Required Disclaimer

Harga dan ketersediaan dapat berubah sewaktu-waktu. Hasil adalah termurah yang ditemukan dari provider aktif dan constraint pencarian saat observasi, bukan jaminan termurah di seluruh internet. User harus memverifikasi total, bagasi, pajak, fee, refund, pembayaran di properti, nomor reservasi hotel, persyaratan visa, dan kebijakan provider sebelum booking.
