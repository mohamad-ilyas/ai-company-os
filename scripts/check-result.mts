// Validates a result file before it is imported into the dashboard.
// Usage: npm run result:check -- company/outbox/EXE-0001.result.json
import { readFile } from "node:fs/promises";
import { parseExecutionResult } from "../src/lib/execution/result-schema";

const path = process.argv[2];
if (!path) {
  console.error("usage: npm run result:check -- <result.json>");
  process.exit(2);
}
const outcome = parseExecutionResult(await readFile(path, "utf8"));
if (!outcome.ok) {
  console.error(`INVALID ${path}`);
  for (const issue of outcome.issues) console.error(`  - ${issue}`);
  process.exit(1);
}
const r = outcome.result;
console.log(`OK ${path}: ${r.executionId} by ${r.employeeId}, status ${r.status}, ${r.deliverables.length} deliverable(s)`);
