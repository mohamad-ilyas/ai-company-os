import { describe, expect, it } from "vitest";
import { createSeed } from "@/data/seed";
import { EMPLOYEES, WORKFORCE_VERSION } from "@/data/workforce";
import { decideApproval, postMessage, createApproval, type Ctx } from "@/lib/domain";
import { applyAgentReport } from "@/lib/execution/apply-report";
import { parseAgentReport } from "@/lib/execution/report-schema";
import { migrateState } from "@/lib/migrate";
import { parseCompanyState } from "@/lib/state-schema";
import type { CompanyState } from "@/lib/types";

const NOW = "2026-11-02T10:00:00.000Z";
const coo: Ctx = { actor: "EMP-001", role: "operator", now: NOW };
const ceo: Ctx = { actor: "ceo", role: "ceo", now: NOW };

function report(actions: unknown[]) {
  const p = parseAgentReport({ schema: "aicos.report/v1", reportId: `gov-${Math.random().toString(36).slice(2, 10)}`, sentAt: NOW, source: "claude_code_web", actions });
  if (!p.ok) throw new Error(p.issues.join("; "));
  return p.report;
}

describe("chain of command", () => {
  it("everyone except the COO reports to another employee; only the COO reports to the CEO", () => {
    const toCeo = EMPLOYEES.filter((e) => e.reportsTo === "ceo").map((e) => e.id);
    expect(toCeo).toEqual(["EMP-001"]);
    const content = EMPLOYEES.find((e) => e.id === "EMP-014")!;
    const architect = EMPLOYEES.find((e) => e.id === "EMP-015")!;
    expect(content.departmentId).toBe("design");
    expect(architect.reportsTo).toBe("EMP-001");
    expect(EMPLOYEES.find((e) => e.id === "EMP-005")!.reportsTo).toBe("EMP-015");
    expect(EMPLOYEES.every((e) => (e.learning?.resources.length ?? 0) >= 4)).toBe(true);
    expect(architect.learning!.resources.length).toBeGreaterThanOrEqual(20);
  });

  it("the COO decides delivery approvals but not CEO-level ones; the CEO can decide both", () => {
    let s = createSeed();
    let deploy: string, spend: string;
    [s, deploy] = createApproval(s, ceo, { action: "production_deployment", title: "Deploy", requestedBy: "EMP-006", reason: "r", impact: "", risk: "high", supportingFiles: [], projectId: null, taskId: null });
    [s, spend] = createApproval(s, ceo, { action: "spending", title: "Buy", requestedBy: "EMP-001", reason: "r", impact: "", risk: "critical", supportingFiles: [], projectId: null, taskId: null });
    s = decideApproval(s, coo, deploy, "approved", "QA + review Go");
    expect(s.approvals.find((a) => a.id === deploy)).toMatchObject({ status: "approved", decidedBy: "EMP-001" });
    expect(() => decideApproval(s, coo, spend, "approved", "")).toThrow(/permission_denied/);
    expect(() => decideApproval(s, { ...coo, actor: "EMP-006" }, spend, "approved", "")).toThrow(/permission_denied/);
    s = decideApproval(s, ceo, spend, "rejected", "Not now");
    expect(s.approvals.find((a) => a.id === spend)).toMatchObject({ status: "rejected", decidedBy: "ceo" });
  });

  it("only the COO and the CEO write in the direct line", () => {
    const s = createSeed();
    expect(() => postMessage(s, { ...coo, actor: "EMP-003" }, { kind: "direct", refId: null, body: "hi", authorId: "EMP-003" })).toThrow(/permission_denied/);
    expect(postMessage(s, coo, { kind: "direct", refId: null, body: "Delivered", authorId: "EMP-001" }).messages.at(-1)!.kind).toBe("direct");
  });

  it("reports: the COO decides releases and files urgent CEO decisions; others can't escalate to the CEO", () => {
    let s = createSeed();
    const out = applyAgentReport(s, NOW, report([
      { type: "project.upsert", key: "gov-app", name: "Gov app", client: "Internal" },
      { type: "task.upsert", key: "gov-app/release", projectKey: "gov-app", title: "Release", assigneeId: "EMP-003", protectedAction: "production_deployment" },
      { type: "work.record", employeeId: "EMP-003", taskKey: "gov-app/release", title: "Release", instructions: "prepare", status: "completed", review: { reviewerId: "EMP-013", decision: "approved" } },
      { type: "approval.decide", by: "EMP-001", taskKey: "gov-app/release", decision: "approved", note: "Go from Eleanor; tests green" },
      { type: "approval.request", key: "gov-app/store-fee", urgent: true, action: "spending", title: "Google Play fee $25", requestedBy: "EMP-001", reason: "Needed to publish", impact: "$25 once" },
      { type: "approval.request", action: "spending", title: "Sneaky", requestedBy: "EMP-007", reason: "x" },
      { type: "approval.decide", by: "EMP-001", approvalKey: "gov-app/store-fee", decision: "approved", note: "" },
      { type: "message.post", kind: "direct", authorId: "EMP-001", body: "Gov app is live: https://example.org" },
    ]));
    s = out.state;
    expect(s.tasks.find((t) => t.extKey === "gov-app/release")!.status).toBe("completed");
    const fee = s.approvals.find((a) => a.extKey === "gov-app/store-fee")!;
    expect(fee).toMatchObject({ status: "pending", urgent: true });
    expect(s.approvals.some((a) => a.title === "Sneaky")).toBe(false);
    expect(out.warnings.join(" ")).toMatch(/escalate_via_coo/);
    expect(out.warnings.join(" ")).toMatch(/permission_denied/);
    expect(s.messages.at(-1)).toMatchObject({ kind: "direct", authorId: "EMP-001" });
    expect(parseCompanyState(s).ok).toBe(true);
  });

  it("learning notes and playbooks arrive through knowledge.upsert and update in place", () => {
    let s = createSeed();
    const note = { type: "knowledge.upsert", key: "learning/frontend-engineer/2026-11", title: "What's new — frontend, Nov 2026", category: "learning", body: "## React\n- …", tags: ["frontend-engineer"], authorId: "EMP-008" };
    s = applyAgentReport(s, NOW, report([note])).state;
    s = applyAgentReport(s, NOW, report([{ ...note, body: "## React\n- updated" }])).state;
    const notes = s.knowledge.filter((k) => k.extKey === "learning/frontend-engineer/2026-11");
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ category: "learning", authorId: "EMP-008", body: "## React\n- updated" });
  });
});

