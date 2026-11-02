// Pure domain logic. Every mutation goes through these functions so that guards
// (permissions, dependencies, CEO approval gates) and the audit log are applied
// consistently. Each function returns a new state; inputs are never mutated.

import { APPROVAL_LEVEL, COO_ID, LIFECYCLE, PROJECT_TRANSITIONS, PROTECTED_ACTION_RISK, TASK_TRANSITIONS } from "./workflow";
import type {
  ActivityEvent,
  ActivityType,
  ActorId,
  Approval,
  Availability,
  ChannelKind,
  CompanyState,
  Deliverable,
  EmployeeId,
  Execution,
  KnowledgeArticle,
  LinkRef,
  Project,
  ProjectStatus,
  ProtectedAction,
  RiskLevel,
  Role,
  Settings,
  Task,
  TaskStatus,
} from "./types";
import type { ExecutionResult } from "./execution/result-schema";

export interface Ctx {
  actor: ActorId;
  role: Role;
  now: string;
}

export class DomainError extends Error {
  constructor(
    public code: string,
    public params: Record<string, string> = {},
  ) {
    super(code);
    this.name = "DomainError";
  }
}

// ---------------------------------------------------------------- permissions

export type Permission = "write" | "decide_approvals" | "delete" | "edit_instructions" | "manage_settings";

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  ceo: ["write", "decide_approvals", "delete", "edit_instructions", "manage_settings"],
  operator: ["write"],
  viewer: [],
};

export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

function require(ctx: Ctx, permission: Permission) {
  if (!can(ctx.role, permission)) throw new DomainError("permission_denied", { permission });
}

// ---------------------------------------------------------------- ids & log

const PAD: Record<string, number> = { PRJ: 3, TSK: 4, EXE: 4, APR: 3, MSG: 4, DLV: 3, KB: 3, ACT: 5, CMT: 4, MS: 3, RSK: 3 };

export function nextId(state: CompanyState, prefix: string): [string, CompanyState] {
  const n = (state.counters[prefix] ?? 0) + 1;
  const id = `${prefix}-${String(n).padStart(PAD[prefix] ?? 3, "0")}`;
  return [id, { ...state, counters: { ...state.counters, [prefix]: n } }];
}

export function log(
  state: CompanyState,
  ctx: Ctx,
  type: ActivityType,
  key: string,
  params: Record<string, string>,
  ref: { type: ActivityEvent["refType"]; id: string | null } = { type: null, id: null },
): CompanyState {
  const [id, s] = nextId(state, "ACT");
  const event: ActivityEvent = { id, at: ctx.now, actor: ctx.actor, type, key, params, refType: ref.type, refId: ref.id };
  // Newest first; keep the log bounded so localStorage never fills up.
  return { ...s, activity: [event, ...s.activity].slice(0, 2000) };
}

function bump(state: CompanyState): CompanyState {
  return { ...state, revision: state.revision + 1 };
}

function findTask(state: CompanyState, id: string): Task {
  const task = state.tasks.find((t) => t.id === id);
  if (!task) throw new DomainError("not_found", { id });
  return task;
}

function findProject(state: CompanyState, id: string): Project {
  const p = state.projects.find((x) => x.id === id);
  if (!p) throw new DomainError("not_found", { id });
  return p;
}

function findExecution(state: CompanyState, id: string): Execution {
  const e = state.executions.find((x) => x.id === id);
  if (!e) throw new DomainError("not_found", { id });
  return e;
}

function assertEmployee(state: CompanyState, id: EmployeeId | null) {
  if (id && !state.employees.some((e) => e.id === id)) throw new DomainError("unknown_employee", { id });
}

function nonEmpty(value: string, field: string) {
  if (!value || !value.trim()) throw new DomainError("required", { field });
}

function replace<T extends { id: string }>(list: T[], item: T): T[] {
  return list.map((x) => (x.id === item.id ? item : x));
}

// ---------------------------------------------------------------- projects

export type ProjectInput = Omit<
  Project,
  "id" | "createdAt" | "updatedAt" | "sample" | "milestones" | "risks" | "status"
> & {
  milestones?: Project["milestones"];
  risks?: Project["risks"];
  status?: ProjectStatus;
};

export function createProject(state: CompanyState, ctx: Ctx, input: ProjectInput): [CompanyState, string] {
  require(ctx, "write");
  nonEmpty(input.name, "name");
  nonEmpty(input.client, "client");
  assertEmployee(state, input.managerId);
  input.memberIds.forEach((m) => assertEmployee(state, m));
  if (input.targetDate && input.startDate && input.targetDate < input.startDate) throw new DomainError("dates_order");
  if (input.budget !== null && (Number.isNaN(input.budget) || input.budget < 0)) throw new DomainError("invalid_budget");

  let [id, s] = nextId(state, "PRJ");
  const project: Project = {
    ...input,
    id,
    name: input.name.trim(),
    client: input.client.trim(),
    milestones: input.milestones ?? [],
    risks: input.risks ?? [],
    status: input.status ?? "planning",
    createdAt: ctx.now,
    updatedAt: ctx.now,
    sample: false,
  };
  s = { ...s, projects: [...s.projects, project] };
  s = log(s, ctx, "project", "project_created", { id, name: project.name }, { type: "project", id });
  return [bump(s), id];
}

export function updateProject(state: CompanyState, ctx: Ctx, id: string, patch: Partial<ProjectInput>): CompanyState {
  require(ctx, "write");
  const p = findProject(state, id);
  if (patch.name !== undefined) nonEmpty(patch.name, "name");
  if (patch.managerId) assertEmployee(state, patch.managerId);
  patch.memberIds?.forEach((m) => assertEmployee(state, m));
  const { status: _ignored, ...rest } = patch; // status changes go through setProjectStatus
  void _ignored;
  const next: Project = { ...p, ...rest, updatedAt: ctx.now };
  if (next.targetDate && next.startDate && next.targetDate < next.startDate) throw new DomainError("dates_order");
  let s: CompanyState = { ...state, projects: replace(state.projects, next) };
  s = log(s, ctx, "project", "project_updated", { id, name: next.name }, { type: "project", id });
  return bump(s);
}

