// Simple fixed-window rate limiter (per process, keyed by client IP).
// Good enough for a single-instance deployment: it blunts brute-force on the
// auth endpoints and casual hammering of expensive provider-backed endpoints.
// No external state; restarts reset the counters, which is acceptable here.
import type { NextFunction, Request, Response } from "express";

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  /** Bucket label included in the 429 body so the client can tell why. */
  scope: string;
}

interface HitCounter {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, HitCounter>();

function purgeNow(now: number): void {
  if (buckets.size < 4096) {
    return;
  }
  for (const [key, counter] of buckets) {
    if (counter.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

export function createRateLimiter(options: RateLimitOptions) {
  return function rateLimit(req: Request, res: Response, next: NextFunction): void {
    const now = Date.now();
    purgeNow(now);
    const key = `${options.scope}|${req.ip ?? "unknown"}`;
    let counter = buckets.get(key);
    if (!counter || counter.resetAt <= now) {
      counter = { count: 0, resetAt: now + options.windowMs };
      buckets.set(key, counter);
    }
    counter.count += 1;
    if (counter.count > options.max) {
      const retryAfterSec = Math.max(1, Math.ceil((counter.resetAt - now) / 1000));
      res.status(429).set("Retry-After", String(retryAfterSec)).json({
        code: "RATE_LIMITED",
        message: "Terlalu banyak permintaan. Coba lagi beberapa saat lagi.",
        retryable: true,
        retryAfterSeconds: retryAfterSec,
        scope: options.scope,
      });
      return;
    }
    next();
  };
}

/** Test-only hook: forget all counters between app instances. */
export function resetRateLimits(): void {
  buckets.clear();
}
