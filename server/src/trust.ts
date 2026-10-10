import { db } from './db';
import { keyedHash } from './util';

// Verified community reporting. Everything here is a plain rule a moderator can read and
// explain; nothing is a black-box score. Reports that trip a rule are held for a moderator
// rather than rejected, because a real report can look unusual too.

// Throwaway inbox services often used for fake accounts. Not exhaustive: a signal, not a block.
export const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com',
  'guerrillamail.com',
  'guerrillamail.net',
  'sharklasers.com',
  '10minutemail.com',
  '10minutemail.net',
  'tempmail.com',
  'temp-mail.org',
  'tempmail.net',
  'tempmailo.com',
  'yopmail.com',
  'yopmail.net',
  'trashmail.com',
  'getnada.com',
  'dispostable.com',
  'maildrop.cc',
  'mintemail.com',
  'throwawaymail.com',
  'fakeinbox.com',
  'mohmal.com',
  'emailondeck.com',
  'mailnesia.com',
  'moakt.com',
  'tmail.ws',
  'burnermail.io',
  'spamgourmet.com',
  'mytemp.email',
  'inboxkitten.com',
  'tempinbox.com',
  'mail.tm',
]);

export const isDisposable = (email: string) => DISPOSABLE_DOMAINS.has(email.split('@')[1]?.toLowerCase() ?? '');

type Account = { id: number; email: string; created_at: string; email_verified_at: string | null; phone: string | null; suspended_at: string | null };
const account = (userId: number) =>
  db.prepare('SELECT id, email, created_at, email_verified_at, phone, suspended_at FROM users WHERE id = ?').get(userId) as Account | undefined;

export type Trust = 'anonymous' | 'account' | 'verified';

// A verified reporter has proved both their email and their phone number.
export function reporterTrust(userId: number | null): Trust {
  if (userId === null) return 'anonymous';
  const a = account(userId);
  return a?.email_verified_at && a.phone ? 'verified' : 'account';
}

export const HOLD_REASONS = ['burst', 'far_apart', 'duplicate', 'new_unverified', 'disposable_email'] as const;
export type HoldReason = (typeof HOLD_REASONS)[number];

const HOUR_MS = 60 * 60 * 1000;
const BURST = 5;
const FAR_KM = 200;

// Distance on the Earth's surface, in km.
function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

// Lowercased, punctuation and spacing removed: catches the same text pasted again.
const normalise = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

// Why a new report should wait for a moderator, if at all. Anonymous reports are only checked
// for copied text: nothing else about them is stored, by design.
export function holdReasons(report: { userId: number | null; description: string; lat?: number; lng?: number }): HoldReason[] {
  const reasons: HoldReason[] = [];
  const since = (ms: number) => new Date(Date.now() - ms).toISOString();

  const text = normalise(report.description);
  if (text.length >= 20) {
    const recent = db.prepare('SELECT description FROM reports WHERE created_at > ?').all(since(7 * 24 * HOUR_MS)) as Array<{ description: string }>;
    if (recent.some((r) => normalise(r.description) === text)) reasons.push('duplicate');
  }
  if (report.userId === null) return reasons;

  const a = account(report.userId);
  if (!a) return reasons;
  const lastHour = db
    .prepare('SELECT lat, lng FROM reports WHERE user_id = ? AND created_at > ?')
    .all(a.id, since(HOUR_MS)) as Array<{ lat: number | null; lng: number | null }>;
  if (lastHour.length + 1 >= BURST) reasons.push('burst');
  if (report.lat !== undefined && report.lng !== undefined) {
    const here = { lat: report.lat, lng: report.lng };
    if (lastHour.some((r) => r.lat !== null && r.lng !== null && km(here, { lat: r.lat, lng: r.lng }) > FAR_KM)) reasons.push('far_apart');
  }
  // New accounts confirm their email when signing up, but anyone can open a throwaway inbox.
  if (isDisposable(a.email)) reasons.push('disposable_email');
  if (!a.email_verified_at) {
    const young = Date.now() - new Date(a.created_at).getTime() < 24 * HOUR_MS;
    const today = (db.prepare('SELECT COUNT(*) AS n FROM reports WHERE user_id = ? AND created_at > ?').get(a.id, since(24 * HOUR_MS)) as { n: number }).n;
    if (young && today + 1 >= 3) reasons.push('new_unverified');
  }
  return reasons;
}

export const isSuspended = (userId: number) => Boolean(account(userId)?.suspended_at);

// Moderators review accounts by a stable pseudonym, never by name or email: the Safe Map
// promises that moderators don't learn who sent a report.
export const pseudonym = (userId: number) => `#${keyedHash(`account:${userId}`).slice(0, 6).toUpperCase()}`;

export const ACCOUNT_SIGNALS = ['held_reports', 'removed_reports', 'flagged_reports', 'disposable_email'] as const;
export type AccountSignal = (typeof ACCOUNT_SIGNALS)[number];

export function accountSignals(userId: number): { signals: AccountSignal[]; stats: Record<string, number> } {
  const a = account(userId)!;
  const month = new Date(Date.now() - 30 * 24 * HOUR_MS).toISOString();
  const stats = db
    .prepare(
      `SELECT COUNT(*) AS reports,
         COALESCE(SUM(CASE WHEN hold_reasons IS NOT NULL AND created_at > ? THEN 1 ELSE 0 END), 0) AS held,
         COALESCE(SUM(CASE WHEN map_status = 'removed' THEN 1 ELSE 0 END), 0) AS removed,
         (SELECT COUNT(DISTINCT f.flagger) FROM report_flags f JOIN reports r ON r.id = f.report_id WHERE r.user_id = ? AND f.created_at > ?) AS flaggers
       FROM reports WHERE user_id = ?`
    )
    .get(month, userId, month, userId) as { reports: number; held: number; removed: number; flaggers: number };
  const signals: AccountSignal[] = [];
  if (stats.held > 0) signals.push('held_reports');
  if (stats.removed >= 2) signals.push('removed_reports');
  if (stats.flaggers >= 5) signals.push('flagged_reports');
  if (isDisposable(a.email)) signals.push('disposable_email');
  return { signals, stats };
}
