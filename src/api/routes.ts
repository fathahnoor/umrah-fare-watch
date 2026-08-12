// Application API routes. Query contracts follow 05_DATA_MODEL_AND_BACKEND.md.
import { Router } from "express";
import type { Request, Response } from "express";
import type { AppConfig } from "../config.js";
import { addDays, todayLocalDate } from "../domain/dates.js";
import type { AuthService } from "../services/authService.js";
import type { CoverageService } from "../services/coverageService.js";
import type { SearchService } from "../services/searchService.js";
import type { WatchlistService } from "../services/watchlistService.js";

export interface RouteDeps {
  searchService: SearchService;
  watchlistService: WatchlistService;
  coverageService: CoverageService;
  authService: AuthService;
  config: AppConfig;
  now: () => Date;
}

function calendarWindow(
  startRaw: string | null,
  endRaw: string | null,
  months: number,
  now: Date,
): { start: string; end: string } {
  const today = todayLocalDate(now);
  const start = startRaw && /^\d{4}-\d{2}-\d{2}$/.test(startRaw) ? startRaw : today;
  const end =
    endRaw && /^\d{4}-\d{2}-\d{2}$/.test(endRaw)
      ? endRaw
      : addDays(start, months * 31 - 1);
  return { start, end };
}

function sessionToken(req: Request): string | null {
  const token = req.headers["x-session-token"];
  return typeof token === "string" && token.trim() !== "" ? token.trim() : null;
}

/** Resolve the session to a user id; writes 401 when missing or expired. */
function requireUser(deps: RouteDeps, req: Request, res: Response): string | null {
  const token = sessionToken(req);
  const userId = deps.authService.authenticate(token, deps.now());
  if (userId == null) {
    res.status(401).json({
      code: "AUTH_REQUIRED",
      message: "Sesi tidak valid atau sudah kedaluwarsa",
      retryable: false,
      correlationId: res.locals.correlationId,
    });
    return null;
  }
  return userId;
}

