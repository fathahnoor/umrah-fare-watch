# Long-Horizon Monitoring: Up to One Year

## 1. Requirement

Jamaah umrah mandiri sering merencanakan penerbangan jauh hari. Sistem harus memantau tanggal keberangkatan sampai **365 hari ke depan**.

Gunakan:

```text
USER_HORIZON_DAYS = 365
TECHNICAL_HORIZON_DAYS = 370
```

Buffer 5 hari digunakan agar edge date tidak hilang akibat timezone, month boundaries, atau scheduling delay.

## 2. Important Principle

Provider dan maskapai tidak selalu memiliki inventory untuk seluruh 365 hari pada saat yang sama.

Karena itu:

```text
no fare returned != flight does not exist
```

Sistem wajib memiliki state yang dapat membedakan:

- belum dipindai;
- provider gagal;
- belum ada schedule/fare yang dipublikasikan;
- sudah dipindai tetapi tidak ada hasil;
- fare tersedia.

## 3. Rolling Horizon

Setiap hari:

```text
windowStart = today
windowEnd   = today + 365 days
```

Besok:

```text
windowStart = tomorrow
windowEnd   = tomorrow + 365 days
```

Dengan demikian monitor selalu memiliki jendela satu tahun yang bergerak.

## 4. Month Coverage

365 hari dapat menyentuh 13 calendar months.

Jangan implementasikan:

```text
scan exactly 12 month labels
```

Implementasikan:

```ts
monthsBetween(today, todayPlus365)
```

Agar partial month awal dan partial month terakhir sama-sama tercakup.

## 5. Tiered Scan Cadence

Jangan memindai seluruh 365 hari menggunakan live API setiap hari.

Gunakan tier berdasarkan jarak keberangkatan.

### Tier A: 0-90 days

```text
discovery cadence: daily
live verification: selective, top candidates
```

### Tier B: 91-210 days

```text
discovery cadence: every 2 days
live verification: only exceptional candidates or explicit user request
```

### Tier C: 211-370 days

```text
discovery cadence: 2 times per week
live verification: normally disabled
```

Ketika sebuah tanggal bergerak dari Tier C ke Tier B atau Tier A, scheduler otomatis meningkatkan frekuensi scan.

Cadence harus configurable di system settings.

## 6. Fare Release Frontier

Tambahkan konsep:

```text
availability frontier
```

Artinya tanggal terjauh untuk route/provider tertentu yang saat ini berhasil mengembalikan fare.

Example:

```text
CGK-JED via Provider A
furthestFareDate = 2027-06-22
```

Jika horizon sampai 2027-08-09 dan bulan Juli/Agustus belum memiliki fare, UI dapat menampilkan:

```text
Harga untuk periode ini belum tersedia dari sumber data.
Sistem akan terus memantau.
```

Bukan:

```text
Tidak ada penerbangan.
```

## 7. Availability State

```ts
type AvailabilityState =
  | "NOT_SCANNED"
  | "HAS_FARE"
  | "NO_RESULT"
  | "NOT_YET_PUBLISHED"
  | "PROVIDER_UNAVAILABLE";
```

Suggested interpretation:

### NOT_SCANNED

Belum ada scan attempt untuk date/month bucket.

### HAS_FARE

Setidaknya satu valid fare ditemukan.

### NO_RESULT

Provider merespons valid tetapi tidak mengembalikan fare untuk bucket yang secara umum sudah berada di dalam published frontier.

### NOT_YET_PUBLISHED

Bucket berada lebih jauh daripada published frontier atau provider menunjukkan belum ada inventory.

### PROVIDER_UNAVAILABLE

Scan gagal karena API/provider.

## 8. Storage Granularity

Jangan membuat 365 x origin x destination row kosong setiap hari.

Gunakan month/date coverage records.

Recommended table:

```ts
scanCoverage {
  provider,
  origin,
  destination,
  month,
  status,
  lastAttemptAt,
  lastSuccessAt,
  fareCount,
  furthestFareDate?
}
```

## 9. API Budget Optimization

Priority order for long-horizon scan:

1. active watchlists;
2. origins with highest user interest;
3. months never scanned;
4. months whose cached data expired;
5. dates entering a higher-frequency tier;
6. secondary origins.

Default CGK should always be included.

## 10. Active Watchlist Priority

Jika user membuat watchlist untuk 10-12 bulan ke depan, watchlist tersebut harus meningkatkan prioritas scan untuk origin/month terkait walaupun berada di Tier C.

Tetap gunakan indicative discovery, bukan broad live verification.

## 11. Calendar UX

365-day calendar must show:

```text
Fare available       -> price
No result            -> "Belum ditemukan"
Not yet published    -> "Belum tersedia"
Not scanned          -> "Menunggu scan"
Provider unavailable -> "Sumber sedang bermasalah"
```

## 12. Long-Horizon Alert

Alert dapat dibuat bahkan untuk keberangkatan 365 hari ke depan.

Ketika fare pertama kali muncul dan memenuhi threshold:

```text
trigger alert
```

Jika belum ada fare:

```text
do not send negative alert
```

Optional future alert:

```text
"Fare untuk periode Anda mulai tersedia"
```

## 13. Historical Baseline by Lead Time

Harga 11 bulan sebelum keberangkatan tidak selalu comparable dengan harga 20 hari sebelum keberangkatan.

Simpan:

```ts
leadTimeDays = departureDate - observedAtDate
```

Future deal-scoring dapat membandingkan harga berdasarkan lead-time bucket:

```text
0-30
31-60
61-90
91-180
181-270
271-370
```

MVP boleh memakai historical overall percentile, tetapi field `leadTimeDays` wajib disimpan sejak awal.

## 14. Minimum Acceptance Requirement

Test fixture harus membuktikan:

- fare 364 hari ke depan muncul;
- fare 366 hari ke depan tidak muncul pada user-facing search;
- scan month ke-13 tetap dilakukan bila diperlukan;
- far-future no-data tidak ditampilkan sebagai "tidak ada penerbangan";
- date bucket otomatis berpindah cadence ketika lead time berkurang.
