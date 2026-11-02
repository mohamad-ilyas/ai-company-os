import { describe, expect, it } from "vitest";
import { createSeed } from "@/data/seed";
import * as d from "@/lib/domain";
import { parseExecutionResult } from "@/lib/execution/result-schema";
import { buildChatPrompt, buildPacket } from "@/lib/execution/packet";
import { parseCompanyState } from "@/lib/state-schema";
import { employeeWorkState, qualityStats } from "@/lib/metrics";
import type { CompanyState } from "@/lib/types";

const ceo: d.Ctx = { actor: "ceo", role: "ceo", now: "2026-11-02T10:00:00.000Z" };
const viewer: d.Ctx = { ...ceo, role: "viewer" };
const operator: d.Ctx = { ...ceo, role: "operator" };

function newProject(s: CompanyState) {
  return d.createProject(s, ceo, {
    name: "Test project",
    client: "Acme",
    description: "",
    businessRequirements: "",
    technicalRequirements: "",
    scope: "",
    budget: null,
    priority: "high",
    startDate: "2026-11-02",
    targetDate: "2026-12-01",
    managerId: "EMP-003",
    memberIds: [],
    dependencies: [],
  });
}

describe("seed", () => {
  it("has 15 distinct employees with distinct instructions and valid reporting lines", () => {
    const s = createSeed();
    expect(s.employees).toHaveLength(15);
    expect(new Set(s.employees.map((e) => e.id)).size).toBe(15);
    expect(new Set(s.employees.map((e) => e.systemInstructions)).size).toBe(15);
    for (const e of s.employees) {
      expect(e.reportsTo === "ceo" || s.employees.some((x) => x.id === e.reportsTo)).toBe(true);
      e.collaborators.forEach((c) => expect(s.employees.some((x) => x.id === c)).toBe(true));
      expect(e.systemInstructions).toContain(`You are ${e.name.en}`);
    }
  });

  it("validates against the import schema", () => {
    const r = parseCompanyState(createSeed());
    if (!r.ok) console.error(r.issues);
    expect(r.ok).toBe(true);
  });

  it("returns an independent copy each time", () => {
    const a = createSeed();
    a.employees[0].availability = "unavailable";
    expect(createSeed().employees[0].availability).toBe("available");
  });
});

describe("permissions", () => {
  it("viewers cannot write; operators cannot decide approvals", () => {
    const s = createSeed();
    expect(() => newProject({ ...s }).length).not.toThrow();
    expect(() =>
      d.createProject(s, viewer, { ...({} as d.ProjectInput), name: "x", client: "y", memberIds: [], managerId: "EMP-003" } as d.ProjectInput),
    ).toThrow(/permission_denied/);
    expect(() => d.decideApproval(s, operator, "APR-001", "approved", "")).toThrow(/permission_denied/);
  });
});

describe("projects", () => {
  it("creates with sequential ids and logs activity", () => {
    const [s, id] = newProject(createSeed());
    expect(id).toBe("PRJ-003");
    expect(s.activity[0].key).toBe("project_created");
  });

  it("rejects target date before start date", () => {
    const s = createSeed();
    expect(() =>
      d.createProject(s, ceo, {
        name: "x", client: "y", description: "", businessRequirements: "", technicalRequirements: "", scope: "",
        budget: null, priority: "low", startDate: "2026-12-01", targetDate: "2026-11-01", managerId: "EMP-003", memberIds: [], dependencies: [],
      }),
    ).toThrow(/dates_order/);
  });

  it("cannot be delivered without an approved release approval", () => {
    let [s, id] = newProject(createSeed());
    s = d.setProjectStatus(s, ceo, id, "design");
    s = d.setProjectStatus(s, ceo, id, "development");
    s = d.setProjectStatus(s, ceo, id, "testing");
    s = d.setProjectStatus(s, ceo, id, "review");
    expect(() => d.setProjectStatus(s, ceo, id, "awaiting_ceo_approval")).toThrow(/invalid_transition/);
    s = d.requestProjectRelease(s, ceo, id, { action: "production_deployment", reason: "v1 ready", impact: "public" });
    const apr = s.approvals.find((a) => a.projectId === id)!;
    expect(apr.status).toBe("pending");
    s = d.decideApproval(s, ceo, apr.id, "approved", "ok");
    expect(s.projects.find((p) => p.id === id)!.status).toBe("ready_for_delivery");
    s = d.setProjectStatus(s, ceo, id, "delivered");
    expect(s.projects.find((p) => p.id === id)!.status).toBe("delivered");
  });

  it("rejected release returns the project to review", () => {
    let [s, id] = newProject(createSeed());
    for (const st of ["design", "development", "testing", "review"] as const) s = d.setProjectStatus(s, ceo, id, st);
    s = d.requestProjectRelease(s, ceo, id, { action: "public_release", reason: "r", impact: "i" });
    const apr = s.approvals.find((a) => a.projectId === id)!;
    expect(() => d.decideApproval(s, ceo, apr.id, "rejected", "")).toThrow(/required/);
    s = d.decideApproval(s, ceo, apr.id, "rejected", "Not yet");
    expect(s.projects.find((p) => p.id === id)!.status).toBe("review");
  });
});

