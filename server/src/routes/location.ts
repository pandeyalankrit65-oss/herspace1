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

export type ShareKind = 'sos' | 'walk' | 'ride' | 'meeting';

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
  created_at: string;
  check_in_id: number | null;
  destination: string | null;
  arrived: number;
  battery: number | null;
  charging: number | null;
  speed: number | null;
  heading: number | null;
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
  db.prepare('UPDATE location_shares SET ended_at = ?, lat = NULL, lng = NULL, accuracy = NULL, speed = NULL, heading = NULL WHERE user_id = ? AND ended_at IS NULL').run(
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

const detail = z.string().trim().max(80).optional();
const journeySchema = z.object({
  kind: z.enum(['walk', 'ride', 'meeting']).default('walk'),
  minutes: z.number().int().min(10).max(12 * 60),
  note: z.string().trim().max(120).optional(),
  coords: coordsSchema.optional(),
  // Ride: the vehicle; meeting: who and where. Shown to contacts so they know who to look for.
  details: z
    .object({ vehicle: detail, vehicleType: detail, app: detail, driver: detail, destination: detail, person: detail, place: detail, profile: detail })
    .default({}),
  // Optional safety timer: contacts are alerted if the user doesn't check in by then.
  checkInMinutes: z.number().int().min(5).max(12 * 60).optional(),
  // A saved place's name ("Home"). Contacts get a text when she arrives.
  destination: z.string().trim().min(1).max(40).optional(),
});

// One line describing the journey, for the tracking page and the texts.
function journeySummary(kind: 'walk' | 'ride' | 'meeting', note: string | undefined, d: z.infer<typeof journeySchema>['details']) {
  if (kind === 'ride') {
    const extra = [d.app, d.driver && `driver ${d.driver}`].filter(Boolean).join(', ');
    return `${d.vehicleType || 'Ride'} ${d.vehicle}${extra ? ` (${extra})` : ''}${d.destination ? ` to ${d.destination}` : ''}`;
  }
  if (kind === 'meeting') {
    return `Meeting ${d.person}${d.place ? ` at ${d.place}` : ''}${d.profile ? ` (${d.profile})` : ''}`;
  }
  return note || null;
}

const clock = (iso: string) => new Date(iso).toUTCString().replace(/:\d\d GMT$/, ' GMT');

locationSharesRouter.post('/', walkLimiter, async (req, res) => {
  const body = parse(journeySchema, req, res);
  if (!body) return;
  if (body.kind === 'ride' && !body.details.vehicle) return res.status(400).json({ error: 'Enter the vehicle number.' });
  if (body.kind === 'meeting' && !body.details.person) return res.status(400).json({ error: "Enter who you're meeting." });
  const user = req.user!;
  const confirmed = listContacts(user.id).filter((c) => c.status === 'confirmed');
  if (confirmed.length === 0) return res.status(400).json({ error: 'None of your contacts have confirmed yet.' });

  const summary = journeySummary(body.kind, body.note, body.details);
  // A journey with a timer keeps sharing a little past the check-in time.
  const minutes = body.checkInMinutes ? Math.max(body.minutes, body.checkInMinutes + 30) : body.minutes;
  const share = createShare(user.id, { kind: body.kind, note: summary, minutes, coords: body.coords });

  let checkIn: { id: number; dueAt: string } | null = null;
  if (body.checkInMinutes) {
    const stamp = now();
    const dueAt = new Date(Date.now() + body.checkInMinutes * 60_000).toISOString();
    const result = db
      .prepare('INSERT INTO check_ins (user_id, note, created_at, due_at, lat, lng, accuracy, location_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(user.id, summary, stamp, dueAt, body.coords?.lat ?? null, body.coords?.lng ?? null, body.coords?.accuracy ?? null, body.coords ? stamp : null);
    checkIn = { id: Number(result.lastInsertRowid), dueAt };
    db.prepare('UPDATE location_shares SET check_in_id = ? WHERE id = ?').run(checkIn.id, share.id);
  }
  if (body.destination) db.prepare('UPDATE location_shares SET destination = ? WHERE id = ?').run(body.destination, share.id);

  const timer =
    (body.destination ? ` They're heading to ${body.destination}; you'll get a text when they arrive.` : '') +
    (checkIn ? ` If they don't check in by ${clock(checkIn.dueAt)}, you'll get an alert.` : ' No action needed unless they ask for help.');
  const text = (link: string) =>
    body.kind === 'ride'
      ? `HerSpace: ${user.name} is taking a ride: ${summary}. Follow the trip live: ${link}${timer}`
      : body.kind === 'meeting'
        ? `HerSpace: ${user.name} is ${summary!.charAt(0).toLowerCase()}${summary!.slice(1)}. Follow along: ${link}${timer}`
        : `HerSpace: ${user.name} is sharing their live location with you while they travel${summary ? ` ("${summary}")` : ''}. Follow along: ${link}${timer}`;
  const results = await Promise.all(confirmed.map((c) => sendSms(c.phone, text(contactLink(share.url, share.id, c.id)))));
  res.status(201).json({
    share: { id: share.id, kind: body.kind, note: summary, destination: body.destination ?? null, expiresAt: share.expiresAt, url: share.url },
    checkIn,
    sent: results.filter((r) => r.status === 'sent').length,
    total: confirmed.length,
  });
});

// Rides whose location stopped updating for a while: tell contacts once, gently (it may just
// be a locked screen or no signal).
const STALE_RIDE_MS = 10 * 60_000;
export async function processStaleRides(at: Date = new Date()) {
  const cutoff = new Date(at.getTime() - STALE_RIDE_MS).toISOString();
  const stale = db
    .prepare(
      `SELECT s.*, u.name AS userName FROM location_shares s JOIN users u ON u.id = s.user_id
       WHERE s.kind = 'ride' AND s.ended_at IS NULL AND s.stale_alerted_at IS NULL
         AND s.expires_at > ? AND COALESCE(s.updated_at, s.created_at) < ?`
    )
    .all(at.toISOString(), cutoff) as Array<ShareRow & { userName: string }>;
  for (const s of stale) {
    const claimed = db.prepare('UPDATE location_shares SET stale_alerted_at = ? WHERE id = ? AND stale_alerted_at IS NULL').run(now(), s.id);
    if (claimed.changes === 0) continue;
    const last = s.lat !== null && s.lng !== null ? ` Last seen: https://maps.google.com/?q=${s.lat},${s.lng} at ${clock(s.updated_at ?? s.created_at)}.` : '';
    const confirmed = listContacts(s.user_id).filter((c) => c.status === 'confirmed');
    await Promise.all(
      confirmed.map((c) =>
        sendSms(
          c.phone,
          `HerSpace: ${s.userName}'s live location stopped updating during their ride${s.note ? ` (${s.note})` : ''}.${last} It may just be a locked screen or no signal, but please try calling them.`
        )
      )
    );
  }
  return stale.length;
}

// Lets the SOS/walk screens resume sharing after a reload, and shows who has responded.
locationSharesRouter.get('/active', (req, res) => {
  const share = db
    .prepare('SELECT * FROM location_shares WHERE user_id = ? AND ended_at IS NULL ORDER BY id DESC LIMIT 1')
    .get(req.user!.id) as ShareRow | undefined;
  if (!share || !isActive(share)) return res.json({ share: null });
  res.json({
    share: {
      id: share.id,
      kind: share.kind,
      note: share.note,
      destination: share.destination,
      expiresAt: share.expires_at,
      updatedAt: share.updated_at,
      acks: listAcks(share.id),
    },
  });
});

// The phone sends a position every ~20 seconds while sharing.
const updateLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 600, key: perUser });

