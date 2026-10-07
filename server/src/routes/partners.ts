import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { requireAuth, requireModerator } from '../auth';
import { emailConfigured, sendEmail } from '../messaging';
import { perUser, rateLimit } from '../rateLimit';
import { appUrl, now, parse, phoneSchema } from '../util';

// Partner network: counsellors, lawyers, NGOs, self-defence trainers and doctors apply, and a
// HerSpace moderator checks their credentials before they're listed. Nobody is listed until a
// real partner has been checked. Session requests reach the partner by email; HerSpace doesn't
// book, take payment or see what happens next.
export const partnersRouter = Router();

export const PARTNER_KINDS = ['counsellor', 'lawyer', 'ngo', 'self_defence', 'doctor'] as const;
const LANGUAGES = ['en', 'hi', 'ta', 'bn', 'mr', 'other'] as const;
const FEES = ['free', 'paid', 'sliding'] as const;

type PartnerRow = {
  id: number;
  user_id: number;
  name: string;
  kind: string;
  city: string;
  languages: string;
  description: string;
  credentials: string;
  fees: string;
  fee_note: string | null;
  online: number;
  in_person: number;
  email: string;
  phone: string | null;
  website: string | null;
  status: string;
  review_note: string | null;
  created_at: string;
  updated_at: string;
  verified_at: string | null;
};

// What anyone sees. The partner's email and phone stay private: requests go through HerSpace.
const publicView = (p: PartnerRow) => ({
  id: p.id,
  name: p.name,
  kind: p.kind,
  city: p.city,
  languages: p.languages.split(','),
  description: p.description,
  fees: p.fees,
  feeNote: p.fee_note,
  online: Boolean(p.online),
  inPerson: Boolean(p.in_person),
  website: p.website,
  verifiedAt: p.verified_at,
});

// The partner's own view, and what moderators review.
const fullView = (p: PartnerRow) => ({
  ...publicView(p),
  credentials: p.credentials,
  email: p.email,
  phone: p.phone,
  status: p.status,
  reviewNote: p.review_note,
  createdAt: p.created_at,
  updatedAt: p.updated_at,
});

partnersRouter.get('/', (req, res) => {
  const filters = z
    .object({ kind: z.enum(PARTNER_KINDS).optional(), city: z.string().trim().max(60).optional(), lang: z.enum(LANGUAGES).optional() })
    .safeParse(req.query);
  if (!filters.success) return res.status(400).json({ error: 'Unknown filter' });
  const { kind, city, lang } = filters.data;
  const rows = db
    .prepare(
      `SELECT * FROM partners WHERE status = 'approved'
       AND (? IS NULL OR kind = ?) AND (? IS NULL OR lower(city) = lower(?) OR online = 1)
       AND (? IS NULL OR (',' || languages || ',') LIKE ?)
       ORDER BY CASE WHEN ? IS NOT NULL AND lower(city) = lower(?) THEN 0 ELSE 1 END, verified_at DESC LIMIT 100`
    )
    .all(kind ?? null, kind ?? null, city || null, city || null, lang ?? null, `%,${lang},%`, city || null, city || null) as PartnerRow[];
  const cities = (db.prepare("SELECT DISTINCT city FROM partners WHERE status = 'approved' ORDER BY city").all() as Array<{ city: string }>).map((r) => r.city);
  res.json({ partners: rows.map(publicView), cities });
});

const urlSchema = z
  .string()
  .trim()
  .max(200)
  .refine((v) => v === '' || /^https:\/\/[^\s/]+\.[^\s]+$/.test(v), 'Use a full https:// address')
  .optional();

const applicationSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    kind: z.enum(PARTNER_KINDS),
    city: z.string().trim().min(2).max(60),
    languages: z.array(z.enum(LANGUAGES)).min(1).max(LANGUAGES.length),
    description: z.string().trim().min(30).max(1000),
    credentials: z.string().trim().min(5).max(500),
    fees: z.enum(FEES),
    feeNote: z.string().trim().max(200).optional(),
    online: z.boolean(),
    inPerson: z.boolean(),
    email: z.string().trim().toLowerCase().email().max(200),
    phone: phoneSchema.optional().or(z.literal('')),
    website: urlSchema,
  })
  .refine((v) => v.online || v.inPerson, { message: 'Choose online, in person, or both.', path: ['online'] });

