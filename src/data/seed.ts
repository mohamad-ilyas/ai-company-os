import type { ActivityEvent, CompanyState, Execution, HistoryEntry, Message, Project, Task } from "../lib/types";
import { DEPARTMENTS, EMPLOYEES, WORKFORCE_VERSION } from "./workforce";
import { KNOWLEDGE } from "./knowledge";

// The seed has two kinds of records:
//  - real: the company itself, its policies, and the actual build of this platform (PRJ-001),
//    including the approvals the CEO genuinely needs to give;
//  - sample (sample: true): one illustrative client project so every screen has something to show.
// Sample records are badged in the UI and excluded from KPIs unless the CEO opts in.

const BUILD = "2026-11-01T18:00:00.000Z";
const seedDone = (title: string): HistoryEntry[] => [
  { at: BUILD, actor: "system", key: "created", params: {} },
  { at: BUILD, actor: "system", key: "seed_completed", params: { note: title } },
];

function task(t: Partial<Task> & Pick<Task, "id" | "title" | "projectId" | "assigneeId" | "status">): Task {
  return {
    description: "",
    priority: "high",
    dueDate: null,
    dependencies: [],
    acceptanceCriteria: [],
    requiredInputs: "",
    expectedOutput: "",
    attachments: [],
    comments: [],
    history: [{ at: BUILD, actor: "system", key: "created", params: {} }],
    stage: null,
    protectedAction: null,
    reviewRounds: 0,
    createdAt: BUILD,
    updatedAt: BUILD,
    startedAt: null,
    completedAt: null,
    sample: false,
    ...t,
  };
}

const platformProject: Project = {
  id: "PRJ-001",
  name: "AI Company OS — v1 platform",
  client: "Internal",
  description:
    "Build and launch the company's own operating platform: AI workforce profiles, management dashboard, approvals, and a Claude Code execution bridge — at $0 additional cost.",
  businessRequirements:
    "The CEO can supervise a 13-person senior AI workforce, assign work, review results, and approve protected actions from any device, including when the Mac is off.",
  technicalRequirements:
    "Static Next.js export on GitHub Pages; TypeScript; Tailwind; Arabic (RTL) and English; light/dark; no paid services or APIs; execution through the CEO's authorized Claude Pro sessions.",
  scope:
    "In: dashboard modules, 13 profiles, workflows, execution bridge, tests, deployment. Out (later): multi-user cloud persistence, client portal.",
  budget: 0,
  priority: "critical",
  startDate: "2026-11-01",
  targetDate: "2026-11-15",
  managerId: "EMP-003",
  memberIds: ["EMP-001", "EMP-003", "EMP-006", "EMP-008", "EMP-009", "EMP-012", "EMP-013"],
  milestones: [
    { id: "MS-001", title: "Workforce and dashboard built", dueDate: "2026-11-01", done: true },
    { id: "MS-002", title: "Repository published and Pages deployed", dueDate: "2026-11-05", done: false },
    { id: "MS-003", title: "Independent review of v1", dueDate: "2026-11-10", done: false },
  ],
  risks: [
    {
      id: "RSK-001",
      description: "Browser-only storage: data does not sync across devices and is lost if browser data is cleared.",
      severity: "medium",
      mitigation: "Weekly JSON export (Settings → Data). Evaluate Supabase free tier (TSK-0009).",
    },
    {
      id: "RSK-002",
      description: "GitHub Pages on the free plan requires a public repository; seed data is publicly readable.",
      severity: "medium",
      mitigation: "Keep confidential data out of the repository; your edits stay in your browser only.",
    },
  ],
  dependencies: ["GitHub account mohamad-ilyas authorised on this Mac (gh auth login)"],
  status: "development",
  createdAt: BUILD,
  updatedAt: BUILD,
  sample: false,
};

