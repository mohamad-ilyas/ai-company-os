"use client";

// Client-side company store. The whole company state lives in localStorage
// (zero cost, works on a static host). All writes go through domain.ts.
// To add cloud persistence later, replace load()/persist() with an adapter —
// pages only use useCompany() and useRun().

import { useCallback, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { createSeed } from "@/data/seed";
import { DomainError, log, type Ctx } from "./domain";
import { parseCompanyState, parseOrRepairCompanyState } from "./state-schema";
import { parseAgentReport } from "./execution/report-schema";
import { applyAgentReport } from "./execution/apply-report";
import { formatDate, formatDateTime, makeT, pick, type Translate } from "./i18n";
import type { ActorId, CompanyState, EmployeeId, L10n, Locale } from "./types";
import { useToast } from "@/components/ui/toast";
import { cloudConfigured, loadSync, writeMeta } from "./cloud/status";
import { migrateState } from "./migrate";
import { LEGACY_BACKUP_KEY, migrateLegacyBackup, readBackup, saveBackup, type BackupReason } from "./backups";

export const STORAGE_KEY = "aicos:state:v1";
export const BACKUP_KEY = LEGACY_BACKUP_KEY;
export const CORRUPT_KEY = "aicos:state:corrupt";
export const PREFS_KEY = "aicos:prefs";
export const LAST_EXPORT_KEY = "aicos:lastExport";

type Listener = () => void;
let current: CompanyState | null = null;
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(l: Listener) {
  listeners.add(l);
  return () => listeners.delete(l);
}

function applyPrefs(s: CompanyState) {
  const root = document.documentElement;
  const locale = s.settings.locale;
  root.lang = locale;
  root.dir = locale === "ar" ? "rtl" : "ltr";
  const dark = s.settings.theme === "dark" || (s.settings.theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  root.classList.toggle("dark", dark);
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ locale, theme: s.settings.theme }));
  } catch {
    /* prefs are a convenience; ignore */
  }
}

type LoadProblem = "corrupt" | "repaired" | "unavailable" | null;
type LoadResult = { state: CompanyState; problem: LoadProblem };

function load(): LoadResult {
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    // Storage blocked (private mode, browser setting): work in memory and say so.
    return { state: createSeed(), problem: "unavailable" };
  }
  if (!raw) return { state: createSeed(), problem: null };
  try {
    const parsed = parseOrRepairCompanyState(JSON.parse(raw));
    if (parsed.ok) return { state: parsed.state, problem: parsed.repaired.length ? "repaired" : null };
  } catch {
    /* fall through */
  }
  try {
    localStorage.setItem(CORRUPT_KEY, raw);
  } catch {
    /* nothing more we can do */
  }
  // The starting data shown now must never be uploaded over the cloud copy: forget the
  // last sync, so the next sync downloads the cloud copy instead.
  if (cloudConfigured) safeWriteMeta({ owner: null, base: 0, dirty: false });
  return { state: createSeed(), problem: "corrupt" };
}

function safeWriteMeta(patch: Parameters<typeof writeMeta>[0]) {
  try {
    writeMeta(patch);
  } catch {
    /* storage unavailable */
  }
}

/** False after the browser refused to store the data: nothing is uploaded until a save succeeds again. */
let persistOk = true;

/** Returns false if the browser refused to store the data (quota). */
function persist(s: CompanyState): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    persistOk = true;
  } catch {
    persistOk = false;
  }
  return persistOk;
}

/** The first problem that would stop this state from loading again, or null. */
export function stateProblem(s: CompanyState): string | null {
  const parsed = parseCompanyState(s);
  return parsed.ok ? null : parsed.issues[0];
}

const changeListeners = new Set<() => void>();

/** `fromCloud` marks state that came from cloud sync, so it isn't uploaded straight back. */
export function setState(next: CompanyState, fromCloud = false): boolean {
  current = next;
  const ok = persist(next);
  applyPrefs(next);
  emit();
  if (!fromCloud) changeListeners.forEach((l) => l());
  return ok;
}

/** Language, theme, and session role belong to the device, not the company. */
function keepDevicePrefs(remote: CompanyState): CompanyState {
  if (!current) return remote;
  const { locale, theme, role } = current.settings;
  return { ...remote, settings: { ...remote.settings, locale, theme, role } };
}

/**
 * Replace all data (import / reset). The previous data is kept as a restorable backup first;
 * if no backup can be stored, nothing is replaced.
 */
export async function replaceState(next: CompanyState, activityKey: "data_imported" | "data_reset"): Promise<boolean> {
  if (current && !(await saveBackup(activityKey === "data_reset" ? "reset" : "import", current))) return false;
  const ctx: Ctx = { actor: "ceo", role: next.settings.role, now: new Date().toISOString() };
  return setState(log(migrateState(next, ctx.now).state, ctx, "data", activityKey, {}));
}

