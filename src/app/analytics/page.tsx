"use client";

import Link from "next/link";
import { useCompany, useI18n, useRun } from "@/lib/store";
import { Card, CardBody, CardHeader, Checkbox, Notice, PageHeader, tableClass } from "@/components/ui/primitives";
import { BarList, Meter, StatTile } from "@/components/ui/charts";
import { ActorChip, ProjectStatusBadge, SampleBadge, SLOT_COLOR } from "@/components/common";
import { averageDurationHours, departmentStats, employeeStats, projectProgress, qualityStats, scope } from "@/lib/metrics";
import { can, updateSettings } from "@/lib/domain";
import { routes } from "@/lib/routes";
import { useDocumentTitle } from "@/components/shell/use-title";

export default function AnalyticsPage() {
  const s = useCompany();
  const { t, l } = useI18n();
  const run = useRun();
  useDocumentTitle(t("analytics.title"));
  const inc = s.settings.includeSampleInAnalytics;
  const tasks = scope(s.tasks, inc);
  const completed = tasks.filter((x) => x.status === "completed");
  const withDue = completed.filter((x) => x.dueDate && x.completedAt);
  const onTime = withDue.filter((x) => x.completedAt!.slice(0, 10) <= x.dueDate!);
  const q = qualityStats(s, inc);
  const avg = averageDurationHours(scope(s.executions, inc));
  const depts = departmentStats(s, inc);
  const hasData = completed.length > 0 || q.reviewed > 0;

  return (
    <>
      <PageHeader
        title={t("analytics.title")}
        subtitle={t("analytics.subtitle")}
        actions={
          <Checkbox
            label={t("analytics.includeSample")}
            checked={inc}
            disabled={!can(s.settings.role, "manage_settings")}
            onChange={(v) => run((st, ctx) => updateSettings(st, ctx, { includeSampleInAnalytics: v }))}
          />
        }
      />
      {!hasData && <Notice className="mb-6">{t("analytics.noData")}</Notice>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatTile label={t("analytics.tasksCompleted")} value={completed.length} testId="kpi-completed" />
        <StatTile label={t("analytics.onTime")} value={withDue.length ? `${Math.round((onTime.length / withDue.length) * 100)}%` : "—"} hint={t("analytics.onTimeHint")} />
        <StatTile label={t("analytics.passRate")} value={q.passRate === null ? "—" : `${q.passRate}%`} />
        <StatTile label={t("analytics.changesRequested")} value={q.changesRequested} />
        <StatTile label={t("analytics.reopened")} value={q.reopened} />
        <StatTile label={t("analytics.blocked")} value={tasks.filter((x) => x.status === "blocked").length} tone={tasks.some((x) => x.status === "blocked") ? "danger" : undefined} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title={t("analytics.projectDelivery")} />
          <CardBody className="space-y-4">
            {scope(s.projects, inc).map((p) => {
              const pct = projectProgress(s, p);
              return (
                <div key={p.id}>
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    <Link href={routes.project(p.id)} className="min-w-0 flex-1 truncate text-sm font-medium text-fg hover:underline">{p.name}</Link>
                    <SampleBadge show={p.sample} />
                    <ProjectStatusBadge status={p.status} />
                    <span className="tabular w-10 text-end text-[13px] font-medium">{pct === null ? "—" : `${pct}%`}</span>
                  </div>
                  <Meter value={pct} label={p.name} />
                </div>
              );
            })}
          </CardBody>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader title={t("analytics.byDepartment")} />
            <CardBody>
              <BarList rows={depts.map((d) => {
                const dept = s.departments.find((x) => x.id === d.id)!;
                return { key: d.id, label: l(dept.name), value: d.completed, color: SLOT_COLOR[dept.colorSlot] };
              })} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={t("analytics.qualityReviews")} />
            <CardBody>
              <dl className="tabular space-y-2 text-sm">
                {[
                  { k: t("analytics.approvedOutputs"), v: q.approved },
                  { k: t("analytics.changesRequested"), v: q.changesRequested },
                  { k: t("analytics.failedRuns"), v: q.failedExecutions },
                  { k: t("analytics.avgDuration"), v: avg === null ? "—" : `${avg.toFixed(1)} h` },
                ].map((x) => (
                  <div key={x.k} className="flex justify-between gap-3"><dt className="text-fg-2">{x.k}</dt><dd className="font-semibold text-fg">{x.v}</dd></div>
                ))}
              </dl>
              <p className="mt-3 text-xs text-muted">{t("analytics.avgDurationHint")}</p>
            </CardBody>
          </Card>
        </div>
      </div>

      <Card className="mt-6">
        <CardHeader title={t("analytics.byEmployee")} description={t("employees.performanceNote")} />
        <div className={tableClass.wrap}>
          <table className={tableClass.table} data-testid="kpi-table">
            <thead>
              <tr>
                <th className={tableClass.th}>{t("common.employee")}</th>
                <th className={tableClass.th}>{t("employees.statsAssigned")}</th>
                <th className={tableClass.th}>{t("employees.statsCompleted")}</th>
                <th className={tableClass.th}>{t("employees.statsOnTime")}</th>
                <th className={tableClass.th}>{t("employees.statsPassRate")}</th>
                <th className={tableClass.th}>{t("employees.statsChanges")}</th>
                <th className={tableClass.th}>{t("employees.statsDuration")}</th>
              </tr>
            </thead>
            <tbody className="tabular">
              {s.employees.map((e) => {
                const st = employeeStats(s, e.id, inc);
                return (
                  <tr key={e.id} className={tableClass.tr}>
                    <td className={tableClass.td}><ActorChip actor={e.id} size={24} /></td>
                    <td className={tableClass.td}>{st.assigned}</td>
                    <td className={tableClass.td}>{st.completed}</td>
                    <td className={tableClass.td}>{st.withDue ? `${Math.round((st.onTime / st.withDue) * 100)}%` : "—"}</td>
                    <td className={tableClass.td}>{st.reviewed ? `${Math.round((st.approvedFirstTime / st.reviewed) * 100)}%` : "—"}</td>
                    <td className={tableClass.td}>{st.changesRequested}</td>
                    <td className={tableClass.td}>{st.avgDurationHours === null ? "—" : `${st.avgDurationHours.toFixed(1)} h`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
