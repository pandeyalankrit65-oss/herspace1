import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { requireAuth, type User } from '../auth';
import { now, parse } from '../util';
import { triggerAlert } from './sos';
import { listContacts } from './contacts';
import { sendSms } from '../messaging';

// Daily check-in, for someone living alone: she taps "I'm fine" by her chosen time each day; if
// she doesn't, her contacts are told once. Enforced here, so it works even if her phone is off.

export const dailyRouter = Router();
dailyRouter.use(requireAuth);

type Row = { user_id: number; deadline: string; utc_offset: number; next_due_at: string; last_ok_at: string | null; last_alerted_at: string | null };

// Her deadline `days` days after her local date at `at`, as a UTC instant.
export function deadlineAfter(at: Date, deadline: string, utcOffset: number, days: number) {
  const local = new Date(at.getTime() + utcOffset * 60_000);
  const [h, m] = deadline.split(':').map(Number);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + days, h, m) - utcOffset * 60_000);
}

const rowFor = (userId: number) => db.prepare('SELECT * FROM daily_checkins WHERE user_id = ?').get(userId) as Row | undefined;
const view = (r: Row | undefined) =>
  r ? { active: true, deadline: r.deadline, nextDueAt: r.next_due_at, lastOkAt: r.last_ok_at, lastAlertedAt: r.last_alerted_at } : { active: false };

dailyRouter.get('/', (req, res) => res.json(view(rowFor(req.user!.id))));

// Turning it on counts as today's "I'm fine": the first deadline is tomorrow's.
dailyRouter.put('/', (req, res) => {
  const body = parse(
    z.object({ deadline: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), utcOffset: z.number().int().min(-720).max(840) }),
    req,
    res
  );
  if (!body) return;
  const next = deadlineAfter(new Date(), body.deadline, body.utcOffset, 1).toISOString();
  db.prepare(
    `INSERT INTO daily_checkins (user_id, deadline, utc_offset, next_due_at, last_ok_at, created_at) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET deadline = excluded.deadline, utc_offset = excluded.utc_offset, next_due_at = excluded.next_due_at, last_ok_at = excluded.last_ok_at`
  ).run(req.user!.id, body.deadline, body.utcOffset, next, now(), now());
  res.json(view(rowFor(req.user!.id)));
});

// "I'm fine" for today: the next deadline is tomorrow's, in her time. If her contacts were just
// told she'd missed one, they're told she's okay, so nobody is left worrying.
dailyRouter.post('/ok', async (req, res) => {
  const r = rowFor(req.user!.id);
  if (!r) return res.status(404).json({ error: 'Daily check-in is off.' });
  const next = deadlineAfter(new Date(), r.deadline, r.utc_offset, 1).toISOString();
  db.prepare('UPDATE daily_checkins SET next_due_at = ?, last_ok_at = ? WHERE user_id = ?').run(next, now(), r.user_id);
  const afterAlert = r.last_alerted_at && (!r.last_ok_at || r.last_alerted_at > r.last_ok_at) && Date.now() - Date.parse(r.last_alerted_at) < 24 * 60 * 60_000;
  let told = 0;
  if (afterAlert) {
    const confirmed = listContacts(r.user_id).filter((c) => c.status === 'confirmed');
    const results = await Promise.all(
      confirmed.map((c) => sendSms(c.phone, `HerSpace: ${req.user!.name} has now confirmed they're okay today. Thank you for checking on them.`))
    );
    told = results.filter((x) => x.status !== 'failed').length;
  }
  res.json({ ...view(rowFor(r.user_id)), told });
});

// Away for a few days (with family, travelling): no check-ins until she's back.
dailyRouter.post('/pause', (req, res) => {
  const body = parse(z.object({ days: z.number().int().min(1).max(30) }), req, res);
  if (!body) return;
  const r = rowFor(req.user!.id);
  if (!r) return res.status(404).json({ error: 'Daily check-in is off.' });
  const next = deadlineAfter(new Date(), r.deadline, r.utc_offset, body.days + 1).toISOString();
  db.prepare('UPDATE daily_checkins SET next_due_at = ? WHERE user_id = ?').run(next, r.user_id);
  res.json(view(rowFor(r.user_id)));
});

dailyRouter.delete('/', (req, res) => {
  db.prepare('DELETE FROM daily_checkins WHERE user_id = ?').run(req.user!.id);
  res.json({ active: false });
});

// Called by the server's scheduler: tells contacts about each missed day, once, and moves the
// deadline to the next day. Claiming each row with a conditional UPDATE means no double alerts.
export async function processMissedDailyCheckIns(at: Date = new Date()) {
  const due = db.prepare('SELECT * FROM daily_checkins WHERE next_due_at <= ?').all(at.toISOString()) as Row[];
  let alerted = 0;
  for (const r of due) {
    const next = deadlineAfter(new Date(r.next_due_at), r.deadline, r.utc_offset, 1).toISOString();
    const claimed = db
      .prepare('UPDATE daily_checkins SET next_due_at = ?, last_alerted_at = ? WHERE user_id = ? AND next_due_at = ?')
      .run(next, now(), r.user_id, r.next_due_at);
    if (claimed.changes === 0) continue;
    const user = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(r.user_id) as User | undefined;
    if (!user) continue;
    try {
      await triggerAlert(user, undefined, { daily: { deadline: r.deadline } });
      alerted++;
    } catch (err) {
      console.error(`[daily] Failed to alert for user ${r.user_id}:`, err);
    }
  }
  return alerted;
}
