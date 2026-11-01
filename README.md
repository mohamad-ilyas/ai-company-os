# AI Company OS

The internal operating platform for an AI-powered digital agency: a CEO dashboard,
13 senior AI employees with individual instructions, projects, tasks, workflows,
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

- **Cloud sync (Settings → Cloud sync):** sign in with an emailed link and the same company appears on your phone
  and computer. It's stored in your private Supabase project (free tier) behind Row Level Security. Works offline;
  uploads when back online.
- Without signing in, data stays in **this browser** only. Visitors to the public site see only the seed data.
- **Settings → Data → Export JSON** is your independent backup. The free Supabase project pauses after a week
  without use — unpause it at supabase.com/dashboard.
- Roles (CEO / Operator / Viewer) are UI safeguards; the data itself is protected by sign-in + RLS.

## From your phone

- **Writing, plans, specs, reviews:** Execution Center → assignment → *Copy chat prompt* → Claude app → paste the
  reply back into *Import the result*.
- **Code and repository work:** choose *Claude Code*, tap *Copy command for Claude Code web*, open
  [claude.ai/code](https://claude.ai/code), pick `mohamad-ilyas/ai-company-os`, paste. Copy the JSON block from the
  reply back into the dashboard. Code changes land on a separate branch for you to review.

## Deploying (GitHub Pages)

The workflow in `.github/workflows/ci-deploy.yml` lints, type-checks, runs unit and E2E tests, builds, and
deploys `main` to `https://<user>.github.io/ai-company-os/`.

Cloud sync is enabled by two repository **variables** (Settings → Secrets and variables → Actions → Variables):
`SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`. Run `supabase/migrations/0001_company_state.sql` once in the
Supabase SQL editor.

One-time setup (needs the repository owner):
1. Create the repository under `mohamad-ilyas`. It must be **public** for free GitHub Pages.
2. Settings → Pages → Source: **GitHub Actions**.
3. Settings → Environments → `github-pages` → add yourself as **Required reviewer** — every production
   deploy then waits for your approval inside GitHub.

## Development

```bash
npm install
npm run dev              # http://localhost:3000
npm run verify           # lint + typecheck + unit tests + workforce drift check + build
npm run test:e2e         # builds under /ai-company-os and runs Playwright
npm run preview          # serve out/ like GitHub Pages at http://localhost:4173/ai-company-os/
npm run workforce:sync   # regenerate .claude/agents after editing src/data/workforce
npm run result:check -- company/outbox/EXE-0001.result.json
```

Stack: Next.js 16 (static export), React 19, TypeScript, Tailwind CSS 4, Zod, lucide-react,
Vitest, Playwright. Fonts (Inter, IBM Plex Sans Arabic) are self-hosted at build time.
