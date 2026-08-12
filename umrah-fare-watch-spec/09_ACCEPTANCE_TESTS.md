# Acceptance Tests

## 1. How to Use This Suite

Every item marked `MUST` belongs to the Mandatory Release Gate. Freebuff must map each scenario to an automated test where practical and record evidence. A screenshot alone does not prove money, date, scheduler, or security correctness.

Required evidence per gate:

```text
test ID, status, command or manual procedure, exit code, timestamp, relevant output or artifact, tested provider mode
```

## 2. Search Input and Validation

- [ ] `MUST INPUT-01` Default input is CGK, 1 adult, 0 children, 1 room, 5 Makkah nights, 4 Madinah nights, economy, IDR.
- [ ] `MUST INPUT-02` At least one adult is required per room.
- [ ] `MUST INPUT-03` Each child requires a valid age and ages survive round-trip serialization.
- [ ] `MUST INPUT-04` `makkahNights` and `madinahNights` reject zero and negative values.
- [ ] `MUST INPUT-05` Origin rejects invalid IATA format and unsupported codes.
- [ ] `MUST INPUT-06` Departure end beyond day 365 is rejected for user search.
- [ ] `MUST INPUT-07` Safe server-side maximums apply even when client validation is bypassed.

## 3. Date and Journey Sequence

- [ ] `MUST DATE-01` JED arrival with AUTO derives Makkah first.
- [ ] `MUST DATE-02` MED arrival with AUTO derives Madinah first.
- [ ] `MUST DATE-03` MAKKAH_FIRST and MADINAH_FIRST overrides work for supported patterns.
- [ ] `MUST DATE-04` ROUNDTRIP_JED, ROUNDTRIP_MED, OPENJAW_JED_MED, and OPENJAW_MED_JED remain distinct.
- [ ] `MUST DATE-05` First checkout equals second check-in and hotel stays are contiguous.
- [ ] `MUST DATE-06` Return flight earlier than final checkout makes the plan invalid.
- [ ] `MUST DATE-07` Overnight arrival uses Saudi local date, not origin date or raw UTC date.
- [ ] `MUST DATE-08` System never invents an intercity flight between JED and MED.

## 4. Price Correctness

- [ ] `MUST PRICE-01` Party flight total is used for all travellers and is not confused with per-person price.
- [ ] `MUST PRICE-02` Makkah total covers all rooms and all Makkah nights.
- [ ] `MUST PRICE-03` Madinah total covers all rooms and all Madinah nights.
- [ ] `MUST PRICE-04` Complete total equals the exact sum of the three component totals in integer minor units.
- [ ] `MUST PRICE-05` Taxes and mandatory fees are included when supplied.
- [ ] `MUST PRICE-06` Due-at-property amount stays visible and is not hidden by due-now amount.
- [ ] `MUST PRICE-07` Original currency, original amount, FX rate, normalized IDR amount, and FX timestamp are stored.
- [ ] `MUST PRICE-08` Missing amount never becomes zero.
- [ ] `MUST PRICE-09` Unknown mandatory fee yields `PARTIAL_FEES_UNKNOWN`.
- [ ] `MUST PRICE-10` Missing FX yields `PARTIAL_FX_MISSING`.
- [ ] `MUST PRICE-11` Missing component yields `COMPONENT_MISSING`.
- [ ] `MUST PRICE-12` Only `COMPLETE` plans enter the default cheapest-complete ranking.
- [ ] `MUST PRICE-13` A calculation snapshot reproduces displayed total after source offers change.

## 5. Ranking

- [ ] `MUST RANK-01` Lowest usable complete total ranks first.
- [ ] `MUST RANK-02` Live-verified wins within 2 percent price difference.
- [ ] `MUST RANK-03` Fewer stops and shorter duration apply only after prior rules tie.
- [ ] `MUST RANK-04` Refundable hotel wins within 2 percent after flight tie rules.
- [ ] `MUST RANK-05` Partial plans appear in a separate labelled section.
- [ ] `MUST RANK-06` Active filters exclude results and do not create hidden score penalties.

## 6. Coverage and Horizons

- [ ] `MUST COVER-01` Flight day 364 can be represented.
- [ ] `MUST COVER-02` Flight day 366 is outside user horizon.
- [ ] `MUST COVER-03` Technical flight planner represents day 370.
- [ ] `MUST COVER-04` Hotel day 330 is eligible for a provider frontier of 330.
- [ ] `MUST COVER-05` Hotel day 331 renders `NOT_YET_SEARCHABLE` for a 330-day provider and no provider call occurs.
- [ ] `MUST COVER-06` `NO_RESULT` is created only after an eligible provider search succeeds with no valid result.
- [ ] `MUST COVER-07` Provider failure creates `PROVIDER_UNAVAILABLE` and does not erase historical data.
- [ ] `MUST COVER-08` Flight and hotel coverage can differ for the same trip date.

## 7. Provider Abstraction

- [ ] `MUST PROV-01` Deterministic Mock flight and hotel providers pass without credentials or network.
- [ ] `MUST PROV-02` Disabled real providers do not break search or Mock mode.
- [ ] `MUST PROV-03` Invalid provider payload fails runtime schema and is not persisted as valid observation.
- [ ] `MUST PROV-04` Access-not-configured is different from provider outage and no result.
- [ ] `MUST PROV-05` Broad indicative flight is not labelled live verified.
- [ ] `MUST PROV-06` Hotel quote change records old and new price and requires confirmation.
- [ ] `MUST PROV-07` Expired offer cannot open booking handoff without re-verification.
- [ ] `MUST PROV-08` No scraping, browser automation, or hidden endpoint exists in provider data paths.
- [ ] `MUST PROV-09` No integration is called live without documented access and successful server-side smoke test.

