// Application API routes. Query contracts follow 05_DATA_MODEL_AND_BACKEND.md.
import { Router } from "express";
import type { Request, Response } from "express";
import type { AppConfig } from "../config.js";
import type { SearchService } from "../services/searchService.js";

export interface RouteDeps {
  searchService: SearchService;
  config: AppConfig;
  now: () => Date;
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
