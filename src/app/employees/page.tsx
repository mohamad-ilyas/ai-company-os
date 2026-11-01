"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useCompany, useI18n } from "@/lib/store";
import { Card, EmptyState, Input, PageHeader, Select, tableClass } from "@/components/ui/primitives";
import { ActorChip, Avatar, SLOT_COLOR, WorkStateBadge } from "@/components/common";
import { currentAssignment, employeeWorkState, type WorkState } from "@/lib/metrics";
import { routes } from "@/lib/routes";
import { useDocumentTitle } from "@/components/shell/use-title";
import type { DepartmentId } from "@/lib/types";

export default function EmployeesPage() {
  const s = useCompany();
  const { t, l } = useI18n();
  useDocumentTitle(t("employees.title"));
  const [q, setQ] = useState("");
  const [dept, setDept] = useState<DepartmentId | "">("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState<WorkState | "">("");

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return s.employees.filter((e) => {
      if (dept && e.departmentId !== dept) return false;
      if (role && e.id !== role) return false;
      if (status && employeeWorkState(s, e) !== status) return false;
      if (!needle) return true;
      const hay = [e.name.en, e.name.ar, e.title.en, e.title.ar, ...e.coreExpertise, ...e.technicalSkills].join(" ").toLowerCase();
      return hay.includes(needle);
    });
  }, [s, q, dept, role, status]);

  return (
    <>
      <PageHeader title={t("employees.title")} subtitle={t("employees.subtitle")} />
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative">
          <Search className="pointer-events-none absolute start-3 top-2.5 size-4 text-muted" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("employees.search")} aria-label={t("employees.search")} className="ps-9" data-testid="employee-search" />
        </div>
        <Select value={dept} onChange={(e) => setDept(e.target.value as DepartmentId | "")} aria-label={t("common.department")}>
          <option value="">{t("common.department")}: {t("common.all")}</option>
          {s.departments.map((d) => (
            <option key={d.id} value={d.id}>
              {l(d.name)}
            </option>
          ))}
        </Select>
        <Select value={role} onChange={(e) => setRole(e.target.value)} aria-label={t("common.title")}>
          <option value="">{t("common.title")}: {t("common.all")}</option>
          {s.employees.map((e) => (
            <option key={e.id} value={e.id}>
              {l(e.title)}
            </option>
          ))}
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value as WorkState | "")} aria-label={t("common.status")}>
          <option value="">{t("common.status")}: {t("common.all")}</option>
          {(["idle", "queued", "in_session", "awaiting_review", "unavailable"] as WorkState[]).map((w) => (
            <option key={w} value={w}>
              {t(`workState.${w}`)}
            </option>
          ))}
        </Select>
      </div>

      {rows.length === 0 ? (
        <EmptyState title={t("common.noResults")} />
      ) : (
        <>
          {/* Cards on small screens */}
          <div className="grid gap-3 md:hidden">
            {rows.map((e) => {
              const task = currentAssignment(s, e.id);
              return (
                <Link key={e.id} href={routes.employee(e.id)} className="rounded-xl border border-border bg-surface p-4 shadow-card">
                  <div className="flex items-center gap-3">
                    <Avatar actor={e.id} size={40} />
                    <div className="min-w-0">
                      <p className="font-semibold text-fg">{l(e.name)}</p>
                      <p className="text-[13px] text-fg-2">{l(e.title)}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <WorkStateBadge employee={e} />
                  </div>
                  <p className="mt-2 truncate text-xs text-muted">
                    {t("employees.currentAssignment")}: {task ? `${task.id} · ${task.title}` : t("employees.noAssignment")}
                  </p>
                </Link>
              );
            })}
          </div>

          <Card className="hidden md:block">
            <div className={tableClass.wrap}>
              <table className={tableClass.table} data-testid="employee-table">
                <thead>
                  <tr>
                    <th className={tableClass.th}>{t("common.employee")}</th>
                    <th className={tableClass.th}>{t("common.department")}</th>
                    <th className={tableClass.th}>{t("employees.seniority")}</th>
                    <th className={tableClass.th}>{t("common.status")}</th>
                    <th className={tableClass.th}>{t("employees.currentAssignment")}</th>
                    <th className={tableClass.th}>{t("common.reportsTo")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((e) => {
                    const d = s.departments.find((x) => x.id === e.departmentId)!;
                    const task = currentAssignment(s, e.id);
                    return (
                      <tr key={e.id} className={tableClass.tr}>
                        <td className={tableClass.td}>
                          <ActorChip actor={e.id} size={34} sub={l(e.title)} />
                        </td>
                        <td className={tableClass.td}>
                          <span className="inline-flex items-center gap-2 text-fg-2">
                            <span className="size-2 rounded-sm" style={{ background: SLOT_COLOR[d.colorSlot] }} aria-hidden />
                            {l(d.name)}
                          </span>
                        </td>
                        <td className={tableClass.td}>{e.seniority}</td>
                        <td className={tableClass.td}>
                          <WorkStateBadge employee={e} />
                        </td>
                        <td className={`${tableClass.td} max-w-[16rem]`}>
                          {task ? (
                            <Link href={routes.task(task.id)} className="block truncate text-[13px] text-fg hover:underline">
                              {task.id} · {task.title}
                            </Link>
                          ) : (
                            <span className="text-[13px] text-muted">{t("employees.noAssignment")}</span>
                          )}
                        </td>
                        <td className={tableClass.td}>
                          {e.reportsTo === "ceo" ? <span className="text-[13px] text-fg-2">{t("common.ceo")}</span> : <ActorChip actor={e.reportsTo} size={22} />}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </>
  );
}