const platformTasks: Task[] = [
  task({
    id: "TSK-0001",
    title: "Architecture decision: static export + browser storage at $0",
    projectId: "PRJ-001",
    assigneeId: "EMP-006",
    status: "completed",
    stage: "technical_planning",
    expectedOutput: "ADR-001 in the knowledge base.",
    acceptanceCriteria: ["Options compared", "Running cost $0", "Limitations stated"],
    attachments: [{ label: "ADR-001", url: "/knowledge/view/?id=KB-013" }],
    history: seedDone("Completed during the initial Claude Code build session."),
    completedAt: BUILD,
  }),
  task({
    id: "TSK-0002",
    title: "Write 13 senior employee profiles and individual system instructions",
    projectId: "PRJ-001",
    assigneeId: "EMP-001",
    status: "completed",
    expectedOutput: "Profiles in src/data/workforce and subagents in .claude/agents.",
    acceptanceCriteria: ["13 distinct profiles", "Distinct instructions per role", "Reporting lines defined"],
    history: seedDone("Completed during the initial Claude Code build session."),
    completedAt: BUILD,
  }),
  task({
    id: "TSK-0003",
    title: "Build the dashboard modules",
    projectId: "PRJ-001",
    assigneeId: "EMP-008",
    status: "completed",
    stage: "development",
    expectedOutput: "All 15 modules functional, bilingual, responsive, light/dark.",
    acceptanceCriteria: ["Arabic RTL and English", "Light and dark", "Works on mobile", "Refresh works on every route"],
    history: seedDone("Completed during the initial Claude Code build session."),
    completedAt: BUILD,
  }),
  task({
    id: "TSK-0004",
    title: "Claude Code execution bridge (subagents + /run-assignment)",
    projectId: "PRJ-001",
    assigneeId: "EMP-006",
    status: "completed",
    stage: "development",
    expectedOutput: "Assignment packet, result schema, .claude/agents/*, /run-assignment command.",
    acceptanceCriteria: ["No API keys or paid calls", "Result validated before import"],
    history: seedDone("Completed during the initial Claude Code build session."),
    completedAt: BUILD,
  }),
  task({
    id: "TSK-0005",
    title: "Automated tests: unit (Vitest) and E2E (Playwright)",
    projectId: "PRJ-001",
    assigneeId: "EMP-012",
    status: "completed",
    stage: "quality_assurance",
    expectedOutput: "Test suites passing locally and in GitHub Actions.",
    acceptanceCriteria: ["Domain rules covered", "Critical journeys covered in both languages"],
    history: seedDone("Completed during the initial Claude Code build session; results in the README."),
    completedAt: BUILD,
  }),
  task({
    id: "TSK-0006",
    title: "Publish the repository under github.com/mohamad-ilyas",
    description:
      "Create the ai-company-os repository under the mohamad-ilyas account and make it public — GitHub Pages is only free for public repositories.",
    projectId: "PRJ-001",
    assigneeId: "EMP-003",
    status: "awaiting_ceo_approval",
    protectedAction: "public_release",
    expectedOutput: "Public repository with source, CI, and docs. No secrets.",
    acceptanceCriteria: ["Secret scan clean", "No client data in the repository"],
    history: [
      { at: BUILD, actor: "system", key: "created", params: {} },
      { at: BUILD, actor: "system", key: "status", params: { from: "under_review", to: "awaiting_ceo_approval", note: "APR-001" } },
    ],
  }),
  task({
    id: "TSK-0007",
    title: "Deploy the dashboard to GitHub Pages",
    projectId: "PRJ-001",
    assigneeId: "EMP-006",
    status: "backlog",
    dependencies: ["TSK-0006"],
    protectedAction: "production_deployment",
    expectedOutput: "Live URL verified: routes, refresh, assets, no secrets.",
    acceptanceCriteria: ["Every route loads after refresh", "Assets load under the /ai-company-os base path"],
  }),
  task({
    id: "TSK-0008",
    title: "Independent review of v1",
    projectId: "PRJ-001",
    assigneeId: "EMP-013",
    status: "assigned",
    stage: "independent_review",
    dependencies: ["TSK-0005"],
    expectedOutput: "Claims-vs-evidence review and release recommendation.",
    acceptanceCriteria: ["Each module verified or marked unverified"],
  }),
  task({
    id: "TSK-0009",
    title: "Evaluate Supabase free tier for cross-device persistence",
    description:
      "Assess limits (pausing after inactivity, storage, auth) and design Row Level Security. Requires the CEO to create a Supabase account — no account will be created without approval.",
    projectId: "PRJ-001",
    assigneeId: "EMP-009",
    status: "backlog",
    priority: "medium",
    expectedOutput: "Recommendation with schema, RLS policies, and migration plan.",
    acceptanceCriteria: ["Free-tier limits verified from official docs", "No service-role key in client code"],
  }),
];

