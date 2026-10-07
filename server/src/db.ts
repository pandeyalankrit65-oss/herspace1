import fs from 'fs';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';
import { deletePhotoFiles } from './photos';

const dbPath = process.env.DATABASE_PATH || path.resolve(__dirname, '..', 'data', 'herspace.db');
if (dbPath !== ':memory:') fs.mkdirSync(path.dirname(dbPath), { recursive: true });

export const db = new DatabaseSync(dbPath);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

// Append-only list: never edit a migration once it has shipped, add a new one instead.
// PRAGMA user_version records how many have been applied.
const migrations: string[] = [
  `
  CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL
  );

  CREATE TABLE contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    relation TEXT
  );

  -- user_id is NULL for anonymous reports: the reporter is never stored.
  CREATE TABLE reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    incident_type TEXT NOT NULL,
    description TEXT NOT NULL,
    location_text TEXT,
    lat REAL,
    lng REAL,
    incident_date TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE sos_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    lat REAL,
    lng REAL,
    accuracy REAL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE sos_deliveries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sos_id INTEGER NOT NULL REFERENCES sos_events(id) ON DELETE CASCADE,
    contact_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    status TEXT NOT NULL,
    error TEXT
  );
  `,
  `
  -- Contacts must agree before they receive alerts (prevents using SOS to spam strangers).
  ALTER TABLE contacts ADD COLUMN status TEXT NOT NULL DEFAULT 'pending';
  ALTER TABLE contacts ADD COLUMN confirm_token_hash TEXT;
  ALTER TABLE contacts ADD COLUMN invited_at TEXT;
  CREATE INDEX contacts_confirm_token ON contacts(confirm_token_hash);

  -- Test alerts are stored like real ones so they count toward limits, but flagged.
  ALTER TABLE sos_events ADD COLUMN is_test INTEGER NOT NULL DEFAULT 0;

  -- Provider message/call ids let delivery-status callbacks update the right row.
  ALTER TABLE sos_deliveries ADD COLUMN channel TEXT NOT NULL DEFAULT 'sms';
  ALTER TABLE sos_deliveries ADD COLUMN provider_sid TEXT;
  ALTER TABLE sos_deliveries ADD COLUMN updated_at TEXT;
  CREATE INDEX sos_deliveries_sid ON sos_deliveries(provider_sid);

  CREATE TABLE password_resets (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL
  );

  -- Community flags on map reports; heavily flagged reports are hidden from the map.
  CREATE TABLE report_flags (
    report_id INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    flagger TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (report_id, flagger)
  );
  `,
  `
  -- Live location shared with emergency contacts after an SOS, via a secret link.
  -- Only the latest position is kept, and it's cleared when sharing stops.
  CREATE TABLE location_shares (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sos_id INTEGER REFERENCES sos_events(id) ON DELETE SET NULL,
    token_hash TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    ended_at TEXT,
    lat REAL,
    lng REAL,
    accuracy REAL,
    updated_at TEXT
  );
  CREATE INDEX location_shares_user ON location_shares(user_id);
  `,
  `
  CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  `,
  `
  -- Safety timers: if the user doesn't check in by due_at, the server alerts their contacts.
  -- status: active -> completed | cancelled | alerted (alerted -> completed when they say they're safe)
  CREATE TABLE check_ins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    note TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL,
    due_at TEXT NOT NULL,
    lat REAL,
    lng REAL,
    accuracy REAL,
    location_at TEXT,
    alerted_at TEXT,
    sos_id INTEGER REFERENCES sos_events(id) ON DELETE SET NULL
  );
  CREATE INDEX check_ins_due ON check_ins(status, due_at);
  `,
  `
  -- "Walk with me": live shares that aren't emergencies.
  ALTER TABLE location_shares ADD COLUMN kind TEXT NOT NULL DEFAULT 'sos';
  ALTER TABLE location_shares ADD COLUMN note TEXT;

  -- Contacts replying "I'm on my way" from their tracking link.
  CREATE TABLE share_acks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    share_id INTEGER NOT NULL REFERENCES location_shares(id) ON DELETE CASCADE,
    contact_id INTEGER,
    contact_name TEXT,
    created_at TEXT NOT NULL
  );
  CREATE UNIQUE INDEX share_acks_contact ON share_acks(share_id, contact_id);

  -- Moderators review flagged map points (role is granted via ADMIN_EMAILS).
  ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user';
  -- visible: normal; approved: a moderator kept it, flags no longer hide it; removed: off the map.
  ALTER TABLE reports ADD COLUMN map_status TEXT NOT NULL DEFAULT 'visible';

  -- Photo evidence attached to reports (files on disk, metadata stripped).
  ALTER TABLE reports ADD COLUMN upload_token_hash TEXT;
  ALTER TABLE reports ADD COLUMN upload_expires_at TEXT;
  CREATE TABLE report_photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    file TEXT NOT NULL,
    size INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );
  `,
  `
  -- The user's own phone number, stored only once they've proved it's theirs with a code.
  ALTER TABLE users ADD COLUMN phone TEXT;
  ALTER TABLE users ADD COLUMN phone_verified_at TEXT;
  CREATE TABLE phone_codes (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    phone TEXT NOT NULL,
    code_hash TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0
  );
  `,
  `
  -- A phrase the user can text a contact when she can't speak freely ("did you buy the red umbrella?").
  ALTER TABLE users ADD COLUMN code_phrase TEXT;
  `,
  `
  -- Audio recorded during an SOS, uploaded in short pieces so it survives the phone being taken.
  CREATE TABLE sos_recordings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sos_id INTEGER NOT NULL REFERENCES sos_events(id) ON DELETE CASCADE,
    seq INTEGER NOT NULL,
    file TEXT NOT NULL,
    mime TEXT NOT NULL,
    size INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX sos_recordings_sos ON sos_recordings(sos_id);
  `,
  `
  -- Journeys (rides, meetings) can have a safety timer, and ride shares warn contacts once if
  -- the location stops updating.
  ALTER TABLE location_shares ADD COLUMN check_in_id INTEGER;
  ALTER TABLE location_shares ADD COLUMN stale_alerted_at TEXT;
  `,
  `
  -- Emergency info (blood group, allergies...) the user chooses to show contacts during an SOS.
  ALTER TABLE users ADD COLUMN emergency_info TEXT;
  ALTER TABLE users ADD COLUMN emergency_info_share INTEGER NOT NULL DEFAULT 0;
  -- The phone's battery with each position, so contacts know why updates might stop.
  ALTER TABLE location_shares ADD COLUMN battery REAL;
  ALTER TABLE location_shares ADD COLUMN charging INTEGER;
  `,
  `
  -- Where a journey is heading ("Home"): only the name; the place itself stays on the phone,
  -- which detects arrival. arrived: the journey ended by reaching it.
  ALTER TABLE location_shares ADD COLUMN destination TEXT;
  ALTER TABLE location_shares ADD COLUMN arrived INTEGER NOT NULL DEFAULT 0;
  `,
  `
  -- Corporate Connect. An organisation is set up by someone in HR; employees join with its
  -- code. join_code_hash is keyed, so the code itself isn't stored.
  CREATE TABLE organizations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email_domain TEXT,
    join_code_hash TEXT NOT NULL UNIQUE,
    slack_webhook TEXT,
    teams_webhook TEXT,
    notify_email TEXT,
    created_at TEXT NOT NULL
  );
  -- One workplace per account. verified: the account's email matches the workplace's domain.
  CREATE TABLE org_members (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member',
    verified INTEGER NOT NULL DEFAULT 0,
    joined_at TEXT NOT NULL
  );
  CREATE INDEX org_members_org ON org_members(org_id);
  -- Reports to HR. HR never sees who filed one unless share_identity is set. They go with the
  -- reporter's account, like every other personal report.
  CREATE TABLE workplace_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    incident_date TEXT,
    location TEXT,
    share_identity INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'new',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    first_response_at TEXT
  );
  CREATE INDEX workplace_reports_org ON workplace_reports(org_id);
  CREATE TABLE workplace_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id INTEGER NOT NULL REFERENCES workplace_reports(id) ON DELETE CASCADE,
    from_hr INTEGER NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  `,
  // Safe Circles: private communities. Anonymous posts keep user_id so the author can delete
  // them and moderators can ban the author, but it is never shown to anyone.
  `
  CREATE TABLE circles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    kind TEXT NOT NULL,
    email_domain TEXT,
    require_domain INTEGER NOT NULL DEFAULT 0,
    listed INTEGER NOT NULL DEFAULT 0,
    join_code_hash TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL
  );
  CREATE TABLE circle_members (
    circle_id INTEGER NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member',
    status TEXT NOT NULL DEFAULT 'active',
    verified INTEGER NOT NULL DEFAULT 0,
    joined_at TEXT NOT NULL,
    last_seen_at TEXT,
    PRIMARY KEY (circle_id, user_id)
  );
  CREATE INDEX circle_members_user ON circle_members(user_id);
  CREATE TABLE circle_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    circle_id INTEGER NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    body TEXT NOT NULL,
    anonymous INTEGER NOT NULL DEFAULT 0,
    hidden INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
  CREATE INDEX circle_posts_circle ON circle_posts(circle_id, id);
  CREATE TABLE circle_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL REFERENCES circle_posts(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    anonymous INTEGER NOT NULL DEFAULT 0,
    hidden INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
  CREATE INDEX circle_comments_post ON circle_comments(post_id);
  CREATE TABLE circle_flags (
    target TEXT NOT NULL,
    target_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (target, target_id, user_id)
  );
  `,
  // Partner network: counsellors, lawyers, NGOs and trainers who apply and are checked by
  // HerSpace moderators before they're listed. Session requests are emailed to the partner.
  `
  CREATE TABLE partners (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    kind TEXT NOT NULL,
    city TEXT NOT NULL,
    languages TEXT NOT NULL,
    description TEXT NOT NULL,
    credentials TEXT NOT NULL,
    fees TEXT NOT NULL,
    fee_note TEXT,
    online INTEGER NOT NULL DEFAULT 0,
    in_person INTEGER NOT NULL DEFAULT 0,
    email TEXT NOT NULL,
    phone TEXT,
    website TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    review_note TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    verified_at TEXT
  );
  CREATE INDEX partners_status ON partners(status, kind);
  CREATE TABLE partner_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    partner_id INTEGER NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    contact_method TEXT NOT NULL,
    contact_value TEXT NOT NULL,
    preferred_time TEXT,
    message TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX partner_requests_user ON partner_requests(user_id);
  `,
  // Verified community reporting: confirmed email addresses, how much each map report can be
  // trusted, reports held for review, "I saw this too" confirmations, and account suspension
  // from the Safe Map (never from SOS).
  `
  ALTER TABLE users ADD COLUMN email_verified_at TEXT;
  ALTER TABLE users ADD COLUMN suspended_at TEXT;
  ALTER TABLE users ADD COLUMN suspended_reason TEXT;
  ALTER TABLE users ADD COLUMN reviewed_at TEXT;
  CREATE TABLE email_verifications (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL
  );
  ALTER TABLE reports ADD COLUMN reporter_trust TEXT NOT NULL DEFAULT 'anonymous';
  ALTER TABLE reports ADD COLUMN hold_reasons TEXT;
  UPDATE reports SET reporter_trust = 'account' WHERE user_id IS NOT NULL;
  CREATE TABLE report_confirmations (
    report_id INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    PRIMARY KEY (report_id, user_id)
  );
  `,
  // The time of day an incident happened (HH:MM, optional): the map shares only the hour, so
  // people can see when a place's reports cluster, e.g. after dark.
  `
  ALTER TABLE reports ADD COLUMN incident_time TEXT;
  `,
];

