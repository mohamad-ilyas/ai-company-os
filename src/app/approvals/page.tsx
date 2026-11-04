"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckCircle2, Lock, Plus, ShieldCheck, XCircle } from "lucide-react";
import { useCompany, useI18n, useRun } from "@/lib/store";
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, Field, Input, Notice, PageHeader, Select, Textarea } from "@/components/ui/primitives";
import { Dialog, useConfirm } from "@/components/ui/dialog";
import { Tabs } from "@/components/ui/tabs";
import { ActorChip, ApprovalBadge, LinksEditor, RefLink, RiskBadge, SampleBadge, cleanLinks } from "@/components/common";
import { can, createApproval, decideApproval } from "@/lib/domain";
import { APPROVAL_LEVEL, PROTECTED_ACTION_RISK } from "@/lib/workflow";
import { routes } from "@/lib/routes";
import { useDocumentTitle } from "@/components/shell/use-title";
import { PROTECTED_ACTIONS, type ActorId, type Approval, type LinkRef, type ProtectedAction, type RiskLevel } from "@/lib/types";

type Tab = "mine" | "coo" | "decided" | "all";

function NewApprovalDialog({ onClose }: { onClose: () => void }) {
  const s = useCompany();
  const { t, l } = useI18n();
  const run = useRun();
  const [f, setF] = useState({
    action: "production_deployment" as ProtectedAction,
    title: "",
    requestedBy: "EMP-001" as ActorId,
    reason: "",
    impact: "",
    risk: PROTECTED_ACTION_RISK.production_deployment as RiskLevel,
    projectId: "",
    taskId: "",
    files: [] as LinkRef[],
  });
  return (
    <Dialog
      open
      onClose={onClose}
      title={t("approvals.new")}
      size="lg"
      footer={
        <>
          <Button onClick={onClose}>{t("common.cancel")}</Button>
          <Button
            variant="primary"
            data-testid="submit-approval"
            onClick={() => {
              const r = run((st, ctx) =>
                createApproval(st, ctx, {
                  action: f.action,
                  title: f.title,
                  requestedBy: f.requestedBy,
                  reason: f.reason,
                  impact: f.impact,
                  risk: f.risk,
                  supportingFiles: cleanLinks(f.files),
                  projectId: f.projectId || null,
                  taskId: f.taskId || null,
                }),
              );
              if (r.ok) onClose();
            }}
          >
            {t("common.create")}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("approvals.action")}>
          {(id) => (
            <Select id={id} value={f.action} onChange={(e) => { const a = e.target.value as ProtectedAction; setF({ ...f, action: a, risk: PROTECTED_ACTION_RISK[a] }); }}>
              {PROTECTED_ACTIONS.map((a) => <option key={a} value={a}>{t(`protectedAction.${a}`)}</option>)}
            </Select>
          )}
        </Field>
        <Field label={t("approvals.requestedBy")}>
          {(id) => (
            <Select id={id} value={f.requestedBy} onChange={(e) => setF({ ...f, requestedBy: e.target.value as ActorId })}>
              {s.employees.map((e) => <option key={e.id} value={e.id}>{l(e.name)} — {l(e.title)}</option>)}
            </Select>
          )}
        </Field>
        <Field label={t("common.title")} required className="sm:col-span-2">{(id) => <Input id={id} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} data-testid="approval-title" />}</Field>
        <Field label={t("common.reason")} required>{(id) => <Textarea id={id} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} data-testid="approval-reason" />}</Field>
        <Field label={t("common.impact")}>{(id) => <Textarea id={id} value={f.impact} onChange={(e) => setF({ ...f, impact: e.target.value })} />}</Field>
        <Field label={t("common.risk")}>
          {(id) => (
            <Select id={id} value={f.risk} onChange={(e) => setF({ ...f, risk: e.target.value as RiskLevel })}>
              {(["low", "medium", "high", "critical"] as RiskLevel[]).map((r) => <option key={r} value={r}>{t(`riskLevel.${r}`)}</option>)}
            </Select>
          )}
        </Field>
        <Field label={t("common.project")}>
          {(id) => (
            <Select id={id} value={f.projectId} onChange={(e) => setF({ ...f, projectId: e.target.value, taskId: "" })}>
              <option value="">{t("common.none")}</option>
              {s.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          )}
        </Field>
        <div className="sm:col-span-2">
          <p className="mb-1.5 text-[13px] font-medium text-fg">{t("approvals.supportingFiles")}</p>
          <LinksEditor value={f.files} onChange={(files) => setF({ ...f, files })} />
        </div>
      </div>
    </Dialog>
  );
}

