// Exports the "studio kit" — the AI team, its commands, and the reporting channel —
// into the client-projects repository (agency-projects), so /new-project can run there.
// Usage: npm run kit:export -- ../agency-projects
import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { EMPLOYEES } from "../src/data/workforce";
import { agentFile } from "../src/lib/agent-file";

const target = process.argv[2];
if (!target) {
  console.error("usage: npm run kit:export -- <path to the client-projects repository>");
  process.exit(2);
}
const root = process.cwd();
const dest = resolve(target);

async function write(rel: string, content: string) {
  await mkdir(dirname(join(dest, rel)), { recursive: true });
  await writeFile(join(dest, rel), content);
  console.log(`wrote ${rel}`);
}
async function copy(rel: string) {
  await mkdir(dirname(join(dest, rel)), { recursive: true });
  await copyFile(join(root, rel), join(dest, rel));
  console.log(`copied ${rel}`);
}

for (const e of EMPLOYEES) await write(join(".claude", "agents", `${e.slug}.md`), agentFile(e));
for (const c of ["new-project", "quick-app", "continue-project", "task", "learn", "ask-coo"]) await copy(join(".claude", "commands", `${c}.md`));
for (const f of ["scripts/aicos-report.mjs", "aicos.config.json", "docs/agent-report.md", "docs/agent-report.schema.json"]) await copy(f);
await write("company/outbox/.gitkeep", "");

await write(
  ".gitignore",
  `node_modules/
.DS_Store
.expo/
dist/
build/
*.apk
*.aab
*.ipa
.env*
*.keystore
*.jks
*.p8
*.p12
*.mobileprovision
# Report files can contain client material; they are delivered through the agent channel.
/company/outbox/*
!/company/outbox/.gitkeep
.claude/settings.local.json
`,
);

// Delivery: report files committed by the team are sent to the dashboard from GitHub, so cloud
// sessions don't need network access to Supabase. Re-sending is safe (the server de-duplicates).
await write(
  ".github/workflows/deliver-reports.yml",
  `# Delivers the AI team's committed report files to the CEO's dashboard.
# Scans every branch for projects/<key>/reports/*.json and reports/*.json and sends each one;
# the dashboard stores each reportId once, so re-sending is harmless.
# Needs the repository secret AICOS_AGENT_KEY (Settings → Secrets and variables → Actions).
name: Deliver team reports

on:
  push:
    branches-ignore: [main]
    paths: ["projects/*/reports/*.json", "reports/*.json"]
  schedule:
    - cron: "*/10 * * * *"
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: deliver-reports
  cancel-in-progress: false

jobs:
  deliver:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v7
        with:
          ref: main
          fetch-depth: 0
      - uses: actions/setup-node@v7
        with:
          node-version: 24
      - name: Deliver report files from every branch
        env:
          AICOS_AGENT_KEY: \${{ secrets.AICOS_AGENT_KEY }}
        run: |
          if [ -z "$AICOS_AGENT_KEY" ]; then echo "::error::Repository secret AICOS_AGENT_KEY is not set"; exit 1; fi
          sent=0; failed=0
          # A bare prefix matches branches at any depth (project/todo-app); a trailing /* would not.
          for ref in $(git for-each-ref --format='%(refname:short)' refs/remotes/origin | grep -vx 'origin/HEAD' | grep -vx 'origin'); do
            for f in $(git ls-tree -r --name-only "$ref" | grep -E '^(projects/[^/]+/)?reports/[^/]+\\.json$'); do
              git show "$ref:$f" > "$RUNNER_TEMP/report.json"
              if node scripts/aicos-report.mjs "$RUNNER_TEMP/report.json" > /dev/null; then
                sent=$((sent+1))
              else
                failed=$((failed+1)); echo "::warning::Not delivered: $ref:$f"
              fi
            done
          done
          echo "Reports delivered or already received: $sent. Failed: $failed."
          [ "$failed" -eq 0 ]
`,
);

