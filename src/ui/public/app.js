/* Umrah Fare Watch - client logic (vanilla JS, no build step). */
"use strict";

const DISCLAIMER =
  "Harga dan ketersediaan dapat berubah. Hasil membandingkan provider yang aktif saat observasi, bukan seluruh penawaran di internet. Verifikasi total, syarat refund, detail reservasi hotel, persyaratan visa, dan kebijakan provider sebelum booking.";

const HOTEL_REMINDER =
  "Setelah memesan, konfirmasikan nomor reservasi langsung ke hotel. Untuk kebutuhan visa, pastikan persyaratan dan proses approval melalui sumber resmi atau provider visa Anda.";

const PROGRESS_STEPS = [
  "Mencari kandidat tiket",
  "Memverifikasi jadwal terpilih",
  "Mencari hotel Makkah",
  "Mencari hotel Madinah",
  "Menghitung total lengkap",
];

const STATE_LABELS = {
  HAS_RESULT: "Tersedia",
  NO_RESULT: "Tanpa hasil",
  NOT_SCANNED: "Belum dipindai",
  NOT_YET_PUBLISHED: "Belum diterbitkan",
  NOT_YET_SEARCHABLE: "Belum bisa dicari",
  PROVIDER_UNAVAILABLE: "Provider sibuk",
};

const PLAN_STATUS_LABELS = {
  LIVE_COMPLETE: "Lengkap, terverifikasi",
  INDICATIVE_COMPLETE: "Lengkap, indikatif",
  PARTIAL: "Belum lengkap",
  STALE: "Harga lama",
  EXPIRED: "Kedaluwarsa",
};

const COMPLETENESS_LABELS = {
  COMPLETE: "COMPLETE",
  PARTIAL_FEES_UNKNOWN: "Biaya wajib belum diketahui",
  PARTIAL_FX_MISSING: "Nilai tukar belum tersedia",
  COMPONENT_MISSING: "Komponen belum lengkap",
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function esc(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[ch]);
}

function formatIdr(minor) {
  if (minor == null) return "-";
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(minor);
}

function formatDate(localDate) {
  if (!localDate) return "-";
  const [y, m, d] = localDate.split("-").map(Number);
  if (!y || !m || !d) return localDate;
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d)));
}

function formatDateTime(iso) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

function localToday() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDaysLocal(dateStr, days) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

/* ---------- form state ---------- */

function setFieldError(name, message) {
  const el = document.querySelector(`[data-for="${name}"]`);
  if (el) el.textContent = message || "";
  const input = document.querySelector(`[name="${name}"]`);
  if (input) {
    if (message) input.setAttribute("aria-invalid", "true");
    else input.removeAttribute("aria-invalid");
  }
}

function clearErrors() {
  $$(".field-error").forEach((el) => (el.textContent = ""));
  $$("[aria-invalid='true']").forEach((el) => el.removeAttribute("aria-invalid"));
}

function renderChildrenAges() {
  const count = Math.max(0, Math.min(10, Number($("#childrenCount").value) || 0));
  const wrap = $("#children-ages-wrap");
  const container = $("#children-ages");
  if (count <= 0) {
    wrap.hidden = true;
    container.innerHTML = "";
    return;
  }
  wrap.hidden = false;
  const existing = Array.from(container.querySelectorAll("input")).map((i) => i.value);
  let html = "";
  for (let i = 0; i < count; i += 1) {
    const value = existing[i] !== undefined ? esc(existing[i]) : "";
    html += `<label class="sr-only" for="child-age-${i}">Umur anak ${i + 1}</label>
      <input class="age-input" type="number" id="child-age-${i}" name="childAges" min="0" max="17" value="${value}" inputmode="numeric" aria-label="Umur anak ${i + 1} (tahun)">`;
  }
  container.innerHTML = html;
}

function updateNightsSummary() {
  const makkah = Math.max(0, Number($("#makkahNights").value) || 0);
  const madinah = Math.max(0, Number($("#madinahNights").value) || 0);
  $("#totalNights").textContent = String(makkah + madinah);
  const order = $("#cityOrder").value;
  const preview =
    order === "MAKKAH_FIRST" ? "Urutan kota: Makkah lalu Madinah"
    : order === "MADINAH_FIRST" ? "Urutan kota: Madinah lalu Makkah"
    : "Urutan kota otomatis: tiba di Jeddah berarti Makkah dahulu, tiba di Madinah berarti Madinah dahulu";
  $("#cityPreview").textContent = preview;
}

