import type { EmployeeId, ProjectStatus, ProtectedAction, TaskStatus, WorkflowStage } from "./types";

/** The standard project lifecycle. Each stage has an owner and produces explicit outputs for the next. */
export interface StageDefinition {
  stage: WorkflowStage;
  ownerIds: EmployeeId[];
  /** Task templates created when the standard workflow is started on a project. */
  tasks: {
    key: string;
    assigneeId: EmployeeId;
    title: string;
    expectedOutput: string;
    acceptanceCriteria: string[];
    dependsOn: string[];
    protectedAction?: ProtectedAction;
  }[];
  projectStatus: ProjectStatus;
}

export const LIFECYCLE: StageDefinition[] = [
  {
    stage: "client_request",
    ownerIds: ["EMP-002"],
    projectStatus: "requirements",
    tasks: [
      {
        key: "requirements",
        assigneeId: "EMP-002",
        title: "Analyse client request and write requirements",
        expectedOutput: "Requirements document: scope, user stories, FR/NFR, acceptance criteria, risks, open questions.",
        acceptanceCriteria: [
          "Every user story has Given/When/Then acceptance criteria",
          "In-scope and out-of-scope lists are explicit",
          "Open questions are numbered with an owner",
        ],
        dependsOn: [],
      },
    ],
  },
  {
    stage: "planning",
    ownerIds: ["EMP-003"],
    projectStatus: "planning",
    tasks: [
      {
        key: "plan",
        assigneeId: "EMP-003",
        title: "Create project plan, milestones, and task breakdown",
        expectedOutput: "Plan with milestones, owners, dependencies, timeline, and approval gates.",
        acceptanceCriteria: ["Each requirement maps to at least one task", "Critical path identified", "CEO approval gates marked"],
        dependsOn: ["requirements"],
      },
    ],
  },
  {
    stage: "design",
    ownerIds: ["EMP-005", "EMP-004"],
    projectStatus: "design",
    tasks: [
      {
        key: "ux",
        assigneeId: "EMP-005",
        title: "UX flows, wireframes, and UI specification",
        expectedOutput: "Journeys, IA, screen specs with all states, tokens, RTL and accessibility notes.",
        acceptanceCriteria: ["Every screen maps to a user story", "All component states specified", "RTL and dark mode specified"],
        dependsOn: ["plan"],
      },
      {
        key: "brand",
        assigneeId: "EMP-004",
        title: "Brand and visual assets",
        expectedOutput: "Logo/brand assets (SVG), palette with contrast ratios, typography, usage rules.",
        acceptanceCriteria: ["Open-licence fonts only", "Text colour pairs meet WCAG AA", "Works in Arabic and Latin"],
        dependsOn: ["plan"],
      },
    ],
  },
  {
    stage: "technical_planning",
    ownerIds: ["EMP-006"],
    projectStatus: "design",
    tasks: [
      {
        key: "architecture",
        assigneeId: "EMP-006",
        title: "Architecture, ADRs, and technical breakdown",
        expectedOutput: "Architecture diagram, ADRs, data model, API contracts, engineering tasks.",
        acceptanceCriteria: ["Each NFR addressed or gap stated", "Running cost is $0 or flagged for approval", "Tasks have defined interfaces"],
        dependsOn: ["requirements", "ux"],
      },
    ],
  },
  {
    stage: "development",
    ownerIds: ["EMP-008", "EMP-009", "EMP-007"],
    projectStatus: "development",
    tasks: [
      {
        key: "backend",
        assigneeId: "EMP-009",
        title: "Backend, data model, and API implementation",
        expectedOutput: "API and schema with tests, access rules, and documentation.",
        acceptanceCriteria: ["Validation and authorization tested", "API docs match implementation", "No secrets in code"],
        dependsOn: ["architecture"],
      },
      {
        key: "frontend",
        assigneeId: "EMP-008",
        title: "Web frontend implementation",
        expectedOutput: "Feature code with unit and E2E tests, accessible, RTL-correct.",
        acceptanceCriteria: ["Lint, typecheck, tests, and build pass", "Keyboard accessible", "Arabic RTL and English verified"],
        dependsOn: ["architecture", "ux"],
      },
    ],
  },
  {
    stage: "quality_assurance",
    ownerIds: ["EMP-010", "EMP-011", "EMP-012"],
    projectStatus: "testing",
    tasks: [
      {
        key: "test_plan",
        assigneeId: "EMP-010",
        title: "QA strategy and test plan",
        expectedOutput: "Risk-based test plan with entry/exit criteria and quality gate.",
        acceptanceCriteria: ["Every requirement mapped to a test", "Quality gate defined"],
        dependsOn: ["requirements"],
      },
      {
        key: "manual_tests",
        assigneeId: "EMP-011",
        title: "Manual and exploratory testing",
        expectedOutput: "Executed test cases, exploratory notes, reproducible defect reports.",
        acceptanceCriteria: ["Each acceptance criterion tested", "Results recorded as executed"],
        dependsOn: ["test_plan", "frontend", "backend"],
      },
      {
        key: "automation",
        assigneeId: "EMP-012",
        title: "Automated regression suite in CI",
        expectedOutput: "Playwright suite for critical journeys running in GitHub Actions.",
        acceptanceCriteria: ["Three consecutive green local runs", "Runs in CI with traces on failure"],
        dependsOn: ["test_plan", "frontend"],
      },
    ],
  },
  {
    stage: "independent_review",
    ownerIds: ["EMP-013"],
    projectStatus: "review",
    tasks: [
      {
        key: "independent_review",
        assigneeId: "EMP-013",
        title: "Independent quality review and release recommendation",
        expectedOutput: "Claims-vs-evidence review with findings and Go / Conditional / No-go.",
        acceptanceCriteria: ["Every acceptance criterion verified or marked unverified", "Recommendation justified by findings"],
        dependsOn: ["manual_tests", "automation"],
      },
    ],
  },
  {
    stage: "ceo_approval",
    ownerIds: ["EMP-003"],
    projectStatus: "awaiting_ceo_approval",
    tasks: [
      {
        key: "release_approval",
        assigneeId: "EMP-003",
        title: "Request CEO approval for production release",
        expectedOutput: "Approval request with release scope, review recommendation, risks, and rollback plan.",
        acceptanceCriteria: ["Independent review attached", "Rollback plan stated"],
        dependsOn: ["independent_review"],
        protectedAction: "production_deployment",
      },
    ],
  },
  {
    stage: "delivery",
    ownerIds: ["EMP-003"],
    projectStatus: "ready_for_delivery",
    tasks: [
      {
        key: "delivery",
        assigneeId: "EMP-003",
        title: "Release notes, documentation, and handover",
        expectedOutput: "Release notes, final documentation, deliverables recorded, decisions archived.",
        acceptanceCriteria: ["Deliverables recorded in the Deliverables module", "Release notes written"],
        dependsOn: ["release_approval"],
        protectedAction: "client_proposal",
      },
    ],
  },
];

