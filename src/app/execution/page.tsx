"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { FileInput, Info, Plus } from "lucide-react";
import { useCompany, useI18n } from "@/lib/store";
import { ImportReportDialog } from "@/components/agent-channel";
import { Button, Card, EmptyState, Notice, PageHeader, Select, tableClass } from "@/components/ui/primitives";
import { StatTile } from "@/components/ui/charts";
import { ActorChip, ExecutionStatusBadge, LinkButton, ReviewBadge, SampleBadge } from "@/components/common";
import { can } from "@/lib/domain";
import { routes } from "@/lib/routes";
import { useDocumentTitle } from "@/components/shell/use-title";
import { EXECUTION_STATUSES, type EmployeeId, type ExecutionStatus } from "@/lib/types";

export default function ExecutionCenterPage() {
  const s = useCompany();
  const { t, l, dateTime } = useI18n();
  useDocumentTitle(t("execution.title"));
  const [status, setStatus] = useState<ExecutionStatus | "">("");
  const [employee, setEmployee] = useState<EmployeeId | "">("");
  const [importing, setImporting] = useState(false);
  const rows = useMemo(
    () => s.executions.filter((e) => (!status || e.status === status) && (!employee || e.employeeId === employee)),
    [s.executions, status, employee],
  );
  const real = s.executions.filter((e) => !e.sample);

  return (
    <>
      <PageHeader
        title={t("execution.title")}
        subtitle={t("execution.subtitle")}
        actions={
          can(s.settings.role, "write") && (
            <>
              <Button onClick={() => setImporting(true)} data-testid="import-report">
                <FileInput className="size-4" />
                {t("agent.importTitle")}
              </Button>
              <LinkButton href={routes.executionNew()} variant="primary" testId="new-assignment">
                <Plus className="size-4" />
                {t("execution.new")}
              </LinkButton>
            </>
          )
        }
      />
      <Notice icon={<Info className="size-4 text-accent" />} className="mb-6">
        <strong className="font-semibold">{t("execution.how")}.</strong> {t("execution.howBody")}{" "}
        <Link href={routes.article("KB-004")} className="text-accent-text underline underline-offset-2">{t("execution.howToRun")} <span className="flip-rtl inline-block" aria-hidden>→</span></Link>
      </Notice>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label={t("execution.statusQueued")} value={real.filter((e) => e.status === "queued").length} />
        <StatTile label={t("execution.statusInSession")} value={real.filter((e) => e.status === "in_session").length} />
        <StatTile label={t("execution.statusReview")} value={real.filter((e) => e.reviewStatus === "pending").length} />
        <StatTile label={t("execution.statusDone")} value={real.filter((e) => e.reviewStatus === "approved").length} />
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
          <h2 className="text-[15px] font-semibold text-fg">{t("execution.records")}</h2>
          <div className="flex flex-wrap gap-2">
            <Select value={employee} onChange={(e) => setEmployee(e.target.value as EmployeeId | "")} aria-label={t("common.employee")} className="w-52">
              <option value="">{t("common.employee")}: {t("common.all")}</option>
              {s.employees.map((e) => <option key={e.id} value={e.id}>{l(e.name)}</option>)}
            </Select>
            <Select value={status} onChange={(e) => setStatus(e.target.value as ExecutionStatus | "")} aria-label={t("common.status")} className="w-56">
              <option value="">{t("common.status")}: {t("common.all")}</option>
              {EXECUTION_STATUSES.map((x) => <option key={x} value={x}>{t(`executionStatus.${x}`)}</option>)}
            </Select>
          </div>
        </div>
        {rows.length === 0 ? (
          <div className="p-5"><EmptyState title={t("execution.noRecords")} /></div>
        ) : (
          <div className={tableClass.wrap}>
            <table className={tableClass.table} data-testid="execution-table">
              <thead>
                <tr>
                  <th className={tableClass.th}>{t("common.id")}</th>
                  <th className={tableClass.th}>{t("common.title")}</th>
                  <th className={tableClass.th}>{t("common.employee")}</th>
                  <th className={tableClass.th}>{t("common.status")}</th>
                  <th className={tableClass.th}>{t("execution.review")}</th>
                  <th className={tableClass.th}>{t("common.created")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e.id} className={tableClass.tr}>
                    <td className={`${tableClass.td} tabular text-muted`}>{e.id}</td>
                    <td className={tableClass.td}>
                      <Link href={routes.executionView(e.id)} className="hover:underline">{e.title}</Link> <SampleBadge show={e.sample} />
                      <p className="text-xs text-muted">{t(`channel.${e.channel}`)}</p>
                    </td>
                    <td className={tableClass.td}><ActorChip actor={e.employeeId} size={24} /></td>
                    <td className={tableClass.td}><ExecutionStatusBadge status={e.status} /></td>
                    <td className={tableClass.td}><ReviewBadge status={e.reviewStatus} /></td>
                    <td className={`${tableClass.td} text-xs text-muted`}>{dateTime(e.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <ImportReportDialog open={importing} onClose={() => setImporting(false)} />
    </>
  );
}
