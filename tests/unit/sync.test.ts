// Cloud sync (src/lib/cloud/sync.ts) against a fake Supabase client: the decisions are
// tested in reconcile.test.ts; this covers what sync.ts does with them — backups, conflicts,
// invalid cloud copies, races, offline, report ingestion and the outcomes recorded for it.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSeed } from "@/data/seed";
import type { CompanyState } from "@/lib/types";

const UID = "11111111-1111-1111-1111-111111111111";
const META = "aicos:cloud:meta";
const OUTCOMES = "aicos:cloud:outcomes";

// ---------------------------------------------------------------- fake Supabase

interface Report {
  id: number;
  payload: Record<string, unknown>;
  claimed_at: string | null;
  outcome: string | null;
  outcome_detail: string | null;
}

const server = {
  v5: true,
  row: null as { state: unknown; revision: number } | null,
  reports: [] as Report[],
  saves: [] as { base: number; outcomes: unknown }[],
  /** Runs inside the next save, before it is checked (e.g. another device saves first). */
  beforeSave: null as null | (() => void),
  offline: false,
};

type Result = { data: unknown; error: { code?: string; message: string } | null; count?: number };

function query(table: string) {
  const filters: [string, string, unknown][] = [];
  let op: "select" | "update" = "select";
  let patch: Record<string, unknown> = {};
  let head = false;
  const run = (): Result => {
    if (server.offline) throw new TypeError("fetch failed");
    if (table === "company_state") return { data: server.row ? { ...server.row } : null, error: null };
    let rows = server.reports.filter((r) =>
      filters.every(([kind, col, v]) => {
        const value = r[col as keyof Report];
        if (kind === "eq") return value === v;
        if (kind === "is") return value === v;
        if (kind === "lt") return value !== null && String(value) < String(v);
        return true;
      }),
    );
    if (op === "update") {
      rows.forEach((r) => Object.assign(r, patch));
      rows = [];
    }
    return { data: head ? null : rows, error: null, count: rows.length };
  };
  const builder = {
    select: (_cols?: string, opts?: { head?: boolean }) => ((head = !!opts?.head), builder),
    update: (p: Record<string, unknown>) => ((op = "update"), (patch = p), builder),
    eq: (c: string, v: unknown) => (filters.push(["eq", c, v]), builder),
    is: (c: string, v: unknown) => (filters.push(["is", c, v]), builder),
    lt: (c: string, v: unknown) => (filters.push(["lt", c, v]), builder),
    order: () => builder,
    limit: () => builder,
    maybeSingle: async () => run(),
    then: (ok: (r: Result) => unknown, fail?: (e: unknown) => unknown) => {
      try {
        return Promise.resolve(run()).then(ok, fail);
      } catch (e) {
        return Promise.reject(e).then(ok, fail);
      }
    },
  };
  return builder;
}

async function rpc(name: string, args: Record<string, unknown> = {}): Promise<Result> {
  if (server.offline) throw new TypeError("fetch failed");
  const missing = { data: null, error: { code: "PGRST202", message: `Could not find the function public.${name}` } };
  if (name === "save_company_state") {
    if (!server.v5 && "p_outcomes" in args) return missing;
    server.beforeSave?.();
    server.beforeSave = null;
    const base = Number(args.p_base_revision);
    const current = server.row?.revision ?? 0;
    if ((base === 0 && server.row) || (base !== 0 && base !== current)) return { data: null, error: { code: "40001", message: "revision conflict" } };
    server.row = { state: structuredClone(args.p_state), revision: current + 1 };
    server.saves.push({ base, outcomes: args.p_outcomes });
    for (const o of (args.p_outcomes ?? []) as { id: number; outcome: string; detail: string }[]) {
      const r = server.reports.find((x) => x.id === o.id && x.outcome === null);
      if (r) Object.assign(r, { outcome: o.outcome, outcome_detail: o.detail });
    }
    return { data: server.row.revision, error: null };
  }
  if (name === "claim_agent_reports") {
    if (!server.v5 && "p_limit" in args) return missing;
    const now = new Date().toISOString();
    const rows = server.reports.filter((r) => r.outcome === null && r.claimed_at === null);
    rows.forEach((r) => (r.claimed_at = now));
    return { data: rows.map((r) => ({ ...r })), error: null };
  }
  return { data: null, error: { message: `unexpected rpc ${name}` } };
}

