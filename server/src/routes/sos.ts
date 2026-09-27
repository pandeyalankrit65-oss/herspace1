import express, { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { requireAuth, User } from '../auth';
import { placeCall, sendSms, SendResult, smsConfigured, statusCallbackUrl, validTwilioSignature, voiceCallsEnabled } from '../messaging';
import { perUser, rateLimit } from '../rateLimit';
import { coordsSchema, now, parse } from '../util';
import { listContacts } from './contacts';
import { contactLink, createShare } from './location';
import { reverseGeocode } from '../geo';

export const sosRouter = Router();
export const twilioRouter = Router();

// Delivery statuses, from the API's point of view:
//   sms:  not_confirmed | not_configured | sent (accepted by Twilio) | delivered | failed
//   call: not_configured | sent (ringing) | answered | unanswered | failed
type Delivery = { name: string; phone: string; channel: 'sms' | 'call'; status: string; error?: string | null };

const sosIpLimiter = rateLimit({ windowMs: 60 * 1000, max: 5 });
// Generous enough for a real emergency, but stops an account from being used to spam contacts.
const sosUserLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  key: perUser,
  message: "You've sent many alerts in the last hour. Please call your contacts or emergency services directly.",
});
const testLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 3,
  key: perUser,
  message: 'You can send up to 3 test alerts per day.',
});

function listDeliveries(sosId: number): Delivery[] {
  return db
    .prepare('SELECT contact_name AS name, phone, channel, status, error FROM sos_deliveries WHERE sos_id = ? ORDER BY id')
    .all(sosId) as Delivery[];
}

export type AlertOptions = {
  test?: boolean;
  // Set when a safety timer ran out without the user checking in.
  checkIn?: { note: string | null; startedAt: string; dueAt: string };
};

const fmtTime = (iso: string) => new Date(iso).toUTCString();

