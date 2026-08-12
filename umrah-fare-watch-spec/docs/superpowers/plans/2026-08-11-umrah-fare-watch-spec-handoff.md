# Umrah Fare Watch Specification Handoff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flight-only canonical specification with a preserved, internally consistent, validated flight-plus-hotel trip-cost specification that Freebuff can execute with DeepSeek V4 Flash 07/31 or GLM 5.2.

**Architecture:** Preserve the 12 original numbered documents under a dated archive, then rebuild the canonical root specification around separate flight, hotel, and trip-composition domains. Add a deterministic PowerShell validator and a dedicated Freebuff handoff contract so the receiving model can work milestone by milestone without inventing provider access or completion evidence.

**Tech Stack:** Markdown, PowerShell 7 or Windows PowerShell 5.1 compatible validation, official travel-provider APIs through adapter contracts, Freebuff Web scaffold, React and TypeScript when implementation begins, Convex only when present in the actual scaffold.

## Global Constraints

- This plan revises the specification package only. It does not build the web app.
- Preserve the current 12 numbered source documents before changing canonical files.
- The folder is not a Git repository. Do not initialize Git or emit fake commit claims.
- Use SHA-256 source hashes and validator output as checkpoint evidence.
- Use only the regular ASCII hyphen character. Reject em dash, en dash, horizontal bar, and Unicode minus characters.
- Keep the product name `Umrah Fare Watch`.
- The core product finds the lowest observed complete total from active sources, not the absolute lowest price on the internet.
- Complete total equals the party flight total plus the complete Makkah room total plus the complete Madinah room total.
- Flight user horizon is 365 days, technical flight horizon is 370 days, and hotel coverage follows each provider frontier.
- Duffel Stays dates beyond its documented 330-day check-in horizon use `NOT_YET_SEARCHABLE`.
- Real providers are optional. Deterministic flight and hotel mock providers are mandatory.
- Do not scrape OTA, metasearch, airline, or hotel pages.
- Do not process payment, store passport data, issue visas, or automate booking.
- Do not convert anecdotal Threads comments into permanent provider scores.
- Root numbered documents are canonical. Archived files are evidence only.
- Every cross-reference must resolve to an existing canonical file.
- Do not call the package ready until `tools/validate-spec.ps1` exits with code 0.

---

## File Responsibility Map

| Path | Responsibility |
|---|---|
| `archive/2026-08-09-flight-only/` | Exact preserved copies of the original 12 numbered Markdown files and their hashes. |
| `00_README.md` | Single canonical start page, scope, reading order, core semantics, and handoff route. |
| `01_PRODUCT_REQUIREMENTS.md` | Users, search inputs, journey templates, component and complete totals, ranking, roles, scope, and disclaimers. |
| `02_LONG_HORIZON_MONITORING.md` | Separate flight and hotel frontiers, cadence, coverage states, scan budgeting, and long-horizon UX. |
| `03_TECHNICAL_ARCHITECTURE.md` | Component boundaries, data flow, adapter contracts, composition flow, security, and observability. |
| `04_PROVIDER_AND_DATA_STRATEGY.md` | Mock, Travelpayouts, Duffel Flights, Duffel Stays, optional Booking.com, normalization, caching, and source coverage. |
| `05_DATA_MODEL_AND_BACKEND.md` | Exact entities, fields, indexes, query and action contracts, retention, and calculation snapshots. |
| `06_UI_UX_SPEC.md` | Search form, total-cost results, component views, calendar, watchlists, empty states, responsive behavior, and accessibility. |
| `07_ALERTS_AND_SCHEDULER.md` | Flight cadence, selective hotel enrichment, deduplication, watchlist matching, cooldowns, locks, and failure isolation. |
| `08_IMPLEMENTATION_PLAN.md` | Milestone order for the future application, with mock-first release gates and no real-provider concurrency. |
| `09_ACCEPTANCE_TESTS.md` | Checkbox release suite covering dates, totals, providers, security, scheduler, alerts, UI, and handoff integrity. |
| `10_FREEBUFF_MASTER_PROMPT.md` | Authoritative build prompt with scope, workflow, constraints, checkpoints, and stop conditions. |
| `11_REFERENCE_SOURCES.md` | Current official documentation and the labelled community source. |
| `12_HANDOFF_TO_FREEBUFF.md` | Operator instructions for DeepSeek V4 Flash 07/31 or GLM 5.2. |
| `tools/validate-spec.ps1` | Deterministic package validation. |
| `task_plan.md` | Work phase status. |
| `findings.md` | Research and decisions. |
| `progress.md` | Execution evidence and validator results. |

---

### Task 1: Preserve the Original Specification and Add the Validator