export function setProjectStatus(state: CompanyState, ctx: Ctx, id: string, status: ProjectStatus): CompanyState {
  require(ctx, "write");
  const p = findProject(state, id);
  if (p.status === status) return state;
  // "Awaiting CEO approval" is reached by requesting approval; it is left only by the CEO's decision.
  // Entering "awaiting_ceo_approval" must file an approval request — use requestProjectRelease.
  if (status === "awaiting_ceo_approval" || !PROJECT_TRANSITIONS[p.status].includes(status)) {
    throw new DomainError("invalid_transition", { from: p.status, to: status });
  }
  if (status === "delivered" && !hasApproved(state, { projectId: id })) {
    throw new DomainError("approval_required");
  }
  let s: CompanyState = { ...state, projects: replace(state.projects, { ...p, status, updatedAt: ctx.now }) };
  s = log(s, ctx, "project", "project_status", { id, name: p.name, from: p.status, to: status }, { type: "project", id });
  return bump(s);
}

export function addMilestone(state: CompanyState, ctx: Ctx, projectId: string, input: { title: string; dueDate: string }): CompanyState {
  require(ctx, "write");
  nonEmpty(input.title, "title");
  const p = findProject(state, projectId);
  let [id, s] = nextId(state, "MS");
  s = { ...s, projects: replace(s.projects, { ...p, milestones: [...p.milestones, { id, title: input.title.trim(), dueDate: input.dueDate, done: false }], updatedAt: ctx.now }) };
  s = log(s, ctx, "project", "project_updated", { id: projectId, name: p.name }, { type: "project", id: projectId });
  return bump(s);
}

export function toggleMilestone(state: CompanyState, ctx: Ctx, projectId: string, milestoneId: string): CompanyState {
  require(ctx, "write");
  const p = findProject(state, projectId);
  const milestones = p.milestones.map((m) => (m.id === milestoneId ? { ...m, done: !m.done } : m));
  let s: CompanyState = { ...state, projects: replace(state.projects, { ...p, milestones, updatedAt: ctx.now }) };
  s = log(s, ctx, "project", "project_updated", { id: projectId, name: p.name }, { type: "project", id: projectId });
  return bump(s);
}

export function removeMilestone(state: CompanyState, ctx: Ctx, projectId: string, milestoneId: string): CompanyState {
  require(ctx, "write");
  const p = findProject(state, projectId);
  let s: CompanyState = { ...state, projects: replace(state.projects, { ...p, milestones: p.milestones.filter((m) => m.id !== milestoneId), updatedAt: ctx.now }) };
  s = log(s, ctx, "project", "project_updated", { id: projectId, name: p.name }, { type: "project", id: projectId });
  return bump(s);
}

export function addRisk(state: CompanyState, ctx: Ctx, projectId: string, input: { description: string; severity: "low" | "medium" | "high"; mitigation: string }): CompanyState {
  require(ctx, "write");
  nonEmpty(input.description, "description");
  const p = findProject(state, projectId);
  let [id, s] = nextId(state, "RSK");
  s = { ...s, projects: replace(s.projects, { ...p, risks: [...p.risks, { id, description: input.description.trim(), severity: input.severity, mitigation: input.mitigation.trim() }], updatedAt: ctx.now }) };
  s = log(s, ctx, "project", "project_updated", { id: projectId, name: p.name }, { type: "project", id: projectId });
  return bump(s);
}

export function removeRisk(state: CompanyState, ctx: Ctx, projectId: string, riskId: string): CompanyState {
  require(ctx, "write");
  const p = findProject(state, projectId);
  let s: CompanyState = { ...state, projects: replace(state.projects, { ...p, risks: p.risks.filter((r) => r.id !== riskId), updatedAt: ctx.now }) };
  s = log(s, ctx, "project", "project_updated", { id: projectId, name: p.name }, { type: "project", id: projectId });
  return bump(s);
}

/** Moves a project to "awaiting CEO approval" and files the approval request. */
export function requestProjectRelease(
  state: CompanyState,
  ctx: Ctx,
  id: string,
  input: { action: ProtectedAction; reason: string; impact: string; risk?: RiskLevel },
): CompanyState {
  require(ctx, "write");
  const p = findProject(state, id);
  if (!PROJECT_TRANSITIONS[p.status].includes("awaiting_ceo_approval")) {
    throw new DomainError("invalid_transition", { from: p.status, to: "awaiting_ceo_approval" });
  }
  let s = createApprovalInternal(state, ctx, {
    action: input.action,
    title: `${p.name}: ${input.action}`,
    requestedBy: ctx.actor,
    reason: input.reason,
    impact: input.impact,
    risk: input.risk ?? PROTECTED_ACTION_RISK[input.action],
    supportingFiles: [],
    projectId: id,
    taskId: null,
  })[0];
  const fresh = findProject(s, id);
  s = { ...s, projects: replace(s.projects, { ...fresh, status: "awaiting_ceo_approval", updatedAt: ctx.now }) };
  s = log(s, ctx, "project", "project_status", { id, name: p.name, from: p.status, to: "awaiting_ceo_approval" }, { type: "project", id });
  return bump(s);
}

