import { NextFunction, Request, Response, Router } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { db } from '../db';
import { requireAuth } from '../auth';
import { perUser, rateLimit } from '../rateLimit';
import { keyedHash, now, parse } from '../util';

// Safe Circles: small private communities (a college, a workplace, a neighbourhood) where
// members post safety alerts, questions and support. Members can post anonymously: the author
// is stored, so they can delete it and moderators can ban them, but it is never shown to anyone.
export const circlesRouter = Router();
circlesRouter.use(requireAuth);

export const CIRCLE_KINDS = ['college', 'workplace', 'neighbourhood', 'other'] as const;
export const POST_KINDS = ['alert', 'question', 'support', 'event'] as const;
const MAX_CIRCLES = 20;
// Flags from this many different members hide a post or comment until a moderator looks.
const HIDE_AFTER = 3;
const PAGE = 30;

type Role = 'owner' | 'moderator' | 'member';
type Membership = { role: Role; status: 'active' | 'pending' | 'banned'; verified: number };
type Circle = {
  id: number;
  name: string;
  description: string;
  kind: string;
  email_domain: string | null;
  require_domain: number;
  listed: number;
};

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newJoinCode = () => Array.from(crypto.randomBytes(8), (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
const codeHash = (code: string) => keyedHash(`circle-join:${code.replace(/[\s-]/g, '').toUpperCase()}`);
const emailDomain = (email: string) => email.split('@')[1]?.toLowerCase() ?? '';
const isMod = (role: Role) => role === 'owner' || role === 'moderator';

const circleById = (id: number) =>
  db.prepare('SELECT id, name, description, kind, email_domain, require_domain, listed FROM circles WHERE id = ?').get(id) as Circle | undefined;
const membershipOf = (circleId: number, userId: number) =>
  db.prepare('SELECT role, status, verified FROM circle_members WHERE circle_id = ? AND user_id = ?').get(circleId, userId) as Membership | undefined;
const activeCount = (userId: number) =>
  (db.prepare("SELECT COUNT(*) AS n FROM circle_members WHERE user_id = ? AND status = 'active'").get(userId) as { n: number }).n;

declare module 'express-serve-static-core' {
  interface Request {
    circle?: Circle;
    circleRole?: Role;
  }
}

function requireCircleMember(req: Request, res: Response, next: NextFunction) {
  const circle = circleById(Number(req.params.id));
  const m = circle && membershipOf(circle.id, req.user!.id);
  if (!circle || !m || m.status !== 'active') return res.status(404).json({ error: 'Circle not found.' });
  req.circle = circle;
  req.circleRole = m.role;
  next();
}

function requireCircleMod(req: Request, res: Response, next: NextFunction) {
  requireCircleMember(req, res, () => {
    if (!isMod(req.circleRole!)) return res.status(403).json({ error: 'Only moderators of this circle can do this.' });
    next();
  });
}

// When the owner leaves or deletes their account, the circle passes to the longest-standing
// moderator, or else the longest-standing member. With nobody left, the circle is deleted.
function handOverCircle(circleId: number, userId: number) {
  const otherOwners = db.prepare("SELECT COUNT(*) AS n FROM circle_members WHERE circle_id = ? AND role = 'owner' AND user_id != ?").get(circleId, userId) as {
    n: number;
  };
  if (otherOwners.n > 0) return;
  const heir = db
    .prepare(
      `SELECT user_id FROM circle_members WHERE circle_id = ? AND user_id != ? AND status = 'active'
       ORDER BY CASE role WHEN 'moderator' THEN 0 ELSE 1 END, joined_at, user_id LIMIT 1`
    )
    .get(circleId, userId) as { user_id: number } | undefined;
  if (heir) db.prepare("UPDATE circle_members SET role = 'owner' WHERE circle_id = ? AND user_id = ?").run(circleId, heir.user_id);
  else db.prepare('DELETE FROM circles WHERE id = ?').run(circleId);
}

export function handOverCircles(userId: number) {
  const owned = db.prepare("SELECT circle_id FROM circle_members WHERE user_id = ? AND role = 'owner'").all(userId) as Array<{ circle_id: number }>;
  for (const { circle_id } of owned) handOverCircle(circle_id, userId);
}

const createLimiter = rateLimit({ windowMs: 24 * 60 * 60 * 1000, max: 3, key: perUser, message: 'Too many circles created today.' });
const joinLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 10, key: perUser, message: 'Too many attempts. Try again later.' });
const postLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 20, key: perUser, message: "You've posted a lot in the last hour. Try again later." });
const commentLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 60, key: perUser });
const flagLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 30, key: perUser });

