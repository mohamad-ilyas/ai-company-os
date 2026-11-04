"use client";

import Link from "next/link";
import { useState } from "react";
import { Building2, FileText, FolderKanban, Gavel, Info, Megaphone, MessageCircle, PhoneCall } from "lucide-react";
import { useCompany, useI18n } from "@/lib/store";
import { Card, CardBody, CardHeader, Notice, PageHeader, Select } from "@/components/ui/primitives";
import { ActorChip, SampleBadge } from "@/components/common";
import { Thread } from "@/components/thread";
import { AskCoo } from "@/components/ask-coo";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/cn";
import { useDocumentTitle } from "@/components/shell/use-title";
import type { ChannelKind } from "@/lib/types";

type Channel = { kind: ChannelKind; refId: string | null; label: string; icon: typeof Megaphone; color?: string };

export default function CommunicationPage() {
  const s = useCompany();
  const { t, l, dateTime } = useI18n();
  useDocumentTitle(t("communication.title"));

  const general: Channel[] = [
    { kind: "direct", refId: null, label: t("channelKind.direct"), icon: PhoneCall },
    { kind: "announcement", refId: null, label: t("channelKind.announcement"), icon: Megaphone },
    { kind: "decision", refId: null, label: t("channelKind.decision"), icon: Gavel },
    { kind: "meeting", refId: null, label: t("channelKind.meeting"), icon: FileText },
  ];
  const depts: Channel[] = s.departments.map((d) => ({ kind: "department", refId: d.id, label: l(d.name), icon: Building2, color: `var(--s${d.colorSlot})` }));
  const projects: Channel[] = s.projects.map((p) => ({ kind: "project", refId: p.id, label: p.name, icon: FolderKanban }));
  const [active, setActive] = useState<Channel>(general[0]);
  const count = (c: Channel) => s.messages.filter((m) => m.kind === c.kind && (c.refId === null || m.refId === c.refId)).length;
  const recentComments = s.tasks
    .flatMap((task) => task.comments.map((c) => ({ ...c, task })))
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 8);

  const group = (title: string, items: Channel[]) => (
    <div>
      <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">{title}</p>
      <ul className="space-y-0.5">
        {items.map((c) => {
          const selected = c.kind === active.kind && c.refId === active.refId;
          const Icon = c.icon;
          return (
            <li key={`${c.kind}-${c.refId}`}>
              <button
                onClick={() => setActive(c)}
                aria-current={selected ? "true" : undefined}
                className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-start text-[13px] pointer-coarse:py-3", selected ? "bg-surface-2 font-medium text-fg" : "text-fg-2 hover:bg-surface-2/60")}
                data-testid={`channel-${c.kind}-${c.refId ?? "all"}`}
              >
                {c.color ? <span className="size-2 shrink-0 rounded-sm" style={{ background: c.color }} aria-hidden /> : <Icon className="size-3.5 shrink-0 text-muted" aria-hidden />}
                <span className="flex-1 truncate">{c.label}</span>
                <span className="tabular text-xs text-muted">{count(c)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );

  return (
    <>
      <PageHeader title={t("communication.title")} subtitle={t("communication.subtitle")} />
      <Notice icon={<Info className="size-4 text-accent" />} className="mb-6">{t("communication.notRealtime")}</Notice>
      <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
        {/* Phones: a compact picker above the thread, so choosing a channel never changes content off-screen. */}
        <Select
          className="lg:hidden"
          aria-label={t("communication.channel")}
          value={`${active.kind}|${active.refId ?? ""}`}
          onChange={(e) => {
            const c = [...general, ...depts, ...projects].find((x) => `${x.kind}|${x.refId ?? ""}` === e.target.value);
            if (c) setActive(c);
          }}
          data-testid="channel-picker"
        >
          {([[t("communication.general"), general], [t("communication.departments"), depts], [t("communication.projects"), projects]] as const).map(([title, items]) => (
            <optgroup key={title} label={title}>
              {items.map((c) => <option key={`${c.kind}-${c.refId}`} value={`${c.kind}|${c.refId ?? ""}`}>{c.label} ({count(c)})</option>)}
            </optgroup>
          ))}
        </Select>
        <Card className="hidden h-fit lg:block">
          <CardBody className="space-y-4 px-3">
            {group(t("communication.general"), general)}
            {group(t("communication.departments"), depts)}
            {group(t("communication.projects"), projects)}
          </CardBody>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader
              title={active.label}
              description={active.kind === "project" && active.refId ? <Link href={routes.project(active.refId)} className="text-accent-text hover:underline">{active.refId}</Link> : undefined}
            />
            <CardBody>
              {active.kind === "direct" && <p className="mb-3 text-xs text-muted">{t("communication.directHint")}</p>}
              <Thread key={`${active.kind}-${active.refId}`} kind={active.kind} refId={active.refId} hideComposer={active.kind === "direct"} />
              {active.kind === "direct" && (
                <div className="mt-4 border-t border-border pt-4">
                  <AskCoo />
                </div>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={t("communication.taskComments")} />
            <CardBody>
              {recentComments.length === 0 ? <p className="text-sm text-muted">{t("tasks.noComments")}</p> : (
                <ul className="space-y-3">
                  {recentComments.map((c) => (
                    <li key={c.id} className="flex gap-3">
                      <MessageCircle className="mt-1 size-4 shrink-0 text-muted" aria-hidden />
                      <div className="min-w-0 flex-1">
                        <Link href={routes.task(c.task.id)} className="text-[13px] font-medium text-fg hover:underline">{c.task.id} · {c.task.title}</Link>
                        <SampleBadge show={c.task.sample} />
                        <p className="mt-0.5 line-clamp-2 text-[13px] text-fg-2">{c.body}</p>
                        <div className="mt-1 flex items-center gap-2 text-xs text-muted"><ActorChip actor={c.authorId} size={18} /> · {dateTime(c.at)}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
