import { COMPANY_RULES } from "../../data/company-rules";
import type { CompanyState, Execution } from "../types";
import { RESULT_SCHEMA_ID } from "./result-schema";

export const PACKET_SCHEMA_ID = "aicos.assignment/v1";

/** Everything a Claude session needs to perform one assignment as one employee. */
export interface AssignmentPacket {
  schema: typeof PACKET_SCHEMA_ID;
  executionId: string;
  createdAt: string;
  channel: Execution["channel"];
  employee: {
    id: string;
    slug: string;
    name: string;
    title: string;
    systemInstructions: string;
    outputFormat: string;
    qualityChecklist: string[];
    restrictedActions: string[];
    rejectsOrEscalates: string[];
  };
  assignment: {
    title: string;
    instructions: string;
    attachments: { label: string; url: string }[];
  };
  project: null | {
    id: string;
    name: string;
    client: string;
    status: string;
    description: string;
    businessRequirements: string;
    technicalRequirements: string;
    scope: string;
  };
  task: null | {
    id: string;
    title: string;
    description: string;
    acceptanceCriteria: string[];
    requiredInputs: string;
    expectedOutput: string;
    protectedAction: string | null;
  };
  /** Approved outputs of dependency tasks and the parent execution — the explicit handoff context. */
  upstream: { executionId: string; employee: string; title: string; summary: string; output: string }[];
  companyRules: string;
  resultContract: {
    schema: typeof RESULT_SCHEMA_ID;
    instructions: string;
  };
}

const MAX_UPSTREAM_OUTPUT = 12_000;

export function buildPacket(state: CompanyState, exe: Execution): AssignmentPacket {
  const emp = state.employees.find((e) => e.id === exe.employeeId)!;
  const project = exe.projectId ? state.projects.find((p) => p.id === exe.projectId) ?? null : null;
  const task = exe.taskId ? state.tasks.find((t) => t.id === exe.taskId) ?? null : null;

  const upstreamIds = new Set<string>();
  if (exe.parentId) upstreamIds.add(exe.parentId);
  if (task) {
    for (const depId of task.dependencies) {
      state.executions
        .filter((e) => e.taskId === depId && e.reviewStatus === "approved")
        .forEach((e) => upstreamIds.add(e.id));
    }
  }
  const upstream = [...upstreamIds]
    .map((id) => state.executions.find((e) => e.id === id))
    .filter((e): e is Execution => !!e && !!e.output)
    .map((e) => {
      const author = state.employees.find((x) => x.id === e.employeeId);
      return {
        executionId: e.id,
        employee: author ? `${author.name.en} (${author.title.en})` : e.employeeId,
        title: e.title,
        summary: e.summary,
        output: e.output.length > MAX_UPSTREAM_OUTPUT ? e.output.slice(0, MAX_UPSTREAM_OUTPUT) + "\n…[truncated]" : e.output,
      };
    });

  return {
    schema: PACKET_SCHEMA_ID,
    executionId: exe.id,
    createdAt: exe.createdAt,
    channel: exe.channel,
    employee: {
      id: emp.id,
      slug: emp.slug,
      name: emp.name.en,
      title: emp.title.en,
      systemInstructions: emp.systemInstructions,
      outputFormat: emp.outputFormat,
      qualityChecklist: emp.qualityChecklist,
      restrictedActions: emp.restrictedActions,
      rejectsOrEscalates: emp.rejectsOrEscalates,
    },
    assignment: { title: exe.title, instructions: exe.instructions, attachments: exe.attachments },
    project: project && {
      id: project.id,
      name: project.name,
      client: project.client,
      status: project.status,
      description: project.description,
      businessRequirements: project.businessRequirements,
      technicalRequirements: project.technicalRequirements,
      scope: project.scope,
    },
    task: task && {
      id: task.id,
      title: task.title,
      description: task.description,
      acceptanceCriteria: task.acceptanceCriteria,
      requiredInputs: task.requiredInputs,
      expectedOutput: task.expectedOutput,
      protectedAction: task.protectedAction,
    },
    upstream,
    companyRules: COMPANY_RULES,
    resultContract: {
      schema: RESULT_SCHEMA_ID,
      instructions: RESULT_INSTRUCTIONS(exe.id, emp.id),
    },
  };
}

