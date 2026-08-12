# Umrah Fare Watch: Trip Cost Optimizer Design

**Status:** Approved design direction, pending written-spec review  
**Date:** 2026-08-11  
**Approved approach:** Pendekatan 2, optimasi total biaya perjalanan  
**Target handoff:** Freebuff Web using DeepSeek V4 Flash 07/31 or GLM 5.2

## 1. Product Decision

Umrah Fare Watch will become a web app that helps independent Umrah travellers find the lowest observed total cost for:

1. flights from Indonesia to Saudi Arabia;
2. a Makkah hotel stay;
3. a Madinah hotel stay.

The product name remains `Umrah Fare Watch` for continuity. In user-facing copy, the primary promise is:

> Temukan kombinasi tiket pesawat dan hotel Makkah-Madinah dengan total biaya termurah dari sumber yang sedang aktif.

The app is not an OTA, travel agency, visa provider, or payment processor. It compares observations and sends users to an authorized booking source after a final verification step.

The phrase `cheapest` always means:

> The lowest comparable price observed from currently enabled providers for the selected constraints.

It never means the lowest price on the entire internet.

## 2. User and Core Job

The primary user is an independent Umrah traveller who is flexible about dates, arrival airport, departure airport, airline, and transit, but needs a clear total budget.

The core job is:

> Given my origin, travel window, traveller count, room count, and number of nights in Makkah and Madinah, show the least expensive valid combination of flights and both hotel stays. Explain the trade-offs and alert me when the complete total meets my target.

The app must also support component exploration because users may want to inspect or replace one part of a trip:

- flight only;
- Makkah hotel only;
- Madinah hotel only;
- complete trip combination.

## 3. MVP Scope

### 3.1 Included

- Indonesian origin airports, with CGK as default.
- JED and MED as Saudi flight airports.
- Round-trip and open-jaw flight patterns.
- Direct and connecting flights.
- Flexible departure range up to 365 days.
- Configurable Makkah and Madinah night allocation.
- Adults, children with ages, and room count as search inputs.
- Hotel search by city location and configurable radius.
- Hotel rate comparison using total stay price.
- Taxes and mandatory fee visibility when supplied by the provider.
- Cancellation policy, payment timing, board type, and loyalty requirement when supplied.
- Component price history.
- Complete trip total calculation.
- Flight-only, hotel-only, and complete-trip watchlists.
- In-app alerts, with email when configured.
- Deterministic mock mode without external credentials.
- Admin visibility for provider coverage, freshness, errors, and API usage.

### 3.2 Excluded

- Ticket or hotel payment inside the app.
- Automated booking.
- Passport or payment-card storage.
- Visa application or issuance.
- Claims that a hotel is accepted for Masar Nusuk without verified provider data or an explicit maintained evidence source.
- Ground transport, Haramain train, intercity transfer, or local transport pricing.
- Umrah package comparison.
- Travel-agent marketplace or WhatsApp group promotion.
- Unlicensed miles trading.
- Scraping OTA, metasearch, airline, or hotel web pages.
- Machine-learning price prediction in MVP.
- Permanent quality scores derived from anecdotal social-media comments.

## 4. Search Inputs and Defaults

Required search inputs:

```ts
type TripSearchInput = {
  origins: string[];
  departureStart: string;
  departureEnd: string;

  adults: number;
  childrenAges: number[];
  rooms: number;

  makkahNights: number;
  madinahNights: number;

  patterns: ItineraryPattern[];
  cityOrder: "AUTO" | "MAKKAH_FIRST" | "MADINAH_FIRST";

  cabin: CabinClass;
  maxStops?: number;
  maxLayoverMinutes?: number;
  maxTripDurationMinutes?: number;

  makkahRadiusKm: number;
  madinahRadiusKm: number;
  freeCancellationOnly: boolean;

  currency: "IDR";
};
```

Defaults:

```text
origins = [CGK]
adults = 1
childrenAges = []
rooms = 1
makkahNights = 5
madinahNights = 4
cityOrder = AUTO
cabin = economy
allowConnections = true
makkahRadiusKm = 5
madinahRadiusKm = 5
freeCancellationOnly = false
currency = IDR
userHorizonDays = 365
technicalFlightHorizonDays = 370
```

