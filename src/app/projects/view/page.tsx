"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import { ArrowLeft, GitBranch, Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { useCompany, useI18n, useRun } from "@/lib/store";
import { Badge, BulletList, Button, Card, CardBody, CardHeader, EmptyState, Field, Input, KeyValue, Notice, Select, Textarea, tableClass } from "@/components/ui/primitives";
import { Dialog, useConfirm } from "@/components/ui/dialog";
import { Tabs } from "@/components/ui/tabs";
import { Meter } from "@/components/ui/charts";
import { ActivityList, ActorChip, PriorityBadge, ProjectStatusBadge, RefLink, SampleBadge, TaskStatusBadge, useQueryParam } from "@/components/common";
import { ProjectFormDialog } from "@/components/project-form";
import { TaskFormDialog } from "@/components/task-form";
import { Thread } from "@/components/thread";
import { addMilestone, addRisk, can, deleteProject, removeMilestone, removeRisk, requestProjectRelease, setProjectStatus, startStandardWorkflow, toggleMilestone } from "@/lib/domain";
import { PROJECT_TRANSITIONS, PROTECTED_ACTION_RISK } from "@/lib/workflow";
import { projectProgress } from "@/lib/metrics";
import { routes } from "@/lib/routes";
import { useDocumentTitle } from "@/components/shell/use-title";
import { PROTECTED_ACTIONS, type Project, type ProjectStatus, type ProtectedAction } from "@/lib/types";

type Tab = "overview" | "tasks" | "milestones" | "risks" | "deliverables" | "discussion" | "activity";

