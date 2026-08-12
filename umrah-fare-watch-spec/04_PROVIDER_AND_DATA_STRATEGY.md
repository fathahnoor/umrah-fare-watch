# Provider and Data Strategy

## 1. Strategy Summary

Produk memakai adapter resmi, mock-first development, two-stage discovery, dan bounded trip composition. Cakupan provider ditampilkan secara eksplisit. Integrasi baru tidak boleh diasumsikan hanya karena sebuah nama muncul dalam komentar komunitas.

Urutan MVP:

1. deterministic mock flight dan hotel providers;
2. Travelpayouts atau Aviasales untuk broad flight discovery jika akses serta terms sesuai;
3. Duffel Flights untuk selective live flight verification jika dikonfigurasi;
4. Duffel Stays sebagai real hotel adapter pertama setelah akses dikonfirmasi;
5. Booking.com Demand API sebagai opsi lanjutan setelah partner access dikonfirmasi.

## 2. Provider Activation Gate

Setiap real provider tetap disabled sampai semua bukti berikut tersedia:

- official API documentation dan endpoint version;
- approved account atau partner access;
- server-side credential;
- allowed use case, territory, caching, retention, attribution, dan redirect rights;
- rate limit serta commercial implications;
- tested adapter fixtures dan runtime schema;
- successful server-side smoke test;
- UI coverage label dan failure state.

Credential presence saja tidak membuktikan hak akses. Failed access tidak boleh diakali dengan browser automation atau scraping.

## 3. Flight Provider Roles

### Deterministic Mock Flight

Wajib tersedia tanpa network. Fixture mencakup direct, transit, open-jaw, overnight arrival, expired offer, partial fee, no result, provider failure, serta price change. Nilai dan IDs deterministik agar tests repeatable.

### Travelpayouts or Aviasales Data API

Peran yang diinginkan adalah broad indicative discovery across the rolling horizon. Pakai hanya endpoint resmi yang sesuai access tier. Data broad dapat menjadi `INDICATIVE`, bukan bukti bookable live fare. Adapter harus mencatat source, observation time, route, dates, currency, dan keterbatasan detail.

### Duffel Flights

Peran yang diinginkan adalah selective live verification untuk kandidat teratas. Offer request dipakai untuk memperoleh exact segments, local datetimes, passenger total, taxes, conditions, expiry, serta booking handoff yang diizinkan. Jangan memanggil live verification untuk seluruh hasil broad.

## 4. Hotel Provider Roles

### Deterministic Mock Hotel

Wajib tersedia tanpa network. Fixture untuk Makkah dan Madinah mencakup multi-room totals, children ages, tax and fee breakdown, due at property, free cancellation, non-refundable, sold out, expired rate, quote changed, frontier boundary, dan access disabled.

### Duffel Stays

Duffel Stays adalah real hotel adapter pertama. Access harus diminta secara eksplisit. Berdasarkan dokumentasi yang diverifikasi pada 2026-08-11:

- search memakai check-in, check-out, guests, rooms, dan coordinates plus radius atau accommodation IDs;
- initial search dapat memberi cheapest accurate total untuk accommodation;
- detail room rates dapat memerlukan fetch rates;
- quote dipakai untuk memverifikasi rate terpilih sebelum redirect atau booking handoff;
- maximum documented check-in lead adalah 330 hari.

Tanggal di luar frontier menjadi `NOT_YET_SEARCHABLE`. Real hotel mode tetap disabled sampai akses dan credentials berhasil diuji.

### Booking.com Demand API

Booking.com Demand API adalah adapter opsional, bukan requirement MVP. Implementasi hanya setelah partner access, endpoint scope, accommodations terms, affiliate attribution, caching, dan redirect rights dikonfirmasi. Jangan menulis adapter spekulatif yang terlihat live.

## 5. Community-Mentioned Services

Trip.com, Agoda, Traveloka, Tiket.com, Skyscanner, direct airline sites, ALL Accor, Marriott, dan layanan lain dari diskusi Threads adalah masukan kebutuhan pengguna, bukan automatic integrations. Mereka dapat masuk backlog hanya jika official program memenuhi activation gate.

UI boleh menyebut cakupan provider yang benar-benar aktif. UI tidak boleh menampilkan logo atau klaim dibandingkan dengan sebuah layanan yang belum terintegrasi.

## 6. Never Scrape

Never Scrape OTA, metasearch, airline, hotel, loyalty app, atau search-result page. Jangan memakai Comet, Playwright, headless browser, HTML parsing, hidden endpoints, atau session user sebagai data pipeline produksi.

