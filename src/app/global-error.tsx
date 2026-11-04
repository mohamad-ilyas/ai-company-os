"use client";

// Shown if the root layout itself fails. Page-level crashes are caught by ErrorBoundary (providers.tsx).
import "./globals.css";
import { RecoveryScreen } from "@/components/shell/error-boundary";

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-bg">
        <RecoveryScreen error={error} onReload={() => (reset ? reset() : window.location.reload())} />
      </body>
    </html>
  );
}