Validation rules:

- `makkahNights >= 1`.
- `madinahNights >= 1`.
- Total hotel nights equals the requested trip-stay nights.
- At least one adult is required for each room.
- Child ages are required when children are included.
- Origin codes use `^[A-Z]{3}$` and must belong to the maintained Indonesian airport set.
- Departure end cannot exceed the configured user horizon.
- Radius, room count, passenger count, and date-range size have safe server-side maximums.

## 5. Journey Templates and Date Alignment

Supported flight patterns remain:

```ts
type ItineraryPattern =
  | "ROUNDTRIP_JED"
  | "ROUNDTRIP_MED"
  | "OPENJAW_JED_MED"
  | "OPENJAW_MED_JED";
```

Default city order:

| Flight arrival | Default first city |
|---|---|
| JED | Makkah |
| MED | Madinah |

The user may override the city order. The system must never invent an intercity flight between JED and MED. Ground transfer remains outside the price total.

Hotel dates must be derived from verified local flight datetimes:

1. Use the outbound arrival date in Saudi local time as the first hotel check-in date.
2. Add the configured first-city nights to produce the first checkout date.
3. Use the same date as the second-city check-in date.
4. Add the second-city nights to produce the second checkout date.
5. Require the return flight to depart no earlier than the second checkout date.

A complete trip plan cannot be labelled `LIVE_COMPLETE` when exact local arrival and departure datetimes are unavailable. Broad indicative flight data may be shown, but hotel enrichment waits for a detailed flight result.

## 6. Price Semantics

### 6.1 Component totals

```ts
flightPartyTotalIdr = normalized flight total for all travellers;
makkahStayTotalIdr = normalized room total for all rooms and all Makkah nights;
madinahStayTotalIdr = normalized room total for all rooms and all Madinah nights;
```

### 6.2 Complete total

```ts
tripTotalIdr =
  flightPartyTotalIdr +
  makkahStayTotalIdr +
  madinahStayTotalIdr;
```

Ground transfer, visa, meals not included in a selected rate, and personal spending are excluded and displayed under `Not included`.

### 6.3 Completeness

```ts
type PriceCompleteness =
  | "COMPLETE"
  | "PARTIAL_FEES_UNKNOWN"
  | "PARTIAL_FX_MISSING"
  | "COMPONENT_MISSING";
```

Only `COMPLETE` plans compete in the default cheapest-complete ranking. Partial plans appear in a separate section labelled `Mungkin lebih murah, tetapi biaya belum lengkap`.

The system must store original amount, original currency, normalized IDR amount, FX rate, FX timestamp, taxes, mandatory fees, payment due now, and payment due at property when supplied.

The system must never convert missing price data to zero.

## 7. Ranking

Default complete-trip ranking:

1. all three components present;
2. price completeness is `COMPLETE`;
3. offers are unexpired and currently usable;
4. lowest `tripTotalIdr`;
5. live-verified plan wins when the total difference is at most 2 percent;
6. fewer total flight stops;
7. shorter flight duration;
8. refundable hotel rates when the total difference is at most 2 percent;
9. newer observation.

Price remains the primary criterion. Filters, not hidden scoring penalties, control maximum stops, layover duration, hotel radius, cancellation policy, board type, and minimum rating.

Every ranking screen states active provider coverage and observation time.

## 8. Provider Strategy

### 8.1 Flight providers

- Broad indicative discovery: Travelpayouts or Aviasales Data API when credentials and current terms allow.
- Selective live verification: Duffel Flights when configured.
- Deterministic mock provider: mandatory.

### 8.2 Hotel providers

- First real hotel adapter: Duffel Stays.
- Optional later adapter: Booking.com Demand API after partner access is confirmed.
- Deterministic mock hotel provider: mandatory.

Duffel Stays access must be explicitly requested. Real hotel mode remains disabled until access and credentials are confirmed.

As documented on 2026-08-11, Duffel Stays requires check-in, check-out, guest list, room count, and either coordinates with radius or accommodation IDs. Its search endpoint provides an accurate cheapest total but may not provide complete room-rate detail until rates are fetched. A quote verifies the selected rate before any booking handoff.

