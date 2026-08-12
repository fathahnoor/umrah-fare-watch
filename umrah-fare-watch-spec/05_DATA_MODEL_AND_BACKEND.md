# Data Model and Backend

## 1. Modeling Rules

- Provider observations adalah append-only historical facts.
- Property identity terpisah dari dated room rate.
- Offer ID dan booking URL dapat expired.
- Uang disimpan sebagai integer minor units plus currency.
- Datetime disimpan sebagai UTC instant, original offset, dan local date yang sudah diturunkan secara eksplisit.
- Missing, unknown, zero, dan not applicable adalah keadaan berbeda.
- Trip plan mereferensikan component observation IDs serta calculation snapshot.
- Recalculation tidak menulis ulang historical total secara diam-diam.

Nama tabel atau collection dapat disesuaikan dengan scaffold, tetapi field semantics dan invariant tidak boleh dilemahkan.

## 2. Core Entities

```text
airports
citySearchAreas
flightCandidates
flightObservations
hotelProperties
hotelOffers
hotelObservations
tripPlans
watchlists
alerts
scanCoverage
scanRuns
providerUsage
requestCache
settings
```

User dan session entity mengikuti authentication layer scaffold yang aktual.

## 3. Airports and City Search Areas

`airports`:

```text
id, iataCode unique, name, city, countryCode, timezone,
isIndonesianOrigin, isSaudiGateway, active, createdAt, updatedAt
```

`citySearchAreas`:

```text
id, city enum(MAKKAH|MADINAH), label, latitude, longitude,
defaultRadiusKm, maxRadiusKm, distanceSemantic, active, version
```

`distanceSemantic` default adalah `STRAIGHT_LINE`. Jangan label walking distance tanpa routing source.

## 4. Flight Candidates and Observations

`flightCandidates` menyimpan broad discovery identity:

```text
id, providerId, providerCandidateId, origin, outboundAirport,
returnAirport, departureLocalDate, returnLocalDate, pattern,
indicativeTotalMinor, currency, observedAt, expiresAt,
verificationStatus, canonicalKey, rawPayloadReference
```

`flightObservations` menyimpan verified snapshot:

```text
id, candidateId, providerId, providerOfferId, observedAt, expiresAt,
adults, childrenAges, cabin, segmentsJson, stopCount, durationMinutes,
outboundArrivalInstant, outboundArrivalOffset, outboundArrivalSaudiDate,
returnDepartureInstant, returnDepartureOffset, returnDepartureSaudiDate,
originalAmountMinor, originalCurrency, taxAmountMinor,
mandatoryFeeAmountMinor, dueNowAmountMinor, normalizedIdrAmountMinor,
fxRate, fxObservedAt, priceCompleteness, verificationStatus,
bookingUrl, conditionsJson, baggageJson, schemaVersion
```

`normalizedIdrAmountMinor` adalah Party flight total, bukan per-person amount.

## 5. Hotel Properties, Offers, and Observations

`hotelProperties` menyimpan identity yang tidak bergantung tanggal:

```text
id, providerId, providerPropertyId, canonicalPropertyId,
name, address, city, latitude, longitude, starRating,
sourceUrl, firstObservedAt, lastObservedAt
```

`hotelOffers` menyimpan provider rate identity yang dapat expired:

```text
id, propertyId, providerId, providerOfferId, providerRateId,
roomName, rateName, boardType, cancellationJson, paymentJson,
bookingUrl, termsUrl, expiresAt, schemaVersion
```

`hotelObservations` menyimpan exact dated rate snapshot:

```text
id, offerId, propertyId, providerId, canonicalHotelSearchKey,
city, checkInLocalDate, checkOutLocalDate, nights,
adults, childrenAges, rooms, radiusKm, freeCancellationOnly,
originalAmountMinor, originalCurrency, taxAmountMinor,
mandatoryFeeAmountMinor, dueNowAmountMinor, dueAtPropertyAmountMinor,
normalizedIdrAmountMinor, fxRate, fxObservedAt,
priceCompleteness, verificationStatus, availabilityState,
straightLineDistanceKm, observedAt, expiresAt, rawPayloadReference
```

Hotel total selalu untuk semua rooms dan semua nights pada observation, bukan harga satu kamar per malam.

## 6. Trip Plans and Calculation Snapshot

`tripPlans`:

```text
id, searchFingerprint, flightObservationId,
makkahHotelObservationId, madinahHotelObservationId,
pattern, cityOrder, firstCity, secondCity,
makkahCheckIn, makkahCheckOut, madinahCheckIn, madinahCheckOut,
flightPartyTotalIdrMinor, makkahStayTotalIdrMinor,
madinahStayTotalIdrMinor, tripTotalIdrMinor,
priceCompleteness, tripPlanStatus, verificationStatus,
calculationSnapshotJson, calculatedAt, expiresAt, version
```

`calculation snapshot` minimal memuat formula version, all source observation IDs, original and normalized component amounts, FX snapshots, included fees, missing fields, user constraints, date derivation inputs, rounding policy, dan generated reasons.

Invariant:

```text
tripTotalIdrMinor = flightPartyTotalIdrMinor
                      + makkahStayTotalIdrMinor
                      + madinahStayTotalIdrMinor
```

Formula hanya dievaluasi jika semua operands ada. Per-person equivalent diturunkan untuk display dan tidak disimpan sebagai authoritative total.

## 7. Watchlists and Alerts

`watchlists`:

```text
id, userId, type enum(FLIGHT|HOTEL|COMPLETE_TRIP), active,
normalizedConstraintsJson, searchFingerprint,
thresholdIdrMinor, channelsJson, cooldownHours,
materialDropPercent, lastMatchedAt, createdAt, updatedAt
```

`alerts`:

```text
id, watchlistId, eventFingerprint, tripPlanId,
componentObservationId, observedTotalIdrMinor,
previousAlertTotalIdrMinor, reason, payloadSnapshotJson,
status, createdAt, sentAt, failureCategory
```

Unique index pada `eventFingerprint` mencegah duplicate alert. Payload snapshot memastikan alert dapat diaudit setelah harga berubah.

## 8. Coverage, Scan Runs, and Provider Usage

`scanCoverage`:

```text
id, domain, providerId, canonicalKey, rangeStart, rangeEnd,
availabilityState, frontierDate, lastAttemptAt, lastSuccessAt,
nextEligibleAt, resultCount, errorCategory, scanRunId, updatedAt
```

`scanRuns`:

```text
id, runType, tier, scheduledFor, startedAt, finishedAt,
lockKey, status, requestedCount, successCount, failureCount,
retryCount, errorSummaryJson
```

`providerUsage`:

```text
id, providerId, action, intervalStart, intervalEnd,
calls, successes, failures, cacheHits, rateLimitRemaining,
latencyP50Ms, latencyP95Ms, lastStatusCategory
```

## 9. Request Cache and Settings

`requestCache` menyimpan key hash, provider, action, adapter version, response reference, createdAt, expiresAt, dan terms policy version. Jangan menyimpan secret dalam key atau value.

`settings` menyimpan versioned validated configuration. Perubahan horizon, limit, TTL, cooldown, atau provider enable flag mempunyai actor, timestamp, previous value, dan reason.

## 10. Indexes and Constraints

Minimum indexes:

- airports: unique `iataCode`;
- flightCandidates: provider plus canonicalKey plus observedAt;
- flightObservations: providerOfferId plus observedAt, and expiresAt;
- hotelProperties: providerId plus providerPropertyId unique;
- hotelOffers: providerId plus providerOfferId;
- hotelObservations: canonicalHotelSearchKey plus observedAt, and expiresAt;
- tripPlans: searchFingerprint plus calculatedAt, and expiresAt;
- watchlists: userId plus active plus type;
- alerts: unique eventFingerprint, and watchlistId plus createdAt;
- scanCoverage: domain plus providerId plus canonicalKey unique;
- scanRuns: lockKey plus status;
- requestCache: keyHash unique and expiresAt.

Database constraints mencegah negative money, checkout sebelum check-in, zero rooms, child age invalid, dan complete plan dengan component ID kosong.

## 11. Query Contracts

Framework-specific route names boleh menyesuaikan scaffold. Semantics berikut wajib ada:

```ts
searchTrip(input: TripSearchInput): TripSearchResponse
getTripPlan(id: string): TripPlanDetail
verifyTripPlan(id: string): VerificationResult
searchFlights(input: FlightSearchInput): FlightSearchResponse
searchHotels(input: HotelSearchInput): HotelSearchResponse
listCalendarCoverage(input: CalendarInput): CalendarCoverageResponse
listWatchlists(): Watchlist[]
createWatchlist(input: CreateWatchlistInput): Watchlist
updateWatchlist(id: string, input: UpdateWatchlistInput): Watchlist
deleteWatchlist(id: string): void
listProviderHealth(): ProviderHealthSnapshot[]
```

Search response wajib memuat results, partialResults, coverage, activeProviders, unavailableProviders, observation time, warnings, dan nextEligibleAt jika relevan.

## 12. Action Contracts

Mutating actions:

- verify selected flight offer;
- search or refresh canonical hotel key;
- quote selected hotel rate;
- compose and materialize saved plan;
- enqueue eligible coverage scan;
- evaluate watchlists;
- generate idempotent alert event;
- open sanitized booking handoff after user confirmation.

Setiap action memvalidasi authorization, input, current state, idempotency, dan rate limit.

## 13. Retention and Privacy

Raw provider payload retention mengikuti terms dan minimum audit need. Provider secrets tidak disimpan dalam application tables. Search history yang terkait user dapat dihapus sesuai policy. Child ages dan occupancy tidak disimpan lebih lama dari kebutuhan pricing serta watchlist. Tidak ada passport, visa, identity number, payment card, atau medical data.

## 14. Backend Error Semantics

Gunakan typed outcomes:

```text
VALIDATION_ERROR
AUTH_REQUIRED
ACCESS_NOT_CONFIGURED
OUTSIDE_PROVIDER_FRONTIER
RATE_LIMITED
PROVIDER_UNAVAILABLE
INVALID_PROVIDER_RESPONSE
OFFER_EXPIRED
QUOTE_CHANGED
PARTIAL_PRICE
NOT_FOUND
```

Error response memuat safe code, user message, retryable boolean, correlation ID, dan nextEligibleAt bila ada. Jangan expose provider raw error atau credential.

## 15. Data Release Gate

- Money arithmetic memakai minor units dan exact tests.
- Party, rooms, nights, and child ages preserved end-to-end.
- Historical observations tidak berubah saat refresh.
- calculation snapshot dapat mereproduksi displayed total.
- Day and timezone derivation lulus JED-first, MED-first, dan overnight cases.
- Missing values tidak menjadi zero.
- Required unique indexes and constraints aktif.
- Secret scan, authorization tests, and log redaction lulus.
