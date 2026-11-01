import { z } from "zod";
import { DELIVERABLE_TYPES, PRIORITIES, PROTECTED_ACTIONS, TASK_STATUSES, WORKFLOW_STAGES } from "../types";
import { executionResultSchema } from "./result-schema";

/**
 * aicos.report/v1 — what the AI team sends back through the agent channel.
 * Projects and tasks are referenced by stable keys the team chooses
 * (e.g. "cedar-app", "cedar-app/requirements") so later reports can update them.
 * Every action is applied through the normal domain rules; CEO approvals still apply.
 * Keep in sync with docs/agent-report.schema.json (generated) and .claude/commands.
 */
export const REPORT_SCHEMA_ID = "aicos.report/v1";

const key = z.string().regex(/^[a-z0-9][a-z0-9/_-]{1,80}$/, "keys are lowercase letters, digits, - _ /");
const empId = z.string().regex(/^EMP-\d{3}$/);
const isoDate = z.string().refine((s) => !Number.isNaN(Date.parse(s)), "ISO date");
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD");
const text = (max: number) => z.string().max(max);
const link = z.object({ label: text(200), url: text(1000) });

const projectUpsert = z.object({
  type: z.literal("project.upsert"),
  key,
  name: text(200).min(1),
  client: text(200).min(1),
  description: text(20_000).optional(),
  businessRequirements: text(50_000).optional(),
  technicalRequirements: text(50_000).optional(),
  scope: text(20_000).optional(),
  priority: z.enum(PRIORITIES).optional(),
  startDate: day.optional(),
  targetDate: day.optional(),
  managerId: empId.optional(),
  memberIds: z.array(empId).max(13).optional(),
  repoUrl: text(500).optional(),
  status: z.enum(["planning", "requirements", "design", "development", "testing", "review", "on_hold"]).optional(),
});

const taskUpsert = z.object({
  type: z.literal("task.upsert"),
  key,
  projectKey: key,
  title: text(300).min(1),
  description: text(20_000).optional(),
  assigneeId: empId.optional(),
  priority: z.enum(PRIORITIES).optional(),
  dueDate: day.optional(),
  dependsOn: z.array(key).max(30).optional(),
  acceptanceCriteria: z.array(text(1000)).max(50).optional(),
  requiredInputs: text(5000).optional(),
  expectedOutput: text(5000).optional(),
  protectedAction: z.enum(PROTECTED_ACTIONS).optional(),
  stage: z.enum(WORKFLOW_STAGES).optional(),
});

const taskStatus = z.object({
  type: z.literal("task.status"),
  taskKey: key,
  // Completion of protected tasks and approval decisions are not reachable from here.
  status: z.enum(TASK_STATUSES).exclude(["awaiting_ceo_approval"]),
  note: text(2000).optional(),
  by: empId,
});

const workRecord = z.object({
  type: z.literal("work.record"),
  employeeId: empId,
  taskKey: key.optional(),
  projectKey: key.optional(),
  title: text(300).min(1),
  instructions: text(20_000).min(1),
  status: z.enum(["completed", "needs_input", "failed"]),
  startedAt: isoDate.nullable().optional(),
  endedAt: isoDate.nullable().optional(),
  summary: text(2000).default(""),
  output: text(200_000).default(""),
  logs: z.array(z.object({ at: isoDate.nullable().optional(), message: text(2000).min(1) })).max(500).default([]),
  errors: z.array(text(2000)).max(100).default([]),
  openQuestions: z.array(text(2000)).max(100).default([]),
  deliverables: z
    .array(z.object({ title: text(200).min(1), type: z.enum(DELIVERABLE_TYPES), location: text(1000).min(1), description: text(2000).optional() }))
    .max(50)
    .default([]),
  handoff: z.object({ to: empId, note: text(2000) }).nullable().optional(),
  /** Internal peer review by another AI employee (never the author). CEO approvals are separate. */
  review: z.object({ reviewerId: empId, decision: z.enum(["approved", "changes_requested"]), notes: text(5000).default("") }).optional(),
});

const executionResult = z.object({
  type: z.literal("execution.result"),
  result: executionResultSchema,
});

const messagePost = z.object({
  type: z.literal("message.post"),
  kind: z.enum(["project", "department", "decision", "meeting"]),
  projectKey: key.optional(),
  departmentId: z.enum(["executive", "design", "engineering", "qa"]).optional(),
  authorId: empId,
  body: text(5000).min(1),
});

const approvalRequest = z.object({
  type: z.literal("approval.request"),
  action: z.enum(PROTECTED_ACTIONS),
  title: text(300).min(1),
  requestedBy: empId,
  reason: text(5000).min(1),
  impact: text(5000).default(""),
  risk: z.enum(["low", "medium", "high", "critical"]).optional(),
  projectKey: key.optional(),
  taskKey: key.optional(),
  supportingFiles: z.array(link).max(20).default([]),
});

const deliverableRecord = z.object({
  type: z.literal("deliverable.record"),
  title: text(200).min(1),
  deliverableType: z.enum(DELIVERABLE_TYPES),
  location: text(1000).min(1),
  description: text(2000).default(""),
  projectKey: key.optional(),
  taskKey: key.optional(),
  ownerId: empId,
  version: text(50).default("1"),
});

export const reportActionSchema = z.discriminatedUnion("type", [
  projectUpsert,
  taskUpsert,
  taskStatus,
  workRecord,
  executionResult,
  messagePost,
  approvalRequest,
  deliverableRecord,
]);

export const agentReportSchema = z.object({
  schema: z.literal(REPORT_SCHEMA_ID),
  reportId: z.string().min(8).max(100),
  sentAt: isoDate,
  source: z.enum(["claude_code", "claude_code_web", "claude_chat"]),
  summary: text(2000).default(""),
  actions: z.array(reportActionSchema).min(1).max(300),
});

export type ReportAction = z.output<typeof reportActionSchema>;
export type AgentReport = z.output<typeof agentReportSchema>;

export function parseAgentReport(raw: unknown): { ok: true; report: AgentReport } | { ok: false; issues: string[] } {
  const parsed = agentReportSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, issues: parsed.error.issues.slice(0, 15).map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`) };
  return { ok: true, report: parsed.data };
}
