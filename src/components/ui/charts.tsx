"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

// Chart primitives. Rules (from the data-viz method): thin marks, 2px surface gaps
// between segments, a legend with labels and counts so colour is never the only
// channel, text in ink colours (never the series colour), and a hover tooltip.

export function StatTile({
  label,
  value,
  hint,
  icon,
  tone,
  href,
  testId,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: "danger" | "warning" | "success";
  href?: string;
  testId?: string;
}) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] text-fg-2">{label}</span>
        {icon && <span className={cn("text-muted", tone === "danger" && "text-danger", tone === "warning" && "text-warning", tone === "success" && "text-success")}>{icon}</span>}
      </div>
      <div className="tabular mt-2 text-[26px] font-semibold leading-none tracking-tight text-fg" data-testid={testId}>
        {value}
      </div>
      {hint && <div className="mt-2 text-xs text-muted">{hint}</div>}
    </>
  );
  const cls = "block rounded-xl border border-border bg-surface px-4 py-3.5 shadow-card";
  return href ? (
    <a href={href} className={cn(cls, "transition-colors hover:border-border-strong")}>
      {body}
    </a>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function Meter({ value, label, className }: { value: number | null; label: string; className?: string }) {
  const v = value ?? 0;
  return (
    <div
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-accent-soft", className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value ?? undefined}
      aria-label={label}
    >
      <div className="meter-fill h-full rounded-full bg-accent" style={{ width: `${v}%` }} />
    </div>
  );
}

export interface Segment {
  key: string;
  label: string;
  value: number;
  color: string;
}

/** One whole split into parts (no baseline). Legend always present; hover shows the value. */
export function SegmentedBar({ segments, total, ariaLabel }: { segments: Segment[]; total?: number; ariaLabel: string }) {
  const [hover, setHover] = useState<string | null>(null);
  const sum = total ?? segments.reduce((n, s) => n + s.value, 0);
  const visible = segments.filter((s) => s.value > 0);
  const hovered = visible.find((s) => s.key === hover);

  return (
    <figure aria-label={ariaLabel}>
      <div className="relative">
        <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full bg-surface-2" onMouseLeave={() => setHover(null)}>
          {sum === 0 ? null : (
            visible.map((s) => (
              <div
                key={s.key}
                className="seg h-full first:rounded-s-full last:rounded-e-full"
                style={{ width: `${(s.value / sum) * 100}%`, background: s.color, opacity: hover && hover !== s.key ? 0.45 : 1 }}
                onMouseEnter={() => setHover(s.key)}
                aria-hidden
              />
            ))
          )}
        </div>
        {hovered && (
          <div className="pointer-events-none absolute -top-9 start-0 rounded-md border border-border bg-surface px-2 py-1 text-xs shadow-md">
            <span className="font-medium text-fg">{hovered.label}</span>
            <span className="tabular ms-2 text-fg-2">
              {hovered.value} · {Math.round((hovered.value / sum) * 100)}%
            </span>
          </div>
        )}
      </div>
      <figcaption className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
        {segments.map((s) => (
          <div key={s.key} className="flex items-center gap-2 text-[13px]" onMouseEnter={() => setHover(s.key)} onMouseLeave={() => setHover(null)}>
            <span className="size-2.5 shrink-0 rounded-sm" style={{ background: s.color }} aria-hidden />
            <span className="truncate text-fg-2">{s.label}</span>
            <span className="tabular ms-auto font-medium text-fg">{s.value}</span>
          </div>
        ))}
      </figcaption>
    </figure>
  );
}

/** Horizontal bars for magnitude by category. Each bar's colour follows its entity. */
export function BarList({ rows, max, valueLabel }: { rows: { key: string; label: ReactNode; value: number; color: string; title?: string }[]; max?: number; valueLabel?: (v: number) => string }) {
  const top = Math.max(1, max ?? Math.max(0, ...rows.map((r) => r.value)));
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.key} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-[13px]" title={r.title}>
          <span className="truncate text-fg-2">{r.label}</span>
          <span className="h-2.5 rounded-e bg-surface-2">
            <span className="block h-full rounded-e" style={{ width: `${(r.value / top) * 100}%`, background: r.color, minWidth: r.value ? 4 : 0 }} />
          </span>
          <span className="tabular w-8 text-end font-medium text-fg">{valueLabel ? valueLabel(r.value) : r.value}</span>
        </li>
      ))}
    </ul>
  );
}
