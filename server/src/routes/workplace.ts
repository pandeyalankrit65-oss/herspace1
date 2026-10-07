import { NextFunction, Request, Response, Router } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { db } from '../db';
import { requireAuth } from '../auth';
import { postWebhook, sendEmail, validWebhook } from '../messaging';
import { perUser, rateLimit } from '../rateLimit';
import { appUrl, keyedHash, now, parse } from '../util';

// Corporate Connect: a workplace's employees report harassment to HR, anonymously unless they
// choose otherwise, and HR follows up through a message thread without learning who it is.
export const workplaceRouter = Router();
workplaceRouter.use(requireAuth);

export const CATEGORIES = ['harassment', 'discrimination', 'bullying', 'unsafe_conditions', 'other'] as const;
const STATUSES = ['new', 'reviewing', 'resolved', 'closed'] as const;
// Breakdowns smaller than this could point to a person in a small team, so they're hidden.
const MIN_GROUP = 3;

type Org = { id: number; name: string; email_domain: string | null; slack_webhook: string | null; teams_webhook: string | null; notify_email: string | null };
type Membership = { org_id: number; role: 'member' | 'hr'; verified: number };
type ReportRow = {
  id: number;
  org_id: number;
  user_id: number;
  category: string;
  description: string;
  incident_date: string | null;
  location: string | null;
  share_identity: number;
  status: string;
  created_at: string;
  updated_at: string;
  first_response_at: string | null;
};

// Codes are easy to read aloud or type: no 0/O or 1/I.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newJoinCode = () => Array.from(crypto.randomBytes(8), (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
const codeHash = (code: string) => keyedHash(`org-join:${code.replace(/[\s-]/g, '').toUpperCase()}`);

const membership = (userId: number) =>
  db.prepare('SELECT org_id, role, verified FROM org_members WHERE user_id = ?').get(userId) as Membership | undefined;
const orgById = (id: number) =>
  db.prepare('SELECT id, name, email_domain, slack_webhook, teams_webhook, notify_email FROM organizations WHERE id = ?').get(id) as Org;
const emailDomain = (email: string) => email.split('@')[1]?.toLowerCase() ?? '';

declare module 'express-serve-static-core' {
  interface Request {
    member?: Membership;
  }
}

function requireMember(req: Request, res: Response, next: NextFunction) {
  const m = membership(req.user!.id);
  if (!m) return res.status(403).json({ error: 'Join your workplace first.' });
  req.member = m;
  next();
}

function requireHr(req: Request, res: Response, next: NextFunction) {
  const m = membership(req.user!.id);
  if (!m || m.role !== 'hr') return res.status(403).json({ error: 'Only your workplace HR team can do this.' });
  req.member = m;
  next();
}

const createLimiter = rateLimit({ windowMs: 24 * 60 * 60 * 1000, max: 3, key: perUser, message: 'Too many workplaces created today.' });
const joinLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 10, key: perUser, message: 'Too many attempts. Check the code with your HR team and try again later.' });
const reportLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 10, key: perUser });
const messageLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 60, key: perUser });

workplaceRouter.get('/', (req, res) => {
  const m = membership(req.user!.id);
  if (!m) return res.json({ org: null });
  const org = orgById(m.org_id);
  res.json({ org: { id: org.id, name: org.name, emailDomain: org.email_domain, role: m.role, verified: Boolean(m.verified) } });
});

const domainSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9-]+(\.[a-z0-9-]+)+$/, 'Enter a domain like company.com')
  .max(100);

