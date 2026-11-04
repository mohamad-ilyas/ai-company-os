"use client";

// Last line of defence: if any page crashes while rendering, show a recovery screen
// instead of a blank page — the CEO can always download their raw data or go back
// to a backup without browser developer tools. Deliberately independent of the store
// and the i18n module (either may be what failed).

import { Component, type ErrorInfo, type ReactNode } from "react";

const TEXT = {
  en: {
    title: "Something went wrong on this page",
    body: "Your saved data has not been changed. Reload to try again. If it keeps happening, download your data first, then restore a previous copy from Settings → Data or import the download on another device.",
    reload: "Reload",
    download: "Download my data",
    settings: "Open Settings → Data",
    details: "Technical details",
  },
  ar: {
    title: "حدث خطأ في هذه الصفحة",
    body: "لم تتغير بياناتك المحفوظة. أعد التحميل للمحاولة مجددًا. وإن تكرر الخطأ فنزّل بياناتك أولًا، ثم استعد نسخة سابقة من الإعدادات ← البيانات أو استورد الملف على جهاز آخر.",
    reload: "إعادة التحميل",
    download: "تنزيل بياناتي",
    settings: "فتح الإعدادات ← البيانات",
    details: "تفاصيل تقنية",
  },
};

function locale(): "en" | "ar" {
  try {
    return JSON.parse(localStorage.getItem("aicos:prefs") ?? "{}").locale === "ar" ? "ar" : "en";
  } catch {
    return "en";
  }
}

/** Everything this app keeps in the browser, unparsed — works even when the data itself is what breaks the app. */
export function downloadRawData() {
  const out: Record<string, unknown> = { exportedAt: new Date().toISOString() };
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)!;
      if (key.startsWith("aicos:") && key !== "aicos:auth") out[key] = localStorage.getItem(key);
    }
  } catch {
    out.error = "localStorage unavailable";
  }
  const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `ai-company-os-raw-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function RecoveryScreen({ error, onReload }: { error: unknown; onReload: () => void }) {
  const lang = locale();
  const tx = TEXT[lang];
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  return (
    <div dir={lang === "ar" ? "rtl" : "ltr"} lang={lang} className="flex min-h-dvh items-center justify-center bg-bg p-6" role="alert" data-testid="recovery-screen">
      <div className="w-full max-w-lg space-y-4 rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-fg">{tx.title}</h1>
        <p className="text-sm text-fg-2">{tx.body}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onReload} className="h-10 rounded-md bg-accent px-4 text-sm font-medium text-white">{tx.reload}</button>
          <button type="button" onClick={downloadRawData} className="h-10 rounded-md border border-border px-4 text-sm font-medium text-fg" data-testid="recovery-download">{tx.download}</button>
          <a href={`${base}/settings/#data`} className="inline-flex h-10 items-center rounded-md border border-border px-4 text-sm font-medium text-fg">{tx.settings}</a>
        </div>
        <details className="text-xs text-muted">
          <summary>{tx.details}</summary>
          <pre dir="ltr" className="mt-2 whitespace-pre-wrap break-all font-mono">{error instanceof Error ? `${error.name}: ${error.message}` : String(error)}</pre>
        </details>
      </div>
    </div>
  );
}

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: unknown }> {
  state = { error: null as unknown };

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error("AI Company OS crashed while rendering", error, info.componentStack);
  }

  render() {
    if (this.state.error) return <RecoveryScreen error={this.state.error} onReload={() => window.location.reload()} />;
    return this.props.children;
  }
}