const RESULT_INSTRUCTIONS = (exeId: string, empId: string) =>
  `When finished, produce a JSON object with: "schema": "${RESULT_SCHEMA_ID}", "executionId": "${exeId}", "employeeId": "${empId}", "channel", "status" ("completed" | "needs_input" | "failed"), "startedAt" and "endedAt" (ISO-8601, real times), "summary" (2-4 sentences), "output" (the full deliverable in Markdown), "logs" ([{ "at", "message" }] — what you actually did), "errors" ([]), "openQuestions" ([]), "deliverables" ([{ "title", "type", "location", "description" }] — only files that actually exist), "handoff" (null or { "to": "EMP-xxx", "note" }). Use status "needs_input" with openQuestions if essential inputs are missing. Never report work you did not do.`;

/** A single self-contained prompt for Claude chat (claude.ai), where there is no repository context. */
export function buildChatPrompt(packet: AssignmentPacket): string {
  const lines: string[] = [];
  lines.push(`# Role\n\n${packet.employee.systemInstructions}`);
  lines.push(`\n# ${packet.companyRules}`);
  if (packet.project) {
    const p = packet.project;
    lines.push(`\n# Project ${p.id}: ${p.name}\nClient: ${p.client}\nStatus: ${p.status}\n\n${p.description}`);
    if (p.businessRequirements) lines.push(`\n## Business requirements\n${p.businessRequirements}`);
    if (p.technicalRequirements) lines.push(`\n## Technical requirements\n${p.technicalRequirements}`);
    if (p.scope) lines.push(`\n## Scope\n${p.scope}`);
  }
  if (packet.task) {
    const t = packet.task;
    lines.push(`\n# Task ${t.id}: ${t.title}\n${t.description}`);
    if (t.acceptanceCriteria.length) lines.push(`\n## Acceptance criteria\n${t.acceptanceCriteria.map((c) => `- ${c}`).join("\n")}`);
    if (t.requiredInputs) lines.push(`\n## Required inputs\n${t.requiredInputs}`);
    if (t.expectedOutput) lines.push(`\n## Expected output\n${t.expectedOutput}`);
    if (t.protectedAction) lines.push(`\nThis task involves a protected action (${t.protectedAction}). Prepare it only; the CEO decides.`);
  }
  for (const u of packet.upstream) {
    lines.push(`\n# Input from ${u.employee} — ${u.title} (${u.executionId})\n${u.summary}\n\n${u.output}`);
  }
  lines.push(`\n# Assignment ${packet.executionId}: ${packet.assignment.title}\n${packet.assignment.instructions}`);
  if (packet.assignment.attachments.length) {
    lines.push(`\nReferences:\n${packet.assignment.attachments.map((a) => `- ${a.label}: ${a.url}`).join("\n")}`);
  }
  lines.push(`\n# Output format\n${packet.employee.outputFormat}`);
  lines.push(`\n# Quality checklist (verify before answering)\n${packet.employee.qualityChecklist.map((c) => `- ${c}`).join("\n")}`);
  lines.push(`\n# How to answer\nFirst, list any essential missing inputs. If the work is impossible without them, ask and stop. Otherwise do the work.\n\nEnd your reply with a single fenced \`\`\`json block. ${packet.resultContract.instructions} Put the full deliverable in "output". Use "channel": "claude_chat". If you do not know the exact times, set startedAt and endedAt to null.`);
  return lines.join("\n");
}

/** The terminal command the CEO runs inside the repository to execute an assignment with Claude Code. */
export function claudeCodeCommand(executionId: string): string {
  return `claude "/run-assignment ~/Downloads/${executionId}.assignment.json"`;
}

/** For Claude Code on the web (e.g. from a phone): the command plus the packet, pasted as one message. */
export function claudeCodeWebPrompt(packet: AssignmentPacket): string {
  return `/run-assignment\n\n\`\`\`json\n${JSON.stringify(packet, null, 2)}\n\`\`\``;
}
