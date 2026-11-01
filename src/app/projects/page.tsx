"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { useCompany, useI18n } from "@/lib/store";
import { Button, Card, CardBody, EmptyState, Input, PageHeader, Select } from "@/components/ui/primitives";
import { Meter } from "@/components/ui/charts";
import { ActorChip, PriorityBadge, ProjectStatusBadge, SampleBadge } from "@/components/common";
import { ProjectFormDialog } from "@/components/project-form";
import { projectProgress } from "@/lib/metrics";
import { can } from "@/lib/domain";
import { routes } from "@/lib/routes";
import { useDocumentTitle } from "@/components/shell/use-title";
import { PROJECT_STATUSES, type ProjectStatus } from "@/lib/types";

export default function ProjectsPage() {
  const s = useCompany();
  const { t, date } = useI18n();
  const router = useRouter();
  useDocumentTitle(t("projects.title"));
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<ProjectStatus | "">("");
  const [creating, setCreating] = useState(false);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return s.projects.filter((p) => (!status || p.status === status) && (!needle || `${p.name} ${p.client} ${p.id}`.toLowerCase().includes(needle)));
  }, [s.projects, q, status]);

  return (
    <>
      <PageHeader
        title={t("projects.title")}
        subtitle={t("projects.subtitle")}
        actions={
          can(s.settings.role, "write") && (
            <Button variant="primary" onClick={() => setCreating(true)} data-testid="new-project">
              <Plus className="size-4" />
              {t("projects.new")}
            </Button>
          )
        }
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_16rem]">
        <div className="relative">
          <Search className="pointer-events-none absolute start-3 top-2.5 size-4 text-muted" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("common.search")} aria-label={t("common.search")} className="ps-9" />
        </div>
        <Select value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus | "")} aria-label={t("projects.statusFilter")}>
          <option value="">{t("projects.statusFilter")}: {t("common.all")}</option>
          {PROJECT_STATUSES.map((x) => <option key={x} value={x}>{t(`projectStatus.${x}`)}</option>)}
        </Select>
      </div>

      {rows.length === 0 ? (
        <EmptyState title={s.projects.length ? t("common.noResults") : t("projects.noProjects")} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" data-testid="project-list">
          {rows.map((p) => {
            const pct = projectProgress(s, p);
            const taskCount = s.tasks.filter((x) => x.projectId === p.id).length;
            return (
              <Card key={p.id} className="flex flex-col transition-colors hover:border-border-strong">
                <CardBody className="flex flex-1 flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="tabular text-xs text-muted">{p.id}</span>
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <SampleBadge show={p.sample} />
                      <PriorityBadge priority={p.priority} />
                    </div>
                  </div>
                  <div>
                    <Link href={routes.project(p.id)} className="bidi block text-[15px] font-semibold text-fg hover:underline">{p.name}</Link>
                    <p className="mt-0.5 text-[13px] text-fg-2">{p.client}</p>
                  </div>
                  <ProjectStatusBadge status={p.status} />
                  <div className="mt-auto space-y-2 pt-2">
                    <div className="flex justify-between text-xs text-muted">
                      <span>{t("common.progress")} · {taskCount} {t("nav.tasks").toLowerCase()}</span>
                      <span className="tabular font-medium text-fg">{pct === null ? "—" : `${pct}%`}</span>
                    </div>
                    <Meter value={pct} label={`${p.name} ${t("common.progress")}`} />
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <ActorChip actor={p.managerId} size={22} />
                      <span className="text-xs text-muted">{date(p.targetDate)}</span>
                    </div>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
      {creating && <ProjectFormDialog open onClose={() => setCreating(false)} onSaved={(id) => router.push(routes.project(id))} />}
    </>
  );
}
