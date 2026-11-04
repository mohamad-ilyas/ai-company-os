import type { KnowledgeArticle } from "../lib/types";
import { EMPLOYEES } from "./workforce";

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
    updatedAt: "2026-11-02T09:00:00.000Z",
    body: `Approvals have two levels. Employees may prepare any of these; they never perform them without the decision.

## Decided by the COO (Charlotte Ashworth, EMP-001) — delegated by the CEO
- Merges to main
- Production and preview deployments
- Public releases of the team's work (apps, previews, designs)
- Access to real project or client data needed for the work
- Production database changes
- Repository-level irreversible changes

## Decided by the CEO — always brought by the COO, marked urgent when blocking
- Spending money, purchasing subscriptions, changing billing
- Contracts and commitments
- Anything sent to a client on the company's behalf (proposals, communications)
- Deleting important company data

Every request records: action, requester, reason, impact, risk, supporting files, decision, who decided, and when.

**How it is enforced in the platform**
- A task with a protected action can't complete until a matching approval is approved.
- The team's reports can file approval requests; only the COO's reports can decide them, and only COO-level ones. CEO-level requests can only be filed by the COO.
- Only the CEO role decides CEO-level approvals in the Approval Center. The CEO can also decide any COO-level approval.
- In \`agency-projects\`, merges and deployments run automatically once the COO's release decision is committed — no CEO click needed.`,
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
4. Click **Mark as started** in the dashboard if you want the assignment to show *Started in Claude* while it runs.
5. When it finishes, go to **4 · Import the result** → **Choose result file** (or paste the JSON), then **Validate and import**.
6. Review the output: **Approve** or **Request changes**. Approving completes the task (or, if it is protected, sends it for approval — Charlotte's or yours, depending on the action).

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
4. Copy the whole reply (or just the JSON block), paste it under **4 · Import the result**, then **Validate and import**.
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
| 8. Release decision | COO (Charlotte) | Approve/reject the merge and deployment, based on QA and the independent review |
| 9. Delivery | COO + Project Manager | Live links, release notes, documentation; the COO hands the final output to the CEO |

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
No open critical/high defects · regression suite green · independent review recommendation is *Go* or *Go with conditions* · release decision recorded (Charlotte, COO).

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

**Restore / move to another device**: Settings → Data → **Import JSON**. The file is validated before anything is replaced.

**Automatic backups**: before an import, a reset, a restore, or a sync that replaces this device's data, the dashboard keeps a copy (Settings → Data → *Backups on this device*, the last 5). Restore any of them there — the data it replaces is backed up too.

**Reset**: Settings → Data → *Danger zone* → **Reset to seed data** (requires confirmation; a backup is taken first). While signed in to cloud sync, the reset reaches your other devices too.

**If the dashboard ever crashes**, the error screen offers **Download my data** (everything this browser holds, unprocessed) — keep that file and import it, or send it to Charlotte.

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
   - **Claude Code on the web / iPhone** (do it once, from any browser — it applies to the Claude app too): claude.ai/code → the environment selector under the message box → ⚙ on your environment → **Network secrets** → **Add secret**: Allowed websites \`qdezhdwmjrmpqjgzludj.supabase.co\`; Custom header name \`X-Aicos-Agent-Key\`, prefix empty, value = the key. Use a network secret, not an environment variable: the secret is added by Anthropic's proxy and never enters the cloud machine, and it also lets sessions reach the dashboard's server.
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
Execution Center → New assignment → *Claude chat* → *Copy chat prompt* → paste in the Claude app → paste the reply back under **4 · Import the result** → **Validate and import**.

## What still needs you
Only CEO-level decisions, which Charlotte (COO) brings you — marked urgent when they block work: spending (e.g. Apple $99/yr, Google Play $25), contracts, anything sent to a client, and deleting company data. Merges, deployments, and releases are Charlotte's decision.`,
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
  {
    id: "KB-019",
    title: "Learning programme: playbooks and resources for every role",
    category: "learning",
    tags: ["learning", "playbooks", "best-practices"],
    authorId: "EMP-001",
    updatedAt: "2026-11-02T09:00:00.000Z",
    body: `Every employee keeps learning their craft, what's new in the market, and the best practices of their role.

## How it works
- Each employee has a **living playbook** at \`playbooks/<slug>.md\` in \`agency-projects\`: current best practices, checklists, and "what's new" with dated sources. They read it before every assignment.
- **Learning sessions** (\`/learn\`) research the resources below and recent developments, then update the playbooks and publish a dated learning note here (category *Learning*). A scheduled Claude routine runs it every Monday at 06:00 (Hebron time), rotating through the team; you can also run it any time.
- Lessons from real projects (review findings, bugs that escaped) are added to the playbook of the role that can prevent them next time.

## Resources by role
${EMPLOYEES.map((e) => `### ${e.name.en} — ${e.title.en}\nFocus: ${e.learning?.focus.join("; ") ?? "—"}\n${(e.learning?.resources ?? []).map((r) => `- [${r.label}](${r.url})`).join("\n")}`).join("\n\n")}`,
  },
  {
    id: "KB-020",
    title: "Chain of command and release process",
    category: "policy",
    tags: ["governance", "release", "coo"],
    authorId: "ceo",
    updatedAt: "2026-11-02T09:00:00.000Z",
    body: `## One point of contact
**Charlotte Ashworth (COO, EMP-001)** is the only employee who communicates with the CEO. The CEO tells Charlotte what they want; Charlotte makes the company deliver it and hands back the final output. She contacts the CEO only for CEO-level decisions (see *CEO approval policy*), marked **URGENT** when they block work, in the **Direct line** channel and in the Claude session.

## Reporting lines
- CEO → Charlotte (COO)
- Charlotte → Oliver (Business Analyst), Sarah (Project Manager), Alexander (Design Architect), James (Tech Lead), Victoria (QA Manager), Eleanor (Independent Reviewer — outside the delivery chain)
- Alexander → Henry (UI/UX) → Imogen (Brand), Edward (Content)
- James → Thomas (Mobile), Emily (Frontend), William (Backend)
- Victoria → Amelia (Manual QA), George (Automation QA)

## Release process (agency-projects)
1. The team finishes the work on branch \`project/<key>\`; Edward reviews all written content and Alexander all design.
2. QA signs off and Eleanor issues Go / Go with conditions / No-go.
3. Charlotte decides. On approval she commits \`projects/<key>/release.json\` with her decision and evidence.
4. GitHub's **Release** workflow checks the decision, runs the tests and build, merges the branch into \`main\`, and deploys it to \`https://mohamad-ilyas.github.io/agency-projects/<key>/\`.
5. Charlotte delivers the final output to the CEO: outcome, live links, what was verified, open risks.

Rollback: revert the merge commit on \`main\`; the next Release run redeploys.`,
  },
];
