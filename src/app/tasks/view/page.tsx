"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import { ArrowLeft, Lock, Pencil, PlayCircle, ShieldCheck, Trash2 } from "lucide-react";
import { useCompany, useI18n, useRun } from "@/lib/store";
import { Badge, BulletList, Button, Card, CardBody, CardHeader, EmptyState, KeyValue, Notice, Textarea } from "@/components/ui/primitives";
import { useConfirm } from "@/components/ui/dialog";
import { ActorChip, ExecutionStatusBadge, LinkButton, PriorityBadge, RefLink, ReviewBadge, SampleBadge, TaskStatusBadge, useQueryParam } from "@/components/common";
import { Markdown } from "@/components/ui/markdown";
import { TaskFormDialog } from "@/components/task-form";
import { addTaskComment, can, deleteTask, openDependencies, setTaskStatus } from "@/lib/domain";
import { TASK_TRANSITIONS } from "@/lib/workflow";
import { routes } from "@/lib/routes";
import { tDynamic } from "@/lib/i18n";
import { useDocumentTitle } from "@/components/shell/use-title";
import type { TaskStatus } from "@/lib/types";

function TaskView() {
  const s = useCompany();
  const { t, date, dateTime, actorName } = useI18n();
  const run = useRun();
  const confirm = useConfirm();
  const router = useRouter();
  const id = useQueryParam("id");
  const [editing, setEditing] = useState(false);
  const [comment, setComment] = useState("");
  const task = s.tasks.find((x) => x.id === id);
  useDocumentTitle(task ? `${task.id} ${task.title}` : t("tasks.title"));
  if (!task) return <EmptyState title={t("errors.not_found", { id: id ?? "—" })} action={<Link className="text-accent hover:underline" href={routes.tasks}>{t("nav.tasks")}</Link>} />;

  const writable = can(s.settings.role, "write");
  const project = s.projects.find((p) => p.id === task.projectId);
  const open = openDependencies(s, task);
  const next = TASK_TRANSITIONS[task.status];
  const executions = s.executions.filter((e) => e.taskId === task.id);
  const approvals = s.approvals.filter((a) => a.taskId === task.id);

  const move = async (to: TaskStatus) => {
    let note = "";
    if (to === "changes_requested" || to === "blocked" || to === "awaiting_ceo_approval") {
      const r = await confirm({
        title: t(`taskStatus.${to}`),
        confirmLabel: t("common.confirm"),
        cancelLabel: t("common.cancel"),
        note: { label: t("common.notes"), required: to === "changes_requested" },
      });
      if (!r.ok) return;
      note = r.note;
    }
    run((st, ctx) => setTaskStatus(st, ctx, task.id, to, note));
  };

  return (
    <>
      <Link href={routes.tasks} className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-fg-2 hover:text-fg">
        <ArrowLeft className="flip-rtl size-4" aria-hidden />
        {t("nav.tasks")}
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="tabular text-sm text-muted">{task.id}</span>
            <TaskStatusBadge status={task.status} />
            <PriorityBadge priority={task.priority} />
            <SampleBadge show={task.sample} />
          </div>
          <h1 className="bidi mt-1.5 text-2xl font-semibold tracking-tight text-fg" data-testid="task-heading">{task.title}</h1>
          {project && <Link href={routes.project(project.id)} className="mt-0.5 inline-block text-sm text-fg-2 hover:underline">{project.name}</Link>}
        </div>
        {writable && (
          <div className="flex flex-wrap gap-2">
            <LinkButton href={routes.executionNew({ task: task.id, employee: task.assigneeId ?? undefined })} variant="primary" testId="run-with-ai">
              <PlayCircle className="size-4" />
              {t("tasks.assignToAi")}
            </LinkButton>
            <Button onClick={() => setEditing(true)} data-testid="edit-task">
              <Pencil className="size-4" />
              {t("common.edit")}
            </Button>
            {can(s.settings.role, "delete") && (
              <Button
                variant="danger"
                aria-label={t("common.delete")}
                onClick={async () => {
                  const r = await confirm({ title: t("common.delete"), body: t("tasks.deleteConfirm", { id: task.id }), confirmLabel: t("common.delete"), cancelLabel: t("common.cancel"), danger: true });
                  if (r.ok && run((st, ctx) => deleteTask(st, ctx, task.id)).ok) router.push(routes.tasks);
                }}
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>
        )}
      </div>

      {writable && (
        <Card className="mb-6">
          <CardBody className="flex flex-wrap items-center gap-2">
            <span className="me-1 text-[13px] text-muted">{t("tasks.moveTo")}:</span>
            {next.length === 0 && task.status === "awaiting_ceo_approval" && (
              <span className="flex items-center gap-1.5 text-[13px] text-fg-2">
                <Lock className="size-3.5" /> {t("tasks.awaitingDecision")}{" "}
                <Link href={routes.approvals} className="text-accent hover:underline">{t("nav.approvals")}</Link>
              </span>
            )}
            {next
              .filter((x) => x !== "awaiting_ceo_approval" || task.protectedAction)
              .map((x) => (
                <Button key={x} size="sm" variant={x === "completed" ? "success" : x === "cancelled" ? "ghost" : "secondary"} onClick={() => move(x)} data-testid={`move-${x}`}>
                  {t(`taskStatus.${x}`)}
                </Button>
              ))}
          </CardBody>
        </Card>
      )}

      {open.length > 0 && (
        <Notice tone="warning" className="mb-6">
          {t("tasks.waitingOn")}:{" "}
          {open.map((d, i) => (
            <span key={d.id}>
              {i > 0 && ", "}
              <Link href={routes.task(d.id)} className="font-medium text-accent hover:underline">{d.id}</Link> ({t(`taskStatus.${d.status}`)})
            </span>
          ))}
        </Notice>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardBody className="space-y-5">
              <div>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{t("common.description")}</h3>
                {task.description ? <Markdown source={task.description} /> : <p className="text-sm text-muted">—</p>}
              </div>
              <div>
                <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">{t("tasks.acceptanceCriteria")}</h3>
                <BulletList items={task.acceptanceCriteria} />
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{t("tasks.requiredInputs")}</h3>
                  <p className="whitespace-pre-wrap text-sm text-fg">{task.requiredInputs || "—"}</p>
                </div>
                <div>
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{t("tasks.expectedOutput")}</h3>
                  <p className="whitespace-pre-wrap text-sm text-fg">{task.expectedOutput || "—"}</p>
                </div>
              </div>
              <div>
                <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">{t("tasks.attachments")}</h3>
                {task.attachments.length === 0 ? <p className="text-sm text-muted">—</p> : (
                  <ul className="space-y-1 text-sm">{task.attachments.map((a, i) => <li key={i}><RefLink link={a} /></li>)}</ul>
                )}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t("tasks.executions")} />
            <CardBody>
              {executions.length === 0 ? <p className="text-sm text-muted">{t("execution.noOutput")}</p> : (
                <ul className="space-y-2">
                  {executions.map((e) => (
                    <li key={e.id} className="flex flex-wrap items-center gap-2 text-sm">
                      <Link href={routes.executionView(e.id)} className="tabular font-medium text-accent hover:underline">{e.id}</Link>
                      <span className="text-fg">{e.title}</span>
                      <ExecutionStatusBadge status={e.status} />
                      <ReviewBadge status={e.reviewStatus} />
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t("tasks.comments")} />
            <CardBody className="space-y-4">
              {task.comments.length === 0 && <p className="text-sm text-muted">{t("tasks.noComments")}</p>}
              <ol className="space-y-3">
                {task.comments.map((c) => (
                  <li key={c.id}>
                    <ActorChip actor={c.authorId} size={24} sub={dateTime(c.at)} />
                    <div className="ms-8 mt-1 text-sm text-fg"><Markdown source={c.body} /></div>
                  </li>
                ))}
              </ol>
              {writable && (
                <form
                  className="space-y-2 border-t border-border pt-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (run((st, ctx) => addTaskComment(st, ctx, task.id, comment)).ok) setComment("");
                  }}
                >
                  <Textarea aria-label={t("tasks.addComment")} placeholder={t("tasks.addComment")} value={comment} onChange={(e) => setComment(e.target.value)} className="min-h-[64px]" data-testid="task-comment" />
                  <div className="flex justify-end">
                    <Button type="submit" size="sm" variant="primary" disabled={!comment.trim()} data-testid="post-comment">{t("tasks.post")}</Button>
                  </div>
                </form>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardBody>
              <KeyValue
                className="sm:grid-cols-1"
                items={[
                  { k: t("common.assignee"), v: <ActorChip actor={task.assigneeId} size={26} /> },
                  { k: t("common.dueDate"), v: date(task.dueDate) },
                  { k: t("tasks.stage"), v: task.stage ? t(`stage.${task.stage}`) : "—" },
                  {
                    k: t("tasks.protectedAction"),
                    v: task.protectedAction ? (
                      <Badge tone="warning"><ShieldCheck className="me-1 inline size-3" />{t(`protectedAction.${task.protectedAction}`)}</Badge>
                    ) : (
                      t("tasks.protectedNone")
                    ),
                  },
                  { k: t("tasks.reviewRounds"), v: String(task.reviewRounds) },
                  {
                    k: t("common.dependencies"),
                    v: task.dependencies.length ? (
                      <ul className="space-y-1">
                        {task.dependencies.map((d) => {
                          const dep = s.tasks.find((x) => x.id === d);
                          return (
                            <li key={d} className="flex items-center gap-2">
                              <Link href={routes.task(d)} className="tabular text-accent hover:underline">{d}</Link>
                              {dep && <TaskStatusBadge status={dep.status} />}
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      "—"
                    ),
                  },
                  { k: t("common.created"), v: dateTime(task.createdAt) },
                  { k: t("common.updated"), v: dateTime(task.updatedAt) },
                ]}
              />
            </CardBody>
          </Card>
          {approvals.length > 0 && (
            <Card>
              <CardHeader title={t("nav.approvals")} />
              <CardBody>
                <ul className="space-y-2 text-sm">
                  {approvals.map((a) => (
                    <li key={a.id} className="flex items-center gap-2">
                      <Link href={routes.approvals} className="tabular text-accent hover:underline">{a.id}</Link>
                      <Badge tone={a.status === "approved" ? "success" : a.status === "rejected" ? "danger" : "warning"}>{t(`approvalStatus.${a.status}`)}</Badge>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          )}
          <Card>
            <CardHeader title={t("tasks.history")} />
            <CardBody>
              <ol className="space-y-3 border-s border-border ps-4">
                {[...task.history].reverse().map((h, i) => {
                  const params: Record<string, string> = { ...(h.params ?? {}) };
                  for (const k of ["from", "to"] as const) if (params[k]) params[k] = tDynamic(t, `taskStatus.${params[k]}`);
                  if (h.key === "reassigned" && params.to) params.to = actorName(h.params?.to as never);
                  if (params.stage) params.stage = tDynamic(t, `stage.${params.stage}`);
                  return (
                    <li key={i} className="relative text-[13px]">
                      <span className="absolute -start-[21px] top-1.5 size-2 rounded-full bg-border-strong" aria-hidden />
                      <p className="text-fg">{tDynamic(t, `history.${h.key}`, params)}</p>
                      {h.params?.note && h.key === "status" && <p className="text-xs text-fg-2">“{h.params.note}”</p>}
                      <p className="text-xs text-muted">{actorName(h.actor)} · {dateTime(h.at)}</p>
                    </li>
                  );
                })}
              </ol>
            </CardBody>
          </Card>
        </div>
      </div>
      {editing && <TaskFormDialog open task={task} onClose={() => setEditing(false)} />}
    </>
  );
}

export default function Page() {
  return (
    <Suspense>
      <TaskView />
    </Suspense>
  );
}
