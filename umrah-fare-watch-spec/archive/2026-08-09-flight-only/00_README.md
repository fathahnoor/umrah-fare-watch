# Umrah Fare Watch

## Tujuan

Paket ini adalah spesifikasi implementasi untuk membangun **Umrah Fare Watch**, sebuah web app yang secara berkala mencari, menyimpan, membandingkan, dan memberi alert tiket pesawat termurah yang relevan untuk perjalanan umrah mandiri dari Indonesia ke Arab Saudi.

Target pembangunan dan hosting adalah **Freebuff Web**.

## Product principle

Aplikasi ini bukan OTA dan bukan travel agent. Fokus MVP adalah:

1. menemukan kombinasi penerbangan termurah;
2. mendukung transit, karena direct flight tidak wajib;
3. membandingkan JED dan MED;
4. mendukung round-trip dan open-jaw;
5. memantau harga sampai **365 hari ke depan**;
6. menyimpan history harga;
7. memberi alert ketika fare memenuhi target;
8. memisahkan harga indikatif/cache dari harga yang telah live-verified.

## Default journey assumptions

- Default origin: `CGK`
- Origin lain di Indonesia harus didukung.
- Saudi arrival/departure airports: `JED` dan `MED`
- Cabin default: Economy
- Passenger default: 1 adult
- Transit diperbolehkan.
- Primary ranking: lowest total fare.
- Monitoring horizon: rolling 365 days.
- Technical scan buffer: up to 370 days.
- Default length of stay: 9 sampai 14 malam, tetapi configurable.

## Empat pola itinerary utama

```text
ROUNDTRIP_JED
Indonesia -> JED -> Indonesia

ROUNDTRIP_MED
Indonesia -> MED -> Indonesia

OPENJAW_JED_MED
Indonesia -> JED
MED -> Indonesia

OPENJAW_MED_JED
Indonesia -> MED
JED -> Indonesia
```

Open-jaw tidak menambahkan penerbangan JED-MED atau MED-JED. Perpindahan antarkota di Saudi berada di luar itinerary penerbangan yang dipantau.

## Prinsip data source

Gunakan provider API resmi melalui adapter.

Strategi utama:

```text
broad indicative discovery
        ↓
candidate ranking
        ↓
selective live verification
        ↓
price history + alerts
```

Jangan brute-force live search untuk setiap hari selama 365 hari.

Jangan scrape website OTA atau search engine.

## Target architecture

Gunakan kemampuan full-stack bawaan project Freebuff Web. Bila project menggunakan Convex, implementasikan:

- database
- queries/mutations
- actions untuk external API
- cron/scheduled functions
- auth
- environment variables

Jangan membuat backend kedua bila tidak dibutuhkan.

## File dalam paket

| File | Isi |
|---|---|
| `00_README.md` | Orientasi proyek |
| `01_PRODUCT_REQUIREMENTS.md` | Requirement produk dan business rules |
| `02_LONG_HORIZON_MONITORING.md` | Requirement khusus monitoring sampai setahun |
| `03_TECHNICAL_ARCHITECTURE.md` | Arsitektur sistem |
| `04_FLIGHT_DATA_STRATEGY.md` | Provider dan algoritma pencarian |
| `05_DATA_MODEL_AND_BACKEND.md` | Schema dan backend contract |
| `06_UI_UX_SPEC.md` | UI/UX |
| `07_ALERTS_AND_SCHEDULER.md` | Scheduler dan alert engine |
| `08_IMPLEMENTATION_PLAN.md` | Urutan pembangunan |
| `09_ACCEPTANCE_TESTS.md` | Definition of done |
| `10_FREEBUFF_MASTER_PROMPT.md` | Prompt utama untuk Freebuff |
| `11_REFERENCE_SOURCES.md` | Sumber teknis yang menjadi acuan |

## Build rule

Bangun dalam urutan:

```text
schema
-> mock provider
-> dashboard
-> watchlists
-> 365-day horizon scheduler
-> alerts
-> indicative provider
-> live verification
-> hardening
```

Aplikasi wajib tetap berfungsi dalam `MOCK_MODE` tanpa API provider eksternal.