// Release: merges and deploys work the COO approved (kit/release.yml), then reports the delivery.
await write(".github/workflows/release.yml", await readFile(join(root, "kit", "release.yml"), "utf8"));
await rm(join(dest, ".github", "workflows", "publish-previews.yml"), { force: true });

// Learning: every employee's focus and resources, for /learn and the playbooks.
await write(
  "docs/learning-resources.md",
  `# Learning resources by role\n\nUsed by \`/learn\`. Generated from the dashboard repository — edit there.\n\n` +
    EMPLOYEES.map(
      (e) =>
        `## ${e.name.en} — ${e.title.en} (\`${e.slug}\`)\n\nFocus: ${e.learning?.focus.join("; ") ?? "—"}\n\n${(e.learning?.resources ?? []).map((r) => `- [${r.label}](${r.url})`).join("\n")}\n`,
    ).join("\n"),
);
await write(
  "playbooks/README.md",
  `# Playbooks\n\nOne living playbook per employee (\`<slug>.md\`): best practices for the role, what's new (dated, with sources), and lessons from our projects. Every employee reads theirs before each assignment. \`/learn\` keeps them current.\n`,
);

await write(
  "CLAUDE.md",
  `# Agency projects (public)

Client work by the AI Company OS team. **This repository is PUBLIC** (CEO decision, for free unlimited builds):
everything committed here is visible to anyone. See the rules below before writing anything.
Dashboard: https://mohamad-ilyas.github.io/ai-company-os/ (source: mohamad-ilyas/ai-company-os).

- Start a client project: \`/new-project <request>\`. Small app or prototype: \`/quick-app <request>\`.
  Resume: \`/continue-project <key>\`. One task: \`/task <employee>: <what>\`.
- Releases: the COO (Charlotte) approves by committing \`projects/<key>/release.json\`; the **Release** workflow merges and
  deploys it to /agency-projects/<key>/ and reports the delivery. Learning: \`/learn\` updates \`playbooks/\`.
- Each client project lives in \`projects/<key>/\` on branch \`project/<key>\`; \`PROJECT.md\` there is its state file.
- The 13 employees are subagents in \`.claude/agents/\`. They are generated from the dashboard repository — edit them there
  and re-export (\`npm run kit:export -- ../agency-projects\` in ai-company-os), not here.
- Report every stage to the dashboard with \`node scripts/aicos-report.mjs <file>\` (see \`docs/agent-report.md\`).
  The agent key comes from \`AICOS_AGENT_KEY\` or the macOS Keychain item \`aicos-agent-key\`; never write it to a file.

## Non-negotiables
- Public repository: never commit secrets, signing keys, credentials, personal data, or confidential client material.
  Use client codenames unless the CEO said the name may be public. NDA/confidential work → ask the CEO for a private repo.
- $0: no paid services, APIs, trials, or accounts. Apple Developer ($99/yr) and Google Play ($25) need CEO approval.
- Merges, deployments and releases: the COO decides. Spending, contracts, client communication, deleting company
  data: the CEO decides, brought by the COO. Prepare these; never perform them without the decision.
- Never fabricate results. Never commit secrets, signing keys, or client credentials.
- Never push to \`main\` or force-push. Merges happen only through the Release workflow after the COO's approval.
- Only Charlotte Ashworth (COO) addresses the CEO.
`,
);

await write(
  "README.md",
  `# Agency projects

Public workspace where the AI Company OS team builds client projects. Each project is in \`projects/<key>/\`
on its own branch, with requirements, design, architecture, code, tests, review, and release notes.

Progress, outputs, and approvals appear in the dashboard: https://mohamad-ilyas.github.io/ai-company-os/

From the Claude app on iPhone → Code → this repository:

    /new-project Cedar Bakery wants an iOS + Android ordering app: menu, cart, pickup time, Arabic + English
`,
);
console.log(`\nKit exported to ${dest}`);
