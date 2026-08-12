# Alerts and Scheduler

## 1. Core Principle

Do not create one external scan per user.

Use:

```text
global fare pool
+
user-specific watchlist matching
```

This is essential for scalability.

## 2. Rolling Coverage

Every scheduling cycle:

1. compute `today`;
2. compute `today + 370`;
3. enumerate intersecting months;
4. assign each month/date bucket to a tier;
5. identify due route-month scans;
6. prioritize active watchlists;
7. batch provider calls.

## 3. Tier Cadence

Defaults:

```text
Tier A: 0-90 days
24-hour discovery cadence

Tier B: 91-210 days
48-hour discovery cadence

Tier C: 211-370 days
84-hour discovery cadence
```

84 hours approximates twice weekly without requiring fixed weekday semantics.

All configurable.

## 4. Daily Coordinator

A Convex cron can run once or several times daily to ask:

```text
which scanCoverage records are due?
```

Coordinator itself may run more often than external scan cadence.

Example:

```text
coordinator every 6 hours
```

It only schedules buckets whose `nextEligibleScanAt <= now`.

## 5. Batch Size

Suggested:

```text
maxConcurrentProviderRequests = 3
```

Process route-month scans in controlled batches.

## 6. Priority Score

Suggested scan priority:

```text
+100 active watchlist coverage
+50  CGK origin
+30  never scanned
+20  entering higher-frequency tier
+15  stale cache
+10  near threshold candidates
```

Actual weights may differ, but ordering should remain logical.

## 7. Discovery Pipeline

```text
cron coordinator
-> create scanRun
-> plan due route-month buckets
-> call discovery adapter
-> normalize
-> validate
-> deduplicate
-> update fareCandidates
-> append priceObservations
-> update scanCoverage
-> choose live candidates
-> optional live verify
-> evaluate watchlists
-> create alerts
-> send notifications
-> finalize scanRun
```

## 8. Live Verification Selection

Priority:

1. fare already below an active threshold;
2. new overall low;
3. largest percentage drop;
4. top fare per pattern;
5. explicit user verification.

Never live-verify every 365-day result.

## 9. Alert Match

```ts
matchWatchlist(fare, watchlist)
&& fare.normalizedAmountIdr !== undefined
&& fare.normalizedAmountIdr <= watchlist.thresholdIdr
```

## 10. Alert Cooldown

Default:

```text
24 hours
```

Within cooldown, resend only when:

```text
new price <= previous alerted price * 0.97
```

Default material drop:

```text
3%
```

## 11. First-Fare Alert

If a far-future period previously had no published fare and then a fare appears:

- normal threshold rules apply;
- if it meets threshold, alert immediately;
- if it does not meet threshold, do not alert in MVP.

Future feature:

```text
notify when fares first become available
```

## 12. Alert Text

Title:

```text
Tiket umrah masuk target: Rp8.720.000
```

Body:

```text
CGK -> JED, pulang MED -> CGK
5 Nov - 16 Nov 2026
11 malam
Harga Rp8.720.000, di bawah target Rp9.000.000.
Status: Indicative.
Dicek: 9 Agu 2026 06:18 WIB.
```

Always state indicative/live status.

## 13. In-App

Persist alert.

Features:

- unread/read;
- newest first;
- link to fare detail;
- link to watchlist.

## 14. Email

Notification adapter:

```ts
interface NotificationProvider {
  sendPriceAlert(input: PriceAlertPayload): Promise<void>;
}
```

If email API key unavailable:

- in-app alert still created;
- email marked `SKIPPED`;
- scan succeeds.

## 15. Manual Scan

Admin can request scan.

Guardrails:

- rate limit;
- no duplicate overlapping route-month scan;
- do not bypass provider daily budget silently.

## 16. User Search

When user changes filters:

1. query existing DB;
2. return results immediately;
3. optionally offer explicit live verification.

Do not hit live API on every keystroke or filter adjustment.

## 17. Scan Lock

Prevent overlapping global coordinator runs.

Suggested stale lock:

```text
30 minutes
```

Recover safely if previous execution died.

## 18. Failure Isolation

Discovery provider failure:

- existing fares stay visible;
- coverage state becomes provider unavailable;
- dashboard does not reset to zero results.

Live provider failure:

- candidate remains indicative;
- scanner continues;
- alert logic follows configured indicative policy.
