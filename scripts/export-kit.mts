// Exports the "studio kit" — the AI team, its commands, and the reporting channel —
// into the private client-projects repository, so /new-project can run there.
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
for (const c of ["new-project", "continue-project", "task"]) await copy(join(".claude", "commands", `${c}.md`));
for (const f of ["scripts/aicos-report.mjs", "aicos.config.json", "docs/agent-report.md", "docs/agent-report.schema.json"]) await copy(f);
await write("company/outbox/.gitkeep", "");

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
  `# Agency projects (private)

Client work by the AI Company OS team. **This repository is private — keep it that way.**
Dashboard: https://mohamad-ilyas.github.io/ai-company-os/ (source: mohamad-ilyas/ai-company-os).

- Start a client project: \`/new-project <request>\`. Resume: \`/continue-project <key>\`. One task: \`/task <employee>: <what>\`.
- Each client project lives in \`projects/<key>/\` on branch \`project/<key>\`; \`PROJECT.md\` there is its state file.
- The 13 employees are subagents in \`.claude/agents/\`. They are generated from the dashboard repository — edit them there
  and re-export (\`npm run kit:export -- ../agency-projects\` in ai-company-os), not here.
- Report every stage to the dashboard with \`node scripts/aicos-report.mjs <file>\` (see \`docs/agent-report.md\`).
  The agent key comes from \`AICOS_AGENT_KEY\` or the macOS Keychain item \`aicos-agent-key\`; never write it to a file.

## Non-negotiables
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

Private workspace where the AI Company OS team builds client projects. Each project is in \`projects/<key>/\`
on its own branch, with requirements, design, architecture, code, tests, review, and release notes.

Progress, outputs, and approvals appear in the dashboard: https://mohamad-ilyas.github.io/ai-company-os/

From the Claude app on iPhone → Code → this repository:

    /new-project Cedar Bakery wants an iOS + Android ordering app: menu, cart, pickup time, Arabic + English
`,
);
console.log(`\nKit exported to ${dest}`);