The current Duffel Stays check-in horizon is 330 days. Therefore:

- the product keeps a 365-day user horizon for flights;
- hotel coverage has a provider-specific horizon;
- dates beyond the hotel horizon use `NOT_YET_SEARCHABLE`;
- the UI continues monitoring instead of saying no hotel exists.

Community-mentioned services such as Trip.com, Agoda, Traveloka, Tiket.com, Skyscanner, direct airlines, and hotel-chain apps influence user needs. They are not automatic integrations. An adapter may be added only when an official API, valid credentials, caching rules, attribution rules, and redirect rights have been confirmed.

## 9. Two-Stage Trip Discovery

An exhaustive 365-day hotel search for every possible date and occupancy is not allowed.

### Stage A: Broad flight discovery

- Scan flight months across the rolling horizon.
- Rank flight candidates by date and itinerary pattern.
- Retain a configurable top set per date bucket.

### Stage B: Selective trip enrichment

- Live-verify top flight candidates to obtain exact local datetimes.
- Derive Makkah and Madinah hotel dates.
- Search both cities using the requested occupancy and radii.
- Keep the cheapest configurable hotel results per city.
- Compose and rank complete trip plans.

Initial configurable limits:

```text
maxFlightsForHotelEnrichmentPerSearch = 5
maxHotelResultsPerCity = 10
maxTripPlansReturned = 20
maxConcurrentProviderRequests = 3
```

These are application limits, not provider facts.

## 10. Global Pools and Deduplication

The app must not run a complete external scan per user.

Use:

```text
global flight observation pool
+ canonical hotel search pool
+ user watchlist matching
+ on-read trip composition
```

A canonical hotel search key contains:

```text
provider
city
check-in
check-out
adults
children ages
rooms
radius
free-cancellation filter
currency
```

Equivalent watchlists reuse the same hotel observations. Complete trip combinations are calculated from bounded candidate sets. Only alert-worthy or user-saved plans need materialized records.

## 11. Domain Components

Each component has one clear responsibility.

### Flight Discovery

Finds broad flight candidates across the rolling horizon. It does not search hotels.

### Flight Verification

Retrieves exact offers and segment datetimes for selected candidates. It does not compose trips.

### Hotel Search

Searches one city for exact dates and occupancy through an adapter. It normalizes rates and policies.

### Hotel Quote Verification

Refreshes the selected rate before redirect. It records price changes or unavailability.

### Trip Composer

Validates city order and dates, combines one flight with one Makkah rate and one Madinah rate, calculates totals, and assigns completeness.

### Ranking Engine

Sorts complete plans and partial alternatives using explicit deterministic rules.

### Coverage Planner

Tracks separate provider frontiers for flights and hotels. It decides which scans are eligible and due.

### Watchlist Matcher

Matches global observations and complete plans against user constraints without launching a full scan per user.

### Alert Engine

Creates deduplicated alerts with cooldown rules. It does not send an incomplete total as a complete-trip deal.

### Provider Health

Tracks calls, failures, rate limits, last success, coverage frontier, and disabled reasons.

## 12. Required Domain Entities

The revised package must define at least:

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

Key distinctions:

- Flight and hotel observations are append-only historical facts.
- Provider offer IDs and booking URLs can expire.
- Property identity is separate from a dated room rate.
- A trip plan references component observation IDs and stores a calculation snapshot.
- A recalculated trip plan never silently rewrites its historical total.

## 13. Availability and Verification States

Shared availability states:

```ts
type AvailabilityState =
  | "NOT_SCANNED"
  | "HAS_RESULT"
  | "NO_RESULT"
  | "NOT_YET_PUBLISHED"
  | "NOT_YET_SEARCHABLE"
  | "PROVIDER_UNAVAILABLE";
```

Verification states:

```ts
type VerificationStatus =
  | "INDICATIVE"
  | "LIVE_VERIFIED"
  | "STALE"
  | "EXPIRED";
```

Trip states:

```ts
type TripPlanStatus =
  | "LIVE_COMPLETE"
  | "INDICATIVE_COMPLETE"
  | "PARTIAL"
  | "STALE"
  | "EXPIRED";
```