export function createRoutes(deps: RouteDeps): Router {
  const router = Router();

  router.get("/health", (_req: Request, res: Response) => {
    res.json({
      ok: true,
      mode: deps.config.mockMode ? "MOCK" : "LIVE",
      time: deps.now().toISOString(),
      horizons: {
        userDays: deps.config.userHorizonDays,
        technicalFlightDays: deps.config.technicalFlightHorizonDays,
        mockHotelFrontierDays: deps.config.mockHotelFrontierDays,
      },
    });
  });

  router.post("/search/trip", async (req: Request, res: Response) => {
    const outcome = await deps.searchService.searchTrip(req.body, deps.now());
    if (!outcome.ok) {
      res.status(400).json({
        code: "VALIDATION_ERROR",
        errors: outcome.issues,
        retryable: false,
        correlationId: res.locals.correlationId,
      });
      return;
    }
    res.json(outcome.response);
  });

  router.post("/search/calendar", async (req: Request, res: Response) => {
    const outcome = await deps.searchService.searchCalendar(req.body, deps.now());
    if (!outcome.ok) {
      res.status(400).json({
        code: "VALIDATION_ERROR",
        errors: outcome.issues,
        retryable: false,
        correlationId: res.locals.correlationId,
      });
      return;
    }
    res.json(outcome.response);
  });

  router.post("/auth/register", (req: Request, res: Response) => {
    const outcome = deps.authService.register(req.body?.email, req.body?.password, deps.now());
    if (!outcome.ok) {
      const conflict = outcome.issues.some((i) => i.code === "CONFLICT");
      res.status(conflict ? 409 : 400).json({
        code: conflict ? "CONFLICT" : "VALIDATION_ERROR",
        errors: outcome.issues,
        retryable: false,
        correlationId: res.locals.correlationId,
      });
      return;
    }
    res.status(201).json(outcome.data);
  });

  router.post("/auth/login", (req: Request, res: Response) => {
    const outcome = deps.authService.login(req.body?.email, req.body?.password, deps.now());
    if (!outcome.ok) {
      res.status(401).json({
        code: "INVALID_CREDENTIALS",
        errors: outcome.issues,
        retryable: false,
        correlationId: res.locals.correlationId,
      });
      return;
    }
    res.json(outcome.data);
  });

  router.post("/auth/logout", (req: Request, res: Response) => {
    deps.authService.logout(sessionToken(req));
    res.json({ ok: true });
  });

  router.get("/auth/me", (req: Request, res: Response) => {
    const me = deps.authService.me(sessionToken(req), deps.now());
    if (!me) {
      res.status(401).json({ code: "AUTH_REQUIRED", message: "Belum masuk", retryable: false, correlationId: res.locals.correlationId });
      return;
    }
    res.json({ user: me });
  });

  router.post("/watchlist", async (req: Request, res: Response) => {
    const userId = requireUser(deps, req, res);
    if (userId == null) return;
    const outcome = await deps.watchlistService.create(userId, req.body, deps.now());
    if (!outcome.ok) {
      res.status(outcome.issues.some((i) => i.code === "NOT_FOUND") ? 404 : 400).json({
        code: outcome.issues.some((i) => i.code === "NOT_FOUND") ? "NOT_FOUND" : "VALIDATION_ERROR",
        errors: outcome.issues,
        retryable: false,
        correlationId: res.locals.correlationId,
      });
      return;
    }
    res.status(201).json(outcome.data);
  });

  router.get("/watchlist", (req: Request, res: Response) => {
    const userId = requireUser(deps, req, res);
    if (userId == null) return;
    res.json({ watchlists: deps.watchlistService.list(userId) });
  });

  router.delete("/watchlist/:id", (req: Request, res: Response) => {
    const userId = requireUser(deps, req, res);
    if (userId == null) return;
    const removed = deps.watchlistService.remove(userId, req.params.id as string);
    if (!removed) {
      res.status(404).json({
        code: "NOT_FOUND",
        message: "Pantauan tidak ditemukan",
        retryable: false,
        correlationId: res.locals.correlationId,
      });
      return;
    }
    res.json({ ok: true });
  });

  router.post("/watchlist/:id/check", async (req: Request, res: Response) => {
    const userId = requireUser(deps, req, res);
    if (userId == null) return;
    const outcome = await deps.watchlistService.check(userId, req.params.id as string, deps.now());
    if (!outcome.ok) {
      res.status(404).json({
        code: "NOT_FOUND",
        errors: outcome.issues,
        retryable: false,
        correlationId: res.locals.correlationId,
      });
      return;
    }
    res.json(outcome.data);
  });

  router.get("/alerts", (req: Request, res: Response) => {
    const userId = requireUser(deps, req, res);
    if (userId == null) return;
    const limitRaw = Number.parseInt(String(req.query.limit ?? "20"), 10);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 50) : 20;
    res.json({ alerts: deps.watchlistService.alerts(userId, limit) });
  });

  router.get("/providers/health", async (_req: Request, res: Response) => {
    const health = await deps.searchService.providerHealth();
    res.json({ providers: health, correlationId: res.locals.correlationId });
  });

  router.get("/coverage", async (_req: Request, res: Response) => {
    const coverage = await deps.searchService.coverageOverview(deps.now());
    res.json(coverage);
  });

  router.post("/coverage/scan", async (_req: Request, res: Response) => {
    const result = await deps.coverageService.runDueScans(deps.now());
    res.json(result);
  });

  router.get("/coverage/calendar", async (req: Request, res: Response) => {
    const now = deps.now();
    const startRaw = typeof req.query.start === "string" ? req.query.start : null;
    const endRaw = typeof req.query.end === "string" ? req.query.end : null;
    const monthsRaw = Number.parseInt(String(req.query.months ?? "12"), 10);
    const months = Number.isFinite(monthsRaw) ? Math.min(Math.max(monthsRaw, 1), 13) : 12;
    const { start, end } = calendarWindow(startRaw, endRaw, months, now);
    const days = await deps.coverageService.calendarDays(start, end, now);
    const hotelProvider = deps.searchService.coverageOverview(now);
    const frontier = (await hotelProvider).hotelFrontierDate;
    res.json({
      start,
      end,
      days,
      hotelFrontierDate: frontier,
      generatedAt: now.toISOString(),
    });
  });

  return router;
}
