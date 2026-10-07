import express, { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { requireAuth } from '../auth';
import { deletePhotoFiles, MAX_PHOTO_BYTES, MAX_PHOTOS_PER_REPORT, photoPath, savePhoto, stripJpegMetadata } from '../photos';
import { rateLimit } from '../rateLimit';
import { coordsSchema, keyedHash, now, parse, randomToken, sha256 } from '../util';
import { holdReasons, reporterTrust } from '../trust';

export const reportsRouter = Router();

// Reports with this many community flags are hidden from the public map pending review.
export const FLAG_THRESHOLD = Number(process.env.MAP_FLAG_THRESHOLD || 3);

const reportLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 10 });
const flagLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 20 });
const photoLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 30 });

// Photos are uploaded right after the report is created, with a short-lived token returned by
// POST /api/reports. That works for anonymous reports without linking them to anyone.
const UPLOAD_WINDOW_MS = 15 * 60 * 1000;

export const reportPhotos = (reportId: number) =>
  db.prepare('SELECT id FROM report_photos WHERE report_id = ? ORDER BY id').all(reportId) as Array<{ id: number }>;

// Deletes reports (and their photo files) matching a condition on `reports r`.
export function deleteReports(where: string, ...params: Array<string | number>) {
  const files = db
    .prepare(`SELECT p.file FROM report_photos p JOIN reports r ON r.id = p.report_id WHERE ${where}`)
    .all(...params) as Array<{ file: string }>;
  const result = db.prepare(`DELETE FROM reports AS r WHERE ${where}`).run(...params);
  deletePhotoFiles(files.map((f) => f.file));
  return Number(result.changes);
}

const reportSchema = z.object({
  incidentType: z.enum(['harassment', 'assault', 'stalking', 'threat', 'discrimination', 'other']),
  description: z.string().trim().min(1).max(5000),
  location: z.string().trim().max(200).optional().default(''),
  // A real calendar date (2026-13-45 matches the pattern but isn't one).
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((d) => {
      const t = Date.parse(`${d}T00:00:00Z`);
      return !Number.isNaN(t) && new Date(t).toISOString().startsWith(d);
    }, 'Enter a real date.')
    .optional()
    .or(z.literal('')),
  coords: coordsSchema.optional(),
  anonymous: z.boolean().default(false),
});

