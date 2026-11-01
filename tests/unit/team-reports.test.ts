import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createSeed } from "@/data/seed";
import { applyAgentReport } from "@/lib/execution/apply-report";
import { parseAgentReport } from "@/lib/execution/report-schema";
import { parseCompanyState } from "@/lib/state-schema";

// Real reports written by the AI team for the todo-app quick app (agency-projects, project/todo-app).
const dir = join(__dirname, "../fixtures/todo-app");
const reports = readdirSync(dir).sort().map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")));

describe("real team reports (todo-app)", () => {
  it("parse, translating near-miss values instead of rejecting the work", () => {
    for (const r of reports) {
      const parsed = parseAgentReport(r);
      expect(parsed.ok, JSON.stringify(parsed)).toBe(true);
      if (parsed.ok) expect(parsed.skipped).toEqual([]);
    }
  });

  it("apply in order: project, tasks, members, outputs and reviews appear on the dashboard", () => {
    let s = createSeed();
    const warnings: string[] = [];
    for (const r of reports) {
      const parsed = parseAgentReport(r);
      if (!parsed.ok) throw new Error(parsed.issues.join("; "));
      const out = applyAgentReport(s, "2026-11-01T21:10:00.000Z", parsed.report);
      s = out.state;
      warnings.push(...out.warnings);
    }
    expect(warnings).toEqual([]);
    const p = s.projects.find((x) => x.extKey === "todo-app")!;
    expect(p).toBeTruthy();
    const tasks = s.tasks.filter((t) => t.projectId === p.id);
    expect(tasks.length).toBeGreaterThanOrEqual(5);
    const byKey = Object.fromEntries(tasks.map((t) => [t.extKey, t]));
    expect(byKey["todo-app/spec"].status).toBe("completed");
    expect(byKey["todo-app/build"].status).toBe("completed");
    expect(p.memberIds).toEqual(expect.arrayContaining(["EMP-002", "EMP-008", "EMP-012"]));
    const exes = s.executions.filter((e) => e.projectId === p.id);
    expect(exes.length).toBeGreaterThanOrEqual(4);
    expect(exes.filter((e) => e.reviewStatus === "approved").length).toBeGreaterThanOrEqual(3);
    expect(s.messages.filter((m) => m.refId === p.id).length).toBeGreaterThanOrEqual(3);
    expect(parseCompanyState(s).ok).toBe(true);
    // Summary for the test log
    console.log(tasks.map((t) => `${t.extKey}: ${t.status}`).join("\n"));
  });
});

describe("report bookkeeping", () => {
  it("records the full reportId so the dashboard can skip duplicates", () => {
    const parsed = parseAgentReport(reports[0]);
    if (!parsed.ok) throw new Error("parse");
    const { state } = applyAgentReport(createSeed(), "2026-11-01T21:30:00.000Z", parsed.report);
    const entry = state.activity.find((a) => a.key === "agent_report_applied")!;
    expect(entry.params.reportId).toBe("todo-app-0001");
  });
});
