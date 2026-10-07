import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { requireModerator } from '../auth';
import { now, parse } from '../util';
import { sendEmail } from '../messaging';
import { ACCOUNT_SIGNALS, accountSignals, pseudonym } from '../trust';
import { FLAG_THRESHOLD, reportPhotos } from './reports';

// Review queue for Safe Map points. Moderators see what they need to judge a report
// (type, description, date, rough area, photos, flags), never who submitted it.
export const moderationRouter = Router();
moderationRouter.use(requireModerator);

const QUEUES = {
  // New points that tripped a rule (copied text, a burst, ...): not on the map until checked.
  held: `status = 'held'`,
  // Flagged points nobody has decided on yet; the most-flagged (already hidden) first.
  review: `status = 'visible' AND flags > 0`,
  approved: `status = 'approved'`,
  removed: `status = 'removed'`,
} as const;

moderationRouter.get('/reports', (req, res) => {
  const q = z.enum(['held', 'review', 'approved', 'removed']).safeParse(req.query.queue ?? 'review');
  if (!q.success) return res.status(400).json({ error: 'Unknown queue' });
  const rows = db
    .prepare(
      `SELECT * FROM (
         SELECT r.id, r.incident_type AS incidentType, r.description, ROUND(r.lat, 2) AS lat, ROUND(r.lng, 2) AS lng,
                COALESCE(r.incident_date, substr(r.created_at, 1, 10)) AS date, r.map_status AS status,
                r.reporter_trust AS trust, r.hold_reasons AS holdReasons,
                (SELECT COUNT(*) FROM report_confirmations c WHERE c.report_id = r.id) AS confirmations,
                (SELECT COUNT(*) FROM report_flags f WHERE f.report_id = r.id) AS flags
         FROM reports r WHERE r.lat IS NOT NULL AND r.lng IS NOT NULL
       )
       WHERE ${QUEUES[q.data]}
       ORDER BY flags DESC, id DESC LIMIT 200`
    )
    .all() as Array<{ id: number; flags: number; status: string; holdReasons: string | null }>;
  const reports = rows.map((r) => ({
    ...r,
    holdReasons: r.holdReasons ? r.holdReasons.split(',') : [],
    hidden: r.status === 'removed' || r.status === 'held' || (r.status !== 'approved' && r.flags >= FLAG_THRESHOLD),
    photos: reportPhotos(r.id).map((p) => p.id),
  }));
  res.json({ reports, flagThreshold: FLAG_THRESHOLD });
});

const ACTIONS = { approve: 'approved', remove: 'removed', reopen: 'visible' } as const;

moderationRouter.post('/reports/:id', (req, res) => {
  const body = parse(z.object({ action: z.enum(['approve', 'remove', 'reopen']) }), req, res);
  if (!body) return;
  const status = ACTIONS[body.action];
  const result = db.prepare('UPDATE reports SET map_status = ? WHERE id = ? AND lat IS NOT NULL').run(status, Number(req.params.id));
  if (result.changes === 0) return res.status(404).json({ error: 'Report not found.' });
  // Reopening starts the count again, so old flags don't immediately hide it.
  if (body.action === 'reopen') db.prepare('DELETE FROM report_flags WHERE report_id = ?').run(Number(req.params.id));
  res.json({ success: true, status });
});

// --- Accounts ----------------------------------------------------------------------------------
// Accounts whose reports look like misuse, shown by pseudonym with the reasons. Moderators can
// pause an account from the Safe Map without ever learning who it is.

type AccountRow = { id: number; created_at: string; email_verified_at: string | null; phone: string | null; suspended_at: string | null; suspended_reason: string | null; reviewed_at: string | null };

const accountView = (a: AccountRow) => {
  const { signals, stats } = accountSignals(a.id);
  return {
    id: a.id,
    name: pseudonym(a.id),
    createdAt: a.created_at,
    emailVerified: Boolean(a.email_verified_at),
    phoneVerified: Boolean(a.phone),
    suspendedAt: a.suspended_at,
    suspendedReason: a.suspended_reason,
    signals,
    stats,
  };
};

moderationRouter.get('/accounts', (req, res) => {
  const view = z.enum(['review', 'suspended']).safeParse(req.query.view ?? 'review');
  if (!view.success) return res.status(400).json({ error: 'Unknown view' });
  const columns = 'u.id, u.created_at, u.email_verified_at, u.phone, u.suspended_at, u.suspended_reason, u.reviewed_at';
  if (view.data === 'suspended') {
    const rows = db.prepare(`SELECT ${columns} FROM users u WHERE u.suspended_at IS NOT NULL ORDER BY u.suspended_at DESC`).all() as AccountRow[];
    return res.json({ accounts: rows.map(accountView), signals: ACCOUNT_SIGNALS });
  }
  // Anyone who has reported, or signed up with a throwaway address, is a candidate; they're
  // listed if a rule matches and something happened since a moderator last cleared them.
  const rows = db
    .prepare(
      `SELECT ${columns}, (SELECT MAX(created_at) FROM reports r WHERE r.user_id = u.id) AS last_report
       FROM users u WHERE u.suspended_at IS NULL AND (EXISTS (SELECT 1 FROM reports r WHERE r.user_id = u.id) OR u.email_verified_at IS NULL)`
    )
    .all() as Array<AccountRow & { last_report: string | null }>;
  const accounts = rows
    .filter((a) => !a.reviewed_at || (a.last_report && a.last_report > a.reviewed_at))
    .map(accountView)
    .filter((a) => a.signals.length > 0)
    .slice(0, 200);
  res.json({ accounts, signals: ACCOUNT_SIGNALS });
});

moderationRouter.post('/accounts/:id', async (req, res) => {
  const body = parse(z.object({ action: z.enum(['suspend', 'unsuspend', 'clear']), reason: z.string().trim().max(300).optional() }), req, res);
  if (!body) return;
  if (body.action === 'suspend' && !body.reason) return res.status(400).json({ error: 'Say why. The person is told the reason.' });
  const id = Number(req.params.id);
  const user = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(id) as { id: number; name: string; email: string } | undefined;
  if (!user) return res.status(404).json({ error: 'Account not found.' });
  if (user.id === req.user!.id) return res.status(400).json({ error: "You can't moderate your own account." });
  const stamp = now();
  if (body.action === 'suspend') {
    db.prepare('UPDATE users SET suspended_at = ?, suspended_reason = ?, reviewed_at = ? WHERE id = ?').run(stamp, body.reason ?? null, stamp, id);
    void sendEmail(
      user.email,
      'Your HerSpace Safe Map access is paused',
      `Hi ${user.name},\n\nA HerSpace moderator has paused your account from adding reports, flags and confirmations to the Safe Map, and your map points are hidden.\n\nThe reason: ${body.reason}\n\nSOS, your emergency contacts, the safety timer and everything else still work as before. If you think this is a mistake, reply to this email.`
    );
  } else if (body.action === 'unsuspend') {
    db.prepare('UPDATE users SET suspended_at = NULL, suspended_reason = NULL, reviewed_at = ? WHERE id = ?').run(stamp, id);
    void sendEmail(user.email, 'Your HerSpace Safe Map access is back', `Hi ${user.name},\n\nYou can add to the Safe Map again. Thank you for your patience.`);
  } else {
    db.prepare('UPDATE users SET reviewed_at = ? WHERE id = ?').run(stamp, id);
  }
  res.json({ success: true });
});
