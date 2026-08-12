# Acceptance Tests

## A. Horizon

- [ ] User can select a departure date 365 days ahead.
- [ ] User cannot select a date beyond the configured user horizon.
- [ ] Technical scanner can cover up to 370 days.
- [ ] A date 364 days ahead can return a fare.
- [ ] Month navigation covers all calendar months intersecting the rolling horizon.
- [ ] Month 13 is included when partial-month geometry requires it.
- [ ] Far-future no-data does not display "no flight" automatically.

## B. Itinerary

- [ ] ROUNDTRIP_JED works.
- [ ] ROUNDTRIP_MED works.
- [ ] OPENJAW_JED_MED works.
- [ ] OPENJAW_MED_JED works.
- [ ] Open-jaw does not add a JED-MED flight leg.
- [ ] Transit itineraries are accepted.
- [ ] Price is primary ranking criterion.

## C. Origin

- [ ] CGK is default.
- [ ] User can use KJT/SUB or another valid IATA.
- [ ] Invalid IATA is rejected.
- [ ] Multiple origins can be monitored.

## D. Fare Data

- [ ] Every fare shows provider.
- [ ] Every fare shows observed timestamp.
- [ ] Indicative and live-verified are distinguishable.
- [ ] Synthetic open-jaw is distinguishable.
- [ ] Unknown baggage is shown as unknown.
- [ ] Price zero is never created from missing data.

## E. Availability States

- [ ] NOT_SCANNED renders correctly.
- [ ] HAS_FARE renders correctly.
- [ ] NO_RESULT renders correctly.
- [ ] NOT_YET_PUBLISHED renders correctly.
- [ ] PROVIDER_UNAVAILABLE renders correctly.

## F. Scheduler

- [ ] Tier A is selected for 0-90 day lead time.
- [ ] Tier B is selected for 91-210 days.
- [ ] Tier C is selected for 211-370 days.
- [ ] Due-scan logic uses nextEligibleScanAt.
- [ ] A bucket automatically changes tier as departure gets closer.
- [ ] Active watchlist raises scan priority.
- [ ] Scanner respects concurrency.
- [ ] Duplicate global scans are locked.

## G. Watchlists

- [ ] Authenticated user can create watchlist.
- [ ] Watchlist can span up to 365 days.
- [ ] User can select multiple itinerary patterns.
- [ ] User can set threshold IDR.
- [ ] User can enable/disable watchlist.
- [ ] User cannot edit another user's watchlist.

## H. Alerts

- [ ] Fare below threshold triggers alert.
- [ ] Fare above threshold does not trigger alert.
- [ ] Cooldown prevents spam.
- [ ] >=3% lower fare can bypass default cooldown according to rule.
- [ ] Alert includes route, dates, price, threshold, and verification status.
- [ ] Email failure does not remove in-app alert.

## I. Mock Mode

- [ ] Application works with no external flight API keys.
- [ ] Mock data is deterministic.
- [ ] Mock includes 365-day horizon.
- [ ] Mock can simulate far-future not-yet-published.
- [ ] Mock can simulate provider failure.
- [ ] Mock can simulate price drop below threshold.

## J. Provider Security

- [ ] Flight API tokens never appear in browser bundle.
- [ ] Provider calls execute server-side.
- [ ] Secrets are not written to logs.
- [ ] 429 is handled.
- [ ] Timeout is handled.
- [ ] Malformed response is rejected safely.

## K. UI

- [ ] 360px mobile width is usable.
- [ ] Statuses do not rely only on color.
- [ ] Calendar legend exists.
- [ ] Price history has textual fallback.
- [ ] Dashboard remains populated after provider temporary failure.

## L. Admin

- [ ] Admin can see scan history.
- [ ] Admin can see coverage gaps.
- [ ] Admin can see provider usage.
- [ ] Admin can see farthest available fare date.
- [ ] Admin can trigger guarded manual scan.
- [ ] Non-admin cannot invoke admin functions.

## Mandatory Release Gate

Do not call MVP complete unless all A-I sections pass and security-critical items in J pass.