const mine = (userId: number) => db.prepare('SELECT * FROM partners WHERE user_id = ?').get(userId) as PartnerRow | undefined;

partnersRouter.get('/mine', requireAuth, (req, res) => {
  const p = mine(req.user!.id);
  const requests = p ? (db.prepare('SELECT COUNT(*) AS n FROM partner_requests WHERE partner_id = ?').get(p.id) as { n: number }).n : 0;
  res.json({ partner: p ? { ...fullView(p), requests } : null });
});

// Applying, and editing later: either way a moderator checks it before it's listed (again).
partnersRouter.put('/mine', requireAuth, rateLimit({ windowMs: 24 * 60 * 60 * 1000, max: 10, key: perUser }), (req, res) => {
  const body = parse(applicationSchema, req, res);
  if (!body) return;
  const stamp = now();
  const values = [
    body.name,
    body.kind,
    body.city,
    [...new Set(body.languages)].join(','),
    body.description,
    body.credentials,
    body.fees,
    body.feeNote || null,
    body.online ? 1 : 0,
    body.inPerson ? 1 : 0,
    body.email,
    body.phone || null,
    body.website || null,
  ];
  const existing = mine(req.user!.id);
  if (existing) {
    db.prepare(
      `UPDATE partners SET name = ?, kind = ?, city = ?, languages = ?, description = ?, credentials = ?, fees = ?, fee_note = ?, online = ?,
         in_person = ?, email = ?, phone = ?, website = ?, status = 'pending', review_note = NULL, updated_at = ? WHERE id = ?`
    ).run(...values, stamp, existing.id);
  } else {
    db.prepare(
      `INSERT INTO partners (name, kind, city, languages, description, credentials, fees, fee_note, online, in_person, email, phone, website,
         user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(...values, req.user!.id, stamp, stamp);
  }
  res.status(existing ? 200 : 201).json({ partner: fullView(mine(req.user!.id)!) });
});

partnersRouter.delete('/mine', requireAuth, (req, res) => {
  db.prepare('DELETE FROM partners WHERE user_id = ?').run(req.user!.id);
  res.json({ success: true });
});

const requestLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 5,
  key: perUser,
  message: "You've sent 5 requests today. Wait for replies, or call one of the helplines.",
});

const requestSchema = z
  .object({
    contactMethod: z.enum(['email', 'phone']),
    contactValue: z.string().trim().max(200),
    preferredTime: z.string().trim().max(200).optional(),
    message: z.string().trim().max(1000).optional(),
    consent: z.literal(true, { errorMap: () => ({ message: 'Agree to share your details with this partner.' }) }),
  })
  .superRefine((v, ctx) => {
    const ok = v.contactMethod === 'email' ? z.string().email().safeParse(v.contactValue).success : phoneSchema.safeParse(v.contactValue).success;
    if (!ok) ctx.addIssue({ code: 'custom', path: ['contactValue'], message: v.contactMethod === 'email' ? 'Enter a valid email address.' : 'Use international format, e.g. +91 98765 43210' });
  });

// Sends the partner the user's name, chosen contact details and message. Nothing else.
partnersRouter.post('/:id/request', requireAuth, requestLimiter, async (req, res) => {
  const body = parse(requestSchema, req, res);
  if (!body) return;
  const partner = db.prepare("SELECT * FROM partners WHERE id = ? AND status = 'approved'").get(Number(req.params.id)) as PartnerRow | undefined;
  if (!partner) return res.status(404).json({ error: 'Partner not found.' });
  if (!emailConfigured()) return res.status(503).json({ error: "Requests can't be sent right now. Please contact the partner another way, or call a helpline." });
  const contact = body.contactMethod === 'phone' ? body.contactValue.replace(/[\s\-().]/g, '') : body.contactValue;
  const text = [
    `Hello ${partner.name},`,
    '',
    `${req.user!.name} found you on HerSpace and would like a session.`,
    '',
    `Reach them by ${body.contactMethod}: ${contact}`,
    body.preferredTime ? `Preferred time: ${body.preferredTime}` : null,
    body.message ? `\nTheir message:\n${body.message}` : null,
    '',
    'Please reply to them directly. HerSpace does not book sessions or take payment, and has not shared anything else about them.',
    `Your listing: ${appUrl()}/partners`,
  ]
    .filter((line) => line !== null)
    .join('\n');
  const sent = await sendEmail(partner.email, 'A session request from HerSpace', text);
  if (sent.status === 'failed') return res.status(502).json({ error: "The request couldn't be sent. Please try again in a few minutes." });
  db.prepare(
    'INSERT INTO partner_requests (partner_id, user_id, contact_method, contact_value, preferred_time, message, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(partner.id, req.user!.id, body.contactMethod, contact, body.preferredTime || null, body.message || null, now());
  res.status(201).json({ success: true });
});

partnersRouter.get('/requests/mine', requireAuth, (req, res) => {
  const rows = db
    .prepare(
      `SELECT r.id, p.id AS partnerId, p.name, p.kind, r.contact_method AS contactMethod, r.created_at AS at
       FROM partner_requests r JOIN partners p ON p.id = r.partner_id WHERE r.user_id = ? ORDER BY r.id DESC`
    )
    .all(req.user!.id);
  res.json({ requests: rows });
});

// --- HerSpace moderators -------------------------------------------------------------------

export const partnerModerationRouter = Router();
partnerModerationRouter.use(requireModerator);

partnerModerationRouter.get('/', (req, res) => {
  const status = z.enum(['pending', 'approved', 'rejected', 'hidden']).safeParse(req.query.status ?? 'pending');
  if (!status.success) return res.status(400).json({ error: 'Unknown status' });
  const rows = db
    .prepare('SELECT p.*, u.email AS account_email FROM partners p JOIN users u ON u.id = p.user_id WHERE p.status = ? ORDER BY p.updated_at')
    .all(status.data) as Array<PartnerRow & { account_email: string }>;
  res.json({ partners: rows.map((p) => ({ ...fullView(p), accountEmail: p.account_email })) });
});

const DECISIONS = { approve: 'approved', reject: 'rejected', hide: 'hidden' } as const;

partnerModerationRouter.post('/:id', async (req, res) => {
  const body = parse(z.object({ action: z.enum(['approve', 'reject', 'hide']), note: z.string().trim().max(500).optional() }), req, res);
  if (!body) return;
  if (body.action !== 'approve' && !body.note) return res.status(400).json({ error: 'Say why, so the partner knows what to fix.' });
  const p = db.prepare('SELECT * FROM partners WHERE id = ?').get(Number(req.params.id)) as PartnerRow | undefined;
  if (!p) return res.status(404).json({ error: 'Partner not found.' });
  const status = DECISIONS[body.action];
  const stamp = now();
  db.prepare('UPDATE partners SET status = ?, review_note = ?, verified_at = ?, updated_at = ? WHERE id = ?').run(
    status,
    body.note || null,
    status === 'approved' ? stamp : p.verified_at,
    stamp,
    p.id
  );
  const account = db.prepare('SELECT email FROM users WHERE id = ?').get(p.user_id) as { email: string };
  const text =
    status === 'approved'
      ? `Your HerSpace partner listing "${p.name}" has been checked and is now listed. Session requests will come to ${p.email}.\n\n${appUrl()}/partners`
      : `Your HerSpace partner listing "${p.name}" is not listed${status === 'hidden' ? ' any more' : ''}.\n\nThe reviewer's note: ${body.note}\n\nYou can edit and resubmit it: ${appUrl()}/partners/join`;
  void sendEmail(account.email, status === 'approved' ? 'Your HerSpace listing is live' : 'About your HerSpace listing', text);
  res.json({ success: true, status });
});
