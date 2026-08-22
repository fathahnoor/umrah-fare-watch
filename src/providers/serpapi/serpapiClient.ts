// SerpAPI client (04_PROVIDER_AND_DATA_STRATEGY.md replacement for Duffel:
// Duffel does not accept Indonesian registrations, Amadeus self-service is
// shutting down, Kiwi is invite-only, Hotellook is closed. SerpAPI serves
// real-time Google Flights/Hotels results with booking links, no country
// restriction, and a free tier for testing.)
import { ProviderError } from "../types.js";

export const SERPAPI_BASE = "https://serpapi.com/search.json";

export interface SerpapiErrorPayload {
  error?: string;
  [key: string]: unknown;
}

function retryAfterAt(raw: string | null): string | null {
  if (!raw) return null;
  const seconds = Number.parseInt(raw, 10);
  if (Number.isFinite(seconds) && seconds >= 0 && /^\d+$/.test(raw.trim())) {
    return new Date(Date.now() + seconds * 1000).toISOString();
  }
  const timestamp = Date.parse(raw);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function isQuotaMessage(message: string): boolean {
  return /run out of searches|no searches remaining|quota (?:is )?(?:exhausted|exceeded)|credits? (?:are )?(?:exhausted|depleted)|searches left\s*[:=]\s*0/i.test(
    message,
  );
}

export class SerpapiClient {
  constructor(
    private readonly apiKey: string | null,
    private readonly baseUrl: string = SERPAPI_BASE,
  ) {}

  /**
   * GET a SerpAPI engine with the API key appended. Throws ProviderError with
   * an availability category so the caller can isolate provider failures.
   */
  async get(params: Record<string, string | number | undefined>): Promise<unknown> {
    const url = new URL(this.baseUrl);
    url.searchParams.set("api_key", this.apiKey ?? "");
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
    let res: Response;
    try {
      res = await fetch(url);
    } catch {
      throw new ProviderError("PROVIDER_UNAVAILABLE", "SerpAPI tidak dapat dijangkau", { retryable: true });
    }
    let payload: SerpapiErrorPayload = {};
    try {
      payload = (await res.json()) as SerpapiErrorPayload;
    } catch {
      // Status HTTP tetap menjadi sumber klasifikasi bila body bukan JSON.
    }
    const providerMessage = typeof payload.error === "string" ? payload.error : "";
    if (res.status === 429) {
      if (isQuotaMessage(providerMessage)) {
        throw new ProviderError("QUOTA_EXCEEDED", "Kuota pencarian SerpAPI telah habis", {
          retryable: false,
          nextEligibleAt: retryAfterAt(res.headers.get("retry-after")),
        });
      }
      throw new ProviderError("RATE_LIMITED", "Batas permintaan SerpAPI per jam tercapai", {
        retryable: true,
        nextEligibleAt: retryAfterAt(res.headers.get("retry-after")),
      });
    }
    if (res.status === 401 || res.status === 403) {
      throw new ProviderError("AUTH_REQUIRED", "Akses SerpAPI ditolak", { retryable: false });
    }
    if (!res.ok) {
      throw new ProviderError(
        "PROVIDER_UNAVAILABLE",
        `SerpAPI HTTP ${res.status}`,
        { retryable: res.status >= 500 },
      );
    }
    if (providerMessage !== "") {
      const category =
        /invalid api|unauthorized|authentication/i.test(providerMessage)
          ? "AUTH_REQUIRED"
          : isQuotaMessage(providerMessage)
            ? "QUOTA_EXCEEDED"
            : "INVALID_PROVIDER_RESPONSE";
      const message =
        category === "AUTH_REQUIRED"
          ? "Akses SerpAPI ditolak"
          : category === "QUOTA_EXCEEDED"
            ? "Kuota pencarian SerpAPI telah habis"
            : "SerpAPI mengembalikan respons yang tidak dapat diproses";
      throw new ProviderError(category, message, { retryable: false });
    }
    return payload;
  }
}
