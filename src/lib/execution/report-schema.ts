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

// Sessions sometimes use near-miss values; translate the common ones instead of rejecting work.
const DELIVERABLE_ALIASES: Record<string, (typeof DELIVERABLE_TYPES)[number]> = {
  document: "documentation", doc: "documentation", docs: "documentation", markdown: "documentation", readme: "documentation", notes: "documentation",
  code: "source_code", source: "source_code", app: "source_code", repository: "source_code", repo: "source_code",
  spec: "requirements", specification: "requirements", requirements_doc: "requirements", user_stories: "requirements",
  tech_spec: "technical_spec", architecture: "technical_spec", adr: "technical_spec",
  test: "test_report", tests: "test_report", test_results: "test_report", review: "test_report", qa_report: "test_report",
  ux: "design", ui: "design", mockup: "design", wireframe: "design", design_spec: "design",
  brand: "brand_guidelines", branding: "brand_guidelines",
};
const deliverableType = z.preprocess(
  (v) => (typeof v === "string" ? (DELIVERABLE_ALIASES[v.trim().toLowerCase()] ?? v.trim().toLowerCase()) : v),
  z.enum(DELIVERABLE_TYPES),
);
const workStatus = z.preprocess(
  (v) => (typeof v === "string" ? ({ done: "completed", complete: "completed", success: "completed", started: "in_progress", ongoing: "in_progress", blocked: "needs_input" } as Record<string, string>)[v.trim().toLowerCase()] ?? v.trim().toLowerCase() : v),
  z.enum(["completed", "in_progress", "needs_input", "failed"]),
);

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
  /** in_progress = work started but not finished (shown as running, no review). */
  status: workStatus,
  startedAt: isoDate.nullable().optional(),
  endedAt: isoDate.nullable().optional(),
  summary: text(2000).default(""),
  output: text(200_000).default(""),
  logs: z.array(z.object({ at: isoDate.nullable().optional(), message: text(2000).min(1) })).max(500).default([]),
  errors: z.array(text(2000)).max(100).default([]),
  openQuestions: z.array(text(2000)).max(100).default([]),
  deliverables: z
    .array(z.object({ title: text(200).min(1), type: deliverableType, location: text(1000).min(1), description: text(2000).optional() }))
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
  deliverableType: deliverableType,
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
  source: z.preprocess((v) => (v === "claude_web" || v === "web" ? "claude_code_web" : v), z.enum(["claude_code", "claude_code_web", "claude_chat"])),
  summary: text(2000).default(""),
  actions: z.array(reportActionSchema).min(1).max(300),
});

/** The envelope is strict; actions are checked one by one so a single bad action never loses a report. */
const envelopeSchema = agentReportSchema.extend({ actions: z.array(z.unknown()).min(1).max(300) });

export type ReportAction = z.output<typeof reportActionSchema>;
export type AgentReport = z.output<typeof agentReportSchema>;

export function parseAgentReport(
  raw: unknown,
): { ok: true; report: AgentReport; skipped: string[] } | { ok: false; issues: string[] } {
  const env = envelopeSchema.safeParse(raw);
  if (!env.success) return { ok: false, issues: env.error.issues.slice(0, 15).map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`) };
  const actions: ReportAction[] = [];
  const skipped: string[] = [];
  env.data.actions.forEach((a, i) => {
    const r = reportActionSchema.safeParse(a);
    if (r.success) actions.push(r.data);
    else {
      const type = a && typeof a === "object" && "type" in a ? String((a as { type: unknown }).type) : "?";
      skipped.push(`#${i + 1} ${type}: ${r.error.issues.slice(0, 3).map((x) => `${x.path.join(".")}: ${x.message}`).join("; ")}`);
    }
  });
  if (actions.length === 0) return { ok: false, issues: skipped };
  return { ok: true, report: { ...env.data, actions }, skipped };
}
