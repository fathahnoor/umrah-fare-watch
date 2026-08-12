# Implementation Plan for Freebuff

## 1. Execution Rules

This plan is for Freebuff to develop the web app. The current specification handoff does not contain or require application code.

Before implementation:

1. read `00_README.md` through `12_HANDOFF_TO_FREEBUFF.md` in order;
2. inspect the actual scaffold, package manager, framework, database, authentication, tests, and deployment config;
3. report the active milestone and exact files to change;
4. preserve verified code and user changes;
5. keep Mock mode operational after every milestone;
6. run focused tests and the milestone gate before continuing;
7. stop on missing provider access, credentials, unclear product decision, or security blocker.

Do not infer that Convex, Next.js, or any specific service exists. Do not initialize a replacement app over an existing scaffold.

## 2. Milestone 0: Scaffold Audit and Baseline

Deliverables:

- actual repository inventory and framework decision record;
- commands for install, typecheck, lint, unit test, integration test, and build;
- current baseline results;
- environment variable example with placeholder names only;
- mapping from domain boundaries to actual folders;
- confirmed mock mode entrypoint.

Checks:

- existing app runs or its blocker is documented;
- no secret is printed or committed;
- no unrelated rewrite;
- spec validator passes unchanged.

Stop if the scaffold is missing, corrupt, or the framework choice would require replacing user work.

## 3. Milestone 1: Domain Types and Mock Foundation

Implement exact shared types for `TripSearchInput`, itinerary patterns, `PriceCompleteness`, availability, verification, trip status, provider contracts, money, local dates, and calculation snapshot.

Create deterministic Mock `FlightProvider` and Mock `HotelProvider`. Fixtures must cover success, no result, unavailable, expired, partial fee, FX missing, overnight arrival, hotel frontier, multi-room total, and quote change.

Checks:

- runtime schema and TypeScript type tests;
- no network or credentials required;
- fixtures stable across runs;
- missing amounts never become zero.

## 4. Milestone 2: Search Form and Component Results in Mock Mode

Implement responsive search inputs, client and server validation, flight result view, hotel result views for Makkah and Madinah, coverage labels, error states, and price breakdown.

Checks:

- adults, child ages, rooms, nights, patterns, city order, transit, radii, and cancellation preserved end-to-end;
- 360px layout works;
- keyboard and labels work;
- component totals clearly represent party or all rooms and nights.

## 5. Milestone 3: Trip Composer and Ranking

Implement pure Hotel date derivation, Trip Composer, complete total, calculation snapshot, partial separation, ranking, and result detail.

Checks:

- JED-first, MED-first, override, open-jaw, and overnight dates;
- contiguous stays and return after checkout;
- exact minor-unit arithmetic;
- all three component totals add up;
- only `COMPLETE` plans enter primary ranking;
- bounded candidate limits enforced.

## 6. Milestone 4: Persistence and Backend Contracts

Implement data entities, indexes, constraints, query contracts, typed errors, request cache, and audit fields using the actual backend technology in the scaffold.

Checks:

- append-only observations;
- reproducible calculation snapshot;
- unique dedup keys;
- authorization and validation;
- retention fields and secret redaction;
- no passport, visa, or payment data.

## 7. Milestone 5: Coverage Planner, Scheduler, and Watchlists

Implement flight tier planning, provider frontiers, canonical hotel search deduplication, jobs, locks, concurrency, watchlist CRUD, matching, and in-app alerts.

Checks:

- 365 user, 370 technical, and 330 hotel examples;
- no full Hotel scan per user;
- cooldown 24 hours and material drop 3 percent;
- COMPLETE_TRIP eligibility;
- idempotent alert delivery;
- provider failure isolation.

## 8. Milestone 6: First Real Flight Integration

Choose the first provider only from access that actually exists. Prefer Travelpayouts for broad discovery and Duffel Flights for live verification according to the roles in `04_PROVIDER_AND_DATA_STRATEGY.md`.

Work one real adapter at a time. Record current official docs, access, terms, caching, attribution, frontier, and rate limits. Keep adapter disabled by default until server-side smoke test succeeds.

Checks:

- runtime response validation;
- no token in client or logs;
- disabled provider does not break Mock mode;
- UI labels indicative versus live correctly;
- booking URL allowlist and expiry.

Stop if access or rights are missing. Do not scrape.

## 9. Milestone 7: First Real Hotel Integration

Implement Duffel Stays only after explicit Stays access is confirmed. Support search, optional fetch rates where necessary, and quote verification. Map check-in frontier to coverage.

Checks:

- exact dates, guests, child ages, rooms, coordinates, and radius;
- all-room all-night total normalization;
- taxes, mandatory fees, due now, and due at property;
- cancellation and payment policy;
- day 330 and Hotel day 331 boundary;
- quote changed and expired behavior;
- access not configured state.

Booking.com Demand API remains optional and must not be implemented concurrently with the first real hotel adapter.

## 10. Milestone 8: Booking Handoff and Production UX

Implement server-side re-verification, price-change confirmation, allowed redirect, coverage disclosure, disclaimer, reservation reminder, responsive QA, accessibility, and admin provider health.

Checks:

- no direct booking or payment;
- no raw booking URL in unsafe alert channels;
- quote or offer change requires explicit confirmation;
- provider and freshness visible;
- status does not rely on color;
- required copy is present.

## 11. Milestone 9: Hardening and Release Gate

Run the full suite in `09_ACCEPTANCE_TESTS.md`, dependency and secret scans available in the scaffold, build, production-like smoke test, scheduler idempotency test, and failure drills. Capture command, exit code, relevant output, and timestamp.

No release claim is allowed while any Mandatory Release Gate item fails. Optional provider absence is acceptable only when that provider is visibly disabled and Mock mode plus required MVP provider mode meet the agreed deployment scope.

## 12. Change Discipline

- One milestone per bounded change set.
- Small explicit modules over large multipurpose files.
- Do not rewrite verified modules for style.
- Do not rename canonical domain types without updating every contract and test.
- No AI-generated route, price, or provider fact.
- No scraping.
- No fake test, screenshot, commit, provider, or completion claim.
- Update handoff notes after each milestone with files, decisions, evidence, and blockers.

## 13. Mandatory Release Gate

Release requires:

- Mock mode end-to-end;
- required real provider mode tested according to approved deployment scope;
- all mandatory date, price, coverage, provider, security, scheduler, alert, responsive, and accessibility tests pass;
- production build passes;
- secrets remain server-side;
- active provider coverage and disclaimer visible;
- no unresolved marker;
- no scraping code path;
- implementation matches current scaffold and canonical specification.