describe("standard workflow", () => {
  it("creates lifecycle tasks with dependencies; only the first is assigned", () => {
    let [s, id] = newProject(createSeed());
    s = d.startStandardWorkflow(s, ceo, id);
    const tasks = s.tasks.filter((t) => t.projectId === id);
    expect(tasks.length).toBe(13);
    expect(tasks.filter((t) => t.status === "assigned").map((t) => t.stage)).toEqual(["client_request"]);
    expect(() => d.startStandardWorkflow(s, ceo, id)).toThrow(/workflow_exists/);
  });

  it("enforces dependencies and unblocks dependents on completion", () => {
    let [s, id] = newProject(createSeed());
    s = d.startStandardWorkflow(s, ceo, id);
    const tasks = s.tasks.filter((t) => t.projectId === id);
    const req = tasks.find((t) => t.stage === "client_request")!;
    const plan = tasks.find((t) => t.stage === "planning")!;
    expect(() => d.setTaskStatus(d.setTaskStatus(s, ceo, plan.id, "assigned"), ceo, plan.id, "in_progress")).toThrow(/dependencies_open/);
    s = d.setTaskStatus(s, ceo, req.id, "in_progress");
    s = d.setTaskStatus(s, ceo, req.id, "under_review");
    s = d.setTaskStatus(s, ceo, req.id, "completed");
    expect(s.tasks.find((t) => t.id === plan.id)!.status).toBe("assigned");
  });
});

describe("tasks", () => {
  it("protected tasks need CEO approval to complete", () => {
    let s = createSeed();
    const [s1, tid] = d.createTask(s, ceo, {
      title: "Send proposal", description: "", projectId: "PRJ-001", assigneeId: "EMP-003", priority: "high", dueDate: null,
      dependencies: [], acceptanceCriteria: [], requiredInputs: "", expectedOutput: "", attachments: [], protectedAction: "client_proposal",
    });
    s = d.setTaskStatus(s1, ceo, tid, "in_progress");
    s = d.setTaskStatus(s, ceo, tid, "under_review");
    expect(() => d.setTaskStatus(s, ceo, tid, "completed")).toThrow(/approval_required/);
    s = d.setTaskStatus(s, ceo, tid, "awaiting_ceo_approval");
    const apr = s.approvals.find((a) => a.taskId === tid)!;
    expect(apr.action).toBe("client_proposal");
    s = d.decideApproval(s, ceo, apr.id, "approved", "");
    expect(s.tasks.find((t) => t.id === tid)!.status).toBe("completed");
  });

  it("detects dependency cycles", () => {
    let s = createSeed();
    // TSK-0007 depends on TSK-0006; making TSK-0006 depend on TSK-0007 is a cycle.
    expect(() => d.updateTask(s, ceo, "TSK-0006", { dependencies: ["TSK-0007"] })).toThrow(/dependency_cycle/);
    s = d.updateTask(s, ceo, "TSK-0009", { dependencies: ["TSK-0001"] });
    expect(s.tasks.find((t) => t.id === "TSK-0009")!.dependencies).toEqual(["TSK-0001"]);
  });

  it("rejects invalid transitions", () => {
    const s = createSeed();
    expect(() => d.setTaskStatus(s, ceo, "TSK-0009", "completed")).toThrow(/invalid_transition/);
  });
});

