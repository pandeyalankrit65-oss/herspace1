import crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { db } from './db';
import { randomToken, sha256 } from './util';

const SESSION_DAYS = 30;

export type User = { id: number; name: string; email: string };

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return crypto.timingSafeEqual(expected, actual);
}

// Only the hash of the token is stored, so a leaked database doesn't leak live sessions.
export function createSession(userId: number): string {
  const token = randomToken();
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(sha256(token), userId, expires);
  return token;
}

export function deleteSession(token: string) {
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
}

// Signs the user out everywhere, e.g. after a password change or reset.
export function deleteAllSessions(userId: number) {
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
}

export function bearerToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  return header?.startsWith('Bearer ') ? header.slice(7) : undefined;
}

// Attaches req.user when a valid session token is present; never rejects.
export function loadUser(req: Request, _res: Response, next: NextFunction) {
  const token = bearerToken(req);
  if (token) {
    const row = db
      .prepare(
        `SELECT u.id, u.name, u.email, s.expires_at FROM sessions s
         JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`
      )
      .get(sha256(token)) as (User & { expires_at: string }) | undefined;
    if (row && new Date(row.expires_at) > new Date()) {
      req.user = { id: row.id, name: row.name, email: row.email };
    }
  }
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'Please log in to continue.' });
  next();
}
