import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { requireAuth } from '../auth';
import { now, parse } from '../util';
import { ACTIONS, IC_ROLES, annualReport, compositionProblems, deadlines, nextDue, type PoshCase } from '../posh';
import { CATEGORIES, requireHr } from './workplace';

// POSH Internal Committee tools for a workplace's HR team: who's on the committee (and whether
// it's made up as the Act requires), formal complaints with their legal deadlines, and the
// annual report. Only HR of that workplace can see or change any of it.

export const icRouter = Router();
icRouter.use(requireAuth, requireHr);

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const today = () => new Date().toISOString().slice(0, 10);
// The latest date that's "today" somewhere: India is ahead of UTC, so a complaint dated today there
// can be tomorrow in UTC.
const latestToday = () => new Date(Date.now() + 14 * 60 * 60 * 1000).toISOString().slice(0, 10);

type CaseRow = {
  id: number;
  report_id: number | null;
  category: string;
  received_on: string;
  conciliation: number;
  notice_sent_on: string | null;
  reply_received_on: string | null;
  inquiry_completed_on: string | null;
  report_submitted_on: string | null;
  action_taken_on: string | null;
  action: (typeof ACTIONS)[number] | null;
  closed_on: string | null;
};

const asCase = (r: CaseRow): PoshCase => ({
  receivedOn: r.received_on,
  conciliation: Boolean(r.conciliation),
  noticeSentOn: r.notice_sent_on,
  replyReceivedOn: r.reply_received_on,
  inquiryCompletedOn: r.inquiry_completed_on,
  reportSubmittedOn: r.report_submitted_on,
  actionTakenOn: r.action_taken_on,
  action: r.action,
  closedOn: r.closed_on,
});

const casesOf = (orgId: number) => db.prepare('SELECT * FROM posh_cases WHERE org_id = ? ORDER BY received_on DESC, id DESC').all(orgId) as CaseRow[];

type MemberRow = { id: number; name: string; role: (typeof IC_ROLES)[number]; woman: number; termStart: string; termEnd: string };
const membersOf = (orgId: number) =>
  (db.prepare('SELECT id, name, role, woman, term_start AS termStart, term_end AS termEnd FROM ic_members WHERE org_id = ? ORDER BY id').all(orgId) as MemberRow[]).map(
    (m) => ({ ...m, woman: Boolean(m.woman) })
  );

icRouter.get('/', (req, res) => {
  const orgId = req.member!.org_id;
  const members = membersOf(orgId);
  const workshops = Object.fromEntries(
    (db.prepare('SELECT year, count FROM posh_workshops WHERE org_id = ?').all(orgId) as Array<{ year: number; count: number }>).map((w) => [w.year, w.count])
  );
  res.json({
    members,
    problems: compositionProblems(members, today()),
    cases: casesOf(orgId).map((r) => {
      const c = asCase(r);
      return { id: r.id, reportId: r.report_id, category: r.category, ...c, deadlines: deadlines(c), next: nextDue(c, today()) };
    }),
    workshops,
  });
});

const memberSchema = z
  .object({ name: z.string().trim().min(1).max(100), role: z.enum(IC_ROLES), woman: z.boolean(), termStart: day, termEnd: day })
  .refine((m) => m.termEnd >= m.termStart, 'The term must end after it starts.');

