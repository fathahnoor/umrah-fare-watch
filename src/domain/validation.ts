// Search input validation shared by client and server (INPUT-01..07).
// Server-side maximums apply even when client validation is bypassed.
import { z } from "zod";
import { isWithinUserHorizon } from "./horizons.js";
import type { TripSearchInput, ValidationIssue } from "./types.js";

export const INDONESIAN_ORIGINS = [
  "CGK", "SUB", "DPS", "KNO", "BPN", "UPG", "BDO", "HLP", "SRG", "SOC",
  "PDG", "PLM", "BDJ", "MDC", "TIM", "LOP", "JOG", "MKS", "BTJ", "AMI",
] as const;

export const MAX_ADULTS = 20;
export const MAX_CHILDREN = 10;
export const MAX_ROOMS = 10;
export const MAX_RADIUS_KM = 25;
export const MAX_RANGE_DAYS = 90;
export const MAX_ORIGINS = 5;
export const MAX_NIGHTS_PER_CITY = 30;

const localDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD");

export const tripSearchInputSchema = z.object({
  origins: z
    .array(
      z
        .string()
        .regex(/^[A-Z]{3}$/, "Kode bandara harus 3 huruf besar")
        .refine((code) => (INDONESIAN_ORIGINS as readonly string[]).includes(code), {
          message: "Kode bandara tidak ada pada daftar bandara Indonesia",
        }),
    )
    .min(1, "Pilih minimal satu bandara asal")
    .max(MAX_ORIGINS, `Maksimal ${MAX_ORIGINS} bandara asal`),
  departureStart: localDateSchema,
  departureEnd: localDateSchema,
  adults: z.number().int().min(1, "Minimal satu dewasa").max(MAX_ADULTS, `Maksimal ${MAX_ADULTS} dewasa`),
  childrenAges: z
    .array(z.number().int().min(0, "Umur anak tidak valid").max(17, "Umur anak maksimal 17"))
    .max(MAX_CHILDREN, `Maksimal ${MAX_CHILDREN} anak`),
  rooms: z.number().int().min(1, "Minimal satu kamar").max(MAX_ROOMS, `Maksimal ${MAX_ROOMS} kamar`),
  makkahNights: z.number().int().min(1, "Malam Makkah minimal 1").max(MAX_NIGHTS_PER_CITY),
  madinahNights: z.number().int().min(1, "Malam Madinah minimal 1").max(MAX_NIGHTS_PER_CITY),
  patterns: z
    .array(
      z.enum(["ROUNDTRIP_JED", "ROUNDTRIP_MED", "OPENJAW_JED_MED", "OPENJAW_MED_JED"]),
    )
    .min(1, "Pilih minimal satu pola perjalanan"),
  cityOrder: z.enum(["AUTO", "MAKKAH_FIRST", "MADINAH_FIRST"]),
  cabin: z.enum(["economy", "premium_economy", "business", "first"]),
  maxStops: z.number().int().min(0).max(4).optional(),
  maxLayoverMinutes: z.number().int().min(0).max(1440).optional(),
  maxTripDurationMinutes: z.number().int().min(0).max(5760).optional(),
  makkahRadiusKm: z.number().min(1).max(MAX_RADIUS_KM),
  madinahRadiusKm: z.number().min(1).max(MAX_RADIUS_KM),
  freeCancellationOnly: z.boolean(),
  currency: z.literal("IDR"),
});

export type TripSearchInputResult =
  | { ok: true; data: TripSearchInput }
  | { ok: false; issues: ValidationIssue[] };

/** Validate shape, business rules, and user horizon. Pure and deterministic. */
export function validateTripSearchInput(
  raw: unknown,
  now: Date,
): TripSearchInputResult {
  const parsed = tripSearchInputSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((issue) => {
        const field = issue.path.length > 0 ? issue.path.join(".") : "input";
        return { field, code: "VALIDATION_ERROR", message: issue.message };
      }),
    };
  }
  const input = parsed.data;
  const issues: ValidationIssue[] = [];

  if (input.departureStart > input.departureEnd) {
    issues.push({
      field: "departureEnd",
      code: "VALIDATION_ERROR",
      message: "Tanggal akhir tidak boleh sebelum tanggal awal",
    });
  }
  const rangeDays = daysBetween(input.departureStart, input.departureEnd);
  if (rangeDays > MAX_RANGE_DAYS) {
    issues.push({
      field: "departureEnd",
      code: "VALIDATION_ERROR",
      message: `Rentang tanggal maksimal ${MAX_RANGE_DAYS} hari`,
    });
  }
  if (!isWithinUserHorizon(input.departureEnd, now)) {
    issues.push({
      field: "departureEnd",
      code: "OUTSIDE_USER_HORIZON",
      message: "Tanggal keberangkatan tidak boleh melebihi 365 hari dari hari ini",
    });
  }
  if (input.adults < input.rooms) {
    issues.push({
      field: "adults",
      code: "VALIDATION_ERROR",
      message: "Minimal satu dewasa diperlukan per kamar",
    });
  }
  if (input.childrenAges.length > input.adults * 3) {
    issues.push({
      field: "childrenAges",
      code: "VALIDATION_ERROR",
      message: "Jumlah anak tidak masuk akal untuk jumlah dewasa",
    });
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }
  return { ok: true, data: input };
}

function daysBetween(start: string, end: string): number {
  const a = new Date(`${start}T00:00:00Z`).getTime();
  const b = new Date(`${end}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86_400_000);
}
