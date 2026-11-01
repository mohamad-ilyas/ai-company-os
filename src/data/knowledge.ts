import type { KnowledgeArticle } from "../lib/types";

const at = "2026-11-01T18:00:00.000Z";

export const KNOWLEDGE: KnowledgeArticle[] = [
  {
    id: "KB-001",
    title: "Zero-cost operating policy",
    category: "policy",
    tags: ["budget", "finance", "mandatory"],
    authorId: "ceo",
    updatedAt: at,
    body: `## Rule
The company's additional budget is **$0**. The only paid service is the CEO's existing Claude Pro subscription.

## Never, without explicit CEO approval
- Purchase or subscribe to anything
- Use paid hosting, databases, AI APIs, automation, design tools, or CI/CD
- Start a free trial that can convert to paid
- Add a service that requires a credit card
- Assume Claude Pro includes API credits (it does not)

## Allowed
GitHub Free, GitHub Pages, GitHub Actions within the free allowance, open-source libraries, local tools, the CEO's Claude Pro sessions (Claude Code and claude.ai), and genuinely free services after their limits are checked.

## If something needs money
Stop. File an approval request (action: *Spending* or *Subscription purchase*) with the cost, the free alternative you considered, and the impact of not doing it.`,
  },
  {
    id: "KB-002",
    title: "CEO approval policy",
    category: "policy",
    tags: ["approvals", "governance", "mandatory"],
    authorId: "ceo",
    updatedAt: at,
    body: `These actions **always** require the CEO's explicit approval in the Approval Center. Employees may prepare them; they never perform them.

1. Production deployment
2. Production database modifications
3. Publishing a public release
4. Sending proposals to clients
5. Sending external communications on behalf of the company
6. Accepting contractual commitments
7. Spending money
8. Purchasing subscriptions
9. Changing billing settings
10. Accessing sensitive client information
11. Deleting important company data
12. Making irreversible changes

Every request records: action, requester, reason, impact, risk, supporting files, decision, and timestamp.

**How it is enforced in the platform**
- A task flagged with a protected action cannot be completed until a matching approval is approved.
- A project cannot be marked *Delivered* without an approved release approval.
- Only the CEO role can decide approvals.
- Production deploys to GitHub Pages run through the \`github-pages\` environment; add the CEO as a required reviewer in the repository settings so GitHub itself enforces the gate.`,
  },
  {
    id: "KB-003",
    title: "Honesty and evidence policy",
    category: "policy",
    tags: ["quality", "reporting", "mandatory"],
    authorId: "ceo",
    updatedAt: at,
    body: `- Never fabricate test results, client feedback, metrics, or progress.
- "Not run", "not measured", and "unknown" are acceptable answers. Invented numbers are not.
- **Sample data** is labelled *Sample* everywhere and is excluded from KPIs unless the CEO turns it on in Settings.
- An AI employee is a **profile** (instructions, responsibilities, history). It only does work when the CEO runs an assignment in an authorized Claude session. The dashboard never shows an employee as "working" unless an assignment was actually started.
- The audit log records only actions that happened in this workspace.`,
  },
  {
    id: "KB-004",
    title: "SOP: Run an assignment with Claude Code",
    category: "sop",
    tags: ["execution", "claude-code", "how-to"],
    authorId: "ceo",
    updatedAt: at,
    body: `Use this for engineering, QA, and any work that needs the repository.

1. **Execution Center → New assignment.** Pick the employee, project/task, and write the instructions.
2. Open the assignment and click **Download packet**. It saves \`EXE-xxxx.assignment.json\` to your Downloads folder.
3. In a terminal, inside the \`ai-company-os\` repository, run the command shown on the page, for example:
   \`\`\`
   claude "/run-assignment ~/Downloads/EXE-0001.assignment.json"
   \`\`\`
   Claude Code loads the employee's subagent from \`.claude/agents/<slug>.md\`, does the work, and writes \`company/outbox/EXE-0001.result.json\`.
4. Click **Mark as started** in the dashboard if you want the task to show *In progress* while it runs.
5. When it finishes, click **Import result** and choose the result file (or paste its contents).
6. Review the output: **Approve** or **Request changes**. Approving completes the task (or sends it for CEO approval if it is protected).

Notes
- This uses your Claude Pro subscription through Claude Code. No API key is used and nothing runs when your Mac is off.
- \`company/inbox\` and \`company/outbox\` are git-ignored so client material is never committed by accident.`,
  },
  {
    id: "KB-005",
    title: "SOP: Run an assignment in Claude chat (claude.ai)",
    category: "sop",
    tags: ["execution", "claude-chat", "how-to"],
    authorId: "ceo",
    updatedAt: at,
    body: `Use this for writing, analysis, design specs, and planning — work that does not need the repository. It works from any device.

1. Open the assignment in the Execution Center and click **Copy chat prompt**.
2. Paste it into a new conversation on claude.ai (your Pro plan).
3. Claude answers with the deliverable and ends with a \`\`\`json block.
4. Copy the whole reply (or just the JSON block) and use **Import result → Paste**.
5. Review and approve or request changes.`,
  },
  {
    id: "KB-006",
    title: "SOP: Project lifecycle and handoffs",
    category: "sop",
    tags: ["workflow", "lifecycle"],
    authorId: "ceo",
    updatedAt: at,
    body: `| Stage | Owner | Output handed to the next stage |
|---|---|---|
| 1. Client request | Business Analyst | Requirements, scope, user stories, acceptance criteria, risks, open questions |
| 2. Planning | Project Manager | Milestones, tasks, owners, dependencies, timeline |
| 3. Design | UI/UX Designer, Graphic Designer | Flows, UI specs, tokens, brand assets |
| 4. Technical planning | Technical Lead | Architecture, ADRs, data model, engineering tasks |
| 5. Development | Frontend, Backend, Mobile engineers | Code, tests, implementation notes |
| 6. Quality assurance | QA Manager, Manual QA, Automation QA | Test plan, results, defects, regression suite |
| 7. Independent review | Independent Quality Reviewer | Findings and Go / Conditional / No-go |
| 8. CEO approval | CEO | Decision recorded in the Approval Center |
| 9. Delivery | Project Manager | Release notes, documentation, deliverables, archived decisions |

**Start standard workflow** on a project creates these tasks with their dependencies. A task becomes *Assigned* automatically when all of its inputs are completed. Approved outputs of dependency tasks are included in the next assignment packet as handoff context. Any reviewer can **Request changes**, which sends the work back to its owner.`,
  },
  {
    id: "KB-007",
    title: "Development standards",
    category: "development",
    tags: ["engineering", "standards"],
    authorId: "EMP-006",
    updatedAt: at,
    body: `- TypeScript strict mode. No \`any\` without a comment explaining why.
- Prefer the simplest architecture that meets the requirements at $0 running cost. Record significant decisions as ADRs in the knowledge base.
- Static hosting: no server-only features unless a free backend is approved.
- Validate all external input (forms, imports, API responses) with Zod.
- Accessibility: semantic HTML, keyboard support, visible focus, labels on every control.
- RTL: use CSS logical properties (\`ms-\`, \`me-\`, \`ps-\`, \`pe-\`, \`start\`, \`end\`).
- Before submitting: \`npm run lint\`, \`npm run typecheck\`, \`npm test\`, \`npm run build\`, and E2E for affected journeys. Report the real output.
- No secrets in the repository. Use GitHub Actions secrets for anything sensitive.
- Small pull requests with a clear description and test evidence.`,
  },
  {
    id: "KB-008",
    title: "Design standards",
    category: "design",
    tags: ["design", "standards", "rtl"],
    authorId: "EMP-005",
    updatedAt: at,
    body: `- Design from user stories; every screen maps to one.
- Specify all states: default, hover, focus, active, disabled, loading, empty, error.
- Arabic (RTL) and English (LTR) are both first-class. Direction-sensitive icons (arrows, chevrons, progress) must flip.
- Text contrast meets WCAG 2.2 AA in light and dark themes.
- Use design tokens (colour, type scale, spacing, radius) — never ad-hoc values.
- Fonts must be open-licence. For bilingual UI: IBM Plex Sans Arabic + Inter.
- Never imitate another company's brand.`,
  },
  {
    id: "KB-009",
    title: "QA standards and defect severity",
    category: "qa",
    tags: ["qa", "severity", "standards"],
    authorId: "EMP-010",
    updatedAt: at,
    body: `## Severity
- **Critical** — data loss, security issue, or the main journey is impossible. Blocks release.
- **High** — a major feature is broken with no reasonable workaround. Blocks release.
- **Medium** — a feature is impaired but has a workaround.
- **Low** — cosmetic or minor.

## Release gate (default)
No open critical/high defects · regression suite green · independent review recommendation is *Go* or *Go with conditions* · CEO approval recorded.

## Bug report must include
Title · severity · steps · expected · actual · environment (browser, OS, language, theme) · evidence.

## Always test
Arabic and English, light and dark, keyboard-only, 360px width, refresh on deep links, empty and error states.`,
  },
  {
    id: "KB-010",
    title: "Template: Requirements document",
    category: "template",
    tags: ["template", "requirements"],
    authorId: "EMP-002",
    updatedAt: at,
    body: `# <Project> — Requirements v0.1
## Context
## Goals and success measures
## Users
## Scope
- In scope:
- Out of scope:
## Functional requirements
- FR-1
## Non-functional requirements
- NFR-1 Performance
- NFR-2 Security & privacy
- NFR-3 Accessibility (WCAG 2.2 AA)
- NFR-4 Localisation (Arabic RTL, English)
## User stories
- US-1 As a … I want … so that …
  - Given … When … Then …
## Risks and dependencies
## Assumptions
## Open questions (owner)`,
  },
  {
    id: "KB-011",
    title: "Template: Architecture Decision Record",
    category: "template",
    tags: ["template", "adr", "architecture"],
    authorId: "EMP-006",
    updatedAt: at,
    body: `# ADR-NNN: <decision>
- Status: proposed | accepted | superseded
- Date:
## Context
## Options considered
1.
2.
## Decision
## Consequences
- Positive:
- Negative:
- Cost: $0 / requires approval`,
  },
  {
    id: "KB-012",
    title: "Template: Bug report",
    category: "template",
    tags: ["template", "qa", "bug"],
    authorId: "EMP-011",
    updatedAt: at,
    body: `**Title:**
**Severity:** critical | high | medium | low
**Environment:** browser, OS, language (ar/en), theme
**Steps:**
1.
**Expected:**
**Actual:**
**Evidence:** screenshot / trace / console output
**Notes:**`,
  },
  {
    id: "KB-013",
    title: "ADR-001: Static Next.js on GitHub Pages with browser storage",
    category: "decision",
    tags: ["adr", "architecture", "hosting", "persistence"],
    authorId: "EMP-006",
    updatedAt: at,
    body: `- Status: accepted
- Date: 2026-11-01

## Context
Budget is $0. The dashboard must stay available when the CEO's Mac is off. GitHub Pages is free for public repositories and serves static files only.

## Options considered
1. **Static Next.js export on GitHub Pages, data in the browser (localStorage) with JSON export/import.** $0, no accounts beyond GitHub, works offline.
2. Static site + Supabase free tier for data and auth. $0, multi-device, real access control via Row Level Security — but needs a Supabase account, and free projects pause after a week of inactivity.
3. Any server-rendered hosting. Rejected: free tiers either sleep, require a card, or bill on overage.

## Decision
Option 1 now. The data layer is isolated behind one store module so option 2 can be added without rewriting pages.

## Consequences
- The deployed site is public; anyone with the URL sees the **seed data** (profiles, policies, the sample project). Your own edits live only in your browser.
- Data does not sync between devices automatically. Use **Settings → Export** and **Import** to move it. Export regularly as a backup.
- Roles in the dashboard are a safeguard against mistakes, **not** a security boundary: there is no server to enforce them. Do not store confidential client information in this mode.
- Moving to Supabase (option 2) is the recommended upgrade once client data is involved.`,
  },
  {
    id: "KB-014",
    title: "Prompt: Weekly operations report (COO)",
    category: "prompt",
    tags: ["prompt", "coo", "reporting"],
    authorId: "EMP-001",
    updatedAt: at,
    body: `Use as the instructions of an assignment to Charlotte Ashworth (COO). Attach a Settings → Export file or paste the relevant data.

> Prepare the weekly operations report for <dates>. Use only the attached data. Exclude records marked sample. Cover: status of each active project (on track / at risk / off track with evidence), blocked and overdue tasks with owners, pending CEO approvals and their age, workload per employee, and the three decisions you need from me with options and your recommendation.`,
  },
  {
    id: "KB-015",
    title: "Prompt: Release readiness review",
    category: "prompt",
    tags: ["prompt", "qa", "release"],
    authorId: "EMP-013",
    updatedAt: at,
    body: `Use as the instructions of an assignment to Eleanor Whitfield (Independent Quality Reviewer).

> Review release <version> of <project>. Build a claims-vs-evidence table for every acceptance criterion. Re-run the build and tests if you have repository access and report the real output. Check secrets, input validation, authorization, dependencies, accessibility, and RTL. Give findings with severity and evidence, then Go / Go with conditions / No-go.`,
  },
  {
    id: "KB-016",
    title: "SOP: Backup and recovery",
    category: "sop",
    tags: ["backup", "data", "security"],
    authorId: "ceo",
    updatedAt: at,
    body: `In local mode, all your company data lives in this browser's storage.

**Back up**: Settings → Data → **Export JSON**. Do this weekly and before clearing browser data. Store the file somewhere private (not in the public repository).

**Restore / move to another device**: Settings → Data → **Import JSON**. The file is validated before anything is replaced, and the current data is kept as an automatic backup in the browser until the next import.

**Reset**: Settings → Data → **Reset to seed data** (requires confirmation). Export first.

Clearing site data in the browser deletes everything that has not been exported.

**With cloud sync on** (Settings → Cloud sync), the company is also saved in your private Supabase project and every signed-in device stays in step. Keep exporting occasionally anyway: the free project pauses after a week without use (unpause it at supabase.com/dashboard), and an export is your copy if you ever leave Supabase.`,
  },
  {
    id: "KB-018",
    title: "SOP: Request work from your iPhone",
    category: "sop",
    tags: ["phone", "execution", "how-to", "agent-channel"],
    authorId: "ceo",
    updatedAt: "2026-11-01T22:00:00.000Z",
    body: `## One-time setup
1. **Dashboard → Settings → Cloud sync**: sign in with your email link — on the iPhone and on the Mac. Both now show the same company.
2. **Settings → AI team channel → Create agent key.** Copy it once:
   - **Claude Code on the web / iPhone**: claude.ai/code → environment settings → add environment variable \`AICOS_AGENT_KEY\` = the key.
   - **Mac**: run the Keychain command shown in the dialog and paste the key.
3. In **claude.ai/code**, connect GitHub and allow the repositories \`mohamad-ilyas/agency-projects\` (client work — public, so no confidential client material) and \`mohamad-ilyas/ai-company-os\` (internal work).

## A whole client project
Claude app → **Code** → repository **agency-projects** → type:

> /new-project Cedar Bakery wants an iOS + Android ordering app: menu, cart, pickup time, Arabic + English

The team works stage by stage and reports each one. In the dashboard you see the project, its tasks per employee, every employee's output and review, GitHub links, and test builds — and approvals waiting for you. If the session stops, type \`/continue-project cedar-app\`.

## One task
> /task Henry: redesign the checkout screen for RTL in cedar-app

The result appears in the Execution Center for you to approve or send back.

## Writing work without code (any Claude chat)
Execution Center → New assignment → *Claude chat* → *Copy chat prompt* → paste in the Claude app → paste the reply back into *Import the result*.

## What still needs you
Approvals (store publishing, anything sent to a client, spending) and merging code into \`main\`. Store publishing needs paid developer accounts (Apple $99/yr, Google $25 once) — the team will ask first.`,
  },
  {
    id: "KB-017",
    title: "ADR-002: Cloud sync with Supabase (free tier)",
    category: "decision",
    tags: ["adr", "architecture", "persistence", "security"],
    authorId: "EMP-006",
    updatedAt: "2026-11-01T21:00:00.000Z",
    body: `- Status: accepted
- Date: 2026-11-01
- Supersedes: the "data stays in one browser" consequence of ADR-001

## Context
The CEO works from both a phone and a computer. Browser-only storage meant two separate companies.

## Decision
Mirror the company state to one private row per user in Supabase (free tier):
- Sign-in by emailed link; no passwords stored by the app.
- Row Level Security: a user can only read or write their own row. No delete policy.
- Saves go through \`save_company_state(state, base_revision)\`, which only succeeds if the device saw the latest revision — so one device never silently overwrites another. On a conflict the cloud copy wins and the device's copy is kept as a restorable backup.
- The browser keeps working offline from local storage and uploads when the cloud is reachable.
- Language, theme and session role stay per device.
- Only the public URL and publishable key are in the app; the secret key is never used.

## Consequences
- Same data on every signed-in device; data is now protected by authentication and RLS, not just by being in one browser.
- Free tier: 500 MB database (the company uses well under 1 MB). Projects pause after 1 week without activity; unpause from the Supabase dashboard.
- After the CEO's first sign-in, turn off "Allow new users to sign up" in Supabase so no one else can create an account.
- Schema: \`supabase/migrations/0001_company_state.sql\`.`,
  },
];