## 8. Scheduler and Deduplication

- [ ] `MUST SCHED-01` Flight Tier A, B, and C use configurable 24, 48, and 84 hour defaults.
- [ ] `MUST SCHED-02` Equivalent canonical hotel search inputs produce the same key.
- [ ] `MUST SCHED-03` Concurrent equivalent requests result in at most one external call.
- [ ] `MUST SCHED-04` Full external scan is not launched per user.
- [ ] `MUST SCHED-05` Hotel enrichment is limited to configured top flight candidates.
- [ ] `MUST SCHED-06` Concurrent provider requests obey the configured cap.
- [ ] `MUST SCHED-07` Retry is bounded and honors `Retry-After`.
- [ ] `MUST SCHED-08` Lock expiry and worker retry do not duplicate observation or alert events.

## 9. Watchlists and Alerts

- [ ] `MUST ALERT-01` FLIGHT, HOTEL, and COMPLETE_TRIP constraints normalize deterministically.
- [ ] `MUST ALERT-02` Complete alert requires three components, matching constraints, fresh observations, IDR values, and `COMPLETE` status.
- [ ] `MUST ALERT-03` Partial, stale, expired, and missing-component plans cannot use complete alert template.
- [ ] `MUST ALERT-04` Default cooldown is 24 hours.
- [ ] `MUST ALERT-05` Comparable price reduction of at least 3 percent can bypass cooldown.
- [ ] `MUST ALERT-06` Non-comparable composition change does not bypass cooldown automatically.
- [ ] `MUST ALERT-07` Unique fingerprint prevents duplicate event and delivery retry reuses alert ID.
- [ ] `MUST ALERT-08` Alert deep link requires in-app re-verification before provider redirect.

## 10. Security and Privacy

- [ ] `MUST SEC-01` Provider tokens never reach the client bundle, response, browser log, server log, or test snapshot.
- [ ] `MUST SEC-02` Authorization header and sensitive provider URLs are redacted.
- [ ] `MUST SEC-03` Redirect accepts only allowlisted provider URLs.
- [ ] `MUST SEC-04` Server validates input and rate limits relevant endpoints.
- [ ] `MUST SEC-05` User can access only their own watchlists and alerts.
- [ ] `MUST SEC-06` No passport, visa, identity number, payment card, or medical data is collected.
- [ ] `MUST SEC-07` Mock fixtures contain no real personal data.
- [ ] `MUST SEC-08` Dependency and secret scans available in the scaffold pass or have a documented approved exception.

## 11. UI, Responsive, and Accessibility

- [ ] `MUST UX-01` Headline is `Cari Total Umrah Termurah`.
- [ ] `MUST UX-02` Complete card shows total, three subtotals, providers, freshness, included, and Not included.
- [ ] `MUST UX-03` Component breakdown adds up to the displayed total.
- [ ] `MUST UX-04` Partial total is not visually presented as complete.
- [ ] `MUST UX-05` Provider coverage and observation time are visible.
- [ ] `MUST UX-06` Straight-line distance is not called walking distance.
- [ ] `MUST UX-07` Required hotel confirmation reminder appears.
- [ ] `MUST UX-08` Mobile width 360px is usable with no horizontal scroll.
- [ ] `MUST UX-09` Keyboard can operate search, results, filters, modal, and watchlists.
- [ ] `MUST UX-10` Status meaning uses text or icon and not color alone.
- [ ] `MUST UX-11` Form controls have accessible labels and errors.
- [ ] `MUST UX-12` Dynamic progress is announced without excessive screen-reader interruption.

## 12. Reliability and Observability

- [ ] `MUST REL-01` One provider failure does not block other providers or successful components.
- [ ] `MUST REL-02` Old observation remains visible with stale status after refresh failure.
- [ ] `MUST REL-03` Structured logs include correlation ID and safe error category.
- [ ] `MUST REL-04` Provider health distinguishes disabled access, rate limit, outage, and invalid response.
- [ ] `MUST REL-05` Admin can identify last attempt, last success, next eligible time, and state for a canonical key.

## 13. Build and Handoff Integrity

- [ ] `MUST BUILD-01` Install command succeeds from a clean supported environment.
- [ ] `MUST BUILD-02` Typecheck, lint, unit tests, integration tests, and production build pass.
- [ ] `MUST BUILD-03` Mock mode end-to-end smoke test passes without real provider credentials.
- [ ] `MUST BUILD-04` Environment example includes names only and no real secret.
- [ ] `MUST BUILD-05` Actual framework and commands are documented in final project handoff.
- [ ] `MUST BUILD-06` No unresolved placeholder or fake completion claim remains.
- [ ] `MUST BUILD-07` Specification validator still reports 13 canonical files.

## 14. Mandatory Release Gate

MVP may be called complete only when every `MUST` item above is passed or an explicitly out-of-scope optional provider item is documented as disabled without weakening required product behavior. Any failed price, date, security, provider-token, scheduler-idempotency, complete-alert, 360px, or build test blocks release.

Final evidence bundle must include:

- exact commands and exit codes;
- automated test summary by test ID;
- screenshots for desktop and 360px UX checks;
- redacted server-side real-provider smoke evidence for each provider claimed live;
- provider access and terms review date;
- known limitations and disabled adapters;
- final production build hash or deployment identifier if deployment is authorized.