export function deleteProject(state: CompanyState, ctx: Ctx, id: string): CompanyState {
  require(ctx, "delete");
  const p = findProject(state, id);
  const taskIds = new Set(state.tasks.filter((t) => t.projectId === id).map((t) => t.id));
  let s: CompanyState = {
    ...state,
    projects: state.projects.filter((x) => x.id !== id),
    tasks: state.tasks.filter((t) => t.projectId !== id),
    // Executions, approvals, deliverables and messages are kept as records but unlinked.
    executions: state.executions.map((e) =>
      e.projectId === id ? { ...e, projectId: null, taskId: e.taskId && taskIds.has(e.taskId) ? null : e.taskId } : e,
    ),
    approvals: state.approvals.map((a) =>
      a.projectId === id ? { ...a, projectId: null, taskId: a.taskId && taskIds.has(a.taskId) ? null : a.taskId } : a,
    ),
    deliverables: state.deliverables.map((d) => (d.projectId === id ? { ...d, projectId: null, taskId: null } : d)),
  };
  s = log(s, ctx, "data", "project_deleted", { id, name: p.name, tasks: String(taskIds.size) });
  return bump(s);
}

/** Generates the standard lifecycle tasks for a project, wired with dependencies and owners. */
export function startStandardWorkflow(state: CompanyState, ctx: Ctx, projectId: string): CompanyState {
  require(ctx, "write");
  const p = findProject(state, projectId);
  if (state.tasks.some((t) => t.projectId === projectId && t.stage !== null)) {
    throw new DomainError("workflow_exists");
  }
  let s = state;
  const idByKey = new Map<string, string>();
  for (const stage of LIFECYCLE) {
    for (const tpl of stage.tasks) {
      let id: string;
      [id, s] = nextId(s, "TSK");
      idByKey.set(tpl.key, id);
      const task: Task = {
        id,
        title: tpl.title,
        description: `${p.name} — ${tpl.title}.`,
        projectId,
        assigneeId: tpl.assigneeId,
        priority: p.priority,
        status: tpl.dependsOn.length === 0 ? "assigned" : "backlog",
        dueDate: null,
        dependencies: tpl.dependsOn.map((k) => idByKey.get(k)!).filter(Boolean),
        acceptanceCriteria: tpl.acceptanceCriteria,
        requiredInputs: tpl.dependsOn.length ? "Outputs of the dependency tasks." : "The client request and project brief.",
        expectedOutput: tpl.expectedOutput,
        attachments: [],
        comments: [],
        history: [{ at: ctx.now, actor: ctx.actor, key: "created_from_workflow", params: { stage: stage.stage } }],
        stage: stage.stage,
        protectedAction: tpl.protectedAction ?? null,
        reviewRounds: 0,
        createdAt: ctx.now,
        updatedAt: ctx.now,
        startedAt: null,
        completedAt: null,
        sample: false,
      };
      s = { ...s, tasks: [...s.tasks, task] };
    }
  }
  const members = new Set<EmployeeId>([...p.memberIds, ...LIFECYCLE.flatMap((st) => st.tasks.map((t) => t.assigneeId))]);
  s = { ...s, projects: replace(s.projects, { ...findProject(s, projectId), memberIds: [...members], updatedAt: ctx.now }) };
  s = log(s, ctx, "project", "workflow_started", { id: projectId, name: p.name, count: String(idByKey.size) }, { type: "project", id: projectId });
  return bump(s);
}

// ---------------------------------------------------------------- tasks

export type TaskInput = Pick<
  Task,
  | "title"
  | "description"
  | "projectId"
  | "assigneeId"
  | "priority"
  | "dueDate"
  | "dependencies"
  | "acceptanceCriteria"
  | "requiredInputs"
  | "expectedOutput"
  | "attachments"
  | "protectedAction"
>;

export function createTask(state: CompanyState, ctx: Ctx, input: TaskInput): [CompanyState, string] {
  require(ctx, "write");
  nonEmpty(input.title, "title");
  findProject(state, input.projectId);
  assertEmployee(state, input.assigneeId);
  input.dependencies.forEach((d) => findTask(state, d));
  let [id, s] = nextId(state, "TSK");
  const task: Task = {
    ...input,
    id,
    title: input.title.trim(),
    status: input.assigneeId ? "assigned" : "backlog",
    comments: [],
    history: [{ at: ctx.now, actor: ctx.actor, key: "created", params: {} }],
    stage: null,
    reviewRounds: 0,
    createdAt: ctx.now,
    updatedAt: ctx.now,
    startedAt: null,
    completedAt: null,
    sample: false,
  };
  s = { ...s, tasks: [...s.tasks, task] };
  s = log(s, ctx, "task", "task_created", { id, title: task.title }, { type: "task", id });
  if (input.assigneeId) {
    s = log(s, ctx, "assignment", "task_assigned", { id, title: task.title, employee: input.assigneeId }, { type: "task", id });
  }
  return [bump(s), id];
}

export function updateTask(state: CompanyState, ctx: Ctx, id: string, patch: Partial<TaskInput>): CompanyState {
  require(ctx, "write");
  const t = findTask(state, id);
  if (patch.title !== undefined) nonEmpty(patch.title, "title");
  if (patch.assigneeId !== undefined) assertEmployee(state, patch.assigneeId);
  if (patch.dependencies) {
    patch.dependencies.forEach((d) => {
      if (d === id) throw new DomainError("self_dependency");
      findTask(state, d);
    });
    if (createsCycle(state, id, patch.dependencies)) throw new DomainError("dependency_cycle");
  }
  const history = [...t.history];
  const reassigned = patch.assigneeId !== undefined && patch.assigneeId !== t.assigneeId;
  if (reassigned) history.push({ at: ctx.now, actor: ctx.actor, key: "reassigned", params: { to: patch.assigneeId ?? "—" } });
  else history.push({ at: ctx.now, actor: ctx.actor, key: "updated", params: {} });
  let status = t.status;
  if (reassigned && patch.assigneeId && status === "backlog") status = "assigned";
  const next: Task = { ...t, ...patch, status, history, updatedAt: ctx.now };
  let s: CompanyState = { ...state, tasks: replace(state.tasks, next) };
  if (reassigned && patch.assigneeId) {
    s = log(s, ctx, "assignment", "task_assigned", { id, title: next.title, employee: patch.assigneeId }, { type: "task", id });
  } else {
    s = log(s, ctx, "task", "task_updated", { id, title: next.title }, { type: "task", id });
  }
  return bump(s);
}

