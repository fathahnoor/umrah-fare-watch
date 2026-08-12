// HTTP server assembly. Provider tokens never appear here; mock mode needs no
// credentials and no network.
import { randomUUID } from "node:crypto";
import express from "express";
import type { NextFunction, Request, Response } from "express";
import { loadConfig, type AppConfig } from "../config.js";
import { createMockRegistry, type ProviderRegistry } from "../providers/registry.js";
import { ProviderError } from "../providers/types.js";
import { SearchService } from "../services/searchService.js";
import { WatchlistService } from "../services/watchlistService.js";
import { openDb } from "../store/db.js";
import { SqliteStore, type ObservationStore } from "../store/repositories.js";
import { SqliteWatchlistRepo, type WatchlistRepo } from "../store/watchlist.js";
import { createRoutes } from "./routes.js";

export interface AppDeps {
  registry: ProviderRegistry;
  store: ObservationStore;
  watchlistRepo: WatchlistRepo;
  config: AppConfig;
  now: () => Date;
  searchService?: SearchService;
  watchlistService?: WatchlistService;
}

export function createApp(deps: AppDeps): express.Express {
  const app = express();
  const searchService =
    deps.searchService ?? new SearchService(deps.registry, deps.store, deps.config);
  const watchlistService =
    deps.watchlistService ??
    new WatchlistService(searchService, deps.watchlistRepo, deps.config);

  app.disable("x-powered-by");
  app.use(express.json({ limit: "256kb" }));

  // Correlation ID + structured request log with redaction (no bodies, no secrets).
  app.use((req: Request, res: Response, next: NextFunction) => {
    const correlationId = (req.headers["x-correlation-id"] as string | undefined) ?? randomUUID();
    res.locals.correlationId = correlationId;
    res.setHeader("x-correlation-id", correlationId);
    const started = Date.now();
    res.on("finish", () => {
      const durationMs = Date.now() - started;
      const safe = {
        ts: new Date().toISOString(),
        correlationId,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs,
      };
      // Structured log: JSON to stdout, no request body, no secrets.
      process.stdout.write(`${JSON.stringify(safe)}\n`);
    });
    next();
  });

  app.use("/api", createRoutes({ searchService, watchlistService, config: deps.config, now: deps.now }));

  app.use(express.static(deps.config.publicDir, { index: "index.html" }));

  // SPA fallback for non-API GET requests.
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method === "GET" && !req.path.startsWith("/api")) {
      res.sendFile("index.html", { root: deps.config.publicDir }, (err) => {
        if (err) {
          next(err);
        }
      });
      return;
    }
    next();
  });

  // Typed error handling. Never expose provider raw errors or credentials.
  app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    const correlationId = res.locals.correlationId as string;
    if (err instanceof ProviderError) {
      const status =
        err.category === "PROVIDER_UNAVAILABLE" ? 503 :
        err.category === "OUTSIDE_PROVIDER_FRONTIER" ? 422 :
        err.category === "RATE_LIMITED" ? 429 : 502;
      res.status(status).json({
        code: err.category,
        message: "Provider tidak dapat diproses saat ini",
        retryable: err.retryable,
        nextEligibleAt: err.nextEligibleAt,
        correlationId,
      });
      return;
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    process.stderr.write(
      `${JSON.stringify({ ts: new Date().toISOString(), correlationId, level: "error", message })}\n`,
    );
    res.status(500).json({
      code: "INTERNAL_ERROR",
      message: "Terjadi kesalahan internal",
      retryable: false,
      correlationId,
    });
  });

  return app;
}

function main(): void {
  const config = loadConfig();
  const db = openDb(config.dbPath);
  const store = new SqliteStore(db);
  const watchlistRepo = new SqliteWatchlistRepo(db);
  const registry = createMockRegistry(config.mockHotelFrontierDays);
  const searchService = new SearchService(registry, store, config);
  const watchlistService = new WatchlistService(searchService, watchlistRepo, config);
  const app = createApp({
    registry,
    store,
    watchlistRepo,
    config,
    now: () => new Date(),
    searchService,
    watchlistService,
  });

  const server = app.listen(config.port, () => {
    process.stdout.write(
      `${JSON.stringify({ ts: new Date().toISOString(), level: "info", message: `Umrah Fare Watch listening on http://localhost:${config.port} (mock mode: ${config.mockMode})` })}\n`,
    );
  });

  // MVP worker slice: periodically re-check saved watchlists so price drops
  // become in-app alerts. Full tiered scheduler arrives with M4.
  const workerIntervalMs = Number.parseInt(process.env.WATCHLIST_WORKER_INTERVAL_MS ?? "300000", 10);
  const worker = setInterval(() => {
    watchlistService.checkAll(new Date()).catch((err: unknown) => {
      process.stderr.write(
        `${JSON.stringify({ ts: new Date().toISOString(), level: "error", message: "watchlist worker failed", detail: err instanceof Error ? err.message : String(err) })}\n`,
      );
    });
  }, Math.max(workerIntervalMs, 10_000));
  worker.unref();

  const shutdown = (): void => {
    clearInterval(worker);
    server.close(() => {
      store.close();
      process.exit(0);
    });
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"))) {
  main();
}