export async function triggerAlert(user: User | undefined, coords: z.infer<typeof coordsSchema> | undefined, options: AlertOptions = {}) {
  const isTest = Boolean(options.test);
  const createdAt = now();
  const sos = db
    .prepare('INSERT INTO sos_events (user_id, lat, lng, accuracy, created_at, is_test) VALUES (?, ?, ?, ?, ?, ?)')
    .run(user?.id ?? null, coords?.lat ?? null, coords?.lng ?? null, coords?.accuracy ?? null, createdAt, isTest ? 1 : 0);
  const sosId = Number(sos.lastInsertRowid);

  const contacts = user ? listContacts(user.id) : [];
  const confirmed = contacts.filter((c) => c.status === 'confirmed');
  const who = user?.name ?? 'Someone';

  // A readable place name helps contacts who can't open a link quickly. Skipped for tests, and
  // never allowed to hold up the alert for long (reverseGeocode times out after 2.5 s).
  const address = coords && !isTest ? await reverseGeocode(coords.lat, coords.lng) : null;
  const where = coords
    ? (address ? `Near ${address}. ` : '') +
      `Location: https://maps.google.com/?q=${coords.lat},${coords.lng}` +
      (coords.accuracy ? ` (within ~${Math.round(coords.accuracy)} m)` : '')
    : 'Their location could not be determined.';
  const time = new Date(createdAt).toUTCString();
  // Real alerts from a logged-in user get a live-location link that keeps updating; each contact
  // gets their own copy of it, so their "I'm on my way" says who is coming.
  const share = user && !isTest ? createShare(user.id, { sosId, coords }) : undefined;
  const messageFor = (link?: string) => buildMessage(link ? ` Live location: ${link}` : '');
  const checkIn = options.checkIn;
  const buildMessage = (live: string) => isTest
    ? `HerSpace TEST alert from ${who}. This is only a test, no action is needed. In a real emergency you'd get their location here.`
    : checkIn
      ? `HerSpace safety alert: ${who} started a safety timer at ${fmtTime(checkIn.startedAt)}${checkIn.note ? ` ("${checkIn.note}")` : ''} and didn't check in by ${fmtTime(checkIn.dueAt)}. Last known ${where.charAt(0).toLowerCase()}${where.slice(1)}${live} Please call them now. If you can't reach them, contact local emergency services.`
      : `HerSpace SOS: ${who} triggered an emergency alert at ${time}. ${where}${live} Please call them now. If you can't reach them, contact local emergency services.`;
  // The generic version (no personal link) is what the app offers to send by hand.
  const message = messageFor(share?.url);

  const insert = db.prepare(
    'INSERT INTO sos_deliveries (sos_id, contact_name, phone, channel, status, error, provider_sid, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );
  const record = (c: { name: string; phone: string }, channel: 'sms' | 'call', r: SendResult | { status: string; error?: string; sid?: string }) =>
    insert.run(sosId, c.name, c.phone, channel, r.status, r.error ?? null, r.sid ?? null, now());

  // Contacts who haven't agreed are listed so the app can offer to text them by hand.
  for (const c of contacts.filter((c) => c.status !== 'confirmed')) record(c, 'sms', { status: 'not_confirmed' });

  const smsResults = await Promise.all(
    confirmed.map((c) => sendSms(c.phone, messageFor(share ? contactLink(share.url, share.id, c.id) : undefined)))
  );
  confirmed.forEach((c, i) => record(c, 'sms', smsResults[i]));

  if (!isTest && voiceCallsEnabled()) {
    const spoken = checkIn
      ? `This is a safety alert from HerSpace. ${who} did not check in when their safety timer ended. Please check your text messages for their last known location, and call them now.`
      : `This is an emergency alert from HerSpace. ${who} has pressed their S O S button. Please check your text messages for their location, and call them now.`;
    const callResults = await Promise.all(confirmed.map((c) => placeCall(c.phone, spoken)));
    confirmed.forEach((c, i) => record(c, 'call', callResults[i]));
  }

  console.log(`[SOS] ${isTest ? 'Test ' : checkIn ? 'Missed check-in ' : ''}event ${sosId} user=${user?.id ?? 'anonymous'} confirmed=${confirmed.length}/${contacts.length}`);
  return {
    id: sosId,
    share: share ? { id: share.id, url: share.url, expiresAt: share.expiresAt } : null,
    createdAt,
    smsConfigured: smsConfigured(),
    // Whether "sent" will later be upgraded to "delivered" via Twilio callbacks.
    trackingDelivery: smsConfigured() && Boolean(statusCallbackUrl()),
    deliveries: listDeliveries(sosId),
    message,
  };
}

const sosSchema = z.object({ coords: coordsSchema.optional() });

// Works without login (an emergency shouldn't be blocked on a login screen), but only
// logged-in users have saved contacts to alert.
sosRouter.post('/', sosIpLimiter, sosUserLimiter, async (req, res) => {
  const body = parse(sosSchema, req, res);
  if (!body) return;
  res.status(201).json(await triggerAlert(req.user, body.coords));
});

sosRouter.post('/test', requireAuth, testLimiter, async (req, res) => {
  res.status(201).json(await triggerAlert(req.user, undefined, { test: true }));
});

sosRouter.get('/', requireAuth, (req, res) => {
  const events = db
    .prepare(
      `SELECT id, lat, lng, accuracy, created_at AS createdAt, is_test AS isTest
       FROM sos_events WHERE user_id = ? ORDER BY id DESC LIMIT 50`
    )
    .all(req.user!.id);
  res.json({ sosEvents: events });
});

// Polled by the SOS page to show delivery confirmations as they arrive.
sosRouter.get('/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const event = db.prepare('SELECT id FROM sos_events WHERE id = ? AND user_id = ?').get(id, req.user!.id);
  if (!event) return res.status(404).json({ error: 'Alert not found.' });
  res.json({ id, deliveries: listDeliveries(id) });
});

// Twilio delivery-status callbacks. Only active when PUBLIC_API_URL is set, and every
// request must carry a valid Twilio signature.
const SMS_STATUS: Record<string, string> = { delivered: 'delivered', undelivered: 'failed', failed: 'failed' };
const CALL_STATUS: Record<string, string> = {
  completed: 'answered',
  busy: 'unanswered',
  'no-answer': 'unanswered',
  canceled: 'unanswered',
  failed: 'failed',
};

twilioRouter.post('/status', express.urlencoded({ extended: false }), (req, res) => {
  const url = statusCallbackUrl();
  const params = req.body as Record<string, string>;
  if (!url || !validTwilioSignature(req.header('X-Twilio-Signature'), url, params)) {
    return res.status(403).send('Invalid signature');
  }
  const sid = params.MessageSid || params.CallSid;
  const status = params.MessageSid ? SMS_STATUS[params.MessageStatus] : CALL_STATUS[params.CallStatus];
  if (sid && status) {
    const error = status === 'failed' && params.ErrorCode ? `Error ${params.ErrorCode}` : null;
    db.prepare('UPDATE sos_deliveries SET status = ?, error = COALESCE(?, error), updated_at = ? WHERE provider_sid = ?').run(
      status,
      error,
      now(),
      sid
    );
  }
  res.type('text/xml').send('<Response/>');
});
