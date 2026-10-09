import crypto from 'crypto';
import fs from 'fs';
import express, { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { requireAuth } from '../auth';
import { rateLimit, perUser } from '../rateLimit';
import { deletePhotoFiles, photoPath, saveFile } from '../photos';
import { now, parse, randomToken, sha256 } from '../util';

// The private record: for someone living with abuse, a place to keep what happened, away from
// her phone and never on the public map. Everything arrives encrypted by her phone; the server
// can't read entries or files. Her PIN (or recovery code) is checked here through a proof, so
// someone holding her phone, even logged in as her, can't keep guessing it.

export const recordRouter = Router();
recordRouter.use(requireAuth);

const MAX_TRIES = 5;
const LOCK_MS = 15 * 60 * 1000;
const MAX_LOCK_MS = 24 * 60 * 60 * 1000;
// An open record locks itself after this long without use.
const SESSION_MS = 10 * 60 * 1000;
// Original photos, unchanged: their date and place details can matter as evidence.
const MAX_FILE_BYTES = 12 * 1024 * 1024;
const MAX_ENTRIES = 500;
const MAX_FILES_PER_ENTRY = 6;

type KeysRow = {
  pin_salt: string;
  pin_proof_hash: string;
  pin_wrapped: string;
  recovery_salt: string;
  recovery_proof_hash: string;
  recovery_wrapped: string;
  failed: number;
  locked_until: string | null;
};

const base64 = z.string().max(20_000).regex(/^[A-Za-z0-9+/]+=*$/);
const sealedSchema = z.object({ iv: base64.max(40), ciphertext: base64 });
const wrappedSchema = z.object({ salt: base64.max(40), proof: base64.max(60), wrappedKey: sealedSchema });

const keysFor = (userId: number) => db.prepare('SELECT * FROM record_keys WHERE user_id = ?').get(userId) as KeysRow | undefined;

// Compares in constant time, so timing says nothing about how close a guess was.
const sameHash = (a: string, b: string) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

function openSession(userId: number) {
  const token = randomToken();
  db.prepare('DELETE FROM record_sessions WHERE user_id = ? OR expires_at < ?').run(userId, now());
  db.prepare('INSERT INTO record_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(
    sha256(token),
    userId,
    new Date(Date.now() + SESSION_MS).toISOString()
  );
  return token;
}

// An open record: a valid token for this user. Each use keeps it open a little longer.
function openRecord(req: Request, res: Response): boolean {
  const token = req.get('X-Record-Token');
  const row = token
    ? (db.prepare('SELECT user_id AS userId, expires_at AS expiresAt FROM record_sessions WHERE token_hash = ?').get(sha256(token)) as
        | { userId: number; expiresAt: string }
        | undefined)
    : undefined;
  if (!row || row.userId !== req.user!.id || row.expiresAt < now()) {
    res.status(401).json({ error: 'Your record is locked. Open it with your PIN.', locked: true });
    return false;
  }
  db.prepare('UPDATE record_sessions SET expires_at = ? WHERE token_hash = ?').run(new Date(Date.now() + SESSION_MS).toISOString(), sha256(token!));
  return true;
}

// Checks a proof for the PIN or the recovery code, counting wrong tries for both together.
function checkProof(userId: number, keys: KeysRow, proof: string, which: 'pin' | 'recovery', res: Response): boolean {
  if (keys.locked_until && keys.locked_until > now()) {
    res.status(429).json({ error: 'Too many wrong tries. Your record is locked for a while.', lockedUntil: keys.locked_until });
    return false;
  }
  const expected = which === 'pin' ? keys.pin_proof_hash : keys.recovery_proof_hash;
  if (sameHash(sha256(proof), expected)) {
    db.prepare('UPDATE record_keys SET failed = 0, locked_until = NULL WHERE user_id = ?').run(userId);
    return true;
  }
  const failed = keys.failed + 1;
  // Five tries, then 15 minutes, doubling each time after that, up to a day.
  const lockedUntil =
    failed >= MAX_TRIES ? new Date(Date.now() + Math.min(MAX_LOCK_MS, LOCK_MS * 2 ** (failed - MAX_TRIES))).toISOString() : null;
  db.prepare('UPDATE record_keys SET failed = ?, locked_until = ? WHERE user_id = ?').run(failed, lockedUntil, userId);
  res.status(lockedUntil ? 429 : 401).json({
    error: lockedUntil ? 'Too many wrong tries. Your record is locked for a while.' : 'That PIN is not right.',
    triesLeft: Math.max(0, MAX_TRIES - failed),
    lockedUntil,
  });
  return false;
}

const unlockLimiter = rateLimit({ windowMs: 60 * 1000, max: 10, key: perUser });

// Whether she has a record, and the salt her phone needs to make the proof for her PIN.
recordRouter.get('/', (req, res) => {
  const keys = keysFor(req.user!.id);
  res.json(keys ? { exists: true, salt: keys.pin_salt, recoverySalt: keys.recovery_salt, lockedUntil: keys.locked_until && keys.locked_until > now() ? keys.locked_until : null } : { exists: false });
});

recordRouter.post('/', unlockLimiter, (req, res) => {
  const body = parse(z.object({ byPin: wrappedSchema, byRecovery: wrappedSchema }), req, res);
  if (!body) return;
  const userId = req.user!.id;
  if (keysFor(userId)) return res.status(409).json({ error: 'You already have a private record.' });
  db.prepare(
    `INSERT INTO record_keys (user_id, pin_salt, pin_proof_hash, pin_wrapped, recovery_salt, recovery_proof_hash, recovery_wrapped, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    userId,
    body.byPin.salt,
    sha256(body.byPin.proof),
    JSON.stringify(body.byPin.wrappedKey),
    body.byRecovery.salt,
    sha256(body.byRecovery.proof),
    JSON.stringify(body.byRecovery.wrappedKey),
    now()
  );
  res.status(201).json({ token: openSession(userId) });
});

type EntryRow = { id: number; iv: string; ciphertext: string; createdAt: string; updatedAt: string };
const entriesOf = (userId: number) => {
  const entries = db
    .prepare('SELECT id, iv, ciphertext, created_at AS createdAt, updated_at AS updatedAt FROM record_entries WHERE user_id = ? ORDER BY id DESC')
    .all(userId) as EntryRow[];
  const files = db.prepare('SELECT id, entry_id AS entryId, iv, size FROM record_files WHERE user_id = ? ORDER BY id').all(userId) as Array<{
    id: number;
    entryId: number;
    iv: string;
    size: number;
  }>;
  return entries.map((e) => ({ ...e, files: files.filter((f) => f.entryId === e.id).map(({ id, iv, size }) => ({ id, iv, size })) }));
};

// Open with the PIN: the wrapped record key and the (still encrypted) entries.
recordRouter.post('/unlock', unlockLimiter, (req, res) => {
  const body = parse(z.object({ proof: base64.max(60) }), req, res);
  if (!body) return;
  const userId = req.user!.id;
  const keys = keysFor(userId);
  if (!keys) return res.status(404).json({ error: 'You have no private record yet.' });
  if (!checkProof(userId, keys, body.proof, 'pin', res)) return;
  res.json({ token: openSession(userId), wrappedKey: JSON.parse(keys.pin_wrapped), entries: entriesOf(userId) });
});

// Forgot the PIN: the recovery code opens it, and she sets a new PIN.
recordRouter.post('/recover', unlockLimiter, (req, res) => {
  const body = parse(z.object({ proof: base64.max(60) }), req, res);
  if (!body) return;
  const userId = req.user!.id;
  const keys = keysFor(userId);
  if (!keys) return res.status(404).json({ error: 'You have no private record yet.' });
  if (!checkProof(userId, keys, body.proof, 'recovery', res)) return;
  res.json({ token: openSession(userId), wrappedKey: JSON.parse(keys.recovery_wrapped), entries: entriesOf(userId) });
});

recordRouter.put('/pin', (req, res) => {
  if (!openRecord(req, res)) return;
  const body = parse(wrappedSchema, req, res);
  if (!body) return;
  db.prepare('UPDATE record_keys SET pin_salt = ?, pin_proof_hash = ?, pin_wrapped = ? WHERE user_id = ?').run(
    body.salt,
    sha256(body.proof),
    JSON.stringify(body.wrappedKey),
    req.user!.id
  );
  res.json({ success: true });
});

recordRouter.post('/lock', (req, res) => {
  const token = req.get('X-Record-Token');
  if (token) db.prepare('DELETE FROM record_sessions WHERE token_hash = ?').run(sha256(token));
  res.json({ success: true });
});

recordRouter.post('/entries', (req, res) => {
  if (!openRecord(req, res)) return;
  const body = parse(sealedSchema, req, res);
  if (!body) return;
  const userId = req.user!.id;
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM record_entries WHERE user_id = ?').get(userId) as { n: number };
  if (n >= MAX_ENTRIES) return res.status(400).json({ error: 'Your record is full.' });
  const stamp = now();
  const r = db
    .prepare('INSERT INTO record_entries (user_id, iv, ciphertext, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
    .run(userId, body.iv, body.ciphertext, stamp, stamp);
  res.status(201).json({ id: Number(r.lastInsertRowid), createdAt: stamp });
});

const ownEntry = (id: number, userId: number) => db.prepare('SELECT id FROM record_entries WHERE id = ? AND user_id = ?').get(id, userId);

recordRouter.put('/entries/:id', (req, res) => {
  if (!openRecord(req, res)) return;
  const body = parse(sealedSchema, req, res);
  if (!body) return;
  const id = Number(req.params.id);
  if (!ownEntry(id, req.user!.id)) return res.status(404).json({ error: 'Not found.' });
  db.prepare('UPDATE record_entries SET iv = ?, ciphertext = ?, updated_at = ? WHERE id = ?').run(body.iv, body.ciphertext, now(), id);
  res.json({ success: true });
});

const filesOfEntries = (where: string, ...params: number[]) =>
  (db.prepare(`SELECT file FROM record_files WHERE ${where}`).all(...params) as Array<{ file: string }>).map((f) => f.file);

recordRouter.delete('/entries/:id', (req, res) => {
  if (!openRecord(req, res)) return;
  const id = Number(req.params.id);
  if (!ownEntry(id, req.user!.id)) return res.status(404).json({ error: 'Not found.' });
  const files = filesOfEntries('entry_id = ?', id);
  db.prepare('DELETE FROM record_entries WHERE id = ?').run(id);
  deletePhotoFiles(files);
  res.json({ success: true });
});

// An encrypted photo or recording for an entry: raw bytes, with its IV in a header.
const fileLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 120, key: perUser });
recordRouter.post('/entries/:id/files', fileLimiter, express.raw({ type: 'application/octet-stream', limit: MAX_FILE_BYTES }), (req, res) => {
  if (!openRecord(req, res)) return;
  const id = Number(req.params.id);
  const userId = req.user!.id;
  if (!ownEntry(id, userId)) return res.status(404).json({ error: 'Not found.' });
  const iv = req.get('X-Record-IV') ?? '';
  if (!/^[A-Za-z0-9+/]{16}$/.test(iv)) return res.status(400).json({ error: 'Missing IV.' });
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) return res.status(400).json({ error: 'No file.' });
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM record_files WHERE entry_id = ?').get(id) as { n: number };
  if (n >= MAX_FILES_PER_ENTRY) return res.status(400).json({ error: `Up to ${MAX_FILES_PER_ENTRY} files per entry.` });
  const file = saveFile(req.body, 'bin');
  const r = db
    .prepare('INSERT INTO record_files (entry_id, user_id, iv, file, size, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, userId, iv, file, req.body.length, now());
  res.status(201).json({ id: Number(r.lastInsertRowid) });
});

recordRouter.get('/files/:id', (req, res) => {
  if (!openRecord(req, res)) return;
  const row = db.prepare('SELECT file FROM record_files WHERE id = ? AND user_id = ?').get(Number(req.params.id), req.user!.id) as
    | { file: string }
    | undefined;
  const p = row && photoPath(row.file);
  if (!p || !fs.existsSync(p)) return res.status(404).json({ error: 'Not found.' });
  res.setHeader('Cache-Control', 'no-store');
  res.type('application/octet-stream').send(fs.readFileSync(p));
});

// Deletes the whole record: entries, files and keys. Needs the record open (her PIN).
export function deleteRecord(userId: number) {
  const files = filesOfEntries('user_id = ?', userId);
  db.prepare('DELETE FROM record_entries WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM record_keys WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM record_sessions WHERE user_id = ?').run(userId);
  deletePhotoFiles(files);
}

recordRouter.delete('/', (req, res) => {
  if (!openRecord(req, res)) return;
  deleteRecord(req.user!.id);
  res.json({ success: true });
});