A plan may be `INDICATIVE_COMPLETE` for display, but the default complete-trip alert requires fresh verified components and `PriceCompleteness = COMPLETE`.

## 14. Scheduler and Alerts

Flight coverage retains tiered rolling scans:

```text
Tier A: 0-90 days, approximately every 24 hours
Tier B: 91-210 days, approximately every 48 hours
Tier C: 211-370 days, approximately every 84 hours
```

Hotel searches are exact-date and more expensive. Schedule them only for:

1. active complete-trip or hotel watchlists;
2. top flight candidates selected for enrichment;
3. saved trip plans approaching expiry;
4. explicit user verification within a rate limit.

Watchlist types:

```ts
type WatchlistType = "FLIGHT" | "HOTEL" | "COMPLETE_TRIP";
```

Complete-trip alerts require:

- all user constraints match;
- every component is present;
- normalized IDR values exist;
- price completeness is `COMPLETE`;
- component observations are within their configured freshness windows;
- total price is at or below the threshold.

The default alert cooldown remains 24 hours. A reduction of at least 3 percent may bypass cooldown. Both values are configurable.

## 15. UX Design

Primary navigation:

```text
Total Termurah
Tiket
Hotel
Kalender
Pantauan Saya
Tentang
```

Homepage headline:

```text
Cari Total Umrah Termurah
```

Supporting copy:

```text
Bandingkan tiket pesawat serta hotel Makkah dan Madinah dalam satu total biaya yang transparan.
```

Primary summary cards:

1. complete trip total;
2. cheapest flight component;
3. cheapest Makkah stay;
4. cheapest Madinah stay.

A complete trip card shows:

- total IDR price;
- per-person equivalent as secondary information;
- flight subtotal;
- Makkah hotel subtotal;
- Madinah hotel subtotal;
- dates and night allocation;
- rooms and guests;
- airports, airline, stops, and duration;
- property names and distance semantics;
- refund and payment policy;
- provider for each component;
- verification and freshness for each component;
- included and not-included costs;
- source coverage notice.

Hotel distance must be labelled accurately. Use `straight-line distance` when that is what the system calculates. Do not label it as walking distance without a routing source.

After an OTA hotel result is selected, show a reminder:

> Setelah memesan, konfirmasikan nomor reservasi langsung ke hotel. Untuk kebutuhan visa, pastikan persyaratan dan proses approval melalui sumber resmi atau provider visa Anda.

This reminder is guidance, not a claim that a specific property supports Masar Nusuk.

## 16. Community Insights Policy

The Threads discussion informs the following product requirements:

- compare multiple authorized sources;
- expose provider and after-sales considerations;
- support direct versus transit trade-offs;
- support open-jaw routes;
- encourage early monitoring and promo alerts;
- expose hotel cancellation and payment policy;
- remind users to confirm hotel reservations;
- separate low price from booking reliability.

Community comments must not become a permanent provider score. The MVP may display a neutral editorial note only when it has a maintained source and review date. Social-media price examples, promo dates, refund times, and provider praise or criticism are not production facts.

## 17. Error Handling

### Provider unavailable

- Keep previous observations visible with stale status.
- Mark current coverage as `PROVIDER_UNAVAILABLE`.
- Do not replace results with zero.

### Hotel access not configured

- Keep flight functions operational.
- Use mock hotel data in demo mode.
- In real mode, show that hotel provider access is not configured.

### Hotel date outside provider horizon

- Use `NOT_YET_SEARCHABLE`.
- Continue scheduled frontier checks.
- Do not say no hotel exists.

### Rate expired or quote changed

- Mark the old offer expired.
- Show the new quote and difference.
- Require explicit user confirmation before opening a changed booking option.

### Partial fees

- Exclude the plan from default cheapest-complete ranking.
- Show which amount is unknown.

### One component fails

- Show successful components independently.
- Do not create a complete-trip alert.
- Permit retry only for retryable failures and respect rate limits.

## 18. Testing and Release Gate

The revised acceptance suite must prove:

### Date and sequence

