// HTTP server assembly. Provider tokens never appear here; mock mode needs no
// credentials and no network.
import { randomUUID } from "node:crypto";
import express from "express";
import type { NextFunction, Request, Response } from "express";
import { loadConfig, type AppConfig } from "../config.js";
import { loadDotEnv } from "../env.js";
import { createRegistry, type ProviderRegistry } from "../providers/registry.js";
import { ProviderError } from "../providers/types.js";
import { AuthService } from "../services/authService.js";
import { CoverageService } from "../services/coverageService.js";
import { HandoffService } from "../services/handoffService.js";
import { SearchService } from "../services/searchService.js";
import { WatchlistService } from "../services/watchlistService.js";
import { SqliteAuthRepo, type AuthRepo } from "../store/auth.js";
import { SqliteCoverageRepo, type CoverageRepo } from "../store/coverage.js";
import { openDb } from "../store/db.js";
import { SqliteStore, type ObservationStore } from "../store/repositories.js";
import { SqliteWatchlistRepo, type WatchlistRepo } from "../store/watchlist.js";
import { createRoutes } from "./routes.js";

export interface AppDeps {
  registry: ProviderRegistry;
  store: ObservationStore;
  watchlistRepo: WatchlistRepo;
  coverageRepo: CoverageRepo;
  authRepo: AuthRepo;
  config: AppConfig;
  now: () => Date;
  searchService?: SearchService;
  watchlistService?: WatchlistService;
  handoffService?: HandoffService;
}

/** Security headers for every response. CSP keeps scripts same-origin only;
 * inline event handlers are therefore not allowed anywhere in the UI. */
function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'none'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join("; "),
  );
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  next();
}

/** Accept a caller-supplied correlation id only when it is short and plain
 * ASCII identifier-shaped, so logs and headers stay clean. */
function sanitizeCorrelationId(raw: string | undefined): string {
  if (raw && /^[A-Za-z0-9_-]{1,64}$/.test(raw)) {
    return raw;
  }
  return randomUUID();
}

export function createApp(deps: AppDeps): express.Express {
  const app = express();
  const coverageRepo = deps.coverageRepo;
  const searchService =
    deps.searchService ??
    new SearchService(deps.registry, deps.store, deps.config, coverageRepo);
  const coverageService = new CoverageService(deps.registry, coverageRepo, deps.config);
  const authService = new AuthService(deps.authRepo, deps.config.sessionTtlDays);
  const watchlistService =
    deps.watchlistService ??
    new WatchlistService(searchService, deps.watchlistRepo, deps.config);
  const handoffService = deps.handoffService ?? new HandoffService(deps.registry, deps.store, deps.config);

  app.disable("x-powered-by");
  app.use(securityHeaders);
  app.use(express.json({ limit: "256kb" }));

  // Correlation ID + structured request log with redaction (no bodies, no secrets).
  app.use((req: Request, res: Response, next: NextFunction) => {
    const rawHeader = req.headers["x-correlation-id"];
    const correlationId = sanitizeCorrelationId(
      typeof rawHeader === "string" ? rawHeader : Array.isArray(rawHeader) ? rawHeader[0] : undefined,
    );
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

  app.use(
    "/api",
    createRoutes({
      searchService,
      watchlistService,
      coverageService,
      authService,
      handoffService,
      config: deps.config,
      now: deps.now,
    }),
  );

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
  loadDotEnv();
  const config = loadConfig();
  const db = openDb(config.dbPath);
  const store = new SqliteStore(db);
  const watchlistRepo = new SqliteWatchlistRepo(db);
  const coverageRepo = new SqliteCoverageRepo(db);
  const authRepo = new SqliteAuthRepo(db);
  // Upgrades to real adapters automatically once tokens + REAL_PROVIDERS_ENABLED
  // are set; with no tokens this is exactly the mock registry.
  const registry = createRegistry(config);
  const searchService = new SearchService(registry, store, config, coverageRepo);
  const watchlistService = new WatchlistService(searchService, watchlistRepo, config);
  const coverageService = new CoverageService(registry, coverageRepo, config);
  const app = createApp({
    registry,
    store,
    watchlistRepo,
    coverageRepo,
    authRepo,
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

  // Initial coverage pass so the 365-day calendar is populated right away,
  // then periodic re-scans at the tier cadences.
  coverageService.runDueScans(new Date()).catch((err: unknown) => {
    process.stderr.write(
      `${JSON.stringify({ ts: new Date().toISOString(), level: "error", message: "initial coverage scan failed", detail: err instanceof Error ? err.message : String(err) })}\n`,
    );
  });
  const coverageIntervalMs = config.coverageWorkerIntervalMs;
  const coverageWorker = setInterval(() => {
    coverageService.runDueScans(new Date()).catch((err: unknown) => {
      process.stderr.write(
        `${JSON.stringify({ ts: new Date().toISOString(), level: "error", message: "coverage worker failed", detail: err instanceof Error ? err.message : String(err) })}\n`,
      );
    });
  }, coverageIntervalMs);
  coverageWorker.unref();

  // Watchlist worker: periodically re-check saved watchlists so price drops
  // become in-app alerts.
  const watchlistIntervalMs = Number.parseInt(process.env.WATCHLIST_WORKER_INTERVAL_MS ?? "300000", 10);
  const watchlistWorker = setInterval(() => {
    watchlistService.checkAll(new Date()).catch((err: unknown) => {
      process.stderr.write(
        `${JSON.stringify({ ts: new Date().toISOString(), level: "error", message: "watchlist worker failed", detail: err instanceof Error ? err.message : String(err) })}\n`,
      );
    });
  }, Math.max(watchlistIntervalMs, 10_000));
  watchlistWorker.unref();

  // Session housekeeping: drop expired sessions once an hour so the table
  // does not grow without bound.
  const sessionSweeper = setInterval(() => {
    try {
      authRepo.deleteExpiredSessions(new Date());
    } catch (err: unknown) {
      process.stderr.write(
        `${JSON.stringify({ ts: new Date().toISOString(), level: "error", message: "session sweep failed", detail: err instanceof Error ? err.message : String(err) })}\n`,
      );
    }
  }, 3_600_000);
  sessionSweeper.unref();

  const shutdown = (): void => {
    clearInterval(coverageWorker);
    clearInterval(watchlistWorker);
    clearInterval(sessionSweeper);
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