reportsRouter.post('/', reportLimiter, (req, res) => {
  const body = parse(reportSchema, req, res);
  if (!body) return;
  if (req.user?.mapSuspended) return res.status(403).json({ error: 'A moderator has paused your account from adding to the Safe Map. SOS, contacts and everything else still work.' });
  // Anonymous reports never store who submitted them, even when logged in.
  const userId = body.anonymous ? null : req.user?.id ?? null;
  // Unusual reports wait for a moderator before they're on the map; they're never rejected.
  const reasons = holdReasons({ userId, description: body.description, lat: body.coords?.lat, lng: body.coords?.lng });
  const uploadToken = randomToken();
  const result = db
    .prepare(
      `INSERT INTO reports (user_id, incident_type, description, location_text, lat, lng, incident_date, created_at, upload_token_hash, upload_expires_at,
         reporter_trust, hold_reasons, map_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      userId,
      body.incidentType,
      body.description,
      body.location || null,
      body.coords?.lat ?? null,
      body.coords?.lng ?? null,
      body.date || null,
      now(),
      sha256(uploadToken),
      new Date(Date.now() + UPLOAD_WINDOW_MS).toISOString(),
      reporterTrust(userId),
      reasons.length ? reasons.join(',') : null,
      reasons.length ? 'held' : 'visible'
    );
  res.status(201).json({
    success: true,
    id: Number(result.lastInsertRowid),
    linkedToAccount: userId !== null,
    uploadToken,
    // Only matters for reports with a location: the rest never go on the map.
    held: reasons.length > 0 && body.coords !== undefined,
  });
});

reportsRouter.post('/:id/photos', photoLimiter, express.raw({ type: 'image/jpeg', limit: MAX_PHOTO_BYTES }), (req, res) => {
  const id = Number(req.params.id);
  const token = req.get('x-upload-token') || '';
  const report = db.prepare('SELECT upload_token_hash AS hash, upload_expires_at AS expiresAt FROM reports WHERE id = ?').get(id) as
    | { hash: string | null; expiresAt: string | null }
    | undefined;
  if (!report || !report.hash || report.hash !== sha256(token)) return res.status(404).json({ error: 'Report not found.' });
  if (!report.expiresAt || new Date(report.expiresAt) < new Date()) {
    return res.status(410).json({ error: 'Photos can only be added right after submitting a report.' });
  }
  const clean = Buffer.isBuffer(req.body) ? stripJpegMetadata(req.body) : null;
  if (!clean) return res.status(415).json({ error: 'Photos must be JPEG images.' });
  const count = (db.prepare('SELECT COUNT(*) AS n FROM report_photos WHERE report_id = ?').get(id) as { n: number }).n;
  if (count >= MAX_PHOTOS_PER_REPORT) return res.status(409).json({ error: `A report can have up to ${MAX_PHOTOS_PER_REPORT} photos.` });
  const file = savePhoto(clean);
  const result = db.prepare('INSERT INTO report_photos (report_id, file, size, created_at) VALUES (?, ?, ?, ?)').run(id, file, clean.length, now());
  res.status(201).json({ id: Number(result.lastInsertRowid) });
});

// A user's own (non-anonymous) reports.
reportsRouter.get('/', requireAuth, (req, res) => {
  const reports = db
    .prepare(
      `SELECT id, incident_type AS incidentType, description, location_text AS location, incident_date AS date, created_at AS createdAt
       FROM reports WHERE user_id = ? ORDER BY id DESC`
    )
    .all(req.user!.id) as Array<{ id: number }>;
  res.json({ reports: reports.map((r) => ({ ...r, photos: reportPhotos(r.id).map((p) => p.id) })) });
});

// Everything for one report's evidence pack: the report, and the user's real (not test) SOS
// alerts from the day before to the day after the incident, with who was alerted, who
// responded and how much audio was recorded. Owner only.
const DAY_MS = 24 * 60 * 60 * 1000;
reportsRouter.get('/:id/evidence', requireAuth, (req, res) => {
  const user = req.user!;
  const report = db
    .prepare(
      `SELECT id, incident_type AS incidentType, description, location_text AS location, lat, lng, incident_date AS date,
              created_at AS createdAt FROM reports WHERE id = ? AND user_id = ?`
    )
    .get(Number(req.params.id), user.id) as { id: number; date: string | null; createdAt: string } | undefined;
  if (!report) return res.status(404).json({ error: 'Report not found.' });

  // The incident's day (or the day it was reported), widened by a day each side. Dates saved
  // before they were checked for being real calendar dates fall back to the report's own date.
  const parsed = new Date(`${report.date ?? ''}T00:00:00Z`).getTime();
  const day = Number.isNaN(parsed) ? new Date(`${report.createdAt.slice(0, 10)}T00:00:00Z`).getTime() : parsed;
  const from = new Date(day - DAY_MS).toISOString();
  const to = new Date(day + 2 * DAY_MS).toISOString();
  const events = db
    .prepare(
      `SELECT id, lat, lng, accuracy, created_at AS createdAt FROM sos_events
       WHERE user_id = ? AND is_test = 0 AND created_at >= ? AND created_at < ? ORDER BY created_at`
    )
    .all(user.id, from, to) as Array<{ id: number }>;
  const sosEvents = events.map((e) => ({
    ...e,
    alerted: db.prepare('SELECT contact_name AS name, channel, status FROM sos_deliveries WHERE sos_id = ? ORDER BY id').all(e.id),
    responses: db
      .prepare('SELECT a.contact_name AS name, a.created_at AS at FROM share_acks a JOIN location_shares s ON s.id = a.share_id WHERE s.sos_id = ? ORDER BY a.id')
      .all(e.id),
    recordings: db
      .prepare('SELECT COUNT(*) AS pieces, COALESCE(SUM(size), 0) AS bytes, MIN(created_at) AS first, MAX(created_at) AS last FROM sos_recordings WHERE sos_id = ?')
      .get(e.id),
  }));
  const phone = db.prepare('SELECT phone, phone_verified_at AS verified FROM users WHERE id = ?').get(user.id) as { phone: string | null; verified: string | null };
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    generatedAt: now(),
    user: { name: user.name, phone: phone.verified ? phone.phone : null },
    report: { ...report, photos: reportPhotos(report.id).map((p) => p.id) },
    sosEvents,
    window: { from, to },
  });
});

// A photo is visible to the person who reported it (if not anonymous) and to moderators.
reportsRouter.get('/:id/photos/:photoId', requireAuth, (req, res) => {
  const photo = db
    .prepare('SELECT p.file, r.user_id AS userId FROM report_photos p JOIN reports r ON r.id = p.report_id WHERE p.id = ? AND r.id = ?')
    .get(Number(req.params.photoId), Number(req.params.id)) as { file: string; userId: number | null } | undefined;
  const allowed = photo && (photo.userId === req.user!.id || req.user!.moderator);
  const file = allowed ? photoPath(photo.file) : null;
  if (!file) return res.status(404).json({ error: 'Photo not found.' });
  res.type('image/jpeg').sendFile(file, (err) => {
    if (err && !res.headersSent) res.status(404).json({ error: 'Photo not found.' });
  });
});

reportsRouter.delete('/:id', requireAuth, (req, res) => {
  const deleted = deleteReports('r.id = ? AND r.user_id = ?', Number(req.params.id), req.user!.id);
  if (deleted === 0) return res.status(404).json({ error: 'Report not found.' });
  res.json({ success: true });
});

// Public map data: type, coarse location (~1 km), date, and how much it can be trusted (who
// reported it, how many people confirmed it). No descriptions or identities.
reportsRouter.get('/map', (req, res) => {
  const me = req.user?.id ?? 0;
  const points = db
    .prepare(
      `SELECT r.id, r.incident_type AS incidentType, ROUND(r.lat, 2) AS lat, ROUND(r.lng, 2) AS lng,
              COALESCE(r.incident_date, substr(r.created_at, 1, 10)) AS date, r.reporter_trust AS trust,
              (SELECT COUNT(*) FROM report_confirmations c WHERE c.report_id = r.id) AS confirmations,
              EXISTS (SELECT 1 FROM report_confirmations c WHERE c.report_id = r.id AND c.user_id = ?) AS confirmedByMe,
              (r.user_id IS NOT NULL AND r.user_id = ?) AS mine
       FROM reports r
       WHERE r.lat IS NOT NULL AND r.lng IS NOT NULL AND r.map_status NOT IN ('removed', 'held')
         AND (r.map_status = 'approved' OR (SELECT COUNT(*) FROM report_flags f WHERE f.report_id = r.id) < ?)
         AND (r.user_id IS NULL OR r.user_id NOT IN (SELECT id FROM users WHERE suspended_at IS NOT NULL))
       ORDER BY r.id DESC LIMIT 1000`
    )
    .all(me, me, FLAG_THRESHOLD) as Array<{ confirmedByMe: number; mine: number }>;
  res.json({ points: points.map((p) => ({ ...p, confirmedByMe: Boolean(p.confirmedByMe), mine: Boolean(p.mine) })) });
});

const confirmLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 30 });

// "I saw this too": a signed-in person with a confirmed email backs up someone else's report.
reportsRouter.post('/:id/confirm', requireAuth, confirmLimiter, (req, res) => {
  const user = req.user!;
  if (user.mapSuspended) return res.status(403).json({ error: 'A moderator has paused your account from adding to the Safe Map. SOS, contacts and everything else still work.' });
  if (!user.emailVerified) return res.status(403).json({ error: 'Confirm your email address first, so each confirmation is from a real person.' });
  const report = db
    .prepare("SELECT user_id FROM reports WHERE id = ? AND lat IS NOT NULL AND map_status NOT IN ('removed', 'held')")
    .get(Number(req.params.id)) as { user_id: number | null } | undefined;
  if (!report) return res.status(404).json({ error: 'Report not found.' });
  if (report.user_id === user.id) return res.status(400).json({ error: "You can't confirm your own report." });
  db.prepare('INSERT OR IGNORE INTO report_confirmations (report_id, user_id, created_at) VALUES (?, ?, ?)').run(Number(req.params.id), user.id, now());
  const count = (db.prepare('SELECT COUNT(*) AS n FROM report_confirmations WHERE report_id = ?').get(Number(req.params.id)) as { n: number }).n;
  res.json({ success: true, confirmations: count });
});

// Anyone can flag a map point as false or abusive; each person/IP counts once per report.
reportsRouter.post('/:id/flag', flagLimiter, (req, res) => {
  if (req.user?.mapSuspended) return res.status(403).json({ error: 'A moderator has paused your account from adding to the Safe Map. SOS, contacts and everything else still work.' });
  const id = Number(req.params.id);
  const exists = db.prepare("SELECT 1 FROM reports WHERE id = ? AND lat IS NOT NULL AND map_status NOT IN ('removed', 'held')").get(id);
  if (!exists) return res.status(404).json({ error: 'Report not found.' });
  const flagger = req.user ? `user:${req.user.id}` : `ip:${keyedHash(req.ip || 'unknown')}`;
  db.prepare('INSERT OR IGNORE INTO report_flags (report_id, flagger, created_at) VALUES (?, ?, ?)').run(id, flagger, now());
  res.json({ success: true });
});