function createsCycle(state: CompanyState, taskId: string, deps: string[]): boolean {
  const byId = new Map(state.tasks.map((t) => [t.id, t.id === taskId ? deps : t.dependencies]));
  const seen = new Set<string>();
  const stack = [...deps];
  while (stack.length) {
    const cur = stack.pop()!;
    if (cur === taskId) return true;
    if (seen.has(cur)) continue;
    seen.add(cur);
    stack.push(...(byId.get(cur) ?? []));
  }
  return false;
}

export function openDependencies(state: CompanyState, task: Task): Task[] {
  return task.dependencies
    .map((d) => state.tasks.find((t) => t.id === d))
    .filter((t): t is Task => !!t && t.status !== "completed" && t.status !== "cancelled");
}

function hasApproved(state: CompanyState, ref: { taskId?: string; projectId?: string }, action?: ProtectedAction) {
  return state.approvals.some(
    (a) =>
      a.status === "approved" &&
      (ref.taskId ? a.taskId === ref.taskId : a.projectId === ref.projectId) &&
      (!action || a.action === action),
  );
}

export function setTaskStatus(state: CompanyState, ctx: Ctx, id: string, status: TaskStatus, note = ""): CompanyState {
  require(ctx, "write");
  const t = findTask(state, id);
  if (t.status === status) return state;
  if (!TASK_TRANSITIONS[t.status].includes(status)) {
    throw new DomainError("invalid_transition", { from: t.status, to: status });
  }
  if (status === "in_progress") {
    if (!t.assigneeId) throw new DomainError("no_assignee");
    const open = openDependencies(state, t);
    if (open.length) throw new DomainError("dependencies_open", { ids: open.map((d) => d.id).join(", ") });
  }
  if (status === "completed" && t.protectedAction && !hasApproved(state, { taskId: id }, t.protectedAction)) {
    throw new DomainError("approval_required");
  }

  let s = state;
  if (status === "awaiting_ceo_approval") {
    if (!t.protectedAction) throw new DomainError("not_protected");
    const pending = state.approvals.some((a) => a.taskId === id && a.status === "pending");
    if (!pending) {
      [s] = createApprovalInternal(s, ctx, {
        action: t.protectedAction,
        title: t.title,
        requestedBy: t.assigneeId ?? ctx.actor,
        reason: note || t.expectedOutput || t.title,
        impact: t.description || t.expectedOutput,
        risk: PROTECTED_ACTION_RISK[t.protectedAction],
        supportingFiles: t.attachments,
        projectId: t.projectId,
        taskId: id,
      });
    }
  }

  const reviewRounds = status === "changes_requested" ? t.reviewRounds + 1 : t.reviewRounds;
  const next: Task = {
    ...findTask(s, id),
    status,
    reviewRounds,
    startedAt: status === "in_progress" && !t.startedAt ? ctx.now : t.startedAt,
    completedAt: status === "completed" ? ctx.now : status === "changes_requested" ? null : t.completedAt,
    updatedAt: ctx.now,
    history: [...t.history, { at: ctx.now, actor: ctx.actor, key: "status", params: { from: t.status, to: status, ...(note ? { note } : {}) } }],
  };
  s = { ...s, tasks: replace(s.tasks, next) };
  const type: ActivityType = status === "changes_requested" || status === "under_review" ? "review" : "task";
  s = log(s, ctx, type, "task_status", { id, title: t.title, from: t.status, to: status }, { type: "task", id });
  s = unblockDependents(s, ctx, next);
  return bump(s);
}

/** When a task completes, dependents whose inputs are now all available move from backlog to assigned. */
function unblockDependents(state: CompanyState, ctx: Ctx, task: Task): CompanyState {
  if (task.status !== "completed") return state;
  let s = state;
  for (const dep of state.tasks.filter((x) => x.dependencies.includes(task.id))) {
    if (dep.status === "backlog" && dep.assigneeId && openDependencies(s, dep).length === 0) {
      const next: Task = {
        ...dep,
        status: "assigned",
        updatedAt: ctx.now,
        history: [...dep.history, { at: ctx.now, actor: "system", key: "inputs_ready", params: { from: task.id } }],
      };
      s = { ...s, tasks: replace(s.tasks, next) };
      s = log(s, { ...ctx, actor: "system" }, "assignment", "task_ready", { id: dep.id, title: dep.title, employee: dep.assigneeId }, { type: "task", id: dep.id });
    }
  }
  return s;
}

export function addTaskComment(state: CompanyState, ctx: Ctx, id: string, body: string): CompanyState {
  require(ctx, "write");
  nonEmpty(body, "comment");
  const t = findTask(state, id);
  let [cid, s] = nextId(state, "CMT");
  const next: Task = { ...t, comments: [...t.comments, { id: cid, authorId: ctx.actor, body: body.trim(), at: ctx.now }], updatedAt: ctx.now };
  s = { ...s, tasks: replace(s.tasks, next) };
  s = log(s, ctx, "message", "task_commented", { id, title: t.title }, { type: "task", id });
  return bump(s);
}

export function deleteTask(state: CompanyState, ctx: Ctx, id: string): CompanyState {
  require(ctx, "delete");
  const t = findTask(state, id);
  let s: CompanyState = {
    ...state,
    tasks: state.tasks.filter((x) => x.id !== id).map((x) => ({ ...x, dependencies: x.dependencies.filter((d) => d !== id) })),
    executions: state.executions.map((e) => (e.taskId === id ? { ...e, taskId: null } : e)),
    approvals: state.approvals.map((a) => (a.taskId === id ? { ...a, taskId: null } : a)),
  };
  s = log(s, ctx, "data", "task_deleted", { id, title: t.title });
  return bump(s);
}

