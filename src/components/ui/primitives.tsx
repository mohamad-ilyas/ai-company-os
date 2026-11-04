"use client";

import { forwardRef, useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

// ------------------------------------------------------------------ Button

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success";
type ButtonSize = "sm" | "md";

const buttonStyles: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-fg hover:bg-accent-hover border border-transparent",
  secondary: "bg-surface text-fg border border-border-strong hover:bg-surface-2",
  ghost: "text-fg-2 hover:bg-surface-2 hover:text-fg border border-transparent",
  danger: "bg-surface text-danger border border-border-strong hover:bg-danger/10",
  // White on --success (7.5:1) in light mode; dark text on the brighter mark in dark mode.
  success: "bg-success text-white hover:brightness-110 border border-transparent dark:bg-success-mark dark:text-[#0b0b0b]",
};

export function buttonClasses(variant: ButtonVariant = "secondary", size: ButtonSize = "md", className?: string) {
  return cn(
    "inline-flex select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
    // Touch screens get 44px targets; mouse layouts stay dense.
    size === "sm" ? "h-8 px-2.5 text-[13px] pointer-coarse:h-11" : "h-9 px-3.5 text-sm pointer-coarse:h-11",
    buttonStyles[variant],
    className,
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }>(
  function Button({ variant = "secondary", size = "md", className, type = "button", ...props }, ref) {
    return (
      <button
        ref={ref}
        type={type}
        className={buttonClasses(variant, size, className)}
        {...props}
      />
    );
  },
);

// ------------------------------------------------------------------ Card

export function Card({ className, children, ...rest }: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLElement>) {
  return (
    <section className={cn("rounded-xl border border-border bg-surface shadow-card", className)} {...rest}>
      {children}
    </section>
  );
}

export function CardHeader({ title, description, actions, className }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <header className={cn("flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-3.5", className)}>
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold text-fg">{title}</h2>
        {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function CardBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("px-5 py-4", className)}>{children}</div>;
}

// ------------------------------------------------------------------ Badge

export type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "accent" | "serious";

const toneStyles: Record<Tone, string> = {
  neutral: "bg-surface-2 text-fg-2 border-border",
  info: "bg-accent-soft text-accent-text border-accent/20",
  accent: "bg-accent-soft text-accent-text border-accent/20",
  success: "bg-success-mark/10 text-success border-success-mark/25",
  warning: "bg-warning-mark/15 text-warning border-warning-mark/30",
  serious: "bg-serious-mark/15 text-warning border-serious-mark/30",
  danger: "bg-danger-mark/10 text-danger border-danger-mark/25",
};

const dotStyles: Record<Tone, string> = {
  neutral: "bg-muted",
  info: "bg-accent",
  accent: "bg-accent",
  success: "bg-success-mark",
  warning: "bg-warning-mark",
  serious: "bg-serious-mark",
  danger: "bg-danger-mark",
};

export function Badge({ tone = "neutral", dot, children, className, title }: { tone?: Tone; dot?: boolean; children: ReactNode; className?: string; title?: string }) {
  return (
    <span title={title} className={cn("inline-flex max-w-full items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium leading-5", toneStyles[tone], className)}>
      {dot && <span className={cn("size-1.5 shrink-0 rounded-full", dotStyles[tone])} aria-hidden />}
      <span className="truncate">{children}</span>
    </span>
  );
}

// ------------------------------------------------------------------ Form controls

const controlBase =
  // 16px on phones: iOS Safari zooms into any field with smaller text.
  "w-full rounded-md border border-border-strong bg-surface px-3 text-base sm:text-sm text-fg placeholder:text-muted focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30 disabled:opacity-60";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn(controlBase, "h-9 pointer-coarse:h-11", className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn(controlBase, "min-h-[88px] py-2 leading-relaxed", className)} {...props} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...props }, ref) {
  return (
    <select ref={ref} className={cn(controlBase, "h-9 pe-8 pointer-coarse:h-11", className)} {...props}>
      {children}
    </select>
  );
});

/** Label + control + hint, wired with ids for accessibility. */
export function Field({
  label,
  hint,
  required,
  children,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  required?: boolean;
  children: (id: string, describedBy?: string) => ReactNode;
  className?: string;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-[13px] font-medium text-fg">
        {label}
        {required && <span className="ms-0.5 text-danger" aria-hidden>*</span>}
      </label>
      {children(id, hintId)}
      {hint && (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}

export function Checkbox({ label, checked, onChange, disabled, hint }: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; hint?: ReactNode }) {
  const id = useId();
  return (
    <div className="flex items-start gap-2.5">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 shrink-0 rounded border-border-strong accent-[var(--accent)]"
      />
      <label htmlFor={id} className="text-sm text-fg">
        {label}
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </label>
    </div>
  );
}

// ------------------------------------------------------------------ Layout helpers

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0 max-w-3xl">
        {eyebrow && <div className="mb-1.5">{eyebrow}</div>}
        <h1 className="text-2xl font-semibold tracking-tight text-fg">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-fg-2">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: ReactNode; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border-strong px-6 py-10 text-center">
      {icon && <div className="text-muted">{icon}</div>}
      <p className="text-sm font-medium text-fg">{title}</p>
      {children && <div className="max-w-md text-[13px] text-muted">{children}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function KeyValue({ items, className }: { items: { k: ReactNode; v: ReactNode }[]; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2", className)}>
      {items.map((it, i) => (
        <div key={i} className="min-w-0">
          <dt className="text-xs font-medium uppercase tracking-wide text-muted">{it.k}</dt>
          <dd className="bidi mt-0.5 break-words text-sm text-fg">{it.v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function BulletList({ items, empty }: { items: string[]; empty?: ReactNode }) {
  if (!items.length) return <p className="text-sm text-muted">{empty ?? "—"}</p>;
  return (
    <ul className="space-y-1.5 text-sm text-fg">
      {items.map((x, i) => (
        <li key={i} className="flex gap-2">
          <span className="mt-2 size-1 shrink-0 rounded-full bg-muted" aria-hidden />
          <span className="bidi min-w-0">{x}</span>
        </li>
      ))}
    </ul>
  );
}

export function Chips({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((x) => (
        <span key={x} className="rounded-md border border-border bg-surface-2 px-2 py-0.5 text-xs text-fg-2">
          {x}
        </span>
      ))}
    </div>
  );
}

export function Notice({ tone = "info", icon, children, className }: { tone?: "info" | "warning" | "danger"; icon?: ReactNode; children: ReactNode; className?: string }) {
  const styles = {
    info: "border-accent/25 bg-accent-soft text-fg",
    warning: "border-warning-mark/40 bg-warning-mark/10 text-fg",
    danger: "border-danger-mark/30 bg-danger-mark/10 text-fg",
  }[tone];
  return (
    <div className={cn("flex items-start gap-3 rounded-lg border px-4 py-3 text-[13px] leading-relaxed", styles, className)}>
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export const tableClass = {
  wrap: "overflow-x-auto",
  table: "w-full min-w-[640px] border-collapse text-sm",
  th: "border-b border-border px-4 py-2.5 text-start text-xs font-medium uppercase tracking-wide text-muted",
  td: "border-b border-border px-4 py-3 align-middle text-fg",
  tr: "hover:bg-surface-2/60",
};
