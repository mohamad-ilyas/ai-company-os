"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AlertTriangle, Columns3, List, Plus, Search, ShieldCheck } from "lucide-react";
import { useCompany, useI18n } from "@/lib/store";
import { Button, Card, EmptyState, Input, PageHeader, Select, tableClass } from "@/components/ui/primitives";
import { ActorChip, Avatar, PriorityBadge, SampleBadge, TaskStatusBadge } from "@/components/common";
import { TaskFormDialog } from "@/components/task-form";
import { can } from "@/lib/domain";
import { isOverdue } from "@/lib/metrics";
import { routes } from "@/lib/routes";
import { useDocumentTitle } from "@/components/shell/use-title";
import { PRIORITIES, TASK_STATUSES, type EmployeeId, type Priority, type Task, type TaskStatus } from "@/lib/types";

function TaskCard({ task }: { task: Task }) {
  const s = useCompany();
  const { t, date } = useI18n();
  const project = s.projects.find((p) => p.id === task.projectId);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <Link href={routes.task(task.id)} className="block rounded-lg border border-border bg-surface p-3 shadow-card transition-colors hover:border-border-strong" data-testid={`task-card-${task.id}`}>
      <div className="flex items-center justify-between gap-2 text-xs text-muted">
        <span className="tabular">{task.id}</span>
        <div className="flex items-center gap-1">
          {task.protectedAction && <ShieldCheck className="size-3.5 text-warning" aria-label={t("tasks.protectedAction")} />}
          <SampleBadge show={task.sample} />
        </div>
      </div>
      <p className="mt-1 line-clamp-2 text-[13.5px] font-medium leading-snug text-fg">{task.title}</p>
      <p className="mt-1 truncate text-xs text-muted">{project?.name}</p>
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <PriorityBadge priority={task.priority} />
        <div className="flex items-center gap-2">
          {task.dueDate && (
            <span className={`flex items-center gap-1 text-xs ${isOverdue(task, today) ? "text-danger" : "text-muted"}`}>
              {isOverdue(task, today) && <AlertTriangle className="size-3" aria-label={t("tasks.overdue")} />}
              {date(task.dueDate)}
            </span>
          )}
          {task.assigneeId && <Avatar actor={task.assigneeId} size={22} />}
        </div>
      </div>
    </Link>
  );
}

