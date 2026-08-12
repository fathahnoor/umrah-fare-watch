# Technical Architecture

## 1. Architecture Goals

Arsitektur memisahkan flight discovery, hotel search, trip composition, watchlist matching, dan alert delivery. Tujuannya adalah perhitungan deterministik, provider yang dapat diganti, mock-first development, biaya API terkendali, serta bukti yang cukup untuk setiap klaim harga.

Framework mengikuti scaffold aktual Freebuff. Jangan menambahkan Convex, Next.js, atau layanan lain hanya karena diasumsikan. Pertahankan boundary domain di bawah meskipun nama folder framework berbeda.

## 2. System Context

```text
Browser UI
  -> Application API
     -> Search Orchestrator
        -> FlightProvider adapters
        -> HotelProvider adapters
        -> Trip Composer
        -> Ranking Engine
     -> Watchlist and Alert services
     -> Database, cache, scheduler, provider health
  -> Authorized provider booking URL after server-side re-verification
```

Semua credential provider dan normalisasi berada di server. Client hanya menerima data domain yang sudah disanitasi dan tidak menerima token, raw provider secret, atau internal error detail.

## 3. Domain Boundaries

- Flight Discovery mencari kandidat broad dan tidak mencari hotel.
- Flight Verification mengambil exact offer, segments, dan local datetimes.
- Hotel Search mencari satu kota untuk exact dates dan occupancy.
- Hotel Quote Verification memeriksa rate terpilih sebelum redirect.
- Trip Composer menggabungkan komponen dan menghitung completeness.
- Ranking Engine mengurutkan plan melalui aturan eksplisit.
- Coverage Planner menentukan scan yang eligible dan due.
- Watchlist Matcher mencocokkan pool global ke constraint user.
- Alert Engine membuat event dedup dan mengirim kanal yang dikonfigurasi.
- Provider Health menyimpan usage, frontier, failures, dan disabled reason.

Tidak ada komponen yang boleh mengarang data domain untuk menutup kegagalan komponen lain.

## 4. Provider Contracts

Adapter mengubah provider-specific payload menjadi schema internal. Kontrak minimum:

```ts
interface FlightProvider {
  id: string;
  mode: "MOCK" | "INDICATIVE" | "LIVE";
  discover(input: FlightDiscoveryInput): Promise<FlightDiscoveryResult>;
  verify(input: FlightVerificationInput): Promise<FlightVerificationResult>;
  health(): Promise<ProviderHealthSnapshot>;
}

interface HotelProvider {
  id: string;
  mode: "MOCK" | "LIVE";
  getFrontier(now: Date): Promise<HotelFrontier>;
  search(input: HotelSearchInput): Promise<HotelSearchResult>;
  fetchRates?(input: HotelRatesInput): Promise<HotelRatesResult>;
  quote(input: HotelQuoteInput): Promise<HotelQuoteResult>;
  health(): Promise<ProviderHealthSnapshot>;
}
```

Semua response divalidasi dengan runtime schema sebelum disimpan. Adapter mengklasifikasikan error menjadi retryable, rate limit, authentication, access disabled, invalid response, dan unavailable. Provider exception tidak boleh melewati boundary sebagai untyped error.

## 5. Search and Composition Flow

1. Validasi serta normalisasi `TripSearchInput`.
2. Cari cached global flight observations yang fresh.
3. Jalankan broad discovery hanya untuk coverage yang due.
4. Pilih bounded flight candidates.
5. Live-verify candidate untuk exact Saudi-local datetime.
6. Derive contiguous Makkah dan Madinah hotel dates.
7. Bentuk dua canonical hotel search keys.
8. Pakai hotel observations fresh atau panggil adapter yang eligible.
9. Trip Composer membuat bounded cross-product.
10. Hitung component totals, `PriceCompleteness`, verification, dan calculation snapshot.
11. Ranking Engine memisahkan complete dari partial plans.
12. Return coverage, freshness, included, dan Not included kepada client.

Jika satu komponen gagal, komponen lain tetap tampil. Complete trip tidak dibuat dan tidak ada complete alert.

## 6. Trip Composer Contract

Trip Composer menerima satu verified flight observation, satu Makkah hotel observation, satu Madinah hotel observation, search constraints, dan FX snapshots. Ia wajib:

- memvalidasi bandara serta city order;
- memakai local dates, bukan UTC calendar dates;
- memastikan kedua stay berurutan dan return tidak sebelum checkout akhir;
- memastikan party dan room occupancy cocok;
- menolak expired component;
- tidak mengubah missing amount menjadi nol;
- menghitung total dengan integer minor units;
- menyimpan source observation IDs dan calculation snapshot;
- menghasilkan alasan terstruktur jika plan partial atau invalid.