// ---------------------------------------------------------------- approvals

type ApprovalInput = Omit<Approval, "id" | "status" | "decisionNote" | "createdAt" | "decidedAt" | "sample" | "decidedBy">;

function createApprovalInternal(state: CompanyState, ctx: Ctx, input: ApprovalInput): [CompanyState, string] {
  nonEmpty(input.title, "title");
  nonEmpty(input.reason, "reason");
  let [id, s] = nextId(state, "APR");
  const approval: Approval = { ...input, id, status: "pending", decisionNote: "", createdAt: ctx.now, decidedAt: null, sample: false };
  s = { ...s, approvals: [approval, ...s.approvals] };
  s = log(s, ctx, "approval", "approval_requested", { id, title: approval.title, action: approval.action }, { type: "approval", id });
  return [s, id];
}

export function createApproval(state: CompanyState, ctx: Ctx, input: ApprovalInput): [CompanyState, string] {
  require(ctx, "write");
  assertEmployee(state, input.requestedBy === "ceo" || input.requestedBy === "system" ? null : input.requestedBy);
  const [s, id] = createApprovalInternal(state, ctx, input);
  return [bump(s), id];
}

export function decideApproval(
  state: CompanyState,
  ctx: Ctx,
  id: string,
  decision: "approved" | "rejected",
  note: string,
): CompanyState {
  const a = state.approvals.find((x) => x.id === id);
  if (!a) throw new DomainError("not_found", { id });
  // The CEO decides anything; the COO decides delivery approvals within delegated authority.
  const cooDecides = ctx.actor === COO_ID && APPROVAL_LEVEL[a.action] === "coo";
  if (!cooDecides) require(ctx, "decide_approvals");
  if (a.status !== "pending") throw new DomainError("already_decided");
  if (decision === "rejected") nonEmpty(note, "decision_note");

  let s: CompanyState = {
    ...state,
    approvals: replace(state.approvals, { ...a, status: decision, decisionNote: note.trim(), decidedAt: ctx.now, decidedBy: ctx.actor }),
  };
  s = log(s, ctx, decision === "approved" ? "approval" : "rejection", decision === "approved" ? "approval_granted" : "approval_rejected", { id, title: a.title }, { type: "approval", id });

  // Effects on the linked task: approval completes it; rejection sends it back for changes.
  if (a.taskId) {
    const t = s.tasks.find((x) => x.id === a.taskId);
    if (t && t.status === "awaiting_ceo_approval") {
      const to: TaskStatus = decision === "approved" ? "completed" : "changes_requested";
      const next: Task = {
        ...t,
        status: to,
        reviewRounds: to === "changes_requested" ? t.reviewRounds + 1 : t.reviewRounds,
        completedAt: to === "completed" ? ctx.now : null,
        updatedAt: ctx.now,
        history: [...t.history, { at: ctx.now, actor: ctx.actor, key: "status", params: { from: t.status, to, note: note || a.id } }],
      };
      s = { ...s, tasks: replace(s.tasks, next) };
      s = log(s, ctx, "task", "task_status", { id: t.id, title: t.title, from: t.status, to }, { type: "task", id: t.id });
      s = unblockDependents(s, ctx, next);
    }
  }
  // Effects on the linked project (release approvals).
  if (a.projectId && !a.taskId) {
    const p = s.projects.find((x) => x.id === a.projectId);
    if (p && p.status === "awaiting_ceo_approval") {
      const to: ProjectStatus = decision === "approved" ? "ready_for_delivery" : "review";
      s = { ...s, projects: replace(s.projects, { ...p, status: to, updatedAt: ctx.now }) };
      s = log(s, ctx, "project", "project_status", { id: p.id, name: p.name, from: p.status, to }, { type: "project", id: p.id });
    }
  }
  return bump(s);
}

// ---------------------------------------------------------------- executions

export interface ExecutionInput {
  employeeId: EmployeeId;
  taskId: string | null;
  projectId: string | null;
  title: string;
  instructions: string;
  attachments: LinkRef[];
  channel: Execution["channel"];
  parentId?: string | null;
}

export function createExecution(state: CompanyState, ctx: Ctx, input: ExecutionInput): [CompanyState, string] {
  require(ctx, "write");
  nonEmpty(input.title, "title");
  nonEmpty(input.instructions, "instructions");
  assertEmployee(state, input.employeeId);
  const emp = state.employees.find((e) => e.id === input.employeeId)!;
  if (emp.availability === "unavailable") throw new DomainError("employee_unavailable", { name: emp.name.en });
  let projectId = input.projectId;
  if (input.taskId) {
    const t = findTask(state, input.taskId);
    projectId = t.projectId;
  }
  if (projectId) findProject(state, projectId);

  let [id, s] = nextId(state, "EXE");
  const exe: Execution = {
    id,
    employeeId: input.employeeId,
    taskId: input.taskId,
    projectId,
    title: input.title.trim(),
    instructions: input.instructions.trim(),
    attachments: input.attachments,
    channel: input.channel,
    status: "queued",
    createdAt: ctx.now,
    startedAt: null,
    endedAt: null,
    logs: [{ at: ctx.now, message: "Assignment created; waiting for an authorized Claude session to run it." }],
    summary: "",
    output: "",
    errors: [],
    openQuestions: [],
    reviewStatus: "not_submitted",
    reviewNotes: "",
    parentId: input.parentId ?? null,
    handoffSuggestion: null,
    sample: false,
  };
  s = { ...s, executions: [exe, ...s.executions] };
  s = log(s, ctx, "assignment", "execution_created", { id, title: exe.title, employee: exe.employeeId }, { type: "execution", id });

  // Assigning work through the execution center also assigns the task.
  if (input.taskId) {
    const t = findTask(s, input.taskId);
    if (t.assigneeId !== input.employeeId || t.status === "backlog") {
      const next: Task = {
        ...t,
        assigneeId: input.employeeId,
        status: t.status === "backlog" ? "assigned" : t.status,
        updatedAt: ctx.now,
        history: [...t.history, { at: ctx.now, actor: ctx.actor, key: "execution_linked", params: { id } }],
      };
      s = { ...s, tasks: replace(s.tasks, next) };
    }
  }
  return [bump(s), id];
}

