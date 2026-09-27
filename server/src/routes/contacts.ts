import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { requireAuth, User } from '../auth';
import { sendSms } from '../messaging';
import { perUser, rateLimit } from '../rateLimit';
import { appUrl, now, parse, phoneSchema, randomToken, sha256 } from '../util';

export const contactsRouter = Router();
export const contactInvitesRouter = Router();

const MAX_CONTACTS = 10;

// Each invite sends an SMS to someone who hasn't agreed to anything yet, so keep it tight.
const inviteLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 20,
  key: perUser,
  message: "You've sent a lot of contact invites today. Please try again tomorrow.",
});

export type ContactStatus = 'pending' | 'confirmed' | 'declined';
export type ContactRow = { id: number; name: string; phone: string; relation: string | null; status: ContactStatus };

export const listContacts = (userId: number) =>
  db
    .prepare('SELECT id, name, phone, relation, status FROM contacts WHERE user_id = ? ORDER BY id')
    .all(userId) as ContactRow[];

const contactSchema = z.object({
  name: z.string().trim().min(1).max(100),
  phone: phoneSchema,
  relation: z.string().trim().max(50).optional().default(''),
});

// Creates a fresh confirmation token and texts the contact. Returns the link so the
// user can also share it themselves (e.g. over WhatsApp) when SMS isn't available.
async function invite(contactId: number, contact: { name: string; phone: string }, user: User) {
  const token = randomToken();
  db.prepare("UPDATE contacts SET status = 'pending', confirm_token_hash = ?, invited_at = ? WHERE id = ?").run(
    sha256(token),
    now(),
    contactId
  );
  const link = `${appUrl()}/confirm-contact/${token}`;
  const sms = await sendSms(
    contact.phone,
    `${user.name} has asked you to be an emergency contact on HerSpace. If you agree, you'll get a text with their location if they ever press SOS. Respond here: ${link}`
  );
  return { inviteLink: link, inviteSms: sms.status, inviteError: sms.error };
}

contactsRouter.use(requireAuth);

contactsRouter.get('/', (req, res) => {
  res.json({ contacts: listContacts(req.user!.id) });
});

contactsRouter.post('/', inviteLimiter, async (req, res) => {
  const body = parse(contactSchema, req, res);
  if (!body) return;
  const user = req.user!;
  const existing = listContacts(user.id);
  if (existing.length >= MAX_CONTACTS) {
    return res.status(400).json({ error: `You can save up to ${MAX_CONTACTS} emergency contacts.` });
  }
  if (existing.some((c) => c.phone === body.phone)) {
    return res.status(409).json({ error: 'You already have a contact with this phone number.' });
  }
  const result = db
    .prepare('INSERT INTO contacts (user_id, name, phone, relation) VALUES (?, ?, ?, ?)')
    .run(user.id, body.name, body.phone, body.relation);
  const id = Number(result.lastInsertRowid);
  const inv = await invite(id, body, user);
  res.status(201).json({ contact: { id, ...body, status: 'pending' }, ...inv });
});

contactsRouter.put('/:id', async (req, res) => {
  const body = parse(contactSchema, req, res);
  if (!body) return;
  const id = Number(req.params.id);
  const current = listContacts(req.user!.id).find((c) => c.id === id);
  if (!current) return res.status(404).json({ error: 'Contact not found.' });

  db.prepare('UPDATE contacts SET name = ?, phone = ?, relation = ? WHERE id = ?').run(body.name, body.phone, body.relation, id);
  // A new number belongs to someone who hasn't agreed yet.
  if (body.phone !== current.phone) {
    const inv = await invite(id, body, req.user!);
    return res.json({ contact: { id, ...body, status: 'pending' }, ...inv });
  }
  res.json({ contact: { id, ...body, status: current.status } });
});

contactsRouter.post('/:id/resend', inviteLimiter, async (req, res) => {
  const id = Number(req.params.id);
  const contact = listContacts(req.user!.id).find((c) => c.id === id);
  if (!contact) return res.status(404).json({ error: 'Contact not found.' });
  if (contact.status === 'confirmed') return res.status(400).json({ error: 'This contact has already confirmed.' });
  res.json(await invite(id, contact, req.user!));
});

contactsRouter.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM contacts WHERE id = ? AND user_id = ?').run(Number(req.params.id), req.user!.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Contact not found.' });
  res.json({ success: true });
});

// Public endpoints used by the invited person (no account needed). The token only
// lets them view and change their own consent.
const inviteLookupLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30 });

function findInvite(token: string) {
  return db
    .prepare(
      `SELECT c.id, c.name AS contactName, c.status, u.name AS userName FROM contacts c
       JOIN users u ON u.id = c.user_id WHERE c.confirm_token_hash = ?`
    )
    .get(sha256(token)) as { id: number; contactName: string; status: ContactStatus; userName: string } | undefined;
}

contactInvitesRouter.get('/:token', inviteLookupLimiter, (req, res) => {
  const invite = findInvite(req.params.token);
  if (!invite) return res.status(404).json({ error: 'This invite link is invalid or was replaced by a newer one.' });
  res.json({ userName: invite.userName, contactName: invite.contactName, status: invite.status });
});

contactInvitesRouter.post('/:token', inviteLookupLimiter, (req, res) => {
  const body = parse(z.object({ accept: z.boolean() }), req, res);
  if (!body) return;
  const invite = findInvite(req.params.token);
  if (!invite) return res.status(404).json({ error: 'This invite link is invalid or was replaced by a newer one.' });
  const status: ContactStatus = body.accept ? 'confirmed' : 'declined';
  db.prepare('UPDATE contacts SET status = ? WHERE id = ?').run(status, invite.id);
  res.json({ status });
});
