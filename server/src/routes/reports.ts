import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { requireAuth } from '../auth';
import { rateLimit } from '../rateLimit';
import { coordsSchema, keyedHash, now, parse } from '../util';

export const reportsRouter = Router();

// Reports with this many community flags are hidden from the public map pending review.
const FLAG_THRESHOLD = Number(process.env.MAP_FLAG_THRESHOLD || 3);

const reportLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 10 });
const flagLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 20 });

const reportSchema = z.object({
  incidentType: z.enum(['harassment', 'assault', 'stalking', 'threat', 'discrimination', 'other']),
  description: z.string().trim().min(1).max(5000),
  location: z.string().trim().max(200).optional().default(''),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal('')),
  coords: coordsSchema.optional(),
  anonymous: z.boolean().default(false),
});

reportsRouter.post('/', reportLimiter, (req, res) => {
  const body = parse(reportSchema, req, res);
  if (!body) return;
  // Anonymous reports never store who submitted them, even when logged in.
  const userId = body.anonymous ? null : req.user?.id ?? null;
  const result = db
    .prepare(
      `INSERT INTO reports (user_id, incident_type, description, location_text, lat, lng, incident_date, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(userId, body.incidentType, body.description, body.location || null, body.coords?.lat ?? null, body.coords?.lng ?? null, body.date || null, now());
  res.status(201).json({ success: true, id: Number(result.lastInsertRowid), linkedToAccount: userId !== null });
});

// A user's own (non-anonymous) reports.
reportsRouter.get('/', requireAuth, (req, res) => {
  const reports = db
    .prepare(
      `SELECT id, incident_type AS incidentType, description, location_text AS location, incident_date AS date, created_at AS createdAt
       FROM reports WHERE user_id = ? ORDER BY id DESC`
    )
    .all(req.user!.id);
  res.json({ reports });
});

reportsRouter.delete('/:id', requireAuth, (req, res) => {
  const result = db.prepare('DELETE FROM reports WHERE id = ? AND user_id = ?').run(Number(req.params.id), req.user!.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Report not found.' });
  res.json({ success: true });
});

// Public map data: type, coarse location (~1 km) and date only. No descriptions or identities.
reportsRouter.get('/map', (_req, res) => {
  const points = db
    .prepare(
      `SELECT r.id, r.incident_type AS incidentType, ROUND(r.lat, 2) AS lat, ROUND(r.lng, 2) AS lng,
              COALESCE(r.incident_date, substr(r.created_at, 1, 10)) AS date
       FROM reports r
       WHERE r.lat IS NOT NULL AND r.lng IS NOT NULL
         AND (SELECT COUNT(*) FROM report_flags f WHERE f.report_id = r.id) < ?
       ORDER BY r.id DESC LIMIT 1000`
    )
    .all(FLAG_THRESHOLD);
  res.json({ points });
});

// Anyone can flag a map point as false or abusive; each person/IP counts once per report.
reportsRouter.post('/:id/flag', flagLimiter, (req, res) => {
  const id = Number(req.params.id);
  const exists = db.prepare('SELECT 1 FROM reports WHERE id = ? AND lat IS NOT NULL').get(id);
  if (!exists) return res.status(404).json({ error: 'Report not found.' });
  const flagger = req.user ? `user:${req.user.id}` : `ip:${keyedHash(req.ip || 'unknown')}`;
  db.prepare('INSERT OR IGNORE INTO report_flags (report_id, flagger, created_at) VALUES (?, ?, ?)').run(id, flagger, now());
  res.json({ success: true });
});
