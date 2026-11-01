// Generates the Claude Code side of the workforce from the single source of truth
// in src/data/workforce:
//   .claude/agents/<slug>.md            one subagent per AI employee
//   docs/execution-result.schema.json   JSON Schema of the result contract
// Run: npm run workforce:sync   (CI runs it with --check to catch drift)
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { EMPLOYEES } from "../src/data/workforce";
import { agentFile } from "../src/lib/agent-file";
import { executionResultSchema } from "../src/lib/execution/result-schema";
import { agentReportSchema } from "../src/lib/execution/report-schema";

const check = process.argv.includes("--check");
const root = process.cwd();
const outputs = new Map<string, string>();

outputs.set(
  join("docs", "agent-report.schema.json"),
  JSON.stringify(z.toJSONSchema(agentReportSchema, { io: "input" }), null, 2) + "\n",
);
for (const e of EMPLOYEES) outputs.set(join(".claude", "agents", `${e.slug}.md`), agentFile(e));
outputs.set(
  join("docs", "execution-result.schema.json"),
  JSON.stringify(z.toJSONSchema(executionResultSchema, { io: "input" }), null, 2) + "\n",
);

let drift = 0;
for (const [rel, content] of outputs) {
  const path = join(root, rel);
  const current = await readFile(path, "utf8").catch(() => null);
  if (current === content) continue;
  if (check) {
    console.error(`out of date: ${rel}`);
    drift++;
    continue;
  }
  await mkdir(join(path, ".."), { recursive: true });
  await writeFile(path, content);
  console.log(`wrote ${rel}`);
}

if (check && drift) {
  console.error(`\n${drift} generated file(s) are stale. Run: npm run workforce:sync`);
  process.exit(1);
}
console.log(check ? "workforce files are up to date" : `done (${EMPLOYEES.length} employees)`);
