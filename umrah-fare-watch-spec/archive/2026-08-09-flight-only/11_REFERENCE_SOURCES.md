# Reference Sources

These references were checked while preparing the specification on 2026-08-09.

Use official documentation as source of truth when provider behavior changes.

## Freebuff Web

Official page:

https://freebuff.com/web

Relevant point:

- Freebuff Web is positioned as a prompt-to-full-stack-app builder with preview and deployment.

Official launch article:

https://freebuff.com/blog/freebuff-web-launch

## Convex

Cron Jobs:

https://docs.convex.dev/scheduling/cron-jobs

Scheduled Functions:

https://docs.convex.dev/scheduling/scheduled-functions

Relevant points:

- recurring backend functions can be implemented with cron jobs;
- scheduled functions support durable future execution.

## Travelpayouts / Aviasales

Aviasales Data API:

https://support.travelpayouts.com/hc/en-us/articles/203956163-Aviasales-Data-API

API and Data:

https://support.travelpayouts.com/hc/en-us/categories/200358578-API-and-data

Relevant point:

- Data API is intended for flight price trends and price calendar-style data;
- treat broad discovery data conservatively as indicative/cache data unless current documentation states otherwise.

Before implementing actual endpoints, re-check the current endpoint names, request limits, attribution requirements, affiliate requirements, and terms.

## Duffel

Flights key concepts:

https://duffel.com/docs/api/overview/flights-key-concepts

Offer Requests:

https://duffel.com/docs/api/v2/offer-requests

Getting Started with Flights:

https://duffel.com/docs/guides/getting-started-with-flights

Search Best Practices:

https://duffel.com/docs/guides/following-search-best-practices

Relevant points:

- flight search is represented through offer requests;
- itineraries use slices containing origin, destination, and departure date;
- offers can be used for selective live-search verification;
- search filtering is recommended to reduce irrelevant offer volume.

## Implementation Warning

Provider APIs, pricing, rate limits, partnership requirements, affiliate rules, allowed caching, attribution, and search-to-book policies can change.

Therefore:

1. keep all provider-specific code behind an adapter;
2. do not encode provider assumptions into UI/business domain;
3. re-check provider documentation immediately before enabling production mode;
4. mock mode must remain operational.
