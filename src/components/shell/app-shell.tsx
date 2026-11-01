"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  Activity,
  BarChart3,
  BookOpen,
  Building2,
  CheckSquare,
  FolderKanban,
  FolderOpen,
  GitBranch,
  Languages,
  LayoutDashboard,
  Menu,
  MessagesSquare,
  Moon,
  Network,
  PlayCircle,
  Settings,
  ShieldCheck,
  Sun,
  SunMoon,
  Users,
  X,
} from "lucide-react";
import { useCompany, useI18n, useRun } from "@/lib/store";
import { updateSettings } from "@/lib/domain";
import type { TKey } from "@/lib/i18n";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/primitives";

type NavItem = { href: string; key: TKey; icon: typeof Users; badge?: number; badgeTone?: "warning" | "danger" | "info" };

function useNav(): { group: TKey; items: NavItem[] }[] {
  const s = useCompany();
  const n = s.settings.notifications;
  const pendingApprovals = s.approvals.filter((a) => a.status === "pending").length;
  const blocked = s.tasks.filter((t) => t.status === "blocked").length;
  const reviews = s.executions.filter((e) => e.reviewStatus === "pending").length;
  return [
    { group: "nav.groupCompany", items: [{ href: "/", key: "nav.overview", icon: LayoutDashboard }] },
    {
      group: "nav.groupOrg",
      items: [
        { href: "/org/", key: "nav.org", icon: Network },
        { href: "/employees/", key: "nav.employees", icon: Users },
        { href: "/departments/", key: "nav.departments", icon: Building2 },
      ],
    },
    {
      group: "nav.groupWork",
      items: [
        { href: "/projects/", key: "nav.projects", icon: FolderKanban },
        { href: "/tasks/", key: "nav.tasks", icon: CheckSquare, badge: n.blockedTasks ? blocked : 0, badgeTone: "danger" },
        { href: "/workflow/", key: "nav.workflow", icon: GitBranch },
        { href: "/execution/", key: "nav.execution", icon: PlayCircle, badge: n.reviews ? reviews : 0, badgeTone: "info" },
        { href: "/approvals/", key: "nav.approvals", icon: ShieldCheck, badge: n.approvals ? pendingApprovals : 0, badgeTone: "warning" },
      ],
    },
    {
      group: "nav.groupOps",
      items: [
        { href: "/communication/", key: "nav.communication", icon: MessagesSquare },
        { href: "/deliverables/", key: "nav.deliverables", icon: FolderOpen },
        { href: "/knowledge/", key: "nav.knowledge", icon: BookOpen },
        { href: "/activity/", key: "nav.activity", icon: Activity },
        { href: "/analytics/", key: "nav.analytics", icon: BarChart3 },
        { href: "/settings/", key: "nav.settings", icon: Settings },
      ],
    },
  ];
}

function isActive(pathname: string, href: string) {
  // usePathname() omits the base path; normalise trailing slashes.
  const p = pathname.endsWith("/") ? pathname : `${pathname}/`;
  return href === "/" ? p === "/" : p.startsWith(href);
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const s = useCompany();
  const { t } = useI18n();
  const pathname = usePathname();
  const nav = useNav();
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-4 pb-4 pt-5">
        <span className="flex size-8 items-center justify-center rounded-lg bg-fg text-[13px] font-bold text-bg" aria-hidden>
          AI
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-fg">{s.settings.companyName || t("app.name")}</p>
          <p className="truncate text-xs text-muted">{s.settings.founderTitle}</p>
        </div>
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4" aria-label="Main">
        {nav.map((g) => (
          <div key={g.group}>
            <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">{t(g.group)}</p>
            <ul className="space-y-0.5">
              {g.items.map((item) => {
                const active = isActive(pathname, item.href);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13.5px] transition-colors",
                        active ? "bg-surface text-fg shadow-card ring-1 ring-border" : "text-fg-2 hover:bg-surface-2 hover:text-fg",
                      )}
                    >
                      <Icon className={cn("size-4 shrink-0", active ? "text-accent" : "text-muted")} aria-hidden />
                      <span className="flex-1 truncate">{t(item.key)}</span>
                      {!!item.badge && (
                        <Badge tone={item.badgeTone} className="tabular px-1.5 py-0 leading-[18px]">
                          {item.badge}
                        </Badge>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="space-y-1.5 border-t border-border px-4 py-3 text-xs text-muted">
        <p className="flex items-center gap-1.5" title={t("app.localModeHint")}>
          <span className="size-1.5 rounded-full bg-success-mark" aria-hidden />
          {t("app.localMode")}
        </p>
        <p>{t("app.zeroSpend")}</p>
      </div>
    </div>
  );
}

function Topbar({ onMenu }: { onMenu: () => void }) {
  const s = useCompany();
  const { t, locale } = useI18n();
  const run = useRun();
  const theme = s.settings.theme;
  const nextTheme = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
  const ThemeIcon = theme === "light" ? Sun : theme === "dark" ? Moon : SunMoon;

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-bg/85 px-4 backdrop-blur lg:px-8">
      <button onClick={onMenu} className="rounded-md p-2 text-fg-2 hover:bg-surface-2 lg:hidden" aria-label={t("app.menu")}>
        <Menu className="size-5" />
      </button>
      <div className="flex-1" />
      <Badge tone={s.settings.role === "ceo" ? "accent" : "warning"} title={t("app.role")}>
        {t(`role.${s.settings.role}`)}
      </Badge>
      <button
        onClick={() => run((st, ctx) => updateSettings(st, ctx, { locale: locale === "ar" ? "en" : "ar" }))}
        className="flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] text-fg-2 hover:bg-surface-2 hover:text-fg"
        aria-label={t("app.language")}
        data-testid="toggle-language"
      >
        <Languages className="size-4" aria-hidden />
        <span lang={locale === "ar" ? "en" : "ar"}>{t("app.switchTo")}</span>
      </button>
      <button
        onClick={() => run((st, ctx) => updateSettings(st, ctx, { theme: nextTheme }))}
        className="flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] text-fg-2 hover:bg-surface-2 hover:text-fg"
        aria-label={`${t("app.theme")}: ${t(`app.${theme}`)}`}
        title={`${t("app.theme")}: ${t(`app.${theme}`)}`}
        data-testid="toggle-theme"
      >
        <ThemeIcon className="size-4" aria-hidden />
        <span className="hidden sm:inline">{t(`app.${theme}`)}</span>
      </button>
    </header>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { t } = useI18n();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="min-h-dvh">
      <a href="#main" className="sr-only z-50 rounded bg-surface px-3 py-2 focus:not-sr-only focus:fixed focus:start-3 focus:top-3">
        {t("app.skip")}
      </a>
      <aside className="fixed inset-y-0 start-0 z-40 hidden w-64 border-e border-border bg-bg lg:block">
        <Sidebar />
      </aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label={t("app.menu")}>
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 start-0 w-72 max-w-[85vw] border-e border-border bg-bg shadow-xl">
            <button onClick={() => setOpen(false)} className="absolute end-3 top-5 rounded-md p-1.5 text-fg-2 hover:bg-surface-2" aria-label={t("app.closeMenu")}>
              <X className="size-4" />
            </button>
            <Sidebar onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}
      <div className="lg:ps-64">
        <Topbar onMenu={() => setOpen(true)} />
        <main id="main" className="mx-auto w-full max-w-[1400px] px-4 py-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
