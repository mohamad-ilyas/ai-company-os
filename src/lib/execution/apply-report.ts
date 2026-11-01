// Applies an AI team report (aicos.report/v1) to the company state.
// Every action goes through the normal domain functions with an *operator* role:
// the team can create and progress work, but cannot decide approvals, delete data,
// change settings, or complete protected tasks. Each action is attributed to the
// employee who did it, so the audit log shows who did what.

import {
  DomainError,
  createApproval,
  createExecution,
  createProject,
  createTask,
  importExecutionResult,
  log,
  markExecutionInSession,
  postMessage,
  requestProjectRelease,
  reviewExecution,
  setProjectStatus,
  setTaskStatus,
  updateProject,
  updateTask,
  upsertDeliverable,
  type Ctx,
} from "../domain";
import { PROJECT_TRANSITIONS, PROTECTED_ACTION_RISK } from "../workflow";
import type { ActorId, CompanyState, EmployeeId, Project, ProjectStatus, Task, TaskStatus } from "../types";
import type { AgentReport, ReportAction } from "./report-schema";
import type { ExecutionResult } from "./result-schema";

export interface ApplyOutcome {
  state: CompanyState;
  applied: number;
  warnings: string[];
}

const PROJECT_ORDER: ProjectStatus[] = ["planning", "requirements", "design", "development", "testing", "review"];
const TASK_ORDER: TaskStatus[] = ["backlog", "assigned", "in_progress", "under_review", "completed"];

