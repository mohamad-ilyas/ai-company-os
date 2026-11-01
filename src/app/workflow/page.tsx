"use client";

import { ArrowDown, ArrowRight, ShieldCheck } from "lucide-react";
import { useI18n } from "@/lib/store";
import { BulletList, Card, CardBody, CardHeader, PageHeader } from "@/components/ui/primitives";
import { ActorChip, ProjectStatusBadge, TaskStatusBadge } from "@/components/common";
import { LIFECYCLE, PROJECT_TRANSITIONS, TASK_TRANSITIONS } from "@/lib/workflow";
import { useDocumentTitle } from "@/components/shell/use-title";
import { PROJECT_STATUSES, TASK_STATUSES } from "@/lib/types";

export default function WorkflowPage() {
  const { t } = useI18n();
  useDocumentTitle(t("workflow.title"));
  return (
    <>
      <PageHeader title={t("workflow.title")} subtitle={t("workflow.subtitle")} />
      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <ol className="space-y-0" data-testid="lifecycle">
          {LIFECYCLE.map((stage, i) => (
            <li key={stage.stage}>
              <Card>
                <CardBody className="grid gap-4 md:grid-cols-[12rem_1fr]">
                  <div>
                    <p className="tabular text-xs font-semibold text-muted">{String(i + 1).padStart(2, "0")}</p>
                    <h2 className="mt-0.5 flex items-center gap-1.5 text-[15px] font-semibold text-fg">
                      {stage.stage === "ceo_approval" && <ShieldCheck className="size-4 text-warning" aria-hidden />}
                      {t(`stage.${stage.stage}`)}
                    </h2>
                    <div className="mt-1.5"><ProjectStatusBadge status={stage.projectStatus} /></div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">{t("workflow.owners")}</p>
                      <div className="flex flex-wrap gap-x-5 gap-y-2">
                        {stage.stage === "ceo_approval" ? <ActorChip actor="ceo" size={24} link={false} /> : stage.ownerIds.map((o) => <ActorChip key={o} actor={o} size={24} />)}
                      </div>
                    </div>
                    <div>
                      <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">{t("workflow.produces")}</p>
                      <BulletList items={stage.tasks.map((x) => `${x.title} — ${x.expectedOutput}`)} />
                    </div>
                  </div>
                </CardBody>
              </Card>
              {i < LIFECYCLE.length - 1 && (
                <div className="flex justify-center py-1.5 text-border-strong" aria-hidden>
                  <ArrowDown className="size-4" />
                </div>
              )}
            </li>
          ))}
        </ol>
        <div className="space-y-6">
          <Card>
            <CardHeader title={t("workflow.rules")} />
            <CardBody>
              <ol className="list-decimal space-y-2.5 ps-5 text-[13px] leading-relaxed text-fg">
                {(["rule1", "rule2", "rule3", "rule4", "rule5"] as const).map((r) => <li key={r}>{t(`workflow.${r}`)}</li>)}
              </ol>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={t("workflow.taskFlow")} />
            <CardBody className="space-y-2.5">
              {TASK_STATUSES.map((st) => (
                <div key={st} className="flex flex-wrap items-center gap-1.5">
                  <TaskStatusBadge status={st} />
                  {TASK_TRANSITIONS[st].length > 0 && <ArrowRight className="flip-rtl size-3 text-muted" aria-hidden />}
                  <span className="text-xs text-fg-2">{TASK_TRANSITIONS[st].map((x) => t(`taskStatus.${x}`)).join(" · ") || (st === "awaiting_ceo_approval" ? t("tasks.awaitingDecision") : "")}</span>
                </div>
              ))}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={t("workflow.projectFlow")} />
            <CardBody className="space-y-2.5">
              {PROJECT_STATUSES.map((st) => (
                <div key={st} className="flex flex-wrap items-center gap-1.5">
                  <ProjectStatusBadge status={st} />
                  {PROJECT_TRANSITIONS[st].length > 0 && <ArrowRight className="flip-rtl size-3 text-muted" aria-hidden />}
                  <span className="text-xs text-fg-2">{PROJECT_TRANSITIONS[st].map((x) => t(`projectStatus.${x}`)).join(" · ") || (st === "awaiting_ceo_approval" ? t("tasks.awaitingDecision") : "—")}</span>
                </div>
              ))}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
