# Implementation Plan

## Phase 0: Scaffold

- initialize Freebuff Web full-stack project;
- retain its default backend;
- add routing;
- add base design system;
- configure auth;
- add environment variables.

Success:

App deploys without flight API credentials.

## Phase 1: Data Model

Implement:

- airports;
- fareCandidates;
- priceObservations;
- scanCoverage;
- watchlists;
- alerts;
- scanRuns;
- providerUsage;
- requestCache;
- settings.

Seed default settings including 365-day horizon.

## Phase 2: Mock Provider

Implement deterministic mock data covering 370 days.

Must include:

- JED;
- MED;
- four itinerary patterns;
- direct/1-stop/2-stop;
- price changes;
- far-future unpublished periods;
- provider failure simulation.

## Phase 3: Dashboard and Calendar

Build:

- cheapest cards;
- fare list;
- filters;
- JED/MED comparison;
- 365-day calendar;
- availability state legend;
- fare detail;
- history chart.

## Phase 4: Watchlists

Implement:

- auth;
- CRUD;
- up-to-365-day date range;
- threshold;
- patterns;
- in-app alerts.

Test with mock fare drops.

## Phase 5: Long-Horizon Scheduler

Implement:

- rolling 370-day technical window;
- tier assignment;
- month coverage;
- due-scan planning;
- 24h/48h/84h cadence;
- scan locks;
- batched concurrency;
- scan logs.

Must prove month 13 is handled.

## Phase 6: Alert Engine

Implement:

- matching;
- threshold crossing;
- cooldown;
- 3% material drop exception;
- indicative/live wording;
- alert history.

## Phase 7: Indicative Flight Provider

Implement official provider adapter.

Recommended first adapter:

```text
Travelpayouts / Aviasales Data API
```

Requirements:

- server-side token;
- monthly/calendar discovery;
- schema validation;
- request cache;
- usage counters;
- graceful failure;
- no client secret leakage.

## Phase 8: Open-Jaw Discovery

Implement:

```text
CGK -> JED + MED -> CGK
CGK -> MED + JED -> CGK
```

Synthetic estimate rules:

- clearly tagged;
- no fake single booking URL;
- eligible for monitoring;
- eligible for selective live verification if supported.

## Phase 9: Live Verification

Recommended adapter:

```text
Duffel
```

Implement:

- exact dates;
- offer request;
- slices;
- segment/stops parsing;
- daily live budget;
- manual verify;
- live badge.

## Phase 10: Email Alerts

- notification adapter;
- email provider;
- graceful disabled state;
- failure logging.

## Phase 11: Hardening

- validation;
- auth ownership;
- admin role;
- input limits;
- provider timeout;
- retries;
- 429 behavior;
- no secret logging;
- accessibility;
- mobile test;
- acceptance suite.

## Strict Build Order

Do not integrate multiple real APIs before mock flow works.

```text
schema
-> mock
-> UI
-> watchlists
-> long-horizon scheduler
-> alerts
-> indicative API
-> open-jaw
-> live verification
-> polish
```

## Definition of Done

MVP is done only when all mandatory items in `09_ACCEPTANCE_TESTS.md` pass.
