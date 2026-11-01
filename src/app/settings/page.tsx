"use client";

import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";
import { Download, Lock, RotateCcw, Trash2, Upload } from "lucide-react";
import { BACKUP_KEY, LAST_EXPORT_KEY, STORAGE_KEY, replaceState, restoreBackup, useCompany, useI18n, useRun } from "@/lib/store";
import { Button, Card, CardBody, CardHeader, Checkbox, Field, Input, Notice, PageHeader, Select } from "@/components/ui/primitives";
import { useConfirm } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { ActorChip, downloadFile } from "@/components/common";
import { CloudSection } from "@/components/cloud-section";
import { AgentChannel } from "@/components/agent-channel";
import { can, clearSampleData, setAvailability, setDepartmentManager, setRole, updateSettings } from "@/lib/domain";
import { parseCompanyState } from "@/lib/state-schema";
import { createSeed } from "@/data/seed";
import { routes } from "@/lib/routes";
import { useDocumentTitle } from "@/components/shell/use-title";
import { PRIORITIES, PROTECTED_ACTIONS, type Availability, type EmployeeId, type Priority, type Role, type Settings } from "@/lib/types";

function Section({ id, title, description, children }: { id: string; title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <Card id={id}>
      <CardHeader title={title} description={description} />
      <CardBody className="space-y-4">{children}</CardBody>
    </Card>
  );
}