function ReleaseDialog({ project, onClose }: { project: Project; onClose: () => void }) {
  const { t } = useI18n();
  const run = useRun();
  const [action, setAction] = useState<ProtectedAction>("production_deployment");
  const [reason, setReason] = useState("");
  const [impact, setImpact] = useState("");
  return (
    <Dialog
      open
      onClose={onClose}
      title={t("projects.requestRelease")}
      description={t("projects.requestReleaseHint")}
      footer={
        <>
          <Button onClick={onClose}>{t("common.cancel")}</Button>
          <Button
            variant="primary"
            data-testid="submit-release"
            onClick={() => {
              const r = run((s, ctx) => requestProjectRelease(s, ctx, project.id, { action, reason, impact }), t("common.saved"));
              if (r.ok) onClose();
            }}
          >
            {t("projects.requestRelease")}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label={t("approvals.action")}>
          {(id) => (
            <Select id={id} value={action} onChange={(e) => setAction(e.target.value as ProtectedAction)}>
              {PROTECTED_ACTIONS.map((a) => <option key={a} value={a}>{t(`protectedAction.${a}`)}</option>)}
            </Select>
          )}
        </Field>
        <Field label={t("common.reason")} required>{(id) => <Textarea id={id} value={reason} onChange={(e) => setReason(e.target.value)} data-testid="release-reason" />}</Field>
        <Field label={t("common.impact")}>{(id) => <Textarea id={id} value={impact} onChange={(e) => setImpact(e.target.value)} />}</Field>
        <p className="text-xs text-muted">{t("common.risk")}: {t(`riskLevel.${PROTECTED_ACTION_RISK[action]}`)}</p>
      </div>
    </Dialog>
  );
}

function ProjectView() {
  const s = useCompany();
  const { t, l, date } = useI18n();
  const run = useRun();
  const confirm = useConfirm();
  const router = useRouter();
  const id = useQueryParam("id");
  const [tab, setTab] = useState<Tab>("overview");
  const [editing, setEditing] = useState(false);
  const [newTask, setNewTask] = useState(false);
  const [release, setRelease] = useState(false);
  const [ms, setMs] = useState({ title: "", dueDate: "" });
  const [risk, setRisk] = useState({ description: "", severity: "medium" as "low" | "medium" | "high", mitigation: "" });
  const p = s.projects.find((x) => x.id === id);
  useDocumentTitle(p ? p.name : t("projects.title"));
  if (!p) return <EmptyState title={t("errors.not_found", { id: id ?? "—" })} action={<Link className="text-accent hover:underline" href={routes.projects}>{t("nav.projects")}</Link>} />;

  const writable = can(s.settings.role, "write");
  const tasks = s.tasks.filter((x) => x.projectId === p.id);
  const pct = projectProgress(s, p);
  const nextStatuses = PROJECT_TRANSITIONS[p.status].filter((x) => x !== "awaiting_ceo_approval");
  const canRequest = PROJECT_TRANSITIONS[p.status].includes("awaiting_ceo_approval");
  const deliverables = s.deliverables.filter((d) => d.projectId === p.id);
  const activity = s.activity.filter((a) => a.refId === p.id || (a.refType === "task" && tasks.some((x) => x.id === a.refId)));
  const hasWorkflow = tasks.some((x) => x.stage !== null);

  return (
    <>
      <Link href={routes.projects} className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-fg-2 hover:text-fg">
        <ArrowLeft className="flip-rtl size-4" aria-hidden />
        {t("nav.projects")}
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="tabular text-sm text-muted">{p.id}</span>
            <ProjectStatusBadge status={p.status} />
            <PriorityBadge priority={p.priority} />
            <SampleBadge show={p.sample} />
          </div>
          <h1 className="bidi mt-1.5 text-2xl font-semibold tracking-tight text-fg" data-testid="project-title">{p.name}</h1>
          <p className="mt-0.5 text-sm text-fg-2">{p.client}</p>
        </div>
        {writable && (
          <div className="flex flex-wrap items-center gap-2">
            {nextStatuses.length > 0 && (
              <Select
                aria-label={t("projects.moveTo")}
                value=""
                onChange={(e) => e.target.value && run((st, ctx) => setProjectStatus(st, ctx, p.id, e.target.value as ProjectStatus))}
                className="w-48"
                data-testid="project-move"
              >
                <option value="">{t("projects.moveTo")}…</option>
                {nextStatuses.map((x) => <option key={x} value={x}>{t(`projectStatus.${x}`)}</option>)}
              </Select>
            )}
            {canRequest && (
              <Button variant="primary" onClick={() => setRelease(true)} data-testid="request-release">
                <ShieldCheck className="size-4" />
                {t("projects.requestRelease")}
              </Button>
            )}
            <Button onClick={() => setEditing(true)} data-testid="edit-project">
              <Pencil className="size-4" />
              {t("common.edit")}
            </Button>
            {can(s.settings.role, "delete") && (
              <Button
                variant="danger"
                aria-label={t("common.delete")}
                onClick={async () => {
                  const r = await confirm({ title: t("common.delete"), body: t("projects.deleteConfirm", { name: p.name, count: tasks.length }), confirmLabel: t("common.delete"), cancelLabel: t("common.cancel"), danger: true });
                  if (r.ok && run((st, ctx) => deleteProject(st, ctx, p.id)).ok) router.push(routes.projects);
                }}
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>
        )}
      </div>

      {p.status === "awaiting_ceo_approval" && (
        <Notice tone="warning" icon={<ShieldCheck className="size-4 text-warning" />} className="mb-6">
          {t("projects.pendingDecision")}{" "}
          <Link href={routes.approvals} className="font-medium text-accent hover:underline">{t("nav.approvals")}</Link>
        </Notice>
      )}

      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "overview", label: t("projects.overview") },
          { id: "tasks", label: t("nav.tasks"), count: tasks.length },
          { id: "milestones", label: t("projects.milestones"), count: p.milestones.length },
          { id: "risks", label: t("projects.risks"), count: p.risks.length },
          { id: "deliverables", label: t("projects.deliverables"), count: deliverables.length },
          { id: "discussion", label: t("projects.discussion") },
          { id: "activity", label: t("projects.activity") },
        ]}
      >
        {tab === "overview" && (
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardBody className="space-y-5">
                {[
                  { k: t("common.description"), v: p.description },
                  { k: t("projects.businessRequirements"), v: p.businessRequirements },
                  { k: t("projects.technicalRequirements"), v: p.technicalRequirements },
                  { k: t("projects.scope"), v: p.scope },
                ].map((x) => (
                  <div key={x.k}>
                    <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{x.k}</h3>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-fg">{x.v || t("projects.empty")}</p>
                  </div>
                ))}
                <div>
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{t("common.dependencies")}</h3>
                  <BulletList items={p.dependencies} empty={t("projects.empty")} />
                </div>
              </CardBody>
            </Card>
            <div className="space-y-6">
              <Card>
                <CardBody className="space-y-4">
                  <div>
                    <div className="mb-1.5 flex justify-between text-[13px]"><span className="text-fg-2">{t("common.progress")}</span><span className="tabular font-semibold text-fg">{pct === null ? "—" : `${pct}%`}</span></div>
                    <Meter value={pct} label={t("common.progress")} />
                  </div>
                  <KeyValue
                    className="sm:grid-cols-1"
                    items={[
                      { k: t("common.startDate"), v: date(p.startDate) },
                      { k: t("common.targetDate"), v: date(p.targetDate) },
                      { k: t("projects.budget"), v: p.budget === null ? t("common.notSet") : `$${p.budget.toLocaleString()}` },
                      { k: t("common.manager"), v: <ActorChip actor={p.managerId} size={24} /> },
                      ...(p.repoUrl ? [{ k: "GitHub", v: <RefLink link={{ label: p.repoUrl.replace(/^https:\/\/github\.com\//, ""), url: p.repoUrl }} /> }] : []),
                    ]}
                  />
                  <p className="text-xs text-muted">{t("projects.budgetHint")}</p>
                </CardBody>
              </Card>
              <Card>
                <CardHeader title={t("projects.team")} />
                <CardBody>
                  {p.memberIds.length === 0 ? <p className="text-sm text-muted">{t("projects.empty")}</p> : (
                    <ul className="space-y-2.5">
                      {p.memberIds.map((m) => {
                        const e = s.employees.find((x) => x.id === m);
                        return <li key={m}><ActorChip actor={m} size={26} sub={e ? l(e.title) : undefined} /></li>;
                      })}
                    </ul>
                  )}
                </CardBody>
              </Card>
            </div>
          </div>
        )}

        {tab === "tasks" && (
          <Card>
            <CardHeader
              title={t("nav.tasks")}
              actions={
                writable && (
                  <>
                    {!hasWorkflow && (
                      <Button size="sm" onClick={() => run((st, ctx) => startStandardWorkflow(st, ctx, p.id), t("common.saved"))} title={t("projects.startWorkflowHint")} data-testid="start-workflow">
                        <GitBranch className="size-4" />
                        {t("projects.startWorkflow")}
                      </Button>
                    )}
                    <Button size="sm" variant="primary" onClick={() => setNewTask(true)} data-testid="project-new-task">
                      <Plus className="size-4" />
                      {t("tasks.new")}
                    </Button>
                  </>
                )
              }
            />
            {tasks.length === 0 ? (
              <CardBody><EmptyState title={t("projects.noTasks")}>{t("projects.startWorkflowHint")}</EmptyState></CardBody>
            ) : (
              <div className={tableClass.wrap}>
                <table className={tableClass.table} data-testid="project-tasks">
                  <thead>
                    <tr>
                      <th className={tableClass.th}>{t("common.id")}</th>
                      <th className={tableClass.th}>{t("common.title")}</th>
                      <th className={tableClass.th}>{t("common.assignee")}</th>
                      <th className={tableClass.th}>{t("common.status")}</th>
                      <th className={tableClass.th}>{t("common.dependencies")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.map((x) => (
                      <tr key={x.id} className={tableClass.tr}>
                        <td className={`${tableClass.td} tabular text-muted`}>{x.id}</td>
                        <td className={tableClass.td}>
                          <Link href={routes.task(x.id)} className="hover:underline">{x.title}</Link>
                          {x.stage && <span className="ms-2 text-xs text-muted">{t(`stage.${x.stage}`)}</span>}
                        </td>
                        <td className={tableClass.td}><ActorChip actor={x.assigneeId} size={22} /></td>
                        <td className={tableClass.td}><TaskStatusBadge status={x.status} /></td>
                        <td className={`${tableClass.td} tabular text-xs text-muted`}>{x.dependencies.join(", ") || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}

        {tab === "milestones" && (
          <Card>
            <CardBody className="space-y-4">
              {p.milestones.length === 0 && <p className="text-sm text-muted">{t("projects.noMilestones")}</p>}
              <ul className="space-y-2">
                {p.milestones.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={m.done}
                      disabled={!writable}
                      onChange={() => run((st, ctx) => toggleMilestone(st, ctx, p.id, m.id))}
                      aria-label={m.title}
                      className="size-4 accent-[var(--accent)]"
                    />
                    <span className={`flex-1 text-sm ${m.done ? "text-muted line-through" : "text-fg"}`}>{m.title}</span>
                    <span className="text-xs text-muted">{date(m.dueDate)}</span>
                    {writable && (
                      <Button size="sm" variant="ghost" aria-label={t("common.remove")} onClick={() => run((st, ctx) => removeMilestone(st, ctx, p.id, m.id))}>
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
              {writable && (
                <form
                  className="flex flex-wrap gap-2 border-t border-border pt-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (run((st, ctx) => addMilestone(st, ctx, p.id, ms)).ok) setMs({ title: "", dueDate: "" });
                  }}
                >
                  <Input aria-label={t("common.title")} placeholder={t("common.title")} value={ms.title} onChange={(e) => setMs({ ...ms, title: e.target.value })} className="min-w-48 flex-1" />
                  <Input aria-label={t("common.dueDate")} type="date" value={ms.dueDate} onChange={(e) => setMs({ ...ms, dueDate: e.target.value })} className="w-44" />
                  <Button type="submit"><Plus className="size-4" />{t("projects.addMilestone")}</Button>
                </form>
              )}
            </CardBody>
          </Card>
        )}

        {tab === "risks" && (
          <Card>
            <CardBody className="space-y-4">
              {p.risks.length === 0 && <p className="text-sm text-muted">{t("projects.noRisks")}</p>}
              <ul className="space-y-2">
                {p.risks.map((r) => (
                  <li key={r.id} className="rounded-lg border border-border px-4 py-3">
                    <div className="flex flex-wrap items-start gap-2">
                      <Badge tone={r.severity === "high" ? "danger" : r.severity === "medium" ? "warning" : "neutral"}>{t(`severity.${r.severity}`)}</Badge>
                      <p className="flex-1 text-sm text-fg">{r.description}</p>
                      {writable && (
                        <Button size="sm" variant="ghost" aria-label={t("common.remove")} onClick={() => run((st, ctx) => removeRisk(st, ctx, p.id, r.id))}>
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                    </div>
                    {r.mitigation && <p className="mt-1.5 text-[13px] text-fg-2"><span className="text-muted">{t("projects.mitigation")}:</span> {r.mitigation}</p>}
                  </li>
                ))}
              </ul>
              {writable && (
                <form
                  className="grid gap-2 border-t border-border pt-4 sm:grid-cols-[1fr_9rem]"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (run((st, ctx) => addRisk(st, ctx, p.id, risk)).ok) setRisk({ description: "", severity: "medium", mitigation: "" });
                  }}
                >
                  <Input aria-label={t("common.description")} placeholder={t("common.description")} value={risk.description} onChange={(e) => setRisk({ ...risk, description: e.target.value })} />
                  <Select aria-label={t("common.risk")} value={risk.severity} onChange={(e) => setRisk({ ...risk, severity: e.target.value as "low" | "medium" | "high" })}>
                    {(["low", "medium", "high"] as const).map((x) => <option key={x} value={x}>{t(`severity.${x}`)}</option>)}
                  </Select>
                  <Input aria-label={t("projects.mitigation")} placeholder={t("projects.mitigation")} value={risk.mitigation} onChange={(e) => setRisk({ ...risk, mitigation: e.target.value })} />
                  <Button type="submit"><Plus className="size-4" />{t("projects.addRisk")}</Button>
                </form>
              )}
            </CardBody>
          </Card>
        )}

        {tab === "deliverables" && (
          <Card>
            <CardBody>
              {deliverables.length === 0 ? <p className="text-sm text-muted">{t("deliverables.none")}</p> : (
                <ul className="space-y-2.5">
                  {deliverables.map((d) => (
                    <li key={d.id} className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="tabular text-muted">{d.id}</span>
                      <span className="font-medium text-fg">{d.title}</span>
                      <Badge>{t(`deliverableType.${d.type}`)}</Badge>
                      <Badge tone={d.status === "approved" ? "success" : d.status === "in_review" ? "warning" : "neutral"}>{t(`deliverableStatus.${d.status}`)}</Badge>
                      <code dir="ltr" className="rounded bg-surface-2 px-1.5 font-mono text-xs">{d.location}</code>
                    </li>
                  ))}
                </ul>
              )}
              <Link href={routes.deliverables} className="mt-4 inline-block text-[13px] text-accent hover:underline">{t("nav.deliverables")}</Link>
            </CardBody>
          </Card>
        )}

        {tab === "discussion" && (
          <div className="grid gap-6 lg:grid-cols-2">
            <Card><CardHeader title={t("channelKind.project")} /><CardBody><Thread kind="project" refId={p.id} /></CardBody></Card>
            <div className="space-y-6">
              <Card><CardHeader title={t("channelKind.decision")} /><CardBody><Thread kind="decision" refId={p.id} /></CardBody></Card>
              <Card><CardHeader title={t("channelKind.meeting")} /><CardBody><Thread kind="meeting" refId={p.id} /></CardBody></Card>
            </div>
          </div>
        )}

        {tab === "activity" && <Card><CardBody className="py-1"><ActivityList events={activity} /></CardBody></Card>}
      </Tabs>

      {editing && <ProjectFormDialog open project={p} onClose={() => setEditing(false)} />}
      {newTask && <TaskFormDialog open defaultProjectId={p.id} onClose={() => setNewTask(false)} />}
      {release && <ReleaseDialog project={p} onClose={() => setRelease(false)} />}
    </>
  );
}

export default function Page() {
  return (
    <Suspense>
      <ProjectView />
    </Suspense>
  );
}