/** Restores one backup (see backups.ts); the data it replaces is backed up too. */
export async function restoreBackup(id: number): Promise<"restored" | "invalid" | "failed"> {
  const raw = await readBackup(id);
  const parsed = raw ? parseOrRepairCompanyState(raw) : null;
  if (!parsed?.ok) return "invalid";
  if (current && !(await saveBackup("import", current))) return "failed";
  return setState(migrateState(keepDevicePrefs(parsed.state), new Date().toISOString()).state) ? "restored" : "failed";
}

export interface ReportResult {
  outcome: "applied" | "partial" | "rejected";
  /** Technical detail, stored with the report in the cloud inbox. */
  detail: string;
  applied: number;
  total: number;
  /** Every action had already been applied by an earlier delivery. */
  duplicate: boolean;
  problems: string[];
  /** The company changed (and must be saved before the outcome is final). */
  changed: boolean;
}

/** Validates and applies an AI team report to the current state (also used by manual import). */
export function applyReportToStore(payload: unknown): ReportResult {
  const parsed = parseAgentReport(payload);
  if (!parsed.ok) return { outcome: "rejected", detail: parsed.issues.join("; "), applied: 0, total: 0, duplicate: false, problems: parsed.issues, changed: false };
  const total = parsed.report.actions.length + parsed.skipped.length;
  const r = applyAgentReport(current!, new Date().toISOString(), parsed.report);
  // Re-delivery, recovered claims, two open tabs: actions already applied are never run twice.
  if (r.applied === 0 && r.complete && r.alreadyApplied > 0) {
    return { outcome: "applied", detail: "Already applied earlier; skipped to avoid duplicates.", applied: 0, total, duplicate: true, problems: [], changed: false };
  }
  const problems = [...parsed.skipped.map((x) => `skipped ${x}`), ...r.warnings];
  const done = r.applied + r.alreadyApplied;
  const changed = r.applied > 0;
  if (changed && !setState(r.state)) {
    return { outcome: "rejected", detail: "The browser refused to save (storage full).", applied: 0, total, duplicate: false, problems: ["storage full"], changed: false };
  }
  const detail = [`${done} of ${total} actions applied`, ...problems].join("; ");
  return { outcome: problems.length === 0 ? "applied" : done > 0 ? "partial" : "rejected", detail, applied: done, total, duplicate: false, problems, changed };
}

/** The localized one-line summary of a report result, for toasts. */
export function describeReportResult(t: Translate, r: ReportResult): string {
  if (r.duplicate) return t("agent.duplicate");
  const head = t("agent.appliedCount", { applied: String(r.applied), total: String(r.total) });
  return r.problems.length ? `${head} ${t("agent.problemsCount", { count: String(r.problems.length) })}` : head;
}

let loadProblem: LoadProblem = null;

/** Loads lazily on the first client read; the server snapshot is null so prerendered HTML shows the fallback. */
function getClientSnapshot(): CompanyState | null {
  if (!current) {
    const { state, problem } = load();
    const migrated = migrateState(state, new Date().toISOString());
    current = migrated.state;
    loadProblem = problem;
    if ((migrated.changed || problem === "repaired") && problem !== "corrupt" && problem !== "unavailable") {
      persist(current);
      // Make sure the upgraded company is uploaded to the cloud on the next sync.
      if (cloudConfigured) safeWriteMeta({ dirty: true });
    }
    applyPrefs(current);
  }
  return current;
}

const getServerSnapshot = () => null;

