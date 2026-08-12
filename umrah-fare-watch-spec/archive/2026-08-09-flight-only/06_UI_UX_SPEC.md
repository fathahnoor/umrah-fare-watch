# UI and UX Specification

## 1. Design Direction

- clean;
- modern;
- data-first;
- travel-oriented;
- mobile-first;
- price is the strongest visual element;
- no banner-heavy OTA look.

## 2. Navigation

```text
Termurah
Kalender Harga
Pantauan Saya
Tentang
```

Admin:

```text
Admin
```

## 3. Homepage

Hero:

```text
Pantau Tiket Umrah Termurah
```

Subheading:

```text
Cari penerbangan murah ke Jeddah dan Madinah sampai setahun ke depan, termasuk transit dan open-jaw.
```

Filters:

```text
Dari
Rentang keberangkatan
Lama perjalanan
Harga maksimum
Pola perjalanan
```

Default:

```text
CGK
Today .. Today+365
9-14 malam
All patterns
```

## 4. Summary Cards

Four primary cards:

```text
Termurah keseluruhan
Via Jeddah
Via Madinah
Open-jaw termurah
```

Example:

```text
Rp8,42 jt
CGK -> JED -> CGK
3 Nov - 14 Nov
11 malam
1 transit
Indicative
Dicek 4 jam lalu
```

## 5. Fare Card

Must show:

- total fare;
- route;
- dates;
- stay duration;
- airline;
- stops;
- verification;
- provider;
- last checked;
- baggage status.

Buttons:

```text
Lihat detail
Pantau
Verifikasi harga
```

`Verifikasi harga` only when live provider is enabled.

## 6. 365-Day Calendar

Month navigation must support the full rolling year.

Date cells can show:

```text
Rp8,7 jt
```

or states:

```text
Belum tersedia
Belum ditemukan
Menunggu scan
Sumber bermasalah
```

Legend required.

Never show a blank date in a way that implies no flight.

## 7. Horizon Indicator

Near top of calendar:

```text
Periode dipantau:
9 Agu 2026 - 9 Agu 2027
```

Also:

```text
Data paling jauh tersedia:
22 Jun 2027
```

when known.

## 8. Compare JED vs MED

Comparison:

| Metric | JED | MED |
|---|---:|---:|
| Lowest fare | | |
| Best departure date | | |
| Stay length | | |
| Stops | | |
| Freshness | | |

Add open-jaw options below.

## 9. Fare Details

### Price
- current price;
- status;
- threshold if monitored;
- history chart.

### Itinerary
- outbound;
- inbound;
- airport;
- airline;
- segments;
- stops;
- duration.

### Data quality
- provider;
- observed timestamp;
- source timestamp;
- live verification timestamp;
- baggage;
- synthetic flag.

## 10. Watchlist Form

```text
Nama pantauan
Airport keberangkatan
Rentang tanggal, up to 365 days
Durasi min/max
Pola perjalanan
Harga maksimum
Maks transit optional
Email alert
In-app alert
```

## 11. Watchlist Card

Example:

```text
Umrah 2027
CGK / KJT
9-12 malam
10 Jan - 9 Aug 2027
Target <= Rp9.000.000

Termurah sekarang:
Rp9.240.000
Rp240.000 di atas target

Terakhir dipindai:
hari ini 06:18 WIB
```

## 12. Long-Horizon Empty State

For far future:

```text
Harga untuk periode ini belum tersedia dari sumber data.
Sistem akan terus memantau secara berkala.
```

Do not say:

```text
Tidak ada penerbangan.
```

unless reliable API semantics actually establish that conclusion.

## 13. Price History Chart

- x: observation time;
- y: IDR;
- threshold line;
- historical minimum marker;
- current fare marker.

If fewer than 2 points, show text instead of fake chart.

## 14. Admin Dashboard

Show:

- provider mode;
- last successful scan;
- next scan;
- coverage by tier;
- months with gaps;
- farthest fare date per route;
- requests today;
- live verification budget;
- failures;
- recent runs.

Actions:

```text
Run due discovery
Refresh coverage
Verify top fares
```

All admin-only.

## 15. Responsive

At 360px:

- no primary horizontal table;
- fare cards stack;
- month calendar remains legible;
- filters collapse cleanly;
- no hover-only information.

## 16. Accessibility

- semantic labels;
- keyboard support;
- focus states;
- status meaning is text, not color only;
- chart has textual summary.