function migrate() {
  const { user_version: current } = db.prepare('PRAGMA user_version').get() as { user_version: number };
  for (let v = current; v < migrations.length; v++) {
    db.exec('BEGIN');
    try {
      db.exec(migrations[v]);
      db.exec(`PRAGMA user_version = ${v + 1}`);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }
}

// Databases created before migrations existed already have the v1 tables but user_version 0.
const hasUsers = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'users'").get();
const { user_version } = db.prepare('PRAGMA user_version').get() as { user_version: number };
if (hasUsers && user_version === 0) db.exec('PRAGMA user_version = 1');

migrate();

// Keep SOS locations and expired tokens only as long as needed.
const SOS_RETENTION_DAYS = Number(process.env.SOS_RETENTION_DAYS || 90);

export function purgeExpiredData() {
  const now = new Date().toISOString();
  const sosCutoff = new Date(Date.now() - SOS_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now);
  db.prepare('DELETE FROM password_resets WHERE expires_at < ?').run(now);
  db.prepare('DELETE FROM phone_codes WHERE expires_at < ?').run(now);
  deleteSosEvents('created_at < ?', sosCutoff);
  // Finished shares are kept a day so a contact opening the link late sees "ended", not "not found".
  const shareCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  db.prepare('DELETE FROM location_shares WHERE COALESCE(ended_at, expires_at) < ?').run(shareCutoff);
  db.prepare("DELETE FROM check_ins WHERE status != 'active' AND created_at < ?").run(sosCutoff);
}

// Deletes SOS events matching a condition, with their recording files.
export function deleteSosEvents(where: string, ...params: Array<string | number>) {
  const files = db
    .prepare(`SELECT r.file FROM sos_recordings r JOIN sos_events e ON e.id = r.sos_id WHERE e.${where}`)
    .all(...params) as Array<{ file: string }>;
  db.prepare(`DELETE FROM sos_events WHERE ${where}`).run(...params);
  deletePhotoFiles(files.map((f) => f.file));
}
