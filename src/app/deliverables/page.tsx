"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useCompany, useI18n, useRun } from "@/lib/store";
import { Badge, Button, Card, EmptyState, Field, Input, PageHeader, Select, Textarea, tableClass } from "@/components/ui/primitives";
import { Dialog, useConfirm } from "@/components/ui/dialog";
import { ActorChip, RefLink, SampleBadge } from "@/components/common";
import { can, deleteDeliverable, upsertDeliverable } from "@/lib/domain";
import { routes } from "@/lib/routes";
import { useDocumentTitle } from "@/components/shell/use-title";
import { DELIVERABLE_TYPES, type ActorId, type Deliverable, type DeliverableType } from "@/lib/types";

function DeliverableDialog({ item, onClose }: { item?: Deliverable; onClose: () => void }) {
  const s = useCompany();
  const { t, l } = useI18n();
  const run = useRun();
  const [f, setF] = useState({
    title: item?.title ?? "",
    type: item?.type ?? ("documentation" as DeliverableType),
    projectId: item?.projectId ?? "",
    taskId: item?.taskId ?? "",
    ownerId: item?.ownerId ?? ("ceo" as ActorId),
    location: item?.location ?? "",
    description: item?.description ?? "",
    version: item?.version ?? "1",
    status: item?.status ?? ("draft" as Deliverable["status"]),
  });
  const tasks = s.tasks.filter((x) => x.projectId === f.projectId);
  return (
    <Dialog
      open
      onClose={onClose}
      title={item ? t("deliverables.edit") : t("deliverables.new")}
      size="lg"
      footer={
        <>
          <Button onClick={onClose}>{t("common.cancel")}</Button>
          <Button
            variant="primary"
            data-testid="save-deliverable"
            onClick={() => {
              const r = run((st, ctx) =>
                upsertDeliverable(st, ctx, { ...f, id: item?.id, projectId: f.projectId || null, taskId: f.taskId || null, executionId: item?.executionId ?? null }),
                t("common.saved"),
              );
              if (r.ok) onClose();
            }}
          >
            {t("common.save")}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("common.title")} required className="sm:col-span-2">{(id) => <Input id={id} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} data-testid="deliverable-title" />}</Field>
        <Field label={t("common.type")}>
          {(id) => (
            <Select id={id} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as DeliverableType })}>
              {DELIVERABLE_TYPES.map((x) => <option key={x} value={x}>{t(`deliverableType.${x}`)}</option>)}
            </Select>
          )}
        </Field>
        <Field label={t("common.status")}>
          {(id) => (
            <Select id={id} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as Deliverable["status"] })}>
              {(["draft", "in_review", "approved"] as const).map((x) => <option key={x} value={x}>{t(`deliverableStatus.${x}`)}</option>)}
            </Select>
          )}
        </Field>
        <Field label={t("common.location")} hint={t("deliverables.locationHint")} required className="sm:col-span-2">
          {(id, hint) => <Input id={id} aria-describedby={hint} dir="ltr" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} placeholder="https://github.com/… or docs/…" data-testid="deliverable-location" />}
        </Field>
        <Field label={t("common.project")}>
          {(id) => (
            <Select id={id} value={f.projectId} onChange={(e) => setF({ ...f, projectId: e.target.value, taskId: "" })}>
              <option value="">{t("common.none")}</option>
              {s.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          )}
        </Field>
        <Field label={t("common.task")}>
          {(id) => (
            <Select id={id} value={f.taskId} onChange={(e) => setF({ ...f, taskId: e.target.value })} disabled={!f.projectId}>
              <option value="">{t("common.none")}</option>
              {tasks.map((x) => <option key={x.id} value={x.id}>{x.id} · {x.title}</option>)}
            </Select>
          )}
        </Field>
        <Field label={t("common.owner")}>
          {(id) => (
            <Select id={id} value={f.ownerId} onChange={(e) => setF({ ...f, ownerId: e.target.value as ActorId })}>
              <option value="ceo">{t("common.ceo")}</option>
              {s.employees.map((e) => <option key={e.id} value={e.id}>{l(e.name)}</option>)}
            </Select>
          )}
        </Field>
        <Field label={t("common.version")}>{(id) => <Input id={id} value={f.version} onChange={(e) => setF({ ...f, version: e.target.value })} />}</Field>
        <Field label={t("common.description")} className="sm:col-span-2">{(id) => <Textarea id={id} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />}</Field>
      </div>
    </Dialog>
  );
}