Fungsi harus pure dan dapat diuji dengan fixture deterministik. Database write dilakukan setelah hasil komposisi lolos schema.

## 7. Data Flow and Persistence

Provider payload raw yang diperlukan untuk audit dapat disimpan terenkripsi atau direduksi sesuai terms dan retention. Model utama memakai normalized entities:

```text
flightCandidates -> flightObservations
hotelProperties -> hotelOffers -> hotelObservations
flightObservations + hotelObservations -> tripPlans
watchlists + observation pools -> alert candidates -> alerts
scanRuns -> scanCoverage + providerUsage
```

Observations append-only. Offer URL dan provider offer ID dapat expired. Recalculation membuat plan snapshot baru atau version baru dan tidak diam-diam mengubah historical total.

## 8. Caching and Deduplication

Cache key dibentuk dari provider, endpoint action, canonical input, dan adapter version. TTL mengikuti jenis data serta provider terms. Request cache tidak menggantikan database observation history.

Distributed lock mencegah request provider yang sama berjalan paralel untuk canonical key yang sama. Idempotency key dipakai pada scan run, quote verification, dan alert event. Tidak ada full scan per user.

## 9. Security and Privacy

- Secret hanya dibaca server-side dari environment atau secret manager.
- Log melakukan redaction terhadap authorization header, token, booking URL sensitif, dan payload yang berisi data pribadi.
- Search tidak menyimpan paspor, visa, nomor identitas, atau detail pembayaran.
- Child ages hanya dipakai untuk pricing dan mengikuti retention minimum.
- Redirect URL harus berasal dari allowlisted provider adapter dan divalidasi.
- API endpoint memakai validation, rate limit, authorization, dan CSRF protection sesuai framework.
- Mock data harus jelas palsu dan tidak memakai data pribadi nyata.

## 10. Reliability and Failure Isolation

Circuit breaker dan exponential backoff diterapkan per provider. Satu provider gagal tidak mematikan provider lain. `PROVIDER_UNAVAILABLE` tidak menghapus observation history. Retry hanya untuk error retryable dan menghormati `Retry-After`.

Jika hotel access belum dikonfigurasi, flight tetap bekerja, mock hotel tetap tersedia di demo, dan real mode menunjukkan disabled reason. Sistem dilarang mengganti API yang tidak tersedia dengan scraping.

## 11. Observability

Metric minimum:

- provider calls, latency, status category, cache hit, dan rate limit;
- scan due versus completed;
- coverage by domain, provider, date tier, dan state;
- enrichment count dan bounded-set size;
- quote price changes dan expiry;
- complete versus partial trip counts;
- alert candidates, suppressed reasons, dan delivery outcomes.

Structured log memuat correlation ID, scanRunId, canonical key hash, provider ID, adapter version, dan non-secret error category. Dashboard harus membedakan access not configured dari provider outage.

## 12. Configuration

Konfigurasi tervalidasi saat startup:

```text
provider enable flags
mock mode flag
userHorizonDays = 365
technicalFlightHorizonDays = 370
provider hotel frontiers
maxFlightsForHotelEnrichmentPerSearch = 5
maxHotelResultsPerCity = 10
maxTripPlansReturned = 20
maxConcurrentProviderRequests = 3
freshness and cache TTL per action
alert cooldown and material-drop percent
```

Invalid configuration memblokir adapter terkait dan memberi reason yang dapat diamati, bukan menyebabkan fallback diam-diam.

## 13. Deployment Boundaries

Web client, application server, scheduled worker, dan database dapat berada pada satu platform selama boundary dan secret tetap benar. Provider calls tidak boleh dilakukan dari browser. Scheduler harus dapat dijalankan idempotent dan mempunyai lock.

Mock mode wajib deployable tanpa provider credentials. Real adapter diaktifkan satu per satu setelah server-side smoke test dan acceptance test provider lulus.

## 14. Architectural Release Gate

- Mock `FlightProvider` dan `HotelProvider` lulus deterministic contract tests.
- Adapter output gagal cepat ketika schema invalid.
- Trip Composer lulus date, price, completeness, and snapshot tests.
- Token tidak muncul di client bundle, response, atau test log.
- Canonical request dedup dan concurrency cap terbukti.
- Provider failure terisolasi dan historical data tetap ada.
- Tidak ada client-side provider call atau scraping path.
- Exact framework dan deployment choice telah dicatat berdasarkan scaffold nyata.