function readForm() {
  const origins = $$("input[name='origins']:checked").map((i) => i.value);
  const patterns = $$("input[name='patterns']:checked").map((i) => i.value);
  const childrenAges = Array.from(document.querySelectorAll("input[name='childAges']")).map((i) => Number(i.value));
  const maxStopsRaw = $("#maxStops").value;
  const maxLayoverRaw = $("#maxLayoverMinutes").value;
  const maxDurationRaw = $("#maxTripDurationMinutes").value;
  return {
    origins,
    departureStart: $("#departureStart").value,
    departureEnd: $("#departureEnd").value,
    adults: Number($("#adults").value),
    childrenAges,
    rooms: Number($("#rooms").value),
    makkahNights: Number($("#makkahNights").value),
    madinahNights: Number($("#madinahNights").value),
    patterns,
    cityOrder: $("#cityOrder").value,
    cabin: $("#cabin").value,
    maxStops: maxStopsRaw === "" ? undefined : Number(maxStopsRaw),
    maxLayoverMinutes: maxLayoverRaw === "" ? undefined : Number(maxLayoverRaw),
    maxTripDurationMinutes: maxDurationRaw === "" ? undefined : Number(maxDurationRaw),
    makkahRadiusKm: Number($("#makkahRadiusKm").value),
    madinahRadiusKm: Number($("#madinahRadiusKm").value),
    freeCancellationOnly: $("#freeCancellationOnly").checked,
    currency: "IDR",
  };
}

function validateForm(input) {
  clearErrors();
  let firstError = null;
  const report = (name, message) => {
    setFieldError(name, message);
    if (!firstError) firstError = document.querySelector(`[name="${name}"]`);
  };
  if (input.origins.length === 0) report("origins", "Pilih minimal satu bandara asal");
  if (!input.departureStart) report("departureStart", "Tanggal berangkat diperlukan");
  if (!input.departureEnd) report("departureEnd", "Tanggal akhir diperlukan");
  if (input.departureStart && input.departureEnd && input.departureStart > input.departureEnd) {
    report("departureEnd", "Tanggal akhir tidak boleh sebelum tanggal awal");
  }
  if (input.patterns.length === 0) report("patterns", "Pilih minimal satu pola perjalanan");
  if (!(input.adults >= 1)) report("adults", "Minimal satu dewasa");
  if (input.adults < input.rooms) report("adults", "Minimal satu dewasa per kamar");
  if (!(input.makkahNights >= 1)) report("makkahNights", "Minimal satu malam");
  if (!(input.madinahNights >= 1)) report("madinahNights", "Minimal satu malam");
  if (input.childrenAges.some((a) => !Number.isFinite(a) || a < 0 || a > 17)) {
    report("childrenAges", "Semua umur anak harus valid (0 sampai 17)");
  }
  return firstError;
}

/* ---------- progress + search ---------- */

