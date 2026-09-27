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

export const SESSION_COOKIE = 'herspace_session';
// Browsers only send this header when our own frontend sets it, and a cross-site page can't
// add it without a CORS preflight we'd reject. Required on state-changing requests.
export const CSRF_HEADER = 'x-requested-with';
export const CSRF_VALUE = 'HerSpace';

const cookieOptions = () => ({
  httpOnly: true, // page scripts can't read it, so an XSS bug can't steal the session
  sameSite: 'lax' as const,
  secure: process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : process.env.NODE_ENV === 'production',
  path: '/',
});

// Creates a session and hands it to the browser as a cookie.
export function startSession(res: Response, userId: number) {
  const token = createSession(userId);
  res.cookie(SESSION_COOKIE, token, { ...cookieOptions(), maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000 });
}

export function endSession(req: Request, res: Response) {
  const token = sessionToken(req);
  if (token) deleteSession(token);
  res.clearCookie(SESSION_COOKIE, cookieOptions());
}

export function sessionToken(req: Request): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === SESSION_COOKIE) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}

// Attaches req.user when a valid session cookie is present; never rejects.
export function loadUser(req: Request, _res: Response, next: NextFunction) {
  const token = sessionToken(req);
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

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Blocks cross-site request forgery: a state-changing request that carries the session
// cookie must also carry our custom header.
export function csrfGuard(req: Request, res: Response, next: NextFunction) {
  if (!SAFE_METHODS.has(req.method) && sessionToken(req) && req.get(CSRF_HEADER) !== CSRF_VALUE) {
    return res.status(403).json({ error: 'Request blocked: missing X-Requested-With header.' });
  }
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'Please log in to continue.' });
  next();
}
