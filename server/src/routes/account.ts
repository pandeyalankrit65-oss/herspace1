import { Router } from 'express';
import { z } from 'zod';
import { db, deleteSosEvents } from '../db';
import { deleteAllSessions, endSession, hashPassword, requireAuth, startSession, verifyPassword } from '../auth';
import { rateLimit } from '../rateLimit';
import { keyedHash, now, parse, passwordSchema, phoneSchema } from '../util';
import { sendSms } from '../messaging';
import { codePhraseMessage, listContacts } from './contacts';
import { perUser } from '../rateLimit';
import crypto from 'crypto';
import { deleteReports, reportPhotos } from './reports';

// Account self-service: password change, data export and deletion (DPDP Act rights).
export const accountRouter = Router();

accountRouter.use(requireAuth);
const passwordLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });
const phoneCodeLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 5, key: perUser, message: 'Too many codes requested. Try again in an hour.' });
const phoneCodeIpLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 10, message: 'Too many codes requested. Try again in an hour.' });
const phoneCodeNumberLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 3,
  key: (req) => {
    const phone = typeof req.body?.phone === 'string' ? req.body.phone.replace(/[^\d+]/g, '') : '';
    return phone ? `phone:${phone}` : undefined;
  },
  message: 'Too many codes sent to this number today. Try again tomorrow.',
});

const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_CODE_ATTEMPTS = 5;
const codeHash = (userId: number, code: string) => keyedHash(`phone:${userId}:${code}`);

// Step 1 of verifying the user's own number: text them a 6-digit code.
accountRouter.post('/phone', phoneCodeLimiter, phoneCodeIpLimiter, phoneCodeNumberLimiter, async (req, res) => {
  const body = parse(z.object({ phone: phoneSchema }), req, res);
  if (!body) return;
  const userId = req.user!.id;
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  db.prepare(
    `INSERT INTO phone_codes (user_id, phone, code_hash, expires_at, attempts) VALUES (?, ?, ?, ?, 0)
     ON CONFLICT(user_id) DO UPDATE SET phone = excluded.phone, code_hash = excluded.code_hash, expires_at = excluded.expires_at, attempts = 0`
  ).run(userId, body.phone, codeHash(userId, code), new Date(Date.now() + CODE_TTL_MS).toISOString());
  const sms = await sendSms(body.phone, `HerSpace: your verification code is ${code}. It expires in 10 minutes. Don't share it with anyone.`);
  if (sms.status !== 'sent') {
    db.prepare('DELETE FROM phone_codes WHERE user_id = ?').run(userId);
    return res.status(sms.status === 'not_configured' ? 503 : 502).json({
      error: sms.status === 'not_configured' ? "Text messages aren't set up on this server, so the number can't be verified." : "The code couldn't be sent. Check the number and try again.",
    });
  }
  res.json({ success: true, phone: body.phone });
});