locationSharesRouter.post('/:id/location', updateLimiter, (req, res) => {
  const body = parse(
    z.object({
      coords: coordsSchema,
      battery: z.object({ level: z.number().min(0).max(1), charging: z.boolean() }).optional(),
      // Worked out on her phone from consecutive positions: metres per second, degrees from north.
      motion: z.object({ speed: z.number().min(0).max(100), heading: z.number().min(0).max(360).nullable() }).optional(),
    }),
    req,
    res
  );
  if (!body) return;
  const share = ownShare(Number(req.params.id), req.user!.id);
  if (!share) return res.status(404).json({ error: 'Share not found.' });
  if (!isActive(share)) return res.status(410).json({ error: 'Location sharing has ended.' });
  db.prepare(
    'UPDATE location_shares SET lat = ?, lng = ?, accuracy = ?, updated_at = ?, stale_alerted_at = NULL, battery = ?, charging = ?, speed = ?, heading = ? WHERE id = ?'
  ).run(
    body.coords.lat,
    body.coords.lng,
    body.coords.accuracy ?? null,
    now(),
    body.battery?.level ?? null,
    body.battery ? (body.battery.charging ? 1 : 0) : null,
    body.motion?.speed ?? null,
    body.motion?.heading ?? null,
    share.id
  );
  // A journey's safety timer alerts with the latest position.
  if (share.check_in_id) {
    db.prepare("UPDATE check_ins SET lat = ?, lng = ?, accuracy = ?, location_at = ? WHERE id = ? AND status = 'active'").run(
      body.coords.lat,
      body.coords.lng,
      body.coords.accuracy ?? null,
      now(),
      share.check_in_id
    );
  }
  res.json({ success: true, acks: listAcks(share.id) });
});

