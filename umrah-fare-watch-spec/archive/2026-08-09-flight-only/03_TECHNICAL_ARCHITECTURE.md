# Technical Architecture

## 1. Stack

Gunakan stack yang disediakan Freebuff Web project.

Preferred implementation bila tersedia:

### Frontend
- React
- TypeScript
- Tailwind CSS
- responsive SPA/app-router sesuai scaffold
- lightweight chart component

### Backend
- Convex database
- Convex query/mutation
- Convex actions untuk external API calls
- Convex cron jobs
- Convex scheduled functions
- auth bawaan project

Jangan menambah Supabase/Firebase/Postgres hanya karena familiar jika Convex sudah menjadi backend project.

## 2. Architecture

```text
+----------------------+
|      React UI        |
+----------+-----------+
           |
     Convex Queries
           |
+----------v-----------+
|   Convex Database    |
+----------+-----------+
           ^
           |
+----------+--------------------------------------+
| Backend orchestration                           |
|                                                 |
| Scan Coordinator                                |
|   -> Coverage Planner                           |
|   -> Discovery Provider Adapter                 |
|   -> Candidate Ranker                           |
|   -> Live Verification Adapter                  |
|   -> Observation Writer                         |
|   -> Alert Engine                               |
+--------------------------+----------------------+
                           |
                Official flight APIs
```

## 3. Two-Stage Fare Search

### Stage A: Broad discovery

Goal:

- cover many dates;
- cover up to 365 days;
- find candidate fares cheaply;
- build historical price dataset.

Prefer indicative/cache/calendar API.

### Stage B: Selective live verification

Goal:

- verify exact-date top candidates;
- obtain more detailed itinerary where possible.

Never live-verify every combination across 365 days.

## 4. Provider Interface

```ts
export type FareSearchInput = {
  origin: string;
  destination: "JED" | "MED";
  departureDate?: string;
  returnDate?: string;
  month?: string;
  adults: number;
  cabin: "economy" | "premium_economy" | "business" | "first";
  currency: string;
};

export type NormalizedFare = {
  provider: string;
  providerOfferId?: string;

  origin: string;
  destination: string;

  departureDate: string;
  returnDate?: string;

  pattern:
    | "ROUNDTRIP_JED"
    | "ROUNDTRIP_MED"
    | "OPENJAW_JED_MED"
    | "OPENJAW_MED_JED";

  totalAmount: number;
  currency: string;
  normalizedAmountIdr?: number;

  airlineCodes: string[];
  stopsOutbound?: number;
  stopsInbound?: number;
  durationMinutes?: number;

  baggageSummary?: string;
  bookingUrl?: string;

  verificationStatus: "INDICATIVE" | "LIVE_VERIFIED";
  sourceUpdatedAt?: number;
  expiresAt?: number;

  isSynthetic: boolean;
  rawFingerprint: string;
};

export interface FlightProvider {
  id: string;
  supportsIndicative: boolean;
  supportsLive: boolean;

  discover(input: FareSearchInput): Promise<NormalizedFare[]>;
  verify?(input: FareSearchInput): Promise<NormalizedFare[]>;
}
```

## 5. Recommended Folders

```text
/
├─ src/
│  ├─ components/
│  │  ├─ fare/
│  │  ├─ calendar/
│  │  ├─ watchlist/
│  │  ├─ charts/
│  │  └─ admin/
│  ├─ pages/
│  ├─ lib/
│  │  ├─ fareRanking.ts
│  │  ├─ dateBuckets.ts
│  │  ├─ currency.ts
│  │  └─ airport.ts
│  └─ types/
│
├─ convex/
│  ├─ schema.ts
│  ├─ crons.ts
│  ├─ fares.ts
│  ├─ watchlists.ts
│  ├─ alerts.ts
│  ├─ scans.ts
│  ├─ coverage.ts
│  ├─ admin.ts
│  ├─ internal/
│  │  ├─ scanCoordinator.ts
│  │  ├─ coveragePlanner.ts
│  │  ├─ discovery.ts
│  │  ├─ verification.ts
│  │  ├─ alertEngine.ts
│  │  └─ retention.ts
│  └─ providers/
│     ├─ types.ts
│     ├─ mock.ts
│     ├─ travelpayouts.ts
│     └─ duffel.ts
└─ README.md
```

Adapt to actual Freebuff scaffold.

## 6. Environment Variables

```text
FLIGHT_PROVIDER_MODE=mock

TRAVELPAYOUTS_TOKEN=
DUFFEL_ACCESS_TOKEN=

EMAIL_PROVIDER=resend
RESEND_API_KEY=
ALERT_FROM_EMAIL=

ADMIN_EMAILS=
APP_BASE_URL=
```

Modes:

```text
mock
indicative
hybrid
```

Meaning:

```text
mock        -> local deterministic mock data
indicative  -> discovery provider only
hybrid      -> indicative discovery + selective live verification
```

Never expose provider tokens in frontend environment variables.

## 7. Scheduler Components

Use:

```text
cron
-> scan coordinator
-> coverage planner
-> batched scan tasks
```

365-day scanning must be split into batches.

Do not assume one giant action can or should process the entire year.

## 8. External Call Policy

Every provider call:

- server-side only;
- timeout;
- response schema validation;
- retry max 2 for retryable errors;
- exponential backoff;
- respect 429;
- no secret values in logs;
- request cache;
- usage counter.

## 9. Idempotency

Use:

```text
scanRunId
requestFingerprint
fareFingerprint
observationBucket
```

Fare fingerprint can include:

```text
provider
origin
pattern
departureDate
returnDate
airline codes
total amount
currency
```

## 10. Security

- public functions read-only unless explicitly intended;
- authenticated ownership check for watchlists;
- admin authorization;
- IATA validation;
- max 365 user-facing horizon;
- limit manual scans;
- limit date-range request;
- no arbitrary outbound URL fetch from user input;
- no raw provider payload rendered as HTML.

## 11. Observability

Store per scan:

- start/end;
- tier;
- route/month;
- provider calls;
- response count;
- accepted candidates;
- rejected candidates;
- verification count;
- errors;
- alerts triggered;
- elapsed time.

Admin should show recent scan runs and coverage gaps.