export function StoreProvider({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  const state = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
  const toast = useToast();

  useEffect(() => {
    if (!cloudConfigured) return;
    void loadSync().then(({ startCloud }) =>
      startCloud({
        get: () => current!,
        applyRemote: (remote) => {
          // A copy saved by an older dashboard is upgraded here, then uploaded again.
          const migrated = migrateState(remote, new Date().toISOString());
          setState(keepDevicePrefs(migrated.state), !migrated.changed);
        },
        backup: (local, reason: BackupReason) => saveBackup(reason, local),
        canUpload: () => persistOk,
        onLocalChange: (fn) => {
          changeListeners.add(fn);
          return () => changeListeners.delete(fn);
        },
        applyReport: (payload) => {
          const result = applyReportToStore(payload);
          const t = makeT(current!.settings.locale);
          const text = t("agent.received", { detail: describeReportResult(t, result) });
          if (result.outcome === "rejected") toast.error(text);
          else if (!result.duplicate) toast.success(text);
          return result;
        },
        notify: (kind) => {
          const t = makeT(current!.settings.locale);
          if (kind === "conflict") toast.error(t("cloud.conflict"));
          else if (kind === "invalid_remote") toast.error(t("cloud.invalidRemote"));
          else toast.success(t("cloud.pulled"));
        },
      }),
    );
  }, [toast]);

  useEffect(() => {
    if (loadProblem && current) {
      const t = makeT(current.settings.locale);
      if (loadProblem === "corrupt") toast.error(t("app.storageError"));
      else if (loadProblem === "unavailable") toast.error(t("app.storageUnavailable"));
      else toast.success(t("app.storageRepaired"));
      loadProblem = null;
    }
    void migrateLegacyBackup((raw) => {
      const p = parseOrRepairCompanyState(raw);
      return p.ok ? p.state : null;
    });
    // Keep tabs in sync and follow OS theme changes.
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return;
      let parsed: ReturnType<typeof parseCompanyState>;
      try {
        parsed = parseCompanyState(JSON.parse(e.newValue));
      } catch {
        return; // another tab wrote something unreadable: keep what this tab has
      }
      if (parsed.ok) {
        current = parsed.state;
        applyPrefs(parsed.state);
        emit();
      }
    };
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const onScheme = () => current && applyPrefs(current);
    window.addEventListener("storage", onStorage);
    mq.addEventListener("change", onScheme);
    return () => {
      window.removeEventListener("storage", onStorage);
      mq.removeEventListener("change", onScheme);
    };
  }, [toast]);

  if (!state) return <>{fallback}</>;
  return <>{children}</>;
}

export function useCompany(): CompanyState {
  const s = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
  if (!s) throw new Error("useCompany used outside a ready StoreProvider");
  return s;
}

export interface I18n {
  t: Translate;
  locale: Locale;
  dir: "rtl" | "ltr";
  l: (v: L10n) => string;
  date: (iso: string | null | undefined) => string;
  dateTime: (iso: string | null | undefined) => string;
  actorName: (id: ActorId | null | undefined) => string;
}

export function useI18n(): I18n {
  const s = useCompany();
  const locale = s.settings.locale;
  return useMemo(() => {
    const t = makeT(locale);
    return {
      t,
      locale,
      dir: locale === "ar" ? "rtl" : "ltr",
      l: (v: L10n) => pick(v, locale),
      date: (iso) => formatDate(iso, locale),
      dateTime: (iso) => formatDateTime(iso, locale),
      actorName: (id) => {
        if (!id) return t("common.unassigned");
        if (id === "ceo") return s.settings.founderName || t("common.ceo");
        if (id === "system") return t("common.system");
        const e = s.employees.find((x) => x.id === (id as EmployeeId));
        return e ? pick(e.name, locale) : id;
      },
    };
  }, [locale, s.settings.founderName, s.employees]);
}

/**
 * Runs a domain operation with the current session context. Domain errors are shown as a
 * localized toast and return undefined; on success the new state is persisted.
 */
export function useRun() {
  const toast = useToast();
  return useCallback(
    <T,>(op: (s: CompanyState, ctx: Ctx) => CompanyState | [CompanyState, T], successMessage?: string): { ok: boolean; value?: T } => {
      const s = current!;
      const t = makeT(s.settings.locale);
      const ctx: Ctx = { actor: "ceo", role: s.settings.role, now: new Date().toISOString() };
      try {
        const out = op(s, ctx);
        const [next, value] = Array.isArray(out) ? out : [out, undefined];
        if (next === s) return { ok: true, value };
        // Never save something the loader would reject (e.g. a field over its length limit).
        const problem = stateProblem(next);
        if (problem) throw new DomainError("invalid_data", { detail: problem });
        if (!setState(next)) toast.error(t("app.storageFull"));
        else if (successMessage) toast.success(successMessage);
        return { ok: true, value };
      } catch (err) {
        if (err instanceof DomainError) {
          const params = { ...err.params };
          // Status keys in error params are shown in the user's language.
          for (const k of ["from", "to"] as const) {
            if (params[k]) {
              const raw = params[k];
              const label = ["taskStatus", "projectStatus", "executionStatus"]
                .map((ns) => t(`${ns}.${raw}` as never))
                .find((x) => !x.includes("."));
              params[k] = label ?? raw;
            }
          }
          toast.error(t(`errors.${err.code}` as never, params));
        } else {
          toast.error(t("errors.unexpected", { message: err instanceof Error ? err.message : String(err) }));
        }
        return { ok: false };
      }
    },
    [toast],
  );
}

export function useCan() {
  const s = useCompany();
  return s.settings.role;
}
