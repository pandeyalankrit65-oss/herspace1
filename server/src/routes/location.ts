import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { requireAuth } from '../auth';
import { perUser, rateLimit } from '../rateLimit';
import { appUrl, coordsSchema, now, parse, randomToken, sha256 } from '../util';

export const locationSharesRouter = Router();
export const trackRouter = Router();

const SHARE_HOURS = Number(process.env.LIVE_SHARE_HOURS || 4);

type ShareRow = {
  id: number;
  user_id: number;
  expires_at: string;
  ended_at: string | null;
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  updated_at: string | null;
};

const isActive = (s: Pick<ShareRow, 'ended_at' | 'expires_at'>) => !s.ended_at && new Date(s.expires_at) > new Date();

// Starts a live share for an SOS. A user has at most one active share; starting a new one
// ends the previous. The token only exists in the returned URL (the database keeps its hash).
export function createShare(userId: number, sosId: number, coords?: z.infer<typeof coordsSchema>) {
  const stamp = now();
  db.prepare('UPDATE location_shares SET ended_at = ?, lat = NULL, lng = NULL, accuracy = NULL WHERE user_id = ? AND ended_at IS NULL').run(
    stamp,
    userId
  );
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SHARE_HOURS * 60 * 60 * 1000).toISOString();
  const result = db
    .prepare(
      `INSERT INTO location_shares (user_id, sos_id, token_hash, created_at, expires_at, lat, lng, accuracy, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(userId, sosId, sha256(token), stamp, expiresAt, coords?.lat ?? null, coords?.lng ?? null, coords?.accuracy ?? null, coords ? stamp : null);
  return { id: Number(result.lastInsertRowid), url: `${appUrl()}/track/${token}`, expiresAt };
}

const ownShare = (id: number, userId: number) =>
  db.prepare('SELECT * FROM location_shares WHERE id = ? AND user_id = ?').get(id, userId) as ShareRow | undefined;

locationSharesRouter.use(requireAuth);

// Lets the SOS page resume sharing after a reload.
locationSharesRouter.get('/active', (req, res) => {
  const share = db
    .prepare('SELECT * FROM location_shares WHERE user_id = ? AND ended_at IS NULL ORDER BY id DESC LIMIT 1')
    .get(req.user!.id) as ShareRow | undefined;
  if (!share || !isActive(share)) return res.json({ share: null });
  res.json({ share: { id: share.id, expiresAt: share.expires_at, updatedAt: share.updated_at } });
});

// The phone sends a position every ~20 seconds while the SOS page is open.
const updateLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 600, key: perUser });

locationSharesRouter.post('/:id/location', updateLimiter, (req, res) => {
  const body = parse(z.object({ coords: coordsSchema }), req, res);
  if (!body) return;
  const share = ownShare(Number(req.params.id), req.user!.id);
  if (!share) return res.status(404).json({ error: 'Share not found.' });
  if (!isActive(share)) return res.status(410).json({ error: 'Location sharing has ended.' });
  db.prepare('UPDATE location_shares SET lat = ?, lng = ?, accuracy = ?, updated_at = ? WHERE id = ?').run(
    body.coords.lat,
    body.coords.lng,
    body.coords.accuracy ?? null,
    now(),
    share.id
  );
  res.json({ success: true });
});

// "I'm safe": stop sharing and forget the position immediately.
locationSharesRouter.post('/:id/stop', (req, res) => {
  const share = ownShare(Number(req.params.id), req.user!.id);
  if (!share) return res.status(404).json({ error: 'Share not found.' });
  db.prepare('UPDATE location_shares SET ended_at = COALESCE(ended_at, ?), lat = NULL, lng = NULL, accuracy = NULL WHERE id = ?').run(
    now(),
    share.id
  );
  res.json({ success: true });
});

// Public: what a contact sees when they open the tracking link. No account needed; the
// unguessable token is the credential. Nothing is shown once sharing has ended.
const trackLimiter = rateLimit({ windowMs: 60 * 1000, max: 30 });

trackRouter.get('/:token', trackLimiter, (req, res) => {
  const share = db
    .prepare(
      `SELECT s.*, u.name FROM location_shares s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`
    )
    .get(sha256(req.params.token)) as (ShareRow & { name: string }) | undefined;
  if (!share) return res.status(404).json({ error: 'This tracking link is invalid or has expired.' });

  res.setHeader('Cache-Control', 'no-store');
  const active = isActive(share);
  res.json({
    name: share.name,
    active,
    endedAt: share.ended_at,
    expiresAt: share.expires_at,
    position:
      active && share.lat !== null && share.lng !== null
        ? { lat: share.lat, lng: share.lng, accuracy: share.accuracy, updatedAt: share.updated_at }
        : null,
  });
});