let authCallback: ((event: string, session: unknown) => void) | null = null;
/** The fake Realtime channel: the test pushes signal changes through `live.emit`. */
const live = {
  handler: null as null | ((payload: unknown) => void),
  filter: "",
  subscribed: false,
  emit(payload: unknown) {
    this.handler?.(payload);
  },
};
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: query,
    rpc,
    channel: () => {
      const ch = {
        on: (_type: string, opts: { filter: string }, cb: (payload: unknown) => void) => {
          live.filter = opts.filter;
          live.handler = cb;
          return ch;
        },
        subscribe: (cb: (status: string) => void) => {
          live.subscribed = true;
          cb("SUBSCRIBED");
          return ch;
        },
      };
      return ch;
    },
    removeChannel: async () => {
      live.subscribed = false;
      live.handler = null;
    },
    auth: {
      onAuthStateChange: (cb: (event: string, session: unknown) => void) => {
        authCallback = cb;
        return { data: { subscription: { unsubscribe() {} } } };
      },
      signOut: async () => ({ error: null }),
    },
  }),
}));

// ---------------------------------------------------------------- browser stubs + fake store bridge

function stubBrowser() {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
  });
  vi.stubGlobal("navigator", { onLine: true });
  vi.stubGlobal("document", { visibilityState: "visible", addEventListener() {} });
  vi.stubGlobal("window", { addEventListener() {}, location: { origin: "http://localhost" } });
}

function makeBridge(initial: CompanyState) {
  const listeners = new Set<() => void>();
  const b = {
    state: initial,
    applied: [] as CompanyState[],
    backups: [] as { state: CompanyState; reason: string }[],
    notes: [] as string[],
    reportsSeen: [] as unknown[],
    backupOk: true,
    uploadOk: true,
    /** What applyReport does: change the company (default) or not, or throw. */
    reportBehaviour: "change" as "change" | "no_change" | "throw",
    setLocal(next: CompanyState) {
      b.state = next;
      listeners.forEach((l) => l());
    },
    bridge: {
      get: () => b.state,
      applyRemote: (s: CompanyState) => {
        b.state = s;
        b.applied.push(s);
      },
      backup: async (s: CompanyState, reason: string) => {
        if (b.backupOk) b.backups.push({ state: s, reason });
        return b.backupOk;
      },
      canUpload: () => b.uploadOk,
      onLocalChange: (fn: () => void) => (listeners.add(fn), () => listeners.delete(fn)),
      notify: (kind: string) => b.notes.push(kind),
      applyReport: (payload: unknown) => {
        b.reportsSeen.push(payload);
        if (b.reportBehaviour === "throw") throw new Error("boom");
        if (b.reportBehaviour === "no_change") return { outcome: "applied" as const, detail: "already", changed: false };
        b.setLocal({ ...b.state, revision: b.state.revision + 1 });
        return { outcome: "applied" as const, detail: "1 of 1 actions applied", changed: true };
      },
    },
  };
  return b;
}

const meta = () => JSON.parse(localStorage.getItem(META) ?? "null");
const setMeta = (m: object) => localStorage.setItem(META, JSON.stringify(m));
const report = (id: number): Report => ({ id, payload: { reportId: `r-${id}` }, claimed_at: null, outcome: null, outcome_detail: null });

async function start(initial: CompanyState = createSeed()) {
  const sync = await import("@/lib/cloud/sync");
  const status = await import("@/lib/cloud/status");
  const b = makeBridge(initial);
  sync.startCloud(b.bridge as never);
  authCallback!("SIGNED_IN", { user: { id: UID, email: "ceo@example.com" } });
  await sync.syncNow();
  return { sync, status, b };
}

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ["setTimeout", "setInterval", "clearTimeout"] });
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_KEY", "sb_publishable_test");
  stubBrowser();
  Object.assign(server, { v5: true, row: null, reports: [], saves: [], beforeSave: null, offline: false });
  Object.assign(live, { handler: null, filter: "", subscribed: false });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

// ---------------------------------------------------------------- tests

