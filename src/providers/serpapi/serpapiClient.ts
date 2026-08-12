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
    const res = await fetch(url);
    if (!res.ok) {
      throw new ProviderError(
        "PROVIDER_UNAVAILABLE",
        `SerpAPI HTTP ${res.status}`,
        { retryable: res.status >= 500 },
      );
    }
    const payload = (await res.json()) as SerpapiErrorPayload;
    if (typeof payload.error === "string" && payload.error !== "") {
      const category =
        /invalid api|unauthorized|authentication/i.test(payload.error) ? "AUTH_REQUIRED" : "INVALID_PROVIDER_RESPONSE";
      throw new ProviderError(category, payload.error, { retryable: false });
    }
    return payload;
  }
}
