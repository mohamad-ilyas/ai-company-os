"use client";

import { useState } from "react";
import { useCompany, useI18n, useRun } from "@/lib/store";
import { Button, Field, Input, Select, Textarea } from "./ui/primitives";
import { Dialog } from "./ui/dialog";
import { LinksEditor, cleanLinks, linesToList } from "./common";
import { createTask, updateTask, type TaskInput } from "@/lib/domain";
import { PRIORITIES, PROTECTED_ACTIONS, type EmployeeId, type LinkRef, type Priority, type ProtectedAction, type Task } from "@/lib/types";

export function TaskFormDialog({
  open,
  onClose,
  task,
  defaultProjectId,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  task?: Task;
  defaultProjectId?: string;
  onSaved?: (id: string) => void;
}) {
  const s = useCompany();
  const { t, l } = useI18n();
  const run = useRun();
  const [f, setF] = useState(() => ({
    title: task?.title ?? "",
    description: task?.description ?? "",
    projectId: task?.projectId ?? defaultProjectId ?? s.projects[0]?.id ?? "",
    assigneeId: (task?.assigneeId ?? "") as EmployeeId | "",
    priority: task?.priority ?? s.settings.projectDefaults.priority,
    dueDate: task?.dueDate ?? "",
    dependencies: task?.dependencies ?? ([] as string[]),
    acceptanceCriteria: (task?.acceptanceCriteria ?? []).join("\n"),
    requiredInputs: task?.requiredInputs ?? "",
    expectedOutput: task?.expectedOutput ?? "",
    attachments: task?.attachments ?? ([] as LinkRef[]),
    protectedAction: (task?.protectedAction ?? "") as ProtectedAction | "",
  }));
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const candidates = s.tasks.filter((x) => x.projectId === f.projectId && x.id !== task?.id);

  const submit = () => {
    const input: TaskInput = {
      title: f.title,
      description: f.description.trim(),
      projectId: f.projectId,
      assigneeId: f.assigneeId || null,
      priority: f.priority,
      dueDate: f.dueDate || null,
      dependencies: f.dependencies.filter((d) => candidates.some((c) => c.id === d)),
      acceptanceCriteria: linesToList(f.acceptanceCriteria),
      requiredInputs: f.requiredInputs.trim(),
      expectedOutput: f.expectedOutput.trim(),
      attachments: cleanLinks(f.attachments),
      protectedAction: f.protectedAction || null,
    };
    if (task) {
      const { projectId: _p, ...patch } = input;
      void _p;
      const r = run((st, ctx) => updateTask(st, ctx, task.id, patch), t("common.saved"));
      if (r.ok) onClose();
    } else {
      const r = run<string>((st, ctx) => createTask(st, ctx, input), t("common.saved"));
      if (r.ok && r.value) {
        onClose();
        onSaved?.(r.value);
      }
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={task ? `${t("tasks.edit")} · ${task.id}` : t("tasks.new")}
      size="lg"
      footer={
        <>
          <Button onClick={onClose}>{t("common.cancel")}</Button>
          <Button variant="primary" onClick={submit} data-testid="save-task">
            {task ? t("common.save") : t("common.create")}
          </Button>
        </>
      }
    >
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Field label={t("common.title")} required className="sm:col-span-2">
          {(id) => <Input id={id} value={f.title} onChange={(e) => set("title", e.target.value)} required maxLength={500} data-testid="task-title" />}
        </Field>
        <Field label={t("common.description")} className="sm:col-span-2">
          {(id) => <Textarea id={id} value={f.description} onChange={(e) => set("description", e.target.value)} />}
        </Field>
        <Field label={t("common.project")} required>
          {(id) => (
            <Select id={id} value={f.projectId} disabled={!!task} onChange={(e) => setF((x) => ({ ...x, projectId: e.target.value, dependencies: [] }))} data-testid="task-project">
              {s.projects.map((p) => <option key={p.id} value={p.id}>{p.id} · {p.name}</option>)}
            </Select>
          )}
        </Field>
        <Field label={t("common.assignee")}>
          {(id) => (
            <Select id={id} value={f.assigneeId} onChange={(e) => set("assigneeId", e.target.value as EmployeeId | "")} data-testid="task-assignee">
              <option value="">{t("common.unassigned")}</option>
              {s.employees.map((e) => <option key={e.id} value={e.id}>{l(e.name)} — {l(e.title)}</option>)}
            </Select>
          )}
        </Field>
        <Field label={t("common.priority")}>
          {(id) => (
            <Select id={id} value={f.priority} onChange={(e) => set("priority", e.target.value as Priority)}>
              {PRIORITIES.map((p) => <option key={p} value={p}>{t(`priority.${p}`)}</option>)}
            </Select>
          )}
        </Field>
        <Field label={t("common.dueDate")}>{(id) => <Input id={id} type="date" value={f.dueDate} onChange={(e) => set("dueDate", e.target.value)} />}</Field>
        <Field label={t("tasks.acceptanceCriteria")} hint={t("tasks.acceptanceHint")} className="sm:col-span-2">
          {(id, hint) => <Textarea id={id} aria-describedby={hint} value={f.acceptanceCriteria} onChange={(e) => set("acceptanceCriteria", e.target.value)} />}
        </Field>
        <Field label={t("tasks.requiredInputs")}>{(id) => <Textarea id={id} value={f.requiredInputs} onChange={(e) => set("requiredInputs", e.target.value)} className="min-h-[64px]" />}</Field>
        <Field label={t("tasks.expectedOutput")}>{(id) => <Textarea id={id} value={f.expectedOutput} onChange={(e) => set("expectedOutput", e.target.value)} className="min-h-[64px]" />}</Field>
        <Field label={t("tasks.protectedAction")}>
          {(id) => (
            <Select id={id} value={f.protectedAction} onChange={(e) => set("protectedAction", e.target.value as ProtectedAction | "")} data-testid="task-protected">
              <option value="">{t("tasks.protectedNone")}</option>
              {PROTECTED_ACTIONS.map((a) => <option key={a} value={a}>{t(`protectedAction.${a}`)}</option>)}
            </Select>
          )}
        </Field>
        <Field label={t("common.dependencies")} hint={t("tasks.dependsOnHint")}>
          {(id, hint) => (
            <Select
              id={id}
              aria-describedby={hint}
              multiple
              value={f.dependencies}
              onChange={(e) => set("dependencies", Array.from(e.target.selectedOptions).map((o) => o.value))}
              className="h-28 py-1"
            >
              {candidates.map((c) => <option key={c.id} value={c.id}>{c.id} · {c.title}</option>)}
            </Select>
          )}
        </Field>
        <div className="sm:col-span-2">
          <p className="mb-1.5 text-[13px] font-medium text-fg">{t("tasks.attachments")}</p>
          <LinksEditor value={f.attachments} onChange={(v) => set("attachments", v)} />
        </div>
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