export default function SettingsPage() {
  const s = useCompany();
  const { t, l, dateTime } = useI18n();
  const run = useRun();
  const confirm = useConfirm();
  const toast = useToast();
  useDocumentTitle(t("settings.title"));
  const fileRef = useRef<HTMLInputElement>(null);
  const manage = can(s.settings.role, "manage_settings");
  const [company, setCompany] = useState({
    companyName: s.settings.companyName,
    tagline: s.settings.tagline,
    companyEmail: s.settings.companyEmail,
    founderName: s.settings.founderName,
    founderTitle: s.settings.founderTitle,
  });
  const [github, setGithub] = useState(s.settings.github);
  const [defaults, setDefaults] = useState(s.settings.projectDefaults);
  const save = (patch: Partial<Settings>) => run((st, ctx) => updateSettings(st, ctx, patch), t("common.saved"));
  const storageBytes = typeof window !== "undefined" ? (localStorage.getItem(STORAGE_KEY)?.length ?? 0) * 2 : 0;
  const hasBackup = typeof window !== "undefined" && !!localStorage.getItem(BACKUP_KEY);
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "/";
  const commit = process.env.NEXT_PUBLIC_COMMIT_SHA;

  const exportJson = () => {
    downloadFile(`ai-company-os-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(s, null, 2));
    localStorage.setItem(LAST_EXPORT_KEY, new Date().toISOString());
  };

  const importJson = async (file: File) => {
    let data: unknown;
    try {
      data = JSON.parse(await file.text());
    } catch {
      toast.error(t("errors.not_json"));
      return;
    }
    const parsed = parseCompanyState(data);
    if (!parsed.ok) {
      toast.error(t("errors.invalid_file", { issues: parsed.issues.slice(0, 3).join("; ") }));
      return;
    }
    const r = await confirm({ title: t("settings.importJson"), body: t("settings.importConfirm"), confirmLabel: t("common.import"), cancelLabel: t("common.cancel"), danger: true });
    if (r.ok) {
      if (replaceState(parsed.state, "data_imported")) toast.success(t("settings.importDone"));
      else toast.error(t("app.storageFull"));
    }
  };

  return (
    <>
      <PageHeader title={t("settings.title")} />
      {!manage && <Notice tone="warning" className="mb-6">{t("common.noPermission")}</Notice>}
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-6">
          <Section id="company" title={t("settings.company")}>
            <Field label={t("settings.companyName")}>{(id) => <Input id={id} disabled={!manage} value={company.companyName} onChange={(e) => setCompany({ ...company, companyName: e.target.value })} />}</Field>
            <Field label={t("settings.tagline")}>{(id) => <Input id={id} disabled={!manage} value={company.tagline} onChange={(e) => setCompany({ ...company, tagline: e.target.value })} />}</Field>
            <Field label={t("settings.companyEmail")}>{(id) => <Input id={id} disabled={!manage} type="email" dir="ltr" value={company.companyEmail} onChange={(e) => setCompany({ ...company, companyEmail: e.target.value })} />}</Field>
            <h3 className="pt-2 text-sm font-semibold text-fg">{t("settings.founder")}</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("settings.founderName")}>{(id) => <Input id={id} disabled={!manage} value={company.founderName} onChange={(e) => setCompany({ ...company, founderName: e.target.value })} data-testid="founder-name" />}</Field>
              <Field label={t("settings.founderTitle")}>{(id) => <Input id={id} disabled={!manage} value={company.founderTitle} onChange={(e) => setCompany({ ...company, founderTitle: e.target.value })} />}</Field>
            </div>
            {manage && <div className="flex justify-end"><Button variant="primary" onClick={() => save(company)} data-testid="save-company">{t("common.save")}</Button></div>}
          </Section>

          <Section id="appearance" title={t("settings.appearance")}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("app.theme")}>
                {(id) => (
                  <Select id={id} value={s.settings.theme} onChange={(e) => save({ theme: e.target.value as Settings["theme"] })} data-testid="theme-select">
                    {(["light", "dark", "system"] as const).map((x) => <option key={x} value={x}>{t(`app.${x}`)}</option>)}
                  </Select>
                )}
              </Field>
              <Field label={t("app.language")}>
                {(id) => (
                  <Select id={id} value={s.settings.locale} onChange={(e) => save({ locale: e.target.value as Settings["locale"] })} data-testid="language-select">
                    <option value="en">English</option>
                    <option value="ar">العربية</option>
                  </Select>
                )}
              </Field>
            </div>
          </Section>

          <Section id="notifications" title={t("settings.notifications")} description={t("settings.notificationsHint")}>
            {([
              ["approvals", t("settings.notifyApprovals")],
              ["blockedTasks", t("settings.notifyBlocked")],
              ["reviews", t("settings.notifyReviews")],
            ] as const).map(([k, label]) => (
              <Checkbox key={k} label={label} disabled={!manage} checked={s.settings.notifications[k]} onChange={(v) => save({ notifications: { ...s.settings.notifications, [k]: v } })} />
            ))}
          </Section>

          <Section id="role" title={t("settings.role")} description={t("settings.roleHint")}>
            <Select
              aria-label={t("settings.role")}
              value={s.settings.role}
              onChange={(e) => run((st, ctx) => setRole(st, ctx, e.target.value as Role))}
              className="w-56"
              data-testid="role-select"
            >
              {(["ceo", "operator", "viewer"] as Role[]).map((r) => <option key={r} value={r}>{t(`role.${r}`)}</option>)}
            </Select>
          </Section>

          <Section id="defaults" title={t("settings.projectDefaults")}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("settings.defaultPriority")}>
                {(id) => (
                  <Select id={id} disabled={!manage} value={defaults.priority} onChange={(e) => setDefaults({ ...defaults, priority: e.target.value as Priority })}>
                    {PRIORITIES.map((p) => <option key={p} value={p}>{t(`priority.${p}`)}</option>)}
                  </Select>
                )}
              </Field>
              <Field label={t("settings.defaultDuration")}>{(id) => <Input id={id} disabled={!manage} type="number" min={1} max={3650} value={defaults.durationDays} onChange={(e) => setDefaults({ ...defaults, durationDays: Math.max(1, Number(e.target.value) || 1) })} />}</Field>
            </div>
            {manage && <div className="flex justify-end"><Button onClick={() => save({ projectDefaults: defaults })}>{t("common.save")}</Button></div>}
          </Section>

          <Section id="security" title={t("settings.security")}>
            <ul className="list-disc space-y-1.5 ps-5 text-[13px] text-fg">
              <li>{t("settings.securityNote1")}</li>
              <li>{t("settings.securityNote2")}</li>
              <li>{t("settings.securityNote3")}</li>
            </ul>
            <h3 className="pt-2 text-sm font-semibold text-fg">{t("settings.securityItems")}</h3>
            <ul className="grid gap-1.5 text-[13px] sm:grid-cols-2">
              {PROTECTED_ACTIONS.map((a) => (
                <li key={a} className="flex items-center justify-between gap-2 rounded-md bg-surface-2 px-2.5 py-1.5">
                  <span className="text-fg">{t(`protectedAction.${a}`)}</span>
                  <span className="flex shrink-0 items-center gap-1 text-xs text-muted"><Lock className="size-3" />{t("settings.always")}</span>
                </li>
              ))}
            </ul>
          </Section>
        </div>

        <div className="space-y-6">
          <CloudSection />
          <AgentChannel />
          <Section id="data" title={t("settings.data")} description={t("app.localModeHint")}>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" onClick={exportJson} data-testid="export-json"><Download className="size-4" />{t("settings.exportJson")}</Button>
              {manage && (
                <>
                  <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" data-testid="import-file" onChange={(e) => { const f = e.target.files?.[0]; if (f) importJson(f); e.target.value = ""; }} />
                  <Button onClick={() => fileRef.current?.click()}><Upload className="size-4" />{t("settings.importJson")}</Button>
                </>
              )}
            </div>
            {manage && (
              <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                <Button
                  variant="danger"
                  data-testid="clear-sample"
                  onClick={async () => {
                    const r = await confirm({ title: t("settings.clearSample"), body: t("settings.clearSampleConfirm"), confirmLabel: t("common.delete"), cancelLabel: t("common.cancel"), danger: true });
                    if (r.ok) run((st, ctx) => clearSampleData(st, ctx), t("common.saved"));
                  }}
                >
                  <Trash2 className="size-4" />{t("settings.clearSample")}
                </Button>
                <Button
                  variant="danger"
                  data-testid="reset-data"
                  onClick={async () => {
                    const r = await confirm({ title: t("settings.reset"), body: t("settings.resetConfirm"), confirmLabel: t("settings.reset"), cancelLabel: t("common.cancel"), danger: true });
                    if (r.ok) {
                      const seed = createSeed();
                      seed.settings = { ...seed.settings, locale: s.settings.locale, theme: s.settings.theme };
                      replaceState(seed, "data_reset");
                      toast.success(t("common.saved"));
                    }
                  }}
                >
                  <RotateCcw className="size-4" />{t("settings.reset")}
                </Button>
                {hasBackup && (
                  <Button
                    onClick={async () => {
                      const r = await confirm({ title: t("settings.restoreBackup"), body: t("settings.restoreConfirm"), confirmLabel: t("common.confirm"), cancelLabel: t("common.cancel") });
                      if (r.ok && restoreBackup()) toast.success(t("common.saved"));
                    }}
                  >
                    {t("settings.restoreBackup")}
                  </Button>
                )}
              </div>
            )}
            <Checkbox
              label={t("analytics.includeSample")}
              disabled={!manage}
              checked={s.settings.includeSampleInAnalytics}
              onChange={(v) => save({ includeSampleInAnalytics: v })}
            />
            <p className="tabular text-xs text-muted">{t("settings.storageUsed")}: {(storageBytes / 1024).toFixed(0)} KB · <Link className="text-accent hover:underline" href={routes.article("KB-016")}>SOP</Link></p>
          </Section>

          <Section id="employees" title={t("settings.employeeManagement")}>
            <ul className="divide-y divide-border">
              {s.employees.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                  <ActorChip actor={e.id} size={26} sub={l(e.title)} />
                  <Select
                    aria-label={`${l(e.name)} ${t("employees.availability")}`}
                    value={e.availability}
                    disabled={!can(s.settings.role, "write")}
                    onChange={(ev) => run((st, ctx) => setAvailability(st, ctx, e.id, ev.target.value as Availability))}
                    className="w-36"
                  >
                    {(["available", "busy", "unavailable"] as Availability[]).map((a) => <option key={a} value={a}>{t(`availability.${a}`)}</option>)}
                  </Select>
                </li>
              ))}
            </ul>
          </Section>

          <Section id="departments" title={t("settings.departmentSettings")}>
            {s.departments.map((d) => (
              <Field key={d.id} label={`${l(d.name)} — ${t("common.manager")}`}>
                {(id) => (
                  <Select id={id} disabled={!manage} value={d.managerId} onChange={(e) => run((st, ctx) => setDepartmentManager(st, ctx, d.id, e.target.value as EmployeeId), t("common.saved"))}>
                    {s.employees.filter((e) => e.departmentId === d.id).map((e) => <option key={e.id} value={e.id}>{l(e.name)} — {l(e.title)}</option>)}
                  </Select>
                )}
              </Field>
            ))}
          </Section>

          <Section id="github" title={t("settings.github")} description={t("settings.githubNote")}>
            <Field label={t("settings.repoUrl")}>{(id) => <Input id={id} dir="ltr" disabled={!manage} value={github.repoUrl} onChange={(e) => setGithub({ ...github, repoUrl: e.target.value })} />}</Field>
            <Field label={t("settings.pagesUrl")}>{(id) => <Input id={id} dir="ltr" disabled={!manage} value={github.pagesUrl} onChange={(e) => setGithub({ ...github, pagesUrl: e.target.value })} />}</Field>
            {manage && <div className="flex justify-end"><Button onClick={() => save({ github })}>{t("common.save")}</Button></div>}
          </Section>

          <Section id="deployment" title={t("settings.deployment")}>
            <dl className="space-y-2 text-[13px]">
              <div className="flex justify-between gap-4"><dt className="text-muted">{t("settings.buildTime")}</dt><dd className="text-fg">{dateTime(process.env.NEXT_PUBLIC_BUILD_TIME)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted">{t("settings.basePath")}</dt><dd dir="ltr" className="font-mono text-fg">{basePath}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted">{t("settings.commit")}</dt><dd dir="ltr" className="font-mono text-fg">{commit ? commit.slice(0, 7) : t("settings.localBuild")}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted">{t("overview.paidServices")}</dt><dd className="text-fg">{t("overview.paidServicesValue")}</dd></div>
            </dl>
          </Section>
        </div>
      </div>
    </>
  );
}
