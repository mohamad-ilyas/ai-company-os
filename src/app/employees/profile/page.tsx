"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { ArrowLeft, BookOpen, Download, ExternalLink, GraduationCap, Pencil, PlayCircle } from "lucide-react";
import { useCompany, useI18n, useRun } from "@/lib/store";
import { safeLink } from "@/lib/safe-url";
import { Badge, BulletList, Button, Card, CardBody, CardHeader, Chips, EmptyState, Notice, Select, Textarea, tableClass } from "@/components/ui/primitives";
import { Dialog } from "@/components/ui/dialog";
import { Tabs } from "@/components/ui/tabs";
import {
  ActivityList,
  ActorChip,
  Avatar,
  CopyButton,
  ExecutionStatusBadge,
  ReviewBadge,
  SampleBadge,
  SLOT_COLOR,
  TaskStatusBadge,
  WorkStateBadge,
  downloadFile,
  LinkButton,
  useQueryParam,
} from "@/components/common";
import { setAvailability, updateInstructions, can } from "@/lib/domain";
import { employeeStats } from "@/lib/metrics";
import { agentFile } from "@/lib/agent-file";
import { routes } from "@/lib/routes";
import { useDocumentTitle } from "@/components/shell/use-title";
import type { Availability, Employee } from "@/lib/types";

type Tab = "profile" | "learning" | "instructions" | "work" | "performance" | "activity";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{title}</h3>
      {children}
    </div>
  );
}

function ProfileTab({ e }: { e: Employee }) {
  const { t, l } = useI18n();
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardBody className="space-y-6">
          <Section title={t("employees.bio")}>
            <p className="text-sm leading-relaxed text-fg">{l(e.bio)}</p>
            <p className="mt-2 text-xs text-muted">{e.experiencePositioning}</p>
          </Section>
          <div className="grid gap-6 md:grid-cols-2">
            <Section title={t("employees.responsibilities")}><BulletList items={e.responsibilities} /></Section>
            <Section title={t("employees.authority")}><BulletList items={e.authority} /></Section>
            <Section title={t("employees.accepts")}><BulletList items={e.accepts} /></Section>
            <Section title={t("employees.rejects")}><BulletList items={e.rejectsOrEscalates} /></Section>
            <Section title={t("employees.requiredInputs")}><BulletList items={e.requiredInputs} /></Section>
            <Section title={t("employees.deliverables")}><BulletList items={e.deliverables} /></Section>
            <Section title={t("employees.qualityStandards")}><BulletList items={e.qualityStandards} /></Section>
            <Section title={t("employees.checklist")}><BulletList items={e.qualityChecklist} /></Section>
            <Section title={t("employees.methodology")}>
              <ol className="list-decimal space-y-1 ps-5 text-sm text-fg">
                {e.methodology.map((m) => <li key={m}>{m}</li>)}
              </ol>
            </Section>
            <Section title={t("employees.kpis")}><BulletList items={e.kpis} /></Section>
          </div>
          <Section title={t("employees.communicationStyle")}><p className="text-sm text-fg">{e.communicationStyle}</p></Section>
          <Section title={t("employees.outputFormat")}><p className="text-sm text-fg">{e.outputFormat}</p></Section>
        </CardBody>
      </Card>
      <div className="space-y-6">
        <Card>
          <CardBody className="space-y-5">
            <Section title={t("employees.coreExpertise")}><Chips items={e.coreExpertise} /></Section>
            <Section title={t("employees.technicalSkills")}><Chips items={e.technicalSkills} /></Section>
            <Section title={t("employees.secondarySkills")}><Chips items={e.secondarySkills} /></Section>
            <Section title={t("employees.tools")}><BulletList items={e.tools} /></Section>
            <Section title={t("employees.restricted")}><BulletList items={e.restrictedActions} /></Section>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="space-y-4">
            <Section title={t("common.reportsTo")}>
              {e.reportsTo === "ceo" ? <ActorChip actor="ceo" link={false} /> : <ActorChip actor={e.reportsTo} />}
            </Section>
            <Section title={t("employees.collaborators")}>
              <ul className="space-y-2">
                {e.collaborators.map((c) => (
                  <li key={c}><ActorChip actor={c} /></li>
                ))}
              </ul>
            </Section>
          </CardBody>
        </Card>
      </div>
      <p className="sr-only">{l(e.title)}</p>
    </div>
  );
}

