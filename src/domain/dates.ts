// Pure date helpers. Local dates are ISO "YYYY-MM-DD" strings.
// Saudi local dates are derived from a UTC instant plus an explicit offset in
// minutes, avoiding any dependency on the host timezone database.

const DAY_MS = 86_400_000;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function todayLocalDate(now: Date): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString().slice(0, 10);
}

/** Add whole days to a local date using UTC-based calendar math. */
export function addDays(localDate: string, days: number): string {
  const { y, m, d } = parseLocalDate(localDate);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

/** Local calendar date at a UTC instant shifted by offsetMinutes. */
export function localDateAt(utcInstant: string, offsetMinutes: number): string {
  const shifted = new Date(new Date(utcInstant).getTime() + offsetMinutes * 60_000);
  return shifted.toISOString().slice(0, 10);
}

/** Whole days from the UTC date of `now` to `localDate` (negative when past). */
export function daysUntil(localDate: string, now: Date): number {
  const target = dateToUtcMs(localDate);
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((target - today) / DAY_MS);
}

/** Whole days from local date a to local date b (positive when b is later). */
export function dateDiffDays(a: string, b: string): number {
  return Math.round((dateToUtcMs(b) - dateToUtcMs(a)) / DAY_MS);
}

export function isBefore(a: string, b: string): boolean {
  return a < b;
}

export function isAfter(a: string, b: string): boolean {
  return a > b;
}

export function isLocalDate(value: string): boolean {
  return DATE_RE.test(value);
}

function parseLocalDate(value: string): { y: number; m: number; d: number } {
  if (!DATE_RE.test(value)) {
    throw new Error(`invalid local date: ${value}`);
  }
  const [y, m, d] = value.split("-").map((p) => Number.parseInt(p, 10));
  return { y: y as number, m: m as number, d: d as number };
}

function dateToUtcMs(localDate: string): number {
  const { y, m, d } = parseLocalDate(localDate);
  return Date.UTC(y, m - 1, d);
}

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export function formatLocalDate(localDate: string): string {
  const { y, m, d } = parseLocalDate(localDate);
  return dateFormatter.format(new Date(Date.UTC(y, m - 1, d)));
}