describe("upgrading a saved company", () => {
  function oldCompany(): CompanyState {
    const s = createSeed();
    // Simulate a company saved before the reorganisation.
    return {
      ...s,
      workforceVersion: undefined,
      employees: s.employees
        .filter((e) => e.id !== "EMP-014" && e.id !== "EMP-015")
        .map((e) => ({ ...e, reportsTo: e.id === "EMP-013" ? "ceo" : e.reportsTo, learning: undefined })),
      knowledge: s.knowledge.filter((k) => !["KB-019", "KB-020"].includes(k.id)),
      counters: { ...s.counters, KB: 18 },
    };
  }

  it("adds the new employees, reporting lines, learning plans and articles", () => {
    const { state, changed } = migrateState(oldCompany(), NOW);
    expect(changed).toBe(true);
    expect(state.workforceVersion).toBe(WORKFORCE_VERSION);
    expect(state.employees).toHaveLength(15);
    expect(state.employees.find((e) => e.id === "EMP-013")!.reportsTo).toBe("EMP-001");
    expect(state.employees.every((e) => e.learning)).toBe(true);
    expect(state.knowledge.some((k) => k.id === "KB-019")).toBe(true);
    expect(state.activity[0].key).toBe("workforce_updated");
    expect(parseCompanyState(state).ok).toBe(true);
    expect(migrateState(state, NOW).changed).toBe(false);
  });

  it("keeps the CEO's edits: instructions, availability, and their own articles", () => {
    const old = oldCompany();
    old.employees = old.employees.map((e) => (e.id === "EMP-008" ? { ...e, systemInstructions: "My custom brief", availability: "busy" as const } : e));
    old.activity = [{ id: "ACT-99999", at: NOW, actor: "ceo", type: "config", key: "instructions_changed", params: { employee: "EMP-008" }, refType: "employee", refId: "EMP-008" }, ...old.activity];
    old.knowledge = [...old.knowledge, { id: "KB-019", title: "My own article", category: "sop", body: "mine", tags: [], authorId: "ceo", updatedAt: NOW }];
    const { state } = migrateState(old, NOW);
    const emily = state.employees.find((e) => e.id === "EMP-008")!;
    expect(emily.systemInstructions).toBe("My custom brief");
    expect(emily.availability).toBe("busy");
    expect(state.knowledge.find((k) => k.id === "KB-019")!.title).toBe("My own article");
    expect(state.knowledge.some((k) => k.title.startsWith("Learning programme"))).toBe(true);
    expect(new Set(state.knowledge.map((k) => k.id)).size).toBe(state.knowledge.length);
  });
});