workplaceRouter.post('/orgs', createLimiter, (req, res) => {
  const body = parse(z.object({ name: z.string().trim().min(2).max(100), emailDomain: domainSchema.optional().or(z.literal('')) }), req, res);
  if (!body) return;
  const user = req.user!;
  if (membership(user.id)) return res.status(409).json({ error: "You're already part of a workplace." });
  // Setting a domain only works for someone whose own email is on it, so a stranger can't
  // set up "Acme" and mark themselves a verified Acme employee.
  const domain = body.emailDomain || null;
  if (domain && emailDomain(user.email) !== domain) {
    return res.status(400).json({ error: `Your account's email must end in @${domain} to use it as the workplace domain.` });
  }
  const code = newJoinCode();
  const stamp = now();
  db.exec('BEGIN');
  try {
    const org = db
      .prepare('INSERT INTO organizations (name, email_domain, join_code_hash, created_at) VALUES (?, ?, ?, ?)')
      .run(body.name, domain, codeHash(code), stamp);
    db.prepare("INSERT INTO org_members (user_id, org_id, role, verified, joined_at) VALUES (?, ?, 'hr', ?, ?)").run(
      user.id,
      Number(org.lastInsertRowid),
      domain ? 1 : 0,
      stamp
    );
    db.exec('COMMIT');
    res.status(201).json({ org: { id: Number(org.lastInsertRowid), name: body.name, emailDomain: domain, role: 'hr', verified: Boolean(domain) }, joinCode: code });
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
});

workplaceRouter.post('/join', joinLimiter, (req, res) => {
  const body = parse(z.object({ code: z.string().trim().min(6).max(20) }), req, res);
  if (!body) return;
  const user = req.user!;
  if (membership(user.id)) return res.status(409).json({ error: "You're already part of a workplace." });
  const org = db.prepare('SELECT id, name, email_domain FROM organizations WHERE join_code_hash = ?').get(codeHash(body.code)) as
    | Pick<Org, 'id' | 'name' | 'email_domain'>
    | undefined;
  if (!org) return res.status(404).json({ error: 'That code is not right. Check it with your HR team.' });
  const verified = Boolean(org.email_domain && emailDomain(user.email) === org.email_domain);
  db.prepare("INSERT INTO org_members (user_id, org_id, role, verified, joined_at) VALUES (?, ?, 'member', ?, ?)").run(user.id, org.id, verified ? 1 : 0, now());
  res.status(201).json({ org: { id: org.id, name: org.name, emailDomain: org.email_domain, role: 'member', verified } });
});

workplaceRouter.post('/leave', requireMember, (req, res) => {
  const m = req.member!;
  if (m.role === 'hr') {
    const others = db.prepare("SELECT COUNT(*) AS n FROM org_members WHERE org_id = ? AND role = 'hr' AND user_id != ?").get(m.org_id, req.user!.id) as { n: number };
    const members = db.prepare('SELECT COUNT(*) AS n FROM org_members WHERE org_id = ?').get(m.org_id) as { n: number };
    if (others.n === 0 && members.n > 1) return res.status(409).json({ error: 'Add someone else to the HR team before you leave.' });
    if (members.n === 1) {
      db.prepare('DELETE FROM organizations WHERE id = ?').run(m.org_id);
      return res.json({ success: true });
    }
  }
  db.prepare('DELETE FROM org_members WHERE user_id = ?').run(req.user!.id);
  res.json({ success: true });
});

// --- Employees ---------------------------------------------------------------------------

const messagesFor = (reportId: number) =>
  db.prepare('SELECT from_hr AS fromHr, body, created_at AS at FROM workplace_messages WHERE report_id = ? ORDER BY id').all(reportId) as Array<{
    fromHr: number;
    body: string;
    at: string;
  }>;

const reportView = (r: ReportRow) => ({
  id: r.id,
  category: r.category,
  description: r.description,
  date: r.incident_date,
  location: r.location,
  shareIdentity: Boolean(r.share_identity),
  status: r.status,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  messages: messagesFor(r.id).map((msg) => ({ fromHr: Boolean(msg.fromHr), body: msg.body, at: msg.at })),
});

// HR hears that something came in, never what or from whom: the details stay in HerSpace.
// Sent in the background so a slow Slack or mail server never holds up the employee.
async function notifyHr(org: Org, text: string) {
  const sends: Array<Promise<unknown>> = [];
  if (org.slack_webhook) sends.push(postWebhook(org.slack_webhook, text));
  if (org.teams_webhook) sends.push(postWebhook(org.teams_webhook, text));
  if (org.notify_email) sends.push(sendEmail(org.notify_email, 'New workplace report in HerSpace', text));
  await Promise.allSettled(sends);
}

const reportSchema = z.object({
  category: z.enum(CATEGORIES),
  description: z.string().trim().min(10).max(5000),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal('')),
  location: z.string().trim().max(200).optional().default(''),
  shareIdentity: z.boolean().default(false),
});

