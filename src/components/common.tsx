"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Bot, Check, Copy, ExternalLink, Plus, Trash2, UserRound } from "lucide-react";
import { Badge, Button, Input, buttonClasses, type Tone } from "./ui/primitives";
import { useCompany, useI18n } from "@/lib/store";
import { routes, refRoute } from "@/lib/routes";
import { tDynamic } from "@/lib/i18n";
import { employeeWorkState, type WorkState } from "@/lib/metrics";
import { cn } from "@/lib/cn";
import { safeLink } from "@/lib/safe-url";
import type {
  ActivityEvent,
  ActorId,
  ApprovalStatus,
  Employee,
  EmployeeId,
  ExecutionStatus,
  LinkRef,
  Priority,
  ProjectStatus,
  ReviewStatus,
  RiskLevel,
  TaskStatus,
} from "@/lib/types";

export const SLOT_COLOR = { 1: "var(--s1)", 2: "var(--s2)", 3: "var(--s3)", 4: "var(--s4)" } as const;

export function useEmployee(id: EmployeeId | null | undefined): Employee | undefined {
  const s = useCompany();
  return id ? s.employees.find((e) => e.id === id) : undefined;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

/** Generated avatar: initials on a tint of the department colour. AI employees carry a small bot mark. */
export function Avatar({ actor, size = 36 }: { actor: ActorId; size?: number }) {
  const s = useCompany();
  const emp = s.employees.find((e) => e.id === actor);
  const dept = emp && s.departments.find((d) => d.id === emp.departmentId);
  const color = dept ? SLOT_COLOR[dept.colorSlot] : actor === "ceo" ? "var(--fg)" : "var(--muted)";
  const label = emp ? emp.name.en : actor === "ceo" ? s.settings.founderName || "CEO" : "System";
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }} aria-hidden>
      <span
        className="flex size-full items-center justify-center rounded-full font-semibold"
        style={{
          background: `color-mix(in oklab, ${color} 16%, var(--surface))`,
          // Half text colour: keeps initials at 4.5:1+ even for the yellow department (slot 4) in light mode.
          color: `color-mix(in oklab, ${color} 50%, var(--fg))`,
          border: `1px solid color-mix(in oklab, ${color} 30%, transparent)`,
          fontSize: Math.max(10, size * 0.36),
        }}
      >
        {actor === "system" ? <Bot className="size-1/2" /> : initials(label)}
      </span>
      {emp && (
        <span className="absolute -bottom-0.5 -end-0.5 flex items-center justify-center rounded-full border-2 border-surface bg-surface-3 text-fg-2" style={{ width: size * 0.42, height: size * 0.42 }}>
          <Bot style={{ width: size * 0.24, height: size * 0.24 }} />
        </span>
      )}
    </span>
  );
}

export function ActorChip({ actor, size = 24, link = true, sub }: { actor: ActorId | null; size?: number; link?: boolean; sub?: ReactNode }) {
  const { actorName } = useI18n();
  if (!actor) return <span className="inline-flex items-center gap-1.5 text-sm text-muted"><UserRound className="size-4" />{actorName(null)}</span>;
  const content = (
    <span className="inline-flex min-w-0 items-center gap-2">
      <Avatar actor={actor} size={size} />
      <span className="min-w-0">
        <span className="block truncate text-sm text-fg">{actorName(actor)}</span>
        {sub && <span className="block truncate text-xs text-muted">{sub}</span>}
      </span>
    </span>
  );
  if (link && actor.startsWith("EMP-")) {
    return (
      <Link href={routes.employee(actor)} className="min-w-0 rounded hover:underline">
        {content}
      </Link>
    );
  }
  return content;
}

// ------------------------------------------------------------------ status badges