**Files:**
- Create: `archive/2026-08-09-flight-only/00_README.md`
- Create: `archive/2026-08-09-flight-only/01_PRODUCT_REQUIREMENTS.md`
- Create: `archive/2026-08-09-flight-only/02_LONG_HORIZON_MONITORING.md`
- Create: `archive/2026-08-09-flight-only/03_TECHNICAL_ARCHITECTURE.md`
- Create: `archive/2026-08-09-flight-only/04_FLIGHT_DATA_STRATEGY.md`
- Create: `archive/2026-08-09-flight-only/05_DATA_MODEL_AND_BACKEND.md`
- Create: `archive/2026-08-09-flight-only/06_UI_UX_SPEC.md`
- Create: `archive/2026-08-09-flight-only/07_ALERTS_AND_SCHEDULER.md`
- Create: `archive/2026-08-09-flight-only/08_IMPLEMENTATION_PLAN.md`
- Create: `archive/2026-08-09-flight-only/09_ACCEPTANCE_TESTS.md`
- Create: `archive/2026-08-09-flight-only/10_FREEBUFF_MASTER_PROMPT.md`
- Create: `archive/2026-08-09-flight-only/11_REFERENCE_SOURCES.md`
- Create: `archive/2026-08-09-flight-only/SOURCE_HASHES.sha256`
- Create: `tools/validate-spec.ps1`

**Interfaces:**
- Consumes: the current 12 root Markdown files exactly as they exist before canonical revision.
- Produces: immutable archive evidence and the validator contract used by every later task.

- [ ] **Step 1: Verify the exact source set before copying**

Run:

```powershell
$sourceFiles = Get-ChildItem -File -Filter '*.md' |
  Where-Object { $_.Name -match '^(0[0-9]|1[01])_' } |
  Sort-Object Name
$sourceFiles.Name
if ($sourceFiles.Count -ne 12) { throw "Expected 12 original numbered files, found $($sourceFiles.Count)" }
```

Expected: 12 names from `00_README.md` through `11_REFERENCE_SOURCES.md`, including `04_FLIGHT_DATA_STRATEGY.md`.

- [ ] **Step 2: Copy originals into the dated archive**

Run:

```powershell
$archive = 'archive/2026-08-09-flight-only'
New-Item -ItemType Directory -Force -Path $archive | Out-Null
$sourceFiles | ForEach-Object {
  Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $archive $_.Name)
}
```

Expected: 12 archived Markdown files with matching byte lengths.

- [ ] **Step 3: Record source hashes**

Run:

```powershell
$hashLines = Get-ChildItem -LiteralPath $archive -File -Filter '*.md' |
  Sort-Object Name |
  ForEach-Object {
    $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $_.FullName).Hash.ToLowerInvariant()
    "$hash  $($_.Name)"
  }
Set-Content -LiteralPath (Join-Path $archive 'SOURCE_HASHES.sha256') -Value $hashLines -Encoding utf8
```

Expected: 12 SHA-256 lines sorted by filename.

- [ ] **Step 4: Create the deterministic validator**

Create `tools/validate-spec.ps1` with this contract:

```powershell
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

$required = @(
  '00_README.md',
  '01_PRODUCT_REQUIREMENTS.md',
  '02_LONG_HORIZON_MONITORING.md',
  '03_TECHNICAL_ARCHITECTURE.md',
  '04_PROVIDER_AND_DATA_STRATEGY.md',
  '05_DATA_MODEL_AND_BACKEND.md',
  '06_UI_UX_SPEC.md',
  '07_ALERTS_AND_SCHEDULER.md',
  '08_IMPLEMENTATION_PLAN.md',
  '09_ACCEPTANCE_TESTS.md',
  '10_FREEBUFF_MASTER_PROMPT.md',
  '11_REFERENCE_SOURCES.md',
  '12_HANDOFF_TO_FREEBUFF.md'
)

$failures = [System.Collections.Generic.List[string]]::new()
foreach ($name in $required) {
  if (-not (Test-Path -LiteralPath (Join-Path $root $name))) {
    $failures.Add("Missing canonical file: $name")
  }
}

$existing = $required |
  ForEach-Object { Join-Path $root $_ } |
  Where-Object { Test-Path -LiteralPath $_ }

$badDash = [regex]'[\u2013\u2014\u2015\u2212]'
$forbiddenWords = @('T' + 'BD', 'T' + 'ODO', 'F' + 'IXME')
foreach ($path in $existing) {
  $text = Get-Content -Raw -LiteralPath $path
  if ($badDash.IsMatch($text)) {
    $failures.Add("Forbidden dash character: $([IO.Path]::GetFileName($path))")
  }
  foreach ($word in $forbiddenWords) {
    if ($text -match [regex]::Escape($word)) {
      $failures.Add("Unresolved marker $word in $([IO.Path]::GetFileName($path))")
    }
  }
}

$mustContain = @{
  '00_README.md' = @('flight', 'hotel', 'complete trip', '12_HANDOFF_TO_FREEBUFF.md')
  '01_PRODUCT_REQUIREMENTS.md' = @('makkahNights', 'madinahNights', 'PriceCompleteness', 'termurah yang ditemukan')
  '02_LONG_HORIZON_MONITORING.md' = @('365', '370', '330', 'NOT_YET_SEARCHABLE')
  '03_TECHNICAL_ARCHITECTURE.md' = @('Trip Composer', 'HotelProvider', 'FlightProvider')
  '04_PROVIDER_AND_DATA_STRATEGY.md' = @('Duffel Stays', 'Travelpayouts', 'Booking.com Demand API', 'Never Scrape')
  '05_DATA_MODEL_AND_BACKEND.md' = @('hotelOffers', 'hotelObservations', 'tripPlans', 'calculation snapshot')
  '06_UI_UX_SPEC.md' = @('Cari Total Umrah Termurah', 'Makkah', 'Madinah', 'Not included')
  '07_ALERTS_AND_SCHEDULER.md' = @('canonical hotel search', 'COMPLETE_TRIP', '24 hours', '3 percent')
  '08_IMPLEMENTATION_PLAN.md' = @('Mock', 'Flight', 'Hotel', 'Trip Composer', 'Release Gate')
  '09_ACCEPTANCE_TESTS.md' = @('Hotel day 331', 'Party flight total', '360px', 'Mandatory Release Gate')
  '10_FREEBUFF_MASTER_PROMPT.md' = @('DeepSeek V4 Flash 07/31', 'GLM 5.2', 'mock mode', 'do not scrape')
  '11_REFERENCE_SOURCES.md' = @('duffel.com/docs/api/v2/search', 'developers.booking.com', 'threads.com/@sabbounty')
  '12_HANDOFF_TO_FREEBUFF.md' = @('Read Order', 'Stop Conditions', 'Evidence Before Completion')
}

foreach ($entry in $mustContain.GetEnumerator()) {
  $path = Join-Path $root $entry.Key
  if (-not (Test-Path -LiteralPath $path)) { continue }
  $text = (Get-Content -Raw -LiteralPath $path).ToLowerInvariant()
  foreach ($needle in $entry.Value) {
    if (-not $text.Contains($needle.ToLowerInvariant())) {
      $failures.Add("Missing required term '$needle' in $($entry.Key)")
    }
  }
}

$canonicalText = ($existing | ForEach-Object { Get-Content -Raw -LiteralPath $_ }) -join "`n"
if ($canonicalText -match 'hotel monitoring\s*;?\s*$') {
  $failures.Add('Flight-only hotel non-goal language remains')
}
if ($canonicalText -match '04_FLIGHT_DATA_STRATEGY\.md') {
  $failures.Add('Canonical documents still reference the retired flight-only strategy filename')
}