/** Allowed manual task transitions. Guards (dependencies, approvals) are applied in domain.ts. */
export const TASK_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  backlog: ["assigned", "cancelled"],
  assigned: ["in_progress", "blocked", "backlog", "cancelled"],
  in_progress: ["under_review", "blocked", "cancelled"],
  blocked: ["in_progress", "assigned", "cancelled"],
  under_review: ["completed", "changes_requested", "awaiting_ceo_approval"],
  changes_requested: ["in_progress", "cancelled"],
  awaiting_ceo_approval: [], // only the CEO's approval decision moves it
  completed: ["changes_requested"],
  cancelled: ["backlog"],
};

export const PROJECT_TRANSITIONS: Record<ProjectStatus, ProjectStatus[]> = {
  planning: ["requirements", "design", "on_hold", "cancelled"],
  requirements: ["planning", "design", "on_hold", "cancelled"],
  design: ["development", "requirements", "on_hold", "cancelled"],
  development: ["testing", "design", "on_hold", "cancelled"],
  testing: ["review", "development", "on_hold", "cancelled"],
  review: ["awaiting_ceo_approval", "development", "testing", "on_hold", "cancelled"],
  awaiting_ceo_approval: [], // decided in the Approval Center
  ready_for_delivery: ["delivered", "development", "on_hold"],
  delivered: [],
  on_hold: ["planning", "requirements", "design", "development", "testing", "review", "cancelled"],
  cancelled: ["planning"],
};

/** Risk defaults for protected actions — shown when an approval request is created. */
export const PROTECTED_ACTION_RISK: Record<ProtectedAction, "low" | "medium" | "high" | "critical"> = {
  production_deployment: "high",
  production_database_change: "critical",
  public_release: "high",
  client_proposal: "medium",
  external_communication: "medium",
  contractual_commitment: "critical",
  spending: "critical",
  subscription_purchase: "critical",
  billing_change: "critical",
  sensitive_data_access: "high",
  data_deletion: "high",
  irreversible_change: "critical",
};