describe("cloud sync", () => {
  it("seeds an empty cloud from this device", async () => {
    const { status } = await start();
    expect(server.saves).toEqual([{ base: 0, outcomes: [] }]);
    expect(meta()).toMatchObject({ owner: UID, base: 1, dirty: false });
    expect(status.getCloudInfo().status).toBe("synced");
  });

  it("first sign-in on a device: downloads the cloud copy and backs up the local one", async () => {
    const cloud = { ...createSeed(), revision: 50 };
    server.row = { state: cloud, revision: 7 };
    const { b } = await start();
    expect(b.backups.map((x) => x.reason)).toEqual(["pull"]);
    expect(b.applied).toHaveLength(1);
    expect(meta()).toMatchObject({ owner: UID, base: 7, dirty: false });
  });

  it("conflict: keeps the local copy as a backup, applies the cloud copy, and says so", async () => {
    server.row = { state: createSeed(), revision: 2 };
    setMeta({ owner: UID, base: 1, dirty: true });
    const local = { ...createSeed(), revision: 99 };
    const { b } = await start(local);
    expect(b.backups).toEqual([{ state: local, reason: "conflict" }]);
    expect(b.applied).toHaveLength(1);
    expect(b.notes).toContain("conflict");
    expect(meta()).toMatchObject({ base: 2, dirty: false });
  });

  it("never replaces local data when no backup can be stored", async () => {
    server.row = { state: createSeed(), revision: 2 };
    setMeta({ owner: UID, base: 1, dirty: true });
    const sync = await import("@/lib/cloud/sync");
    const status = await import("@/lib/cloud/status");
    const b = makeBridge(createSeed());
    b.backupOk = false;
    sync.startCloud(b.bridge as never);
    authCallback!("SIGNED_IN", { user: { id: UID } });
    await sync.syncNow();
    expect(b.applied).toHaveLength(0);
    expect(status.getCloudInfo().status).toBe("error");
    expect(status.getCloudInfo().error).toMatch(/^backup_failed/);
    expect(meta()).toMatchObject({ base: 1, dirty: true });
  });

  it("an unreadable cloud copy is never applied", async () => {
    server.row = { state: { not: "a company" }, revision: 4 };
    const { b, status } = await start();
    expect(b.applied).toHaveLength(0);
    expect(b.notes).toContain("invalid_remote");
    expect(status.getCloudInfo().status).toBe("error");
  });

  it("another device saved first: syncs again and ends with no data lost", async () => {
    server.row = { state: createSeed(), revision: 1 };
    setMeta({ owner: UID, base: 1, dirty: true });
    server.beforeSave = () => {
      server.row = { state: createSeed(), revision: 2 }; // the other device's save
    };
    const local = { ...createSeed(), revision: 42 };
    const { b } = await start(local);
    expect(b.backups.map((x) => x.state)).toContain(local);
    expect(meta()).toMatchObject({ base: 2, dirty: false });
  });

  it("a local change during an upload stays unsaved and is uploaded next", async () => {
    server.row = { state: createSeed(), revision: 1 };
    setMeta({ owner: UID, base: 1, dirty: true });
    const sync = await import("@/lib/cloud/sync");
    const b = makeBridge(createSeed());
    server.beforeSave = () => b.setLocal({ ...b.state, settings: { ...b.state.settings, tagline: "changed mid-upload" } });
    sync.startCloud(b.bridge as never);
    authCallback!("SIGNED_IN", { user: { id: UID } });
    await sync.syncNow();
    expect(server.saves.length).toBe(2); // the second upload carries the change
    expect((server.row!.state as CompanyState).settings.tagline).toBe("changed mid-upload");
    expect(meta()).toMatchObject({ base: 3, dirty: false });
  });

  it("doesn't upload while the browser refuses to save locally", async () => {
    setMeta({ owner: UID, base: 1, dirty: true });
    server.row = { state: createSeed(), revision: 1 };
    const sync = await import("@/lib/cloud/sync");
    const status = await import("@/lib/cloud/status");
    const b = makeBridge(createSeed());
    b.uploadOk = false;
    sync.startCloud(b.bridge as never);
    authCallback!("SIGNED_IN", { user: { id: UID } });
    await sync.syncNow();
    expect(server.saves).toHaveLength(0);
    expect(status.getCloudInfo().error).toMatch(/^storage_full/);
  });

  it("network failure shows offline, not an error", async () => {
    server.offline = true;
    const { status } = await start();
    expect(status.getCloudInfo().status).toBe("offline");
  });

  it("signing out forgets the sync record and pending outcomes", async () => {
    const { sync } = await start();
    localStorage.setItem(OUTCOMES, JSON.stringify([{ id: 1, outcome: "applied", detail: "" }]));
    await sync.signOut();
    expect(meta()).toEqual({ owner: null, base: 0, dirty: false });
    expect(localStorage.getItem(OUTCOMES)).toBeNull();
  });
});

