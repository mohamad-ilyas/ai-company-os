import { z } from "zod";
import { DELIVERABLE_TYPES } from "../types";

/**
 * The contract between a Claude session (Claude Code or Claude chat) and the dashboard.
 * Claude writes a file matching this schema; the dashboard validates it before recording anything.
 * Keep in sync with docs/execution-result.schema.json and .claude/commands/run-assignment.md.
 */
export const RESULT_SCHEMA_ID = "aicos.result/v1";

const isoDate = z
  .string()
  .refine((s) => !Number.isNaN(Date.parse(s)), { message: "Must be an ISO-8601 date-time" });

export const executionResultSchema = z.object({
  schema: z.literal(RESULT_SCHEMA_ID),
  executionId: z.string().regex(/^EXE-\d{4,}$/, "executionId must look like EXE-0001"),
  employeeId: z.string().regex(/^EMP-\d{3}$/, "employeeId must look like EMP-001"),
  channel: z.enum(["claude_code", "claude_chat"]).default("claude_code"),
  status: z.enum(["completed", "needs_input", "failed"]),
  startedAt: isoDate.nullable().default(null),
  endedAt: isoDate.nullable().default(null),
  summary: z.string().max(2000).default(""),
  output: z.string().max(200_000).default(""),
  logs: z
    .array(z.object({ at: isoDate.nullable().default(null), message: z.string().min(1).max(2000) }))
    .max(500)
    .default([]),
  errors: z.array(z.string().max(2000)).max(100).default([]),
  openQuestions: z.array(z.string().max(2000)).max(100).default([]),
  deliverables: z
    .array(
      z.object({
        title: z.string().min(1).max(200),
        type: z.enum(DELIVERABLE_TYPES),
        location: z.string().min(1).max(500),
        description: z.string().max(2000).optional(),
      }),
    )
    .max(50)
    .default([]),
  handoff: z
    .object({ to: z.string().regex(/^EMP-\d{3}$/), note: z.string().max(2000) })
    .nullable()
    .default(null),
});

export type ExecutionResultInput = z.input<typeof executionResultSchema>;
export type ExecutionResult = Omit<z.output<typeof executionResultSchema>, "employeeId" | "handoff"> & {
  employeeId: `EMP-${string}`;
  handoff: { to: `EMP-${string}`; note: string } | null;
};

export type ParseOutcome = { ok: true; result: ExecutionResult } | { ok: false; issues: string[] };

/** Accepts raw text (pasted or read from a file). Tolerates a ```json fenced block around the JSON. */
export function parseExecutionResult(raw: string): ParseOutcome {
  const text = raw.trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  let data: unknown;
  try {
    data = JSON.parse(candidate);
  } catch {
    return { ok: false, issues: ["not_json"] };
  }
  const parsed = executionResultSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, issues: parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`) };
  }
  return { ok: true, result: parsed.data as ExecutionResult };
}
