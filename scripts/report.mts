// Sends an AI team report (aicos.report/v1) to the CEO's dashboard inbox.
// Usage: npm run report -- <report.json>        (validates first; never sends invalid reports)
//        npm run report -- --check <report.json> (validate only)
//
// The agent key is read from AICOS_AGENT_KEY, or on macOS from the Keychain item
// "aicos-agent-key". It is never written to disk by this script.
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseAgentReport } from "../src/lib/execution/report-schema";

const args = process.argv.slice(2);
const checkOnly = args.includes("--check");
const path = args.find((a) => !a.startsWith("--"));
if (!path) {
  console.error("usage: npm run report -- [--check] <report.json>");
  process.exit(2);
}

const raw = await readFile(path, "utf8");
let data: unknown;
try {
  data = JSON.parse(raw);
} catch {
  console.error(`INVALID ${path}: not JSON`);
  process.exit(1);
}
const parsed = parseAgentReport(data);
if (!parsed.ok) {
  console.error(`INVALID ${path}`);
  for (const issue of parsed.issues) console.error(`  - ${issue}`);
  process.exit(1);
}
console.log(`OK ${path}: ${parsed.report.actions.length} action(s)`);
if (checkOnly) process.exit(0);

function agentKey(): string | null {
  if (process.env.AICOS_AGENT_KEY) return process.env.AICOS_AGENT_KEY.trim();
  if (process.platform === "darwin") {
    try {
      return execFileSync("security", ["find-generic-password", "-s", "aicos-agent-key", "-w"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    } catch {
      /* not in Keychain */
    }
  }
  return null;
}

const key = agentKey();
if (!key) {
  console.error(
    "NO_AGENT_KEY: no agent key on this machine. The report was NOT sent.\n" +
      "Fallback: paste the report JSON into the dashboard → Execution Center → Import team report.\n" +
      "Setup: dashboard → Settings → AI team channel → Create agent key.",
  );
  process.exit(3);
}

const config = JSON.parse(await readFile(join(process.cwd(), "aicos.config.json"), "utf8"));
const res = await fetch(`${config.supabaseUrl}/rest/v1/rpc/submit_agent_report`, {
  method: "POST",
  headers: { apikey: config.supabasePublishableKey, "Content-Type": "application/json" },
  body: JSON.stringify({ p_key: key, p_payload: parsed.report }),
});
const body = await res.text();
if (!res.ok) {
  console.error(`SEND FAILED (${res.status}): ${body.slice(0, 500)}`);
  process.exit(1);
}
console.log(`SENT: report #${body} is in the CEO's inbox. The dashboard applies it on its next sync.`);
