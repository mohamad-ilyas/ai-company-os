"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, ArrowLeft, ArrowRightLeft, CheckCircle2, Download, FileUp, Play, RotateCcw, XCircle } from "lucide-react";
import { useCompany, useI18n, useRun } from "@/lib/store";
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, Field, Notice, Select, Textarea } from "@/components/ui/primitives";
import { Dialog, useConfirm } from "@/components/ui/dialog";
import { Markdown } from "@/components/ui/markdown";
import { ActorChip, CopyButton, ExecutionStatusBadge, RefLink, ReviewBadge, SampleBadge, downloadFile, useQueryParam } from "@/components/common";
import { can, cancelExecution, createFollowUp, importExecutionResult, markExecutionInSession, reviewExecution } from "@/lib/domain";
import { buildChatPrompt, buildPacket, claudeCodeCommand } from "@/lib/execution/packet";
import { parseExecutionResult } from "@/lib/execution/result-schema";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/cn";
import { useDocumentTitle } from "@/components/shell/use-title";
import type { EmployeeId, Execution } from "@/lib/types";

function Step({ title, done, active, children }: { title: string; done?: boolean; active?: boolean; children: ReactNode }) {
  return (
    <li className={cn("rounded-lg border p-4", active ? "border-accent/40 bg-accent-soft/40" : "border-border")}>
      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-fg">
        {done ? <CheckCircle2 className="size-4 text-success" aria-hidden /> : <span className={cn("size-2 rounded-full", active ? "bg-accent" : "bg-border-strong")} aria-hidden />}
        {title}
      </h3>
      <div className="space-y-2.5 text-[13px] text-fg-2">{children}</div>
    </li>
  );
}

function ImportPanel() {
  const { t } = useI18n();
  const run = useRun();
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [issues, setIssues] = useState<string[]>([]);

  const ingest = (raw: string) => {
    const parsed = parseExecutionResult(raw);
    if (!parsed.ok) {
      setIssues(parsed.issues.map((i) => (i === "not_json" ? t("errors.not_json") : i)));
      return;
    }
    setIssues([]);
    const r = run((s, ctx) => importExecutionResult(s, ctx, parsed.result), t("execution.imported"));
    if (r.ok) setText("");
  };

  return (
    <div className="space-y-2.5">
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json,.txt,.md"
        className="sr-only"
        data-testid="result-file"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f) ingest(await f.text());
          e.target.value = "";
        }}
      />
      <Button size="sm" onClick={() => fileRef.current?.click()}>
        <FileUp className="size-4" />
        {t("execution.importFile")}
      </Button>
      <label className="block">
        <span className="mb-1 block text-xs">{t("execution.importPaste")}</span>
        <Textarea dir="ltr" value={text} onChange={(e) => setText(e.target.value)} className="min-h-[100px] font-mono text-xs" data-testid="result-paste" />
      </label>
      <Button size="sm" variant="primary" disabled={!text.trim()} onClick={() => ingest(text)} data-testid="import-result">
        {t("execution.importButton")}
      </Button>
      {issues.length > 0 && (
        <Notice tone="danger" icon={<AlertTriangle className="size-4 text-danger" />}>
          <p className="font-medium">{t("execution.importIssues")}</p>
          <ul className="mt-1 list-disc ps-4 font-mono text-xs" dir="ltr" data-testid="import-issues">
            {issues.map((i) => <li key={i}>{i}</li>)}
          </ul>
        </Notice>
      )}
    </div>
  );
}