// "I'm safe" / "I've arrived": stop sharing and forget the position immediately. A journey to a
// saved place that ends by arriving there texts contacts, as promised when it started.
locationSharesRouter.post('/:id/stop', async (req, res) => {
  const body = parse(z.object({ arrived: z.boolean().optional() }).default({}), req, res);
  if (!body) return;
  const share = ownShare(Number(req.params.id), req.user!.id);
  if (!share) return res.status(404).json({ error: 'Share not found.' });
  const arrived = Boolean(body.arrived) && share.kind !== 'sos' && isActive(share);
  // Only the request that actually ends it can send the text (a retry or a second tab can't).
  const ended =
    db
      .prepare('UPDATE location_shares SET ended_at = ?, arrived = ? WHERE id = ? AND ended_at IS NULL')
      .run(now(), arrived ? 1 : 0, share.id).changes > 0;
  db.prepare('UPDATE location_shares SET lat = NULL, lng = NULL, accuracy = NULL, speed = NULL, heading = NULL WHERE id = ?').run(share.id);
  // Arriving also ends the journey's safety timer.
  if (share.check_in_id) {
    db.prepare("UPDATE check_ins SET status = 'completed' WHERE id = ? AND status = 'active'").run(share.check_in_id);
  }
  let told = 0;
  if (ended && arrived && share.destination) {
    const confirmed = listContacts(share.user_id).filter((c) => c.status === 'confirmed');
    const results = await Promise.all(
      confirmed.map((c) => sendSms(c.phone, `HerSpace: ${req.user!.name} has arrived at ${share.destination}. No action needed.`))
    );
    told = results.filter((r) => r.status === 'sent').length;
  }
  res.json({ success: true, told });
});

// Public: what a contact sees when they open the tracking link. No account needed; the
// unguessable token is the credential. Nothing is shown once sharing has ended.
const trackLimiter = rateLimit({ windowMs: 60 * 1000, max: 30 });
const ackLimiter = rateLimit({ windowMs: 60 * 1000, max: 10 });

type ShareWithUser = ShareRow & {
  name: string;
  emergencyInfo: string | null;
  emergencyInfoShare: number;
  sosTrigger: string | null;
  sosSilent: number | null;
};
const shareByToken = (token: string) =>
  db
    .prepare(
      `SELECT s.*, u.name, u.emergency_info AS emergencyInfo, u.emergency_info_share AS emergencyInfoShare,
         e.trigger AS sosTrigger, e.silent AS sosSilent
       FROM location_shares s JOIN users u ON u.id = s.user_id LEFT JOIN sos_events e ON e.id = s.sos_id WHERE s.token_hash = ?`
    )
    .get(sha256(token)) as
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
    battery: active && share.battery !== null ? { level: share.battery, charging: Boolean(share.charging) } : null,
    motion: active && share.speed !== null ? { speed: share.speed, heading: share.heading } : null,
    // How an SOS started, and whether she asked not to be called: shapes the "how to help" advice.
    trigger: share.kind === 'sos' ? share.sosTrigger ?? 'button' : null,
    silent: share.kind === 'sos' ? Boolean(share.sosSilent) : false,
    destination: share.kind === 'sos' ? null : share.destination,
    arrived: Boolean(share.arrived),
    // Health details only during an emergency, only if the user chose to share them, and only
    // on a confirmed contact's personal link: the plain link can end up in a forwarded group text.
    emergencyInfo:
      active && contact?.status === 'confirmed' && share.kind === 'sos' && share.emergencyInfoShare && share.emergencyInfo ? JSON.parse(share.emergencyInfo) : null,
  });
});

// A contact tells the user "I'm on my way" (SOS) or "I'm following" (walk).
trackRouter.post('/:token/ack', ackLimiter, (req, res) => {
  const share = shareByToken(req.params.token);
  if (!share) return res.status(404).json({ error: 'This tracking link is invalid or has expired.' });
  if (!isActive(share)) return res.status(410).json({ error: 'Location sharing has ended.' });
  const contact = contactForCode(share, req.body?.c);
  if (!contact && db.prepare('SELECT 1 FROM share_acks WHERE share_id = ? AND contact_id IS NULL').get(share.id)) {
    return res.json({ success: true });
  }
  db.prepare('INSERT OR IGNORE INTO share_acks (share_id, contact_id, contact_name, created_at) VALUES (?, ?, ?, ?)').run(
    share.id,
    contact?.id ?? null,
    contact?.name ?? null,
    now()
  );
  res.json({ success: true });
});