// The whole committee at once: it's a short list, edited together.
icRouter.put('/members', (req, res) => {
  const body = parse(z.object({ members: z.array(memberSchema).max(20) }), req, res);
  if (!body) return;
  const orgId = req.member!.org_id;
  db.exec('BEGIN');
  try {
    db.prepare('DELETE FROM ic_members WHERE org_id = ?').run(orgId);
    const insert = db.prepare('INSERT INTO ic_members (org_id, name, role, woman, term_start, term_end) VALUES (?, ?, ?, ?, ?, ?)');
    for (const m of body.members) insert.run(orgId, m.name, m.role, m.woman ? 1 : 0, m.termStart, m.termEnd);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  const members = membersOf(orgId);
  res.json({ members, problems: compositionProblems(members, today()) });
});

// A formal complaint: from a report made in HerSpace, or one made another way (on paper, by email).
icRouter.post('/cases', (req, res) => {
  const body = parse(
    z.object({
      reportId: z.number().int().positive().optional(),
      category: z.enum(CATEGORIES).optional(),
      receivedOn: day,
      conciliation: z.boolean().optional(),
    }),
    req,
    res
  );
  if (!body) return;
  const orgId = req.member!.org_id;
  let category: string = body.category ?? 'harassment';
  if (body.reportId) {
    const report = db.prepare('SELECT category FROM workplace_reports WHERE id = ? AND org_id = ?').get(body.reportId, orgId) as
      | { category: string }
      | undefined;
    if (!report) return res.status(404).json({ error: 'Report not found.' });
    if (db.prepare('SELECT 1 FROM posh_cases WHERE report_id = ?').get(body.reportId)) {
      return res.status(409).json({ error: 'This report is already a formal complaint.' });
    }
    category = report.category;
  }
  if (body.receivedOn > latestToday()) return res.status(400).json({ error: 'The date it was received cannot be in the future.' });
  const r = db
    .prepare('INSERT INTO posh_cases (org_id, report_id, category, received_on, conciliation, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(orgId, body.reportId ?? null, category, body.receivedOn, body.conciliation ? 1 : 0, now());
  res.status(201).json({ id: Number(r.lastInsertRowid) });
});

const COLUMNS = {
  conciliation: 'conciliation',
  noticeSentOn: 'notice_sent_on',
  replyReceivedOn: 'reply_received_on',
  inquiryCompletedOn: 'inquiry_completed_on',
  reportSubmittedOn: 'report_submitted_on',
  actionTakenOn: 'action_taken_on',
  action: 'action',
  closedOn: 'closed_on',
} as const;

// Records the steps as they happen. A step's date can't come before the complaint, or after today.
icRouter.patch('/cases/:id', (req, res) => {
  const optionalDay = day.nullable().optional();
  const body = parse(
    z.object({
      conciliation: z.boolean().optional(),
      noticeSentOn: optionalDay,
      replyReceivedOn: optionalDay,
      inquiryCompletedOn: optionalDay,
      reportSubmittedOn: optionalDay,
      actionTakenOn: optionalDay,
      action: z.enum(ACTIONS).nullable().optional(),
      closedOn: optionalDay,
    }),
    req,
    res
  );
  if (!body) return;
  const row = db.prepare('SELECT * FROM posh_cases WHERE id = ? AND org_id = ?').get(Number(req.params.id), req.member!.org_id) as CaseRow | undefined;
  if (!row) return res.status(404).json({ error: 'Case not found.' });
  const dates = [body.noticeSentOn, body.replyReceivedOn, body.inquiryCompletedOn, body.reportSubmittedOn, body.actionTakenOn, body.closedOn];
  if (dates.some((d) => d && (d < row.received_on || d > latestToday()))) {
    return res.status(400).json({ error: 'Each date must be between the day the complaint was received and today.' });
  }
  // Only known fields, mapped to fixed column names: nothing from the request reaches the SQL text.
  const sets = (Object.keys(COLUMNS) as Array<keyof typeof COLUMNS>).filter((k) => body[k] !== undefined);
  if (sets.length) {
    const value = (k: keyof typeof COLUMNS) => {
      const v = body[k];
      return typeof v === 'boolean' ? (v ? 1 : 0) : (v ?? null);
    };
    db.prepare(`UPDATE posh_cases SET ${sets.map((k) => `${COLUMNS[k]} = ?`).join(', ')} WHERE id = ?`).run(...sets.map(value), row.id);
  }
  res.json({ success: true });
});

icRouter.delete('/cases/:id', (req, res) => {
  const r = db.prepare('DELETE FROM posh_cases WHERE id = ? AND org_id = ?').run(Number(req.params.id), req.member!.org_id);
  if (r.changes === 0) return res.status(404).json({ error: 'Case not found.' });
  res.json({ success: true });
});

const validYear = (year: number, upTo: number) => Number.isInteger(year) && year >= 2013 && year <= upTo;

icRouter.put('/workshops/:year', (req, res) => {
  const year = Number(req.params.year);
  const body = parse(z.object({ count: z.number().int().min(0).max(1000) }), req, res);
  if (!body) return;
  if (!validYear(year, new Date().getFullYear() + 1)) return res.status(400).json({ error: 'Choose a year.' });
  db.prepare('INSERT INTO posh_workshops (org_id, year, count) VALUES (?, ?, ?) ON CONFLICT(org_id, year) DO UPDATE SET count = excluded.count').run(
    req.member!.org_id,
    year,
    body.count
  );
  res.json({ success: true });
});

// Rule 14: the annual report for a calendar year.
icRouter.get('/annual/:year', (req, res) => {
  const year = Number(req.params.year);
  if (!validYear(year, new Date().getFullYear())) return res.status(400).json({ error: 'Choose a year.' });
  const orgId = req.member!.org_id;
  const workshops = (db.prepare('SELECT count FROM posh_workshops WHERE org_id = ? AND year = ?').get(orgId, year) as { count: number } | undefined)?.count ?? 0;
  const org = db.prepare('SELECT name FROM organizations WHERE id = ?').get(orgId) as { name: string };
  res.json({ organisation: org.name, members: membersOf(orgId), ...annualReport(casesOf(orgId).map(asCase), year, workshops) });
});
