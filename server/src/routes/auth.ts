import { Request, Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { deleteAllSessions, endSession, hashPassword, publicUser, requireAuth, startSession, verifyPassword } from '../auth';
import { emailConfigured, sendEmail } from '../messaging';
import { perUser, rateLimit } from '../rateLimit';
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
const VERIFY_TOKEN_HOURS = 48;
const SIGNUP_TOKEN_HOURS = 24;

// Dev and tests only, when email isn't set up: the last link each address would have been sent.
export const unsentLinks = new Map<string, string>();

// Sends an email, or in development (no email set up) logs the link instead.
async function sendOrLog(to: string, subject: string, text: string, link: string) {
  if (!emailConfigured()) {
    if (process.env.NODE_ENV !== 'production') {
      unsentLinks.set(to, link);
      if (process.env.NODE_ENV !== 'test') console.log(`[auth] Email not configured. "${subject}" for ${to}: ${link}`);
    }
    return;
  }
  const result = await sendEmail(to, subject, text);
  if (result.status === 'failed') console.error(`[auth] "${subject}" email failed:`, result.error);
}

// Emails a link that proves the address is theirs. Verified addresses are what make someone
// "verified" in a workplace or circle on that email domain, and a verified reporter on the map.
async function sendVerification(userId: number) {
  const user = db.prepare('SELECT name, email, email_verified_at FROM users WHERE id = ?').get(userId) as
    | { name: string; email: string; email_verified_at: string | null }
    | undefined;
  if (!user || user.email_verified_at) return;
  const token = randomToken();
  db.prepare('DELETE FROM email_verifications WHERE user_id = ?').run(userId);
  db.prepare('INSERT INTO email_verifications (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(
    sha256(token),
    userId,
    new Date(Date.now() + VERIFY_TOKEN_HOURS * 60 * 60 * 1000).toISOString()
  );
  const link = `${appUrl()}/verify-email/${token}`;
  await sendOrLog(
    user.email,
    'Confirm your email for HerSpace',
    `Hi ${user.name},\n\nPlease confirm this is your email address:\n${link}\n\nThe link works for ${VERIFY_TOKEN_HOURS} hours. If you didn't sign up for HerSpace, you can ignore this email.`,
    link
  );
}

// Marks the email as theirs, and with it any workplace or circle membership on its domain.
export function markEmailVerified(userId: number) {
  const user = db.prepare('SELECT email FROM users WHERE id = ?').get(userId) as { email: string };
  const domain = user.email.split('@')[1]?.toLowerCase() ?? '';
  db.prepare('UPDATE users SET email_verified_at = COALESCE(email_verified_at, ?) WHERE id = ?').run(now(), userId);
  db.prepare('DELETE FROM email_verifications WHERE user_id = ?').run(userId);
  db.prepare('UPDATE org_members SET verified = 1 WHERE user_id = ? AND org_id IN (SELECT id FROM organizations WHERE email_domain = ?)').run(userId, domain);
  db.prepare('UPDATE circle_members SET verified = 1 WHERE user_id = ? AND circle_id IN (SELECT id FROM circles WHERE email_domain = ?)').run(userId, domain);
}

const emailSchema = z.string().trim().toLowerCase().email();

const nameSchema = z.string().trim().min(1).max(100);
// Where to go after signing up: a path in this app, never another site.
const nextSchema = z
  .string()
  .max(300)
  .regex(/^\/(?!\/)[^\\\s]*$/)
  .optional();

const signupAccountLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  key: emailKey('signup'),
  message: 'An email was sent recently. Please check your inbox and spam folder.',
});

