import { z } from "zod";
import {
  ACTIVITY_TYPES,
  CHANNEL_KINDS,
  DELIVERABLE_TYPES,
  EXECUTION_STATUSES,
  KNOWLEDGE_CATEGORIES,
  PRIORITIES,
  PROJECT_STATUSES,
  PROTECTED_ACTIONS,
  REVIEW_STATUSES,
  TASK_STATUSES,
  type CompanyState,
} from "./types";

// Validates a full company export before it replaces local data. Unknown extra
// fields are stripped; missing or mistyped required fields reject the import.

const id = z.string().min(1).max(64);
const text = z.string().max(200_000);
const link = z.object({ label: z.string().max(500), url: z.string().max(2000) });
const l10n = z.object({ en: z.string(), ar: z.string() });
const empId = z.string().regex(/^EMP-\d{3}$/);
const actor = z.union([z.literal("ceo"), z.literal("system"), empId]);

const employee = z.object({
  id: empId,
  slug: z.string().regex(/^[a-z0-9-]+$/),
  name: l10n,
  title: l10n,
  departmentId: z.enum(["executive", "design", "engineering", "qa"]),
  seniority: z.enum(["Senior", "Executive"]),
  experiencePositioning: text,
  bio: l10n,
  coreExpertise: z.array(z.string()),
  technicalSkills: z.array(z.string()),
  secondarySkills: z.array(z.string()),
  responsibilities: z.array(z.string()),
  authority: z.array(z.string()),
  accepts: z.array(z.string()),
  rejectsOrEscalates: z.array(z.string()),
  tools: z.array(z.string()),
  restrictedActions: z.array(z.string()),
  requiredInputs: z.array(z.string()),
  deliverables: z.array(z.string()),
  qualityStandards: z.array(z.string()),
  qualityChecklist: z.array(z.string()),
  kpis: z.array(z.string()),
  reportsTo: z.union([z.literal("ceo"), empId]),
  collaborators: z.array(empId),
  communicationStyle: text,
  methodology: z.array(z.string()),
  outputFormat: text,
  systemInstructions: z.string().min(1).max(20_000),
  availability: z.enum(["available", "busy", "unavailable"]),
});

const project = z.object({
  id,
  name: z.string().min(1).max(300),
  client: z.string().max(300),
  description: text,
  businessRequirements: text,
  technicalRequirements: text,
  scope: text,
  budget: z.number().nonnegative().nullable(),
  priority: z.enum(PRIORITIES),
  startDate: z.string(),
  targetDate: z.string(),
  managerId: empId,
  memberIds: z.array(empId),
  milestones: z.array(z.object({ id, title: z.string(), dueDate: z.string(), done: z.boolean() })),
  risks: z.array(z.object({ id, description: z.string(), severity: z.enum(["low", "medium", "high"]), mitigation: z.string() })),
  dependencies: z.array(z.string()),
  status: z.enum(PROJECT_STATUSES),
  createdAt: z.string(),
  updatedAt: z.string(),
  sample: z.boolean(),
});

const history = z.object({ at: z.string(), actor, key: z.string(), params: z.record(z.string(), z.string()).optional() });

const task = z.object({
  id,
  title: z.string().min(1).max(500),
  description: text,
  projectId: id,
  assigneeId: empId.nullable(),
  priority: z.enum(PRIORITIES),
  status: z.enum(TASK_STATUSES),
  dueDate: z.string().nullable(),
  dependencies: z.array(id),
  acceptanceCriteria: z.array(z.string()),
  requiredInputs: text,
  expectedOutput: text,
  attachments: z.array(link),
  comments: z.array(z.object({ id, authorId: actor, body: text, at: z.string() })),
  history: z.array(history),
  stage: z.string().nullable(),
  protectedAction: z.enum(PROTECTED_ACTIONS).nullable(),
  reviewRounds: z.number().int().nonnegative(),
  createdAt: z.string(),
  updatedAt: z.string(),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  sample: z.boolean(),
});

