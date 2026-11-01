"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useCompany, useI18n } from "@/lib/store";
import { Card, CardBody, PageHeader } from "@/components/ui/primitives";
import { ActorChip, Avatar, SLOT_COLOR } from "@/components/common";
import { departmentStats } from "@/lib/metrics";
import { routes } from "@/lib/routes";
import { useDocumentTitle } from "@/components/shell/use-title";

export default function DepartmentsPage() {
  const s = useCompany();
  const { t, l } = useI18n();
  useDocumentTitle(t("departments.title"));
  const stats = departmentStats(s, s.settings.includeSampleInAnalytics);

  return (
    <>
      <PageHeader title={t("departments.title")} subtitle={t("departments.subtitle")} />
      <div className="grid gap-5 md:grid-cols-2">
        {s.departments.map((d) => {
          const st = stats.find((x) => x.id === d.id)!;
          const team = s.employees.filter((e) => e.departmentId === d.id);
          return (
            <Card key={d.id} className="flex flex-col">
              <CardBody className="flex flex-1 flex-col gap-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="flex items-center gap-2 text-lg font-semibold text-fg">
                      <span className="size-3 rounded-sm" style={{ background: SLOT_COLOR[d.colorSlot] }} aria-hidden />
                      {l(d.name)}
                    </h2>
                    <p className="mt-1 text-sm text-fg-2">{l(d.description)}</p>
                  </div>
                </div>
                <div>
                  <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">{t("common.manager")}</p>
                  <ActorChip actor={d.managerId} size={30} />
                </div>
                <div className="flex -space-x-2 rtl:space-x-reverse" aria-label={t("departments.team")}>
                  {team.map((e) => (
                    <Link key={e.id} href={routes.employee(e.id)} title={l(e.name)} className="rounded-full ring-2 ring-surface">
                      <Avatar actor={e.id} size={30} />
                    </Link>
                  ))}
                </div>
                <dl className="tabular grid grid-cols-3 gap-2 text-center">
                  {[
                    { k: t("departments.openTasks"), v: st.open },
                    { k: t("departments.completedTasks"), v: st.completed },
                    { k: t("departments.blockedTasks"), v: st.blocked },
                  ].map((x) => (
                    <div key={x.k} className="rounded-lg bg-surface-2 px-2 py-2">
                      <dd className="text-lg font-semibold text-fg">{x.v}</dd>
                      <dt className="text-[11px] text-muted">{x.k}</dt>
                    </div>
                  ))}
                </dl>
                <Link href={routes.department(d.id)} className="mt-auto inline-flex items-center gap-1 self-start text-[13px] font-medium text-accent hover:underline" data-testid={`open-dept-${d.id}`}>
                  {t("common.details")}
                  <ArrowRight className="flip-rtl size-3.5" aria-hidden />
                </Link>
              </CardBody>
            </Card>
          );
        })}
      </div>
    </>
  );
}
