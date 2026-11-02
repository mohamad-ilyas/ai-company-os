// Domain model for AI Company OS. Everything here is plain JSON so the whole
// company state can be persisted, exported, imported, and validated.

export type Locale = "en" | "ar";
export type L10n = { en: string; ar: string };

/** Who performed an action. "ceo" is the human founder; "system" is the app itself. */
export type ActorId = "ceo" | "system" | EmployeeId;
export type EmployeeId = `EMP-${string}`;

export type DepartmentId = "executive" | "design" | "engineering" | "qa";

export interface Department {
  id: DepartmentId;
  name: L10n;
  description: L10n;
  managerId: EmployeeId;
  responsibilities: string[];
  /** Fixed categorical slot (1-4) — color follows the department, never its rank. */
  colorSlot: 1 | 2 | 3 | 4;
}

export type Availability = "available" | "busy" | "unavailable";

export interface Employee {
  id: EmployeeId;
  /** Used for the Claude Code subagent file name: .claude/agents/<slug>.md */
  slug: string;
  name: L10n;
  title: L10n;
  departmentId: DepartmentId;
  seniority: "Senior" | "Executive";
  /** Fictional profile positioning only — not a real employment history. */
  experiencePositioning: string;
  bio: L10n;
  coreExpertise: string[];
  technicalSkills: string[];
  secondarySkills: string[];
  responsibilities: string[];
  authority: string[];
  accepts: string[];
  rejectsOrEscalates: string[];
  tools: string[];
  restrictedActions: string[];
  requiredInputs: string[];
  deliverables: string[];
  qualityStandards: string[];
  qualityChecklist: string[];
  kpis: string[];
  reportsTo: "ceo" | EmployeeId;
  collaborators: EmployeeId[];
  communicationStyle: string;
  methodology: string[];
  outputFormat: string;
  /** The employee's individual system instruction, used verbatim as the Claude Code subagent prompt. */
  systemInstructions: string;
  availability: Availability;
  /** Continuous learning: focus areas and curated resources (see /learn and playbooks/<slug>.md). */
  learning?: { focus: string[]; resources: LinkRef[] };
}