// Step 2: check the code. Five wrong tries and the code is dead.
accountRouter.post('/phone/verify', (req, res) => {
  const body = parse(z.object({ code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code') }), req, res);
  if (!body) return;
  const userId = req.user!.id;
  const row = db.prepare('SELECT phone, code_hash AS hash, expires_at AS expiresAt, attempts FROM phone_codes WHERE user_id = ?').get(userId) as
    | { phone: string; hash: string; expiresAt: string; attempts: number }
    | undefined;
  if (!row || new Date(row.expiresAt) < new Date() || row.attempts >= MAX_CODE_ATTEMPTS) {
    return res.status(410).json({ error: 'This code has expired. Request a new one.' });
  }
  const given = Buffer.from(codeHash(userId, body.code));
  if (!crypto.timingSafeEqual(given, Buffer.from(row.hash))) {
    db.prepare('UPDATE phone_codes SET attempts = attempts + 1 WHERE user_id = ?').run(userId);
    return res.status(400).json({ error: "That code isn't right." });
  }
  db.prepare('UPDATE users SET phone = ?, phone_verified_at = ? WHERE id = ?').run(row.phone, now(), userId);
  db.prepare('DELETE FROM phone_codes WHERE user_id = ?').run(userId);
  res.json({ success: true, phone: row.phone });
});

accountRouter.get('/code-phrase', (req, res) => {
  const row = db.prepare('SELECT code_phrase AS phrase FROM users WHERE id = ?').get(req.user!.id) as { phrase: string | null };
  res.json({ phrase: row.phrase });
});

const codePhraseLimiter = rateLimit({ windowMs: 24 * 60 * 60 * 1000, max: 5, key: perUser, message: 'You can change your code phrase up to 5 times a day.' });

// Saving a phrase texts every confirmed contact what it means; new contacts get it when they confirm.
accountRouter.put('/code-phrase', codePhraseLimiter, async (req, res) => {
  const body = parse(z.object({ phrase: z.string().trim().min(3).max(60).nullable() }), req, res);
  if (!body) return;
  const user = req.user!;
  db.prepare('UPDATE users SET code_phrase = ? WHERE id = ?').run(body.phrase, user.id);
  let told = 0;
  if (body.phrase) {
    const confirmed = listContacts(user.id).filter((c) => c.status === 'confirmed');
    const results = await Promise.all(confirmed.map((c) => sendSms(c.phone, codePhraseMessage(user.name, body.phrase!))));
    told = results.filter((r) => r.status === 'sent').length;
  }
  res.json({ phrase: body.phrase, told });
});

accountRouter.delete('/phone', (req, res) => {
  db.prepare('UPDATE users SET phone = NULL, phone_verified_at = NULL WHERE id = ?').run(req.user!.id);
  db.prepare('DELETE FROM phone_codes WHERE user_id = ?').run(req.user!.id);
  res.json({ success: true });
});

const checkPassword = (userId: number, password: string) => {
  const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId) as { password_hash: string };
  return verifyPassword(password, row.password_hash);
};

// Progress through the "ready for an emergency" checklist shown on the home and SOS pages.
accountRouter.get('/setup', (req, res) => {
  const userId = req.user!.id;
  const contacts = db
    .prepare("SELECT COUNT(*) AS total, COALESCE(SUM(status = 'confirmed'), 0) AS confirmed FROM contacts WHERE user_id = ?")
    .get(userId) as { total: number; confirmed: number };
  const test = db.prepare('SELECT 1 FROM sos_events WHERE user_id = ? AND is_test = 1 LIMIT 1').get(userId);
  res.json({ contacts: contacts.total, confirmed: contacts.confirmed, testSent: Boolean(test) });
});

accountRouter.post('/password', passwordLimiter, (req, res) => {
  const body = parse(z.object({ currentPassword: z.string().min(1).max(200), newPassword: passwordSchema }), req, res);
  if (!body) return;
  const userId = req.user!.id;
  if (!checkPassword(userId, body.currentPassword)) return res.status(401).json({ error: 'Current password is incorrect.' });
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(body.newPassword), userId);
  // Sign out other devices; this one gets a fresh session.
  deleteAllSessions(userId);
  startSession(res, userId);
  res.json({ success: true });
});

accountRouter.get('/export', (req, res) => {
  const userId = req.user!.id;
  const user = db.prepare('SELECT id, name, email, phone, phone_verified_at AS phoneVerifiedAt, code_phrase AS codePhrase, created_at AS createdAt FROM users WHERE id = ?').get(userId);
  const contacts = db.prepare('SELECT name, phone, relation, status FROM contacts WHERE user_id = ?').all(userId);
  const reports = db
    .prepare(
      `SELECT id, incident_type AS incidentType, description, location_text AS location, lat, lng,
              incident_date AS date, created_at AS createdAt FROM reports WHERE user_id = ?`
    )
    .all(userId)
    .map((r) => {
      const { id, ...rest } = r as { id: number };
      return { ...rest, photos: reportPhotos(id).length };
    });
  const sosEvents = (
    db.prepare('SELECT id, lat, lng, accuracy, created_at AS createdAt, is_test AS isTest FROM sos_events WHERE user_id = ?').all(userId) as Array<{ id: number }>
  ).map((e) => ({
    ...e,
    deliveries: db.prepare('SELECT contact_name AS name, phone, channel, status FROM sos_deliveries WHERE sos_id = ?').all(e.id),
    recordings: (db.prepare('SELECT COUNT(*) AS n FROM sos_recordings WHERE sos_id = ?').get(e.id) as { n: number }).n,
  }));
  res.setHeader('Content-Disposition', 'attachment; filename="herspace-data.json"');
  const locationShares = db
    .prepare('SELECT created_at AS createdAt, expires_at AS expiresAt, ended_at AS endedAt, lat, lng, updated_at AS updatedAt FROM location_shares WHERE user_id = ?')
    .all(userId);
  const checkIns = db
    .prepare('SELECT note, status, created_at AS createdAt, due_at AS dueAt, alerted_at AS alertedAt FROM check_ins WHERE user_id = ?')
    .all(userId);
  res.json({ exportedAt: new Date().toISOString(), user, contacts, reports, sosEvents, locationShares, checkIns, note: 'Anonymous reports are not linked to your account and cannot be exported.' });
});

accountRouter.delete('/', passwordLimiter, (req, res) => {
  const body = parse(z.object({ password: z.string().min(1).max(200) }), req, res);
  if (!body) return;
  const userId = req.user!.id;
  if (!checkPassword(userId, body.password)) return res.status(401).json({ error: 'Password is incorrect.' });
  db.exec('BEGIN');
  try {
    // Personal data goes with the account. Anonymous reports were never linked to it.
    deleteReports('r.user_id = ?', userId);
    deleteSosEvents('user_id = ?', userId);
    db.prepare('DELETE FROM users WHERE id = ?').run(userId); // cascades to sessions, contacts, resets
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  endSession(req, res);
  res.json({ success: true });
});