describe("AI team report inbox", () => {
  it("applies reports in the order they were sent and records outcomes with the save that holds their changes", async () => {
    server.row = { state: createSeed(), revision: 1 };
    setMeta({ owner: UID, base: 1, dirty: false });
    server.reports = [report(12), report(10), report(11)];
    const { b } = await start();
    expect(b.reportsSeen.map((p) => (p as { reportId: string }).reportId)).toEqual(["r-10", "r-11", "r-12"]);
    const last = server.saves.at(-1)!;
    expect((last.outcomes as { id: number }[]).map((o) => o.id)).toEqual([10, 11, 12]);
    expect(server.reports.every((r) => r.outcome === "applied")).toBe(true);
    expect(localStorage.getItem(OUTCOMES)).toBeNull();
    expect(meta()).toMatchObject({ dirty: false });
  });

  it("does not apply reports on top of unsaved local changes", async () => {
    server.row = { state: createSeed(), revision: 1 };
    server.reports = [report(1)];
    setMeta({ owner: UID, base: 1, dirty: true });
    server.beforeSave = () => {
      server.row = { state: createSeed(), revision: 2 };
    }; // the push fails → conflict → pull; reports wait for the next sync
    const { b } = await start();
    expect(b.reportsSeen.length).toBeLessThanOrEqual(1);
    // whatever was applied before the conflict was not marked applied without being saved
    for (const r of server.reports) if (r.outcome === "applied") expect(server.saves.some((s) => (s.outcomes as { id: number }[] | undefined)?.some((o) => o.id === r.id))).toBe(true);
  });

  it("a report that fails to apply is recorded as rejected right away (nothing to lose)", async () => {
    server.row = { state: createSeed(), revision: 1 };
    setMeta({ owner: UID, base: 1, dirty: false });
    server.reports = [report(5)];
    const { b } = await start();
    // The first report was applied; the next one throws while being applied.
    server.reports.push(report(6));
    b.reportBehaviour = "throw";
    const sync = await import("@/lib/cloud/sync");
    await sync.syncNow();
    expect(server.reports.find((r) => r.id === 6)).toMatchObject({ outcome: "rejected" });
    expect(server.reports.find((r) => r.id === 6)!.outcome_detail).toMatch(/boom/);
  });

  it("if the save carrying a report's changes is lost, the report stays unrecorded so it is applied again", async () => {
    server.row = { state: createSeed(), revision: 1 };
    setMeta({ owner: UID, base: 1, dirty: false });
    server.reports = [report(20)];
    // The save that would carry the outcome conflicts with another device's save.
    server.beforeSave = () => {
      server.row = { state: createSeed(), revision: 2 };
    };
    await start();
    expect(server.reports[0].outcome).toBeNull();
    expect(localStorage.getItem(OUTCOMES)).toBeNull();
  });

  it("works with a database that doesn't have migration 0005 yet", async () => {
    server.v5 = false;
    server.row = { state: createSeed(), revision: 1 };
    setMeta({ owner: UID, base: 1, dirty: false });
    server.reports = [report(30), { ...report(31), claimed_at: "2000-01-01T00:00:00.000Z" }]; // 31: abandoned claim
    const { b } = await start();
    expect(b.reportsSeen).toHaveLength(2);
    expect(server.reports.every((r) => r.outcome === "applied")).toBe(true);
  });
});

describe("live updates (Realtime signals)", () => {
  it("subscribes to this account's signal and syncs at once when another device saves", async () => {
    server.row = { state: createSeed(), revision: 1 };
    setMeta({ owner: UID, base: 1, dirty: false });
    const { b, status } = await start();
    await vi.advanceTimersByTimeAsync(1);
    expect(live.subscribed).toBe(true);
    expect(live.filter).toBe(`owner=eq.${UID}`);
    expect(status.getCloudInfo().live).toBe(true);
    // Another device saves revision 2.
    server.row = { state: { ...createSeed(), settings: { ...createSeed().settings, tagline: "from the phone" } }, revision: 2 };
    live.emit({ eventType: "UPDATE", new: { state_revision: 2, report_at: null }, old: { state_revision: 1, report_at: null } });
    await vi.advanceTimersByTimeAsync(300);
    expect(b.applied.at(-1)?.settings.tagline).toBe("from the phone");
    expect(meta()).toMatchObject({ base: 2 });
  });

  it("a new team report is applied within a moment of arriving", async () => {
    server.row = { state: createSeed(), revision: 1 };
    setMeta({ owner: UID, base: 1, dirty: false });
    const { b } = await start();
    await vi.advanceTimersByTimeAsync(1);
    server.reports.push(report(77));
    live.emit({ eventType: "UPDATE", new: { state_revision: 1, report_at: "2026-11-04T10:00:00Z" }, old: { state_revision: 1, report_at: null } });
    await vi.advanceTimersByTimeAsync(300);
    expect(b.reportsSeen).toHaveLength(1);
    expect(server.reports[0].outcome).toBe("applied");
  });

  it("its own save echoing back doesn't trigger another sync", async () => {
    server.row = { state: createSeed(), revision: 1 };
    setMeta({ owner: UID, base: 1, dirty: false });
    await start();
    await vi.advanceTimersByTimeAsync(1);
    const reads = server.saves.length;
    live.emit({ eventType: "UPDATE", new: { state_revision: 1, report_at: null }, old: { state_revision: 0, report_at: null } });
    await vi.advanceTimersByTimeAsync(300);
    expect(server.saves.length).toBe(reads);
  });
});
