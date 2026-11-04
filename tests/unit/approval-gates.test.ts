// The approval gates hold against the AI team channel (independent review by Eleanor Whitfield, EMP-013):
// a CEO-level task or release can't be completed with some other approval, a protected action can't be
// downgraded, an old approval doesn't cover reworked output, and nobody approves their own request.
import { describe, expect, it } from "vitest";
import { createSeed } from "@/data/seed";
import { decideApproval, setProjectStatus, setTaskStatus, updateTask, type Ctx } from "@/lib/domain";
import { applyAgentReport } from "@/lib/execution/apply-report";
import { parseAgentReport } from "@/lib/execution/report-schema";
import { migrateState } from "@/lib/migrate";
import type { CompanyState } from "@/lib/types";
import { WORKFORCE_VERSION } from "@/data/workforce";

const NOW = "2026-11-04T10:00:00.000Z";
const LATER = "2026-11-04T11:00:00.000Z";
const ceo: Ctx = { actor: "ceo", role: "ceo", now: NOW };
let n = 0;
function run(s: CompanyState, actions: unknown[], now = NOW) {
  const p = parseAgentReport({ schema: "aicos.report/v1", reportId: `gate-${String(++n).padStart(6, "0")}`, sentAt: now, source: "claude_code", actions });
  if (!p.ok) throw new Error(p.issues.join("; "));
  return applyAgentReport(s, now, p.report);
}
const task = (s: CompanyState, key: string) => s.tasks.find((t) => t.extKey === key)!;
const project = (s: CompanyState, key: string) => s.projects.find((p) => p.extKey === key)!;

/** A task protected by `action`, built and reviewed, now awaiting its approval. */
function awaiting(action: string, key = "gp/t") {
  const out = run(createSeed(), [
    { type: "project.upsert", key: "gp", name: "G", client: "Client" },
    { type: "task.upsert", key, projectKey: "gp", title: "Protected", assigneeId: "EMP-003", protectedAction: action },
    { type: "work.record", employeeId: "EMP-003", taskKey: key, title: "Work", instructions: "x", status: "completed", review: { reviewerId: "EMP-013", decision: "approved" } },
  ]);
  expect(task(out.state, key).status).toBe("awaiting_ceo_approval");
  return out.state;
}

