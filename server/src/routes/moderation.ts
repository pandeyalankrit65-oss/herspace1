import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { requireModerator } from '../auth';
import { parse } from '../util';
import { FLAG_THRESHOLD, reportPhotos } from './reports';

// Review queue for Safe Map points. Moderators see what they need to judge a report
// (type, description, date, rough area, photos, flags), never who submitted it.
export const moderationRouter = Router();
moderationRouter.use(requireModerator);

const QUEUES = {
  // Flagged points nobody has decided on yet; the most-flagged (already hidden) first.
  review: `status = 'visible' AND flags > 0`,
  approved: `status = 'approved'`,
  removed: `status = 'removed'`,
} as const;

moderationRouter.get('/reports', (req, res) => {
  const q = z.enum(['review', 'approved', 'removed']).safeParse(req.query.queue ?? 'review');
  if (!q.success) return res.status(400).json({ error: 'Unknown queue' });
  const rows = db
    .prepare(
      `SELECT * FROM (
         SELECT r.id, r.incident_type AS incidentType, r.description, ROUND(r.lat, 2) AS lat, ROUND(r.lng, 2) AS lng,
                COALESCE(r.incident_date, substr(r.created_at, 1, 10)) AS date, r.map_status AS status,
                (SELECT COUNT(*) FROM report_flags f WHERE f.report_id = r.id) AS flags
         FROM reports r WHERE r.lat IS NOT NULL AND r.lng IS NOT NULL
       )
       WHERE ${QUEUES[q.data]}
       ORDER BY flags DESC, id DESC LIMIT 200`
    )
    .all() as Array<{ id: number; flags: number; status: string }>;
  const reports = rows.map((r) => ({
    ...r,
    hidden: r.status === 'removed' || (r.status !== 'approved' && r.flags >= FLAG_THRESHOLD),
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