if ($failures.Count -gt 0) {
  $failures | ForEach-Object { Write-Host "FAIL: $_" }
  exit 1
}

Write-Host "PASS: specification package validated ($($required.Count) canonical files)"
```

- [ ] **Step 5: Run the validator and confirm the expected initial failure**

Run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/validate-spec.ps1
```

Expected: exit code 1 because the new canonical filename and handoff file do not exist yet.

- [ ] **Step 6: Verify archive integrity**

Run:

```powershell
$manifest = Get-Content -LiteralPath 'archive/2026-08-09-flight-only/SOURCE_HASHES.sha256'
$errors = @()
foreach ($line in $manifest) {
  $parts = $line -split '\s+', 2
  $actual = (Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path 'archive/2026-08-09-flight-only' $parts[1])).Hash.ToLowerInvariant()
  if ($actual -ne $parts[0]) { $errors += $parts[1] }
}
if ($errors.Count) { throw "Archive hash mismatch: $($errors -join ', ')" }
'PASS: archive hashes match'
```

Expected: `PASS: archive hashes match`.

---

### Task 2: Rewrite the Canonical Start Page and Product Requirements

**Files:**
- Modify: `00_README.md`
- Modify: `01_PRODUCT_REQUIREMENTS.md`
- Reference: `docs/superpowers/specs/2026-08-11-umrah-trip-cost-optimizer-design.md`

**Interfaces:**
- Consumes: design sections 1 through 7, 15, and 19.
- Produces: the canonical vocabulary and product rules used by every later file.

- [ ] **Step 1: Write a failing terminology check**

Run:

```powershell
rg -n "flight|hotel|complete trip|termurah yang ditemukan|PriceCompleteness|makkahNights|madinahNights" 00_README.md 01_PRODUCT_REQUIREMENTS.md
```

Expected: hotel and complete-trip contracts are absent or contradicted by the old hotel non-goal.

- [ ] **Step 2: Replace `00_README.md` with the approved canonical orientation**

The document must contain these exact top-level sections in this order:

```markdown
# Umrah Fare Watch
## Product Promise
## Meaning of Cheapest
## Core Components
## Default Journey Assumptions
## Supported Journey Patterns
## Data and Provider Principles
## Canonical File Order
## Build and Verification Rule
## Required Disclaimer
```

Under `Meaning of Cheapest`, include this exact sentence:

```text
Termurah berarti harga terendah yang dapat dibandingkan dan ditemukan dari provider yang sedang aktif untuk constraint user, bukan harga termurah absolut di seluruh internet.
```

The file order must list `04_PROVIDER_AND_DATA_STRATEGY.md` and `12_HANDOFF_TO_FREEBUFF.md`, and must not reference the retired flight-only strategy filename.

- [ ] **Step 3: Replace `01_PRODUCT_REQUIREMENTS.md` with the approved product contract**

Use these exact top-level sections:

```markdown
# Product Requirements
## 1. Product Summary
## 2. Primary User and Core Job
## 3. Search Inputs and Validation
## 4. Journey Patterns and City Order
## 5. Hotel Date Derivation
## 6. Component and Complete Price Semantics
## 7. Core Features
## 8. Availability and Verification States
## 9. Ranking
## 10. Watchlists and Alerts
## 11. Authentication and Roles
## 12. MVP Non-Goals
## 13. Community Insight Policy
## 14. Required Disclaimer
```

Copy the exact `TripSearchInput`, `PriceCompleteness`, itinerary patterns, date-alignment rules, complete-total formula, ranking order, included scope, and excluded scope from the approved design. Do not weaken adults, child ages, room count, Makkah nights, Madinah nights, or fee completeness requirements.

- [ ] **Step 4: Run the focused checks**

Run:

```powershell
rg -n "termurah yang ditemukan|makkahNights|madinahNights|PriceCompleteness|COMPONENT_MISSING|hotel monitoring" 00_README.md 01_PRODUCT_REQUIREMENTS.md
```

Expected: required terms appear and the old hotel-monitoring non-goal does not appear.

- [ ] **Step 5: Record checkpoint hashes**

Run:

```powershell
Get-FileHash -Algorithm SHA256 00_README.md,01_PRODUCT_REQUIREMENTS.md |
  Select-Object Path,Hash
```

Expected: two nonempty hashes recorded in `progress.md` during execution.

---

### Task 3: Rewrite Long-Horizon Monitoring and Technical Architecture

**Files:**
- Modify: `02_LONG_HORIZON_MONITORING.md`
- Modify: `03_TECHNICAL_ARCHITECTURE.md`
- Reference: `docs/superpowers/specs/2026-08-11-umrah-trip-cost-optimizer-design.md`

**Interfaces:**
- Consumes: canonical terms from Task 2.
- Produces: coverage states, provider boundaries, `FlightProvider`, `HotelProvider`, and `Trip Composer` contracts used by data and scheduler documents.

- [ ] **Step 1: Verify the old documents lack hotel-frontier architecture**

Run:

```powershell
rg -n "330|NOT_YET_SEARCHABLE|HotelProvider|Trip Composer|Hotel Quote" 02_LONG_HORIZON_MONITORING.md 03_TECHNICAL_ARCHITECTURE.md
```

Expected: required combined-domain terms are absent.

- [ ] **Step 2: Rewrite `02_LONG_HORIZON_MONITORING.md`**

Use these exact top-level sections:

```markdown
# Long-Horizon Monitoring
## 1. Separate Horizons
## 2. Flight Rolling Horizon
## 3. Hotel Provider Frontiers
## 4. Availability States
## 5. Flight Tier Cadence
## 6. Selective Hotel Enrichment
## 7. Canonical Search Deduplication
## 8. Coverage Records
## 9. API Budget Priority
## 10. Long-Horizon UX
## 11. Alert Behavior
## 12. Minimum Acceptance Requirements
```

State explicitly:

```text
Flight user horizon: 365 days.
Technical flight horizon: 370 days.
Duffel Stays check-in frontier as verified on 2026-08-11: 330 days.
Dates outside an active hotel provider frontier: NOT_YET_SEARCHABLE.
```

Hotel scanning must be limited to active watchlists, enriched top flights, saved plans approaching expiry, and explicit verification.

- [ ] **Step 3: Rewrite `03_TECHNICAL_ARCHITECTURE.md`**

Define these components as separate modules:

```text
Flight Discovery
Flight Verification
Hotel Search
Hotel Quote Verification
Trip Composer
Ranking Engine
Coverage Planner
Watchlist Matcher
Alert Engine
Provider Health
```

Define exact provider interfaces:

```ts
interface FlightProvider {
  id: string;
  supportsIndicative: boolean;
  supportsLive: boolean;
  discover(input: FareSearchInput): Promise<NormalizedFlightOffer[]>;
  verify?(input: FareSearchInput): Promise<NormalizedFlightOffer[]>;
}

interface HotelProvider {
  id: string;
  maxCheckInLeadDays?: number;
  search(input: HotelSearchInput): Promise<NormalizedHotelOffer[]>;
  quote?(offerId: string): Promise<NormalizedHotelOffer>;
}
```

The architecture flow must be:

```text
broad flight discovery
-> bounded flight candidates
-> selective flight verification
-> exact Saudi local dates
-> Makkah and Madinah hotel searches
-> trip composition
-> deterministic ranking
-> watchlist matching and alerts
```

- [ ] **Step 4: Run focused checks**

Run:

```powershell
rg -n "365|370|330|NOT_YET_SEARCHABLE|interface FlightProvider|interface HotelProvider|Trip Composer|Saudi local" 02_LONG_HORIZON_MONITORING.md 03_TECHNICAL_ARCHITECTURE.md
```

Expected: every required term appears in the appropriate document.

---

### Task 4: Replace the Flight-Only Strategy with the Provider and Data Strategy

**Files:**
- Create: `04_PROVIDER_AND_DATA_STRATEGY.md`
- Remove after archive verification: `04_FLIGHT_DATA_STRATEGY.md`
- Reference: `archive/2026-08-09-flight-only/04_FLIGHT_DATA_STRATEGY.md`
- Reference: `docs/superpowers/specs/2026-08-11-umrah-trip-cost-optimizer-design.md`

