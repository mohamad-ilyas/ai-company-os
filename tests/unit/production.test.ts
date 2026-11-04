// Production-readiness fixes: edits survive the bounded activity log, reports are never applied
// twice (and failed actions can be retried), unsavable data is refused, and stored data
// that outgrew a limit is repaired instead of being set aside.
import { describe, expect, it } from "vitest";
import { createSeed } from "@/data/seed";
import { WORKFORCE_VERSION } from "@/data/workforce";
import { log, setDepartmentManager, updateInstructions, upsertArticle, type Ctx } from "@/lib/domain";
import { applyAgentReport } from "@/lib/execution/apply-report";
import { parseAgentReport } from "@/lib/execution/report-schema";
import { migrateState } from "@/lib/migrate";
import { parseCompanyState, parseOrRepairCompanyState } from "@/lib/state-schema";
import { safeLink } from "@/lib/safe-url";
import type { CompanyState } from "@/lib/types";

const NOW = "2026-11-04T10:00:00.000Z";
const ceo: Ctx = { actor: "ceo", role: "ceo", now: NOW };

function report(reportId: string, actions: unknown[]) {
  const p = parseAgentReport({ schema: "aicos.report/v1", reportId, sentAt: NOW, source: "claude_code_web", actions });
  if (!p.ok) throw new Error(p.issues.join("; "));
  return p.report;
}

/** Pushes the original edit entries out of the 2,000-entry activity log. */
function flood(s: CompanyState, n = 2001): CompanyState {
  for (let i = 0; i < n; i++) s = log(s, ceo, "config", "settings_changed", { fields: "tagline" });
  return s;
}

describe("CEO edits survive the bounded activity log", () => {
  it("keeps edited instructions, articles and managers after 2,001 later log entries and an upgrade", () => {
    let s = createSeed();
    s = updateInstructions(s, ceo, "EMP-008", "My custom brief");
    const kb = s.knowledge[0];
    [s] = upsertArticle(s, ceo, { id: kb.id, title: kb.title, category: kb.category, body: "My edited policy", tags: kb.tags });
    const qaOther = s.employees.find((e) => e.departmentId === "qa" && e.id !== s.departments.find((d) => d.id === "qa")!.managerId)!;
    s = setDepartmentManager(s, ceo, "qa", qaOther.id);
    s = flood(s);
    expect(s.activity.some((a) => a.key === "instructions_changed")).toBe(false); // gone from the log…
    const { state } = migrateState({ ...s, workforceVersion: WORKFORCE_VERSION - 1 }, NOW);
    expect(state.employees.find((e) => e.id === "EMP-008")!.systemInstructions).toBe("My custom brief"); // …but kept
    expect(state.knowledge.find((k) => k.id === kb.id)!.body).toBe("My edited policy");
    expect(state.departments.find((d) => d.id === "qa")!.managerId).toBe(qaOther.id);
  });

  it("records markers from the log for companies saved before markers existed", () => {
    let s = createSeed();
    s = updateInstructions(s, ceo, "EMP-004", "Old brief");
    const old: CompanyState = { ...s, edited: undefined };
    const first = migrateState(old, NOW);
    expect(first.changed).toBe(true);
    expect(first.state.edited!.instructions).toContain("EMP-004");
    expect(migrateState(first.state, NOW).changed).toBe(false);
  });
});

describe("AI team reports are never applied twice", () => {
  const actions = [
    { type: "project.upsert", key: "dup-app", name: "Dup app", client: "Client" },
    { type: "work.record", employeeId: "EMP-002", title: "Requirements", instructions: "Write them", status: "completed", summary: "done", output: "## Done" },
  ];

  it("skips every action on re-delivery, so work records are not duplicated", () => {
    const r = report("dup-report-0001", actions);
    const first = applyAgentReport(createSeed(), NOW, r);
    expect(first).toMatchObject({ applied: 2, complete: true, alreadyApplied: 0 });
    const again = applyAgentReport(first.state, NOW, r);
    expect(again).toMatchObject({ applied: 0, complete: true, alreadyApplied: 2 });
    expect(again.state.executions.length).toBe(first.state.executions.length);
  });

  it("remembers applied reports even after the activity log has rolled over", () => {
    const r = report("dup-report-0002", actions);
    const first = applyAgentReport(createSeed(), NOW, r);
    const again = applyAgentReport(flood(first.state), NOW, r);
    expect(again.applied).toBe(0);
  });

  it("re-applying a partial report retries only the actions that failed", () => {
    const r = report("dup-report-0003", [
      ...actions,
      { type: "task.status", taskKey: "dup-app/missing", status: "in_progress", by: "EMP-008" }, // task doesn't exist yet
    ]);
    const first = applyAgentReport(createSeed(), NOW, r);
    expect(first).toMatchObject({ applied: 2, complete: false });
    expect(first.warnings).toHaveLength(1);
    // The task now exists (a later report created it); the retry applies just the failed action.
    const withTask = applyAgentReport(first.state, NOW, report("dup-report-0004", [{ type: "task.upsert", key: "dup-app/missing", projectKey: "dup-app", title: "Missing", assigneeId: "EMP-008" }])).state;
    const retry = applyAgentReport(withTask, NOW, r);
    expect(retry).toMatchObject({ applied: 1, alreadyApplied: 2, complete: true });
    expect(retry.state.executions.length).toBe(withTask.executions.length);
  });
});

describe("data the loader would reject is never saved", () => {
  it("drops just the action that would make the company unloadable", () => {
    const r = report("too-long-0001", [
      { type: "project.upsert", key: "long-app", name: "Long app", client: "C" },
      { type: "message.post", kind: "project", projectKey: "long-app", authorId: "EMP-003", body: "fine" },
    ]);
    // Simulate an action that slipped past the report schema with an over-long field.
    const bad = { ...r, actions: [...r.actions, { ...r.actions[0], key: "long-app-2", name: "x".repeat(400) }] } as typeof r;
    const out = applyAgentReport(createSeed(), NOW, bad);
    expect(out.applied).toBe(2);
    expect(out.warnings.join(" ")).toMatch(/invalid_data/);
    expect(parseCompanyState(out.state).ok).toBe(true);
  });

  it("repairs stored text that outgrew its limit instead of setting the company aside", () => {
    const seed = createSeed();
    const s = { ...seed, projects: seed.projects.map((p, i) => (i === 0 ? { ...p, name: "n".repeat(301) } : p)) };
    expect(parseCompanyState(s).ok).toBe(false);
    const repaired = parseOrRepairCompanyState(JSON.parse(JSON.stringify(s)));
    expect(repaired.ok).toBe(true);
    expect(repaired.repaired).toEqual(["projects.0.name"]);
    if (repaired.ok) expect(repaired.state.projects[0].name).toHaveLength(300);
  });

  it("still refuses data that is broken in other ways", () => {
    const s = { ...createSeed(), employees: [] };
    expect(parseOrRepairCompanyState(s).ok).toBe(false);
  });
});

describe("links built from stored text", () => {
  it.each([
    ["/tasks/view/?id=TSK-0001", "internal"],
    ["#section", "internal"],
    ["https://github.com/mohamad-ilyas", "external"],
    ["mailto:ceo@example.com", "external"],
  ])("allows %s", (url, kind) => expect(safeLink(url)?.kind).toBe(kind));

  it.each(["javascript:alert(1)", "data:text/html,x", "//evil.example", "/\\evil.example", " javascript:alert(1)", "java\tscript:alert(1)", "vbscript:x", ""])(
    "refuses %j",
    (url) => expect(safeLink(url)).toBeNull(),
  );
});