// --- Finding and joining circles ---------------------------------------------------------------

circlesRouter.get('/', (req, res) => {
  const rows = db
    .prepare(
      `SELECT c.id, c.name, c.description, c.kind, c.email_domain, m.role, m.status, m.verified, m.last_seen_at,
         (SELECT COUNT(*) FROM circle_members x WHERE x.circle_id = c.id AND x.status = 'active') AS members
       FROM circle_members m JOIN circles c ON c.id = m.circle_id
       WHERE m.user_id = ? AND m.status IN ('active', 'pending') ORDER BY c.name`
    )
    .all(req.user!.id) as Array<Circle & { role: Role; status: string; verified: number; last_seen_at: string | null; members: number }>;
  const newPosts = db.prepare('SELECT COUNT(*) AS n FROM circle_posts WHERE circle_id = ? AND user_id != ? AND hidden = 0 AND created_at > ?');
  const pending = db.prepare("SELECT COUNT(*) AS n FROM circle_members WHERE circle_id = ? AND status = 'pending'");
  const flagged = db.prepare(
    `SELECT (SELECT COUNT(DISTINCT f.target_id) FROM circle_flags f JOIN circle_posts p ON p.id = f.target_id WHERE f.target = 'post' AND p.circle_id = ?)
          + (SELECT COUNT(DISTINCT f.target_id) FROM circle_flags f JOIN circle_comments c ON c.id = f.target_id JOIN circle_posts p ON p.id = c.post_id
             WHERE f.target = 'comment' AND p.circle_id = ?) AS n`
  );
  res.json({
    circles: rows.map((r) => {
      const active = r.status === 'active';
      return {
        id: r.id,
        name: r.name,
        description: r.description,
        kind: r.kind,
        emailDomain: r.email_domain,
        role: r.role,
        status: r.status,
        verified: Boolean(r.verified),
        members: r.members,
        newPosts: active ? (newPosts.get(r.id, req.user!.id, r.last_seen_at ?? '') as { n: number }).n : 0,
        // What's waiting for a moderator.
        toReview: active && isMod(r.role) ? (pending.get(r.id) as { n: number }).n + (flagged.get(r.id, r.id) as { n: number }).n : 0,
      };
    }),
  });
});

// Listed circles, for finding one to ask to join. Unlisted circles are reachable by code only.
circlesRouter.get('/directory', (req, res) => {
  const q = String(req.query.q ?? '')
    .trim()
    .slice(0, 60)
    .replace(/[%_\\]/g, (c) => `\\${c}`);
  const rows = db
    .prepare(
      `SELECT c.id, c.name, c.description, c.kind, c.email_domain, c.require_domain,
         (SELECT COUNT(*) FROM circle_members x WHERE x.circle_id = c.id AND x.status = 'active') AS members,
         (SELECT status FROM circle_members x WHERE x.circle_id = c.id AND x.user_id = ?) AS my_status
       FROM circles c
       WHERE c.listed = 1 AND (? = '' OR c.name LIKE ? ESCAPE '\\' OR c.description LIKE ? ESCAPE '\\')
       ORDER BY members DESC, c.id DESC LIMIT 30`
    )
    .all(req.user!.id, q, `%${q}%`, `%${q}%`) as Array<Circle & { members: number; my_status: string | null }>;
  res.json({
    circles: rows
      .filter((r) => r.my_status !== 'active' && r.my_status !== 'banned')
      .map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        kind: r.kind,
        emailDomain: r.email_domain,
        requireDomain: Boolean(r.require_domain),
        members: r.members,
        requested: r.my_status === 'pending',
      })),
  });
});

const domainSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9-]+(\.[a-z0-9-]+)+$/, 'Enter a domain like college.edu')
  .max(100);

