"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button, Textarea } from "./primitives";
import { cn } from "@/lib/cn";

/** Native <dialog> gives focus trapping, Esc to close, and inert background for free. */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        "m-auto max-h-[90dvh] w-[calc(100%-2rem)] overflow-hidden rounded-xl border border-border bg-surface p-0 shadow-2xl",
        size === "sm" ? "max-w-md" : size === "lg" ? "max-w-3xl" : "max-w-xl",
      )}
    >
      {open && (
        <div className="flex max-h-[90dvh] flex-col">
          <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
            <div>
              <h2 className="text-base font-semibold text-fg">{title}</h2>
              {description && <p className="mt-1 text-[13px] text-muted">{description}</p>}
            </div>
            <button onClick={onClose} className="rounded p-1 text-muted hover:bg-surface-2 hover:text-fg" aria-label="Close">
              <X className="size-4" />
            </button>
          </header>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
          {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-border bg-surface-2/50 px-5 py-3">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}

// ------------------------------------------------------------------ Confirm

type ConfirmOptions = {
  title: string;
  body?: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  danger?: boolean;
  /** Ask for a note; when required, the confirm button stays disabled until one is entered. */
  note?: { label: string; required: boolean; hint?: string };
};
type ConfirmResult = { ok: boolean; note: string };

const ConfirmContext = createContext<((o: ConfirmOptions) => Promise<ConfirmResult>) | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const [note, setNote] = useState("");
  const resolver = useRef<(r: ConfirmResult) => void>(undefined);

  const confirm = useCallback((o: ConfirmOptions) => {
    setOpts(o);
    setNote("");
    return new Promise<ConfirmResult>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const finish = (ok: boolean) => {
    resolver.current?.({ ok, note });
    setOpts(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog
        open={!!opts}
        onClose={() => finish(false)}
        title={opts?.title ?? ""}
        size="sm"
        footer={
          opts && (
            <>
              <Button onClick={() => finish(false)}>{opts.cancelLabel}</Button>
              <Button
                variant={opts.danger ? "danger" : "primary"}
                disabled={!!opts.note?.required && !note.trim()}
                onClick={() => finish(true)}
                data-testid="confirm-ok"
              >
                {opts.confirmLabel}
              </Button>
            </>
          )
        }
      >
        {opts?.body && <div className="text-sm text-fg-2">{opts.body}</div>}
        {opts?.note && (
          <label className="mt-4 block text-[13px] font-medium text-fg">
            {opts.note.label}
            {opts.note.required && <span className="ms-0.5 text-danger">*</span>}
            <Textarea className="mt-1.5" value={note} onChange={(e) => setNote(e.target.value)} data-testid="confirm-note" />
            {opts.note.hint && <span className="mt-1 block text-xs font-normal text-muted">{opts.note.hint}</span>}
          </label>
        )}
      </Dialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm outside ConfirmProvider");
  return ctx;
}
