# Long-Horizon Monitoring

## 1. Separate Horizons

Flight dan hotel memakai frontier terpisah. Satu tanggal dapat searchable untuk flight tetapi belum searchable untuk hotel. Coverage disimpan per provider, domain, tanggal, dan canonical search key. UI tidak boleh menyederhanakan keadaan ini menjadi satu label tersedia atau tidak tersedia.

Kontrak saat dokumen ini dibuat:

```text
Flight user horizon: 365 days.
Technical flight horizon: 370 days.
Duffel Stays check-in frontier as verified on 2026-08-11: 330 days.
Dates outside an active hotel provider frontier: NOT_YET_SEARCHABLE.
```

Angka provider adalah fakta dinamis. Recheck dokumentasi resmi sebelum real provider diaktifkan.

## 2. Flight Rolling Horizon

User dapat memilih departure sampai 365 hari sejak tanggal pencarian. Scheduler memakai technical horizon 370 hari agar boundary dan prefetch tidak berlubang. Hari ke-366 sampai 370 tidak boleh dipilih user, tetapi dapat dipakai coverage planner untuk kontinuitas rolling window.

Flight search broad menghasilkan observasi indikatif. Kandidat teratas saja yang masuk live verification. Coverage per tanggal tidak boleh dihapus saat provider sementara gagal.

## 3. Hotel Provider Frontiers

Hotel memakai exact check-in dan check-out, occupancy, kamar, serta area. Frontier check-in setiap provider dicatat dalam konfigurasi dan provider health. Untuk Duffel Stays, bukti resmi yang diverifikasi pada 2026-08-11 menyatakan maksimum check-in lead 330 hari.

Jika check-in berada pada hari ke-331 sedangkan provider hanya mendukung 330 hari:

- jangan memanggil endpoint;
- simpan coverage `NOT_YET_SEARCHABLE`;
- tampilkan bahwa pemantauan akan dimulai ketika tanggal memasuki frontier;
- jangan menyatakan hotel tidak tersedia.

Provider lain dapat memiliki frontier berbeda. Coverage complete trip adalah gabungan coverage semua komponen, bukan salinan coverage flight.

## 4. Availability States

```ts
type AvailabilityState =
  | "NOT_SCANNED"
  | "HAS_RESULT"
  | "NO_RESULT"
  | "NOT_YET_PUBLISHED"
  | "NOT_YET_SEARCHABLE"
  | "PROVIDER_UNAVAILABLE";
```

- `NOT_SCANNED`: belum ada scan yang memenuhi key dan freshness.
- `HAS_RESULT`: panggilan provider berhasil dan minimal satu hasil valid disimpan.
- `NO_RESULT`: panggilan eligible berhasil tetapi tidak menghasilkan offer valid.
- `NOT_YET_PUBLISHED`: inventori diperkirakan belum diterbitkan provider, bila dapat dibedakan secara sah.
- `NOT_YET_SEARCHABLE`: tanggal berada di luar frontier atau request belum eligible.
- `PROVIDER_UNAVAILABLE`: provider gagal, disabled, rate-limited, atau access tidak ada.

`NO_RESULT` tidak boleh dipakai untuk error, credential missing, atau tanggal di luar frontier.

## 5. Flight Tier Cadence

```text
Tier A: 0-90 days, approximately every 24 hours
Tier B: 91-210 days, approximately every 48 hours
Tier C: 211-370 days, approximately every 84 hours
```

Cadence adalah default configurable, bukan janji real-time. Scheduler memberi jitter terkontrol, distributed lock, retry terbatas, dan backoff provider. Urutan prioritas: explicit verification user, watchlist dekat threshold, Tier A, Tier B, lalu Tier C.

## 6. Selective Hotel Enrichment

Jangan mencari hotel untuk setiap kombinasi flight selama 365 hari. Hotel hanya dicari untuk:

1. watchlist hotel atau complete trip aktif;
2. maksimal 5 kandidat flight teratas per pencarian interaktif;
3. saved trip plan yang mendekati expiry;
4. explicit user verification yang lolos rate limit.

Flight harus diverifikasi lebih dulu agar exact Saudi-local dates tersedia. Setiap kota menyimpan maksimal 10 hasil teratas untuk komposisi dan satu pencarian mengembalikan maksimal 20 trip plan.

## 7. Canonical Search Deduplication

Sistem memakai global flight observation pool dan canonical hotel search pool. Satu canonical hotel search key memuat:

```text
provider | city | check-in | check-out | adults | sorted child ages |
rooms | radius | free-cancellation filter | currency
```

Normalisasi key wajib deterministik. Child ages diurutkan, tanggal memakai ISO local date, radius memakai precision tetap, dan nilai default ditulis eksplisit. Request dengan key sama dan observation fresh memakai cache yang sama. Jangan menjalankan full external scan per user.

## 8. Coverage Records

Setiap coverage record minimal menyimpan:

```text
domain, provider, canonicalKey, rangeStart, rangeEnd, state,
lastAttemptAt, lastSuccessAt, nextEligibleAt, frontierDate,
resultCount, errorCategory, scanRunId, updatedAt
```

Transisi hanya dilakukan oleh coverage planner atau provider adapter result handler. Scan gagal tidak mengubah observasi lama menjadi nol atau `NO_RESULT`. Historical observations bersifat append-only.

## 9. API Budget Priority

Budget dihitung per provider dan interval. Prioritas:

1. quote verification sebelum redirect;
2. explicit search user yang belum mempunyai hasil fresh;
3. complete trip watchlist yang mendekati threshold;
4. hotel frontier yang baru masuk searchable;
5. rolling background scan.

Ketika budget habis, set `nextEligibleAt`, tampilkan data lama dengan freshness, dan jangan mencoba provider lain melalui scraping.

## 10. Long-Horizon UX

Kalender membedakan flight coverage dan hotel coverage. Setiap tanggal menampilkan salah satu:

- complete total tersedia;
- flight tersedia, hotel belum dicari;
- flight tersedia, hotel `NOT_YET_SEARCHABLE`;
- sudah dicari tanpa hasil;
- provider unavailable;
- belum dipindai.

Status wajib mempunyai label atau ikon, tidak mengandalkan warna. Untuk hotel yang belum masuk frontier, tampilkan tanggal perkiraan mulai dapat dicari berdasarkan frontier aktif tanpa menjanjikan inventori tersedia.

## 11. Alert Behavior

Flight alert dapat memakai flight observation sesuai freshness. Hotel alert memerlukan exact hotel key. Complete trip alert memerlukan tiga komponen fresh, completeness `COMPLETE`, dan total memenuhi threshold. Tanggal di luar frontier hotel tetap dipantau, tetapi tidak mengirim alert complete trip sampai hotel dapat dicari dan diverifikasi.

## 12. Minimum Acceptance Requirements

- Flight day 364 dapat direpresentasikan.
- Flight day 366 ditolak sebagai input user.
- Technical scan dapat mencakup day 370.
- Hotel day 330 eligible untuk provider dengan frontier 330.
- Hotel day 331 menjadi `NOT_YET_SEARCHABLE`, bukan `NO_RESULT`.
- Equivalent canonical hotel searches didedup.
- Provider failure mempertahankan observasi lama sebagai stale.
- Full 365-day hotel scan untuk semua kombinasi tidak pernah dijalankan.
- Semua angka horizon dan cadence configurable serta mempunyai audit timestamp.