const circleSchema = z.object({
  name: z.string().trim().min(3).max(80),
  description: z.string().trim().min(10).max(500),
  kind: z.enum(CIRCLE_KINDS),
  emailDomain: domainSchema.optional().or(z.literal('')),
  requireDomain: z.boolean().default(false),
  listed: z.boolean().default(false),
});

circlesRouter.post('/', createLimiter, (req, res) => {
  const body = parse(circleSchema, req, res);
  if (!body) return;
  const user = req.user!;
  if (activeCount(user.id) >= MAX_CIRCLES) return res.status(409).json({ error: `You can be in up to ${MAX_CIRCLES} circles.` });
  const domain = body.emailDomain || null;
  // As with workplaces: only someone on a domain can make it the circle's verified domain.
  if (domain && emailDomain(user.email) !== domain) {
    return res.status(400).json({ error: `Your account's email must end in @${domain} to use it as the circle's domain.` });
  }
  if (body.requireDomain && !domain) return res.status(400).json({ error: 'Add an email domain to limit the circle to it.' });
  const code = newJoinCode();
  const stamp = now();
  db.exec('BEGIN');
  try {
    const result = db
      .prepare('INSERT INTO circles (name, description, kind, email_domain, require_domain, listed, join_code_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(body.name, body.description, body.kind, domain, body.requireDomain ? 1 : 0, body.listed ? 1 : 0, codeHash(code), stamp);
    const id = Number(result.lastInsertRowid);
    db.prepare("INSERT INTO circle_members (circle_id, user_id, role, status, verified, joined_at, last_seen_at) VALUES (?, ?, 'owner', 'active', ?, ?, ?)").run(
      id,
      user.id,
      domain ? 1 : 0,
      stamp,
      stamp
    );
    db.exec('COMMIT');
    res.status(201).json({ id, joinCode: code });
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
});

// Checks shared by joining with a code and asking to join: returns an error message or null.
function cannotJoin(circle: Circle, userId: number, email: string): string | null {
  const m = membershipOf(circle.id, userId);
  if (m?.status === 'active') return "You're already in this circle.";
  if (m?.status === 'banned') return "You can't join this circle.";
  if (activeCount(userId) >= MAX_CIRCLES) return `You can be in up to ${MAX_CIRCLES} circles.`;
  if (circle.require_domain && emailDomain(email) !== circle.email_domain) {
    return `This circle is only for people with an @${circle.email_domain} email address on their account.`;
  }
  return null;
}

function addMember(circle: Circle, userId: number, email: string, status: 'active' | 'pending') {
  const verified = circle.email_domain && emailDomain(email) === circle.email_domain ? 1 : 0;
  db.prepare(
    `INSERT INTO circle_members (circle_id, user_id, role, status, verified, joined_at) VALUES (?, ?, 'member', ?, ?, ?)
     ON CONFLICT (circle_id, user_id) DO UPDATE SET status = excluded.status, joined_at = excluded.joined_at`
  ).run(circle.id, userId, status, verified, now());
}

circlesRouter.post('/join', joinLimiter, (req, res) => {
  const body = parse(z.object({ code: z.string().trim().min(6).max(20) }), req, res);
  if (!body) return;
  const row = db.prepare('SELECT id FROM circles WHERE join_code_hash = ?').get(codeHash(body.code)) as { id: number } | undefined;
  const circle = row && circleById(row.id);
  if (!circle) return res.status(404).json({ error: "That code isn't right. Check it with whoever invited you." });
  const problem = cannotJoin(circle, req.user!.id, req.user!.email);
  if (problem) return res.status(403).json({ error: problem });
  addMember(circle, req.user!.id, req.user!.email, 'active');
  res.status(201).json({ id: circle.id });
});

circlesRouter.post('/:id/request', joinLimiter, (req, res) => {
  const circle = circleById(Number(req.params.id));
  if (!circle || !circle.listed) return res.status(404).json({ error: 'Circle not found.' });
  const problem = cannotJoin(circle, req.user!.id, req.user!.email);
  if (problem) return res.status(403).json({ error: problem });
  if (membershipOf(circle.id, req.user!.id)?.status === 'pending') return res.json({ success: true });
  addMember(circle, req.user!.id, req.user!.email, 'pending');
  res.status(201).json({ success: true });
});

// Leaving, or withdrawing a request to join.
circlesRouter.post('/:id/leave', (req, res) => {
  const circleId = Number(req.params.id);
  const m = membershipOf(circleId, req.user!.id);
  if (!m || m.status === 'banned') return res.status(404).json({ error: 'Circle not found.' });
  db.exec('BEGIN');
  try {
    if (m.role === 'owner') handOverCircle(circleId, req.user!.id);
    db.prepare('DELETE FROM circle_members WHERE circle_id = ? AND user_id = ?').run(circleId, req.user!.id);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  res.json({ success: true });
});

// --- Inside a circle ----------------------------------------------------------------------------

type PostRow = { id: number; user_id: number; kind: string; body: string; anonymous: number; hidden: number; created_at: string; author: string };
type CommentRow = { id: number; post_id: number; user_id: number; body: string; anonymous: number; hidden: number; created_at: string; author: string };

circlesRouter.get('/:id', requireCircleMember, (req, res) => {
  const c = req.circle!;
  const userId = req.user!.id;
  const before = Number(req.query.before) || Number.MAX_SAFE_INTEGER;
  const posts = db
    .prepare(
      `SELECT p.id, p.user_id, p.kind, p.body, p.anonymous, p.hidden, p.created_at, u.name AS author
       FROM circle_posts p JOIN users u ON u.id = p.user_id
       WHERE p.circle_id = ? AND p.id < ? AND (p.hidden = 0 OR p.user_id = ?) ORDER BY p.id DESC LIMIT ?`
    )
    .all(c.id, before, userId, PAGE + 1) as PostRow[];
  const more = posts.length > PAGE;
  const page = posts.slice(0, PAGE);
  const comments = page.length
    ? (db
        .prepare(
          `SELECT c.id, c.post_id, c.user_id, c.body, c.anonymous, c.hidden, c.created_at, u.name AS author
           FROM circle_comments c JOIN users u ON u.id = c.user_id
           WHERE c.post_id IN (${page.map(() => '?').join(',')}) AND (c.hidden = 0 OR c.user_id = ?) ORDER BY c.id`
        )
        .all(...page.map((p) => p.id), userId) as CommentRow[])
    : [];
  const flaggedByMe = new Set(
    (db.prepare('SELECT target, target_id FROM circle_flags WHERE user_id = ?').all(userId) as Array<{ target: string; target_id: number }>).map(
      (f) => `${f.target}:${f.target_id}`
    )
  );
  // The first page is "the latest": opening it marks the circle as read.
  if (!req.query.before) db.prepare('UPDATE circle_members SET last_seen_at = ? WHERE circle_id = ? AND user_id = ?').run(now(), c.id, userId);
  const view = (r: PostRow | CommentRow, target: 'post' | 'comment') => ({
    id: r.id,
    body: r.body,
    // Anonymous means anonymous to everyone, moderators included.
    author: r.anonymous ? null : r.author,
    mine: r.user_id === userId,
    hidden: Boolean(r.hidden),
    flagged: flaggedByMe.has(`${target}:${r.id}`),
    at: r.created_at,
  });
  const members = (db.prepare("SELECT COUNT(*) AS n FROM circle_members WHERE circle_id = ? AND status = 'active'").get(c.id) as { n: number }).n;
  res.json({
    circle: {
      id: c.id,
      name: c.name,
      description: c.description,
      kind: c.kind,
      emailDomain: c.email_domain,
      requireDomain: Boolean(c.require_domain),
      listed: Boolean(c.listed),
      members,
      role: req.circleRole,
    },
    posts: page.map((p) => ({
      ...view(p, 'post'),
      kind: p.kind,
      comments: comments.filter((cm) => cm.post_id === p.id).map((cm) => view(cm, 'comment')),
    })),
    more,
  });
});

const postSchema = z.object({ kind: z.enum(POST_KINDS), body: z.string().trim().min(3).max(2000), anonymous: z.boolean().default(false) });

circlesRouter.post('/:id/posts', requireCircleMember, postLimiter, (req, res) => {
  const body = parse(postSchema, req, res);
  if (!body) return;
  const result = db
    .prepare('INSERT INTO circle_posts (circle_id, user_id, kind, body, anonymous, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(req.circle!.id, req.user!.id, body.kind, body.body, body.anonymous ? 1 : 0, now());
  res.status(201).json({ id: Number(result.lastInsertRowid) });
});

const postIn = (circleId: number, postId: number) =>
  db.prepare('SELECT id, user_id FROM circle_posts WHERE id = ? AND circle_id = ?').get(postId, circleId) as { id: number; user_id: number } | undefined;
const commentIn = (circleId: number, commentId: number) =>
  db
    .prepare('SELECT c.id, c.user_id, c.post_id FROM circle_comments c JOIN circle_posts p ON p.id = c.post_id WHERE c.id = ? AND p.circle_id = ?')
    .get(commentId, circleId) as { id: number; user_id: number; post_id: number } | undefined;

function deletePost(postId: number) {
  const commentIds = (db.prepare('SELECT id FROM circle_comments WHERE post_id = ?').all(postId) as Array<{ id: number }>).map((c) => c.id);
  for (const id of commentIds) db.prepare("DELETE FROM circle_flags WHERE target = 'comment' AND target_id = ?").run(id);
  db.prepare("DELETE FROM circle_flags WHERE target = 'post' AND target_id = ?").run(postId);
  db.prepare('DELETE FROM circle_posts WHERE id = ?').run(postId);
}
function deleteComment(commentId: number) {
  db.prepare("DELETE FROM circle_flags WHERE target = 'comment' AND target_id = ?").run(commentId);
  db.prepare('DELETE FROM circle_comments WHERE id = ?').run(commentId);
}

circlesRouter.post('/:id/posts/:postId/comments', requireCircleMember, commentLimiter, (req, res) => {
  const body = parse(z.object({ body: z.string().trim().min(1).max(1000), anonymous: z.boolean().default(false) }), req, res);
  if (!body) return;
  const post = postIn(req.circle!.id, Number(req.params.postId));
  if (!post) return res.status(404).json({ error: 'Post not found.' });
  db.prepare('INSERT INTO circle_comments (post_id, user_id, body, anonymous, created_at) VALUES (?, ?, ?, ?, ?)').run(
    post.id,
    req.user!.id,
    body.body,
    body.anonymous ? 1 : 0,
    now()
  );
  res.status(201).json({ success: true });
});

// Authors delete their own; moderators delete anything in their circle.
circlesRouter.delete('/:id/posts/:postId', requireCircleMember, (req, res) => {
  const post = postIn(req.circle!.id, Number(req.params.postId));
  if (!post || (post.user_id !== req.user!.id && !isMod(req.circleRole!))) return res.status(404).json({ error: 'Post not found.' });
  deletePost(post.id);
  res.json({ success: true });
});

circlesRouter.delete('/:id/comments/:commentId', requireCircleMember, (req, res) => {
  const comment = commentIn(req.circle!.id, Number(req.params.commentId));
  if (!comment || (comment.user_id !== req.user!.id && !isMod(req.circleRole!))) return res.status(404).json({ error: 'Comment not found.' });
  deleteComment(comment.id);
  res.json({ success: true });
});

const FLAG_REASONS = ['harassment', 'false', 'personal_info', 'spam', 'other'] as const;

circlesRouter.post('/:id/flag', requireCircleMember, flagLimiter, (req, res) => {
  const body = parse(z.object({ target: z.enum(['post', 'comment']), id: z.number().int().positive(), reason: z.enum(FLAG_REASONS) }), req, res);
  if (!body) return;
  const item = body.target === 'post' ? postIn(req.circle!.id, body.id) : commentIn(req.circle!.id, body.id);
  if (!item) return res.status(404).json({ error: 'Not found.' });
  if (item.user_id === req.user!.id) return res.status(400).json({ error: "You can't flag your own post." });
  db.prepare('INSERT OR IGNORE INTO circle_flags (target, target_id, user_id, reason, created_at) VALUES (?, ?, ?, ?, ?)').run(
    body.target,
    body.id,
    req.user!.id,
    body.reason,
    now()
  );
  const count = (db.prepare('SELECT COUNT(*) AS n FROM circle_flags WHERE target = ? AND target_id = ?').get(body.target, body.id) as { n: number }).n;
  if (count >= HIDE_AFTER) db.prepare(`UPDATE ${body.target === 'post' ? 'circle_posts' : 'circle_comments'} SET hidden = 1 WHERE id = ?`).run(body.id);
  res.json({ success: true });
});

// --- Moderators ---------------------------------------------------------------------------------

circlesRouter.get('/:id/moderation', requireCircleMod, (req, res) => {
  const c = req.circle!;
  const requests = db
    .prepare(
      `SELECT u.id, u.name, m.verified, m.joined_at AS at FROM circle_members m JOIN users u ON u.id = m.user_id
       WHERE m.circle_id = ? AND m.status = 'pending' ORDER BY m.joined_at`
    )
    .all(c.id);
  const flaggedPosts = db
    .prepare(
      `SELECT p.id, p.body, p.kind, p.anonymous, p.hidden, p.created_at AS at, u.name AS author,
         COUNT(f.user_id) AS flags, GROUP_CONCAT(DISTINCT f.reason) AS reasons
       FROM circle_flags f JOIN circle_posts p ON p.id = f.target_id JOIN users u ON u.id = p.user_id
       WHERE f.target = 'post' AND p.circle_id = ? GROUP BY p.id ORDER BY flags DESC, p.id DESC`
    )
    .all(c.id) as Array<{ id: number; body: string; kind: string; anonymous: number; hidden: number; at: string; author: string; flags: number; reasons: string }>;
  const flaggedComments = db
    .prepare(
      `SELECT cm.id, cm.body, cm.anonymous, cm.hidden, cm.created_at AS at, u.name AS author,
         COUNT(f.user_id) AS flags, GROUP_CONCAT(DISTINCT f.reason) AS reasons
       FROM circle_flags f JOIN circle_comments cm ON cm.id = f.target_id JOIN circle_posts p ON p.id = cm.post_id JOIN users u ON u.id = cm.user_id
       WHERE f.target = 'comment' AND p.circle_id = ? GROUP BY cm.id ORDER BY flags DESC, cm.id DESC`
    )
    .all(c.id) as Array<{ id: number; body: string; anonymous: number; hidden: number; at: string; author: string; flags: number; reasons: string }>;
  const members = db
    .prepare(
      `SELECT u.id, u.name, m.role, m.verified, m.joined_at AS joinedAt FROM circle_members m JOIN users u ON u.id = m.user_id
       WHERE m.circle_id = ? AND m.status = 'active' ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'moderator' THEN 1 ELSE 2 END, u.name`
    )
    .all(c.id) as Array<{ id: number; name: string; role: Role; verified: number; joinedAt: string }>;
  const item = (r: { id: number; body: string; anonymous: number; hidden: number; at: string; author: string; flags: number; reasons: string }) => ({
    id: r.id,
    body: r.body,
    author: r.anonymous ? null : r.author,
    hidden: Boolean(r.hidden),
    flags: r.flags,
    reasons: r.reasons.split(','),
    at: r.at,
  });
  res.json({
    requests: (requests as Array<{ id: number; name: string; verified: number; at: string }>).map((r) => ({ ...r, verified: Boolean(r.verified) })),
    flagged: [...flaggedPosts.map((p) => ({ target: 'post' as const, kind: p.kind, ...item(p) })), ...flaggedComments.map((cm) => ({ target: 'comment' as const, ...item(cm) }))],
    members: members.map((m) => ({ ...m, verified: Boolean(m.verified) })),
  });
});

circlesRouter.post('/:id/moderation/requests/:userId', requireCircleMod, (req, res) => {
  const body = parse(z.object({ approve: z.boolean() }), req, res);
  if (!body) return;
  const userId = Number(req.params.userId);
  if (membershipOf(req.circle!.id, userId)?.status !== 'pending') return res.status(404).json({ error: 'Request not found.' });
  if (body.approve) {
    if (activeCount(userId) >= MAX_CIRCLES) return res.status(409).json({ error: `They're already in ${MAX_CIRCLES} circles.` });
    db.prepare("UPDATE circle_members SET status = 'active', joined_at = ? WHERE circle_id = ? AND user_id = ?").run(now(), req.circle!.id, userId);
  } else {
    db.prepare('DELETE FROM circle_members WHERE circle_id = ? AND user_id = ?').run(req.circle!.id, userId);
  }
  res.json({ success: true });
});

// Keep (clear the flags and show it again) or remove. `ban` also bans the author, which works on
// anonymous posts without revealing who wrote them.
circlesRouter.post('/:id/moderation/items', requireCircleMod, (req, res) => {
  const body = parse(
    z.object({ target: z.enum(['post', 'comment']), id: z.number().int().positive(), action: z.enum(['keep', 'remove']), ban: z.boolean().default(false) }),
    req,
    res
  );
  if (!body) return;
  const c = req.circle!;
  const item = body.target === 'post' ? postIn(c.id, body.id) : commentIn(c.id, body.id);
  if (!item) return res.status(404).json({ error: 'Not found.' });
  if (body.action === 'keep') {
    db.prepare('DELETE FROM circle_flags WHERE target = ? AND target_id = ?').run(body.target, body.id);
    db.prepare(`UPDATE ${body.target === 'post' ? 'circle_posts' : 'circle_comments'} SET hidden = 0 WHERE id = ?`).run(body.id);
    return res.json({ success: true });
  }
  if (body.ban) {
    const author = membershipOf(c.id, item.user_id);
    if (author && author.role !== 'member') return res.status(403).json({ error: "Moderators can't be banned. Ask the owner to change their role first." });
  }
  db.exec('BEGIN');
  try {
    if (body.target === 'post') deletePost(body.id);
    else deleteComment(body.id);
    if (body.ban) banMember(c.id, item.user_id);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  res.json({ success: true });
});

function banMember(circleId: number, userId: number) {
  db.prepare(
    `INSERT INTO circle_members (circle_id, user_id, role, status, joined_at) VALUES (?, ?, 'member', 'banned', ?)
     ON CONFLICT (circle_id, user_id) DO UPDATE SET status = 'banned', role = 'member'`
  ).run(circleId, userId, now());
}

// Remove or ban a member; the owner can also make someone a moderator, or step them back down.
circlesRouter.post('/:id/moderation/members/:userId', requireCircleMod, (req, res) => {
  const body = parse(z.object({ action: z.enum(['remove', 'ban', 'moderator', 'member']) }), req, res);
  if (!body) return;
  const c = req.circle!;
  const userId = Number(req.params.userId);
  const target = membershipOf(c.id, userId);
  if (!target || target.status !== 'active' || userId === req.user!.id) return res.status(404).json({ error: 'Member not found.' });
  const amOwner = req.circleRole === 'owner';
  if (target.role === 'owner' || (target.role === 'moderator' && !amOwner)) {
    return res.status(403).json({ error: "You can't change another moderator's membership." });
  }
  if ((body.action === 'moderator' || body.action === 'member') && !amOwner) return res.status(403).json({ error: 'Only the owner can change roles.' });
  if (body.action === 'remove') db.prepare('DELETE FROM circle_members WHERE circle_id = ? AND user_id = ?').run(c.id, userId);
  else if (body.action === 'ban') banMember(c.id, userId);
  else db.prepare('UPDATE circle_members SET role = ? WHERE circle_id = ? AND user_id = ?').run(body.action, c.id, userId);
  res.json({ success: true });
});

circlesRouter.post('/:id/join-code', requireCircleMod, (req, res) => {
  const code = newJoinCode();
  db.prepare('UPDATE circles SET join_code_hash = ? WHERE id = ?').run(codeHash(code), req.circle!.id);
  res.json({ joinCode: code });
});

circlesRouter.put('/:id', requireCircleMember, (req, res) => {
  if (req.circleRole !== 'owner') return res.status(403).json({ error: 'Only the owner can change the circle.' });
  const body = parse(circleSchema.omit({ emailDomain: true, kind: true }), req, res);
  if (!body) return;
  const c = req.circle!;
  if (body.requireDomain && !c.email_domain) return res.status(400).json({ error: 'This circle has no email domain to limit it to.' });
  db.prepare('UPDATE circles SET name = ?, description = ?, require_domain = ?, listed = ? WHERE id = ?').run(
    body.name,
    body.description,
    body.requireDomain ? 1 : 0,
    body.listed ? 1 : 0,
    c.id
  );
  res.json({ success: true });
});
