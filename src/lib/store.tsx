"use client";

// Client-side company store. The whole company state lives in localStorage
// (zero cost, works on a static host). All writes go through domain.ts.
// To add cloud persistence later, replace load()/persist() with an adapter —
// pages only use useCompany() and useRun().

import { useCallback, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { createSeed } from "@/data/seed";
import { DomainError, log, type Ctx } from "./domain";
import { parseCompanyState } from "./state-schema";
import { parseAgentReport } from "./execution/report-schema";
import { applyAgentReport } from "./execution/apply-report";
import { formatDate, formatDateTime, makeT, pick, type Translate } from "./i18n";
import type { ActorId, CompanyState, EmployeeId, L10n, Locale } from "./types";
import { useToast } from "@/components/ui/toast";
import { cloudConfigured, loadSync } from "./cloud/status";

export const STORAGE_KEY = "aicos:state:v1";
export const BACKUP_KEY = "aicos:state:backup";
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

type LoadResult = { state: CompanyState; recovered: boolean };

function load(): LoadResult {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return { state: createSeed(), recovered: false };
  try {
    const parsed = parseCompanyState(JSON.parse(raw));
    if (parsed.ok) return { state: parsed.state, recovered: false };
  } catch {
    /* fall through */
  }
  localStorage.setItem(CORRUPT_KEY, raw);
  return { state: createSeed(), recovered: true };
}

/** Returns false if the browser refused to store the data (quota). */
function persist(s: CompanyState): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    return true;
  } catch {
    return false;
  }
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

/** Replace all data (import / reset), keeping the previous data as a one-step backup. */
export function replaceState(next: CompanyState, activityKey: "data_imported" | "data_reset"): boolean {
  if (current) {
    try {
      localStorage.setItem(BACKUP_KEY, JSON.stringify(current));
    } catch {
      /* backup is best effort */
    }
  }
  const ctx: Ctx = { actor: "ceo", role: next.settings.role, now: new Date().toISOString() };
  return setState(log(next, ctx, "data", activityKey, {}));
}

export function restoreBackup(): boolean {
  const raw = localStorage.getItem(BACKUP_KEY);
  if (!raw) return false;
  const parsed = parseCompanyState(JSON.parse(raw));
  if (!parsed.ok) return false;
  localStorage.removeItem(BACKUP_KEY);
  return setState(parsed.state);
}

/** Validates and applies an AI team report to the current state (also used by manual import). */
export function applyReportToStore(payload: unknown): { outcome: "applied" | "partial" | "rejected"; detail: string } {
  const parsed = parseAgentReport(payload);
  if (!parsed.ok) return { outcome: "rejected", detail: parsed.issues.join("; ") };
  const { state, applied, warnings } = applyAgentReport(current!, new Date().toISOString(), parsed.report);
  setState(state);
  const total = parsed.report.actions.length + parsed.skipped.length;
  const problems = [...parsed.skipped.map((x) => `skipped ${x}`), ...warnings];
  const detail = [`${applied} of ${total} actions applied`, ...problems].join("; ");
  return { outcome: problems.length === 0 ? "applied" : applied > 0 ? "partial" : "rejected", detail };
}

let recoveredOnLoad = false;

/** Loads lazily on the first client read; the server snapshot is null so prerendered HTML shows the fallback. */
function getClientSnapshot(): CompanyState | null {
  if (!current) {
    const { state, recovered } = load();
    current = state;
    recoveredOnLoad = recovered;
    applyPrefs(state);
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
        applyRemote: (remote) => setState(keepDevicePrefs(remote), true),
        backup: (local) => {
          try {
            localStorage.setItem(BACKUP_KEY, JSON.stringify(local));
          } catch {
            /* best effort */
          }
        },
        onLocalChange: (fn) => {
          changeListeners.add(fn);
          return () => changeListeners.delete(fn);
        },
        applyReport: (payload) => {
          const result = applyReportToStore(payload);
          const t = makeT(current!.settings.locale);
          if (result.outcome === "rejected") toast.error(t("agent.received", { detail: result.detail }));
          else toast.success(t("agent.received", { detail: result.detail }));
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
    if (recoveredOnLoad && current) {
      recoveredOnLoad = false;
      toast.error(makeT(current.settings.locale)("app.storageError"));
    }
    // Keep tabs in sync and follow OS theme changes.
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return;
      const parsed = parseCompanyState(JSON.parse(e.newValue));
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