export default function TasksPage() {
  const s = useCompany();
  const { t, l, date } = useI18n();
  const router = useRouter();
  useDocumentTitle(t("tasks.title"));
  const [view, setView] = useState<"board" | "list">("board");
  const [q, setQ] = useState("");
  const [project, setProject] = useState("");
  const [assignee, setAssignee] = useState<EmployeeId | "">("");
  const [priority, setPriority] = useState<Priority | "">("");
  const [status, setStatus] = useState<TaskStatus | "">("");
  const [creating, setCreating] = useState(false);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return s.tasks.filter(
      (x) =>
        (!project || x.projectId === project) &&
        (!assignee || x.assigneeId === assignee) &&
        (!priority || x.priority === priority) &&
        (!status || x.status === status) &&
        (!needle || `${x.id} ${x.title} ${x.description}`.toLowerCase().includes(needle)),
    );
  }, [s.tasks, q, project, assignee, priority, status]);

  const columns = TASK_STATUSES.filter((st) => st !== "cancelled" || rows.some((r) => r.status === "cancelled"));

  return (
    <>
      <PageHeader
        title={t("tasks.title")}
        subtitle={t("tasks.subtitle")}
        actions={
          <>
            <div className="flex rounded-md border border-border-strong p-0.5" role="group" aria-label={t("common.view")}>
              <button onClick={() => setView("board")} aria-pressed={view === "board"} className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-[13px] ${view === "board" ? "bg-surface-2 text-fg" : "text-muted"}`}>
                <Columns3 className="size-4" />{t("common.boardView")}
              </button>
              <button onClick={() => setView("list")} aria-pressed={view === "list"} className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-[13px] ${view === "list" ? "bg-surface-2 text-fg" : "text-muted"}`} data-testid="list-view">
                <List className="size-4" />{t("common.listView")}
              </button>
            </div>
            {can(s.settings.role, "write") && s.projects.length > 0 && (
              <Button variant="primary" onClick={() => setCreating(true)} data-testid="new-task">
                <Plus className="size-4" />
                {t("tasks.new")}
              </Button>
            )}
          </>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="relative lg:col-span-1">
          <Search className="pointer-events-none absolute start-3 top-2.5 size-4 text-muted" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("common.search")} aria-label={t("common.search")} className="ps-9" data-testid="task-search" />
        </div>
        <Select value={project} onChange={(e) => setProject(e.target.value)} aria-label={t("common.project")}>
          <option value="">{t("common.project")}: {t("common.all")}</option>
          {s.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
        <Select value={assignee} onChange={(e) => setAssignee(e.target.value as EmployeeId | "")} aria-label={t("common.assignee")}>
          <option value="">{t("common.assignee")}: {t("common.all")}</option>
          {s.employees.map((e) => <option key={e.id} value={e.id}>{l(e.name)}</option>)}
        </Select>
        <Select value={priority} onChange={(e) => setPriority(e.target.value as Priority | "")} aria-label={t("common.priority")}>
          <option value="">{t("common.priority")}: {t("common.all")}</option>
          {PRIORITIES.map((p) => <option key={p} value={p}>{t(`priority.${p}`)}</option>)}
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value as TaskStatus | "")} aria-label={t("common.status")}>
          <option value="">{t("common.status")}: {t("common.all")}</option>
          {TASK_STATUSES.map((x) => <option key={x} value={x}>{t(`taskStatus.${x}`)}</option>)}
        </Select>
      </div>

      {rows.length === 0 ? (
        <EmptyState title={t("tasks.noTasks")} />
      ) : view === "board" ? (
        <div className="-mx-4 overflow-x-auto px-4 pb-4 lg:-mx-8 lg:px-8">
          <div className="flex min-w-max gap-3" data-testid="task-board">
            {columns.map((col) => {
              const items = rows.filter((r) => r.status === col);
              return (
                <section key={col} className="w-64 shrink-0 rounded-xl bg-surface-2/70 p-2.5" aria-label={t(`taskStatus.${col}`)}>
                  <header className="mb-2.5 flex items-center justify-between px-1">
                    <TaskStatusBadge status={col} />
                    <span className="tabular text-xs text-muted">{items.length}</span>
                  </header>
                  <div className="space-y-2">
                    {items.map((x) => <TaskCard key={x.id} task={x} />)}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      ) : (
        <Card>
          <div className={tableClass.wrap}>
            <table className={tableClass.table}>
              <thead>
                <tr>
                  <th className={tableClass.th}>{t("common.id")}</th>
                  <th className={tableClass.th}>{t("common.title")}</th>
                  <th className={tableClass.th}>{t("common.project")}</th>
                  <th className={tableClass.th}>{t("common.assignee")}</th>
                  <th className={tableClass.th}>{t("common.priority")}</th>
                  <th className={tableClass.th}>{t("common.status")}</th>
                  <th className={tableClass.th}>{t("common.dueDate")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((x) => (
                  <tr key={x.id} className={tableClass.tr}>
                    <td className={`${tableClass.td} tabular text-muted`}>{x.id}</td>
                    <td className={tableClass.td}><Link href={routes.task(x.id)} className="hover:underline">{x.title}</Link> <SampleBadge show={x.sample} /></td>
                    <td className={`${tableClass.td} max-w-[12rem] truncate text-[13px] text-fg-2`}>{s.projects.find((p) => p.id === x.projectId)?.name}</td>
                    <td className={tableClass.td}><ActorChip actor={x.assigneeId} size={22} /></td>
                    <td className={tableClass.td}><PriorityBadge priority={x.priority} /></td>
                    <td className={tableClass.td}><TaskStatusBadge status={x.status} /></td>
                    <td className={`${tableClass.td} text-[13px] text-fg-2`}>{date(x.dueDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      {creating && <TaskFormDialog open onClose={() => setCreating(false)} defaultProjectId={project || undefined} onSaved={(id) => router.push(routes.task(id))} />}
    </>
  );
}