// ------------------------------------------------------------------ sample

const sampleProject: Project = {
  id: "PRJ-002",
  name: "Sample: Cedar & Co. bakery ordering app",
  client: "Cedar & Co. (sample client)",
  description: "Illustrative project showing the full lifecycle. Not a real client.",
  businessRequirements: "Customers order pastries for pickup; staff see and prepare orders.",
  technicalRequirements: "Responsive web app in Arabic and English; no online payment in phase 1.",
  scope: "In: menu, cart, pickup ordering, staff order list. Out: delivery, payments, loyalty.",
  budget: null,
  priority: "medium",
  startDate: "2026-11-03",
  targetDate: "2026-12-15",
  managerId: "EMP-003",
  memberIds: ["EMP-002", "EMP-003", "EMP-004", "EMP-005", "EMP-006", "EMP-008"],
  milestones: [
    { id: "MS-004", title: "Requirements signed off", dueDate: "2026-11-07", done: true },
    { id: "MS-005", title: "Designs approved", dueDate: "2026-11-18", done: false },
  ],
  risks: [{ id: "RSK-003", description: "Menu data not yet provided by client", severity: "medium", mitigation: "Use placeholder menu; open question Q-3" }],
  dependencies: ["Client menu and photos"],
  status: "design",
  createdAt: BUILD,
  updatedAt: BUILD,
  sample: true,
};

const sampleTasks: Task[] = [
  task({ id: "TSK-0010", title: "Requirements for pickup ordering", projectId: "PRJ-002", assigneeId: "EMP-002", status: "completed", stage: "client_request", priority: "medium", sample: true, completedAt: BUILD, acceptanceCriteria: ["Stories with Given/When/Then"] }),
  task({ id: "TSK-0011", title: "Plan and task breakdown", projectId: "PRJ-002", assigneeId: "EMP-003", status: "completed", stage: "planning", priority: "medium", dependencies: ["TSK-0010"], sample: true, completedAt: BUILD }),
  task({ id: "TSK-0012", title: "Ordering flow UX and UI spec", projectId: "PRJ-002", assigneeId: "EMP-005", status: "in_progress", stage: "design", priority: "medium", dependencies: ["TSK-0011"], dueDate: "2026-11-18", sample: true, startedAt: BUILD }),
  task({ id: "TSK-0013", title: "Bakery logo refresh (bilingual)", projectId: "PRJ-002", assigneeId: "EMP-004", status: "under_review", stage: "design", priority: "low", dependencies: ["TSK-0011"], dueDate: "2026-11-14", sample: true, startedAt: BUILD }),
  task({ id: "TSK-0014", title: "Architecture for ordering app", projectId: "PRJ-002", assigneeId: "EMP-006", status: "blocked", stage: "technical_planning", priority: "medium", dependencies: ["TSK-0012"], sample: true, comments: [{ id: "CMT-0001", authorId: "EMP-006", body: "Waiting on the UX spec before choosing the state model.", at: BUILD }] }),
];

