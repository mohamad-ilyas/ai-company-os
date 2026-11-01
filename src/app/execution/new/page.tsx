"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import { ArrowLeft, Laptop, MessageSquare } from "lucide-react";
import { useCompany, useI18n, useRun } from "@/lib/store";
import { Button, Card, CardBody, CardHeader, Field, Input, Notice, PageHeader, Select, Textarea } from "@/components/ui/primitives";
import { ActorChip, LinksEditor, cleanLinks, useQueryParam } from "@/components/common";
import { can, createExecution } from "@/lib/domain";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/cn";
import { useDocumentTitle } from "@/components/shell/use-title";
import type { EmployeeId, ExecutionChannel, LinkRef } from "@/lib/types";

function NewAssignment() {
  const s = useCompany();
  const { t, l } = useI18n();
  const run = useRun();
  const router = useRouter();
  useDocumentTitle(t("execution.new"));
  const qTask = useQueryParam("task");
  const qEmp = useQueryParam("employee");
  const qProject = useQueryParam("project");
  const presetTask = s.tasks.find((x) => x.id === qTask);

  const [employeeId, setEmployeeId] = useState<EmployeeId | "">((qEmp as EmployeeId) ?? presetTask?.assigneeId ?? "");
  const [projectId, setProjectId] = useState(presetTask?.projectId ?? qProject ?? "");
  const [taskId, setTaskId] = useState(presetTask?.id ?? "");
  const [title, setTitle] = useState(presetTask?.title ?? "");
  const [instructions, setInstructions] = useState(
    presetTask ? [presetTask.description, presetTask.expectedOutput && `Expected output: ${presetTask.expectedOutput}`].filter(Boolean).join("\n\n") : "",
  );
  const [attachments, setAttachments] = useState<LinkRef[]>(presetTask?.attachments ?? []);
  const [channel, setChannel] = useState<ExecutionChannel>(() => {
    const emp = s.employees.find((e) => e.id === ((qEmp as EmployeeId) ?? presetTask?.assigneeId));
    return emp && (emp.departmentId === "engineering" || emp.departmentId === "qa") ? "claude_code" : "claude_chat";
  });

  const emp = s.employees.find((e) => e.id === employeeId);
  const tasks = s.tasks.filter((x) => (!projectId || x.projectId === projectId) && x.status !== "completed" && x.status !== "cancelled");

  if (!can(s.settings.role, "write")) return <Notice tone="warning">{t("common.readOnly")}</Notice>;

  const submit = () => {
    if (!employeeId) return;
    const r = run<string>((st, ctx) =>
      createExecution(st, ctx, {
        employeeId,
        taskId: taskId || null,
        projectId: projectId || null,
        title,
        instructions,
        attachments: cleanLinks(attachments),
        channel,
      }),
    );
    if (r.ok && r.value) router.push(routes.executionView(r.value));
  };

  return (
    <>
      <Link href={routes.execution} className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-fg-2 hover:text-fg">
        <ArrowLeft className="flip-rtl size-4" aria-hidden />
        {t("nav.execution")}
      </Link>
      <PageHeader title={t("execution.new")} subtitle={t("execution.subtitle")} />
      <form
        className="grid gap-6 lg:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Card className="lg:col-span-2">
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Field label={t("execution.employee")} required className="sm:col-span-2">
              {(id) => (
                <Select id={id} value={employeeId} onChange={(e) => setEmployeeId(e.target.value as EmployeeId)} required data-testid="exec-employee">
                  <option value="">{t("execution.selectEmployee")}</option>
                  {s.departments.map((d) => (
                    <optgroup key={d.id} label={l(d.name)}>
                      {s.employees.filter((e) => e.departmentId === d.id).map((e) => (
                        <option key={e.id} value={e.id} disabled={e.availability === "unavailable"}>
                          {l(e.name)} — {l(e.title)}{e.availability === "unavailable" ? ` (${t("availability.unavailable")})` : ""}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </Select>
              )}
            </Field>
            <Field label={t("execution.linkProject")}>
              {(id) => (
                <Select id={id} value={projectId} onChange={(e) => { setProjectId(e.target.value); setTaskId(""); }} data-testid="exec-project">
                  <option value="">{t("execution.noProject")}</option>
                  {s.projects.map((p) => <option key={p.id} value={p.id}>{p.id} · {p.name}</option>)}
                </Select>
              )}
            </Field>
            <Field label={t("execution.linkTask")}>
              {(id) => (
                <Select
                  id={id}
                  value={taskId}
                  onChange={(e) => {
                    setTaskId(e.target.value);
                    const tk = s.tasks.find((x) => x.id === e.target.value);
                    if (tk) {
                      setProjectId(tk.projectId);
                      if (!title) setTitle(tk.title);
                    }
                  }}
                  data-testid="exec-task"
                >
                  <option value="">{t("execution.noTask")}</option>
                  {tasks.map((x) => <option key={x.id} value={x.id}>{x.id} · {x.title}</option>)}
                </Select>
              )}
            </Field>
            <Field label={t("common.title")} required className="sm:col-span-2">
              {(id) => <Input id={id} value={title} onChange={(e) => setTitle(e.target.value)} required data-testid="exec-title" />}
            </Field>
            <Field label={t("execution.instructions")} hint={t("execution.instructionsHint")} required className="sm:col-span-2">
              {(id, hint) => <Textarea id={id} aria-describedby={hint} value={instructions} onChange={(e) => setInstructions(e.target.value)} className="min-h-[160px]" required data-testid="exec-instructions" />}
            </Field>
            <div className="sm:col-span-2">
              <p className="text-[13px] font-medium text-fg">{t("execution.attachments")}</p>
              <p className="mb-2 text-xs text-muted">{t("execution.attachmentsHint")}</p>
              <LinksEditor value={attachments} onChange={setAttachments} />
            </div>
            <fieldset className="sm:col-span-2">
              <legend className="mb-2 text-[13px] font-medium text-fg">{t("execution.channel")}</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {([
                  { id: "claude_code" as const, icon: Laptop, hint: t("execution.channelCodeHint") },
                  { id: "claude_chat" as const, icon: MessageSquare, hint: t("execution.channelChatHint") },
                ]).map((c) => (
                  <label
                    key={c.id}
                    className={cn(
                      "flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors",
                      channel === c.id ? "border-accent bg-accent-soft" : "border-border hover:border-border-strong",
                    )}
                  >
                    <input type="radio" name="channel" value={c.id} checked={channel === c.id} onChange={() => setChannel(c.id)} className="mt-1 accent-[var(--accent)]" data-testid={`channel-${c.id}`} />
                    <span>
                      <span className="flex items-center gap-1.5 text-sm font-medium text-fg"><c.icon className="size-4" />{t(`channel.${c.id}`)}</span>
                      <span className="mt-0.5 block text-xs text-fg-2">{c.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          </CardBody>
          <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
            <Button type="submit" variant="primary" disabled={!employeeId} data-testid="create-assignment">{t("execution.submit")}</Button>
          </div>
        </Card>

        <Card className="h-fit">
          <CardHeader title={t("execution.previewInstructions")} />
          <CardBody>
            {emp ? (
              <div className="space-y-3">
                <ActorChip actor={emp.id} size={34} sub={l(emp.title)} />
                <pre dir="ltr" className="max-h-[420px] overflow-y-auto whitespace-pre-wrap rounded-lg bg-surface-2 p-3 font-mono text-[11.5px] leading-relaxed text-fg-2">{emp.systemInstructions}</pre>
              </div>
            ) : (
              <p className="text-sm text-muted">{t("execution.selectEmployee")}</p>
            )}
          </CardBody>
        </Card>
      </form>
    </>
  );
}

export default function Page() {
  return (
    <Suspense>
      <NewAssignment />
    </Suspense>
  );
}