workplaceRouter.post('/reports', requireMember, reportLimiter, (req, res) => {
  const body = parse(reportSchema, req, res);
  if (!body) return;
  const m = req.member!;
  const stamp = now();
  const result = db
    .prepare(
      `INSERT INTO workplace_reports (org_id, user_id, category, description, incident_date, location, share_identity, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(m.org_id, req.user!.id, body.category, body.description, body.date || null, body.location || null, body.shareIdentity ? 1 : 0, stamp, stamp);
  const org = orgById(m.org_id);
  void notifyHr(org, `HerSpace: a new workplace report (${body.category.replace('_', ' ')}) was filed for ${org.name}. Open the HR dashboard to respond: ${appUrl()}/corporate`);
  res.status(201).json({ id: Number(result.lastInsertRowid) });
});

workplaceRouter.get('/reports/mine', requireMember, (req, res) => {
  const rows = db.prepare('SELECT * FROM workplace_reports WHERE user_id = ? ORDER BY id DESC').all(req.user!.id) as ReportRow[];
  res.json({ reports: rows.map(reportView) });
});

const messageSchema = z.object({ body: z.string().trim().min(1).max(2000) });

// Either side of the thread: the reporter on their own report, or HR on one in their workplace.
workplaceRouter.post('/reports/:id/messages', requireMember, messageLimiter, (req, res) => {
  const body = parse(messageSchema, req, res);
  if (!body) return;
  const m = req.member!;
  const report = db.prepare('SELECT * FROM workplace_reports WHERE id = ?').get(Number(req.params.id)) as ReportRow | undefined;
  const isReporter = report?.user_id === req.user!.id;
  const isHr = report && m.role === 'hr' && report.org_id === m.org_id && !isReporter;
  if (!report || (!isReporter && !isHr)) return res.status(404).json({ error: 'Report not found.' });
  const stamp = now();
  db.prepare('INSERT INTO workplace_messages (report_id, from_hr, body, created_at) VALUES (?, ?, ?, ?)').run(report.id, isHr ? 1 : 0, body.body, stamp);
  db.prepare(
    `UPDATE workplace_reports SET updated_at = ?, first_response_at = COALESCE(first_response_at, ?),
       status = CASE WHEN status = 'new' THEN 'reviewing' ELSE status END WHERE id = ?`
  ).run(stamp, isHr ? stamp : null, report.id);
  if (isHr) {
    // Tell the reporter there's a reply, without the reply itself.
    const reporter = db.prepare('SELECT email FROM users WHERE id = ?').get(report.user_id) as { email: string };
    void sendEmail(reporter.email, 'Your HR team replied in HerSpace', `Your workplace report has a new reply. Read it in HerSpace: ${appUrl()}/corporate`);
  } else {
    const org = orgById(report.org_id);
    void notifyHr(org, `HerSpace: there's a new message on a workplace report for ${org.name}. Open the HR dashboard: ${appUrl()}/corporate`);
  }
  res.status(201).json({ success: true });
});

// --- HR -------------------------------------------------------------------------------------

workplaceRouter.get('/hr/reports', requireHr, (req, res) => {
  const rows = db
    .prepare(
      `SELECT r.*, u.name AS reporter_name, u.email AS reporter_email FROM workplace_reports r JOIN users u ON u.id = r.user_id
       WHERE r.org_id = ? ORDER BY CASE r.status WHEN 'new' THEN 0 WHEN 'reviewing' THEN 1 ELSE 2 END, r.id DESC`
    )
    .all(req.member!.org_id) as Array<ReportRow & { reporter_name: string; reporter_email: string }>;
  res.json({
    reports: rows.map((r) => ({
      ...reportView(r),
      // Who it is, only if they chose to say.
      reporter: r.share_identity ? { name: r.reporter_name, email: r.reporter_email } : null,
    })),
  });
});

workplaceRouter.patch('/hr/reports/:id', requireHr, (req, res) => {
  const body = parse(z.object({ status: z.enum(STATUSES) }), req, res);
  if (!body) return;
  const result = db
    .prepare('UPDATE workplace_reports SET status = ?, updated_at = ? WHERE id = ? AND org_id = ?')
    .run(body.status, now(), Number(req.params.id), req.member!.org_id);
  if (result.changes === 0) return res.status(404).json({ error: 'Report not found.' });
  res.json({ success: true });
});

const median = (values: number[]) => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

