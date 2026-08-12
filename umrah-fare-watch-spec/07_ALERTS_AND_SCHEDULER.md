# Alerts and Scheduler

## 1. Goals

Scheduler menjaga rolling flight coverage, melakukan selective hotel enrichment, dan mencocokkan observation pool ke watchlist tanpa menjalankan full scan per user. Alert hanya dikirim untuk hasil yang memenuhi semantics domain dan freshness.

## 2. Watchlist Types

```ts
type WatchlistType = "FLIGHT" | "HOTEL" | "COMPLETE_TRIP";
```

- `FLIGHT` memakai route, date range, party, cabin, stops, layover, duration, dan threshold.
- `HOTEL` memakai city, exact or derived dates, occupancy, rooms, radius, cancellation filter, dan threshold.
- `COMPLETE_TRIP` memakai seluruh `TripSearchInput` serta complete total threshold.

Normalized constraints menghasilkan stable `searchFingerprint` untuk matching dan deduplication.

## 3. Flight Scheduling Cadence

```text
Tier A: 0-90 days, approximately every 24 hours
Tier B: 91-210 days, approximately every 48 hours
Tier C: 211-370 days, approximately every 84 hours
```

Cadence configurable dan diberi jitter. Scheduler selalu memeriksa `nextEligibleAt`, provider budget, frontier, cache freshness, circuit state, dan distributed lock sebelum call.

## 4. Hotel Scheduling Rules

Hotel search tidak memakai broad calendar scan. Exact canonical hotel search hanya dibuat untuk:

1. active `HOTEL` atau `COMPLETE_TRIP` watchlist;
2. top flight candidates yang sudah mempunyai exact local datetimes;
3. saved plan mendekati expiry;
4. explicit verification user.

Jika check-in di luar frontier active provider, simpan `NOT_YET_SEARCHABLE` serta hitung `nextEligibleAt` ketika tanggal memasuki frontier. Jangan call provider dan jangan membuat `NO_RESULT`.

## 5. Canonical Hotel Search Deduplication

Satu canonical hotel search key berisi provider, city, check-in, check-out, adults, sorted children ages, rooms, radius, free-cancellation filter, currency, dan adapter version.

Equivalent watchlists share the same canonical hotel search observation. Worker memakai distributed lock per key. Fresh result dipakai ulang. Satu request yang gagal tidak menghapus prior observations.

## 6. Job Types

```text
plan-flight-coverage
scan-flight-bucket
verify-flight-candidate
refresh-hotel-frontier
search-canonical-hotel
quote-hotel-rate
compose-trip-candidates
match-watchlists
create-alert-events
deliver-alerts
expire-offers
refresh-provider-health
```

Setiap job mempunyai idempotency key, attempt count, scheduled time, lock key, correlation ID, dan bounded payload. Job tidak membawa provider token.

## 7. Priority and API Budget

Priority order:

1. quote or offer verification before user redirect;
2. explicit user search lacking fresh results;
3. watchlist near threshold or offer expiry;
4. hotel keys newly entering frontier;
5. Tier A, Tier B, then Tier C background coverage.

`maxConcurrentProviderRequests = 3` secara default. Batas global dan per-provider dapat lebih rendah. Hormati `Retry-After`. Tidak ada unlimited retry.

## 8. Matching Rules

Watchlist matcher bekerja pada normalized observations dan bounded trip plans. Ia tidak memanggil provider secara langsung.

Flight match memerlukan dates, route pattern, party, cabin, serta transport constraints cocok. Hotel match memerlukan city, dates, occupancy, rooms, radius, dan cancellation constraints cocok. Complete match memerlukan ketiga component matches serta valid contiguous dates.

## 9. Complete Trip Alert Eligibility

`COMPLETE_TRIP` alert hanya eligible jika:

- all user constraints match;
- flight, Makkah hotel, dan Madinah hotel ada;
- component observations tidak expired;
- setiap normalized IDR amount tersedia;
- `PriceCompleteness = COMPLETE`;
- verification and freshness memenuhi alert policy;
- total berada pada atau di bawah threshold;
- plan tidak pernah dikirim untuk event fingerprint yang sama.

`INDICATIVE_COMPLETE` boleh tampil di app, tetapi default complete alert memerlukan fresh verified components. Partial price tidak boleh memakai template complete deal.

## 10. Cooldown and Material Drop

Default alert cooldown adalah 24 hours per watchlist and comparable plan key. Penurunan minimal 3 percent dari last alerted total dapat melewati cooldown. Keduanya configurable.

Material drop dihitung:

```text
dropPercent = ((previousTotal - currentTotal) / previousTotal) * 100
```

Gunakan integer minor units sebelum rasio. Jika previous total tidak valid atau component composition berubah secara tidak comparable, jangan bypass cooldown otomatis.

## 11. Alert Event Fingerprint

Fingerprint minimum:

```text
watchlistId | watchlistVersion | comparablePlanKey |
priceBucket | verificationClass | thresholdRuleVersion
```

Database unique constraint mencegah duplicate create. Delivery retry memakai alert ID yang sama dan tidak membuat event baru.

## 12. Alert Payload

Complete trip alert memuat:

- current complete total dan previous alerted total;
- flight, Makkah, dan Madinah subtotals;
- dates, nights, rooms, dan guests;
- route, stop, duration, properties, cancellation, dan payment notes;
- provider per component;
- observation and expiry times;
- included and Not included;
- coverage disclaimer;
- deep link ke plan detail untuk re-verification.

Jangan memasukkan raw booking URL ke kanal yang tidak aman. CTA membuka app, lalu server re-verifies.

## 13. Delivery Channels

MVP minimal mendukung in-app alert. Email atau kanal lain hanya diaktifkan jika scaffold dan credential tersedia. User preference, unsubscribe, timezone, dan quiet hours dihormati.

Delivery status: `PENDING`, `SENT`, `FAILED_RETRYABLE`, `FAILED_FINAL`, `SUPPRESSED`. Simpan reason dan timestamp tanpa secret.

## 14. Failure Handling

- Provider unavailable: mark coverage, keep stale data, open circuit after threshold.
- Rate limited: set next eligible time and honor provider instruction.
- Access not configured: disable real adapter and continue mock or other domains.
- Invalid response: quarantine payload reference, fail schema, no observation.
- One component missing: show components, no complete alert.
- Delivery failure: retry bounded with exponential backoff.
- Worker crash: lock expires safely and idempotency prevents duplication.

No scheduler path may fall back to scraping.

## 15. Locks and Concurrency

Locks use explicit scope and expiry:

```text
provider-action-canonicalKey
scan-tier-dateBucket
watchlist-match-partition
alert-delivery-alertId
```

Worker verifies lock ownership before write. Long provider calls renew only when supported safely. Lock expiry alone does not authorize duplicate external order or booking action, which are outside scope.

## 16. Observability

Track jobs due, started, succeeded, failed, skipped, deduped, and delayed. Track provider calls, cache hits, locks, circuit state, frontier movement, observation freshness, eligible and suppressed alerts, delivery latency, serta reason distribution.

Admin view dapat menjawab: kapan key terakhir dicari, provider apa, state apa, mengapa belum dijadwalkan, dan kapan next eligible.

## 17. Scheduler Acceptance Gate

- Flight tiers respect 24, 48, and 84 hour defaults.
- canonical hotel search keys deduplicate equivalent watchlists.
- No full external scan runs per user.
- Day 331 for a 330-day hotel provider is not called and becomes `NOT_YET_SEARCHABLE`.
- COMPLETE_TRIP alert rejects partial, stale, expired, or missing components.
- 24 hours cooldown works.
- 3 percent material drop bypass works only for comparable plans.
- Locks, idempotency, concurrency cap, and bounded retry pass tests.
- Provider failure does not erase observations or block other providers.
