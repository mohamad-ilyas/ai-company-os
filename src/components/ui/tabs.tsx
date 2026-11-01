"use client";

import { useId, useRef, type ReactNode, type KeyboardEvent } from "react";
import { cn } from "@/lib/cn";

/** WAI-ARIA tabs with arrow-key navigation that follows reading direction. */
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  children,
  className,
}: {
  tabs: { id: T; label: ReactNode; count?: number }[];
  value: T;
  onChange: (id: T) => void;
  children: ReactNode;
  className?: string;
}) {
  const base = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKey = (e: KeyboardEvent, i: number) => {
    const rtl = document.documentElement.dir === "rtl";
    let next = -1;
    if (e.key === (rtl ? "ArrowLeft" : "ArrowRight")) next = (i + 1) % tabs.length;
    if (e.key === (rtl ? "ArrowRight" : "ArrowLeft")) next = (i - 1 + tabs.length) % tabs.length;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = tabs.length - 1;
    if (next >= 0) {
      e.preventDefault();
      onChange(tabs[next].id);
      refs.current[next]?.focus();
    }
  };

  return (
    <div className={className}>
      <div role="tablist" className="-mb-px flex gap-1 overflow-x-auto border-b border-border">
        {tabs.map((tab, i) => {
          const selected = tab.id === value;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                refs.current[i] = el;
              }}
              role="tab"
              id={`${base}-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`${base}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(tab.id)}
              onKeyDown={(e) => onKey(e, i)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                selected ? "border-accent text-fg" : "border-transparent text-muted hover:text-fg",
              )}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className="tabular rounded-full bg-surface-2 px-1.5 text-xs text-fg-2">{tab.count}</span>
              )}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" id={`${base}-panel`} aria-labelledby={`${base}-tab-${value}`} className="pt-5">
        {children}
      </div>
    </div>
  );
}
