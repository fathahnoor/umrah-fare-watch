// Account authentication for "Pantauan Saya" (spec: watchlists require auth).
// Passwords are salted scrypt hashes; sessions are opaque random tokens with
// an expiry. No plaintext secrets are ever stored or logged.
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import type { ValidationIssue } from "../domain/types.js";
import type { AuthRepo, UserRecord } from "../store/auth.js";

const SCRYPT_KEYLEN = 64;

export type AuthOutcome<T> =
  | { ok: true; data: T }
  | { ok: false; issues: ValidationIssue[] };

export interface PublicUser {
  id: string;
  email: string;
}

export class AuthService {
  constructor(
    private readonly repo: AuthRepo,
    private readonly sessionTtlDays = 30,
  ) {}

  register(emailRaw: unknown, passwordRaw: unknown, now: Date): AuthOutcome<{ user: PublicUser }> {
    const email = typeof emailRaw === "string" ? emailRaw.trim().toLowerCase() : "";
    const password = typeof passwordRaw === "string" ? passwordRaw : "";
    const issues: ValidationIssue[] = [];
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      issues.push({ field: "email", code: "VALIDATION_ERROR", message: "Email tidak valid" });
    }
    if (password.length < 8) {
      issues.push({ field: "password", code: "VALIDATION_ERROR", message: "Kata sandi minimal 8 karakter" });
    }
    if (issues.length > 0) {
      return { ok: false, issues };
    }
    if (this.repo.findUserByEmail(email)) {
      return {
        ok: false,
        issues: [{ field: "email", code: "CONFLICT", message: "Email sudah terdaftar" }],
      };
    }
    const salt = randomBytes(16).toString("hex");
    const hash = hashPassword(password, salt);
    const user: UserRecord = {
      id: `user-${randomUUID()}`,
      email,
      passwordHash: hash,
      passwordSalt: salt,
      createdAt: now.toISOString(),
    };
    this.repo.createUser(user);
    return { ok: true, data: { user: { id: user.id, email: user.email } } };
  }

  login(emailRaw: unknown, passwordRaw: unknown, now: Date): AuthOutcome<{ token: string; user: PublicUser }> {
    const email = typeof emailRaw === "string" ? emailRaw.trim().toLowerCase() : "";
    const password = typeof passwordRaw === "string" ? passwordRaw : "";
    const user = this.repo.findUserByEmail(email);
    if (!user || !verifyPassword(password, user.passwordSalt, user.passwordHash)) {
      return {
        ok: false,
        issues: [{ field: "email", code: "INVALID_CREDENTIALS", message: "Email atau kata sandi salah" }],
      };
    }
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(now.getTime() + this.sessionTtlDays * 86_400_000).toISOString();
    this.repo.createSession({ token, userId: user.id, createdAt: now.toISOString(), expiresAt });
    return { ok: true, data: { token, user: { id: user.id, email: user.email } } };
  }

  logout(token: string | null): void {
    if (token) {
      this.repo.deleteSession(token);
    }
  }

  /** Resolve a session token to a user id, honoring expiry. */
  authenticate(token: string | null, now: Date): string | null {
    if (!token) {
      return null;
    }
    const session = this.repo.findUserIdBySession(token);
    if (!session) {
      return null;
    }
    if (new Date(session.expiresAt).getTime() <= now.getTime()) {
      this.repo.deleteSession(token);
      return null;
    }
    return session.userId;
  }

  me(token: string | null, now: Date): PublicUser | null {
    const userId = this.authenticate(token, now);
    if (!userId) {
      return null;
    }
    const user = this.repo.findUserById(userId);
    return user ? { id: user.id, email: user.email } : null;
  }
}

function hashPassword(password: string, salt: string): string {
  return scryptSync(password, salt, SCRYPT_KEYLEN).toString("hex");
}

function verifyPassword(password: string, salt: string, expectedHash: string): boolean {
  const actual = scryptSync(password, salt, SCRYPT_KEYLEN);
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