export const PROJECT_STATUSES = [
  "planning",
  "requirements",
  "design",
  "development",
  "testing",
  "review",
  "awaiting_ceo_approval",
  "ready_for_delivery",
  "delivered",
  "on_hold",
  "cancelled",
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PRIORITIES = ["low", "medium", "high", "critical"] as const;
export type Priority = (typeof PRIORITIES)[number];

export interface Milestone {
  id: string;
  title: string;
  dueDate: string;
  done: boolean;
}

export interface Risk {
  id: string;
  description: string;
  severity: "low" | "medium" | "high";
  mitigation: string;
}

export interface Project {
  id: string;
  name: string;
  client: string;
  description: string;
  businessRequirements: string;
  technicalRequirements: string;
  scope: string;
  /** Informational only. The company never spends money without CEO approval. */
  budget: number | null;
  priority: Priority;
  startDate: string;
  targetDate: string;
  managerId: EmployeeId;
  memberIds: EmployeeId[];
  milestones: Milestone[];
  risks: Risk[];
  dependencies: string[];
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  /** Demo content shipped with the app; excluded from real KPIs. */
  sample: boolean;
  /** Stable key chosen by the AI team (agent reports reference projects by it). */
  extKey?: string | null;
  /** Source repository, when the team publishes the project to GitHub. */
  repoUrl?: string | null;
}

export const TASK_STATUSES = [
  "backlog",
  "assigned",
  "in_progress",
  "blocked",
  "under_review",
  "changes_requested",
  "awaiting_ceo_approval",
  "completed",
  "cancelled",
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export interface Comment {
  id: string;
  authorId: ActorId;
  body: string;
  at: string;
}

export interface HistoryEntry {
  at: string;
  actor: ActorId;
  /** i18n key under "history." plus params, so the log renders in either language. */
  key: string;
  params?: Record<string, string>;
}

export interface LinkRef {
  label: string;
  url: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  projectId: string;
  assigneeId: EmployeeId | null;
  priority: Priority;
  status: TaskStatus;
  dueDate: string | null;
  dependencies: string[];
  acceptanceCriteria: string[];
  requiredInputs: string;
  expectedOutput: string;
  attachments: LinkRef[];
  comments: Comment[];
  history: HistoryEntry[];
  /** Lifecycle stage this task belongs to, when generated from the standard workflow. */
  stage: WorkflowStage | null;
  /** When set, completion requires an approved CEO approval of this action type. */
  protectedAction: ProtectedAction | null;
  reviewRounds: number;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  sample: boolean;
  /** Stable key chosen by the AI team (agent reports reference tasks by it). */
  extKey?: string | null;
}

export const WORKFLOW_STAGES = [
  "client_request",
  "planning",
  "design",
  "technical_planning",
  "development",
  "quality_assurance",
  "independent_review",
  "ceo_approval",
  "delivery",
] as const;
export type WorkflowStage = (typeof WORKFLOW_STAGES)[number];

export const EXECUTION_STATUSES = [
  "queued",
  "in_session",
  "completed",
  "needs_input",
  "failed",
  "cancelled",
] as const;
export type ExecutionStatus = (typeof EXECUTION_STATUSES)[number];

export const REVIEW_STATUSES = ["not_submitted", "pending", "approved", "changes_requested"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export type ExecutionChannel = "claude_code" | "claude_chat";

export interface WorkLog {
  at: string;
  message: string;
}

export interface Execution {
  id: string;
  employeeId: EmployeeId;
  taskId: string | null;
  projectId: string | null;
  title: string;
  instructions: string;
  attachments: LinkRef[];
  channel: ExecutionChannel;
  status: ExecutionStatus;
  createdAt: string;
  /** Reported by the Claude session that did the work (from the imported result), never guessed. */
  startedAt: string | null;
  endedAt: string | null;
  logs: WorkLog[];
  summary: string;
  output: string;
  errors: string[];
  openQuestions: string[];
  reviewStatus: ReviewStatus;
  reviewNotes: string;
  /** Previous execution this one revises or hands off from. */
  parentId: string | null;
  handoffSuggestion: { to: EmployeeId; note: string } | null;
  sample: boolean;
}

export const PROTECTED_ACTIONS = [
  "production_deployment",
  "production_database_change",
  "public_release",
  "client_proposal",
  "external_communication",
  "contractual_commitment",
  "spending",
  "subscription_purchase",
  "billing_change",
  "sensitive_data_access",
  "data_deletion",
  "irreversible_change",
] as const;
export type ProtectedAction = (typeof PROTECTED_ACTIONS)[number];

export type ApprovalStatus = "pending" | "approved" | "rejected";
export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface Approval {
  id: string;
  action: ProtectedAction;
  title: string;
  requestedBy: ActorId;
  reason: string;
  impact: string;
  risk: RiskLevel;
  supportingFiles: LinkRef[];
  projectId: string | null;
  taskId: string | null;
  status: ApprovalStatus;
  decisionNote: string;
  createdAt: string;
  decidedAt: string | null;
  sample: boolean;
  /** Marked urgent by the COO when a CEO-reserved decision is blocking work. */
  urgent?: boolean;
  /** Stable key chosen by the team, so a later report can decide this approval. */
  extKey?: string | null;
  /** Who decided it (the CEO, or the COO within delegated authority). */
  decidedBy?: ActorId | null;
}

export const CHANNEL_KINDS = ["announcement", "direct", "department", "project", "task", "decision", "meeting"] as const;
export type ChannelKind = (typeof CHANNEL_KINDS)[number];

export interface Message {
  id: string;
  kind: ChannelKind;
  /** Department / project / task id the message belongs to, when applicable. */
  refId: string | null;
  authorId: ActorId;
  body: string;
  at: string;
  sample: boolean;
}

export const DELIVERABLE_TYPES = [
  "design",
  "brand_guidelines",
  "requirements",
  "technical_spec",
  "source_code",
  "test_report",
  "documentation",
  "client_deliverable",
] as const;
export type DeliverableType = (typeof DELIVERABLE_TYPES)[number];

export interface Deliverable {
  id: string;
  title: string;
  type: DeliverableType;
  projectId: string | null;
  taskId: string | null;
  executionId: string | null;
  ownerId: ActorId;
  /** A link (GitHub path, Drive, Figma…) or a repo-relative path. Files are never uploaded here. */
  location: string;
  description: string;
  version: string;
  status: "draft" | "in_review" | "approved";
  createdAt: string;
  sample: boolean;
}

export const KNOWLEDGE_CATEGORIES = [
  "policy",
  "development",
  "design",
  "qa",
  "template",
  "sop",
  "decision",
  "prompt",
  "learning",
] as const;
export type KnowledgeCategory = (typeof KNOWLEDGE_CATEGORIES)[number];

export interface KnowledgeArticle {
  id: string;
  title: string;
  category: KnowledgeCategory;
  body: string;
  tags: string[];
  authorId: ActorId;
  updatedAt: string;
  /** Stable key chosen by the team (e.g. playbook/frontend-engineer) so reports can update it. */
  extKey?: string | null;
}

export const ACTIVITY_TYPES = [
  "assignment",
  "task",
  "project",
  "execution",
  "review",
  "approval",
  "rejection",
  "deployment",
  "config",
  "knowledge",
  "message",
  "data",
  "error",
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export interface ActivityEvent {
  id: string;
  at: string;
  actor: ActorId;
  type: ActivityType;
  /** i18n key under "activity." */
  key: string;
  params: Record<string, string>;
  refType: "project" | "task" | "execution" | "approval" | "employee" | "knowledge" | "deliverable" | null;
  refId: string | null;
}

export type Role = "ceo" | "operator" | "viewer";

export interface Settings {
  companyName: string;
  tagline: string;
  companyEmail: string;
  founderName: string;
  founderTitle: string;
  theme: "light" | "dark" | "system";
  locale: Locale;
  role: Role;
  notifications: {
    approvals: boolean;
    blockedTasks: boolean;
    reviews: boolean;
  };
  projectDefaults: {
    priority: Priority;
    durationDays: number;
  };
  /** Analytics include sample data only when the CEO asks for it. */
  includeSampleInAnalytics: boolean;
  github: {
    repoUrl: string;
    pagesUrl: string;
  };
}

export interface CompanyState {
  schema: "aicos.state/v1";
  revision: number;
  /** Version of the built-in workforce last merged into this state (see migrate.ts). */
  workforceVersion?: number;
  counters: Record<string, number>;
  settings: Settings;
  departments: Department[];
  employees: Employee[];
  projects: Project[];
  tasks: Task[];
  executions: Execution[];
  approvals: Approval[];
  messages: Message[];
  deliverables: Deliverable[];
  knowledge: KnowledgeArticle[];
  activity: ActivityEvent[];
}