describe("approval gates", () => {
  it("A: a CEO-level task is not completed by a different, COO-level approval linked to it", () => {
    let s = awaiting("client_proposal");
    s = run(s, [
      { type: "approval.request", key: "gp/side", action: "irreversible_change", title: "side door", requestedBy: "EMP-003", reason: "x", taskKey: "gp/t" },
      { type: "approval.decide", by: "EMP-001", approvalKey: "gp/side", decision: "approved", note: "evidence" },
    ]).state;
    expect(s.approvals.find((a) => a.extKey === "gp/side")!.status).toBe("approved"); // decided…
    expect(task(s, "gp/t").status).toBe("awaiting_ceo_approval"); // …but the task still waits for the CEO
    expect(() => setTaskStatus(s, { actor: "EMP-003", role: "operator", now: NOW }, task(s, "gp/t").id, "completed")).toThrow();
  });

  it("B: a CEO-level release is not moved on (or delivered) by a different approval on the project", () => {
    let s = run(createSeed(), [
      { type: "project.upsert", key: "pb", name: "PB", client: "Client", status: "review" },
      // CEO-level requests come from the COO (only she addresses the CEO).
      { type: "approval.request", action: "client_proposal", title: "Deliver to client", requestedBy: "EMP-001", reason: "x", projectKey: "pb" },
    ]).state;
    expect(project(s, "pb").status).toBe("awaiting_ceo_approval");
    s = run(s, [
      { type: "approval.request", key: "pb/side", action: "public_release", title: "side door", requestedBy: "EMP-003", reason: "x", projectKey: "pb" },
      { type: "approval.decide", by: "EMP-001", approvalKey: "pb/side", decision: "approved", note: "evidence" },
    ]).state;
    expect(project(s, "pb").status).toBe("awaiting_ceo_approval");
    // The CEO's decision on the release request itself is what moves it.
    const release = s.approvals.find((a) => a.id === project(s, "pb").releaseApprovalId)!;
    expect(release.action).toBe("client_proposal");
    s = decideApproval(s, ceo, release.id, "approved", "");
    expect(project(s, "pb").status).toBe("ready_for_delivery");
    s = setProjectStatus(s, ceo, project(s, "pb").id, "delivered");
    expect(project(s, "pb").status).toBe("delivered");
  });

  it("C: reports can't downgrade (or remove) a task's protected action; the CEO can", () => {
    let s = awaiting("contractual_commitment");
    const out = run(s, [{ type: "task.upsert", key: "gp/t", projectKey: "gp", title: "Protected", protectedAction: "production_deployment" }]);
    expect(out.warnings.join(" ")).toMatch(/permission_denied/);
    expect(task(out.state, "gp/t").protectedAction).toBe("contractual_commitment");
    s = updateTask(s, ceo, task(s, "gp/t").id, { protectedAction: "production_deployment" });
    expect(task(s, "gp/t").protectedAction).toBe("production_deployment");
  });

  it("D: an approval doesn't cover output reworked after it was given", () => {
    let s = awaiting("production_deployment");
    s = run(s, [{ type: "approval.decide", by: "EMP-001", taskKey: "gp/t", decision: "approved", note: "CI green, review Go" }]).state;
    expect(task(s, "gp/t").status).toBe("completed");
    const op: Ctx = { actor: "EMP-003", role: "operator", now: LATER };
    s = setTaskStatus(s, op, task(s, "gp/t").id, "changes_requested", "rework");
    s = setTaskStatus(s, op, task(s, "gp/t").id, "in_progress");
    s = setTaskStatus(s, op, task(s, "gp/t").id, "under_review");
    expect(() => setTaskStatus(s, op, task(s, "gp/t").id, "completed")).toThrow(/approval_required/);
    s = setTaskStatus(s, op, task(s, "gp/t").id, "awaiting_ceo_approval");
    expect(s.approvals.filter((a) => a.taskId === task(s, "gp/t").id && a.status === "pending")).toHaveLength(1); // a fresh request
  });

  it("E: nobody but the CEO decides their own request, and the COO always gives a reason", () => {
    let s = awaiting("production_deployment");
    const own = run(s, [
      { type: "approval.request", key: "gp/own", action: "production_database_change", title: "Migrate", requestedBy: "EMP-001", reason: "x", projectKey: "gp" },
      { type: "approval.decide", by: "EMP-001", approvalKey: "gp/own", decision: "approved", note: "fine" },
    ]);
    expect(own.warnings.join(" ")).toMatch(/self_approval/);
    const noNote = run(s, [{ type: "approval.decide", by: "EMP-001", taskKey: "gp/t", decision: "approved", note: "" }]);
    expect(noNote.warnings.join(" ")).toMatch(/required/);
    s = run(s, [{ type: "approval.decide", by: "EMP-001", taskKey: "gp/t", decision: "approved", note: "CI run 123 green" }]).state;
    expect(task(s, "gp/t").status).toBe("completed"); // the legitimate path still works
  });

  it("the COO still can't decide CEO-level approvals", () => {
    const s = awaiting("spending");
    const out = run(s, [{ type: "approval.decide", by: "EMP-001", taskKey: "gp/t", decision: "approved", note: "x" }]);
    expect(out.warnings.join(" ")).toMatch(/permission_denied/);
    expect(task(out.state, "gp/t").status).toBe("awaiting_ceo_approval");
  });

  it("R-2: after a CEO-level release, a reworked project can't be re-released at COO level", () => {
    let s = run(createSeed(), [
      { type: "project.upsert", key: "rr", name: "RR", client: "Client", status: "review" },
      { type: "approval.request", action: "client_proposal", title: "Release", requestedBy: "EMP-001", reason: "x", projectKey: "rr" },
    ]).state;
    s = decideApproval(s, ceo, project(s, "rr").releaseApprovalId!, "approved", "");
    s = run(s, [{ type: "project.upsert", key: "rr", name: "RR", client: "Client", status: "development" }]).state;
    s = run(s, [{ type: "project.upsert", key: "rr", name: "RR", client: "Client", status: "review" }]).state;
    const out = run(s, [{ type: "approval.request", key: "rr/rel2", action: "public_release", title: "Release again", requestedBy: "EMP-003", reason: "x", projectKey: "rr" }]);
    expect(out.warnings.join(" ")).toMatch(/release_needs_ceo/);
    expect(project(out.state, "rr").status).not.toBe("awaiting_ceo_approval");
  });

  it("R-2: a project isn't delivered while one of its protected tasks is open", () => {
    let s = run(createSeed(), [
      { type: "project.upsert", key: "dl", name: "DL", client: "Client", status: "review" },
      { type: "task.upsert", key: "dl/proposal", projectKey: "dl", title: "Proposal", assigneeId: "EMP-003", protectedAction: "client_proposal" },
      { type: "approval.request", action: "public_release", title: "Release", requestedBy: "EMP-003", reason: "x", projectKey: "dl" },
    ]).state;
    s = decideApproval(s, { actor: "EMP-001", role: "operator", now: NOW }, project(s, "dl").releaseApprovalId!, "approved", "CI green");
    expect(project(s, "dl").status).toBe("ready_for_delivery");
    expect(() => setProjectStatus(s, ceo, project(s, "dl").id, "delivered")).toThrow(/protected_tasks_open/);
  });

  it("R-3: an approval decided before the work went to review doesn't cover it", () => {
    let s = run(createSeed(), [
      { type: "project.upsert", key: "pre", name: "Pre", client: "Client" },
      { type: "task.upsert", key: "pre/t", projectKey: "pre", title: "Deploy", assigneeId: "EMP-003", protectedAction: "production_deployment" },
      { type: "approval.request", key: "pre/early", action: "production_deployment", title: "Early", requestedBy: "EMP-003", reason: "x", taskKey: "pre/t" },
      { type: "approval.decide", by: "EMP-001", approvalKey: "pre/early", decision: "approved", note: "x" },
    ]).state;
    const op = (now: string): Ctx => ({ actor: "EMP-003", role: "operator", now });
    s = setTaskStatus(s, op(LATER), task(s, "pre/t").id, "in_progress");
    s = setTaskStatus(s, op(LATER), task(s, "pre/t").id, "under_review");
    expect(() => setTaskStatus(s, op(LATER), task(s, "pre/t").id, "completed")).toThrow(/approval_required/);
  });

  it("reports can update records the CEO created in the dashboard, by their ids", () => {
    let s = createSeed();
    const t0 = s.tasks.find((t) => t.status === "assigned" && !t.protectedAction && !t.sample)!;
    const before = s.tasks.length;
    s = run(s, [
      { type: "task.status", taskKey: t0.id.toLowerCase(), status: "in_progress", by: t0.assigneeId },
      { type: "message.post", kind: "project", projectKey: t0.projectId.toLowerCase(), authorId: "EMP-003", body: "Started" },
    ]).state;
    expect(s.tasks).toHaveLength(before);
    expect(s.tasks.find((t) => t.id === t0.id)!.status).toBe("in_progress");
    const out = run(s, [{ type: "task.upsert", key: "tsk-9999", projectKey: "prj-001", title: "Ghost" }]);
    expect(out.warnings.join(" ")).toMatch(/not_found/);
    expect(out.state.tasks).toHaveLength(before);
  });

  it("upgrading links projects already waiting on a release to their request", () => {
    let s = run(createSeed(), [
      { type: "project.upsert", key: "old", name: "Old", client: "Client", status: "review" },
      { type: "approval.request", action: "public_release", title: "Release", requestedBy: "EMP-003", reason: "x", projectKey: "old" },
    ]).state;
    const id = project(s, "old").releaseApprovalId!;
    s = { ...s, workforceVersion: WORKFORCE_VERSION - 1, projects: s.projects.map((p) => ({ ...p, releaseApprovalId: undefined })) };
    s = migrateState(s, NOW).state;
    expect(project(s, "old").releaseApprovalId).toBe(id);
  });
});
