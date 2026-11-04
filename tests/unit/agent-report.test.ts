import { describe, expect, it } from "vitest";
import { createSeed } from "@/data/seed";
import { applyAgentReport } from "@/lib/execution/apply-report";
import { parseAgentReport, type AgentReport } from "@/lib/execution/report-schema";
import { decideApproval } from "@/lib/domain";
import { parseCompanyState } from "@/lib/state-schema";

const NOW = "2026-11-03T10:00:00.000Z";

let reportNo = 0;
/** Each call is a different report (its own reportId), as the team sends them. */
function report(actions: unknown[], reportId = `rpt-${String(++reportNo).padStart(8, "0")}`): AgentReport {
  const parsed = parseAgentReport({ schema: "aicos.report/v1", reportId, sentAt: NOW, source: "claude_code_web", actions });
  if (!parsed.ok) throw new Error(parsed.issues.join("\n"));
  return parsed.report;
}

const lifecycle = report([
  { type: "project.upsert", key: "cedar-app", name: "Cedar ordering app", client: "Cedar & Co.", priority: "high", managerId: "EMP-003", repoUrl: "https://github.com/mohamad-ilyas/agency-projects/tree/main/projects/cedar-app" },
  { type: "task.upsert", key: "cedar-app/requirements", projectKey: "cedar-app", title: "Requirements", assigneeId: "EMP-002", stage: "client_request" },
  { type: "task.upsert", key: "cedar-app/build", projectKey: "cedar-app", title: "Build the app", assigneeId: "EMP-007", dependsOn: ["cedar-app/requirements"], stage: "development" },
  { type: "task.upsert", key: "cedar-app/release", projectKey: "cedar-app", title: "Publish to Play Store", assigneeId: "EMP-003", dependsOn: ["cedar-app/build"], protectedAction: "public_release" },
  {
    type: "work.record", employeeId: "EMP-002", taskKey: "cedar-app/requirements", title: "Requirements", instructions: "Write requirements",
    status: "completed", startedAt: "2026-11-03T09:00:00Z", endedAt: "2026-11-03T09:30:00Z", summary: "6 stories", output: "## FR-1 …",
    deliverables: [{ title: "Requirements", type: "requirements", location: "projects/cedar-app/docs/requirements.md" }],
    review: { reviewerId: "EMP-003", decision: "approved", notes: "Clear and testable" },
  },
  { type: "message.post", kind: "project", projectKey: "cedar-app", authorId: "EMP-003", body: "Requirements approved; Thomas starts the build." },
]);