export default function DeliverablesPage() {
  const s = useCompany();
  const { t, date } = useI18n();
  const run = useRun();
  const confirm = useConfirm();
  useDocumentTitle(t("deliverables.title"));
  const [q, setQ] = useState("");
  const [type, setType] = useState<DeliverableType | "">("");
  const [project, setProject] = useState("");
  const [editing, setEditing] = useState<Deliverable | "new" | null>(null);
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return s.deliverables.filter((d) => (!type || d.type === type) && (!project || d.projectId === project) && (!needle || `${d.title} ${d.location} ${d.description}`.toLowerCase().includes(needle)));
  }, [s.deliverables, q, type, project]);

  return (
    <>
      <PageHeader
        title={t("deliverables.title")}
        subtitle={t("deliverables.subtitle")}
        actions={can(s.settings.role, "write") && <Button variant="primary" onClick={() => setEditing("new")} data-testid="new-deliverable"><Plus className="size-4" />{t("deliverables.new")}</Button>}
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="relative">
          <Search className="pointer-events-none absolute start-3 top-2.5 size-4 text-muted" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("common.search")} aria-label={t("common.search")} className="ps-9" />
        </div>
        <Select value={type} onChange={(e) => setType(e.target.value as DeliverableType | "")} aria-label={t("common.type")}>
          <option value="">{t("common.type")}: {t("common.all")}</option>
          {DELIVERABLE_TYPES.map((x) => <option key={x} value={x}>{t(`deliverableType.${x}`)}</option>)}
        </Select>
        <Select value={project} onChange={(e) => setProject(e.target.value)} aria-label={t("common.project")}>
          <option value="">{t("common.project")}: {t("common.all")}</option>
          {s.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
      </div>
      {rows.length === 0 ? <EmptyState title={t("deliverables.none")} /> : (
        <Card>
          <div className={tableClass.wrap}>
            <table className={tableClass.table} data-testid="deliverable-table">
              <thead>
                <tr>
                  <th className={tableClass.th}>{t("common.title")}</th>
                  <th className={tableClass.th}>{t("common.type")}</th>
                  <th className={tableClass.th}>{t("common.location")}</th>
                  <th className={tableClass.th}>{t("common.owner")}</th>
                  <th className={tableClass.th}>{t("common.status")}</th>
                  <th className={tableClass.th}><span className="sr-only">{t("common.actions")}</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((d) => {
                  const p = s.projects.find((x) => x.id === d.projectId);
                  return (
                    <tr key={d.id} className={tableClass.tr}>
                      <td className={tableClass.td}>
                        <p className="font-medium text-fg">{d.title} <SampleBadge show={d.sample} /></p>
                        <p className="text-xs text-muted">
                          <span className="tabular">{d.id}</span> · v{d.version} · {date(d.createdAt)}
                          {p && <> · <Link href={routes.project(p.id)} className="hover:underline">{p.name}</Link></>}
                          {d.executionId && <> · <Link href={routes.executionView(d.executionId)} className="hover:underline">{d.executionId}</Link></>}
                        </p>
                      </td>
                      <td className={tableClass.td}><Badge>{t(`deliverableType.${d.type}`)}</Badge></td>
                      <td className={`${tableClass.td} max-w-[16rem] text-[13px]`}><RefLink link={{ label: "", url: d.location }} /></td>
                      <td className={tableClass.td}><ActorChip actor={d.ownerId} size={22} /></td>
                      <td className={tableClass.td}><Badge tone={d.status === "approved" ? "success" : d.status === "in_review" ? "warning" : "neutral"}>{t(`deliverableStatus.${d.status}`)}</Badge></td>
                      <td className={`${tableClass.td} whitespace-nowrap text-end`}>
                        {can(s.settings.role, "write") && <Button size="sm" variant="ghost" aria-label={t("common.edit")} onClick={() => setEditing(d)}><Pencil className="size-4" /></Button>}
                        {can(s.settings.role, "delete") && (
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={t("common.delete")}
                            onClick={async () => {
                              const r = await confirm({ title: t("common.delete"), body: t("deliverables.deleteConfirm", { title: d.title }), confirmLabel: t("common.delete"), cancelLabel: t("common.cancel"), danger: true });
                              if (r.ok) run((st, ctx) => deleteDeliverable(st, ctx, d.id));
                            }}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      {editing && <DeliverableDialog item={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
    </>
  );
}
