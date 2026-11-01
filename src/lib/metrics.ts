// Derived, read-only views of the company state. Every KPI here is computed from
// recorded data. Sample records are excluded unless explicitly included.

import type { CompanyState, DepartmentId, Employee, EmployeeId, Execution, Project, Task, TaskStatus } from "./types";

export function scope<T extends { sample: boolean }>(items: T[], includeSample: boolean): T[] {
  return includeSample ? items : items.filter((i) => !i.sample);
}

export function projectProgress(state: CompanyState, project: Project): number | null {
  const tasks = state.tasks.filter((t) => t.projectId === project.id && t.status !== "cancelled");
  if (project.status === "delivered") return 100;
  if (tasks.length === 0) return null;
  return Math.round((tasks.filter((t) => t.status === "completed").length / tasks.length) * 100);
}

export function isOverdue(task: Task, today: string): boolean {
  return !!task.dueDate && task.dueDate < today && task.status !== "completed" && task.status !== "cancelled";
}

export function countBy<T, K extends string>(items: T[], key: (i: T) => K): Record<K, number> {
  const out = {} as Record<K, number>;
  for (const i of items) {
    const k = key(i);
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

export const OPEN_TASK: TaskStatus[] = ["backlog", "assigned", "in_progress", "blocked", "under_review", "changes_requested", "awaiting_ceo_approval"];

/** What an employee is actually doing right now — derived from executions, never assumed. */
export type WorkState = "unavailable" | "in_session" | "queued" | "awaiting_review" | "idle";

export function employeeWorkState(state: CompanyState, emp: Employee): WorkState {
  if (emp.availability === "unavailable") return "unavailable";
  const mine = state.executions.filter((e) => e.employeeId === emp.id);
  if (mine.some((e) => e.status === "in_session")) return "in_session";
  if (mine.some((e) => e.status === "queued")) return "queued";
  if (mine.some((e) => e.reviewStatus === "pending")) return "awaiting_review";
  return "idle";
}

export function currentAssignment(state: CompanyState, empId: EmployeeId): Task | null {
  const order: TaskStatus[] = ["in_progress", "changes_requested", "under_review", "blocked", "assigned", "awaiting_ceo_approval"];
  const mine = state.tasks.filter((t) => t.assigneeId === empId);
  for (const s of order) {
    const t = mine.find((x) => x.status === s);
    if (t) return t;
  }
  return null;
}

export interface EmployeeStats {
  assigned: number;
  open: number;
  completed: number;
  onTime: number;
  withDue: number;
  reviewed: number;
  approvedFirstTime: number;
  changesRequested: number;
  executions: number;
  avgDurationHours: number | null;
}

export function employeeStats(state: CompanyState, empId: EmployeeId, includeSample: boolean): EmployeeStats {
  const tasks = scope(state.tasks, includeSample).filter((t) => t.assigneeId === empId);
  const completed = tasks.filter((t) => t.status === "completed");
  const withDue = completed.filter((t) => t.dueDate && t.completedAt);
  const onTime = withDue.filter((t) => t.completedAt!.slice(0, 10) <= t.dueDate!);
  const exes = scope(state.executions, includeSample).filter((e) => e.employeeId === empId);
  const reviewed = exes.filter((e) => e.reviewStatus === "approved" || e.reviewStatus === "changes_requested");
  return {
    assigned: tasks.length,
    open: tasks.filter((t) => OPEN_TASK.includes(t.status)).length,
    completed: completed.length,
    onTime: onTime.length,
    withDue: withDue.length,
    reviewed: reviewed.length,
    approvedFirstTime: reviewed.filter((e) => e.reviewStatus === "approved" && !e.parentId).length,
    changesRequested: exes.filter((e) => e.reviewStatus === "changes_requested").length,
    executions: exes.length,
    avgDurationHours: averageDurationHours(exes),
  };
}

/** Average of measured execution durations (start and end both reported by the Claude session). */
export function averageDurationHours(exes: Execution[]): number | null {
  const measured = exes.filter((e) => e.startedAt && e.endedAt);
  if (!measured.length) return null;
  const total = measured.reduce((sum, e) => sum + (Date.parse(e.endedAt!) - Date.parse(e.startedAt!)), 0);
  return total / measured.length / 3_600_000;
}

export interface DepartmentStats {
  id: DepartmentId;
  employees: number;
  open: number;
  completed: number;
  blocked: number;
}

export function departmentStats(state: CompanyState, includeSample: boolean): DepartmentStats[] {
  const tasks = scope(state.tasks, includeSample);
  return state.departments.map((d) => {
    const ids = new Set(state.employees.filter((e) => e.departmentId === d.id).map((e) => e.id));
    const mine = tasks.filter((t) => t.assigneeId && ids.has(t.assigneeId));
    return {
      id: d.id,
      employees: ids.size,
      open: mine.filter((t) => OPEN_TASK.includes(t.status)).length,
      completed: mine.filter((t) => t.status === "completed").length,
      blocked: mine.filter((t) => t.status === "blocked").length,
    };
  });
}

export interface QualityStats {
  reviewed: number;
  approved: number;
  changesRequested: number;
  passRate: number | null;
  reopened: number;
  failedExecutions: number;
}

export function qualityStats(state: CompanyState, includeSample: boolean): QualityStats {
  const exes = scope(state.executions, includeSample);
  const approved = exes.filter((e) => e.reviewStatus === "approved").length;
  const changes = exes.filter((e) => e.reviewStatus === "changes_requested").length;
  const reviewed = approved + changes;
  const tasks = scope(state.tasks, includeSample);
  return {
    reviewed,
    approved,
    changesRequested: changes,
    passRate: reviewed ? Math.round((approved / reviewed) * 100) : null,
    // A task sent back after review counts as reopened once per round.
    reopened: tasks.reduce((n, t) => n + t.reviewRounds, 0),
    failedExecutions: exes.filter((e) => e.status === "failed").length,
  };
}
