"use client";

// Restorable copies of the company, taken before anything replaces local data
// (import, reset, a sync conflict, the first download from the cloud).
// Kept in IndexedDB — far more room than localStorage — newest first, at most
// MAX_BACKUPS. Falls back to one localStorage slot where IndexedDB is unavailable.

import type { CompanyState } from "./types";

export type BackupReason = "import" | "reset" | "conflict" | "pull" | "legacy";

export interface BackupInfo {
  id: number;
  at: string;
  reason: BackupReason;
  bytes: number;
}

interface BackupRecord extends Omit<BackupInfo, "id"> {
  id?: number;
  state: CompanyState;
}

export const MAX_BACKUPS = 5;
export const LEGACY_BACKUP_KEY = "aicos:state:backup";
const DB_NAME = "aicos";
const STORE = "backups";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("IndexedDB unavailable"));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = fn(t.objectStore(STORE));
        t.oncomplete = () => {
          db.close();
          resolve(req.result);
        };
        t.onerror = t.onabort = () => {
          db.close();
          reject(t.error ?? req.error);
        };
      }),
  );
}

async function all(): Promise<BackupRecord[]> {
  const rows = await tx<BackupRecord[]>("readonly", (s) => s.getAll());
  return rows.sort((a, b) => (b.id ?? 0) - (a.id ?? 0));
}

/** Returns false if no backup could be stored — callers must then not replace local data. */
export async function saveBackup(reason: BackupReason, state: CompanyState): Promise<boolean> {
  const json = JSON.stringify(state);
  try {
    await tx("readwrite", (s) => s.add({ at: new Date().toISOString(), reason, bytes: json.length, state } satisfies BackupRecord));
    const rows = await all();
    for (const old of rows.slice(MAX_BACKUPS)) await tx("readwrite", (s) => s.delete(old.id!));
    return true;
  } catch {
    try {
      localStorage.setItem(LEGACY_BACKUP_KEY, json);
      return true;
    } catch {
      return false;
    }
  }
}

export async function listBackups(): Promise<BackupInfo[]> {
  const out: BackupInfo[] = [];
  try {
    for (const r of await all()) out.push({ id: r.id!, at: r.at, reason: r.reason, bytes: r.bytes });
  } catch {
    /* IndexedDB unavailable */
  }
  const legacy = readLegacy();
  if (legacy) out.push({ id: -1, at: "", reason: "legacy", bytes: legacy.length });
  return out;
}

/** The stored state of one backup (unvalidated — callers validate before using it). */
export async function readBackup(id: number): Promise<unknown | null> {
  if (id === -1) {
    const legacy = readLegacy();
    if (!legacy) return null;
    try {
      return JSON.parse(legacy);
    } catch {
      return null;
    }
  }
  const row = await tx<BackupRecord | undefined>("readonly", (s) => s.get(id));
  return row?.state ?? null;
}

export async function deleteBackup(id: number): Promise<void> {
  if (id === -1) return void localStorage.removeItem(LEGACY_BACKUP_KEY);
  await tx("readwrite", (s) => s.delete(id));
}

/** Moves the old single localStorage backup into IndexedDB, freeing localStorage space. */
export async function migrateLegacyBackup(parse: (raw: unknown) => CompanyState | null): Promise<void> {
  const legacy = readLegacy();
  if (!legacy || typeof indexedDB === "undefined") return;
  let state: CompanyState | null = null;
  try {
    state = parse(JSON.parse(legacy));
  } catch {
    /* unreadable — leave it where it is */
  }
  if (!state) return;
  try {
    await tx("readwrite", (s) => s.add({ at: new Date().toISOString(), reason: "legacy", bytes: legacy.length, state: state! } satisfies BackupRecord));
    localStorage.removeItem(LEGACY_BACKUP_KEY);
  } catch {
    /* keep the legacy copy */
  }
}

function readLegacy(): string | null {
  try {
    return localStorage.getItem(LEGACY_BACKUP_KEY);
  } catch {
    return null;
  }
}
