# AI Company OS

Internal operating platform for an AI-powered digital agency. The owner is the
Founder & CEO. Thirteen senior **AI employees** are defined here as profiles with
individual instructions; they do work only when the CEO runs an assignment in an
authorized Claude session (Claude Code or claude.ai on the Pro plan).

**GitHub account:** `mohamad-ilyas`. Commits use the repository-local git
identity; don't change it.

## Non-negotiables

- **$0 additional budget.** No paid services, APIs, trials, or anything needing a
  card. Claude Pro does not include API credits — never call the Anthropic API.
  If a feature seems to need money, stop and say so.
- **No backend.** Static Next.js export on GitHub Pages. No API routes, server
  actions, middleware, or `cookies()`.
- **CEO approval** is required for: production deployment, production DB changes,
  public releases, client proposals, external communications, contracts,
  spending, subscriptions, billing, sensitive client data, deleting important
  data, irreversible changes. Prepare these; never perform them. Never `git push`
  unless the CEO asks in this session.
- **Honesty.** Never fabricate tests, metrics, or progress. Sample records carry
  `sample: true` and are excluded from KPIs. The dashboard never shows an
  employee as working unless an assignment was actually started.
- **No secrets** in the repo, build output, or logs.

## Commands and the agent channel

`/new-project`, `/continue-project`, `/task`, `/run-assignment` (in `.claude/commands/`). Work is reported with
`node scripts/aicos-report.mjs <report.json>` (format: `docs/agent-report.md`); the dashboard applies reports
through `src/lib/execution/apply-report.ts` with an operator role. Client code never goes in this public repo —
it belongs in the private `agency-projects` repo (kit: `npm run kit:export -- ../agency-projects`).

## Running an assignment

When the CEO runs `/run-assignment <packet.json or pasted packet>`, follow
`.claude/commands/run-assignment.md`. Employees are subagents in
`.claude/agents/<slug>.md`. Results go to `company/outbox/` (git-ignored) and are
validated with `npm run result:check -- <file>`.

## Layout

```
src/data/workforce/     13 employee profiles + departments  ← source of truth
src/data/seed.ts        initial company state (real records + flagged samples)
src/data/knowledge.ts   policies, standards, SOPs, ADRs, prompts
src/lib/domain.ts       all business rules (pure functions, unit-tested)
src/lib/workflow.ts     lifecycle stages, status transitions
src/lib/store.tsx       localStorage working copy + change hooks
src/lib/cloud/          Supabase cloud sync (reconcile.ts is pure + tested)
supabase/migrations/    SQL for the cloud table, RLS, save function
src/lib/execution/      assignment packet + result schema (the Claude bridge)
src/lib/i18n/           en.ts / ar.ts — Arabic must stay complete (type-checked)
src/app/                one folder per module; detail pages use ?id= query
.claude/agents/         GENERATED — run `npm run workforce:sync` after editing profiles
docs/                   architecture, result JSON schema
tests/unit, tests/e2e   Vitest domain tests, Playwright journeys
```

## Conventions

- Every mutation goes through a function in `domain.ts` (permission check +
  audit log entry). Pages call them via `useRun()`.
- UI text comes from `src/lib/i18n`. Add keys to **both** `en.ts` and `ar.ts`.
- RTL: use logical Tailwind utilities (`ms-`, `pe-`, `start-`, `border-s`); add
  `flip-rtl` to directional icons.
- Internal links use `next/link` with trailing slashes (`/tasks/view/?id=…`) so
  they work under the GitHub Pages base path.
- Charts: colours follow the entity (department slots 1–4); status colours are
  reserved and always paired with a label.

## Verify before claiming done

```
npm run verify        # lint, typecheck, unit tests, workforce drift, build
npm run test:e2e      # builds with the Pages base path and runs Playwright
```
Report the real output.