/** The CEO marks that they have started the assignment in Claude Code / Claude chat. */
export function markExecutionInSession(state: CompanyState, ctx: Ctx, id: string): CompanyState {
  require(ctx, "write");
  const e = findExecution(state, id);
  if (e.status !== "queued") throw new DomainError("invalid_transition", { from: e.status, to: "in_session" });
  let s: CompanyState = {
    ...state,
    executions: replace(state.executions, {
      ...e,
      status: "in_session",
      logs: [...e.logs, { at: ctx.now, message: "Marked as started in a Claude session by the CEO." }],
    }),
  };
  if (e.taskId) {
    const t = s.tasks.find((x) => x.id === e.taskId);
    if (t && (t.status === "assigned" || t.status === "changes_requested") && openDependencies(s, t).length === 0) {
      s = { ...s, tasks: replace(s.tasks, { ...t, status: "in_progress", startedAt: t.startedAt ?? ctx.now, updatedAt: ctx.now, history: [...t.history, { at: ctx.now, actor: ctx.actor, key: "status", params: { from: t.status, to: "in_progress" } }] }) };
    }
  }
  s = log(s, ctx, "execution", "execution_started", { id, title: e.title }, { type: "execution", id });
  return bump(s);
}

export function cancelExecution(state: CompanyState, ctx: Ctx, id: string): CompanyState {
  require(ctx, "write");
  const e = findExecution(state, id);
  if (!["queued", "in_session", "needs_input"].includes(e.status)) {
    throw new DomainError("invalid_transition", { from: e.status, to: "cancelled" });
  }
  let s: CompanyState = { ...state, executions: replace(state.executions, { ...e, status: "cancelled", logs: [...e.logs, { at: ctx.now, message: "Cancelled." }] }) };
  s = log(s, ctx, "execution", "execution_cancelled", { id, title: e.title }, { type: "execution", id });
  return bump(s);
}

/** Records the result produced by an authorized Claude session. The result must reference this execution. */
export function importExecutionResult(state: CompanyState, ctx: Ctx, result: ExecutionResult): CompanyState {
  require(ctx, "write");
  const e = findExecution(state, result.executionId);
  if (result.employeeId !== e.employeeId) {
    throw new DomainError("result_mismatch", { expected: e.employeeId, got: result.employeeId });
  }
  if (!["queued", "in_session", "needs_input"].includes(e.status)) throw new DomainError("result_already_recorded");
  if (result.handoff) assertEmployee(state, result.handoff.to);

  const logs = [
    ...e.logs,
    ...result.logs.map((l) => ({ at: l.at ?? result.endedAt ?? ctx.now, message: l.message })),
    { at: ctx.now, message: `Result imported (${result.status}) from ${result.channel === "claude_chat" ? "Claude chat" : "Claude Code"}.` },
  ];
  const next: Execution = {
    ...e,
    status: result.status,
    startedAt: result.startedAt ?? e.startedAt,
    endedAt: result.endedAt ?? ctx.now,
    logs,
    summary: result.summary,
    output: result.output,
    errors: result.errors,
    openQuestions: result.openQuestions,
    reviewStatus: result.status === "completed" ? "pending" : "not_submitted",
    handoffSuggestion: result.handoff ?? null,
  };
  let s: CompanyState = { ...state, executions: replace(state.executions, next) };
  s = log(s, ctx, result.status === "failed" ? "error" : "execution", "execution_result", { id: e.id, title: e.title, status: result.status }, { type: "execution", id: e.id });

  for (const d of result.deliverables) {
    let did: string;
    [did, s] = nextId(s, "DLV");
    const deliverable: Deliverable = {
      id: did,
      title: d.title,
      type: d.type,
      projectId: e.projectId,
      taskId: e.taskId,
      executionId: e.id,
      ownerId: e.employeeId,
      location: d.location,
      description: d.description ?? "",
      version: "1",
      status: "in_review",
      createdAt: ctx.now,
      sample: false,
    };
    s = { ...s, deliverables: [deliverable, ...s.deliverables] };
    s = log(s, ctx, "data", "deliverable_recorded", { id: did, title: d.title }, { type: "deliverable", id: did });
  }

  // A completed result puts the linked task under review; "needs input" blocks it.
  if (e.taskId) {
    const t = s.tasks.find((x) => x.id === e.taskId);
    if (t) {
      let to: TaskStatus | null = null;
      if (result.status === "completed" && ["assigned", "in_progress", "changes_requested"].includes(t.status)) to = "under_review";
      if (result.status === "needs_input" && ["assigned", "in_progress"].includes(t.status)) to = "blocked";
      if (to) {
        s = {
          ...s,
          tasks: replace(s.tasks, {
            ...t,
            status: to,
            startedAt: t.startedAt ?? next.startedAt,
            updatedAt: ctx.now,
            history: [...t.history, { at: ctx.now, actor: e.employeeId, key: "status", params: { from: t.status, to, note: e.id } }],
          }),
        };
        s = log(s, { ...ctx, actor: e.employeeId }, to === "blocked" ? "task" : "review", "task_status", { id: t.id, title: t.title, from: t.status, to }, { type: "task", id: t.id });
      }
    }
  }
  return bump(s);
}