function LearningTab({ e }: { e: Employee }) {
  const s = useCompany();
  const { t, date } = useI18n();
  const notes = s.knowledge
    .filter((k) => k.category === "learning" && (k.tags.includes(e.slug) || (k.extKey ?? "").includes(`/${e.slug}`)))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const playbookUrl = `https://github.com/mohamad-ilyas/agency-projects/blob/main/playbooks/${e.slug}.md`;
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader title={<span className="flex items-center gap-2"><GraduationCap className="size-4 text-accent" />{t("employees.learningResources")}</span>} />
        <CardBody>
          {e.learning?.resources.length ? (
            <ul className="grid gap-2 sm:grid-cols-2" data-testid="learning-resources">
              {e.learning.resources.filter((r) => safeLink(r.url)?.kind === "external").map((r) => (
                <li key={r.url}>
                  <a href={r.url} target="_blank" rel="noopener noreferrer" className="flex items-start gap-2 rounded-lg border border-border px-3 py-2 text-[13px] text-fg transition-colors hover:border-border-strong hover:bg-surface-2">
                    <ExternalLink className="mt-0.5 size-3.5 shrink-0 text-muted" aria-hidden />
                    <span className="min-w-0">
                      <span className="block">{r.label}</span>
                      <span dir="ltr" className="block truncate text-xs text-muted">{r.url.replace(/^https?:\/\//, "")}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">—</p>
          )}
        </CardBody>
      </Card>
      <div className="space-y-6">
        <Card>
          <CardHeader title={t("employees.learningFocus")} />
          <CardBody>
            <BulletList items={e.learning?.focus ?? []} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={<span className="flex items-center gap-2"><BookOpen className="size-4 text-muted" />{t("employees.playbook")}</span>} />
          <CardBody className="space-y-3">
            <p className="text-[13px] text-fg-2">{t("employees.playbookHint")}</p>
            <a href={playbookUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[13px] text-accent hover:underline">
              {t("employees.openPlaybook")}
              <ExternalLink className="size-3" aria-hidden />
            </a>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t("employees.learningNotes")} />
          <CardBody>
            {notes.length === 0 ? (
              <p className="text-sm text-muted">{t("employees.noLearningNotes")}</p>
            ) : (
              <ul className="space-y-2 text-[13px]">
                {notes.map((k) => (
                  <li key={k.id}>
                    <Link href={routes.article(k.id)} className="bidi block text-fg hover:underline">{k.title}</Link>
                    <span className="text-xs text-muted">{date(k.updatedAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function InstructionsTab({ e }: { e: Employee }) {
  const s = useCompany();
  const { t } = useI18n();
  const run = useRun();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(e.systemInstructions);
  const editable = can(s.settings.role, "edit_instructions");
  return (
    <Card>
      <CardHeader
        title={t("employees.systemInstructions")}
        actions={
          <>
            <CopyButton text={e.systemInstructions} />
            <Button size="sm" onClick={() => downloadFile(`${e.slug}.md`, agentFile(e), "text/markdown")}>
              <Download className="size-4" />
              {t("employees.downloadAgent")}
            </Button>
            {editable && (
              <Button size="sm" variant="primary" onClick={() => { setDraft(e.systemInstructions); setEditing(true); }} data-testid="edit-instructions">
                <Pencil className="size-4" />
                {t("employees.editInstructions")}
              </Button>
            )}
          </>
        }
      />
      <CardBody className="space-y-4">
        <Notice>{t("employees.agentFileNote", { slug: e.slug })}</Notice>
        <pre dir="ltr" className="whitespace-pre-wrap rounded-lg border border-border bg-surface-2 p-4 font-mono text-[12.5px] leading-relaxed text-fg" data-testid="instructions-text">
          {e.systemInstructions}
        </pre>
      </CardBody>
      <Dialog
        open={editing}
        onClose={() => setEditing(false)}
        title={t("employees.editInstructions")}
        size="lg"
        footer={
          <>
            <Button onClick={() => setEditing(false)}>{t("common.cancel")}</Button>
            <Button
              variant="primary"
              data-testid="save-instructions"
              onClick={() => {
                const r = run((st, ctx) => updateInstructions(st, ctx, e.id, draft), t("employees.instructionsSaved"));
                if (r.ok) setEditing(false);
              }}
            >
              {t("common.save")}
            </Button>
          </>
        }
      >
        <Textarea dir="ltr" value={draft} onChange={(ev) => setDraft(ev.target.value)} className="min-h-[50vh] font-mono text-[12.5px]" aria-label={t("employees.systemInstructions")} />
      </Dialog>
    </Card>
  );
}

function WorkTab({ e }: { e: Employee }) {
  const s = useCompany();
  const { t, dateTime } = useI18n();
  const tasks = s.tasks.filter((x) => x.assigneeId === e.id);
  const projects = s.projects.filter((p) => p.memberIds.includes(e.id) || p.managerId === e.id);
  const exes = s.executions.filter((x) => x.employeeId === e.id);
  const deliverables = s.deliverables.filter((d) => d.ownerId === e.id);
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title={t("employees.assignedProjects")} />
        <CardBody>
          {projects.length === 0 ? <p className="text-sm text-muted">{t("employees.noWork")}</p> : (
            <ul className="flex flex-wrap gap-2">
              {projects.map((p) => (
                <li key={p.id}>
                  <Link href={routes.project(p.id)} className="inline-flex items-center gap-2 rounded-md border border-border px-2.5 py-1 text-[13px] hover:bg-surface-2">
                    {p.name} <SampleBadge show={p.sample} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
      <Card>
        <CardHeader title={t("employees.tasks")} />
        {tasks.length === 0 ? <CardBody><p className="text-sm text-muted">{t("employees.noWork")}</p></CardBody> : (
          <div className={tableClass.wrap}>
            <table className={tableClass.table}>
              <tbody>
                {tasks.map((x) => (
                  <tr key={x.id} className={tableClass.tr}>
                    <td className={`${tableClass.td} tabular w-24 text-muted`}>{x.id}</td>
                    <td className={tableClass.td}><Link href={routes.task(x.id)} className="hover:underline">{x.title}</Link> <SampleBadge show={x.sample} /></td>
                    <td className={tableClass.td}><TaskStatusBadge status={x.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Card>
        <CardHeader title={t("employees.executions")} />
        {exes.length === 0 ? <CardBody><p className="text-sm text-muted">{t("employees.noWork")}</p></CardBody> : (
          <div className={tableClass.wrap}>
            <table className={tableClass.table}>
              <tbody>
                {exes.map((x) => (
                  <tr key={x.id} className={tableClass.tr}>
                    <td className={`${tableClass.td} tabular w-24 text-muted`}>{x.id}</td>
                    <td className={tableClass.td}><Link href={routes.executionView(x.id)} className="hover:underline">{x.title}</Link> <SampleBadge show={x.sample} /></td>
                    <td className={tableClass.td}><ExecutionStatusBadge status={x.status} /></td>
                    <td className={tableClass.td}><ReviewBadge status={x.reviewStatus} /></td>
                    <td className={`${tableClass.td} text-xs text-muted`}>{dateTime(x.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Card>
        <CardHeader title={t("projects.deliverables")} />
        <CardBody>
          {deliverables.length === 0 ? <p className="text-sm text-muted">{t("employees.noWork")}</p> : (
            <ul className="space-y-2 text-sm">
              {deliverables.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center gap-2">
                  <span className="tabular text-muted">{d.id}</span>
                  <span className="text-fg">{d.title}</span>
                  <Badge>{t(`deliverableType.${d.type}`)}</Badge>
                  <SampleBadge show={d.sample} />
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function PerformanceTab({ e }: { e: Employee }) {
  const s = useCompany();
  const { t } = useI18n();
  const st = employeeStats(s, e.id, s.settings.includeSampleInAnalytics);
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");
  const tiles = [
    { k: t("employees.statsAssigned"), v: String(st.assigned) },
    { k: t("employees.statsCompleted"), v: String(st.completed) },
    { k: t("employees.statsOnTime"), v: st.withDue ? `${pct(st.onTime, st.withDue)} (${st.onTime}/${st.withDue})` : "—" },
    { k: t("employees.statsPassRate"), v: st.reviewed ? `${pct(st.approvedFirstTime, st.reviewed)}` : "—" },
    { k: t("employees.statsChanges"), v: String(st.changesRequested) },
    { k: t("employees.statsDuration"), v: st.avgDurationHours === null ? "—" : t("employees.hours", { n: st.avgDurationHours.toFixed(1) }) },
  ];
  return (
    <Card>
      <CardHeader title={t("employees.performance")} description={t("employees.performanceNote")} />
      <CardBody>
        <dl className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {tiles.map((x) => (
            <div key={x.k} className="rounded-lg bg-surface-2 px-4 py-3">
              <dt className="text-xs text-muted">{x.k}</dt>
              <dd className="tabular mt-1 text-xl font-semibold text-fg">{x.v}</dd>
            </div>
          ))}
        </dl>
        {st.assigned === 0 && st.executions === 0 && <p className="mt-4 text-sm text-muted">{t("common.notEnoughData")}</p>}
        <div className="mt-5">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{t("employees.kpis")}</h3>
          <BulletList items={e.kpis} />
        </div>
      </CardBody>
    </Card>
  );
}

function EmployeeProfile() {
  const s = useCompany();
  const { t, l } = useI18n();
  const run = useRun();
  const id = useQueryParam("id");
  const [tab, setTab] = useState<Tab>("profile");
  const e = s.employees.find((x) => x.id === id);
  useDocumentTitle(e ? l(e.name) : t("employees.title"));

  if (!e) {
    return <EmptyState title={t("errors.not_found", { id: id ?? "—" })} action={<Link className="text-accent hover:underline" href={routes.employees}>{t("nav.employees")}</Link>} />;
  }
  const dept = s.departments.find((d) => d.id === e.departmentId)!;
  const writable = can(s.settings.role, "write");
  const activity = s.activity.filter((a) => a.actor === e.id || a.params.employee === e.id || a.refId === e.id);

  return (
    <>
      <Link href={routes.employees} className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-fg-2 hover:text-fg">
        <ArrowLeft className="flip-rtl size-4" aria-hidden />
        {t("nav.employees")}
      </Link>
      <Card className="mb-6">
        <CardBody className="flex flex-wrap items-start gap-5">
          <Avatar actor={e.id} size={64} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-fg" data-testid="employee-name">{l(e.name)}</h1>
              <Badge tone="accent">{t("common.aiEmployee")}</Badge>
              <Badge>{e.id}</Badge>
            </div>
            <p className="mt-1 text-fg-2">{l(e.title)}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px]">
              <Link href={routes.department(dept.id)} className="inline-flex items-center gap-1.5 text-fg-2 hover:underline">
                <span className="size-2 rounded-sm" style={{ background: SLOT_COLOR[dept.colorSlot] }} aria-hidden />
                {l(dept.name)}
              </Link>
              <span className="text-border-strong">·</span>
              <span className="text-fg-2">{e.seniority}</span>
              <span className="text-border-strong">·</span>
              <WorkStateBadge employee={e} />
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-[13px]">
              <span className="mb-1 block text-xs text-muted">{t("employees.availability")}</span>
              <Select
                value={e.availability}
                disabled={!writable}
                onChange={(ev) => run((st, ctx) => setAvailability(st, ctx, e.id, ev.target.value as Availability))}
                className="w-40"
                data-testid="availability"
              >
                {(["available", "busy", "unavailable"] as Availability[]).map((a) => (
                  <option key={a} value={a}>{t(`availability.${a}`)}</option>
                ))}
              </Select>
            </label>
            {writable && (
              <LinkButton href={routes.executionNew({ employee: e.id })} variant="primary" testId="assign-work">
                <PlayCircle className="size-4" />
                {t("employees.assignTask")}
              </LinkButton>
            )}
          </div>
        </CardBody>
      </Card>

      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "profile", label: t("employees.profile") },
          { id: "learning", label: t("employees.learning") },
          { id: "instructions", label: t("employees.instructions") },
          { id: "work", label: t("employees.work"), count: s.tasks.filter((x) => x.assigneeId === e.id).length },
          { id: "performance", label: t("employees.performance") },
          { id: "activity", label: t("employees.activity") },
        ]}
      >
        {tab === "profile" && <ProfileTab e={e} />}
        {tab === "learning" && <LearningTab e={e} />}
        {tab === "instructions" && <InstructionsTab e={e} />}
        {tab === "work" && <WorkTab e={e} />}
        {tab === "performance" && <PerformanceTab e={e} />}
        {tab === "activity" && (
          <Card>
            <CardBody className="py-1">
              <ActivityList events={activity} />
            </CardBody>
          </Card>
        )}
      </Tabs>
    </>
  );
}

export default function Page() {
  return (
    <Suspense>
      <EmployeeProfile />
    </Suspense>
  );
}
