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
if ($canonicalText -match '(?im)^\s*-\s*hotel monitoring\s*;?\s*$') {
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