function addDays(day: string, n: number) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function applyAgentReport(state: CompanyState, now: string, report: AgentReport): ApplyOutcome {
  let s = state;
  let applied = 0;
  const warnings: string[] = [];
  const today = now.slice(0, 10);
  const channel = report.source === "claude_chat" ? "claude_chat" : "claude_code";
  const ctx = (actor: ActorId): Ctx => ({ actor, role: "operator", now });

  const project = (k: string): Project => {
    const p = s.projects.find((x) => x.extKey === k);
    if (!p) throw new DomainError("not_found", { id: k });
    return p;
  };
  const task = (k: string): Task => {
    const t = s.tasks.find((x) => x.extKey === k);
    if (!t) throw new DomainError("not_found", { id: k });
    return t;
  };
  const patchProject = (id: string, patch: Partial<Project>) => {
    s = { ...s, projects: s.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)) };
  };
  const patchTask = (id: string, patch: Partial<Task>) => {
    s = { ...s, tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) };
  };

  /** Moves a project forward through the lifecycle one allowed step at a time. */
  const moveProject = (p: Project, to: ProjectStatus, by: ActorId) => {
    if (p.status === to) return;
    const from = PROJECT_ORDER.indexOf(p.status);
    const target = PROJECT_ORDER.indexOf(to);
    if (from >= 0 && target > from) {
      for (const step of PROJECT_ORDER.slice(from + 1, target + 1)) {
        const cur = s.projects.find((x) => x.id === p.id)!;
        if (PROJECT_TRANSITIONS[cur.status].includes(step)) s = setProjectStatus(s, ctx(by), p.id, step);
      }
      if (s.projects.find((x) => x.id === p.id)!.status !== to) throw new DomainError("invalid_transition", { from: p.status, to });
    } else {
      s = setProjectStatus(s, ctx(by), p.id, to);
    }
  };

  /** Moves a task forward (assigned → in progress → under review → completed) through allowed steps. */
  const moveTask = (t: Task, to: TaskStatus, by: ActorId, note = "") => {
    if (t.status === to) return;
    const start = t.status === "changes_requested" || t.status === "blocked" ? TASK_ORDER.indexOf("assigned") : TASK_ORDER.indexOf(t.status);
    const target = TASK_ORDER.indexOf(to);
    if (start >= 0 && target > start) {
      if (t.status === "changes_requested" || t.status === "blocked") s = setTaskStatus(s, ctx(by), t.id, "in_progress");
      for (const step of TASK_ORDER.slice(start + 1, target + 1)) {
        const cur = s.tasks.find((x) => x.id === t.id)!;
        if (cur.status === step) continue;
        s = setTaskStatus(s, ctx(by), t.id, step, step === to ? note : "");
      }
    } else {
      s = setTaskStatus(s, ctx(by), t.id, to, note);
    }
  };

  const apply = (a: ReportAction) => {
    switch (a.type) {
      case "project.upsert": {
        const existing = s.projects.find((p) => p.extKey === a.key);
        const manager = (a.managerId ?? existing?.managerId ?? "EMP-003") as EmployeeId;
        if (existing) {
          s = updateProject(s, ctx(manager), existing.id, {
            name: a.name,
            client: a.client,
            ...(a.description !== undefined && { description: a.description }),
            ...(a.businessRequirements !== undefined && { businessRequirements: a.businessRequirements }),
            ...(a.technicalRequirements !== undefined && { technicalRequirements: a.technicalRequirements }),
            ...(a.scope !== undefined && { scope: a.scope }),
            ...(a.priority && { priority: a.priority }),
            ...(a.startDate && { startDate: a.startDate }),
            ...(a.targetDate && { targetDate: a.targetDate }),
            ...(a.managerId && { managerId: a.managerId as EmployeeId }),
            ...(a.memberIds && { memberIds: a.memberIds as EmployeeId[] }),
          });
          if (a.repoUrl !== undefined) patchProject(existing.id, { repoUrl: a.repoUrl });
          if (a.status) moveProject(project(a.key), a.status, manager);
        } else {
          const start = a.startDate ?? today;
          let id: string;
          [s, id] = createProject(s, ctx(manager), {
            name: a.name,
            client: a.client,
            description: a.description ?? "",
            businessRequirements: a.businessRequirements ?? "",
            technicalRequirements: a.technicalRequirements ?? "",
            scope: a.scope ?? "",
            budget: null,
            priority: a.priority ?? "medium",
            startDate: start,
            targetDate: a.targetDate ?? addDays(start, 30),
            managerId: manager,
            memberIds: (a.memberIds ?? []) as EmployeeId[],
            dependencies: [],
          });
          patchProject(id, { extKey: a.key, repoUrl: a.repoUrl ?? null });
          if (a.status && a.status !== "planning") moveProject(project(a.key), a.status, manager);
        }
        return;
      }
      case "task.upsert": {
        const p = project(a.projectKey);
        const deps = (a.dependsOn ?? []).map((k) => task(k).id);
        const existing = s.tasks.find((t) => t.extKey === a.key);
        const fields = {
          title: a.title,
          ...(a.description !== undefined && { description: a.description }),
          ...(a.assigneeId && { assigneeId: a.assigneeId as EmployeeId }),
          ...(a.priority && { priority: a.priority }),
          ...(a.dueDate && { dueDate: a.dueDate }),
          ...(a.dependsOn && { dependencies: deps }),
          ...(a.acceptanceCriteria && { acceptanceCriteria: a.acceptanceCriteria }),
          ...(a.requiredInputs !== undefined && { requiredInputs: a.requiredInputs }),
          ...(a.expectedOutput !== undefined && { expectedOutput: a.expectedOutput }),
          ...(a.protectedAction && { protectedAction: a.protectedAction }),
        };
        if (existing) {
          s = updateTask(s, ctx(p.managerId), existing.id, fields);
        } else {
          let id: string;
          [s, id] = createTask(s, ctx(p.managerId), {
            title: a.title,
            description: a.description ?? "",
            projectId: p.id,
            assigneeId: (a.assigneeId ?? null) as EmployeeId | null,
            priority: a.priority ?? p.priority,
            dueDate: a.dueDate ?? null,
            dependencies: deps,
            acceptanceCriteria: a.acceptanceCriteria ?? [],
            requiredInputs: a.requiredInputs ?? "",
            expectedOutput: a.expectedOutput ?? "",
            attachments: [],
            protectedAction: a.protectedAction ?? null,
          });
          const created = s.tasks.find((t) => t.id === id)!;
          const waiting = deps.some((d) => s.tasks.find((t) => t.id === d)?.status !== "completed");
          // Like the standard workflow: a task waits in the backlog until its inputs are done.
          patchTask(id, { extKey: a.key, stage: a.stage ?? null, status: waiting ? "backlog" : created.status });
          if (!p.memberIds.includes(a.assigneeId as EmployeeId) && a.assigneeId) {
            patchProject(p.id, { memberIds: [...p.memberIds, a.assigneeId as EmployeeId] });
          }
        }
        return;
      }
      case "task.status": {
        moveTask(task(a.taskKey), a.status, a.by as EmployeeId, a.note ?? "");
        return;
      }
      case "work.record": {
        const t = a.taskKey ? task(a.taskKey) : undefined;
        const p = a.projectKey ? project(a.projectKey) : undefined;
        const emp = a.employeeId as EmployeeId;
        let exeId: string;
        [s, exeId] = createExecution(s, ctx(emp), {
          employeeId: emp,
          taskId: t?.id ?? null,
          projectId: t?.projectId ?? p?.id ?? null,
          title: a.title,
          instructions: a.instructions,
          attachments: [],
          channel,
        });
        s = markExecutionInSession(s, ctx(emp), exeId);
        if (a.status === "in_progress") {
          // Started but not finished: keep the record running with its log; no result, no review.
          s = {
            ...s,
            executions: s.executions.map((e) =>
              e.id === exeId
                ? { ...e, startedAt: a.startedAt ?? e.startedAt, summary: a.summary, output: a.output, logs: [...e.logs, ...a.logs.map((l) => ({ at: l.at ?? now, message: l.message }))] }
                : e,
            ),
          };
          return;
        }
        const result: ExecutionResult = {
          schema: "aicos.result/v1",
          executionId: exeId,
          employeeId: emp,
          channel,
          status: a.status as ExecutionResult["status"],
          startedAt: a.startedAt ?? null,
          endedAt: a.endedAt ?? null,
          summary: a.summary,
          output: a.output,
          logs: a.logs.map((l) => ({ at: l.at ?? null, message: l.message })),
          errors: a.errors,
          openQuestions: a.openQuestions,
          deliverables: a.deliverables,
          handoff: a.handoff ? { to: a.handoff.to as EmployeeId, note: a.handoff.note } : null,
        };
        s = importExecutionResult(s, ctx(emp), result);
        if (a.review && a.status === "completed") {
          if (a.review.reviewerId === emp) {
            warnings.push(`${a.title}: self-review ignored — a different employee must review`);
          } else {
            s = reviewExecution(s, ctx(a.review.reviewerId as EmployeeId), exeId, a.review.decision, a.review.notes);
          }
        }
        return;
      }
      case "execution.result": {
        s = importExecutionResult(s, ctx(a.result.employeeId as EmployeeId), a.result as ExecutionResult);
        return;
      }
      case "message.post": {
        const refId = a.kind === "department" ? (a.departmentId ?? null) : a.projectKey ? project(a.projectKey).id : null;
        if (a.kind === "project" && !refId) throw new DomainError("required", { field: "projectKey" });
        if (a.kind === "department" && !refId) throw new DomainError("required", { field: "departmentId" });
        s = postMessage(s, ctx(a.authorId as EmployeeId), { kind: a.kind, refId, body: a.body, authorId: a.authorId as EmployeeId });
        return;
      }
      case "approval.request": {
        const t = a.taskKey ? task(a.taskKey) : undefined;
        const p = a.projectKey ? project(a.projectKey) : t ? s.projects.find((x) => x.id === t.projectId) : undefined;
        const by = a.requestedBy as EmployeeId;
        if (t && t.protectedAction === a.action && t.status === "under_review") {
          // The protected task itself goes to the CEO; approving it completes the task.
          s = setTaskStatus(s, ctx(by), t.id, "awaiting_ceo_approval", a.reason);
        } else if (!t && p && PROJECT_TRANSITIONS[p.status].includes("awaiting_ceo_approval")) {
          s = requestProjectRelease(s, ctx(by), p.id, { action: a.action, reason: a.reason, impact: a.impact, risk: a.risk });
        } else {
          [s] = createApproval(s, ctx(by), {
            action: a.action,
            title: a.title,
            requestedBy: by,
            reason: a.reason,
            impact: a.impact,
            risk: a.risk ?? PROTECTED_ACTION_RISK[a.action],
            supportingFiles: a.supportingFiles,
            projectId: p?.id ?? null,
            taskId: t?.id ?? null,
          });
        }
        return;
      }
      case "deliverable.record": {
        const t = a.taskKey ? task(a.taskKey) : undefined;
        const p = a.projectKey ? project(a.projectKey) : undefined;
        [s] = upsertDeliverable(s, ctx(a.ownerId as EmployeeId), {
          title: a.title,
          type: a.deliverableType,
          projectId: t?.projectId ?? p?.id ?? null,
          taskId: t?.id ?? null,
          ownerId: a.ownerId as EmployeeId,
          location: a.location,
          description: a.description,
          version: a.version,
          status: "in_review",
        });
        return;
      }
    }
  };

  report.actions.forEach((a, i) => {
    const before = s;
    try {
      apply(a);
      applied++;
    } catch (err) {
      s = before; // an action is all-or-nothing
      const detail = err instanceof DomainError ? `${err.code}${Object.keys(err.params).length ? ` ${JSON.stringify(err.params)}` : ""}` : err instanceof Error ? err.message : String(err);
      warnings.push(`#${i + 1} ${a.type}: ${detail}`);
    }
  });

  s = log(s, ctx("system"), "execution", "agent_report_applied", {
    id: report.reportId.slice(0, 8),
    count: String(applied),
    warnings: String(warnings.length),
  });
  return { state: s, applied, warnings };
}
