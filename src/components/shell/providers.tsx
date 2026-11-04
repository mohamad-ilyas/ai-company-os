"use client";

import type { ReactNode } from "react";
import { ToastProvider } from "@/components/ui/toast";
import { ConfirmProvider } from "@/components/ui/dialog";
import { StoreProvider } from "@/lib/store";
import { AppShell } from "./app-shell";
import { ErrorBoundary } from "./error-boundary";

function Splash() {
  return (
    <div className="flex min-h-dvh items-center justify-center" aria-busy="true">
      <div className="flex items-center gap-3 text-sm text-muted">
        <span className="size-2 animate-pulse rounded-full bg-accent" />
        AI Company OS
      </div>
    </div>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <StoreProvider fallback={<Splash />}>
          <ConfirmProvider>
            <AppShell>{children}</AppShell>
          </ConfirmProvider>
        </StoreProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