const TASK_TONE: Record<TaskStatus, Tone> = {
  backlog: "neutral",
  assigned: "info",
  in_progress: "accent",
  blocked: "danger",
  under_review: "warning",
  changes_requested: "serious",
  awaiting_ceo_approval: "warning",
  completed: "success",
  cancelled: "neutral",
};
const PROJECT_TONE: Record<ProjectStatus, Tone> = {
  planning: "neutral",
  requirements: "info",
  design: "info",
  development: "accent",
  testing: "accent",
  review: "warning",
  awaiting_ceo_approval: "warning",
  ready_for_delivery: "success",
  delivered: "success",
  on_hold: "neutral",
  cancelled: "neutral",
};
const EXEC_TONE: Record<ExecutionStatus, Tone> = {
  queued: "neutral",
  in_session: "accent",
  completed: "success",
  needs_input: "warning",
  failed: "danger",
  cancelled: "neutral",
};
const REVIEW_TONE: Record<ReviewStatus, Tone> = { not_submitted: "neutral", pending: "warning", approved: "success", changes_requested: "serious" };
const APPROVAL_TONE: Record<ApprovalStatus, Tone> = { pending: "warning", approved: "success", rejected: "danger" };
const RISK_TONE: Record<RiskLevel, Tone> = { low: "neutral", medium: "warning", high: "serious", critical: "danger" };
const PRIORITY_TONE: Record<Priority, Tone> = { low: "neutral", medium: "info", high: "warning", critical: "danger" };
const WORK_TONE: Record<WorkState, Tone> = { unavailable: "neutral", in_session: "accent", queued: "info", awaiting_review: "warning", idle: "neutral" };

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const { t } = useI18n();
  return <Badge tone={TASK_TONE[status]} dot>{t(`taskStatus.${status}`)}</Badge>;
}
export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const { t } = useI18n();
  return <Badge tone={PROJECT_TONE[status]} dot>{t(`projectStatus.${status}`)}</Badge>;
}
export function ExecutionStatusBadge({ status }: { status: ExecutionStatus }) {
  const { t } = useI18n();
  return <Badge tone={EXEC_TONE[status]} dot>{t(`executionStatus.${status}`)}</Badge>;
}
export function ReviewBadge({ status }: { status: ReviewStatus }) {
  const { t } = useI18n();
  return <Badge tone={REVIEW_TONE[status]}>{t(`reviewStatus.${status}`)}</Badge>;
}
export function ApprovalBadge({ status }: { status: ApprovalStatus }) {
  const { t } = useI18n();
  return <Badge tone={APPROVAL_TONE[status]} dot>{t(`approvalStatus.${status}`)}</Badge>;
}
export function RiskBadge({ risk }: { risk: RiskLevel }) {
  const { t } = useI18n();
  return <Badge tone={RISK_TONE[risk]}>{t("common.risk")}: {t(`riskLevel.${risk}`)}</Badge>;
}
export function PriorityBadge({ priority }: { priority: Priority }) {
  const { t } = useI18n();
  return <Badge tone={PRIORITY_TONE[priority]}>{t(`priority.${priority}`)}</Badge>;
}
export function WorkStateBadge({ employee, hideIdle = false }: { employee: Employee; hideIdle?: boolean }) {
  const s = useCompany();
  const { t } = useI18n();
  const ws = employeeWorkState(s, employee);
  if (hideIdle && ws === "idle") return null;
  return <Badge tone={WORK_TONE[ws]} dot>{t(`workState.${ws}`)}</Badge>;
}
export function SampleBadge({ show = true }: { show?: boolean }) {
  const { t } = useI18n();
  if (!show) return null;
  return (
    <Badge tone="neutral" className="border-dashed" title={t("common.sampleHint")}>
      {t("common.sample")}
    </Badge>
  );
}

// ------------------------------------------------------------------ activity

export function useActivityText() {
  const s = useCompany();
  const { t, actorName } = useI18n();
  return (e: ActivityEvent) => {
    const p: Record<string, string> = { ...e.params };
    if (p.employee) p.employee = actorName(p.employee as ActorId);
    for (const k of ["from", "to"] as const) {
      if (!p[k]) continue;
      const raw = p[k];
      const label = ["taskStatus", "projectStatus", "availability", "role"].map((ns) => tDynamic(t, `${ns}.${raw}`)).find((x) => !x.includes("."));
      p[k] = label ?? raw;
    }
    if (p.status) p.status = tDynamic(t, `executionStatus.${p.status}`);
    if (p.action) p.action = tDynamic(t, `protectedAction.${p.action}`);
    if (p.kind) p.kind = tDynamic(t, `channelKind.${p.kind}`);
    void s;
    return tDynamic(t, `activity.${e.key}`, p);
  };
}

