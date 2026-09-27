import fs from 'fs';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';

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
  db.prepare('DELETE FROM sos_events WHERE created_at < ?').run(sosCutoff);
}
