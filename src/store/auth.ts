// User and session persistence. Passwords are stored only as salted scrypt
// hashes; session tokens are random 32-byte values keyed to a user.
import type { DatabaseSync } from "node:sqlite";

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  passwordSalt: string;
  createdAt: string;
}

export interface AuthRepo {
  createUser(user: UserRecord): void;
  findUserByEmail(email: string): UserRecord | null;
  findUserById(id: string): UserRecord | null;
  createSession(session: { token: string; userId: string; createdAt: string; expiresAt: string }): void;
  findUserIdBySession(token: string): { userId: string; expiresAt: string } | null;
  deleteSession(token: string): void;
}

export class SqliteAuthRepo implements AuthRepo {
  private db: DatabaseSync;

  constructor(db: DatabaseSync) {
    this.db = db;
  }

  createUser(user: UserRecord): void {
    this.db
      .prepare(
        `INSERT INTO users (id, email, password_hash, password_salt, created_at)
         VALUES (?, ?, ?, ?, ?) ON CONFLICT (id) DO NOTHING`,
      )
      .run(user.id, user.email, user.passwordHash, user.passwordSalt, user.createdAt);
  }

  findUserByEmail(email: string): UserRecord | null {
    const row = this.db
      .prepare("SELECT * FROM users WHERE email = ? COLLATE NOCASE")
      .get(email) as UserRow | undefined;
    return row
      ? {
          id: row.id,
          email: row.email,
          passwordHash: row.password_hash,
          passwordSalt: row.password_salt,
          createdAt: row.created_at,
        }
      : null;
  }

  findUserById(id: string): UserRecord | null {
    const row = this.db.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined;
    return row
      ? {
          id: row.id,
          email: row.email,
          passwordHash: row.password_hash,
          passwordSalt: row.password_salt,
          createdAt: row.created_at,
        }
      : null;
  }

  createSession(session: { token: string; userId: string; createdAt: string; expiresAt: string }): void {
    this.db
      .prepare(
        `INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)
         ON CONFLICT (token) DO NOTHING`,
      )
      .run(session.token, session.userId, session.createdAt, session.expiresAt);
  }

  findUserIdBySession(token: string): { userId: string; expiresAt: string } | null {
    const row = this.db
      .prepare("SELECT user_id, expires_at FROM sessions WHERE token = ?")
      .get(token) as { user_id: string; expires_at: string } | undefined;
    return row ? { userId: row.user_id, expiresAt: row.expires_at } : null;
  }

  deleteSession(token: string): void {
    this.db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
  }
}

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  password_salt: string;
  created_at: string;
}
