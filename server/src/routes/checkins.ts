import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { requireAuth, User } from '../auth';
import { perUser, rateLimit } from '../rateLimit';
import { coordsSchema, now, parse } from '../util';
import { triggerAlert } from './sos';

// Safety timers ("check in by 9:30 or alert my contacts"). The deadline is enforced by the
// server, so it still works if the phone is switched off, lost or out of battery.
export const checkInsRouter = Router();

type CheckInRow = {
  id: number;
  user_id: number;
  note: string | null;
  status: 'active' | 'completed' | 'cancelled' | 'alerted';
  created_at: string;
  due_at: string;
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  location_at: string | null;
  alerted_at: string | null;
};

const view = (c: CheckInRow) => ({
  id: c.id,
  note: c.note,
  status: c.status,
  createdAt: c.created_at,
  dueAt: c.due_at,
  alertedAt: c.alerted_at,
  hasLocation: c.lat !== null,
});

const ownCheckIn = (id: number, userId: number) =>
  db.prepare('SELECT * FROM check_ins WHERE id = ? AND user_id = ?').get(id, userId) as CheckInRow | undefined;

// The timer the user should currently see: running, or alerted and not yet resolved.
const currentCheckIn = (userId: number) =>
  db
    .prepare("SELECT * FROM check_ins WHERE user_id = ? AND status IN ('active', 'alerted') ORDER BY id DESC LIMIT 1")
    .get(userId) as CheckInRow | undefined;

const minutesFrom = (base: number, minutes: number) => new Date(base + minutes * 60_000).toISOString();

checkInsRouter.use(requireAuth);

const createLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 30, key: perUser });

checkInsRouter.post('/', createLimiter, (req, res) => {
  const body = parse(
    z.object({
      minutes: z.number().int().min(1).max(12 * 60),
      note: z.string().trim().max(120).optional(),
      coords: coordsSchema.optional(),
    }),
    req,
    res
  );
  if (!body) return;
  const userId = req.user!.id;
  const stamp = now();
  // One timer at a time: starting a new one replaces a running one.
  db.prepare("UPDATE check_ins SET status = 'cancelled' WHERE user_id = ? AND status = 'active'").run(userId);
  const result = db
    .prepare(
      `INSERT INTO check_ins (user_id, note, created_at, due_at, lat, lng, accuracy, location_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      userId,
      body.note || null,
      stamp,
      minutesFrom(Date.now(), body.minutes),
      body.coords?.lat ?? null,
      body.coords?.lng ?? null,
      body.coords?.accuracy ?? null,
      body.coords ? stamp : null
    );
  res.status(201).json({ checkIn: view(ownCheckIn(Number(result.lastInsertRowid), userId)!) });
});

checkInsRouter.get('/current', (req, res) => {
  const current = currentCheckIn(req.user!.id);
  res.json({ checkIn: current ? view(current) : null });
});

checkInsRouter.post('/:id/extend', (req, res) => {
  const body = parse(z.object({ minutes: z.number().int().min(1).max(4 * 60) }), req, res);
  if (!body) return;
  const c = ownCheckIn(Number(req.params.id), req.user!.id);
  if (!c) return res.status(404).json({ error: 'Timer not found.' });
  if (c.status !== 'active') return res.status(409).json({ error: 'This timer has already ended.' });
  const dueAt = minutesFrom(Math.max(Date.now(), new Date(c.due_at).getTime()), body.minutes);
  db.prepare('UPDATE check_ins SET due_at = ? WHERE id = ?').run(dueAt, c.id);
  res.json({ checkIn: view({ ...c, due_at: dueAt }) });
});

// Keeps the last known position fresh while the timer page is open.
const locationLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 240, key: perUser });
checkInsRouter.post('/:id/location', locationLimiter, (req, res) => {
  const body = parse(z.object({ coords: coordsSchema }), req, res);
  if (!body) return;
  const c = ownCheckIn(Number(req.params.id), req.user!.id);
  if (!c) return res.status(404).json({ error: 'Timer not found.' });
  if (c.status !== 'active') return res.status(409).json({ error: 'This timer has already ended.' });
  db.prepare('UPDATE check_ins SET lat = ?, lng = ?, accuracy = ?, location_at = ? WHERE id = ?').run(
    body.coords.lat,
    body.coords.lng,
    body.coords.accuracy ?? null,
    now(),
    c.id
  );
  res.json({ success: true });
});

// "I'm safe": ends the timer, or resolves an alert that already went out (and stops the
// live-location link that alert started).
checkInsRouter.post('/:id/complete', (req, res) => {
  const c = ownCheckIn(Number(req.params.id), req.user!.id);
  if (!c) return res.status(404).json({ error: 'Timer not found.' });
  if (c.status === 'active' || c.status === 'alerted') {
    db.prepare("UPDATE check_ins SET status = 'completed', lat = NULL, lng = NULL, accuracy = NULL WHERE id = ?").run(c.id);
  }
  if (c.status === 'alerted') {
    db.prepare(
      'UPDATE location_shares SET ended_at = COALESCE(ended_at, ?), lat = NULL, lng = NULL, accuracy = NULL, speed = NULL, heading = NULL WHERE user_id = ? AND ended_at IS NULL'
    ).run(now(), req.user!.id);
  }
  res.json({ success: true, wasAlerted: c.status === 'alerted' });
});

// Called every few seconds by the server: alerts contacts for every timer that ran out.
// Claiming each row with a conditional UPDATE means a timer is never alerted twice.
export async function processOverdueCheckIns(at: Date = new Date()) {
  const due = db
    .prepare("SELECT * FROM check_ins WHERE status = 'active' AND due_at <= ? ORDER BY due_at")
    .all(at.toISOString()) as CheckInRow[];
  let alerted = 0;
  for (const c of due) {
    const claimed = db
      .prepare("UPDATE check_ins SET status = 'alerted', alerted_at = ? WHERE id = ? AND status = 'active'")
      .run(now(), c.id);
    if (claimed.changes === 0) continue;
    const user = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(c.user_id) as User | undefined;
    if (!user) continue;
    const coords = c.lat !== null && c.lng !== null ? { lat: c.lat, lng: c.lng, accuracy: c.accuracy ?? undefined } : undefined;
    try {
      const result = await triggerAlert(user, coords, { checkIn: { note: c.note, startedAt: c.created_at, dueAt: c.due_at } });
      db.prepare('UPDATE check_ins SET sos_id = ? WHERE id = ?').run(result.id, c.id);
      alerted++;
    } catch (err) {
      console.error(`[check-in] Failed to alert for timer ${c.id}:`, err);
    }
  }
  return alerted;
}
