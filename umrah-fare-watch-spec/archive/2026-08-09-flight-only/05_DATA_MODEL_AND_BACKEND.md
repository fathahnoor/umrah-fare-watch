# Data Model and Backend

## 1. `airports`

```ts
{
  iata: string,
  city?: string,
  countryCode: string,
  name?: string,

  enabledAsOrigin: boolean,
  enabledAsDestination: boolean,

  priority: number,

  createdAt: number,
  updatedAt: number
}
```

Indexes:

```text
by_iata
by_origin_enabled
```

## 2. `fareCandidates`

```ts
{
  fingerprint: string,

  provider: string,
  providerOfferId?: string,

  origin: string,
  arrivalAirport: "JED" | "MED",
  returnDepartureAirport?: "JED" | "MED",
  returnDestination?: string,

  pattern:
    | "ROUNDTRIP_JED"
    | "ROUNDTRIP_MED"
    | "OPENJAW_JED_MED"
    | "OPENJAW_MED_JED",

  departureDate: string,
  returnDate?: string,
  stayNights?: number,

  leadTimeDays: number,

  adults: number,
  cabin: string,

  originalAmount: number,
  originalCurrency: string,

  normalizedAmountIdr?: number,
  fxRate?: number,
  fxRateObservedAt?: number,

  airlineCodes: string[],
  stopsOutbound?: number,
  stopsInbound?: number,
  durationMinutes?: number,

  baggageSummary?: string,
  bookingUrl?: string,

  isSynthetic: boolean,

  verificationStatus:
    | "INDICATIVE"
    | "LIVE_VERIFIED"
    | "STALE"
    | "EXPIRED",

  sourceUpdatedAt?: number,
  expiresAt?: number,

  firstSeenAt: number,
  lastSeenAt: number,
  lastVerifiedAt?: number,

  scanRunId: Id<"scanRuns">,

  createdAt: number,
  updatedAt: number
}
```

Indexes:

```text
by_fingerprint
by_origin
by_pattern
by_departure
by_status
by_normalized_price
by_origin_pattern_price
```

## 3. `priceObservations`

Append-only.

```ts
{
  candidateFingerprint: string,

  provider: string,
  origin: string,
  pattern: string,

  departureDate: string,
  returnDate?: string,
  leadTimeDays: number,

  originalAmount: number,
  originalCurrency: string,
  normalizedAmountIdr?: number,

  verificationStatus: string,

  observedAt: number,
  sourceUpdatedAt?: number,

  scanRunId: Id<"scanRuns">
}
```

Indexes:

```text
by_fingerprint_time
by_origin_time
by_pattern_time
by_observed_at
```

## 4. `scanCoverage`

Required for 365-day monitoring.

```ts
{
  provider: string,
  origin: string,
  destination: "JED" | "MED",

  month: string,

  tier: "A" | "B" | "C",

  availabilityState:
    | "NOT_SCANNED"
    | "HAS_FARE"
    | "NO_RESULT"
    | "NOT_YET_PUBLISHED"
    | "PROVIDER_UNAVAILABLE",

  lastAttemptAt?: number,
  lastSuccessAt?: number,
  nextEligibleScanAt?: number,

  fareCount: number,
  furthestFareDate?: string,

  lastError?: string,

  updatedAt: number
}
```

Indexes:

```text
by_route_month
by_next_scan
by_state
```

## 5. `watchlists`

```ts
{
  userId: string,
  name: string,
  enabled: boolean,

  origins: string[],
  patterns: string[],

  dateStart: string,
  dateEnd: string,

  minStayNights: number,
  maxStayNights: number,

  adults: number,
  cabin: string,

  maxStops?: number,

  thresholdIdr: number,

  alertEmail: boolean,
  alertInApp: boolean,

  cooldownHours: number,
  minPriceDropPercent?: number,

  lastMatchedAt?: number,
  lastAlertedAt?: number,
  lastAlertedPriceIdr?: number,

  createdAt: number,
  updatedAt: number
}
```

## 6. `alerts`

```ts
{
  userId: string,
  watchlistId: Id<"watchlists">,
  fareFingerprint: string,

  channel: "IN_APP" | "EMAIL",

  status:
    | "PENDING"
    | "SENT"
    | "FAILED"
    | "SKIPPED",

  priceIdr: number,
  thresholdIdr: number,

  title: string,
  body: string,

  createdAt: number,
  sentAt?: number,
  error?: string
}
```

## 7. `scanRuns`

```ts
{
  type:
    | "DISCOVERY"
    | "LIVE_VERIFY"
    | "CLEANUP"
    | "COVERAGE_REFRESH",

  tier?: "A" | "B" | "C",

  status:
    | "RUNNING"
    | "SUCCESS"
    | "PARTIAL"
    | "FAILED",

  startedAt: number,
  finishedAt?: number,

  providers: string[],

  requestCount: number,
  candidateCount: number,
  insertedCount: number,
  updatedCount: number,
  rejectedCount: number,
  errorCount: number,
  alertsTriggered: number,

  errorSummary?: string
}
```

## 8. `providerUsage`

```ts
{
  provider: string,
  dateKey: string,

  discoveryRequests: number,
  liveRequests: number,
  errors: number,

  lastSuccessAt?: number,
  lastFailureAt?: number,
  lastError?: string
}
```

## 9. `requestCache`

```ts
{
  cacheKey: string,
  provider: string,

  payloadJson: string,

  createdAt: number,
  expiresAt: number
}
```

Never store authorization headers or secrets.

## 10. `settings`

```ts
{
  key: string,
  valueJson: string,
  updatedAt: number
}
```

Initial keys:

```text
defaultOrigins
userHorizonDays
technicalHorizonDays

tierADays
tierBDays
tierCDays

tierACadenceHours
tierBCadenceHours
tierCCadenceHours

defaultMinStayNights
defaultMaxStayNights

maxLiveVerificationsPerDay
maxConcurrentProviderRequests

discoveryProvider
liveProvider
providerMode
```

Suggested defaults:

```json
{
  "userHorizonDays": 365,
  "technicalHorizonDays": 370,
  "tierADays": 90,
  "tierBDays": 210,
  "tierCDays": 370,
  "tierACadenceHours": 24,
  "tierBCadenceHours": 48,
  "tierCCadenceHours": 84,
  "maxLiveVerificationsPerDay": 20,
  "maxConcurrentProviderRequests": 3
}
```

## 11. Public Queries

```text
fares.getDashboardSummary
fares.getCheapest
fares.getByPattern
fares.getCalendar
fares.getFareHistory
fares.getFareDetail
coverage.getCalendarCoverage
```

## 12. Authenticated Functions

```text
watchlists.listMine
watchlists.create
watchlists.update
watchlists.remove
watchlists.toggle

alerts.listMine
alerts.markRead
```

## 13. Admin

```text
admin.getProviderHealth
admin.getUsageToday
admin.getCoverageGaps
scans.listRecent
admin.updateSettings
```

## 14. Internal Actions

```text
internal.scanCoordinator.plan
internal.scanCoordinator.runDueBatches

internal.coveragePlanner.refresh
internal.discovery.scanRouteMonth
internal.verification.verifyCandidates

internal.alertEngine.evaluate
internal.notifications.sendPending

internal.retention.cleanup
```

## 15. Retention

Suggested:

```text
fareCandidates:
  active + 30 days stale history

priceObservations:
  365 to 730 days

scanCoverage:
  rolling current + recent history as needed

scanRuns:
  90 days

requestCache:
  expiry + 7 days

alerts:
  365 days
```

Price observations should preferably exceed 365 days eventually so year-over-year analysis can be added.
