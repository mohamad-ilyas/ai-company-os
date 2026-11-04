# AI Company OS

The internal operating platform for an AI-powered digital agency: a CEO dashboard,
15 senior AI employees with individual instructions and learning plans, projects, tasks, workflows,
a CEO Approval Center, and a bridge to run work through your own Claude sessions.

**Cost: $0 on top of Claude Pro.** Static site on GitHub Pages, no backend, no AI API.

## What's in it

| Module | What you can do |
|---|---|
| CEO Overview | Headcount, projects, tasks by status, pending approvals, quality, AI execution, infrastructure, $0 spend |
| Org Chart / Employees / Departments | Reporting lines, searchable directory, full profiles (bio, skills, authority, KPIs, instructions, work, performance, activity) |
| Projects & Clients | Create projects, milestones, risks, team, discussion; one click generates the 13-task standard lifecycle |
| Tasks | Board and list views, dependencies, acceptance criteria, comments, history, protected actions |
| Workflow | The 9-stage lifecycle with owners, outputs, and the rules the system enforces |
| Execution Center | Assign work to an AI employee → run it in Claude → import → approve or request changes → hand off |
| Approval Center | Every protected action waits for your decision; rejection needs a note |
| Communication | Company, department and project channels, decisions, meeting notes |
| Deliverables | Where every deliverable lives (links/paths only — files are never uploaded) |
| Knowledge Base | Policies, standards, SOPs, templates, ADRs, reusable prompts |
| Activity & Audit | Every recorded action, filterable, exportable |
| Performance | KPIs from recorded work only; sample data excluded unless you include it |
| Settings | Company, founder, theme, language, roles, employees, departments, data export/import, deployment info |

English and Arabic (RTL), light and dark, desktop to phone.

## How AI employees actually work

An AI employee is a **profile** — not a background process. Nothing runs unless you start it.

1. **Execution Center → New assignment**: choose the employee, link a task, write instructions.
2. Run it with your Claude Pro plan, either way:
   - **Claude Code** (engineering/QA, needs this repository): download the packet, then in this folder run
     `claude "/run-assignment ~/Downloads/EXE-0001.assignment.json"`. Claude Code delegates to the
     employee's subagent (`.claude/agents/<slug>.md`) and writes `company/outbox/EXE-0001.result.json`.
   - **Claude chat** (writing, analysis, specs — any device): *Copy chat prompt*, paste into claude.ai,
     copy the reply back.
3. **Import result** (file or paste). It is validated before anything is recorded.
4. **Approve** (completes the task, or sends it to you for approval if protected) or **Request changes**.
5. **Create handoff** passes the approved output to the next employee as context.

## Your data

- **Cloud sync (Settings → Cloud sync):** sign in with GitHub (or an emailed link, opened in the same browser) and the
  same company appears on your phone and computer. It's stored in your private Supabase project (free tier) behind Row Level Security. Works offline;
  uploads when back online.
- Without signing in, data stays in **this browser** only. Visitors to the public site see only the seed data.
- **Backups on this device:** before an import, reset, restore, or a sync that replaces this device's data, a copy is
  kept (Settings → Data, last 5). If the dashboard ever crashes, the error screen offers *Download my data*.
- **Settings → Data → Export JSON** is your independent backup. The free Supabase project pauses after a week
  without use — unpause it at supabase.com/dashboard.
- Roles (CEO / Operator / Viewer) are UI safeguards; the data itself is protected by sign-in + RLS.

## Live, with the team

- **The data is live and stored in the cloud** (Supabase, free tier). The site's files are static (GitHub Pages,
  $0), but every change — yours on any device, or the team's — is saved to the cloud and pushed to every open
  dashboard within about a second over Supabase Realtime (the **Live** badge). No reload needed.
- **Give the team work from the dashboard:** on any task or project, **Send to the team** opens Claude Code
  with the request ready (ids included). Press send; the team reports into that same task or project as they
  go — when each step starts and ends. **Message Charlotte** does the same for anything else.
- **Honest limit:** the team works inside your Claude sessions (Pro plan, no paid API), so a session has to be
  running — the dashboard can't start one by itself. From Claude Code on the Mac reports arrive in seconds;
  from Claude Code on the web, in seconds with the network secret, otherwise in about a minute via GitHub.

