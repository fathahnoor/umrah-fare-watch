import { describe, expect, it } from "vitest";
import { baseInput, TEST_NOW, withServer } from "./helpers.js";

describe("API auth (Pantauan Saya requires authentication)", () => {
  it("registers a user and rejects duplicate emails", async () => {
    await withServer(TEST_NOW, async (baseUrl) => {
      const good = await fetch(`${baseUrl}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "user@example.com", password: "rahasia123" }),
      });
      expect(good.status).toBe(201);
      const body = (await good.json()) as any;
      expect(body.user.email).toBe("user@example.com");
      expect(body.user.passwordHash).toBeUndefined();

      const dup = await fetch(`${baseUrl}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "USER@example.com", password: "rahasia123" }),
      });
      expect(dup.status).toBe(409);
      expect((await dup.json() as any).code).toBe("CONFLICT");
    });
  });

  it("validates email and password length", async () => {
    await withServer(TEST_NOW, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "bukan-email", password: "pendek" }),
      });
      expect(res.status).toBe(400);
      const body = (await res.json()) as any;
      expect(body.code).toBe("VALIDATION_ERROR");
      const fields = body.errors.map((e: { field: string }) => e.field);
      expect(fields).toContain("email");
      expect(fields).toContain("password");
    });
  });

  it("logs in with a session token and resolves /auth/me", async () => {
    await withServer(TEST_NOW, async (baseUrl) => {
      await register(baseUrl, "login@example.com");
      const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "login@example.com", password: "rahasia123" }),
      });
      expect(loginRes.status).toBe(200);
      const login = (await loginRes.json()) as any;
      expect(typeof login.token).toBe("string");
      expect(login.token.length).toBeGreaterThan(16);

      const me = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { "X-Session-Token": login.token },
      });
      expect(me.status).toBe(200);
      expect(((await me.json()) as any).user.email).toBe("login@example.com");
    });
  });

  it("rejects wrong passwords and invalid sessions", async () => {
    await withServer(TEST_NOW, async (baseUrl) => {
      await register(baseUrl, "wrong@example.com");
      const bad = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "wrong@example.com", password: "salah12345" }),
      });
      expect(bad.status).toBe(401);
      expect((await bad.json() as any).code).toBe("INVALID_CREDENTIALS");

      const me = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { "X-Session-Token": "token-tidak-ada" },
      });
      expect(me.status).toBe(401);
    });
  });

  it("logout invalidates the session", async () => {
    await withServer(TEST_NOW, async (baseUrl) => {
      const token = await registerAndLogin(baseUrl, "logout@example.com");
      const out = await fetch(`${baseUrl}/api/auth/logout`, {
        method: "POST",
        headers: { "X-Session-Token": token },
      });
      expect(out.status).toBe(200);
      const me = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { "X-Session-Token": token },
      });
      expect(me.status).toBe(401);
    });
  });

  it("watchlist endpoints are protected by the session", async () => {
    await withServer(TEST_NOW, async (baseUrl) => {
      const token = await registerAndLogin(baseUrl, "wl@example.com");
      const res = await fetch(`${baseUrl}/api/watchlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Session-Token": token },
        body: JSON.stringify({ input: baseInput({ departureStart: "2029-12-05", departureEnd: "2029-12-05" }) }),
      });
      expect(res.status).toBe(201);
      const list = await fetch(`${baseUrl}/api/watchlist`, {
        headers: { "X-Session-Token": token },
      });
      expect(((await list.json()) as any).watchlists.length).toBe(1);
    });
  });
});

async function register(baseUrl: string, email: string): Promise<void> {
  const res = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "rahasia123" }),
  });
  expect(res.status).toBe(201);
}

async function registerAndLogin(baseUrl: string, email: string): Promise<string> {
  await register(baseUrl, email);
  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "rahasia123" }),
  });
  const body = (await login.json()) as any;
  return body.token as string;
}
