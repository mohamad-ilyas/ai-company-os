"use client";

// Cloud sync with Supabase (free tier). The browser keeps working offline from
// localStorage; this module mirrors the state to one private row per user and
// pulls changes made on other devices. Loaded only when cloud sync is configured.

import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import { parseCompanyState } from "../state-schema";
import type { CompanyState } from "../types";
import { decide } from "./reconcile";
import { SUPABASE_KEY, SUPABASE_URL, readMeta, setCloudInfo, writeMeta } from "./status";

export interface StoreBridge {
  get: () => CompanyState;
  /** Replace local state with a validated cloud copy (must not trigger an upload). */
  applyRemote: (s: CompanyState) => void;
  /** Keep a restorable copy of local state before it is replaced; false if none could be stored. */
  backup: (s: CompanyState, reason: "conflict" | "pull") => Promise<boolean>;
  /** False while the browser refuses to save locally: uploading memory-only data could later be undone. */
  canUpload: () => boolean;
  onLocalChange: (fn: () => void) => () => void;
  notify: (kind: "conflict" | "pulled" | "invalid_remote") => void;
  /** Validate and apply one AI team report; returns the outcome to record in the inbox. */
  applyReport: (payload: unknown) => ReportOutcome;
}

export interface ReportOutcome {
  outcome: "applied" | "partial" | "rejected";
  detail: string;
  /** The company changed: the outcome is recorded together with the next save, never before it. */
  changed: boolean;
}

interface PendingOutcome {
  id: number;
  outcome: ReportOutcome["outcome"];
  detail: string;
}

export interface InboxReport {
  id: number;
  received_at: string;
  claimed_at: string | null;
  outcome: ReportOutcome["outcome"] | null;
  outcome_detail: string | null;
  payload: { summary?: string; source?: string; actions?: unknown[] } & Record<string, unknown>;
}

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const POLL_MS = 60_000;
const OUTCOMES_KEY = "aicos:cloud:outcomes";
const CLAIM_LIMIT = 20;
const PUSH_DELAY_MS = 800;

let client: SupabaseClient | null = null;
let bridge: StoreBridge | null = null;
let session: Session | null = null;
let busy = false;
let again = false;
let pushTimer: ReturnType<typeof setTimeout> | undefined;
/** The database has migration 0005 (outcomes saved with the state, server-side claims). Detected on first use. */
let serverV5: boolean | null = null;

function db() {
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_KEY, {
      // PKCE: sign-in tokens never travel in the URL; the link must be opened in the browser that asked for it.
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce", storageKey: "aicos:auth" },
    });
  }
  return client;
}

function describe(err: unknown): { offline: boolean; message: string } {
  const message = err instanceof Error ? err.message : typeof err === "object" && err && "message" in err ? String((err as { message: unknown }).message) : String(err);
  const offline = !navigator.onLine || /fetch|network|timeout|503|502|504/i.test(message);
  return { offline, message };
}