**Interfaces:**
- Consumes: provider interfaces and coverage semantics from Task 3.
- Produces: provider roles, normalized offer requirements, caching, validation, and source-coverage rules.

- [ ] **Step 1: Verify the archived flight-only source hash before retirement**

Run:

```powershell
$archived = 'archive/2026-08-09-flight-only/04_FLIGHT_DATA_STRATEGY.md'
if (-not (Test-Path -LiteralPath $archived)) { throw 'Archived strategy is missing' }
Get-FileHash -Algorithm SHA256 -LiteralPath $archived
```

Expected: one SHA-256 hash.

- [ ] **Step 2: Create `04_PROVIDER_AND_DATA_STRATEGY.md`**

Use these exact top-level sections:

```markdown
# Provider and Data Strategy
## 1. Goal and Coverage Claim
## 2. Never Scrape
## 3. Flight Provider Roles
## 4. Hotel Provider Roles
## 5. Mock Provider Contract
## 6. Two-Stage Trip Discovery
## 7. Normalized Flight Offer
## 8. Normalized Hotel Offer
## 9. Trip Composition and Bounded Combinations
## 10. Price and FX Normalization
## 11. Cache Keys and Freshness
## 12. Provider Frontiers
## 13. Validation and Rejection Rules
## 14. Source Coverage Disclosure
```

Provider roles must be exact:

```text
Flight broad discovery: Travelpayouts or Aviasales Data API when configured.
Flight live verification: Duffel Flights when configured.
Hotel first real adapter: Duffel Stays after access is approved.
Hotel optional adapter: Booking.com Demand API after partner access is approved.
Flight and hotel mock adapters: always available.
```

Add configurable initial bounds:

```text
maxFlightsForHotelEnrichmentPerSearch = 5
maxHotelResultsPerCity = 10
maxTripPlansReturned = 20
maxConcurrentProviderRequests = 3
```

- [ ] **Step 3: Remove the retired root filename**

Delete only `04_FLIGHT_DATA_STRATEGY.md` from the canonical root after confirming the archived copy and hash. Do not delete the archived file.

- [ ] **Step 4: Verify canonical references**

Run:

```powershell
rg -n "04_FLIGHT_DATA_STRATEGY\.md" 00_README.md 01_PRODUCT_REQUIREMENTS.md 02_LONG_HORIZON_MONITORING.md 03_TECHNICAL_ARCHITECTURE.md 04_PROVIDER_AND_DATA_STRATEGY.md
```

Expected: no output.

Run:

```powershell
rg -n "Duffel Stays|Travelpayouts|Booking.com Demand API|Never Scrape|maxTripPlansReturned" 04_PROVIDER_AND_DATA_STRATEGY.md
```

Expected: all provider and bound terms appear.

---

### Task 5: Rewrite the Data Model and Backend Contracts

**Files:**
- Modify: `05_DATA_MODEL_AND_BACKEND.md`
- Reference: `docs/superpowers/specs/2026-08-11-umrah-trip-cost-optimizer-design.md`

**Interfaces:**
- Consumes: normalized offer types from Task 4.
- Produces: durable entities and backend names used by UI, scheduler, acceptance tests, and Freebuff prompt.

- [ ] **Step 1: Verify the old model is flight-only**

Run:

```powershell
rg -n "hotelProperties|hotelOffers|hotelObservations|tripPlans|calculationSnapshot" 05_DATA_MODEL_AND_BACKEND.md
```

Expected: no combined-domain entity set.

- [ ] **Step 2: Rewrite entity definitions**

Define all of these entities with TypeScript-shaped field contracts and indexes:

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

`hotelOffers` must include:

```ts
{
  provider: string;
  providerOfferId: string;
  propertyId: string;
  city: "MAKKAH" | "MADINAH";
  checkInDate: string;
  checkOutDate: string;
  adults: number;
  childrenAges: number[];
  rooms: number;
  totalAmount: number;
  currency: string;
  normalizedAmountIdr?: number;
  taxAmount?: number;
  mandatoryFeeAmount?: number;
  dueAtPropertyAmount?: number;
  priceCompleteness: PriceCompleteness;
  cancellationCategory?: "FULLY_REFUNDABLE" | "PARTIALLY_REFUNDABLE" | "NON_REFUNDABLE";
  boardType?: string;
  paymentType?: string;
  loyaltyProgrammeRequired?: boolean;
  bookingUrl?: string;
  verificationStatus: VerificationStatus;
  observedAt: number;
  expiresAt?: number;
}
```

`tripPlans` must reference one flight observation, one Makkah hotel observation, and one Madinah hotel observation. It must store a calculation snapshot containing component IDR amounts, excluded-cost labels, total IDR, completeness, FX timestamps, and calculation time.

- [ ] **Step 3: Define backend function names**

The document must define these contracts:

```text
flights.getCheapest
flights.getCalendar
flights.getHistory
hotels.searchCached
hotels.getOfferDetail
hotels.getHistory
trips.compose
trips.getCheapest
trips.getDetail
watchlists.listMine
watchlists.create
watchlists.update
watchlists.remove
alerts.listMine
alerts.markRead
admin.getProviderHealth
admin.getCoverageGaps
internal.flightDiscovery.scanRouteMonth
internal.flightVerification.verifyCandidates
internal.hotelSearch.enrichTripCandidates
internal.hotelQuote.verifyOffer
internal.tripComposer.composeBounded
internal.alertEngine.evaluate
```

- [ ] **Step 4: Run focused checks**

Run:

```powershell
rg -n "hotelProperties|hotelOffers|hotelObservations|tripPlans|calculation snapshot|internal\.tripComposer\.composeBounded|childrenAges|dueAtPropertyAmount" 05_DATA_MODEL_AND_BACKEND.md
```

Expected: all entity and contract terms appear.

---

### Task 6: Rewrite UI, Alerts, and Scheduler Specifications

**Files:**
- Modify: `06_UI_UX_SPEC.md`
- Modify: `07_ALERTS_AND_SCHEDULER.md`
- Reference: `docs/superpowers/specs/2026-08-11-umrah-trip-cost-optimizer-design.md`

**Interfaces:**
- Consumes: product terms, backend contracts, and coverage states from Tasks 2 through 5.
- Produces: visible behavior and background orchestration requirements.

- [ ] **Step 1: Verify missing complete-trip UI and canonical hotel search rules**

Run:

```powershell
rg -n "Cari Total Umrah Termurah|Not included|canonical hotel search|COMPLETE_TRIP|NOT_YET_SEARCHABLE" 06_UI_UX_SPEC.md 07_ALERTS_AND_SCHEDULER.md
```

Expected: required combined-domain behavior is absent.

- [ ] **Step 2: Rewrite `06_UI_UX_SPEC.md`**

Use these exact navigation labels:

```text
Total Termurah
Tiket
Hotel
Kalender
Pantauan Saya
Tentang
```

Use this exact homepage headline:

```text
Cari Total Umrah Termurah
```

Define:

- a search form for origins, flexible dates, adults, child ages, rooms, Makkah nights, Madinah nights, patterns, city order, stop limits, layover limits, hotel radius, and free cancellation;
- four summary cards for complete total, flight, Makkah hotel, and Madinah hotel;
- a complete-trip card whose component subtotals equal the displayed total;
- separate treatment for complete and partial totals;
- `Not included` disclosure for ground transfer, visa, and excluded meals;
- accurate straight-line distance wording;
- reservation confirmation and visa-approval reminder text from design section 15;
- component history, coverage disclosure, empty states, mobile 360 px behavior, keyboard access, and text status labels.

- [ ] **Step 3: Rewrite `07_ALERTS_AND_SCHEDULER.md`**

Define:

```text
global flight observation pool
+ canonical hotel search pool
+ user watchlist matching
+ bounded trip composition
```

Define `WatchlistType = FLIGHT | HOTEL | COMPLETE_TRIP` and the canonical hotel search key from design section 10.

Complete-trip alerts require complete normalized totals and fresh components. Keep default cooldown at 24 hours and material drop at 3 percent. Define scan locks, provider budgets, retry rules, 429 behavior, quote expiry behavior, and failure isolation.

- [ ] **Step 4: Run focused checks**

Run:

```powershell
rg -n "Cari Total Umrah Termurah|Not included|straight-line|360 px|canonical hotel search|COMPLETE_TRIP|24 hours|3 percent|NOT_YET_SEARCHABLE" 06_UI_UX_SPEC.md 07_ALERTS_AND_SCHEDULER.md
```

Expected: every required UX and scheduler term appears.

---

### Task 7: Rewrite the Future App Implementation Plan and Acceptance Suite

**Files:**
- Modify: `08_IMPLEMENTATION_PLAN.md`
- Modify: `09_ACCEPTANCE_TESTS.md`
- Reference: `docs/superpowers/specs/2026-08-11-umrah-trip-cost-optimizer-design.md`

**Interfaces:**
- Consumes: all canonical contracts from Tasks 2 through 6.
- Produces: the milestone sequence and objective release gate used by Freebuff.

- [ ] **Step 1: Replace `08_IMPLEMENTATION_PLAN.md` with milestone gates**

Use this exact milestone order:

```text
Phase 0: Scaffold audit and mock-only boot
Phase 1: Shared types, price arithmetic, and validation
Phase 2: Data model and deterministic mock providers
Phase 3: Flight discovery and calendar
Phase 4: Hotel exact-date search and component views
Phase 5: Flight verification and hotel date derivation
Phase 6: Trip Composer and complete-total ranking
Phase 7: Watchlists, scheduler, and in-app alerts
Phase 8: Admin observability and email adapter
Phase 9: Travelpayouts flight adapter
Phase 10: Duffel Flights adapter
Phase 11: Duffel Stays adapter
Phase 12: Optional Booking.com adapter after partner approval
Phase 13: Security, accessibility, and release gate
```

Each phase must contain deliverables, tests, stop conditions, and a statement that mock mode remains operational. Real providers must be integrated one at a time.

- [ ] **Step 2: Replace `09_ACCEPTANCE_TESTS.md`**

