import { Request, Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { deleteAllSessions, endSession, hashPassword, publicUser, requireAuth, startSession, verifyPassword } from '../auth';
import { emailConfigured, sendEmail } from '../messaging';
import { rateLimit } from '../rateLimit';
import { appUrl, now, parse, passwordSchema, randomToken, sha256 } from '../util';

export const authRouter = Router();

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });

// Per-account limits, so guessing one account's password from many IP addresses is still slow,
// and nobody can flood someone's inbox with reset emails.
const emailKey = (prefix: string) => (req: Request) =>
  typeof req.body?.email === 'string' ? `${prefix}:${req.body.email.trim().toLowerCase()}` : undefined;
const loginAccountLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  key: emailKey('login'),
  message: 'Too many login attempts for this account. Please wait 15 minutes or reset your password.',
});
const resetAccountLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  key: emailKey('reset'),
  message: 'A reset link was sent recently. Please check your email or try again later.',
});

// Checked against when the email is unknown, so a wrong email takes as long as a wrong password
// and response times don't reveal who has an account.
const DUMMY_HASH = hashPassword('not-a-real-password');
const RESET_TOKEN_MINUTES = 60;

const emailSchema = z.string().trim().toLowerCase().email();

const signupSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: emailSchema,
  password: passwordSchema,
});

authRouter.post('/signup', authLimiter, (req, res) => {
  const body = parse(signupSchema, req, res);
  if (!body) return;
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(body.email);
  if (existing) return res.status(409).json({ error: 'An account with this email already exists.' });

  const result = db
    .prepare('INSERT INTO users (name, email, password_hash, created_at) VALUES (?, ?, ?, ?)')
    .run(body.name, body.email, hashPassword(body.password), now());
  const id = Number(result.lastInsertRowid);
  startSession(res, id);
  res.status(201).json({ user: publicUser(id) });
});

authRouter.post('/login', authLimiter, loginAccountLimiter, (req, res) => {
  const body = parse(z.object({ email: emailSchema, password: z.string().min(1).max(200) }), req, res);
  if (!body) return;
  const user = db.prepare('SELECT id, name, email, password_hash FROM users WHERE email = ?').get(body.email) as
    | { id: number; name: string; email: string; password_hash: string }
    | undefined;
  const valid = verifyPassword(body.password, user?.password_hash ?? DUMMY_HASH);
  if (!user || !valid) {
    return res.status(401).json({ error: 'Incorrect email or password.' });
  }
  startSession(res, user.id);
  res.json({ user: publicUser(user.id) });
});

authRouter.post('/logout', (req, res) => {
  endSession(req, res);
  res.json({ success: true });
});

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// Always answers the same way so the endpoint can't be used to discover registered emails.
authRouter.post('/forgot', authLimiter, resetAccountLimiter, async (req, res) => {
  const body = parse(z.object({ email: emailSchema }), req, res);
  if (!body) return;
  const user = db.prepare('SELECT id, name FROM users WHERE email = ?').get(body.email) as { id: number; name: string } | undefined;

  if (user) {
    const token = randomToken();
    const expires = new Date(Date.now() + RESET_TOKEN_MINUTES * 60 * 1000).toISOString();
    db.prepare('DELETE FROM password_resets WHERE user_id = ?').run(user.id);
    db.prepare('INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(sha256(token), user.id, expires);
    const link = `${appUrl()}/reset-password/${token}`;

    if (emailConfigured()) {
      const result = await sendEmail(
        body.email,
        'Reset your HerSpace password',
        `Hi ${user.name},\n\nUse this link to choose a new password. It expires in ${RESET_TOKEN_MINUTES} minutes:\n${link}\n\nIf you didn't ask for this, you can ignore this email.`
      );
      if (result.status === 'failed') console.error('[auth] Password reset email failed:', result.error);
    } else if (process.env.NODE_ENV !== 'production') {
      console.log(`[auth] Email not configured. Password reset link for ${body.email}: ${link}`);
    } else {
      console.error('[auth] Password reset requested but email is not configured (RESEND_API_KEY / EMAIL_FROM).');
    }
  }
  res.json({ success: true });
});

authRouter.post('/reset', authLimiter, (req, res) => {
  const body = parse(z.object({ token: z.string().min(10).max(200), password: passwordSchema }), req, res);
  if (!body) return;
  const row = db.prepare('SELECT user_id, expires_at FROM password_resets WHERE token_hash = ?').get(sha256(body.token)) as
    | { user_id: number; expires_at: string }
    | undefined;
  if (!row || new Date(row.expires_at) < new Date()) {
    return res.status(400).json({ error: 'This reset link is invalid or has expired. Please request a new one.' });
  }
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(body.password), row.user_id);
  db.prepare('DELETE FROM password_resets WHERE user_id = ?').run(row.user_id);
  deleteAllSessions(row.user_id);
  startSession(res, row.user_id);
  res.json({ user: publicUser(row.user_id) });
});