export function reviewExecution(
  state: CompanyState,
  ctx: Ctx,
  id: string,
  decision: "approved" | "changes_requested",
  notes: string,
): CompanyState {
  require(ctx, "write");
  const e = findExecution(state, id);
  if (e.reviewStatus !== "pending") throw new DomainError("not_reviewable");
  if (decision === "changes_requested") nonEmpty(notes, "review_notes");
  let s: CompanyState = {
    ...state,
    executions: replace(state.executions, {
      ...e,
      reviewStatus: decision,
      reviewNotes: notes.trim(),
      logs: [...e.logs, { at: ctx.now, message: decision === "approved" ? "Output approved." : "Changes requested." }],
    }),
    deliverables:
      decision === "approved"
        ? state.deliverables.map((d) => (d.executionId === id ? { ...d, status: "approved" as const } : d))
        : state.deliverables,
  };
  s = log(s, ctx, "review", decision === "approved" ? "execution_approved" : "execution_changes", { id, title: e.title }, { type: "execution", id });

  if (e.taskId) {
    const t = s.tasks.find((x) => x.id === e.taskId);
    if (t && t.status === "under_review") {
      if (decision === "changes_requested") {
        s = setTaskStatus(s, ctx, t.id, "changes_requested", notes);
      } else if (t.protectedAction) {
        s = setTaskStatus(s, ctx, t.id, "awaiting_ceo_approval", e.summary || e.title);
      } else {
        s = setTaskStatus(s, ctx, t.id, "completed", e.id);
      }
    }
  }
  return bump(s);
}

/** Creates a follow-up assignment: a revision for the same employee, or a handoff to the next one. */
export function createFollowUp(
  state: CompanyState,
  ctx: Ctx,
  fromId: string,
  input: { employeeId: EmployeeId; instructions: string; taskId?: string | null },
): [CompanyState, string] {
  const prev = findExecution(state, fromId);
  const isRevision = input.employeeId === prev.employeeId;
  const [s, id] = createExecution(state, ctx, {
    employeeId: input.employeeId,
    taskId: input.taskId !== undefined ? input.taskId : isRevision ? prev.taskId : null,
    projectId: prev.projectId,
    title: isRevision ? `${prev.title} (revision)` : `Handoff: ${prev.title}`,
    instructions: input.instructions,
    attachments: prev.attachments,
    channel: prev.channel,
    parentId: prev.id,
  });
  let out = log(s, ctx, "assignment", isRevision ? "execution_revision" : "execution_handoff", { id, from: prev.id, employee: input.employeeId }, { type: "execution", id });
  // Handoffs are recorded in the project discussion so collaboration between employees is visible.
  if (!isRevision && prev.projectId) {
    const fromName = out.employees.find((e) => e.id === prev.employeeId)?.name.en ?? prev.employeeId;
    const toName = out.employees.find((e) => e.id === input.employeeId)?.name.en ?? input.employeeId;
    let mid: string;
    [mid, out] = nextId(out, "MSG");
    out = {
      ...out,
      messages: [
        ...out.messages,
        { id: mid, kind: "project", refId: prev.projectId, authorId: "system", body: `Handoff recorded: ${fromName} → ${toName} (${prev.id} → ${id}).`, at: ctx.now, sample: false },
      ],
    };
  }
  return [out, id];
}

// ---------------------------------------------------------------- employees

export function setAvailability(state: CompanyState, ctx: Ctx, id: EmployeeId, availability: Availability): CompanyState {
  require(ctx, "write");
  const emp = state.employees.find((e) => e.id === id);
  if (!emp) throw new DomainError("unknown_employee", { id });
  let s: CompanyState = { ...state, employees: state.employees.map((e) => (e.id === id ? { ...e, availability } : e)) };
  s = log(s, ctx, "config", "availability_changed", { employee: id, to: availability }, { type: "employee", id });
  return bump(s);
}

export function updateInstructions(state: CompanyState, ctx: Ctx, id: EmployeeId, systemInstructions: string): CompanyState {
  require(ctx, "edit_instructions");
  nonEmpty(systemInstructions, "instructions");
  if (systemInstructions.length > 20000) throw new DomainError("too_long", { max: "20000" });
  const emp = state.employees.find((e) => e.id === id);
  if (!emp) throw new DomainError("unknown_employee", { id });
  let s: CompanyState = { ...state, employees: state.employees.map((e) => (e.id === id ? { ...e, systemInstructions } : e)) };
  s = log(s, ctx, "config", "instructions_changed", { employee: id }, { type: "employee", id });
  return bump(s);
}

// ---------------------------------------------------------------- communication, deliverables, knowledge

export function postMessage(
  state: CompanyState,
  ctx: Ctx,
  input: { kind: ChannelKind; refId: string | null; body: string; authorId?: EmployeeId | "ceo" },
): CompanyState {
  require(ctx, "write");
  nonEmpty(input.body, "message");
  if (input.body.length > 5000) throw new DomainError("too_long", { max: "5000" });
  if (input.kind === "announcement" && ctx.role !== "ceo") throw new DomainError("permission_denied", { permission: "announce" });
  const author: ActorId = input.authorId ?? ctx.actor;
  // The direct line is only between the CEO and the COO.
  if (input.kind === "direct" && author !== "ceo" && author !== COO_ID) throw new DomainError("permission_denied", { permission: "direct_line" });
  if (author !== "ceo" && author !== "system") assertEmployee(state, author);
  let [id, s] = nextId(state, "MSG");
  s = { ...s, messages: [...s.messages, { id, kind: input.kind, refId: input.refId, authorId: author, body: input.body.trim(), at: ctx.now, sample: false }] };
  s = log(s, ctx, "message", input.kind === "decision" ? "decision_recorded" : "message_posted", { id, kind: input.kind });
  return bump(s);
}

export type DeliverableInput = Omit<Deliverable, "id" | "createdAt" | "sample" | "executionId"> & { executionId?: string | null };