Create checkbox sections for:

```text
A. Source Preservation and Package Integrity
B. Search Inputs and Validation
C. Journey and Hotel Date Alignment
D. Flight Data
E. Hotel Data
F. Complete Price Arithmetic
G. Availability and Provider Frontiers
H. Scheduler and Deduplication
I. Watchlists and Alerts
J. Mock Mode
K. Provider Security and Failure Isolation
L. UI and Accessibility
M. Admin and Observability
N. Freebuff Handoff
Mandatory Release Gate
```

Include explicit checks for hotel day 331 using `NOT_YET_SEARCHABLE`, party-total versus per-person separation, room and night multiplication, taxes, due-at-property amounts, FX timestamps, complete versus partial ranking, no per-user full scan, 360px UI, source archive hashes, and the final validator.

- [ ] **Step 3: Verify milestone and test coverage**

Run:

```powershell
rg -n "Phase 0|Phase 13|Mock|Flight|Hotel|Trip Composer|Release Gate" 08_IMPLEMENTATION_PLAN.md
rg -n "Hotel day 331|Party flight total|due-at-property|360px|Mandatory Release Gate|SOURCE_HASHES|validate-spec" 09_ACCEPTANCE_TESTS.md
```

Expected: all milestones and critical acceptance checks appear.

---

### Task 8: Rewrite the Freebuff Prompt and References, Then Add the Handoff Contract

**Files:**
- Modify: `10_FREEBUFF_MASTER_PROMPT.md`
- Modify: `11_REFERENCE_SOURCES.md`
- Create: `12_HANDOFF_TO_FREEBUFF.md`
- Reference: `docs/superpowers/specs/2026-08-11-umrah-trip-cost-optimizer-design.md`

**Interfaces:**
- Consumes: the complete canonical package.
- Produces: the receiving-model instructions and source basis.

- [ ] **Step 1: Rewrite `10_FREEBUFF_MASTER_PROMPT.md`**

Start with this contract:

```text
Build Umrah Fare Watch from the canonical numbered Markdown files in this folder.
Target worker model: DeepSeek V4 Flash 07/31 or GLM 5.2.
Read all canonical files in numeric order before changing code.
Do not scrape. Do not claim provider access that has not been tested.
Keep mock mode passing after every milestone.
```

The prompt must restate the product promise, complete-total formula, component boundaries, 365 and 370 flight horizons, provider-specific hotel frontier, provider roles, availability states, phased workflow, security rules, checkpoint evidence, and release gate.

- [ ] **Step 2: Rewrite `11_REFERENCE_SOURCES.md`**

Include verified date `2026-08-11` and these labelled sources:

```text
Community input:
https://www.threads.com/@sabbounty/post/Db3hlGBga90

Duffel Stays getting started:
https://duffel.com/docs/guides/getting-started-with-stays

Duffel Stays search:
https://duffel.com/docs/api/v2/search

Duffel Stays key concepts:
https://duffel.com/docs/api/overview/stays-key-concepts

Booking.com Demand accommodations:
https://developers.booking.com/demand/docs/accommodations/about-accommodation

Travelpayouts Aviasales Data API:
https://support.travelpayouts.com/hc/en-us/articles/203956163-Aviasales-Data-API

Duffel Flights offer requests:
https://duffel.com/docs/api/v2/offer-requests

Convex cron jobs:
https://docs.convex.dev/scheduling/cron-jobs

Convex scheduled functions:
https://docs.convex.dev/scheduling/scheduled-functions
```

State that community comments are qualitative input and official documentation governs technical behavior.

- [ ] **Step 3: Create `12_HANDOFF_TO_FREEBUFF.md`**

Use these exact top-level sections:

```markdown
# Handoff to Freebuff
## Package Status
## Canonical Read Order
## Worker Model
## First Response Contract
## Milestone Loop
## Mock-First Rule
## Provider Access Gates
## Stop Conditions
## Evidence Before Completion
## Forbidden Shortcuts
## Final Completion Report
```

The first response contract must require the worker to report:

```text
1. actual scaffold detected;
2. active milestone;
3. files to change;
4. tests to run;
5. credentials or provider access needed;
6. assumptions rejected or confirmed.
```

Stop conditions must include missing provider access, incompatible scaffold, ambiguous migration that risks user data, and any request to bypass scraping or secret-safety rules.

- [ ] **Step 4: Verify prompt and handoff terms**

Run:

```powershell
rg -n "DeepSeek V4 Flash 07/31|GLM 5.2|mock mode|do not scrape|365|370|provider" 10_FREEBUFF_MASTER_PROMPT.md
rg -n "Read Order|Stop Conditions|Evidence Before Completion|First Response Contract|Forbidden Shortcuts" 12_HANDOFF_TO_FREEBUFF.md
```

Expected: every model and control term appears.

---

### Task 9: Run Cross-Document Validation and Repair Inconsistencies

**Files:**
- Modify as required: `00_README.md` through `12_HANDOFF_TO_FREEBUFF.md`
- Modify if validation changes are required: `tools/validate-spec.ps1`

**Interfaces:**
- Consumes: all canonical documents.
- Produces: a package with no unresolved markers, forbidden dash characters, retired references, or missing required contracts.