function ApprovalCard({ a }: { a: Approval }) {
  const s = useCompany();
  const { t, dateTime } = useI18n();
  const run = useRun();
  const confirm = useConfirm();
  const isCeo = can(s.settings.role, "decide_approvals");
  const project = a.projectId ? s.projects.find((p) => p.id === a.projectId) : undefined;
  const task = a.taskId ? s.tasks.find((x) => x.id === a.taskId) : undefined;

  const decide = async (decision: "approved" | "rejected") => {
    const r = await confirm({
      title: decision === "approved" ? t("approvals.approve") : t("approvals.reject"),
      body: decision === "approved" ? t("approvals.approveConfirm", { title: a.title, action: t(`protectedAction.${a.action}`) }) : t("approvals.rejectConfirm", { title: a.title }),
      confirmLabel: decision === "approved" ? t("approvals.approve") : t("approvals.reject"),
      cancelLabel: t("common.cancel"),
      danger: decision === "rejected",
      note: { label: t("approvals.decisionNote"), required: decision === "rejected", hint: t("approvals.decisionNoteHint") },
    });
    if (r.ok) run((st, ctx) => decideApproval(st, ctx, a.id, decision, r.note), t("common.saved"));
  };

  return (
    <Card data-testid={`approval-${a.id}`}>
      <CardBody className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
              <span className="tabular">{a.id}</span>
              <span>·</span>
              <span className="inline-flex items-center gap-1 font-medium text-warning"><ShieldCheck className="size-3.5" />{t(`protectedAction.${a.action}`)}</span>
              <SampleBadge show={a.sample} />
            </div>
            <h3 className="bidi mt-1 text-base font-semibold text-fg">{a.title}</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {a.urgent && a.status === "pending" && <Badge tone="danger" dot>{t("approvals.urgent")}</Badge>}
            <Badge tone={APPROVAL_LEVEL[a.action] === "ceo" ? "accent" : "neutral"}>{APPROVAL_LEVEL[a.action] === "ceo" ? t("approvals.levelCeo") : t("approvals.levelCoo")}</Badge>
            <RiskBadge risk={a.risk} />
            <ApprovalBadge status={a.status} />
          </div>
        </div>
        <dl className="grid gap-4 text-sm md:grid-cols-2">
          <div><dt className="text-xs font-medium uppercase tracking-wide text-muted">{t("common.reason")}</dt><dd dir="auto" className="mt-0.5 whitespace-pre-wrap text-start text-fg">{a.reason}</dd></div>
          <div><dt className="text-xs font-medium uppercase tracking-wide text-muted">{t("common.impact")}</dt><dd dir="auto" className="mt-0.5 whitespace-pre-wrap text-start text-fg">{a.impact || "—"}</dd></div>
          <div><dt className="text-xs font-medium uppercase tracking-wide text-muted">{t("approvals.requestedBy")}</dt><dd className="mt-1"><ActorChip actor={a.requestedBy} size={22} /></dd></div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted">{t("approvals.linked")}</dt>
            <dd className="mt-0.5 space-y-0.5 text-fg">
              {project && <Link className="block hover:underline" href={routes.project(project.id)}>{project.name}</Link>}
              {task && <Link className="block hover:underline" href={routes.task(task.id)}>{task.id} · {task.title}</Link>}
              {!project && !task && "—"}
            </dd>
          </div>
          {a.supportingFiles.length > 0 && (
            <div className="md:col-span-2">
              <dt className="text-xs font-medium uppercase tracking-wide text-muted">{t("approvals.supportingFiles")}</dt>
              <dd className="mt-0.5 space-y-0.5">{a.supportingFiles.map((f, i) => <div key={i}><RefLink link={f} /></div>)}</dd>
            </div>
          )}
        </dl>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-xs text-muted">
          <span>
            {t("common.created")}: {dateTime(a.createdAt)}
            {a.decidedAt && ` · ${t("approvals.decidedAt")}: ${dateTime(a.decidedAt)}`}
            {a.decidedBy && <> · {t("approvals.decidedBy")}: <ActorChip actor={a.decidedBy} size={16} /></>}
          </span>
          {a.status === "pending" ? (
            isCeo ? (
              <div className="flex w-full gap-2 sm:w-auto">
                <Button variant="danger" className="flex-1 sm:flex-none" onClick={() => decide("rejected")} data-testid={`reject-${a.id}`}><XCircle className="size-4" />{t("approvals.reject")}</Button>
                <Button variant="success" className="flex-1 sm:flex-none" onClick={() => decide("approved")} data-testid={`approve-${a.id}`}><CheckCircle2 className="size-4" />{t("approvals.approve")}</Button>
              </div>
            ) : (
              <span className="inline-flex items-center gap-1.5"><Lock className="size-3.5" />{t("approvals.onlyCeo")}</span>
            )
          ) : (
            a.decisionNote && <span className="text-fg-2">{t("approvals.decision")}: “{a.decisionNote}”</span>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

export default function ApprovalsPage() {
  const s = useCompany();
  const { t } = useI18n();
  useDocumentTitle(t("approvals.title"));
  const [tab, setTab] = useState<Tab>("mine");
  const [creating, setCreating] = useState(false);
  const pending = s.approvals.filter((a) => a.status === "pending");
  const mine = pending.filter((a) => APPROVAL_LEVEL[a.action] === "ceo").sort((a, b) => Number(!!b.urgent) - Number(!!a.urgent));
  const coo = pending.filter((a) => APPROVAL_LEVEL[a.action] === "coo");
  const decided = s.approvals.filter((a) => a.status !== "pending");
  const list = tab === "mine" ? mine : tab === "coo" ? coo : tab === "decided" ? decided : s.approvals;

  return (
    <>
      <PageHeader
        title={t("approvals.title")}
        subtitle={t("approvals.subtitle")}
        actions={
          can(s.settings.role, "write") && (
            <Button onClick={() => setCreating(true)} data-testid="new-approval">
              <Plus className="size-4" />
              {t("approvals.new")}
            </Button>
          )
        }
      />
      {!can(s.settings.role, "decide_approvals") && <Notice tone="warning" className="mb-6">{t("approvals.onlyCeo")}</Notice>}
      <Notice className="mb-6">{t("approvals.cooNote")}</Notice>
      <div className="grid gap-6 xl:grid-cols-[1fr_20rem]">
        <Tabs<Tab>
          value={tab}
          onChange={setTab}
          tabs={[
            { id: "mine", label: t("approvals.needsYou"), count: mine.length },
            { id: "coo", label: t("approvals.cooQueue"), count: coo.length },
            { id: "decided", label: t("approvals.decided"), count: decided.length },
            { id: "all", label: t("approvals.all"), count: s.approvals.length },
          ]}
        >
          {list.length === 0 ? <EmptyState icon={<ShieldCheck className="size-6" />} title={t("approvals.none")} /> : <div className="space-y-4">{list.map((a) => <ApprovalCard key={a.id} a={a} />)}</div>}
        </Tabs>
        <Card className="h-fit">
          <CardHeader title={t("approvals.protectedList")} />
          <CardBody>
            <ul className="space-y-2 text-[13px] text-fg">
              {PROTECTED_ACTIONS.map((a) => (
                <li key={a} className="flex items-center gap-2">
                  <Lock className="size-3.5 shrink-0 text-muted" aria-hidden />
                  <span className="flex-1">{t(`protectedAction.${a}`)}</span>
                  <span className="shrink-0 text-xs text-muted">{APPROVAL_LEVEL[a] === "ceo" ? t("approvals.levelCeo") : t("approvals.levelCoo")}</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>
      {creating && <NewApprovalDialog onClose={() => setCreating(false)} />}
    </>
  );
}
