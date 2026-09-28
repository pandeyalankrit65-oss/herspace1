import { api } from "./api";
import { uploadPhoto } from "./photos";

// Reports written while offline are kept on this device (IndexedDB, so photos fit) and sent
// as soon as there's a connection again.

const DB = "herspace";
const STORE = "outbox";

export type QueuedReport = { id?: number; body: Record<string, unknown>; photos: Blob[]; createdAt: string };

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

let sending: Promise<number> | null = null;

// Sends every queued report. Returns how many were sent. Safe to call often.
export function sendQueuedReports(): Promise<number> {
  if (sending) return sending;
  sending = (async () => {
    let sent = 0;
    for (const r of await queuedReports().catch(() => [])) {
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
  })().finally(() => {
    sending = null;
  });
  return sending;
}