describe("execution lifecycle", () => {
  function setup() {
    let s = createSeed();
    let exe: string;
    [s, exe] = d.createExecution(s, ceo, {
      employeeId: "EMP-013",
      taskId: "TSK-0008",
      projectId: null,
      title: "Review v1",
      instructions: "Review it",
      attachments: [],
      channel: "claude_code",
    });
    return { s, exe };
  }

  it("is queued, never shown as working until started", () => {
    const { s, exe } = setup();
    const e = s.executions.find((x) => x.id === exe)!;
    expect(e.status).toBe("queued");
    expect(e.projectId).toBe("PRJ-001");
    const emp = s.employees.find((x) => x.id === "EMP-013")!;
    expect(employeeWorkState(s, emp)).toBe("queued");
  });

  it("validates and imports a result, then review completes the task", () => {
    let { s, exe } = setup();
    s = d.markExecutionInSession(s, ceo, exe);
    expect(s.tasks.find((t) => t.id === "TSK-0008")!.status).toBe("in_progress");

    const parsed = parseExecutionResult(
      "Here you go\n```json\n" +
        JSON.stringify({
          schema: "aicos.result/v1",
          executionId: exe,
          employeeId: "EMP-013",
          status: "completed",
          startedAt: "2026-11-02T10:00:00Z",
          endedAt: "2026-11-02T11:30:00Z",
          summary: "Go with conditions",
          output: "# Review",
          deliverables: [{ title: "Review report", type: "test_report", location: "docs/review.md" }],
        }) +
        "\n```",
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    s = d.importExecutionResult(s, ceo, parsed.result);
    const e = s.executions.find((x) => x.id === exe)!;
    expect(e.reviewStatus).toBe("pending");
    expect(s.tasks.find((t) => t.id === "TSK-0008")!.status).toBe("under_review");
    expect(s.deliverables.some((x) => x.executionId === exe)).toBe(true);
    expect(() => d.importExecutionResult(s, ceo, parsed.result)).toThrow(/result_already_recorded/);

    s = d.reviewExecution(s, ceo, exe, "approved", "");
    expect(s.tasks.find((t) => t.id === "TSK-0008")!.status).toBe("completed");
    expect(s.deliverables.find((x) => x.executionId === exe)!.status).toBe("approved");
    expect(qualityStats(s, false).passRate).toBe(100);
  });

  it("rejects results for the wrong employee or malformed input", () => {
    const { s, exe } = setup();
    expect(parseExecutionResult("not json").ok).toBe(false);
    const bad = parseExecutionResult(JSON.stringify({ schema: "aicos.result/v1", executionId: exe, employeeId: "EMP-001", status: "completed" }));
    expect(bad.ok).toBe(true);
    if (bad.ok) expect(() => d.importExecutionResult(s, ceo, bad.result)).toThrow(/result_mismatch/);
    const invalid = parseExecutionResult(JSON.stringify({ schema: "aicos.result/v1", executionId: "nope", employeeId: "EMP-013", status: "done" }));
    expect(invalid.ok).toBe(false);
  });

  it("changes requested sends the task back and allows a revision", () => {
    let { s, exe } = setup();
    const r = parseExecutionResult(JSON.stringify({ schema: "aicos.result/v1", executionId: exe, employeeId: "EMP-013", status: "completed", output: "x" }));
    if (!r.ok) throw new Error("parse");
    s = d.importExecutionResult(s, ceo, r.result);
    expect(() => d.reviewExecution(s, ceo, exe, "changes_requested", "")).toThrow(/required/);
    s = d.reviewExecution(s, ceo, exe, "changes_requested", "Add security section");
    const t = s.tasks.find((x) => x.id === "TSK-0008")!;
    expect(t.status).toBe("changes_requested");
    expect(t.reviewRounds).toBe(1);
    const [s2, rev] = d.createFollowUp(s, ceo, exe, { employeeId: "EMP-013", instructions: "Revise: add security section" });
    const revision = s2.executions.find((x) => x.id === rev)!;
    expect(revision.parentId).toBe(exe);
    expect(revision.taskId).toBe("TSK-0008");
    // The revision packet carries the previous output as upstream context.
    expect(buildPacket(s2, revision).upstream.map((u) => u.executionId)).toContain(exe);
  });

  it("builds a packet and chat prompt with the employee's own instructions and company rules", () => {
    const { s, exe } = setup();
    const packet = buildPacket(s, s.executions.find((x) => x.id === exe)!);
    expect(packet.employee.name).toBe("Eleanor Whitfield");
    expect(packet.task?.id).toBe("TSK-0008");
    const prompt = buildChatPrompt(packet);
    expect(prompt).toContain("You are Eleanor Whitfield");
    expect(prompt).toContain("Budget is $0");
    expect(prompt).toContain(exe);
  });

  it("refuses assignments to unavailable employees", () => {
    let s = createSeed();
    s = d.setAvailability(s, ceo, "EMP-007", "unavailable");
    expect(() =>
      d.createExecution(s, ceo, { employeeId: "EMP-007", taskId: null, projectId: null, title: "x", instructions: "y", attachments: [], channel: "claude_code" }),
    ).toThrow(/employee_unavailable/);
  });
});

describe("data", () => {
  it("clears sample data only", () => {
    const s = d.clearSampleData(createSeed(), ceo);
    expect(s.projects.map((p) => p.id)).toEqual(["PRJ-001"]);
    expect(s.tasks.every((t) => !t.sample)).toBe(true);
    expect(s.approvals.map((a) => a.id)).toEqual(["APR-001"]);
    expect(parseCompanyState(s).ok).toBe(true);
  });

  it("rejects deliverable locations that look like secrets", () => {
    expect(() =>
      d.upsertDeliverable(createSeed(), ceo, {
        title: "x", type: "documentation", projectId: null, taskId: null, ownerId: "ceo",
        location: "https://x.com/?api_key=abc", description: "", version: "1", status: "draft",
      }),
    ).toThrow(/looks_like_secret/);
  });
});
