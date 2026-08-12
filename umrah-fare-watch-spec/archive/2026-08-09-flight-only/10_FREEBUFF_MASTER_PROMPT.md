# Freebuff Web Master Prompt

Build a production-quality full-stack application named **Umrah Fare Watch** using every attached Markdown specification file as authoritative requirements.

Do not simplify or drop the 365-day monitoring requirement.

## Product Goal

Build a web app that periodically finds and monitors the cheapest flights for independent Umrah travel from Indonesia to Saudi Arabia.

Default Indonesian origin:

```text
CGK
```

but arbitrary valid Indonesian IATA origins must be supported.

Saudi airports:

```text
JED
MED
```

Direct flights are NOT required. Connections are allowed and cheap fares should not be hidden merely because they have transit.

## Required itinerary patterns

```text
ROUNDTRIP_JED
origin -> JED -> origin

ROUNDTRIP_MED
origin -> MED -> origin

OPENJAW_JED_MED
origin -> JED
MED -> origin

OPENJAW_MED_JED
origin -> MED
JED -> origin
```

For open-jaw, do NOT invent a JED-MED or MED-JED flight segment.

## Critical 365-Day Requirement

Users may plan Umrah up to one year ahead.

Implement:

```text
user-facing rolling horizon = 365 days
technical scanner horizon = 370 days
```

The rolling horizon must be recalculated over time.

Do not assume exactly 12 calendar month labels cover 365 days. Enumerate every month intersecting the start/end window, which can mean 13 calendar months.

Provider inventory may not be published for the full year. Therefore model availability separately:

```text
NOT_SCANNED
HAS_FARE
NO_RESULT
NOT_YET_PUBLISHED
PROVIDER_UNAVAILABLE
```

Never convert missing far-future data into a price of zero or a claim that no flight exists.

## Long-Horizon Scan Cadence

Use tiered discovery:

```text
Tier A: 0-90 days
scan approximately every 24 hours

Tier B: 91-210 days
scan approximately every 48 hours

Tier C: 211-370 days
scan approximately every 84 hours
```

Cadence must be configurable.

A coordinator may run more frequently but should only execute external scans for buckets that are due.

As time passes, date buckets must automatically move to higher-frequency tiers.

## Architecture

Use the existing Freebuff Web full-stack conventions.

If the generated project uses Convex, use Convex for:

- database;
- queries;
- mutations;
- server-side external API actions;
- cron jobs;
- scheduled functions;
- authentication-related data.

Do not add a second backend/database unless necessary.

## Data Strategy

Implement provider abstraction.

Build in this order:

1. mock provider;
2. indicative discovery provider;
3. optional live verification provider.

The app must be fully demonstrable in mock mode without any external API key.

### Recommended indicative discovery

Implement an adapter for the official Travelpayouts / Aviasales Data API if credentials are configured.

Use calendar/month-style price discovery for broad scanning.

Treat those fares as `INDICATIVE` unless live verification confirms them.

### Recommended live verification

Implement a Duffel adapter if `DUFFEL_ACCESS_TOKEN` exists.

Use it only for exact-date top candidates, threshold-crossing candidates, or explicit verification.

Do NOT brute-force live offer searches across 365 days.

### Never scrape

Do not scrape:

- Google Flights;
- Traveloka;
- Tiket.com;
- Skyscanner web pages;
- airline HTML pages.

## Global Fare Pool

Do NOT execute a complete external scan for each watchlist.

Use:

```text
global fare pool
+
watchlist matching
```

Active watchlists can increase priority for relevant origin/month buckets.

## Default Settings

Seed:

```json
{
  "defaultOrigins": ["CGK"],
  "userHorizonDays": 365,
  "technicalHorizonDays": 370,
  "tierADays": 90,
  "tierBDays": 210,
  "tierCDays": 370,
  "tierACadenceHours": 24,
  "tierBCadenceHours": 48,
  "tierCCadenceHours": 84,
  "defaultMinStayNights": 9,
  "defaultMaxStayNights": 14,
  "maxLiveVerificationsPerDay": 20,
  "maxConcurrentProviderRequests": 3
}
```

## Required Database Concepts

Implement the tables/domain entities described in `05_DATA_MODEL_AND_BACKEND.md`, especially:

```text
airports
fareCandidates
priceObservations
scanCoverage
watchlists
alerts
scanRuns
providerUsage
requestCache
settings
```

Persist `leadTimeDays` for fare observations.

## Required UI

Build:

1. cheapest fares homepage;
2. 365-day price calendar;
3. JED vs MED comparison;
4. fare details;
5. price history;
6. watchlist create/edit;
7. personal alerts;
8. admin provider/scan health dashboard.

Homepage copy:

```text
Pantau Tiket Umrah Termurah
Cari penerbangan murah ke Jeddah dan Madinah sampai setahun ke depan, termasuk transit dan open-jaw.
```

## Fare Card

Show at least:

```text
price
route
departure/return dates
stay nights
airline
stops
provider
last checked
verification status
baggage status
```

Never imply baggage is included when unknown.

## Price Alerts

Authenticated user can set:

- origins;
- date range up to 365 days;
- stay duration;
- itinerary patterns;
- maximum price;
- optional max stops;
- channels.

Trigger when a matching normalized IDR fare is <= threshold.

Default cooldown:

```text
24 hours
```

Allow resend during cooldown only after a material reduction, default 3%.

Always state whether alerted fare is indicative or live-verified.

## Mock Provider Requirements

Create deterministic seeded mock data supporting:

- rolling 370 days;
- JED/MED;
- all four itinerary patterns;
- direct, 1-stop, 2-stop;
- price history;
- occasional cheap deals;
- unpublished far-future periods;
- provider failures;
- threshold-crossing events.

## Security

- provider keys server-side only;
- no secret in browser bundle;
- validate IATA/date ranges;
- watchlist ownership checks;
- admin-only manual scan/settings;
- external call timeouts;
- retry retryable failures only;
- handle rate limits;
- no secret logging.

## UX Rule for Missing Future Fares

For dates far ahead with no published price, display wording such as:

```text
Harga untuk periode ini belum tersedia dari sumber data.
Sistem akan terus memantau secara berkala.
```

Do NOT display:

```text
Tidak ada penerbangan
```

unless the provider semantics truly establish that.

## Implementation Process

Work through phases in `08_IMPLEMENTATION_PLAN.md`.

Do not stop at a static mockup. Build the database, backend functions, scanner, scheduler, watchlist logic, and alert pipeline.

Use the acceptance checklist in `09_ACCEPTANCE_TESTS.md` as the release gate.

If external provider credentials are unavailable, finish all functionality in mock mode and clearly expose provider configuration through environment variables. Do not block the app from running.