## The AI team channel

Claude sessions report the team's work straight into the dashboard: projects, tasks, each employee's output and
review, deliverables, messages, and approval requests. A session needs an **agent key** (Settings → AI team
channel), which can only *add reports to your inbox* — it can't read or change anything. The dashboard applies
each report with the normal rules: the team can't decide approvals, delete data, or complete protected tasks.

Commands (in Claude Code, on the Mac or at claude.ai/code on your phone):

| Command | What happens |
|---|---|
| `/ask-coo <message>` | Talk to Charlotte (COO) now — status, instructions, urgent decisions; recorded on the Direct line |
| `/quick-app <request>` | Small app or prototype with a lean team; released by Charlotte |
| `/learn [rotation\|all\|slugs]` | Learning session: research best practices and what's new, update playbooks, publish learning notes |
| `/new-project <request>` | Full lifecycle: requirements → plan → design → architecture → build → CI test builds → QA → independent review → release prep and approval requests. Client code goes to the public `agency-projects` repository (codenames, no confidential material; NDA work needs a private repo). |
| `/continue-project <key>` | Resume where the team stopped |
| `/task <employee>: <what>` | One task, reviewed by you in the dashboard |
| `/run-assignment <packet>` | Run an assignment created in the dashboard |

See `docs/agent-report.md` and Knowledge Base → *SOP: Request work from your iPhone*.

## How the company is run

- **Charlotte Ashworth (COO)** is the CEO's only point of contact. She takes requests, runs the team, decides merges,
  deployments and releases, and delivers the final output on the dashboard's **Direct line**. She asks the CEO only for
  CEO-level decisions — spending, contracts, client communication, deleting company data — marked urgent when blocking.
- **Alexander Whitmore** (Principal UI/UX Design Architect) reviews all design, including 3D and motion; **Edward
  Langley** (Content) reviews all text.
- Every employee has a **learning plan** (Profile → Learning) and a living playbook in `agency-projects/playbooks/`,
  kept current by `/learn` (scheduled weekly).

## From your phone

- **Writing, plans, specs, reviews:** Execution Center → assignment → *Copy chat prompt* → Claude app → paste the
  reply back into *Import the result*.
- **Code and repository work:** choose *Claude Code*, tap *Copy command for Claude Code web*, open
  [claude.ai/code](https://claude.ai/code), pick `mohamad-ilyas/ai-company-os`, paste. Copy the JSON block from the
  reply back into the dashboard. Code changes land on a separate branch for you to review.

## Deploying (GitHub Pages)

The workflow in `.github/workflows/ci-deploy.yml` lints, type-checks, runs unit tests and `npm audit`, builds once
with the production configuration, runs the E2E suite (Chromium + iPhone WebKit, accessibility checks) against that
build, scans it for secrets, and deploys that same build of `main` to `https://<user>.github.io/ai-company-os/`.

Cloud sync connects to the Supabase project in `aicos.config.json` (public URL and publishable key only).
The database schema is in `supabase/migrations/` (apply them in order; `0005_hardening.sql` adds atomic report
outcomes, submission limits and write guards — the dashboard also works against a database without it).

One-time setup (needs the repository owner):
1. Create the repository under `mohamad-ilyas`. It must be **public** for free GitHub Pages.
2. Settings → Pages → Source: **GitHub Actions**.
3. Settings → Environments → `github-pages`: deployments from `main` only. (No required reviewer: the CEO
   decided on 2026-11-04 that deploys don't wait for them — CI must pass first.)

## Development

```bash
npm install
npm run dev              # http://localhost:3000
npm run verify           # lint + typecheck + unit tests + workforce drift check + build
npm run test:e2e         # builds under /ai-company-os (production config) and runs Playwright; Supabase is stubbed
npm run preview          # serve out/ like GitHub Pages at http://localhost:4173/ai-company-os/
npm run workforce:sync   # regenerate .claude/agents after editing src/data/workforce
npm run result:check -- company/outbox/EXE-0001.result.json
```

Stack: Next.js 16 (static export), React 19, TypeScript, Tailwind CSS 4, Zod, lucide-react,
Vitest, Playwright. Fonts (Inter, IBM Plex Sans Arabic) are self-hosted at build time.