async function runSearch() {
  const input = readForm();
  const firstError = validateForm(input);
  if (firstError) {
    firstError.focus();
    return;
  }

  const panel = $("#progress-panel");
  const steps = $("#progress-steps");
  panel.hidden = false;
  steps.innerHTML = PROGRESS_STEPS.map((s) => `<li>${esc(s)}</li>`).join("");
  const items = $$("#progress-steps li");

  let activeIndex = 0;
  const advance = () => {
    items.forEach((li, i) => {
      li.className = i < activeIndex ? "done" : i === activeIndex ? "active" : "";
    });
    activeIndex = Math.min(activeIndex + 1, items.length - 1);
  };
  advance();

  const submitBtn = $("#submitBtn");
  submitBtn.disabled = true;

  let response;
  try {
    const fetchPromise = fetch("/api/search/trip", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const timer = new Promise((resolve) => {
      const interval = setInterval(() => {
        advance();
        if (activeIndex >= items.length - 1) {
          clearInterval(interval);
          resolve();
        }
      }, 320);
    });
    const [res] = await Promise.all([fetchPromise, timer]);
    response = res;
  } finally {
    submitBtn.disabled = false;
  }

  items.forEach((li, i) => (li.className = i === items.length - 1 ? "done" : "done"));

  if (!response.ok) {
    let errors = [];
    let message = "Pencarian gagal diproses server";
    try {
      const body = await response.json();
      if (body.errors && Array.isArray(body.errors)) errors = body.errors;
      if (body.message) message = body.message;
    } catch (_e) {
      /* non-JSON error body */
    }
    panel.hidden = true;
    renderServerErrors(errors.length > 0 ? errors : [{ field: "server", code: "ERROR", message }]);
    return;
  }

  const data = await response.json();
  panel.hidden = true;
  renderResults(data);
}

function renderServerErrors(errors) {
  clearErrors();
  const banner = document.createElement("div");
  banner.className = "error-banner";
  banner.setAttribute("role", "alert");
  banner.innerHTML = "<strong>Periksa kembali input Anda:</strong>";
  const list = document.createElement("ul");
  errors.forEach((e) => {
    const li = document.createElement("li");
    li.textContent = e.message;
    list.appendChild(li);
  });
  banner.appendChild(list);
  $("#results").hidden = true;
  const searchSection = $(".search-section .container");
  const existing = searchSection.querySelector(".error-banner");
  if (existing) existing.remove();
  searchSection.insertBefore(banner, $("#search-form"));
  const field = document.querySelector(`[name="${errors[0] && errors[0].field ? errors[0].field.split(".")[0] : "server"}"]`);
  if (field) field.focus();
}

/* ---------- rendering ---------- */

function badge(state, label) {
  return `<span class="status-badge" data-state="${esc(state)}">${esc(label)}</span>`;
}

function renderResults(data) {
  const resultsEl = $("#results");
  resultsEl.hidden = false;

  const header = $("#results-header");
  const providers = data.activeProviders.map((p) => p.id.replace("mock-", "Mock ")).join(", ");
  const makkahBadge = badge(data.coverage.makkahHotel, STATE_LABELS[data.coverage.makkahHotel] || data.coverage.makkahHotel);
  const madinahBadge = badge(data.coverage.madinahHotel, STATE_LABELS[data.coverage.madinahHotel] || data.coverage.madinahHotel);
  header.innerHTML = `
    <h2>Hasil pencarian</h2>
    <p><strong>Provider aktif:</strong> ${esc(providers)} (mode demo, data sintetis). Waktu observasi: ${esc(formatDateTime(data.observedAt))}.</p>
    <p><strong>Cakupan:</strong> Tiket ${badge(data.coverage.flight, STATE_LABELS[data.coverage.flight] || data.coverage.flight)} &nbsp; Hotel Makkah ${makkahBadge} &nbsp; Hotel Madinah ${madinahBadge}</p>
    ${data.coverage.hotelFrontierDate ? `<p>Hotel dapat dicari sampai tanggal ${esc(formatDate(data.coverage.hotelFrontierDate))} (frontier provider).</p>` : ""}
  `;

  renderSummaryCards(data);
  renderPlanList("#plan-list", data.results, false);
  const partialSection = $("#partial-section");
  if (data.partialResults.length > 0) {
    partialSection.hidden = false;
    renderPlanList("#partial-list", data.partialResults, true);
  } else {
    partialSection.hidden = true;
  }

  const warningsEl = $("#warnings");
  if (data.warnings.length > 0) {
    warningsEl.hidden = false;
    warningsEl.innerHTML = `<h3>Catatan</h3><ul>${data.warnings.map((w) => `<li>${esc(w)}</li>`).join("")}</ul>`;
  } else {
    warningsEl.hidden = true;
  }

  $("#results-disclaimer").innerHTML = esc(DISCLAIMER);
  $("#results").scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderSummaryCards(data) {
  const plans = data.results;
  const trip = plans[0];
  const minFlight = minSubtotal(plans, "flight");
  const minMakkah = minSubtotal(plans, "makkah");
  const minMadinah = minSubtotal(plans, "madinah");
  const wrap = $("#summary-cards");
  wrap.innerHTML = `
    <div class="summary-card featured">
      <h3>Complete trip termurah</h3>
      <div class="amount">${formatIdr(trip ? trip.tripTotalIdrMinor : null)}</div>
      ${trip ? `<div class="note">setara per orang ${formatIdr(trip.perPersonEquivalentIdrMinor)}</div>` : `<div class="note">Belum ada kombinasi lengkap</div>`}
    </div>
    <div class="summary-card">
      <h3>Tiket termurah</h3>
      <div class="amount">${formatIdr(minFlight)}</div>
      <div class="note">Tiket untuk semua penumpang</div>
    </div>
    <div class="summary-card">
      <h3>Hotel Makkah termurah</h3>
      <div class="amount">${formatIdr(minMakkah)}</div>
      <div class="note">Semua kamar, semua malam</div>
    </div>
    <div class="summary-card">
      <h3>Hotel Madinah termurah</h3>
      <div class="amount">${formatIdr(minMadinah)}</div>
      <div class="note">Semua kamar, semua malam</div>
    </div>
  `;
}

function minSubtotal(plans, key) {
  const values = plans.map((p) => p.subtotals[key]).filter((v) => v != null);
  if (values.length === 0) return null;
  return Math.min(...values);
}

function renderPlanList(selector, plans, partial) {
  const wrap = $(selector);
  if (plans.length === 0) {
    wrap.innerHTML = `<p class="results-sub">Tidak ada kombinasi untuk bagian ini.</p>`;
    return;
  }
  wrap.innerHTML = plans.map((plan) => planCard(plan, partial)).join("");
}

function planCard(plan, partial) {
  const total = plan.tripTotalIdrMinor;
  const statusLabel = PLAN_STATUS_LABELS[plan.tripPlanStatus] || plan.tripPlanStatus;
  const completenessLabel = COMPLETENESS_LABELS[plan.priceCompleteness] || plan.priceCompleteness;
  const dates = plan.dates;
  const f = plan.flight;
  const mk = plan.makkahHotel;
  const md = plan.madinahHotel;

  const breakdown = `
    <div class="breakdown">
      <div class="breakdown-row"><span class="label">Tiket untuk semua penumpang</span><span class="value">${formatIdr(plan.subtotals.flight)}</span></div>
      <div class="breakdown-row"><span class="label">Hotel Makkah (${esc(plan.dates.makkahCheckIn ? formatDate(plan.dates.makkahCheckIn) : "-")} sampai ${esc(plan.dates.makkahCheckOut ? formatDate(plan.dates.makkahCheckOut) : "-")})</span><span class="value">${formatIdr(plan.subtotals.makkah)}</span></div>
      <div class="breakdown-row"><span class="label">Hotel Madinah (${esc(plan.dates.madinahCheckIn ? formatDate(plan.dates.madinahCheckIn) : "-")} sampai ${esc(plan.dates.madinahCheckOut ? formatDate(plan.dates.madinahCheckOut) : "-")})</span><span class="value">${formatIdr(plan.subtotals.madinah)}</span></div>
      <div class="breakdown-row total-row"><span class="label">Total perjalanan</span><span class="value">${formatIdr(total)}</span></div>
    </div>`;

  const flightDetail = `
    <div class="detail-block">
      <h4>Tiket: ${esc(f.airline)}</h4>
      <ul>
        <li>Rute ${esc(f.airports.outbound)} ke ${esc(f.airports.returnAirport)} (${esc(plan.pattern.replace(/_/g, " "))}), ${esc(f.stops)} transit, durasi ${esc(formatMinutes(f.durationMinutes))}</li>
        <li>Verifikasi: ${esc(f.verificationStatus)}, terakhir diverifikasi ${esc(formatDateTime(f.observedAt))}</li>
        <li>Kedaluwarsa: ${esc(formatDateTime(f.expiresAt))}</li>
      </ul>
    </div>`;

  const hotelBlock = (h, label) => {
    if (!h) return "";
    return `
      <div class="detail-block">
        <h4>${esc(label)}: ${esc(h.propertyName)}</h4>
        <ul>
          <li>${esc(h.roomName)} (${esc(h.rateName)}), ${esc(h.boardType)}</li>
          <li>Jarak ${esc(h.straightLineDistanceKm)} km (${esc(h.distanceSemantic.toLowerCase())})</li>
          <li>Pembatalan: ${esc(h.freeCancellation ? "gratis sebelum " + formatDate(h.cancellationDeadline) : "tidak refundable")}</li>
          <li>Bayar sekarang ${formatIdr(h.dueNowAmountMinor)}, bayar di properti ${formatIdr(h.dueAtPropertyAmountMinor)}</li>
          <li>Provider ${esc(h.providerId)}, terakhir diverifikasi ${esc(formatDateTime(h.observedAt))}</li>
        </ul>
      </div>`;
  };

  const actions = [];
  if (f.bookingUrl) {
    actions.push(`<a class="btn btn-ghost" href="${esc(f.bookingUrl)}" target="_blank" rel="noopener" onclick="return confirm('Tautan ini adalah demo sintetis dari provider mock, bukan booking asli. Lanjut?')">Buka sumber booking (demo)</a>`);
  }
  actions.push(`<button type="button" class="btn btn-ghost" data-toggle-detail="${esc(plan.id)}">Lihat rincian biaya</button>`);

  return `
    <article class="plan-card${partial ? " partial" : ""}" data-plan-id="${esc(plan.id)}">
      <div class="plan-total-row">
        <div>
          <span class="plan-total">${formatIdr(total)}</span>
          ${total != null ? `<span class="unit">setara per orang ${formatIdr(plan.perPersonEquivalentIdrMinor)}</span>` : ""}
        </div>
        <div class="badge-row">${badge(plan.tripPlanStatus, statusLabel)}${badge(plan.priceCompleteness, completenessLabel)}</div>
      </div>
      <p class="plan-meta">${esc(formatDate(dates.makkahCheckIn))} sampai ${esc(formatDate(dates.madinahCheckOut))} &middot; ${esc(plan.adults)} dewasa${plan.childrenAges.length ? ", " + esc(plan.childrenAges.length) + " anak" : ""} &middot; ${esc(plan.rooms)} kamar &middot; urutan kota ${esc(plan.firstCity)} lalu ${esc(plan.secondCity)}</p>
      ${breakdown}
      <div class="plan-detail-grid" id="detail-${esc(plan.id)}" hidden>
        ${flightDetail}
        ${hotelBlock(mk, "Hotel Makkah")}
        ${hotelBlock(md, "Hotel Madinah")}
      </div>
      <p class="include-list"><strong>Termasuk:</strong> ${esc(plan.included.join(", "))}<br><strong>Not included:</strong> ${esc(plan.notIncluded.join(", "))}</p>
      ${plan.reasons.length ? `<p class="include-list"><strong>Alasan status:</strong> ${esc(plan.reasons.join("; "))}</p>` : ""}
      <div class="plan-actions">${actions.join("")}</div>
    </article>`;
}

function formatMinutes(minutes) {
  if (!Number.isFinite(minutes)) return "-";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h} j ${m} m` : `${m} m`;
}

/* ---------- wiring ---------- */

function init() {
  const today = localToday();
  $("#departureStart").value = today;
  $("#departureEnd").value = addDaysLocal(today, 14);

  $("#childrenCount").addEventListener("input", renderChildrenAges);
  ["makkahNights", "madinahNights", "cityOrder"].forEach((id) => {
    document.getElementById(id).addEventListener("input", updateNightsSummary);
    document.getElementById(id).addEventListener("change", updateNightsSummary);
  });
  updateNightsSummary();

  $("#search-form").addEventListener("submit", (event) => {
    event.preventDefault();
    runSearch();
  });

  $("#how-calc-toggle").addEventListener("click", () => {
    const panel = $("#how-calc");
    const isHidden = panel.hidden;
    panel.hidden = !isHidden;
    $("#how-calc-toggle").setAttribute("aria-expanded", String(isHidden));
  });

  document.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-toggle-detail]");
    if (btn) {
      const id = btn.getAttribute("data-toggle-detail");
      const detail = document.getElementById(`detail-${id}`);
      if (detail) detail.hidden = !detail.hidden;
    }
  });

  $("#footer-disclaimer").textContent = DISCLAIMER;
  $("#about-disclaimer").textContent = DISCLAIMER;
  $("#results-disclaimer").textContent = DISCLAIMER;
  $("#hotel-reminder").textContent = HOTEL_REMINDER;
}

document.addEventListener("DOMContentLoaded", init);
