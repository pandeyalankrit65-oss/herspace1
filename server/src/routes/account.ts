import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { deleteAllSessions, endSession, hashPassword, requireAuth, startSession, verifyPassword } from '../auth';
import { rateLimit } from '../rateLimit';
import { parse, passwordSchema } from '../util';

// Account self-service: password change, data export and deletion (DPDP Act rights).
export const accountRouter = Router();

accountRouter.use(requireAuth);
const passwordLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });

const checkPassword = (userId: number, password: string) => {
  const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId) as { password_hash: string };
  return verifyPassword(password, row.password_hash);
};

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
  const user = db.prepare('SELECT id, name, email, created_at AS createdAt FROM users WHERE id = ?').get(userId);
  const contacts = db.prepare('SELECT name, phone, relation, status FROM contacts WHERE user_id = ?').all(userId);
  const reports = db
    .prepare(
      `SELECT incident_type AS incidentType, description, location_text AS location, lat, lng,
              incident_date AS date, created_at AS createdAt FROM reports WHERE user_id = ?`
    )
    .all(userId);
  const sosEvents = (
    db.prepare('SELECT id, lat, lng, accuracy, created_at AS createdAt, is_test AS isTest FROM sos_events WHERE user_id = ?').all(userId) as Array<{ id: number }>
  ).map((e) => ({
    ...e,
    deliveries: db.prepare('SELECT contact_name AS name, phone, channel, status FROM sos_deliveries WHERE sos_id = ?').all(e.id),
  }));
  res.setHeader('Content-Disposition', 'attachment; filename="herspace-data.json"');
  res.json({ exportedAt: new Date().toISOString(), user, contacts, reports, sosEvents, note: 'Anonymous reports are not linked to your account and cannot be exported.' });
});

accountRouter.delete('/', passwordLimiter, (req, res) => {
  const body = parse(z.object({ password: z.string().min(1).max(200) }), req, res);
  if (!body) return;
  const userId = req.user!.id;
  if (!checkPassword(userId, body.password)) return res.status(401).json({ error: 'Password is incorrect.' });
  db.exec('BEGIN');
  try {
    // Personal data goes with the account. Anonymous reports were never linked to it.
    db.prepare('DELETE FROM reports WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM sos_events WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM users WHERE id = ?').run(userId); // cascades to sessions, contacts, resets
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  endSession(req, res);
  res.json({ success: true });
});
