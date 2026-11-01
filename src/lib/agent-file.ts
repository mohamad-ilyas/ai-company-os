import { COMPANY_RULES } from "../data/company-rules";
import type { Employee } from "./types";

// Builds the Claude Code subagent file (.claude/agents/<slug>.md) for an employee.
// Used by scripts/sync-workforce.ts (repository) and by the profile page (download).
// Relative imports only: this module also runs under plain Node.

const ENGINEERING_TOOLS = "Read, Grep, Glob, Edit, Write, Bash";
const DOCUMENT_TOOLS = "Read, Grep, Glob, Edit, Write";

function toolsFor(e: Employee): string {
  if (e.departmentId === "engineering" || e.id === "EMP-012") return ENGINEERING_TOOLS;
  // The independent reviewer re-runs builds and tests to verify claims, but never edits the work.
  if (e.id === "EMP-013") return "Read, Grep, Glob, Bash, Write";
  return DOCUMENT_TOOLS;
}

const list = (items: string[]) => items.map((i) => `- ${i}`).join("\n");

export function agentFile(e: Employee): string {
  const description = `${e.name.en}, ${e.title.en} (AI employee ${e.id}). Use for: ${e.accepts.join("; ")}.`.replace(/\n/g, " ");
  return `---
name: ${e.slug}
description: ${JSON.stringify(description)}
tools: ${toolsFor(e)}
---

${e.systemInstructions}

## Your profile
- Employee ID: ${e.id}
- Department: ${e.departmentId}
- Reports to: ${e.reportsTo === "ceo" ? "CEO" : e.reportsTo}

### Responsibilities
${list(e.responsibilities)}

### You accept
${list(e.accepts)}

### You must reject or escalate
${list(e.rejectsOrEscalates)}

### Restricted actions (never perform)
${list(e.restrictedActions)}

### Quality checklist (verify before you report)
${list(e.qualityChecklist)}

### Output format
${e.outputFormat}

## ${COMPANY_RULES}
`;
}
