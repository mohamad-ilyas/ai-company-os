"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useCompany, useI18n } from "@/lib/store";
import { BulletList, Card, CardBody, CardHeader, EmptyState, tableClass } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/tabs";
import { ActivityList, ActorChip, ProjectStatusBadge, SampleBadge, SLOT_COLOR, TaskStatusBadge, WorkStateBadge, useQueryParam } from "@/components/common";
import { Thread } from "@/components/thread";
import { departmentStats, OPEN_TASK } from "@/lib/metrics";
import { routes } from "@/lib/routes";
import { useDocumentTitle } from "@/components/shell/use-title";

type Tab = "overview" | "tasks" | "discussion" | "activity";

function DepartmentView() {
  const s = useCompany();
  const { t, l } = useI18n();
  const id = useQueryParam("id");
  const [tab, setTab] = useState<Tab>("overview");
  const d = s.departments.find((x) => x.id === id);
  useDocumentTitle(d ? l(d.name) : t("departments.title"));
  if (!d) return <EmptyState title={t("errors.not_found", { id: id ?? "—" })} />;

  const team = s.employees.filter((e) => e.departmentId === d.id);
  const ids = new Set(team.map((e) => e.id));
  const tasks = s.tasks.filter((x) => x.assigneeId && ids.has(x.assigneeId));
  const projects = s.projects.filter((p) => p.memberIds.some((m) => ids.has(m)) && !["delivered", "cancelled"].includes(p.status));
  const st = departmentStats(s, s.settings.includeSampleInAnalytics).find((x) => x.id === d.id)!;
  const activity = s.activity.filter((a) => ids.has(a.actor as never) || (a.params.employee && ids.has(a.params.employee as never)));

  return (
    <>
      <Link href={routes.departments} className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-fg-2 hover:text-fg">
        <ArrowLeft className="flip-rtl size-4" aria-hidden />
        {t("nav.departments")}
      </Link>
      <div className="mb-6">
        <h1 className="flex items-center gap-2.5 text-2xl font-semibold tracking-tight text-fg">
          <span className="size-3.5 rounded-sm" style={{ background: SLOT_COLOR[d.colorSlot] }} aria-hidden />
          {l(d.name)}
        </h1>
        <p className="mt-1 text-sm text-fg-2">{l(d.description)}</p>
      </div>

      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "overview", label: t("departments.overview") },
          { id: "tasks", label: t("departments.tasks"), count: tasks.filter((x) => OPEN_TASK.includes(x.status)).length },
          { id: "discussion", label: t("departments.discussion") },
          { id: "activity", label: t("departments.activity") },
        ]}
      >
        {tab === "overview" && (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <Card>
                <CardHeader title={t("departments.team")} />
                <ul>
                  {team.map((e) => (
                    <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3 last:border-0">
                      <ActorChip actor={e.id} size={34} sub={l(e.title)} />
                      <WorkStateBadge employee={e} />
                    </li>
                  ))}
                </ul>
              </Card>
              <Card>
                <CardHeader title={t("departments.activeProjects")} />
                <CardBody>
                  {projects.length === 0 ? <p className="text-sm text-muted">{t("overview.noProjects")}</p> : (
                    <ul className="space-y-2.5">
                      {projects.map((p) => (
                        <li key={p.id} className="flex flex-wrap items-center gap-2">
                          <Link href={routes.project(p.id)} className="text-sm font-medium text-fg hover:underline">{p.name}</Link>
                          <SampleBadge show={p.sample} />
                          <ProjectStatusBadge status={p.status} />
                        </li>
                      ))}
                    </ul>
                  )}
                </CardBody>
              </Card>
            </div>
            <div className="space-y-6">
              <Card>
                <CardHeader title={t("common.manager")} />
                <CardBody><ActorChip actor={d.managerId} size={36} /></CardBody>
              </Card>
              <Card>
                <CardHeader title={t("departments.metrics")} description={t("common.measured")} />
                <CardBody>
                  <dl className="tabular space-y-2 text-sm">
                    {[
                      { k: t("departments.openTasks"), v: st.open },
                      { k: t("departments.completedTasks"), v: st.completed },
                      { k: t("departments.blockedTasks"), v: st.blocked },
                    ].map((x) => (
                      <div key={x.k} className="flex justify-between"><dt className="text-fg-2">{x.k}</dt><dd className="font-semibold text-fg">{x.v}</dd></div>
                    ))}
                  </dl>
                </CardBody>
              </Card>
              <Card>
                <CardHeader title={t("departments.responsibilities")} />
                <CardBody><BulletList items={d.responsibilities} /></CardBody>
              </Card>
            </div>
          </div>
        )}
        {tab === "tasks" && (
          <Card>
            {tasks.length === 0 ? <CardBody><p className="text-sm text-muted">{t("tasks.noTasks")}</p></CardBody> : (
              <div className={tableClass.wrap}>
                <table className={tableClass.table}>
                  <thead>
                    <tr>
                      <th className={tableClass.th}>{t("common.id")}</th>
                      <th className={tableClass.th}>{t("common.title")}</th>
                      <th className={tableClass.th}>{t("common.assignee")}</th>
                      <th className={tableClass.th}>{t("common.status")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.map((x) => (
                      <tr key={x.id} className={tableClass.tr}>
                        <td className={`${tableClass.td} tabular text-muted`}>{x.id}</td>
                        <td className={tableClass.td}><Link href={routes.task(x.id)} className="hover:underline">{x.title}</Link> <SampleBadge show={x.sample} /></td>
                        <td className={tableClass.td}><ActorChip actor={x.assigneeId} size={22} /></td>
                        <td className={tableClass.td}><TaskStatusBadge status={x.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}
        {tab === "discussion" && (
          <Card><CardBody><Thread kind="department" refId={d.id} /></CardBody></Card>
        )}
        {tab === "activity" && (
          <Card><CardBody className="py-1"><ActivityList events={activity} /></CardBody></Card>
        )}
      </Tabs>
    </>
  );
}

export default function Page() {
  return (
    <Suspense>
      <DepartmentView />
    </Suspense>
  );
}