- JED-first and MED-first sequences derive correct hotel dates.
- City order override works.
- Hotel stays are contiguous.
- Return flight is not earlier than the last checkout.
- Overnight flight arrival uses Saudi local date.

### Price correctness

- Party flight total is not confused with per-person price.
- Hotel total covers all rooms and nights.
- Taxes and mandatory fees are included when supplied.
- Due-at-property amounts remain visible.
- FX rate and timestamp are stored.
- Missing values never become zero.
- Only complete totals enter the default cheapest ranking.

### Coverage

- Flight day 364 can be represented.
- Flight day 366 is outside the user horizon.
- Hotel day 331 can render `NOT_YET_SEARCHABLE` for a 330-day provider.
- Provider failure does not erase historical data.

### Provider abstraction

- Deterministic mock flight and hotel providers pass without credentials.
- Disabled real providers do not break the app.
- Adapter output is schema-validated.
- Provider tokens never reach the client or logs.

### Scheduler and alerts

- Equivalent hotel searches are deduplicated.
- A full external scan is not launched per user.
- Complete alerts require fresh complete totals.
- Cooldown and material-drop rules work.

### UX

- Component breakdown adds up to the displayed total.
- Provider coverage is visible.
- Partial totals are not visually presented as complete.
- Mobile width 360 px remains usable.
- Status meaning does not rely on color alone.

All mandatory tests and security-critical tests must pass before MVP is called complete.

## 19. Handoff Structure

Before revising the existing specification package:

1. preserve the original 12 numbered Markdown files under `archive/2026-08-09-flight-only/`;
2. revise the canonical root documents for the approved combined scope;
3. replace the misleading flight-only data-strategy filename with a provider-and-data strategy filename;
4. add `12_HANDOFF_TO_FREEBUFF.md` with model-specific execution rules;
5. keep `task_plan.md`, `findings.md`, and `progress.md` as working handoff records;
6. make `00_README.md` the only start page for the canonical specification.

The final root document set will be:

```text
00_README.md
01_PRODUCT_REQUIREMENTS.md
02_LONG_HORIZON_MONITORING.md
03_TECHNICAL_ARCHITECTURE.md
04_PROVIDER_AND_DATA_STRATEGY.md
05_DATA_MODEL_AND_BACKEND.md
06_UI_UX_SPEC.md
07_ALERTS_AND_SCHEDULER.md
08_IMPLEMENTATION_PLAN.md
09_ACCEPTANCE_TESTS.md
10_FREEBUFF_MASTER_PROMPT.md
11_REFERENCE_SOURCES.md
12_HANDOFF_TO_FREEBUFF.md
```

## 20. Freebuff Execution Contract

The handoff prompt must instruct DeepSeek V4 Flash 07/31 or GLM 5.2 to:

1. read every canonical specification file in numeric order;
2. inspect the actual Freebuff scaffold before choosing framework-specific paths;
3. restate the active milestone and files to be changed;
4. implement one bounded milestone at a time;
5. keep mock mode working after every milestone;
6. run the milestone acceptance checks before continuing;
7. stop and report when credentials, provider access, or a product decision is missing;
8. never substitute scraping for an unavailable API;
9. never claim a provider integration is live without a successful server-side test;
10. never call the MVP complete until the release gate passes.

The model must not rewrite already verified modules merely for style. It must prefer small files, explicit types, deterministic calculations, and evidence-backed completion claims.

## 21. Source Basis

- Community discussion: https://www.threads.com/@sabbounty/post/Db3hlGBga90
- Duffel Stays getting started: https://duffel.com/docs/guides/getting-started-with-stays
- Duffel Stays search API: https://duffel.com/docs/api/v2/search
- Duffel Stays key concepts: https://duffel.com/docs/api/overview/stays-key-concepts
- Booking.com Demand accommodations: https://developers.booking.com/demand/docs/accommodations/about-accommodation
- Travelpayouts Aviasales Data API: https://support.travelpayouts.com/hc/en-us/articles/203956163-Aviasales-Data-API
- Duffel Flights offer requests: https://duffel.com/docs/api/v2/offer-requests

Provider limits, access conditions, endpoint versions, caching rules, and commercial terms are dynamic. Recheck official documentation immediately before enabling a real provider.
