"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertOctagon, ArrowRight, CircleDollarSign, Clock, FolderKanban, Info, ListTodo, ShieldCheck, Users } from "lucide-react";
import { useCompany, useI18n, LAST_EXPORT_KEY } from "@/lib/store";
import { Card, CardBody, CardHeader, Notice, PageHeader, tableClass } from "@/components/ui/primitives";
import { BarList, Meter, SegmentedBar, StatTile, type Segment } from "@/components/ui/charts";
import { ActivityList, ActorChip, ProjectStatusBadge, RiskBadge, SampleBadge, SLOT_COLOR } from "@/components/common";
import { countBy, departmentStats, OPEN_TASK, projectProgress, qualityStats, scope } from "@/lib/metrics";
import { routes } from "@/lib/routes";
import { useDocumentTitle } from "@/components/shell/use-title";
import { useCloud } from "@/lib/cloud/status";
import type { TaskStatus } from "@/lib/types";

const ACTIVE_PROJECT = ["planning", "requirements", "design", "development", "testing", "review", "awaiting_ceo_approval", "ready_for_delivery"];

export default function OverviewPage() {
  const s = useCompany();
  const { t, l, date } = useI18n();
  useDocumentTitle(t("overview.title"));
  const inc = s.settings.includeSampleInAnalytics;
  const tasks = scope(s.tasks, inc);
  const projects = scope(s.projects, inc);
  const approvals = s.approvals.filter((a) => a.status === "pending");
  const pendingApprovals = scope(approvals, inc).length;
  const byStatus = countBy(tasks, (x) => x.status);
  const n = (k: TaskStatus) => byStatus[k] ?? 0;
  const q = qualityStats(s, inc);
  const exes = scope(s.executions, inc);
  const cloud = useCloud();
  // The store renders pages only on the client, so localStorage is available here.
  const [lastExport] = useState<string | null>(() => localStorage.getItem(LAST_EXPORT_KEY));

  const segments: Segment[] = [
    { key: "todo", label: `${t("taskStatus.backlog")} / ${t("taskStatus.assigned")}`, value: n("backlog") + n("assigned"), color: "var(--border-strong)" },
    { key: "progress", label: t("taskStatus.in_progress"), value: n("in_progress"), color: "var(--s1)" },
    { key: "review", label: t("taskStatus.under_review"), value: n("under_review") + n("changes_requested") + n("awaiting_ceo_approval"), color: "#6250d6" },
    { key: "blocked", label: t("taskStatus.blocked"), value: n("blocked"), color: "var(--danger-mark)" },
    { key: "done", label: t("taskStatus.completed"), value: n("completed"), color: "var(--success-mark)" },
  ];
  const active = projects.filter((p) => ACTIVE_PROJECT.includes(p.status));
  const depts = departmentStats(s, inc);

  return (
    <>
      <PageHeader title={t("overview.greeting", { name: s.settings.founderName.split(" ")[0] || t("common.ceo") })} subtitle={`${t("overview.title")} · ${date(new Date().toISOString())}`} />

      <Notice icon={<Info className="size-4 text-accent" />} className="mb-6">
        {t("overview.honesty")}{" "}
        <strong className="tabular">{t("overview.activeSessions", { count: exes.filter((e) => e.status === "in_session").length })}</strong>
      </Notice>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label={t("overview.employees")} value={s.employees.length} icon={<Users className="size-4" />} href={routes.employees} testId="stat-employees" />
        <StatTile label={t("overview.activeProjects")} value={active.length} icon={<FolderKanban className="size-4" />} />
        <StatTile label={t("overview.completedProjects")} value={projects.filter((p) => p.status === "delivered").length} />
        <StatTile label={t("overview.pendingApprovals")} value={pendingApprovals} icon={<ShieldCheck className="size-4" />} tone={pendingApprovals ? "warning" : undefined} testId="stat-approvals" />
        <StatTile label={t("overview.pendingTasks")} value={tasks.filter((x) => OPEN_TASK.includes(x.status)).length} icon={<ListTodo className="size-4" />} />
        <StatTile label={t("overview.inProgress")} value={n("in_progress")} icon={<Clock className="size-4" />} />
        <StatTile label={t("overview.blocked")} value={n("blocked")} icon={<AlertOctagon className="size-4" />} tone={n("blocked") ? "danger" : undefined} />
        <StatTile label={t("overview.spending")} value="$0" hint={t("overview.spendingHint")} icon={<CircleDollarSign className="size-4" />} tone="success" testId="stat-spending" />
      </div>
      <p className="mt-2 text-xs text-muted">{inc ? t("overview.sampleIncluded") : t("overview.sampleExcluded")}</p>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader title={t("overview.tasksByStatus")} actions={<Link className="text-[13px] text-accent hover:underline" href={routes.tasks}>{t("common.viewAll")}</Link>} />
            <CardBody>
              <SegmentedBar segments={segments} ariaLabel={t("overview.tasksByStatus")} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t("overview.approvalsQueue")} actions={<Link className="text-[13px] text-accent hover:underline" href={routes.approvals}>{t("nav.approvals")}</Link>} />
            <CardBody className="py-2">
              {approvals.length === 0 ? (
                <p className="py-3 text-sm text-muted">{t("overview.noApprovals")}</p>
              ) : (
                <ul>
                  {approvals.slice(0, 5).map((a) => (
                    <li key={a.id} className="flex flex-wrap items-center gap-3 border-b border-border py-3 last:border-0">
                      <ShieldCheck className="size-4 shrink-0 text-warning" aria-hidden />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-fg">
                          {a.title} <SampleBadge show={a.sample} />
                        </p>
                        <p className="text-xs text-muted">
                          {t(`protectedAction.${a.action}`)} · {a.id}
                        </p>
                      </div>
                      <RiskBadge risk={a.risk} />
                      <Link href={routes.approvals} className="flex items-center gap-1 text-[13px] font-medium text-accent hover:underline">
                        {t("common.open")}
                        <ArrowRight className="flip-rtl size-3.5" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t("overview.projectProgress")} />
            <CardBody className="space-y-4">
              {active.length === 0 && <p className="text-sm text-muted">{t("overview.noProjects")}</p>}
              {active.map((p) => {
                const pct = projectProgress(s, p);
                return (
                  <div key={p.id}>
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      <Link href={routes.project(p.id)} className="min-w-0 flex-1 truncate text-sm font-medium text-fg hover:underline">
                        {p.name}
                      </Link>
                      <SampleBadge show={p.sample} />
                      <ProjectStatusBadge status={p.status} />
                      <span className="tabular w-10 text-end text-[13px] font-medium text-fg">{pct === null ? "—" : `${pct}%`}</span>
                    </div>
                    <Meter value={pct} label={`${p.name} ${t("common.progress")}`} />
                    <p className="mt-1 text-xs text-muted">
                      {t("common.targetDate")}: {date(p.targetDate)}
                    </p>
                  </div>
                );
              })}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t("overview.departmentPerformance")} description={t("common.measured")} />
            <div className={tableClass.wrap}>
              <table className={tableClass.table}>
                <thead>
                  <tr>
                    <th className={tableClass.th}>{t("common.department")}</th>
                    <th className={tableClass.th}>{t("overview.employees")}</th>
                    <th className={tableClass.th}>{t("overview.open")}</th>
                    <th className={tableClass.th}>{t("overview.completed")}</th>
                    <th className={tableClass.th}>{t("overview.blocked")}</th>
                  </tr>
                </thead>
                <tbody className="tabular">
                  {depts.map((d) => {
                    const dept = s.departments.find((x) => x.id === d.id)!;
                    return (
                      <tr key={d.id} className={tableClass.tr}>
                        <td className={tableClass.td}>
                          <Link href={routes.department(d.id)} className="flex items-center gap-2 hover:underline">
                            <span className="size-2.5 rounded-sm" style={{ background: SLOT_COLOR[dept.colorSlot] }} aria-hidden />
                            {l(dept.name)}
                          </Link>
                        </td>
                        <td className={tableClass.td}>{d.employees}</td>
                        <td className={tableClass.td}>{d.open}</td>
                        <td className={tableClass.td}>{d.completed}</td>
                        <td className={tableClass.td}>{d.blocked}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title={t("overview.byDepartment")} />
            <CardBody>
              <BarList
                rows={s.departments.map((d) => ({
                  key: d.id,
                  label: l(d.name),
                  value: s.employees.filter((e) => e.departmentId === d.id).length,
                  color: SLOT_COLOR[d.colorSlot],
                }))}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t("overview.execution")} actions={<Link className="text-[13px] text-accent hover:underline" href={routes.execution}>{t("nav.execution")}</Link>} />
            <CardBody>
              <dl className="grid grid-cols-2 gap-3">
                {[
                  { k: t("overview.queued"), v: exes.filter((e) => e.status === "queued").length },
                  { k: t("overview.inSession"), v: exes.filter((e) => e.status === "in_session").length },
                  { k: t("overview.awaitingReview"), v: exes.filter((e) => e.reviewStatus === "pending").length },
                  { k: t("overview.completedRuns"), v: exes.filter((e) => e.reviewStatus === "approved").length },
                ].map((x) => (
                  <div key={x.k} className="rounded-lg bg-surface-2 px-3 py-2.5">
                    <dt className="text-xs text-muted">{x.k}</dt>
                    <dd className="tabular mt-1 text-lg font-semibold text-fg">{x.v}</dd>
                  </div>
                ))}
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t("overview.quality")} description={t("common.measured")} />
            <CardBody>
              <dl className="grid grid-cols-2 gap-3">
                {[
                  { k: t("overview.reviewPassRate"), v: q.passRate === null ? "—" : `${q.passRate}%` },
                  { k: t("overview.changesRequested"), v: q.changesRequested },
                  { k: t("overview.reopened"), v: q.reopened },
                  { k: t("overview.failedRuns"), v: q.failedExecutions },
                ].map((x) => (
                  <div key={x.k} className="rounded-lg bg-surface-2 px-3 py-2.5">
                    <dt className="text-xs text-muted">{x.k}</dt>
                    <dd className="tabular mt-1 text-lg font-semibold text-fg">{x.v}</dd>
                  </div>
                ))}
              </dl>
              {q.reviewed === 0 && <p className="mt-3 text-xs text-muted">{t("common.notEnoughData")}</p>}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t("overview.infra")} />
            <CardBody>
              <dl className="space-y-2.5 text-[13px]">
                {[
                  { k: t("overview.hosting"), v: t("overview.hostingValue") },
                  { k: t("overview.dataStore"), v: cloud.email ? `${t("overview.dataStoreCloud")} · ${t(`cloud.status.${cloud.status}`)}` : t("overview.dataStoreValue") },
                  { k: t("overview.lastExport"), v: lastExport ? date(lastExport) : t("overview.never") },
                  { k: t("overview.aiAccess"), v: t("overview.aiAccessValue") },
                  { k: t("overview.paidServices"), v: t("overview.paidServicesValue") },
                ].map((x) => (
                  <div key={x.k} className="flex justify-between gap-4">
                    <dt className="text-muted">{x.k}</dt>
                    <dd className="text-end font-medium text-fg">{x.v}</dd>
                  </div>
                ))}
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t("overview.recentActivity")} actions={<Link className="text-[13px] text-accent hover:underline" href={routes.activity}>{t("common.viewAll")}</Link>} />
            <CardBody className="py-1">
              <ActivityList events={s.activity.slice(0, 7)} compact />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t("org.founder")} />
            <CardBody>
              <ActorChip actor="ceo" size={36} link={false} sub={s.settings.founderTitle} />
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