const sampleExecution: Execution = {
  id: "EXE-0001",
  employeeId: "EMP-002",
  taskId: "TSK-0010",
  projectId: "PRJ-002",
  title: "Requirements for pickup ordering",
  instructions: "Write the requirements for phase 1 (pickup ordering). Arabic and English UI. No payments.",
  attachments: [],
  channel: "claude_chat",
  status: "completed",
  createdAt: BUILD,
  startedAt: null,
  endedAt: null,
  logs: [{ at: BUILD, message: "Sample record — illustrates a completed, approved assignment." }],
  summary: "Sample output: phase-1 requirements with 6 user stories, 4 NFRs, and 3 open questions.",
  output:
    "## Sample output (illustrative)\n\n**FR-1** Customers can browse the menu by category.\n**FR-2** Customers can add items to a cart and choose a pickup time.\n**FR-3** Staff see new orders in a list sorted by pickup time.\n\n**NFR-1** Arabic (RTL) and English.\n**NFR-2** WCAG 2.2 AA.\n\n**US-1** As a customer I want to choose a pickup time so that my order is ready when I arrive.\n- Given an open bakery, When I pick a time at least 30 minutes ahead, Then the order is accepted.\n\n**Open questions**\n- Q-1 Opening hours? (client)\n- Q-2 Max orders per slot? (client)\n- Q-3 Menu data and photos? (client)",
  errors: [],
  openQuestions: ["Opening hours?", "Max orders per slot?", "Menu data and photos?"],
  reviewStatus: "approved",
  reviewNotes: "Sample review.",
  parentId: null,
  handoffSuggestion: { to: "EMP-003", note: "Ready for planning." },
  sample: true,
};

const messages: Message[] = [
  {
    id: "MSG-0001",
    kind: "announcement",
    refId: null,
    authorId: "system",
    body: "Workspace initialised. 13 AI employee profiles are ready. Profiles do work only when you run an assignment in an authorized Claude session — see Knowledge Base → SOP: Run an assignment with Claude Code.",
    at: BUILD,
    sample: false,
  },
  {
    id: "MSG-0002",
    kind: "decision",
    refId: "PRJ-001",
    authorId: "system",
    body: "ADR-001 accepted: static Next.js on GitHub Pages with browser storage and JSON export. Supabase is the planned upgrade for cross-device data (TSK-0009).",
    at: BUILD,
    sample: false,
  },
  { id: "MSG-0003", kind: "project", refId: "PRJ-002", authorId: "EMP-003", body: "Sample: Requirements signed off. Design starts this week — Henry on UX, Imogen on the logo refresh.", at: BUILD, sample: true },
  { id: "MSG-0004", kind: "department", refId: "design", authorId: "EMP-005", body: "Sample: Reminder — every spec needs RTL notes and all component states before handoff to Engineering.", at: BUILD, sample: true },
  { id: "MSG-0005", kind: "meeting", refId: "PRJ-002", authorId: "EMP-003", body: "Sample meeting note — Kickoff: scope confirmed (pickup only), payments deferred to phase 2, client to send menu by Friday.", at: BUILD, sample: true },
];

const activity: ActivityEvent[] = [
  { id: "ACT-00006", at: BUILD, actor: "system", type: "approval", key: "approval_requested", params: { id: "APR-001", title: "Make the repository public and deploy to GitHub Pages", action: "public_release" }, refType: "approval", refId: "APR-001" },
  { id: "ACT-00005", at: BUILD, actor: "system", type: "project", key: "project_created", params: { id: "PRJ-002", name: sampleProject.name, sample: "true" }, refType: "project", refId: "PRJ-002" },
  { id: "ACT-00004", at: BUILD, actor: "system", type: "project", key: "project_created", params: { id: "PRJ-001", name: platformProject.name }, refType: "project", refId: "PRJ-001" },
  { id: "ACT-00003", at: BUILD, actor: "system", type: "knowledge", key: "kb_seeded", params: { count: String(KNOWLEDGE.length) }, refType: null, refId: null },
  { id: "ACT-00002", at: BUILD, actor: "system", type: "config", key: "workforce_created", params: { count: String(EMPLOYEES.length) }, refType: null, refId: null },
  { id: "ACT-00001", at: BUILD, actor: "system", type: "config", key: "workspace_initialized", params: {}, refType: null, refId: null },
];