// Aggregates only. Categories with fewer than MIN_GROUP reports are folded into "other", so a
// rare kind of complaint in a small team doesn't point to one person.
workplaceRouter.get('/hr/insights', requireHr, (req, res) => {
  const orgId = req.member!.org_id;
  const rows = db.prepare('SELECT category, status, created_at, first_response_at FROM workplace_reports WHERE org_id = ?').all(orgId) as Array<
    Pick<ReportRow, 'category' | 'status' | 'created_at' | 'first_response_at'>
  >;
  const members = (db.prepare('SELECT COUNT(*) AS n FROM org_members WHERE org_id = ?').get(orgId) as { n: number }).n;
  const verified = (db.prepare('SELECT COUNT(*) AS n FROM org_members WHERE org_id = ? AND verified = 1').get(orgId) as { n: number }).n;
  const raw: Record<string, number> = {};
  for (const r of rows) raw[r.category] = (raw[r.category] ?? 0) + 1;
  const byCategory: Record<string, number> = {};
  let folded = 0;
  for (const [category, n] of Object.entries(raw)) {
    if (n >= MIN_GROUP && category !== 'other') byCategory[category] = n;
    else folded += n;
  }
  if (folded) byCategory.other = folded;
  const byStatus = Object.fromEntries(STATUSES.map((s) => [s, rows.filter((r) => r.status === s).length]));
  const responseHours = rows
    .filter((r) => r.first_response_at)
    .map((r) => (new Date(r.first_response_at!).getTime() - new Date(r.created_at).getTime()) / 3_600_000);
  // Reports per month, last six months (totals only).
  const months: Array<{ month: string; count: number }> = [];
  const d = new Date();
  for (let i = 5; i >= 0; i--) {
    const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1)).toISOString().slice(0, 7);
    months.push({ month: m, count: rows.filter((r) => r.created_at.startsWith(m)).length });
  }
  const medianHours = median(responseHours);
  res.json({
    total: rows.length,
    open: rows.filter((r) => r.status === 'new' || r.status === 'reviewing').length,
    byStatus,
    byCategory: rows.length >= MIN_GROUP ? byCategory : null,
    medianResponseHours: medianHours === null ? null : Math.round(medianHours * 10) / 10,
    months,
    members,
    verifiedMembers: verified,
  });
});

workplaceRouter.get('/hr/settings', requireHr, (req, res) => {
  const org = orgById(req.member!.org_id);
  const team = db
    .prepare("SELECT u.name, u.email FROM org_members m JOIN users u ON u.id = m.user_id WHERE m.org_id = ? AND m.role = 'hr' ORDER BY u.name")
    .all(org.id);
  res.json({ name: org.name, emailDomain: org.email_domain, slackWebhook: org.slack_webhook, teamsWebhook: org.teams_webhook, notifyEmail: org.notify_email, hrTeam: team });
});

const webhookSchema = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === '' || validWebhook(v), 'Use the webhook address Slack or Teams gave you (https://hooks.slack.com/... or https://....webhook.office.com/...).');

workplaceRouter.put('/hr/settings', requireHr, (req, res) => {
  const body = parse(
    z.object({ slackWebhook: webhookSchema.default(''), teamsWebhook: webhookSchema.default(''), notifyEmail: z.string().trim().email().max(200).optional().or(z.literal('')) }),
    req,
    res
  );
  if (!body) return;
  db.prepare('UPDATE organizations SET slack_webhook = ?, teams_webhook = ?, notify_email = ? WHERE id = ?').run(
    body.slackWebhook || null,
    body.teamsWebhook || null,
    body.notifyEmail || null,
    req.member!.org_id
  );
  res.json({ success: true });
});

// A new code replaces the old one (e.g. after it leaked). Shown once; only its hash is kept.
workplaceRouter.post('/hr/join-code', requireHr, (req, res) => {
  const code = newJoinCode();
  db.prepare('UPDATE organizations SET join_code_hash = ? WHERE id = ?').run(codeHash(code), req.member!.org_id);
  res.json({ joinCode: code });
});

// Add someone to the HR team: they must already be a member, found by their account email.
workplaceRouter.post('/hr/team', requireHr, (req, res) => {
  const body = parse(z.object({ email: z.string().trim().toLowerCase().email() }), req, res);
  if (!body) return;
  const result = db
    .prepare("UPDATE org_members SET role = 'hr' WHERE org_id = ? AND user_id = (SELECT id FROM users WHERE lower(email) = ?)")
    .run(req.member!.org_id, body.email);
  if (result.changes === 0) return res.status(404).json({ error: 'No member of your workplace has that email. Ask them to join first.' });
  res.json({ success: true });
});