const execution = z.object({
  id,
  employeeId: empId,
  taskId: id.nullable(),
  projectId: id.nullable(),
  title: z.string().min(1),
  instructions: text,
  attachments: z.array(link),
  channel: z.enum(["claude_code", "claude_chat"]),
  status: z.enum(EXECUTION_STATUSES),
  createdAt: z.string(),
  startedAt: z.string().nullable(),
  endedAt: z.string().nullable(),
  logs: z.array(z.object({ at: z.string(), message: z.string() })),
  summary: text,
  output: text,
  errors: z.array(z.string()),
  openQuestions: z.array(z.string()),
  reviewStatus: z.enum(REVIEW_STATUSES),
  reviewNotes: text,
  parentId: id.nullable(),
  handoffSuggestion: z.object({ to: empId, note: z.string() }).nullable(),
  sample: z.boolean(),
});

const approval = z.object({
  id,
  action: z.enum(PROTECTED_ACTIONS),
  title: z.string().min(1),
  requestedBy: actor,
  reason: text,
  impact: text,
  risk: z.enum(["low", "medium", "high", "critical"]),
  supportingFiles: z.array(link),
  projectId: id.nullable(),
  taskId: id.nullable(),
  status: z.enum(["pending", "approved", "rejected"]),
  decisionNote: text,
  createdAt: z.string(),
  decidedAt: z.string().nullable(),
  sample: z.boolean(),
});

export const companyStateSchema = z.object({
  schema: z.literal("aicos.state/v1"),
  revision: z.number().int().nonnegative(),
  counters: z.record(z.string(), z.number().int().nonnegative()),
  settings: z.object({
    companyName: z.string().max(200),
    tagline: z.string().max(300),
    companyEmail: z.string().max(200),
    founderName: z.string().max(200),
    founderTitle: z.string().max(200),
    theme: z.enum(["light", "dark", "system"]),
    locale: z.enum(["en", "ar"]),
    role: z.enum(["ceo", "operator", "viewer"]),
    notifications: z.object({ approvals: z.boolean(), blockedTasks: z.boolean(), reviews: z.boolean() }),
    projectDefaults: z.object({ priority: z.enum(PRIORITIES), durationDays: z.number().int().min(1).max(3650) }),
    includeSampleInAnalytics: z.boolean(),
    github: z.object({ repoUrl: z.string().max(500), pagesUrl: z.string().max(500) }),
  }),
  departments: z.array(
    z.object({
      id: z.enum(["executive", "design", "engineering", "qa"]),
      name: l10n,
      description: l10n,
      managerId: empId,
      responsibilities: z.array(z.string()),
      colorSlot: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
    }),
  ),
  employees: z.array(employee).min(1),
  projects: z.array(project),
  tasks: z.array(task),
  executions: z.array(execution),
  approvals: z.array(approval),
  messages: z.array(
    z.object({ id, kind: z.enum(CHANNEL_KINDS), refId: z.string().nullable(), authorId: actor, body: text, at: z.string(), sample: z.boolean() }),
  ),
  deliverables: z.array(
    z.object({
      id,
      title: z.string().min(1),
      type: z.enum(DELIVERABLE_TYPES),
      projectId: id.nullable(),
      taskId: id.nullable(),
      executionId: id.nullable(),
      ownerId: actor,
      location: z.string().max(2000),
      description: text,
      version: z.string().max(50),
      status: z.enum(["draft", "in_review", "approved"]),
      createdAt: z.string(),
      sample: z.boolean(),
    }),
  ),
  knowledge: z.array(
    z.object({
      id,
      title: z.string().min(1),
      category: z.enum(KNOWLEDGE_CATEGORIES),
      body: text,
      tags: z.array(z.string()),
      authorId: actor,
      updatedAt: z.string(),
    }),
  ),
  activity: z.array(
    z.object({
      id,
      at: z.string(),
      actor,
      type: z.enum(ACTIVITY_TYPES),
      key: z.string(),
      params: z.record(z.string(), z.string()),
      refType: z.enum(["project", "task", "execution", "approval", "employee", "knowledge", "deliverable"]).nullable(),
      refId: z.string().nullable(),
    }),
  ),
});

export type StateParse = { ok: true; state: CompanyState } | { ok: false; issues: string[] };

export function parseCompanyState(raw: unknown): StateParse {
  const parsed = companyStateSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, issues: parsed.error.issues.slice(0, 20).map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`) };
  }
  return { ok: true, state: parsed.data as CompanyState };
}