function readOutcomes(): PendingOutcome[] {
  try {
    const v = JSON.parse(localStorage.getItem(OUTCOMES_KEY) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function writeOutcomes(list: PendingOutcome[]) {
  if (list.length) localStorage.setItem(OUTCOMES_KEY, JSON.stringify(list));
  else localStorage.removeItem(OUTCOMES_KEY);
}

/** The function is missing on the server (an older database without migration 0005). */
const missingFunction = (e: { code?: string; message?: string }) => e.code === "PGRST202" || /could not find the function/i.test(e.message ?? "");

/** Bring this device and the cloud into agreement. Serialized: one run at a time, in one tab at a time. */
async function reconcile(): Promise<void> {
  if (!session || !bridge) return;
  if (busy) {
    again = true;
    return;
  }
  // Tabs share the sync record; only one may sync at once, or they race and report false conflicts.
  if (typeof navigator !== "undefined" && navigator.locks) {
    busy = true;
    let ran = false;
    await navigator.locks.request("aicos-sync", { ifAvailable: true }, async (lock) => {
      if (!lock) return;
      ran = true;
      busy = false;
      await reconcileLocked();
    });
    if (!ran) {
      busy = false;
      // Another tab is syncing; it uploads this tab's changes too (they share storage). Check again shortly.
      clearTimeout(pushTimer);
      pushTimer = setTimeout(() => void reconcile(), 3000);
    }
    return;
  }
  await reconcileLocked();
}

async function reconcileLocked(): Promise<void> {
  busy = true;
  try {
    // A run can call for another (a newer cloud copy, changes made meanwhile, report outcomes to save).
    for (let round = 0; round < 5; round++) {
      again = false;
      await syncOnce();
      if (!again) break;
    }
  } finally {
    busy = false;
    if (again) {
      again = false;
      schedulePush();
    }
  }
}

async function syncOnce(): Promise<void> {
  if (!session || !bridge) return;
  setCloudInfo({ status: "syncing", error: null });
  try {
    const uid = session.user.id;
    const { data: remote, error } = await db().from("company_state").select("state, revision").maybeSingle();
    if (error) throw error;
    const meta = readMeta();
    const decision = decide(meta, uid, remote ? Number(remote.revision) : null);

    if (decision.kind === "push") {
      if (!bridge.canUpload()) throw new Error("storage_full: this browser refused to save the latest changes, so they were not uploaded");
      await push(uid, decision.base);
    } else if (decision.kind === "none" && readOutcomes().length > 0 && bridge.canUpload()) {
      // Outcomes of applied reports are waiting for a save (e.g. the tab closed before it): save now.
      await push(uid, meta.base);
    } else if (decision.kind === "pull" || decision.kind === "conflict") {
      const parsed = parseCompanyState(remote!.state);
      if (!parsed.ok) {
        // Never replace good local data with something unreadable.
        bridge.notify("invalid_remote");
        throw new Error(`invalid_remote: ${parsed.issues[0]}`);
      }
      if ((decision.kind === "conflict" || decision.backupLocal) && !(await bridge.backup(bridge.get(), decision.kind === "conflict" ? "conflict" : "pull"))) {
        throw new Error("backup_failed: could not keep a copy of this device's data, so the cloud copy was not applied");
      }
      bridge.applyRemote(parsed.state);
      writeMeta({ owner: uid, base: Number(remote!.revision), dirty: false });
      // Reports applied to the discarded local copy were lost with it: they stay unrecorded and are claimed again.
      writeOutcomes([]);
      bridge.notify(decision.kind === "conflict" ? "conflict" : "pulled");
    }
    if (!again) await ingestReports();
    setCloudInfo({ status: "synced", lastSyncedAt: new Date().toISOString(), error: null });
  } catch (err) {
    const { offline, message } = describe(err);
    setCloudInfo({ status: offline ? "offline" : "error", error: message });
    again = false;
  }
}

async function push(uid: string, base: number) {
  const state = bridge!.get();
  const outcomes = readOutcomes();
  let { data, error } = await db().rpc("save_company_state", serverV5 === false ? { p_state: state, p_base_revision: base } : { p_state: state, p_base_revision: base, p_outcomes: outcomes });
  if (error && serverV5 !== false && missingFunction(error)) {
    serverV5 = false;
    ({ data, error } = await db().rpc("save_company_state", { p_state: state, p_base_revision: base }));
    if (!error) await recordOutcomesDirectly(outcomes);
  } else if (!error && serverV5 !== false) {
    serverV5 = true;
  } else if (!error) {
    await recordOutcomesDirectly(outcomes);
  }
  if (error) {
    if (error.code === "40001" || /revision conflict/i.test(error.message)) {
      // Another device saved first. Re-run: the decision will now see the newer cloud copy.
      writeMeta({ owner: uid });
      again = true;
      return;
    }
    throw error;
  }
  // The outcomes were saved with the state; drop exactly those (more may have arrived meanwhile).
  const sent = new Set(outcomes.map((o) => o.id));
  writeOutcomes(readOutcomes().filter((o) => !sent.has(o.id)));
  // Only clear "dirty" if nothing changed locally while the upload was in flight (imports keep the revision number, so compare identity).
  const changedSince = bridge!.get() !== state;
  writeMeta({ owner: uid, base: Number(data), dirty: changedSince });
  if (changedSince) again = true;
}

/** Older database: record outcomes after the save succeeded (still never before it). */
async function recordOutcomesDirectly(outcomes: PendingOutcome[]) {
  for (const o of outcomes) {
    const { error } = await db().from("agent_reports").update({ outcome: o.outcome, outcome_detail: o.detail }).eq("id", o.id);
    if (error) console.warn(`Could not record the outcome of report ${o.id}: ${error.message}`);
  }
}

async function claimReports(): Promise<InboxReport[]> {
  if (serverV5 !== false) {
    // Migration 0005: the server reclaims abandoned claims after 10 minutes, by its own clock, and limits the batch.
    const { data, error } = await db().rpc("claim_agent_reports", { p_limit: CLAIM_LIMIT });
    if (!error) return (data ?? []) as InboxReport[];
    if (!missingFunction(error)) throw error;
    serverV5 = false;
  }
  // Older database: recover claims a closed tab never finished, then claim everything new.
  const stale = new Date(Date.now() - 5 * 60_000).toISOString();
  await db().from("agent_reports").update({ claimed_at: null }).is("outcome", null).lt("claimed_at", stale);
  const { data, error } = await db().rpc("claim_agent_reports");
  if (error) throw error;
  return (data ?? []) as InboxReport[];
}

/** Claim new AI team reports (atomically, so two devices never apply the same one) and apply them. */
async function ingestReports() {
  if (!bridge || readMeta().dirty || readOutcomes().length > 0) return; // apply only on top of a fully saved state
  const rows = (await claimReports()).sort((a, b) => a.id - b.id); // apply in the order they were sent
  const pending: PendingOutcome[] = [];
  for (const row of rows) {
    let result: ReportOutcome;
    try {
      result = bridge.applyReport(row.payload);
    } catch (err) {
      result = { outcome: "rejected", detail: `Dashboard error while applying: ${err instanceof Error ? err.message : String(err)}`, changed: false };
    }
    const outcome: PendingOutcome = { id: row.id, outcome: result.outcome, detail: result.detail.slice(0, 4000) };
    if (result.changed) {
      // Recorded with the save that contains the report's changes: if that save is lost, so is the outcome,
      // and the report is claimed and applied again.
      pending.push(outcome);
      writeOutcomes([...readOutcomes(), outcome]);
    } else {
      await recordOutcomesDirectly([outcome]); // nothing changed, so nothing can be lost
    }
  }
  if (pending.length) {
    writeMeta({ dirty: true });
    again = true;
  }
}

function schedulePush() {
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => void reconcile(), PUSH_DELAY_MS);
}

/** Cheap check for changes made on another device. */
async function checkRemote() {
  if (!session || busy) return;
  const meta = readMeta();
  if (meta.dirty || meta.owner !== session.user.id) return void reconcile();
  const { data, error } = await db().from("company_state").select("revision").maybeSingle();
  if (error) {
    const { offline, message } = describe(error);
    setCloudInfo({ status: offline ? "offline" : "error", error: message });
    return;
  }
  if (!data || Number(data.revision) !== meta.base) return void reconcile();
  const pending = await db().from("agent_reports").select("id", { count: "exact", head: true }).is("claimed_at", null);
  if ((pending.count ?? 0) > 0) return void reconcile();
  setCloudInfo({ status: "synced", lastSyncedAt: new Date().toISOString(), error: null });
}

let started = false;

export function startCloud(b: StoreBridge) {
  if (started) return;
  started = true;
  bridge = b;

  b.onLocalChange(() => {
    writeMeta({ dirty: true });
    if (session) schedulePush();
  });

  db().auth.onAuthStateChange((_event, s) => {
    session = s;
    if (s) {
      setCloudInfo({ email: s.user.email ?? null });
      // Supabase advises against awaiting its own calls inside this callback.
      setTimeout(() => void reconcile(), 0);
    } else {
      setCloudInfo({ status: "signed_out", email: null });
    }
  });

  document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && void checkRemote());
  window.addEventListener("online", () => void reconcile());
  setInterval(() => document.visibilityState === "visible" && void checkRemote(), POLL_MS);
}

export async function sendSignInLink(email: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await db().auth.signInWithOtp({
    email: email.trim(),
    options: { emailRedirectTo: `${window.location.origin}${BASE_PATH}/settings/`, shouldCreateUser: false },
  });
  if (error) return { ok: false, error: error.message };
  setCloudInfo({ status: "link_sent" });
  return { ok: true };
}

const redirectTo = () => `${window.location.origin}${BASE_PATH}/settings/`;

/** Sign in with GitHub — no email, no rate limit. Works once GitHub is linked to the account. */
export async function signInWithGitHub(): Promise<{ ok: boolean; error?: string }> {
  const { error } = await db().auth.signInWithOAuth({ provider: "github", options: { redirectTo: redirectTo() } });
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** Adds GitHub as a second way into the signed-in account (needed because public sign-ups are off). */
export async function linkGitHub(): Promise<{ ok: boolean; error?: string }> {
  const { error } = await db().auth.linkIdentity({ provider: "github", options: { redirectTo: redirectTo() } });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function hasGitHubIdentity(): Promise<boolean> {
  const { data } = await db().auth.getUserIdentities();
  return !!data?.identities.some((i) => i.provider === "github");
}

export async function syncNow() {
  await reconcile();
}

export async function signOut() {
  await db().auth.signOut();
  writeMeta({ owner: null, base: 0, dirty: false });
  writeOutcomes([]);
}

// ---------------------------------------------------------------- agent key & inbox (CEO only)

export async function getAgentKeyInfo(): Promise<{ hint: string; createdAt: string } | null> {
  const { data, error } = await db().from("agent_keys").select("key_hint, created_at").maybeSingle();
  if (error) throw error;
  return data ? { hint: data.key_hint as string, createdAt: data.created_at as string } : null;
}

/** Creates or replaces the agent key. The plaintext key is returned once and never stored by the app. */
export async function createAgentKey(): Promise<string> {
  const { data, error } = await db().rpc("create_agent_key");
  if (error) throw error;
  return data as string;
}

export async function revokeAgentKey(): Promise<void> {
  const { error } = await db().rpc("revoke_agent_key");
  if (error) throw error;
}

export async function listReports(limit = 20): Promise<InboxReport[]> {
  const { data, error } = await db()
    .from("agent_reports")
    .select("id, received_at, claimed_at, outcome, outcome_detail, payload")
    .order("id", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as InboxReport[];
}

/** Applies a report again (e.g. after a sync conflict discarded it). Actions already applied are skipped. */
export async function reapplyReport(row: InboxReport): Promise<ReportOutcome> {
  const result = bridge!.applyReport(row.payload);
  const outcome: PendingOutcome = { id: row.id, outcome: result.outcome, detail: result.detail.slice(0, 4000) };
  if (result.changed) {
    writeOutcomes([...readOutcomes(), outcome]);
    void reconcile();
  } else {
    await recordOutcomesDirectly([outcome]);
  }
  return result;
}
