# Flight Data Strategy

## 1. Goal

Monitor cheap Umrah flights over a rolling 365-day horizon without excessive live search calls.

## 2. Default Provider Roles

### Indicative discovery: Travelpayouts / Aviasales Data API

Use for broad fare discovery and price calendar/trend data.

Treat returned prices as indicative/cache unless provider documentation explicitly guarantees otherwise.

### Live verification: Duffel

Use for selective exact-itinerary offer requests.

Use only on:

- top candidates;
- candidates crossing an alert threshold;
- explicit user verification;
- candidates selected within daily live verification budget.

## 3. Optional Future Provider

Skyscanner or another approved official API may be added through the same provider interface.

Do not make MVP dependent on an API requiring partnership approval.

## 4. Never Scrape

Do not scrape:

- Google Flights;
- Traveloka;
- Tiket.com;
- Skyscanner web UI;
- airline websites;
- other OTA pages.

## 5. Discovery Search Space

For each enabled origin:

```text
origin -> JED
origin -> MED
```

Cover all months intersecting:

```text
today .. today+365
```

Use `TECHNICAL_HORIZON_DAYS = 370` internally.

## 6. Month-Based Broad Discovery

Prefer a monthly/calendar endpoint so one request can return multiple dates.

Conceptual call:

```text
provider.discover({
  origin: "CGK",
  destination: "JED",
  month: "2027-03",
  adults: 1,
  cabin: "economy",
  currency: "IDR"
})
```

Do not generate 365 separate live requests.

## 7. Round-Trip Candidate

Candidate must satisfy:

```ts
stayNights = diffDays(returnDate, departureDate);

minStayNights <= stayNights &&
stayNights <= maxStayNights
```

## 8. Open-Jaw Candidate

If discovery provider does not return a combined multi-city fare, MVP may generate a **synthetic estimate**:

```text
ORIGIN -> JED one-way
+
MED -> ORIGIN one-way
```

or inverse.

Synthetic candidate must store:

```text
isSynthetic = true
verificationStatus = INDICATIVE
```

Do not present it as a single bookable offer.

## 9. Transit

No connection limit by default.

Store:

```text
stopsOutbound
stopsInbound
```

For a live itinerary with slices/segments:

```ts
stops = Math.max(0, segments.length - 1);
```

## 10. Candidate Ranking

Within same constraints:

1. price;
2. live verification if price difference <=2%;
3. fewer total stops;
4. duration;
5. freshness.

## 11. Live Verification Budget

System setting:

```text
maxLiveVerificationsPerDay = 20
```

This is a safe initial application-level budget and must be configurable.

When exhausted:

- discovery continues;
- candidates remain indicative;
- no scan failure.

## 12. Request Cache

Indicative cache key:

```text
provider:origin:destination:month:cabin:adults
```

Suggested TTL by tier:

```text
Tier A: 20-24 hours
Tier B: 36-48 hours
Tier C: 72-96 hours
```

Live request cache key:

```text
provider:origin:destination:depart:return:cabin:adults
```

Suggested TTL:

```text
30-60 minutes
```

## 13. Price Normalization

Store original:

```text
originalAmount
originalCurrency
```

For comparison:

```text
normalizedAmountIdr
```

If provider returns IDR, no FX conversion needed.

If not:

- use an FX adapter if configured;
- store rate and timestamp;
- never invent a conversion rate.

## 14. Far-Future Data Handling

If provider has no fare for a far-future month:

- update `scanCoverage`;
- infer availability state conservatively;
- do not create price `0`;
- do not label "no flight" automatically;
- retry according to Tier C cadence.

## 15. Mock Provider

Mandatory.

Mock provider must be deterministic and support:

- 370 days of possible dates;
- JED and MED;
- direct, 1-stop, 2-stop;
- seasonal variation;
- occasional deals;
- far-future not-yet-published buckets;
- provider error simulation;
- history generation.

Use seeded pseudo-random values so tests are repeatable.

## 16. Example Fare

```json
{
  "provider": "mock",
  "origin": "CGK",
  "destination": "JED",
  "pattern": "ROUNDTRIP_JED",
  "departureDate": "2027-07-15",
  "returnDate": "2027-07-26",
  "stayNights": 11,
  "originalAmount": 8420000,
  "originalCurrency": "IDR",
  "normalizedAmountIdr": 8420000,
  "airlineCodes": ["XX"],
  "stopsOutbound": 1,
  "stopsInbound": 1,
  "verificationStatus": "INDICATIVE",
  "isSynthetic": false
}
```

## 17. Data Validation

Reject malformed fare if:

- invalid IATA;
- price <=0;
- missing departure date;
- invalid return sequence;
- departure > technical horizon;
- impossible stay duration;
- unsupported currency.

Do not reject merely because:

- transit count is high;
- duration is long;
- airline is unfamiliar.