describe("agent reports", () => {
  it("creates the project, tasks, work, review, and messages, attributed to employees", () => {
    const { state, applied, warnings } = applyAgentReport(createSeed(), NOW, lifecycle);
    expect(warnings).toEqual([]);
    expect(applied).toBe(6);
    const p = state.projects.find((x) => x.extKey === "cedar-app")!;
    expect(p.repoUrl).toContain("agency-projects");
    const req = state.tasks.find((t) => t.extKey === "cedar-app/requirements")!;
    const build = state.tasks.find((t) => t.extKey === "cedar-app/build")!;
    expect(req.status).toBe("completed");
    // The dependent task became ready once its input was completed and reviewed.
    expect(build.status).toBe("assigned");
    const exe = state.executions.find((e) => e.taskId === req.id)!;
    expect(exe.reviewStatus).toBe("approved");
    expect(exe.startedAt).toBe("2026-11-03T09:00:00Z");
    expect(state.deliverables.some((d) => d.executionId === exe.id && d.status === "approved")).toBe(true);
    expect(state.messages.at(-1)!.authorId).toBe("EMP-003");
    expect(state.activity.some((a) => a.actor === "EMP-003" && a.key === "execution_approved")).toBe(true);
    expect(state.activity[0].key).toBe("agent_report_applied");
    expect(parseCompanyState(state).ok).toBe(true);
  });

  it("is idempotent for upserts: a second report updates instead of duplicating", () => {
    const first = applyAgentReport(createSeed(), NOW, lifecycle).state;
    const second = applyAgentReport(first, NOW, report([
      { type: "project.upsert", key: "cedar-app", name: "Cedar ordering app v2", client: "Cedar & Co.", status: "development" },
      { type: "task.status", taskKey: "cedar-app/build", status: "in_progress", by: "EMP-007" },
    ]));
    expect(second.warnings).toEqual([]);
    expect(second.state.projects.filter((p) => p.extKey === "cedar-app")).toHaveLength(1);
    expect(second.state.projects.find((p) => p.extKey === "cedar-app")!.status).toBe("development");
    expect(second.state.tasks.find((t) => t.extKey === "cedar-app/build")!.status).toBe("in_progress");
  });

  it("cannot complete a protected task: it goes to the CEO, who decides", () => {
    let s = applyAgentReport(createSeed(), NOW, lifecycle).state;
    s = applyAgentReport(s, NOW, report([
      { type: "work.record", employeeId: "EMP-007", taskKey: "cedar-app/build", title: "Build", instructions: "Build", status: "completed", review: { reviewerId: "EMP-006", decision: "approved" } },
      { type: "work.record", employeeId: "EMP-003", taskKey: "cedar-app/release", title: "Release", instructions: "Prepare release", status: "completed", review: { reviewerId: "EMP-013", decision: "approved" } },
      { type: "task.status", taskKey: "cedar-app/release", status: "completed", by: "EMP-003" },
    ])).state;
    const release = s.tasks.find((t) => t.extKey === "cedar-app/release")!;
    expect(release.status).toBe("awaiting_ceo_approval");
    const approval = s.approvals.find((a) => a.taskId === release.id && a.status === "pending")!;
    expect(approval.action).toBe("public_release");
    // Only the CEO's decision completes it.
    s = decideApproval(s, { actor: "ceo", role: "ceo", now: NOW }, approval.id, "approved", "Go");
    expect(s.tasks.find((t) => t.id === release.id)!.status).toBe("completed");
  });

  it("rejects self-review and skips failing actions without corrupting state", () => {
    const { state, warnings, applied } = applyAgentReport(createSeed(), NOW, report([
      { type: "project.upsert", key: "x-app", name: "X", client: "Y" },
      { type: "task.upsert", key: "x-app/a", projectKey: "x-app", title: "A", assigneeId: "EMP-008" },
      { type: "work.record", employeeId: "EMP-008", taskKey: "x-app/a", title: "A", instructions: "do", status: "completed", review: { reviewerId: "EMP-008", decision: "approved" } },
      { type: "task.upsert", key: "x-app/b", projectKey: "missing-project", title: "B" },
      { type: "task.status", taskKey: "x-app/a", status: "completed", by: "EMP-008" },
    ]));
    expect(applied).toBe(4);
    expect(warnings).toHaveLength(2);
    expect(warnings.join(" ")).toMatch(/self-review/);
    expect(warnings.join(" ")).toMatch(/not_found.*missing-project/);
    expect(state.tasks.find((t) => t.extKey === "x-app/a")!.status).toBe("completed");
    expect(parseCompanyState(state).ok).toBe(true);
  });

  it("validates the report shape and refuses unsafe actions", () => {
    expect(parseAgentReport({ schema: "aicos.report/v1", reportId: "r1", sentAt: NOW, source: "claude_code", actions: [] }).ok).toBe(false);
    const sneaky = parseAgentReport({ schema: "aicos.report/v1", reportId: "rpt-12345678", sentAt: NOW, source: "claude_code", actions: [{ type: "task.status", taskKey: "a/b", status: "awaiting_ceo_approval", by: "EMP-001" }] });
    expect(sneaky.ok).toBe(false);
    const decide = parseAgentReport({ schema: "aicos.report/v1", reportId: "rpt-12345678", sentAt: NOW, source: "claude_code", actions: [{ type: "approval.decide", id: "APR-001" }] });
    expect(decide.ok).toBe(false);
  });
});