export function ActivityList({ events, compact }: { events: ActivityEvent[]; compact?: boolean }) {
  const { dateTime, t } = useI18n();
  const text = useActivityText();
  if (!events.length) return <p className="text-sm text-muted">{t("activityPage.none")}</p>;
  return (
    <ol className="space-y-0">
      {events.map((e) => {
        const href = refRoute(e.refType, e.refId);
        return (
          <li key={e.id} className={cn("flex gap-3 border-b border-border last:border-0", compact ? "py-2.5" : "py-3")}>
            <Avatar actor={e.actor} size={compact ? 26 : 30} />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] text-fg">
                {href ? (
                  <Link href={href} className="hover:underline">
                    {text(e)}
                  </Link>
                ) : (
                  text(e)
                )}
                {e.params.sample === "true" && <SampleBadge />}
              </p>
              <p className="mt-0.5 text-xs text-muted">
                <ActorName actor={e.actor} /> · {dateTime(e.at)} · {tDynamic(t, `activityType.${e.type}`)}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function ActorName({ actor }: { actor: ActorId }) {
  const { actorName } = useI18n();
  return <>{actorName(actor)}</>;
}

// ------------------------------------------------------------------ utilities

export function CopyButton({ text, label, size = "sm", variant = "secondary", testId }: { text: string; label?: string; size?: "sm" | "md"; variant?: "secondary" | "primary" | "ghost"; testId?: string }) {
  const { t } = useI18n();
  const [done, setDone] = useState(false);
  return (
    <Button
      size={size}
      variant={variant}
      data-testid={testId}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          // Clipboard can be blocked (permissions, insecure context); fall back to a hidden textarea.
          const ta = document.createElement("textarea");
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          ta.remove();
        }
        setDone(true);
        setTimeout(() => setDone(false), 1800);
      }}
    >
      {done ? <Check className="size-4" /> : <Copy className="size-4" />}
      {done ? t("common.copied") : label ?? t("common.copy")}
    </Button>
  );
}

export function downloadFile(filename: string, content: string, type = "application/json") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Renders a link reference: internal paths via the router (base-path aware), external URLs in a new tab. */
export function RefLink({ link }: { link: LinkRef }) {
  const url = link.url.trim();
  const safe = safeLink(url);
  if (safe?.kind === "internal") {
    return (
      <Link href={safe.href} className="text-accent-text hover:underline">
        {link.label || url}
      </Link>
    );
  }
  if (safe && /^https?:/i.test(safe.href)) {
    return (
      <a href={safe.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-accent-text hover:underline">
        {link.label || url}
        <ExternalLink className="size-3" aria-hidden />
      </a>
    );
  }
  return (
    <span className="text-fg">
      {link.label ? `${link.label}: ` : ""}
      <code dir="ltr" className="rounded bg-surface-2 px-1 font-mono text-[12px]">{url}</code>
    </span>
  );
}

export function LinksEditor({ value, onChange }: { value: LinkRef[]; onChange: (v: LinkRef[]) => void }) {
  const { t } = useI18n();
  return (
    <div className="space-y-2">
      {value.map((l, i) => (
        <div key={i} className="flex gap-2">
          <Input
            aria-label={t("common.linkLabel")}
            placeholder={t("common.linkLabel")}
            value={l.label}
            onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
            className="w-1/3"
          />
          <Input
            aria-label={t("common.linkUrl")}
            placeholder={t("common.linkUrl")}
            dir="ltr"
            value={l.url}
            onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))}
          />
          <Button variant="ghost" size="sm" className="h-9" aria-label={t("common.remove")} onClick={() => onChange(value.filter((_, j) => j !== i))}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      ))}
      <Button size="sm" variant="ghost" onClick={() => onChange([...value, { label: "", url: "" }])}>
        <Plus className="size-4" />
        {t("common.addLink")}
      </Button>
    </div>
  );
}

export function cleanLinks(links: LinkRef[]): LinkRef[] {
  return links.map((l) => ({ label: l.label.trim(), url: l.url.trim() })).filter((l) => l.url);
}

export function linesToList(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.replace(/^\s*[-*•]\s*/, "").trim())
    .filter(Boolean);
}

/** Read the query string on the client (detail pages are static shells; wrap callers in <Suspense>). */
export function useQueryParam(name: string): string | null {
  return useSearchParams().get(name);
}

export function LinkButton({ href, children, variant = "secondary", size = "md", className, testId }: { href: string; children: ReactNode; variant?: Parameters<typeof buttonClasses>[0]; size?: "sm" | "md"; className?: string; testId?: string }) {
  return (
    <Link href={href} className={buttonClasses(variant, size, className)} data-testid={testId}>
      {children}
    </Link>
  );
}