function FollowUpDialog({ exe, mode, onClose }: { exe: Execution; mode: "revision" | "handoff"; onClose: () => void }) {
  const s = useCompany();
  const { t, l } = useI18n();
  const run = useRun();
  const router = useRouter();
  const [to, setTo] = useState<EmployeeId>(mode === "revision" ? exe.employeeId : exe.handoffSuggestion?.to ?? exe.employeeId);
  const [instructions, setInstructions] = useState(
    mode === "revision"
      ? `Revise ${exe.id} based on this review:\n\n${exe.reviewNotes}`
      : `Continue from ${exe.id} (“${exe.title}”). Its approved output is attached as upstream context.\n\n${exe.handoffSuggestion?.note ?? ""}`.trim(),
  );
  return (
    <Dialog
      open
      onClose={onClose}
      title={mode === "revision" ? t("execution.createRevision") : t("execution.createHandoff")}
      footer={
        <>
          <Button onClick={onClose}>{t("common.cancel")}</Button>
          <Button
            variant="primary"
            data-testid="create-followup"
            onClick={() => {
              const r = run<string>((st, ctx) => createFollowUp(st, ctx, exe.id, { employeeId: to, instructions }));
              if (r.ok && r.value) {
                onClose();
                router.push(routes.executionView(r.value));
              }
            }}
          >
            {t("common.create")}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {mode === "handoff" && (
          <Field label={t("execution.employee")}>
            {(id) => (
              <Select id={id} value={to} onChange={(e) => setTo(e.target.value as EmployeeId)}>
                {s.employees.map((e) => <option key={e.id} value={e.id}>{l(e.name)} — {l(e.title)}</option>)}
              </Select>
            )}
          </Field>
        )}
        <Field label={t("execution.followUpInstructions")}>
          {(id) => <Textarea id={id} value={instructions} onChange={(e) => setInstructions(e.target.value)} className="min-h-[160px]" />}
        </Field>
      </div>
    </Dialog>
  );
}

function ExecutionView() {
  const s = useCompany();
  const { t, l, dateTime } = useI18n();
  const run = useRun();
  const confirm = useConfirm();
  const id = useQueryParam("id");
  const [followUp, setFollowUp] = useState<"revision" | "handoff" | null>(null);
  const exe = s.executions.find((e) => e.id === id);
  useDocumentTitle(exe ? `${exe.id} ${exe.title}` : t("execution.title"));
  if (!exe) return <EmptyState title={t("errors.not_found", { id: id ?? "—" })} action={<Link className="text-accent hover:underline" href={routes.execution}>{t("nav.execution")}</Link>} />;

  const writable = can(s.settings.role, "write");
  const emp = s.employees.find((e) => e.id === exe.employeeId)!;
  const task = exe.taskId ? s.tasks.find((x) => x.id === exe.taskId) : undefined;
  const project = exe.projectId ? s.projects.find((p) => p.id === exe.projectId) : undefined;
  const open = ["queued", "in_session", "needs_input"].includes(exe.status);
  const packet = buildPacket(s, exe);
  const children = s.executions.filter((e) => e.parentId === exe.id);
  const duration =
    exe.startedAt && exe.endedAt ? `${((Date.parse(exe.endedAt) - Date.parse(exe.startedAt)) / 3_600_000).toFixed(1)} h` : t("execution.notReported");

  return (
    <>
      <Link href={routes.execution} className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-fg-2 hover:text-fg">
        <ArrowLeft className="flip-rtl size-4" aria-hidden />
        {t("nav.execution")}
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="tabular text-sm text-muted">{exe.id}</span>
            <ExecutionStatusBadge status={exe.status} />
            <ReviewBadge status={exe.reviewStatus} />
            <Badge>{t(`channel.${exe.channel}`)}</Badge>
            <SampleBadge show={exe.sample} />
          </div>
          <h1 className="bidi mt-1.5 text-2xl font-semibold tracking-tight text-fg" data-testid="execution-title">{exe.title}</h1>
        </div>
        {writable && open && (
          <Button
            variant="ghost"
            onClick={async () => {
              const r = await confirm({ title: t("execution.cancel"), body: t("execution.cancelConfirm", { id: exe.id }), confirmLabel: t("common.confirm"), cancelLabel: t("common.close"), danger: true });
              if (r.ok) run((st, ctx) => cancelExecution(st, ctx, exe.id));
            }}
          >
            <XCircle className="size-4" />
            {t("execution.cancel")}
          </Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {exe.status === "in_session" && <Notice tone="info">{t("execution.startedNote")}</Notice>}

          {(open || exe.status === "cancelled") && writable && exe.status !== "cancelled" && (
            <Card>
              <CardBody>
                <ol className="space-y-3">
                  <Step title={t("execution.stepPacket")} active={exe.status === "queued"}>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant={exe.channel === "claude_code" ? "primary" : "secondary"} onClick={() => downloadFile(`${exe.id}.assignment.json`, JSON.stringify(packet, null, 2))} data-testid="download-packet">
                        <Download className="size-4" />
                        {t("execution.downloadPacket")}
                      </Button>
                      <CopyButton text={buildChatPrompt(packet)} label={t("execution.copyPrompt")} variant={exe.channel === "claude_chat" ? "primary" : "secondary"} testId="copy-prompt" />
                    </div>
                  </Step>
                  <Step title={t("execution.stepRun")} active={exe.status === "queued"}>
                    {exe.channel === "claude_code" ? (
                      <>
                        <p>{t("execution.runCode")}</p>
                        <div className="flex items-center gap-2">
                          <code dir="ltr" className="flex-1 overflow-x-auto whitespace-nowrap rounded-md bg-surface-2 px-3 py-2 font-mono text-xs text-fg" data-testid="run-command">
                            {claudeCodeCommand(exe.id)}
                          </code>
                          <CopyButton text={claudeCodeCommand(exe.id)} />
                        </div>
                      </>
                    ) : (
                      <p>{t("execution.runChat")}</p>
                    )}
                  </Step>
                  <Step title={t("execution.stepStart")} done={exe.status !== "queued"} active={exe.status === "queued"}>
                    {exe.status === "queued" ? (
                      <Button size="sm" onClick={() => run((st, ctx) => markExecutionInSession(st, ctx, exe.id))} data-testid="mark-started">
                        <Play className="size-4" />
                        {t("execution.markStarted")}
                      </Button>
                    ) : (
                      <p>{t("execution.startedNote")}</p>
                    )}
                  </Step>
                  <Step title={t("execution.stepImport")} active={exe.status !== "queued"}>
                    <ImportPanel />
                  </Step>
                </ol>
              </CardBody>
            </Card>
          )}

          {exe.reviewStatus === "pending" && writable && (
            <Card className="border-warning-mark/50">
              <CardHeader title={t("execution.stepReview")} />
              <CardBody className="flex flex-wrap gap-2">
                <Button variant="success" onClick={() => run((st, ctx) => reviewExecution(st, ctx, exe.id, "approved", ""), t("execution.approve"))} data-testid="approve-output">
                  <CheckCircle2 className="size-4" />
                  {t("execution.approve")}
                </Button>
                <Button
                  onClick={async () => {
                    const r = await confirm({
                      title: t("execution.requestChanges"),
                      confirmLabel: t("execution.requestChanges"),
                      cancelLabel: t("common.cancel"),
                      note: { label: t("execution.reviewNotes"), required: true, hint: t("execution.reviewNotesHint") },
                    });
                    if (r.ok) run((st, ctx) => reviewExecution(st, ctx, exe.id, "changes_requested", r.note));
                  }}
                  data-testid="request-changes"
                >
                  <RotateCcw className="size-4" />
                  {t("execution.requestChanges")}
                </Button>
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader title={t("execution.output")} actions={exe.output && <CopyButton text={exe.output} />} />
            <CardBody className="space-y-5">
              {exe.summary && (
                <div>
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{t("execution.summary")}</h3>
                  <p className="text-sm text-fg">{exe.summary}</p>
                </div>
              )}
              {exe.output ? <Markdown source={exe.output} /> : <p className="text-sm text-muted" data-testid="no-output">{t("execution.noOutput")}</p>}
              {exe.openQuestions.length > 0 && (
                <div>
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{t("execution.openQuestions")}</h3>
                  <ul className="list-disc space-y-1 ps-5 text-sm text-fg">{exe.openQuestions.map((q, i) => <li key={i}>{q}</li>)}</ul>
                </div>
              )}
              {exe.errors.length > 0 && (
                <Notice tone="danger">
                  <p className="font-medium">{t("execution.errors")}</p>
                  <ul className="mt-1 list-disc ps-4">{exe.errors.map((x, i) => <li key={i}>{x}</li>)}</ul>
                </Notice>
              )}
              {exe.reviewNotes && (
                <div>
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{t("execution.reviewNotes")}</h3>
                  <p className="whitespace-pre-wrap text-sm text-fg">{exe.reviewNotes}</p>
                </div>
              )}
            </CardBody>
          </Card>

          {writable && (exe.reviewStatus === "approved" || exe.reviewStatus === "changes_requested") && (
            <Card>
              <CardBody className="flex flex-wrap items-center gap-3">
                {exe.handoffSuggestion && (
                  <p className="flex-1 text-[13px] text-fg-2">
                    <span className="font-medium text-fg">{t("execution.handoff")}:</span> {l(s.employees.find((e) => e.id === exe.handoffSuggestion!.to)?.name ?? { en: exe.handoffSuggestion.to, ar: exe.handoffSuggestion.to })} — {exe.handoffSuggestion.note}
                  </p>
                )}
                {exe.reviewStatus === "changes_requested" && (
                  <Button onClick={() => setFollowUp("revision")} data-testid="create-revision">
                    <RotateCcw className="size-4" />
                    {t("execution.createRevision")}
                  </Button>
                )}
                {exe.reviewStatus === "approved" && (
                  <Button variant="primary" onClick={() => setFollowUp("handoff")} data-testid="create-handoff">
                    <ArrowRightLeft className="flip-rtl size-4" />
                    {t("execution.createHandoff")}
                  </Button>
                )}
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader title={t("execution.instructions")} />
            <CardBody className="space-y-3">
              <p className="whitespace-pre-wrap text-sm text-fg">{exe.instructions}</p>
              {exe.attachments.length > 0 && <ul className="space-y-1 text-sm">{exe.attachments.map((a, i) => <li key={i}><RefLink link={a} /></li>)}</ul>}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardBody className="space-y-4 text-sm">
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">{t("execution.employee")}</p>
                <ActorChip actor={emp.id} size={32} sub={l(emp.title)} />
              </div>
              {project && (
                <div>
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">{t("common.project")}</p>
                  <Link href={routes.project(project.id)} className="text-fg hover:underline">{project.name}</Link>
                </div>
              )}
              {task && (
                <div>
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">{t("common.task")}</p>
                  <Link href={routes.task(task.id)} className="text-fg hover:underline">{task.id} · {task.title}</Link>
                </div>
              )}
              {exe.parentId && (
                <div>
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">{t("execution.parent")}</p>
                  <Link href={routes.executionView(exe.parentId)} className="tabular text-accent hover:underline">{exe.parentId}</Link>
                </div>
              )}
              {children.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">{t("execution.handoff")}</p>
                  <ul>{children.map((c) => <li key={c.id}><Link href={routes.executionView(c.id)} className="tabular text-accent hover:underline">{c.id}</Link> · {c.title}</li>)}</ul>
                </div>
              )}
              <dl className="grid grid-cols-2 gap-3 border-t border-border pt-4">
                <div><dt className="text-xs text-muted">{t("common.created")}</dt><dd className="text-[13px] text-fg">{dateTime(exe.createdAt)}</dd></div>
                <div><dt className="text-xs text-muted">{t("execution.duration")}</dt><dd className="text-[13px] text-fg">{duration}</dd></div>
                <div><dt className="text-xs text-muted">{t("execution.startTime")}</dt><dd className="text-[13px] text-fg">{exe.startedAt ? dateTime(exe.startedAt) : t("execution.notReported")}</dd></div>
                <div><dt className="text-xs text-muted">{t("execution.endTime")}</dt><dd className="text-[13px] text-fg">{exe.endedAt ? dateTime(exe.endedAt) : t("execution.notReported")}</dd></div>
              </dl>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={t("execution.logs")} />
            <CardBody>
              <ol className="space-y-3 border-s border-border ps-4" data-testid="work-log">
                {exe.logs.map((g, i) => (
                  <li key={i} className="relative text-[13px]">
                    <span className="absolute -start-[21px] top-1.5 size-2 rounded-full bg-border-strong" aria-hidden />
                    <p className="text-fg">{g.message}</p>
                    <p className="text-xs text-muted">{dateTime(g.at)}</p>
                  </li>
                ))}
              </ol>
            </CardBody>
          </Card>
        </div>
      </div>
      {followUp && <FollowUpDialog exe={exe} mode={followUp} onClose={() => setFollowUp(null)} />}
    </>
  );
}

export default function Page() {
  return (
    <Suspense>
      <ExecutionView />
    </Suspense>
  );
}
