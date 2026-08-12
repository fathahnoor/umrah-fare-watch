// Minimal Duffel HTTP client (official API, Bearer token, Duffel-Version).
// Tokens come only from the server environment; never from the client or logs.
import { ProviderError } from "../types.js";

export const DUFFEL_API_BASE = "https://api.duffel.com";

export class DuffelClient {
  constructor(
    private readonly token: string | null,
    private readonly baseUrl: string = DUFFEL_API_BASE,
    private readonly apiVersion = "v1",
  ) {}

  private headers(): Record<string, string> {
    if (!this.token) {
      throw new ProviderError("ACCESS_NOT_CONFIGURED", "Token Duffel belum tersedia (DUFFEL_TOKEN)", {
        retryable: false,
      });
    }
    return {
      Authorization: `Bearer ${this.token}`,
      "Duffel-Version": this.apiVersion,
      "Content-Type": "application/json",
    };
  }

  /** Performs the request and maps transport failures to typed ProviderErrors. */
  async request<T>(path: string, init: RequestInit): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${path}`, { ...init, headers: this.headers() });
    } catch {
      throw new ProviderError("PROVIDER_UNAVAILABLE", "Duffel tidak dapat dijangkau", {
        retryable: true,
      });
    }
    if (res.status === 429) {
      const retryAfter = res.headers.get("retry-after");
      throw new ProviderError("RATE_LIMITED", "Duffel rate limit", {
        retryable: true,
        nextEligibleAt: retryAfter
          ? new Date(Date.now() + Number(retryAfter) * 1000).toISOString()
          : null,
      });
    }
    if (res.status === 401 || res.status === 403) {
      throw new ProviderError("ACCESS_NOT_CONFIGURED", `Duffel menolak kredensial (HTTP ${res.status})`, {
        retryable: false,
      });
    }
    if (!res.ok) {
      throw new ProviderError("PROVIDER_UNAVAILABLE", `Duffel HTTP ${res.status}`, { retryable: true });
    }
    return (await res.json()) as T;
  }
}
