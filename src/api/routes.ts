// Application API routes. Query contracts follow 05_DATA_MODEL_AND_BACKEND.md.
import { Router } from "express";
import type { Request, Response } from "express";
import type { AppConfig } from "../config.js";
import type { SearchService } from "../services/searchService.js";
import type { WatchlistService } from "../services/watchlistService.js";

export interface RouteDeps {
  searchService: SearchService;
  watchlistService: WatchlistService;
  config: AppConfig;
  now: () => Date;
}

function watchlistToken(req: Request): string | null {
  const token = req.headers["x-watchlist-token"];
  return typeof token === "string" && token.trim() !== "" ? token.trim() : null;
}

function requireWatchlistToken(req: Request, res: Response): string | null {
  const token = watchlistToken(req);
  if (token == null) {
    res.status(401).json({
      code: "AUTH_REQUIRED",
      message: "Token pantauan (X-Watchlist-Token) diperlukan",
      retryable: false,
      correlationId: res.locals.correlationId,
    });
    return null;
  }
  return token;
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

  router.post("/watchlist", async (req: Request, res: Response) => {
    const token = requireWatchlistToken(req, res);
    if (token == null) return;
    const outcome = await deps.watchlistService.create(token, req.body, deps.now());
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
    const token = requireWatchlistToken(req, res);
    if (token == null) return;
    res.json({ watchlists: deps.watchlistService.list(token) });
  });

  router.delete("/watchlist/:id", (req: Request, res: Response) => {
    const token = requireWatchlistToken(req, res);
    if (token == null) return;
    const removed = deps.watchlistService.remove(token, req.params.id as string);
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
    const token = requireWatchlistToken(req, res);
    if (token == null) return;
    const outcome = await deps.watchlistService.check(token, req.params.id as string, deps.now());
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
    const token = requireWatchlistToken(req, res);
    if (token == null) return;
    const limitRaw = Number.parseInt(String(req.query.limit ?? "20"), 10);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 50) : 20;
    res.json({ alerts: deps.watchlistService.alerts(token, limit) });
  });

  router.get("/providers/health", async (_req: Request, res: Response) => {
    const health = await deps.searchService.providerHealth();
    res.json({ providers: health, correlationId: res.locals.correlationId });
  });

  router.get("/coverage", async (_req: Request, res: Response) => {
    const coverage = await deps.searchService.coverageOverview(deps.now());
    res.json(coverage);
  });

  return router;
}