export function createSeed(): CompanyState {
  const state: CompanyState = {
    schema: "aicos.state/v1",
    revision: 0,
    workforceVersion: WORKFORCE_VERSION,
    counters: { PRJ: 2, TSK: 14, EXE: 1, APR: 2, MSG: 5, DLV: 2, KB: KNOWLEDGE.length, ACT: 6, CMT: 1, MS: 5, RSK: 3 },
    settings: {
      companyName: "AI Company OS",
      tagline: "Digital agency · design, engineering, and quality",
      companyEmail: "",
      founderName: "Mohammed Abu-Ilyas",
      founderTitle: "Founder & CEO",
      theme: "system",
      locale: "en",
      role: "ceo",
      notifications: { approvals: true, blockedTasks: true, reviews: true },
      projectDefaults: { priority: "medium", durationDays: 30 },
      includeSampleInAnalytics: false,
      github: { repoUrl: "https://github.com/mohamad-ilyas/ai-company-os", pagesUrl: "https://mohamad-ilyas.github.io/ai-company-os/" },
    },
    departments: DEPARTMENTS,
    employees: EMPLOYEES,
    projects: [platformProject, sampleProject],
    tasks: [...platformTasks, ...sampleTasks],
    executions: [sampleExecution],
    approvals: [
      {
        id: "APR-001",
        action: "public_release",
        title: "Make the repository public and deploy to GitHub Pages",
        requestedBy: "system",
        reason:
          "GitHub Pages is free only for public repositories. Publishing lets the dashboard stay online when the Mac is off.",
        impact:
          "Source code, employee profiles, policies, and seed data become publicly readable. Your own edits stay in your browser and are not published.",
        risk: "medium",
        supportingFiles: [{ label: "ADR-001", url: "/knowledge/view/?id=KB-013" }],
        projectId: "PRJ-001",
        taskId: "TSK-0006",
        status: "pending",
        decisionNote: "",
        createdAt: BUILD,
        decidedAt: null,
        sample: false,
      },
      {
        id: "APR-002",
        action: "client_proposal",
        title: "Sample: Send phase-1 proposal to Cedar & Co.",
        requestedBy: "EMP-003",
        reason: "Sample record — requirements are signed off; the proposal is ready to send.",
        impact: "Commits the company to scope and a delivery date for the sample client.",
        risk: "medium",
        supportingFiles: [],
        projectId: "PRJ-002",
        taskId: null,
        status: "pending",
        decisionNote: "",
        createdAt: BUILD,
        decidedAt: null,
        sample: true,
      },
    ],
    messages,
    deliverables: [
      {
        id: "DLV-001",
        title: "Employee system instructions (Claude Code subagents)",
        type: "documentation",
        projectId: "PRJ-001",
        taskId: "TSK-0002",
        executionId: null,
        ownerId: "EMP-001",
        location: ".claude/agents/",
        description: "One subagent file per employee, generated from src/data/workforce by `npm run workforce:sync`.",
        version: "1",
        status: "approved",
        createdAt: BUILD,
        sample: false,
      },
      {
        id: "DLV-002",
        title: "Sample: Phase-1 requirements",
        type: "requirements",
        projectId: "PRJ-002",
        taskId: "TSK-0010",
        executionId: "EXE-0001",
        ownerId: "EMP-002",
        location: "docs/sample/cedar-requirements.md",
        description: "Illustrative deliverable.",
        version: "1",
        status: "approved",
        createdAt: BUILD,
        sample: true,
      },
    ],
    knowledge: KNOWLEDGE,
    activity,
  };
  // Deep copy so callers can never mutate the module-level constants.
  return structuredClone(state);
}
