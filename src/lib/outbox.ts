import { api } from "./api";
import { uploadPhoto } from "./photos";

// Reports written while offline are kept on this device (IndexedDB, so photos fit) and sent
// as soon as there's a connection again.

const DB = "herspace";
const STORE = "outbox";

// userId: who wrote it (null if anonymous). A report is only ever sent from that same account,
// so on a shared phone it can't end up in someone else's account.
export type QueuedReport = { id?: number; userId: number | null; body: Record<string, unknown>; photos: Blob[]; createdAt: string };

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const queueReport = (report: Omit<QueuedReport, "id">) => tx("readwrite", (s) => s.add(report));
export const queuedReports = () => tx<QueuedReport[]>("readonly", (s) => s.getAll() as IDBRequest<QueuedReport[]>);
const remove = (id: number) => tx("readwrite", (s) => s.delete(id));

// Runs one after another: a run for one user must never absorb a request made for another
// (e.g. someone logs in while a run for the previous account is still going).
let queue: Promise<unknown> = Promise.resolve();

async function sendFor(currentUserId: number | null): Promise<number> {
  let sent = 0;
  const queued = await queuedReports().catch(() => [] as QueuedReport[]);
  // A named report is sent only when the server confirms its author is the one signed in
  // (the app's idea of the user can be out of date, e.g. just after a logout).
  let signedInAs: number | null = null;
  if (currentUserId !== null && queued.some((r) => r.userId === currentUserId && r.body.anonymous !== true)) {
    signedInAs = await api<{ user: { id: number } }>("/api/auth/me")
      .then((r) => r.user.id)
      .catch(() => null);
  }
  const mine = (r: QueuedReport) => r.body.anonymous === true || (r.userId !== null && r.userId === currentUserId && r.userId === signedInAs);
  for (const r of queued.filter(mine)) {
    try {
      const created = await api<{ id: number; uploadToken: string }>("/api/reports", { body: r.body });
      for (const photo of r.photos) await uploadPhoto(created.id, created.uploadToken, photo).catch(() => {});
      await remove(r.id!);
      sent++;
    } catch {
      break; // still offline (or the server is down): try again later
    }
  }
  if (sent) window.dispatchEvent(new CustomEvent("herspace-outbox-sent", { detail: sent }));
  return sent;
}

// Sends the queued reports that belong to the signed-in user (or are anonymous). Returns how
// many were sent. Safe to call often.
export function sendQueuedReports(currentUserId: number | null): Promise<number> {
  const run = queue.then(() => sendFor(currentUserId));
  queue = run.catch(() => {});
  return run;
}
