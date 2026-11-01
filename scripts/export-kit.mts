// Exports the "studio kit" — the AI team, its commands, and the reporting channel —
// into the client-projects repository (agency-projects), so /new-project can run there.
// Usage: npm run kit:export -- ../agency-projects
import { copyFile, mkdir, writeFile } from "node:fs/promises";
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
for (const c of ["new-project", "quick-app", "continue-project", "task"]) await copy(join(".claude", "commands", `${c}.md`));
for (const f of ["scripts/aicos-report.mjs", "aicos.config.json", "docs/agent-report.md", "docs/agent-report.schema.json"]) await copy(f);
await write("company/outbox/.gitkeep", "");

// Previews: the CEO (only) runs this to publish every project branch that has a build:preview script.
await write(
  ".github/workflows/publish-previews.yml",
  `# Publishes a live preview of every project branch (project/<key>) whose app has a
# "build:preview" script, at https://<owner>.github.io/<repo>/<key>/.
# Run by the CEO only: Actions → Publish previews → Run workflow. The deploy also
# waits for approval in the github-pages environment.
name: Publish previews

on:
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v7
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v7
        with:
          node-version: 24
      - name: Build every project preview
        env:
          REPO: \${{ github.event.repository.name }}
        run: |
          set -u
          mkdir -p site
          items=""
          for ref in $(git for-each-ref --format='%(refname:short)' 'refs/remotes/origin/project/*'); do
            key="\${ref#origin/project/}"
            git worktree add --detach "wt/$key" "$ref" >/dev/null
            app="wt/$key/projects/$key/app"
            if [ -f "$app/package.json" ] && node -e "process.exit(require('./$app/package.json').scripts?.['build:preview'] ? 0 : 1)"; then
              if (cd "$app" && npm ci && BASE_PATH="/$REPO/$key/" npm run build:preview) && [ -d "$app/dist" ]; then
                cp -r "$app/dist" "site/$key"
                items="$items<li><a href=\"$key/\">$key</a></li>"
              else
                echo "::warning::Preview build failed for $key"
              fi
            fi
          done
          printf '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Previews</title><body style="font-family:system-ui;max-width:40rem;margin:3rem auto;padding:0 1rem"><h1>Project previews</h1><ul>%s</ul></body></html>' "$items" > site/index.html
          touch site/.nojekyll
      - uses: actions/upload-pages-artifact@v5
        with:
          path: site

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v5
`,
);

await write(
  ".gitignore",
  `node_modules/
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

await write(
  "CLAUDE.md",
  `# Agency projects (public)

Client work by the AI Company OS team. **This repository is PUBLIC** (CEO decision, for free unlimited builds):
everything committed here is visible to anyone. See the rules below before writing anything.
Dashboard: https://mohamad-ilyas.github.io/ai-company-os/ (source: mohamad-ilyas/ai-company-os).

- Start a client project: \`/new-project <request>\`. Small app or prototype: \`/quick-app <request>\`.
  Resume: \`/continue-project <key>\`. One task: \`/task <employee>: <what>\`.
- Previews: only the CEO runs Actions → **Publish previews**; it serves each project at /agency-projects/<key>/.
- Each client project lives in \`projects/<key>/\` on branch \`project/<key>\`; \`PROJECT.md\` there is its state file.
- The 13 employees are subagents in \`.claude/agents/\`. They are generated from the dashboard repository — edit them there
  and re-export (\`npm run kit:export -- ../agency-projects\` in ai-company-os), not here.
- Report every stage to the dashboard with \`node scripts/aicos-report.mjs <file>\` (see \`docs/agent-report.md\`).
  The agent key comes from \`AICOS_AGENT_KEY\` or the macOS Keychain item \`aicos-agent-key\`; never write it to a file.

## Non-negotiables
- Public repository: never commit secrets, signing keys, credentials, personal data, or confidential client material.
  Use client codenames unless the CEO said the name may be public. NDA/confidential work → ask the CEO for a private repo.
- $0: no paid services, APIs, trials, or accounts. Apple Developer ($99/yr) and Google Play ($25) need CEO approval.
- Protected actions (store publishing, anything public, client communication, contracts, spending, deleting data,
  production deployment) are prepared and sent to the CEO's Approval Center — never performed.
- Never fabricate results. Never commit secrets, signing keys, or client credentials.
- Never push to \`main\`, never force-push, never merge — the CEO reviews and merges.
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