export function upsertDeliverable(state: CompanyState, ctx: Ctx, input: DeliverableInput & { id?: string }): [CompanyState, string] {
  require(ctx, "write");
  nonEmpty(input.title, "title");
  nonEmpty(input.location, "location");
  if (/(api[_-]?key|secret|password|token)=/i.test(input.location)) throw new DomainError("looks_like_secret");
  let s = state;
  let id = input.id;
  if (id) {
    const existing = state.deliverables.find((d) => d.id === id);
    if (!existing) throw new DomainError("not_found", { id });
    s = { ...s, deliverables: replace(s.deliverables, { ...existing, ...input, id, executionId: input.executionId ?? existing.executionId }) };
    s = log(s, ctx, "data", "deliverable_updated", { id, title: input.title }, { type: "deliverable", id });
  } else {
    [id, s] = nextId(s, "DLV");
    s = { ...s, deliverables: [{ ...input, id, executionId: input.executionId ?? null, createdAt: ctx.now, sample: false }, ...s.deliverables] };
    s = log(s, ctx, "data", "deliverable_recorded", { id, title: input.title }, { type: "deliverable", id });
  }
  return [bump(s), id];
}

export function deleteDeliverable(state: CompanyState, ctx: Ctx, id: string): CompanyState {
  require(ctx, "delete");
  const d = state.deliverables.find((x) => x.id === id);
  if (!d) throw new DomainError("not_found", { id });
  let s: CompanyState = { ...state, deliverables: state.deliverables.filter((x) => x.id !== id) };
  s = log(s, ctx, "data", "deliverable_deleted", { id, title: d.title });
  return bump(s);
}

export function upsertArticle(
  state: CompanyState,
  ctx: Ctx,
  input: Pick<KnowledgeArticle, "title" | "category" | "body" | "tags"> & { id?: string },
): [CompanyState, string] {
  require(ctx, "write");
  nonEmpty(input.title, "title");
  nonEmpty(input.body, "body");
  let s = state;
  let id = input.id;
  if (id) {
    const existing = state.knowledge.find((k) => k.id === id);
    if (!existing) throw new DomainError("not_found", { id });
    s = { ...s, knowledge: replace(s.knowledge, { ...existing, ...input, id, updatedAt: ctx.now }) };
    s = log(s, ctx, "knowledge", "article_updated", { id, title: input.title }, { type: "knowledge", id });
  } else {
    [id, s] = nextId(s, "KB");
    s = { ...s, knowledge: [...s.knowledge, { ...input, id, authorId: ctx.actor, updatedAt: ctx.now }] };
    s = log(s, ctx, "knowledge", "article_created", { id, title: input.title }, { type: "knowledge", id });
  }
  return [bump(s), id];
}

export function deleteArticle(state: CompanyState, ctx: Ctx, id: string): CompanyState {
  require(ctx, "delete");
  const k = state.knowledge.find((x) => x.id === id);
  if (!k) throw new DomainError("not_found", { id });
  let s: CompanyState = { ...state, knowledge: state.knowledge.filter((x) => x.id !== id) };
  s = log(s, ctx, "data", "article_deleted", { id, title: k.title });
  return bump(s);
}

// ---------------------------------------------------------------- settings & data

export function updateSettings(state: CompanyState, ctx: Ctx, patch: Partial<Settings>): CompanyState {
  // Theme and language are personal display preferences; everything else is company configuration.
  const displayOnly = Object.keys(patch).every((k) => k === "theme" || k === "locale");
  if (!displayOnly) require(ctx, "manage_settings");
  let s: CompanyState = { ...state, settings: { ...state.settings, ...patch } };
  if (!displayOnly) s = log(s, ctx, "config", "settings_changed", { fields: Object.keys(patch).join(", ") });
  return bump(s);
}

export function setDepartmentManager(state: CompanyState, ctx: Ctx, departmentId: string, managerId: EmployeeId): CompanyState {
  require(ctx, "manage_settings");
  const d = state.departments.find((x) => x.id === departmentId);
  if (!d) throw new DomainError("not_found", { id: departmentId });
  const emp = state.employees.find((e) => e.id === managerId);
  if (!emp || emp.departmentId !== d.id) throw new DomainError("unknown_employee", { id: managerId });
  let s: CompanyState = { ...state, departments: state.departments.map((x) => (x.id === departmentId ? { ...x, managerId } : x)) };
  s = log(s, ctx, "config", "settings_changed", { fields: `${departmentId}.manager` });
  return bump(s);
}

/** Switching the session role is how a CEO previews restricted views; it is not a security boundary in local mode. */
export function setRole(state: CompanyState, ctx: Ctx, role: Role): CompanyState {
  let s: CompanyState = { ...state, settings: { ...state.settings, role } };
  s = log(s, ctx, "config", "role_changed", { to: role });
  return bump(s);
}

export function clearSampleData(state: CompanyState, ctx: Ctx): CompanyState {
  require(ctx, "delete");
  const sampleProjects = new Set(state.projects.filter((p) => p.sample).map((p) => p.id));
  const count =
    state.projects.filter((p) => p.sample).length +
    state.tasks.filter((t) => t.sample).length +
    state.executions.filter((e) => e.sample).length +
    state.approvals.filter((a) => a.sample).length +
    state.messages.filter((m) => m.sample).length +
    state.deliverables.filter((d) => d.sample).length;
  let s: CompanyState = {
    ...state,
    projects: state.projects.filter((p) => !p.sample),
    tasks: state.tasks.filter((t) => !t.sample && !sampleProjects.has(t.projectId)),
    executions: state.executions.filter((e) => !e.sample),
    approvals: state.approvals.filter((a) => !a.sample),
    messages: state.messages.filter((m) => !m.sample && !(m.refId && sampleProjects.has(m.refId))),
    deliverables: state.deliverables.filter((d) => !d.sample),
    activity: state.activity.filter((a) => !(a.params.sample === "true")),
  };
  s = log(s, ctx, "data", "sample_cleared", { count: String(count) });
  return bump(s);
}
