# Reference Sources

## 1. Source Policy

Official provider documentation is authoritative for integration behavior. Provider access, limits, versions, caching, attribution, commercial terms, and availability change over time. Recheck them immediately before implementing or enabling a real adapter and record the review date.

The Threads discussion is qualitative community input only. It does not establish production prices, provider quality scores, refund duration, API availability, or legal rights.

## 2. Community Discussion

- Threads post and comments: https://www.threads.com/@sabbounty/post/Db3hlGBga90
- Reviewed for this specification: 2026-08-11.
- Use: discover user concerns such as multi-source comparison, direct versus transit, open-jaw, promos, cancellation, after-sales, hotel reservation confirmation, and visa-related caution.
- Do not use: permanent provider ranking, current price, promo calendar, refund promise, inventory, or integration permission.

Community-mentioned brands are not automatically active sources. The product only names active providers supported by authorized adapters.

## 3. Duffel Stays

- Getting started with Stays: https://duffel.com/docs/guides/getting-started-with-stays
- Search API: https://duffel.com/docs/api/v2/search
- Stays key concepts: https://duffel.com/docs/api/overview/stays-key-concepts

Integration facts used by the design and verified on 2026-08-11:

- Stays access must be requested;
- search uses exact check-in, check-out, guests, rooms, and an area or accommodation IDs;
- initial search can provide an accurate cheapest total at accommodation level;
- full room-rate detail can require a follow-up rates request;
- quote verifies the selected rate;
- documented maximum check-in lead is 330 days.

These facts are time-sensitive. Verify the current docs and account access again before implementation.

## 4. Duffel Flights

- Offer requests: https://duffel.com/docs/api/v2/offer-requests
- Duffel API overview: https://duffel.com/docs/api/overview

Intended role: selective live verification of bounded flight candidates. Verify current offer expiry, passenger, tax, condition, rate-limit, booking, and redirect behavior before enabling.

## 5. Travelpayouts and Aviasales

- Aviasales Data API: https://support.travelpayouts.com/hc/en-us/articles/203956163-Aviasales-Data-API
- Travelpayouts API reference entry point: https://travelpayouts.github.io/slate/

Intended role: broad indicative flight discovery if valid credentials, usage rights, attribution, caching, and redirect terms are confirmed. Data from a broad or cached endpoint must not be labelled live verified without a supported verification step.

## 6. Booking.com Demand API

- Accommodations overview: https://developers.booking.com/demand/docs/accommodations/about-accommodation
- Demand API documentation: https://developers.booking.com/demand/docs/open-api/demand-api

Intended role: optional later hotel adapter after partner access is confirmed. It is not a required MVP provider and must not be implemented speculatively.

## 7. Standards and Supporting Sources

- IANA Time Zone Database: https://www.iana.org/time-zones
- ISO 4217 overview: https://www.iso.org/iso-4217-currency-codes.html
- WCAG 2.2: https://www.w3.org/TR/WCAG22/

Use IANA time zones for datetime conversion, integer minor units with explicit currency semantics, and WCAG AA as the accessibility baseline.

## 8. Provider Review Record Template

Before enabling any real provider, append a project-local record outside the canonical spec with:

```text
provider
reviewedAt
reviewer
officialDocumentationUrls
accountAndAccessStatus
endpointAndVersion
rateLimits
cachingAndRetention
attribution
redirectOrBookingRights
frontierOrInventoryLimits
smokeTestCommandAndRedactedResult
enabledDecisionAndReason
```

Do not put secret values in the record.

## 9. Source Precedence

When sources conflict:

1. current official API documentation and written account terms;
2. successful redacted server-side behavior in the authorized account;
3. canonical product semantics in this specification;
4. community discussion as qualitative context only.

If official docs and observed authorized behavior differ, stop provider activation and obtain clarification. Never use scraping as a tie-breaker.
