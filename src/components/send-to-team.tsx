"use client";

// "Send to the team": hands a dashboard task or project to the AI team in the CEO's own Claude session
// (Claude Code on the web, agency-projects). The dashboard can't start a session by itself — that would
// need a paid API — so this opens Claude with the full request ready; the CEO presses send, and the
// team's progress comes back here live through the AI team channel, on this same task or project.

import { useState } from "react";
import { Send } from "lucide-react";
import { useCompany, useI18n, useRun } from "@/lib/store";
import { addTaskComment, postMessage } from "@/lib/domain";
import type { Project, Task } from "@/lib/types";
import { Button, Notice } from "./ui/primitives";
import { claudeCodeUrl, openTab } from "./ask-coo";

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);

export function taskPrompt(task: Task, project: Project | undefined, assigneeSlug: string | undefined): string {
  const lines = [
    `/task ${assigneeSlug ?? "the right employee"}: Dashboard task ${task.id} “${task.title}”.`,
    task.description && `Details: ${clip(task.description, 1200)}`,
    task.acceptanceCriteria.length > 0 && `Acceptance criteria: ${task.acceptanceCriteria.map((c) => `- ${c}`).join(" ")}`,
    task.expectedOutput && `Expected output: ${clip(task.expectedOutput, 400)}`,
    project && `Project: ${project.name} (${project.extKey ? `key ${project.extKey}` : project.id}).`,
    `In every report use taskKey "${task.id.toLowerCase()}"${project ? ` and projectKey "${project.extKey ?? project.id.toLowerCase()}"` : ""} — this task already exists in the dashboard; update it, don't create a new one. Report when you start, at each step, and when done.`,
  ];
  return lines.filter(Boolean).join("\n");
}

export function projectPrompt(project: Project, openTasks: Task[]): string {
  if (project.extKey) return `/continue-project ${project.extKey} The CEO asks the team to continue now. Report progress at each step.`;
  const key = project.id.toLowerCase();
  const lines = [
    `/new-project Dashboard project ${project.id} “${project.name}” for ${project.client || "an internal client"}.`,
    project.description && `Brief: ${clip(project.description, 1200)}`,
    project.businessRequirements && `Business requirements: ${clip(project.businessRequirements, 800)}`,
    project.technicalRequirements && `Technical requirements: ${clip(project.technicalRequirements, 600)}`,
    openTasks.length > 0 && `Tasks already in the dashboard (use these keys): ${openTasks.slice(0, 15).map((t) => `${t.id.toLowerCase()} “${clip(t.title, 60)}”`).join("; ")}.`,
    `Use the project key "${key}" (folder projects/${key}/, branch project/${key}) — the project already exists in the dashboard; update it, don't create a new one. Report when each stage starts and ends.`,
  ];
  return lines.filter(Boolean).join("\n");
}

export function SendToTeam({ kind, task, project }: { kind: "task" | "project"; task?: Task; project?: Project }) {
  const s = useCompany();
  const { t } = useI18n();
  const run = useRun();
  const [fallback, setFallback] = useState<string | null>(null);
  if (s.settings.role !== "ceo") return null;

  const send = () => {
    const prompt =
      kind === "task" && task
        ? taskPrompt(task, s.projects.find((p) => p.id === task.projectId), s.employees.find((e) => e.id === task.assigneeId)?.slug)
        : projectPrompt(project!, s.tasks.filter((x) => x.projectId === project!.id && x.status !== "completed" && x.status !== "cancelled"));
    const url = claudeCodeUrl(prompt);
    const opened = openTab(url); // first, inside the click, so the browser allows it
    // On the record (and on every device, live): the CEO handed this to the team.
    if (kind === "task" && task) run((st, ctx) => addTaskComment(st, ctx, task.id, t("team.sentNote")));
    else if (project) run((st, ctx) => postMessage(st, ctx, { kind: "project", refId: project.id, body: t("team.sentNote") }));
    setFallback(opened ? null : url);
  };

  return (
    <>
      <Button variant="primary" onClick={send} title={t("team.sendHint")} data-testid="send-to-team">
        <Send className="flip-rtl size-4" />
        {t("team.send")}
      </Button>
      {fallback && (
        <Notice tone="warning" className="basis-full">
          {t("communication.askPopupBlocked")}{" "}
          <a href={fallback} target="_blank" rel="noopener noreferrer" className="font-medium text-accent-text underline">claude.ai/code</a>
        </Notice>
      )}
    </>
  );
}
