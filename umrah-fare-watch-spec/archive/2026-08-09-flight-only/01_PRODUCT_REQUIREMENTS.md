# Product Requirements

## 1. Product Summary

**Umrah Fare Watch** adalah web app untuk menemukan dan memantau tiket penerbangan termurah bagi jamaah umrah mandiri dari Indonesia ke Arab Saudi.

Aplikasi mengutamakan fleksibilitas:

- origin dapat CGK atau airport Indonesia lain;
- destination dapat JED atau MED;
- direct flight tidak wajib;
- transit diperbolehkan;
- round-trip maupun open-jaw dibandingkan;
- tanggal dapat fleksibel;
- monitoring dilakukan sampai satu tahun ke depan.

## 2. Primary User

Jamaah umrah mandiri yang ingin:

- merencanakan keberangkatan jauh hari;
- mengejar tiket murah;
- fleksibel memilih JED atau MED;
- bersedia transit;
- memiliki rentang tanggal, bukan hanya satu tanggal;
- menerima notifikasi jika harga turun di bawah target.

## 3. Primary User Story

> Saya ingin memantau penerbangan dari CGK atau airport Indonesia lain menuju JED/MED untuk keberangkatan sampai 365 hari ke depan. Saya tidak keberatan transit. Saya ingin mengetahui kombinasi perjalanan termurah, termasuk open-jaw, dan mendapat notifikasi bila harga turun di bawah nilai yang saya tentukan.

## 4. Supported Itinerary Patterns

```ts
type ItineraryPattern =
  | "ROUNDTRIP_JED"
  | "ROUNDTRIP_MED"
  | "OPENJAW_JED_MED"
  | "OPENJAW_MED_JED";
```

### ROUNDTRIP_JED

```text
ORIGIN -> JED
JED -> ORIGIN
```

### ROUNDTRIP_MED

```text
ORIGIN -> MED
MED -> ORIGIN
```

### OPENJAW_JED_MED

```text
ORIGIN -> JED
MED -> ORIGIN
```

### OPENJAW_MED_JED

```text
ORIGIN -> MED
JED -> ORIGIN
```

## 5. Default Configuration

```text
origin                  = CGK
destinations            = JED, MED
passengers              = 1 adult
cabin                   = economy
minStayNights           = 9
maxStayNights           = 14
userVisibleHorizonDays  = 365
technicalHorizonDays    = 370
currency                = IDR
allowConnections        = true
```

Semua nilai tersebut harus configurable.

## 6. Origin Airports

Jangan hard-code hanya CGK.

Preset awal:

```text
CGK
KJT
SUB
KNO
DPS
UPG
YIA
SOC
BTH
PDG
```

User dapat memasukkan IATA lain.

Validation:

```regex
^[A-Z]{3}$
```

## 7. Core Features

### 7.1 Cheapest Fares Dashboard

Tampilkan:

- cheapest fare overall;
- cheapest JED round-trip;
- cheapest MED round-trip;
- cheapest JED-in/MED-out;
- cheapest MED-in/JED-out;
- cheapest fare per selected origin;
- departure and return date;
- stay nights;
- airline;
- outbound/inbound stops;
- provider;
- observed timestamp;
- verification status.

### 7.2 Flexible Date Search

Filter:

- one or multiple origins;
- departure start date;
- departure end date;
- min stay nights;
- max stay nights;
- itinerary patterns;
- passengers;
- cabin;
- max stops, optional;
- max price, optional.

Range keberangkatan dapat mencapai 365 hari dari hari ini.

### 7.3 Watchlist

Authenticated user dapat membuat watchlist.

Example:

```text
Name: Umrah akhir tahun
Origins: CGK, KJT
Patterns: all
Departure range: 2026-10-01 to 2027-08-01
Stay: 9-12 nights
Cabin: economy
Threshold: Rp9,000,000
```

### 7.4 Threshold Alert

Base trigger:

```ts
fare.normalizedAmountIdr <= watchlist.thresholdIdr
```

Fare harus memenuhi seluruh constraint watchlist.

### 7.5 Price History

Simpan observasi harga dan tampilkan:

- current lowest;
- 7-day low;
- 30-day low;
- historical minimum;
- lowest fare per observation day;
- route/pattern breakdown.

### 7.6 365-Day Fare Calendar

User harus dapat menjelajah sampai satu tahun ke depan.

Calendar view:

- month navigation;
- cheapest visible fare per departure date;
- no-data state;
- not-yet-available state;
- freshness badge.

Jangan mengartikan ketiadaan harga sebagai harga mahal.

### 7.7 Deal Score

Setelah minimal 10 historical observations:

```text
<= percentile 20 = Excellent
<= percentile 40 = Good
<= percentile 75 = Normal
>  percentile 75 = Expensive
```

Jika data kurang:

```text
Insufficient data
```

## 8. Fare Verification Status

```ts
type VerificationStatus =
  | "INDICATIVE"
  | "LIVE_VERIFIED"
  | "STALE"
  | "EXPIRED";
```

Tambahkan availability state terpisah:

```ts
type AvailabilityState =
  | "HAS_FARE"
  | "NO_RESULT"
  | "NOT_YET_PUBLISHED"
  | "PROVIDER_UNAVAILABLE"
  | "NOT_SCANNED";
```

`NO_RESULT` dan `NOT_YET_PUBLISHED` tidak boleh dianggap identik.

## 9. Ranking

Default sort:

1. usable and non-expired;
2. lowest normalized total price;
3. live-verified wins if price difference <= 2%;
4. fewer stops;
5. shorter duration;
6. newer observation.

Transit tidak boleh mendapatkan penalti yang membuat tiket murah tersembunyi. Harga tetap prioritas utama.

## 10. Price Semantics

Selalu simpan dan tampilkan:

- total amount;
- currency;
- passenger count;
- source/provider;
- observed time;
- indicative/live status;
- baggage info if known.

Jika baggage tidak diketahui:

```text
Bagasi: belum diketahui
```

Jangan mengasumsikan baggage termasuk.

## 11. Authentication and Roles

### Public

- dashboard;
- calendar;
- fare details;
- read-only search.

### Authenticated

- watchlist CRUD;
- personal alerts;
- threshold;
- watchlist history.

### Admin

- provider health;
- scan logs;
- manual scan;
- scheduler status;
- API usage;
- settings.

## 12. Alerts

MVP:

- in-app;
- email if configured.

Future:

- Telegram;
- WhatsApp;
- browser push.

Gunakan notification adapter agar channel bisa ditambah.

## 13. Non-Goals for MVP

Belum perlu:

- ticket payment;
- automated purchase;
- passport data;
- visa processing;
- hotel monitoring;
- Haramain ticket monitoring;
- umrah package booking;
- scraping OTA;
- ML fare prediction.

## 14. Required Disclaimer

> Harga tiket dapat berubah sewaktu-waktu. Sebagian data dapat berasal dari harga indikatif atau cache. Selalu verifikasi harga akhir, bagasi, fare rules, persyaratan visa, dan syarat transit pada provider atau maskapai sebelum membeli.