Jika API resmi tidak tersedia:

1. provider tetap disabled;
2. catat stop condition dan kebutuhan akses;
3. gunakan mock mode untuk development;
4. lanjutkan provider lain yang sudah authorized;
5. tampilkan coverage aktual kepada user.

## 7. Two-Stage Discovery

Stage A melakukan broad flight discovery sepanjang rolling horizon dan menyimpan top candidates per date bucket. Stage B memverifikasi maksimal 5 kandidat per search, menurunkan exact hotel dates, mencari maksimal 10 hotel per kota, lalu mengembalikan maksimal 20 trip plans.

```text
maxFlightsForHotelEnrichmentPerSearch = 5
maxHotelResultsPerCity = 10
maxTripPlansReturned = 20
maxConcurrentProviderRequests = 3
```

Angka tersebut adalah application limits dan harus configurable. Exhaustive 365-day hotel search dilarang.

## 8. Normalization Contract

Semua adapter menghasilkan common schema dengan:

```text
providerId, providerOfferId, observedAt, expiresAt,
originalAmountMinor, originalCurrency,
taxAmountMinor, mandatoryFeeAmountMinor,
dueNowAmountMinor, dueAtPropertyAmountMinor,
normalizedIdrAmountMinor, fxRate, fxObservedAt,
priceCompleteness, verificationStatus,
bookingUrl, termsUrl, rawPayloadReference
```

Flight menambah passenger counts, cabin, baggage when supplied, segments, airports, local datetimes, stops, duration, dan fare conditions. Hotel menambah property identity, geo coordinates, straight-line distance, room and rate identity, occupancy, nights, board, cancellation, payment policy, dan remaining rooms when supplied.

Gunakan integer minor units. Adapter harus membedakan absent, unknown, zero, dan not applicable. Schema invalid tidak disimpan sebagai hasil valid.

## 9. FX and Price Completeness

Currency target MVP adalah IDR. Simpan original amount dan currency. FX snapshot harus mempunyai source, rate, base and quote currencies, dan timestamp. Jika FX tidak tersedia, status `PARTIAL_FX_MISSING`. Jika mandatory fees tidak dapat dipastikan, `PARTIAL_FEES_UNKNOWN`. Jika flight atau salah satu stay hilang, `COMPONENT_MISSING`.

Tidak ada fallback `0`. Complete total hanya dihitung ketika ketiga normalized component totals valid dan completeness `COMPLETE`.

## 10. Caching and Freshness

TTL ditetapkan per provider action dan tidak boleh melebihi terms. Broad discovery, live offer, hotel search, fetched rates, dan quote mempunyai freshness berbeda. Setiap response menyimpan observation time serta expiry jika disediakan.

Cache hit tetap menghasilkan source and age metadata. Expired result tidak dipakai untuk redirect. Stale result boleh ditampilkan sebagai history dengan label, tetapi tidak boleh memicu complete alert.

## 11. Booking Handoff

Sebelum membuka provider URL:

1. re-verify flight offer atau hotel quote bila action didukung;
2. bandingkan price dan availability dengan selected snapshot;
3. tampilkan change summary jika berubah;
4. minta explicit user confirmation untuk harga baru;
5. buka hanya allowlisted provider URL.

Produk tidak memproses payment, booking, refund, visa, atau passport data.

## 12. Provider Health and Audit

Catat provider ID, adapter version, access mode, enabled reason, disabled reason, last success, last failure category, frontier, rate-limit state, calls, cache hits, latency, dan observation counts. Jangan log token atau sensitive booking URL.

Setiap real adapter mempunyai fixture-based contract test dan server-side smoke test terpisah. Smoke test output harus menyensor data sensitif.

## 13. Source Coverage Disclosure

Setiap result page menyebut:

- provider yang menghasilkan komponen;
- provider aktif yang dicari;
- provider eligible tetapi unavailable;
- waktu observasi dan verification status;
- apakah harga complete atau partial;
- bahwa hasil bukan cakupan seluruh internet.

## 14. Provider Acceptance Gate

- Mock adapters lulus tanpa network dan credential.
- Real adapter disabled tidak merusak app.
- Runtime schema menolak response invalid.
- Frontier hotel diuji pada hari 330 dan 331.
- Tokens tidak muncul di browser atau log.
- No scraping path exists.
- Live claim didukung successful server-side test.
- Caching, attribution, dan redirect mengikuti terms provider yang tercatat.
