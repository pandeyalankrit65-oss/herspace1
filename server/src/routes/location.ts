import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { requireAuth } from '../auth';
import { sendSms } from '../messaging';
import { perUser, rateLimit } from '../rateLimit';
import { appUrl, coordsSchema, keyedHash, now, parse, randomToken, sha256 } from '../util';
import { listContacts } from './contacts';

export const locationSharesRouter = Router();
export const trackRouter = Router();

const SHARE_HOURS = Number(process.env.LIVE_SHARE_HOURS || 4);

export type ShareKind = 'sos' | 'walk';

type ShareRow = {
  id: number;
  user_id: number;
  kind: ShareKind;
  note: string | null;
  expires_at: string;
  ended_at: string | null;
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  updated_at: string | null;
};

const isActive = (s: Pick<ShareRow, 'ended_at' | 'expires_at'>) => !s.ended_at && new Date(s.expires_at) > new Date();

// Each contact gets their own link (?c=...), so "I'm on my way" says who is coming. The code is
// an HMAC, so it can't be guessed or forged for another contact.
export const contactCode = (shareId: number, contactId: number) => keyedHash(`share:${shareId}:contact:${contactId}`).slice(0, 16);
export const contactLink = (shareUrl: string, shareId: number, contactId: number) => `${shareUrl}?c=${contactCode(shareId, contactId)}`;

// Starts a live share. A user has at most one active share; starting a new one ends the
// previous. The token only exists in the returned URL (the database keeps its hash).
export function createShare(
  userId: number,
  options: { sosId?: number; coords?: z.infer<typeof coordsSchema>; kind?: ShareKind; note?: string | null; minutes?: number } = {}
) {
  const stamp = now();
  db.prepare('UPDATE location_shares SET ended_at = ?, lat = NULL, lng = NULL, accuracy = NULL WHERE user_id = ? AND ended_at IS NULL').run(
    stamp,
    userId
  );
  const token = randomToken();
  const minutes = options.minutes ?? SHARE_HOURS * 60;
  const expiresAt = new Date(Date.now() + minutes * 60 * 1000).toISOString();
  const c = options.coords;
  const result = db
    .prepare(
      `INSERT INTO location_shares (user_id, sos_id, kind, note, token_hash, created_at, expires_at, lat, lng, accuracy, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      userId,
      options.sosId ?? null,
      options.kind ?? 'sos',
      options.note ?? null,
      sha256(token),
      stamp,
      expiresAt,
      c?.lat ?? null,
      c?.lng ?? null,
      c?.accuracy ?? null,
      c ? stamp : null
    );
  return { id: Number(result.lastInsertRowid), url: `${appUrl()}/track/${token}`, expiresAt };
}

const ownShare = (id: number, userId: number) =>
  db.prepare('SELECT * FROM location_shares WHERE id = ? AND user_id = ?').get(id, userId) as ShareRow | undefined;

const listAcks = (shareId: number) =>
  db
    .prepare('SELECT contact_name AS name, created_at AS at FROM share_acks WHERE share_id = ? ORDER BY id')
    .all(shareId) as Array<{ name: string | null; at: string }>;

locationSharesRouter.use(requireAuth);

// "Walk with me": share live location with confirmed contacts without raising an alarm.
const walkLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 10, key: perUser });

locationSharesRouter.post('/', walkLimiter, async (req, res) => {
  const body = parse(
    z.object({
      minutes: z.number().int().min(10).max(4 * 60),
      note: z.string().trim().max(120).optional(),
      coords: coordsSchema.optional(),
    }),
    req,
    res
  );
  if (!body) return;
  const user = req.user!;
  const confirmed = listContacts(user.id).filter((c) => c.status === 'confirmed');
  if (confirmed.length === 0) return res.status(400).json({ error: 'None of your contacts have confirmed yet.' });

  const share = createShare(user.id, { kind: 'walk', note: body.note || null, minutes: body.minutes, coords: body.coords });
  const what = body.note ? ` ("${body.note}")` : '';
  const results = await Promise.all(
    confirmed.map((c) =>
      sendSms(
        c.phone,
        `HerSpace: ${user.name} is sharing their live location with you while they travel${what}. Follow along: ${contactLink(share.url, share.id, c.id)} No action needed unless they ask for help.`
      )
    )
  );
  res.status(201).json({
    share: { id: share.id, kind: 'walk', expiresAt: share.expiresAt, url: share.url },
    sent: results.filter((r) => r.status === 'sent').length,
    total: confirmed.length,
  });
});

// Lets the SOS/walk screens resume sharing after a reload, and shows who has responded.
locationSharesRouter.get('/active', (req, res) => {
  const share = db
    .prepare('SELECT * FROM location_shares WHERE user_id = ? AND ended_at IS NULL ORDER BY id DESC LIMIT 1')
    .get(req.user!.id) as ShareRow | undefined;
  if (!share || !isActive(share)) return res.json({ share: null });
  res.json({
    share: { id: share.id, kind: share.kind, note: share.note, expiresAt: share.expires_at, updatedAt: share.updated_at, acks: listAcks(share.id) },
  });
});

// The phone sends a position every ~20 seconds while sharing.
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
  res.json({ success: true, acks: listAcks(share.id) });
});

// "I'm safe" / "I've arrived": stop sharing and forget the position immediately.
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
const ackLimiter = rateLimit({ windowMs: 60 * 1000, max: 10 });

type ShareWithUser = ShareRow & { name: string };
const shareByToken = (token: string) =>
  db.prepare('SELECT s.*, u.name FROM location_shares s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?').get(sha256(token)) as
    | ShareWithUser
    | undefined;

// Which of the user's contacts a ?c= code belongs to, if any.
function contactForCode(share: ShareWithUser, code: unknown) {
  if (typeof code !== 'string' || code.length !== 16) return undefined;
  return listContacts(share.user_id).find((c) => contactCode(share.id, c.id) === code);
}

trackRouter.get('/:token', trackLimiter, (req, res) => {
  const share = shareByToken(req.params.token);
  if (!share) return res.status(404).json({ error: 'This tracking link is invalid or has expired.' });

  res.setHeader('Cache-Control', 'no-store');
  const active = isActive(share);
  const contact = contactForCode(share, req.query.c);
  const acked = contact
    ? Boolean(db.prepare('SELECT 1 FROM share_acks WHERE share_id = ? AND contact_id = ?').get(share.id, contact.id))
    : false;
  res.json({
    name: share.name,
    kind: share.kind,
    note: share.note,
    active,
    acked,
    endedAt: share.ended_at,
    expiresAt: share.expires_at,
    position:
      active && share.lat !== null && share.lng !== null
        ? { lat: share.lat, lng: share.lng, accuracy: share.accuracy, updatedAt: share.updated_at }
        : null,
  });
});

// A contact tells the user "I'm on my way" (SOS) or "I'm following" (walk).
trackRouter.post('/:token/ack', ackLimiter, (req, res) => {
  const share = shareByToken(req.params.token);
  if (!share) return res.status(404).json({ error: 'This tracking link is invalid or has expired.' });
  if (!isActive(share)) return res.status(410).json({ error: 'Location sharing has ended.' });
  const contact = contactForCode(share, req.body?.c);
  db.prepare('INSERT OR IGNORE INTO share_acks (share_id, contact_id, contact_name, created_at) VALUES (?, ?, ?, ?)').run(
    share.id,
    contact?.id ?? null,
    contact?.name ?? null,
    now()
  );
  res.json({ success: true });
});
