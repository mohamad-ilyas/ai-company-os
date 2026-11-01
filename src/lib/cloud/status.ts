"use client";

// Lightweight cloud-sync status shared with the UI. No Supabase import here, so
// pages don't pay for the client library unless cloud sync is configured.

import { useSyncExternalStore } from "react";
import type { SyncMeta } from "./reconcile";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_KEY ?? "";
export const cloudConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY);

export type CloudStatus = "disabled" | "signed_out" | "link_sent" | "syncing" | "synced" | "offline" | "error";

export interface CloudInfo {
  status: CloudStatus;
  email: string | null;
  lastSyncedAt: string | null;
  error: string | null;
}

let info: CloudInfo = { status: cloudConfigured ? "signed_out" : "disabled", email: null, lastSyncedAt: null, error: null };
const listeners = new Set<() => void>();

export function setCloudInfo(patch: Partial<CloudInfo>) {
  info = { ...info, ...patch };
  listeners.forEach((l) => l());
}

export function getCloudInfo() {
  return info;
}

export function useCloud(): CloudInfo {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => info,
    () => info,
  );
}

const META_KEY = "aicos:cloud:meta";

export function readMeta(): SyncMeta {
  try {
    const m = JSON.parse(localStorage.getItem(META_KEY) ?? "null");
    if (m && typeof m.base === "number") return { owner: m.owner ?? null, base: m.base, dirty: !!m.dirty };
  } catch {
    /* fall through */
  }
  return { owner: null, base: 0, dirty: false };
}

export function writeMeta(patch: Partial<SyncMeta>) {
  localStorage.setItem(META_KEY, JSON.stringify({ ...readMeta(), ...patch }));
}

/** Loads the Supabase-backed sync module on demand. */
export const loadSync = () => import("./sync");
