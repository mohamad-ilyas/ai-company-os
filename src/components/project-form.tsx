"use client";

import { useState } from "react";
import { useCompany, useI18n, useRun } from "@/lib/store";
import { Button, Checkbox, Field, Input, Select, Textarea } from "./ui/primitives";
import { Dialog } from "./ui/dialog";
import { linesToList } from "./common";
import { createProject, updateProject, type ProjectInput } from "@/lib/domain";
import { PRIORITIES, type EmployeeId, type Priority, type Project } from "@/lib/types";

function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function ProjectFormDialog({ open, onClose, project, onSaved }: { open: boolean; onClose: () => void; project?: Project; onSaved?: (id: string) => void }) {
  const s = useCompany();
  const { t, l } = useI18n();
  const run = useRun();
  const today = new Date().toISOString().slice(0, 10);
  const [f, setF] = useState(() => ({
    name: project?.name ?? "",
    client: project?.client ?? "",
    description: project?.description ?? "",
    businessRequirements: project?.businessRequirements ?? "",
    technicalRequirements: project?.technicalRequirements ?? "",
    scope: project?.scope ?? "",
    budget: project?.budget == null ? "" : String(project.budget),
    priority: project?.priority ?? s.settings.projectDefaults.priority,
    startDate: project?.startDate ?? today,
    targetDate: project?.targetDate ?? addDays(today, s.settings.projectDefaults.durationDays),
    managerId: project?.managerId ?? ("EMP-003" as EmployeeId),
    memberIds: project?.memberIds ?? ([] as EmployeeId[]),
    dependencies: (project?.dependencies ?? []).join("\n"),
  }));
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  const submit = () => {
    const input: ProjectInput = {
      name: f.name,
      client: f.client,
      description: f.description.trim(),
      businessRequirements: f.businessRequirements.trim(),
      technicalRequirements: f.technicalRequirements.trim(),
      scope: f.scope.trim(),
      budget: f.budget.trim() === "" ? null : Number(f.budget),
      priority: f.priority,
      startDate: f.startDate,
      targetDate: f.targetDate,
      managerId: f.managerId,
      memberIds: f.memberIds,
      dependencies: linesToList(f.dependencies),
    };
    if (project) {
      const r = run((st, ctx) => updateProject(st, ctx, project.id, input), t("common.saved"));
      if (r.ok) onClose();
    } else {
      const r = run<string>((st, ctx) => createProject(st, ctx, input), t("common.saved"));
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
      title={project ? t("projects.edit") : t("projects.new")}
      size="lg"
      footer={
        <>
          <Button onClick={onClose}>{t("common.cancel")}</Button>
          <Button variant="primary" onClick={submit} data-testid="save-project">
            {project ? t("common.save") : t("common.create")}
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
        <Field label={t("projects.name")} required>{(id) => <Input id={id} value={f.name} onChange={(e) => set("name", e.target.value)} required maxLength={300} data-testid="project-name" />}</Field>
        <Field label={t("common.client")} required>{(id) => <Input id={id} value={f.client} onChange={(e) => set("client", e.target.value)} required data-testid="project-client" />}</Field>
        <Field label={t("common.description")} className="sm:col-span-2">{(id) => <Textarea id={id} value={f.description} onChange={(e) => set("description", e.target.value)} />}</Field>
        <Field label={t("projects.businessRequirements")}>{(id) => <Textarea id={id} value={f.businessRequirements} onChange={(e) => set("businessRequirements", e.target.value)} />}</Field>
        <Field label={t("projects.technicalRequirements")}>{(id) => <Textarea id={id} value={f.technicalRequirements} onChange={(e) => set("technicalRequirements", e.target.value)} />}</Field>
        <Field label={t("projects.scope")} className="sm:col-span-2">{(id) => <Textarea id={id} value={f.scope} onChange={(e) => set("scope", e.target.value)} className="min-h-[64px]" />}</Field>
        <Field label={t("common.priority")}>
          {(id) => (
            <Select id={id} value={f.priority} onChange={(e) => set("priority", e.target.value as Priority)}>
              {PRIORITIES.map((p) => <option key={p} value={p}>{t(`priority.${p}`)}</option>)}
            </Select>
          )}
        </Field>
        <Field label={t("projects.budget")} hint={t("projects.budgetHint")}>
          {(id, hint) => <Input id={id} aria-describedby={hint} type="number" min={0} step="any" inputMode="decimal" value={f.budget} onChange={(e) => set("budget", e.target.value)} />}
        </Field>
        <Field label={t("common.startDate")}>{(id) => <Input id={id} type="date" value={f.startDate} onChange={(e) => set("startDate", e.target.value)} />}</Field>
        <Field label={t("common.targetDate")}>{(id) => <Input id={id} type="date" value={f.targetDate} onChange={(e) => set("targetDate", e.target.value)} />}</Field>
        <Field label={t("common.manager")}>
          {(id) => (
            <Select id={id} value={f.managerId} onChange={(e) => set("managerId", e.target.value as EmployeeId)}>
              {s.employees.map((e) => <option key={e.id} value={e.id}>{l(e.name)} — {l(e.title)}</option>)}
            </Select>
          )}
        </Field>
        <Field label={t("common.dependencies")} hint={t("projects.dependenciesHint")}>
          {(id, hint) => <Textarea id={id} aria-describedby={hint} value={f.dependencies} onChange={(e) => set("dependencies", e.target.value)} className="min-h-[64px]" />}
        </Field>
        <fieldset className="sm:col-span-2">
          <legend className="mb-2 text-[13px] font-medium text-fg">{t("projects.team")}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {s.employees.map((e) => (
              <Checkbox
                key={e.id}
                label={<>{l(e.name)} <span className="text-muted">· {l(e.title)}</span></>}
                checked={f.memberIds.includes(e.id)}
                onChange={(v) => set("memberIds", v ? [...f.memberIds, e.id] : f.memberIds.filter((m) => m !== e.id))}
              />
            ))}
          </div>
        </fieldset>
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