// Step 1: name and email. The answer is the same whether or not the email has an account, so
// nobody (an abusive partner, say) can use sign-up to find out whether she uses HerSpace. Either
// way the inbox gets the next step: a link to finish signing up, or a note that she already has
// an account.
authRouter.post('/signup', authLimiter, signupAccountLimiter, (req, res) => {
  const body = parse(z.object({ name: nameSchema, email: emailSchema, next: nextSchema }), req, res);
  if (!body) return;
  if (!emailConfigured() && process.env.NODE_ENV === 'production') {
    console.error('[auth] Sign-up attempted but email is not configured (RESEND_API_KEY / EMAIL_FROM).');
    return res.status(503).json({ error: "Sign-up isn't available right now. Please try again later." });
  }
  const existing = db.prepare('SELECT name FROM users WHERE email = ?').get(body.email) as { name: string } | undefined;
  if (existing) {
    const link = `${appUrl()}/login`;
    void sendOrLog(
      body.email,
      'You already have a HerSpace account',
      `Hi ${existing.name},\n\nSomeone, probably you, tried to sign up for HerSpace with this email. You already have an account, so you can log in:\n${link}\n\nForgot your password? Reset it here: ${appUrl()}/forgot-password\n\nIf this wasn't you, you can ignore this email: nothing has changed.`,
      link
    );
  } else {
    const token = randomToken();
    db.prepare('INSERT INTO pending_signups (token_hash, name, email, next, expires_at) VALUES (?, ?, ?, ?, ?)').run(
      sha256(token),
      body.name,
      body.email,
      body.next ?? null,
      new Date(Date.now() + SIGNUP_TOKEN_HOURS * 60 * 60 * 1000).toISOString()
    );
    const link = `${appUrl()}/finish-signup/${token}`;
    void sendOrLog(
      body.email,
      'Finish creating your HerSpace account',
      `Hi ${body.name},\n\nOpen this link to choose a password and finish creating your account:\n${link}\n\nThe link works for ${SIGNUP_TOKEN_HOURS} hours. If you didn't sign up for HerSpace, you can ignore this email: no account is created.`,
      link
    );
  }
  res.status(202).json({ checkEmail: true });
});

type PendingRow = { name: string; email: string; next: string | null; expires_at: string };
const pendingSignup = (token: string) => {
  const row = db.prepare('SELECT name, email, next, expires_at FROM pending_signups WHERE token_hash = ?').get(sha256(token)) as PendingRow | undefined;
  return row && new Date(row.expires_at) > new Date() ? row : undefined;
};
const EXPIRED_SIGNUP = 'This link is invalid or has expired. Please sign up again.';
const tokenSchema = z.string().min(10).max(200);

// For the "choose a password" page: who is signing up.
authRouter.post('/signup/pending', authLimiter, (req, res) => {
  const body = parse(z.object({ token: tokenSchema }), req, res);
  if (!body) return;
  const row = pendingSignup(body.token);
  if (!row) return res.status(400).json({ error: EXPIRED_SIGNUP });
  res.json({ name: row.name, email: row.email });
});

// Step 2, from the emailed link: she chooses the password here, so nobody else can set one for
// her address. The account is created with its email already confirmed.
authRouter.post('/signup/finish', authLimiter, (req, res) => {
  const body = parse(z.object({ token: tokenSchema, name: nameSchema, password: passwordSchema }), req, res);
  if (!body) return;
  const row = pendingSignup(body.token);
  if (!row) return res.status(400).json({ error: EXPIRED_SIGNUP });
  // Only the inbox's owner gets this far, so saying so reveals nothing.
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(row.email)) {
    db.prepare('DELETE FROM pending_signups WHERE email = ?').run(row.email);
    return res.status(409).json({ error: 'This email already has an account. Please log in.' });
  }
  const stamp = now();
  const result = db
    .prepare('INSERT INTO users (name, email, password_hash, created_at, email_verified_at) VALUES (?, ?, ?, ?, ?)')
    .run(body.name, row.email, hashPassword(body.password), stamp, stamp);
  db.prepare('DELETE FROM pending_signups WHERE email = ?').run(row.email);
  const id = Number(result.lastInsertRowid);
  startSession(res, id);
  res.status(201).json({ user: publicUser(id), next: row.next });
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
  // The reset link arrived by email, so the address is theirs.
  markEmailVerified(row.user_id);
  deleteAllSessions(row.user_id);
  startSession(res, row.user_id);
  res.json({ user: publicUser(row.user_id) });
});

const verifyLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 3, key: perUser, message: 'A link was sent recently. Please check your inbox and spam folder.' });

authRouter.post('/verify-email/send', requireAuth, verifyLimiter, async (req, res) => {
  if (req.user!.emailVerified) return res.json({ success: true, alreadyVerified: true });
  if (!emailConfigured() && process.env.NODE_ENV === 'production') return res.status(503).json({ error: "Emails can't be sent right now." });
  await sendVerification(req.user!.id);
  res.json({ success: true });
});

// Works without being logged in: the link may be opened on another device.
authRouter.post('/verify-email', authLimiter, (req, res) => {
  const body = parse(z.object({ token: z.string().min(10).max(200) }), req, res);
  if (!body) return;
  const row = db.prepare('SELECT user_id, expires_at FROM email_verifications WHERE token_hash = ?').get(sha256(body.token)) as
    | { user_id: number; expires_at: string }
    | undefined;
  if (!row || new Date(row.expires_at) < new Date()) {
    return res.status(400).json({ error: 'This link is invalid or has expired. Send a new one from your account page.' });
  }
  markEmailVerified(row.user_id);
  res.json({ success: true });
});
