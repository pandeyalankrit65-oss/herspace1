import { api, ApiError } from "./api";
import { apiUrl } from "./native";
import {
  createRecordKeys,
  decryptBytes,
  decryptJson,
  encryptBytes,
  encryptJson,
  normaliseRecovery,
  proofFor,
  rewrapForPin,
  unwrapRecordKey,
  type Sealed,
} from "./recordCrypto";

// The private record, on the phone side: everything is encrypted here before it's sent, and
// decrypted only in memory while the record is open. Nothing is stored on the phone.

export type RecordEntry = {
  date: string;
  time: string;
  what: string;
  injuries: string;
  witnesses: string;
};
export type OpenEntry = RecordEntry & { id: number; createdAt: string; files: Array<{ id: number; iv: string; size: number }> };
export type OpenRecord = { token: string; key: CryptoKey; rawKey: Uint8Array; entries: OpenEntry[] };

type Status = { exists: false } | { exists: true; salt: string; recoverySalt: string; lockedUntil: string | null };
type ServerEntry = Sealed & { id: number; createdAt: string; files: OpenEntry["files"] };

export const recordStatus = () => api<Status>("/api/record");

const headers = (token: string) => ({ "X-Record-Token": token });

async function decryptEntries(key: CryptoKey, entries: ServerEntry[]): Promise<OpenEntry[]> {
  return Promise.all(
    entries.map(async (e) => ({ ...(await decryptJson<RecordEntry>(key, e)), id: e.id, createdAt: e.createdAt, files: e.files }))
  );
}

export async function createRecord(pin: string) {
  const keys = await createRecordKeys(pin);
  const res = await api<{ token: string }>("/api/record", { body: { byPin: keys.byPin, byRecovery: keys.byRecovery } });
  const record: OpenRecord = { token: res.token, key: keys.key, rawKey: keys.rawKey, entries: [] };
  return { record, recoveryCode: keys.recoveryCode };
}

// Opens with the PIN, or with the recovery code (then she sets a new PIN).
export async function openRecord(secret: string, salt: string, by: "pin" | "recovery"): Promise<OpenRecord> {
  const value = by === "recovery" ? normaliseRecovery(secret) : secret;
  const proof = await proofFor(value, salt);
  const res = await api<{ token: string; wrappedKey: Sealed; entries: ServerEntry[] }>(by === "pin" ? "/api/record/unlock" : "/api/record/recover", {
    body: { proof },
  });
  const { key, rawKey } = await unwrapRecordKey(value, salt, res.wrappedKey);
  return { token: res.token, key, rawKey, entries: await decryptEntries(key, res.entries) };
}

export async function setNewPin(record: OpenRecord, pin: string) {
  await api("/api/record/pin", { method: "PUT", body: await rewrapForPin(pin, record.rawKey), headers: headers(record.token) });
}

export async function addEntry(record: OpenRecord, entry: RecordEntry) {
  const sealed = await encryptJson(record.key, entry);
  return api<{ id: number; createdAt: string }>("/api/record/entries", { body: sealed, headers: headers(record.token) });
}

export async function deleteEntry(record: OpenRecord, id: number) {
  await api(`/api/record/entries/${id}`, { method: "DELETE", headers: headers(record.token) });
}

// A photo, encrypted here. Photos taken for the record never go to the gallery.
export async function addFile(record: OpenRecord, entryId: number, data: Blob) {
  const { iv, bytes } = await encryptBytes(record.key, new Uint8Array(await data.arrayBuffer()));
  const res = await fetch(apiUrl(`/api/record/entries/${entryId}/files`), {
    method: "POST",
    credentials: "same-origin",
    headers: { "X-Requested-With": "HerSpace", "Content-Type": "application/octet-stream", "X-Record-Token": record.token, "X-Record-IV": iv },
    body: bytes,
  });
  const data2 = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data2?.error || `Upload failed (${res.status})`, res.status);
  return { id: (data2 as { id: number }).id, iv, size: bytes.length };
}

export async function readFile(record: OpenRecord, file: { id: number; iv: string }) {
  const res = await fetch(apiUrl(`/api/record/files/${file.id}`), {
    credentials: "same-origin",
    headers: { "X-Requested-With": "HerSpace", "X-Record-Token": record.token },
  });
  if (!res.ok) throw new ApiError(`Couldn't load the file (${res.status})`, res.status);
  return new Blob([await decryptBytes(record.key, file.iv, new Uint8Array(await res.arrayBuffer()))], { type: "image/jpeg" });
}

export async function lockRecord(record: OpenRecord | null) {
  if (record) await api("/api/record/lock", { body: {}, headers: headers(record.token) }).catch(() => {});
}

export async function deleteWholeRecord(record: OpenRecord) {
  await api("/api/record", { method: "DELETE", headers: headers(record.token) });
}
