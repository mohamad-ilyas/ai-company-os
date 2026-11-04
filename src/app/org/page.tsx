"use client";

import Link from "next/link";
import { useCompany, useI18n } from "@/lib/store";
import { PageHeader } from "@/components/ui/primitives";
import { Avatar, SLOT_COLOR, WorkStateBadge } from "@/components/common";
import { routes } from "@/lib/routes";
import { useDocumentTitle } from "@/components/shell/use-title";
import { cn } from "@/lib/cn";
import type { Employee, EmployeeId } from "@/lib/types";

function PersonNode({ emp, lead, note }: { emp: Employee; lead?: boolean; note?: string }) {
  const s = useCompany();
  const { l, t } = useI18n();
  const dept = s.departments.find((d) => d.id === emp.departmentId)!;
  return (
    <Link
      href={routes.employee(emp.id)}
      className={cn(
        "group block rounded-lg border bg-surface px-3 py-2.5 shadow-card transition-colors hover:border-border-strong focus-visible:border-ring",
        lead ? "border-border-strong" : "border-border",
      )}
      style={{ borderInlineStartWidth: 3, borderInlineStartColor: SLOT_COLOR[dept.colorSlot] }}
      data-testid={`org-node-${emp.id}`}
    >
      <div className="flex items-center gap-2.5">
        <Avatar actor={emp.id} size={34} />
        <div className="min-w-0">
          <p className="truncate text-[13.5px] font-semibold text-fg group-hover:underline">{l(emp.name)}</p>
          <p className="line-clamp-2 text-xs leading-snug text-fg-2" title={l(emp.title)}>{l(emp.title)}</p>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {lead && <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-fg-2">{t("org.lead")}</span>}
        <WorkStateBadge employee={emp} hideIdle />
      </div>
      {note && <p className="mt-1.5 text-[11px] text-muted">{note}</p>}
    </Link>
  );
}

export default function OrgChartPage() {
  const s = useCompany();
  const { t, l } = useI18n();
  useDocumentTitle(t("org.title"));
  const byId = (id: EmployeeId) => s.employees.find((e) => e.id === id)!;
  const reportsOf = (id: EmployeeId) => s.employees.filter((e) => e.reportsTo === id);

  return (
    <>
      <PageHeader title={t("org.title")} subtitle={t("org.subtitle")} />

      <div className="flex flex-col items-center">
        <div className="w-full max-w-xs rounded-lg border-2 border-fg bg-surface px-4 py-3 text-center shadow-card" data-testid="org-ceo">
          <p className="text-[15px] font-semibold text-fg">{s.settings.founderName}</p>
          <p className="text-xs text-fg-2">{t("org.founder")}</p>
        </div>
        <div className="h-6 w-px bg-border-strong" aria-hidden />
        {(() => {
          const coo = s.employees.find((e) => e.id === "EMP-001");
          return coo ? (
            <div className="w-full max-w-sm">
              <PersonNode emp={coo} lead note={t("org.singleContact")} />
            </div>
          ) : null;
        })()}
        <div className="h-6 w-px bg-border-strong" aria-hidden />
      </div>

      <div className="relative grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <div className="pointer-events-none absolute inset-x-[12%] -top-px hidden h-px bg-border-strong xl:block" aria-hidden />
        {s.departments.map((dept) => {
          const lead = byId(dept.managerId);
          // The COO is shown once, under the CEO; her department lists only its members.
          const leadShownAbove = lead.id === "EMP-001";
          // Direct reports of the lead inside this department, plus anyone in the department who reports elsewhere.
          const team = s.employees.filter((e) => e.departmentId === dept.id && e.id !== lead.id);
          const underLead = team.filter((e) => e.reportsTo === lead.id);
          const others = team.filter((e) => e.reportsTo !== lead.id && !underLead.some((u) => u.id === e.reportsTo));
          return (
            <section key={dept.id} aria-labelledby={`dept-${dept.id}`} className="relative">
              <div className="mx-auto hidden h-4 w-px bg-border-strong xl:block" aria-hidden />
              <div className="rounded-xl border border-border bg-surface-2/60 p-3">
                <Link href={routes.department(dept.id)} className="mb-3 flex items-center gap-2 px-1 hover:underline" id={`dept-${dept.id}`}>
                  <span className="size-2.5 rounded-sm" style={{ background: SLOT_COLOR[dept.colorSlot] }} aria-hidden />
                  <h2 className="text-[13px] font-semibold uppercase tracking-wide text-fg-2">{l(dept.name)}</h2>
                </Link>
                {!leadShownAbove && <PersonNode emp={lead} lead />}
                <ul className={leadShownAbove ? "space-y-2" : "mt-2 space-y-2 border-s border-border-strong ps-3 ms-4"}>
                  {underLead.map((e) => (
                    <li key={e.id} className="relative">
                      <span className="absolute -start-3 top-6 h-px w-3 bg-border-strong" aria-hidden />
                      <PersonNode emp={e} />
                      {reportsOf(e.id).length > 0 && (
                        <ul className="mt-2 space-y-2 border-s border-border-strong ps-3 ms-4">
                          {reportsOf(e.id).map((r) => (
                            <li key={r.id} className="relative">
                              <span className="absolute -start-3 top-6 h-px w-3 bg-border-strong" aria-hidden />
                              <PersonNode emp={r} />
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
                {others.map((e) => (
                  <div key={e.id} className="mt-3 border-t border-dashed border-border-strong pt-3">
                    <PersonNode emp={e} note={e.id === "EMP-013" ? t("org.dotted") : undefined} />
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