- [ ] **Step 1: Run the full validator**

Run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/validate-spec.ps1
```

Expected: `PASS: specification package validated (13 canonical files)`.

- [ ] **Step 2: Scan the canonical package for forbidden dash characters**

Run:

```powershell
$canonical = Get-ChildItem -File |
  Where-Object { $_.Name -match '^(0[0-9]|1[0-2])_' }
$hits = $canonical | Select-String -Pattern '[\u2013\u2014\u2015\u2212]'
if ($hits) { $hits; exit 1 }
'PASS: no forbidden dash characters'
```

Expected: `PASS: no forbidden dash characters`.

- [ ] **Step 3: Scan for unresolved markers without embedding them literally in the documents**

Run:

```powershell
$markers = @('T' + 'BD', 'T' + 'ODO', 'F' + 'IXME')
$hits = foreach ($marker in $markers) {
  $canonical | Select-String -SimpleMatch $marker
}
if ($hits) { $hits; exit 1 }
'PASS: no unresolved markers'
```

Expected: `PASS: no unresolved markers`.

- [ ] **Step 4: Verify critical terms are consistent across files**

Run:

```powershell
rg -n "365 days|370 days|330 days|NOT_YET_SEARCHABLE|PriceCompleteness|COMPLETE_TRIP|termurah yang ditemukan" 00_README.md 01_PRODUCT_REQUIREMENTS.md 02_LONG_HORIZON_MONITORING.md 03_TECHNICAL_ARCHITECTURE.md 04_PROVIDER_AND_DATA_STRATEGY.md 05_DATA_MODEL_AND_BACKEND.md 06_UI_UX_SPEC.md 07_ALERTS_AND_SCHEDULER.md 08_IMPLEMENTATION_PLAN.md 09_ACCEPTANCE_TESTS.md 10_FREEBUFF_MASTER_PROMPT.md 12_HANDOFF_TO_FREEBUFF.md
```

Expected: terminology is present where relevant and has one meaning.

- [ ] **Step 5: Verify source archive integrity again**

Run the Task 1 hash verification command again.

Expected: `PASS: archive hashes match`.

---

### Task 10: Finalize Planning Records and Produce the Handoff Evidence

**Files:**
- Modify: `task_plan.md`
- Modify: `findings.md`
- Modify: `progress.md`
- Read: all canonical documents and validator output.

**Interfaces:**
- Consumes: completed canonical package and validation evidence.
- Produces: final audit trail and user-facing handoff summary.

- [ ] **Step 1: Update `task_plan.md`**

Mark Phase 2 and Phase 3 complete. Mark Phase 4 complete only after the validator and archive hashes pass. Mark Phase 5 complete only after the final file inventory and user-facing handoff summary are ready.

- [ ] **Step 2: Update `findings.md`**

Record final provider decisions, horizon semantics, archive path, canonical file count, and any known external access requirements. Keep Threads content labelled as qualitative input.

- [ ] **Step 3: Update `progress.md` with exact evidence**

Record:

```text
archive hash verification result
canonical validator result
forbidden dash scan result
unresolved marker scan result
canonical file inventory
files created, replaced, retired, and archived
```

- [ ] **Step 4: Produce the final inventory**

Run:

```powershell
Get-ChildItem -File |
  Where-Object { $_.Name -match '^(0[0-9]|1[0-2])_' -or $_.Name -in @('task_plan.md','findings.md','progress.md') } |
  Sort-Object Name |
  Select-Object Name,Length,LastWriteTime
```

Expected: 13 canonical numbered files plus the three planning files.

- [ ] **Step 5: Run the final gate once more**

Run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/validate-spec.ps1
```

Expected: `PASS: specification package validated (13 canonical files)`.

- [ ] **Step 6: Prepare the user handoff**

The final response must link to:

```text
00_README.md
10_FREEBUFF_MASTER_PROMPT.md
12_HANDOFF_TO_FREEBUFF.md
docs/superpowers/specs/2026-08-11-umrah-trip-cost-optimizer-design.md
progress.md
```

State that the original 12 documents are preserved under `archive/2026-08-09-flight-only/`, identify that the folder is not a Git repository, and quote the final validator outcome exactly.

---

## Plan Self-Review Result

- Spec coverage: all approved design sections map to Tasks 2 through 8.
- Source preservation: Task 1 archives and hashes all 12 originals before canonical changes.
- File responsibility: every canonical file has one primary purpose.
- Type consistency: `PriceCompleteness`, `VerificationStatus`, `AvailabilityState`, `WatchlistType`, `FlightProvider`, `HotelProvider`, and `tripPlans` use consistent names across tasks.
- Horizon consistency: 365 user flight days, 370 technical flight days, and provider-specific hotel frontier with 330-day Duffel Stays evidence.
- Provider consistency: mock always, Travelpayouts flight discovery, Duffel Flights live, Duffel Stays first hotel, Booking.com optional after partner access.
- Release evidence: archive hashes, canonical validator, dash scan, marker scan, and final inventory are mandatory.
- Git handling: no commit step is included because the current folder is not a Git repository.
