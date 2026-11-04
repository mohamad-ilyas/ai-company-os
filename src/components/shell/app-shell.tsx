"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
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
import { APPROVAL_LEVEL } from "@/lib/workflow";
import type { TKey } from "@/lib/i18n";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/primitives";
import { CloudStatusBadge } from "@/components/cloud-section";
import { cloudConfigured } from "@/lib/cloud/status";

type NavItem = { href: string; key: TKey; icon: typeof Users; badge?: number; badgeTone?: "warning" | "danger" | "info" };

/** What needs the CEO: their pending decisions, blocked tasks, and outputs waiting for review (one rule everywhere). */
export function useAttention() {
  const s = useCompany();
  return {
    approvals: s.approvals.filter((a) => a.status === "pending" && APPROVAL_LEVEL[a.action] === "ceo").length,
    urgent: s.approvals.filter((a) => a.status === "pending" && a.urgent).length,
    blocked: s.tasks.filter((t) => t.status === "blocked").length,
    reviews: s.executions.filter((e) => e.reviewStatus === "pending").length,
  };
}

function useNav(): { group: TKey; items: NavItem[] }[] {
  const s = useCompany();
  const n = s.settings.notifications;
  const { approvals: pendingApprovals, blocked, reviews } = useAttention();
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
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4" aria-label={t("common.mainNav")}>
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
                        "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13.5px] transition-colors pointer-coarse:py-3",
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
        {cloudConfigured ? (
          <Link href="/settings/" className="block" title={t("cloud.title")} data-testid="sidebar-cloud">
            <CloudStatusBadge />
          </Link>
        ) : (
          <p className="flex items-center gap-1.5" title={t("app.localModeHint")}>
            <span className="size-1.5 rounded-full bg-success-mark" aria-hidden />
            {t("app.localMode")}
          </p>
        )}
        <p>{t("app.zeroSpend")}</p>
      </div>
    </div>
  );
}

function Topbar({ onMenu, menuRef }: { onMenu: () => void; menuRef: RefObject<HTMLButtonElement | null> }) {
  const s = useCompany();
  const { t, locale } = useI18n();
  const run = useRun();
  const attention = useAttention();
  const n = s.settings.notifications;
  const waiting = (n.approvals ? attention.approvals : 0) + (n.blockedTasks ? attention.blocked : 0) + (n.reviews ? attention.reviews : 0);
  const theme = s.settings.theme;
  const nextTheme = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
  const ThemeIcon = theme === "light" ? Sun : theme === "dark" ? Moon : SunMoon;

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-bg/85 px-4 backdrop-blur lg:px-8">
      <button
        ref={menuRef}
        onClick={onMenu}
        className="relative flex size-9 items-center justify-center rounded-md text-fg-2 hover:bg-surface-2 pointer-coarse:size-11 lg:hidden"
        aria-label={waiting ? `${t("app.menu")} (${t("app.waitingCount", { count: waiting })})` : t("app.menu")}
        data-testid="menu-button"
      >
        <Menu className="size-5" />
        {waiting > 0 && (
          <span className="tabular absolute end-0.5 top-0.5 flex min-w-4 items-center justify-center rounded-full bg-danger-mark px-1 text-[10px] font-semibold leading-4 text-white" aria-hidden data-testid="menu-badge">
            {waiting}
          </span>
        )}
      </button>
      <div className="flex-1" />
      <Badge tone={s.settings.role === "ceo" ? "accent" : "warning"} title={t("app.role")}>
        {t(`role.${s.settings.role}`)}
      </Badge>
      <button
        onClick={() => run((st, ctx) => updateSettings(st, ctx, { locale: locale === "ar" ? "en" : "ar" }))}
        className="flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] text-fg-2 hover:bg-surface-2 hover:text-fg pointer-coarse:h-11"
        aria-label={`${t("app.switchTo")} — ${t("app.language")}`}
        data-testid="toggle-language"
      >
        <Languages className="size-4" aria-hidden />
        <span lang={locale === "ar" ? "en" : "ar"}>{t("app.switchTo")}</span>
      </button>
      <button
        onClick={() => run((st, ctx) => updateSettings(st, ctx, { theme: nextTheme }))}
        className="flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] text-fg-2 hover:bg-surface-2 hover:text-fg pointer-coarse:h-11 pointer-coarse:min-w-11"
        aria-label={`${t("app.theme")}: ${t(`app.${theme}`)} — ${t("app.themeNext", { next: t(`app.${nextTheme}`) })}`}
        title={`${t("app.theme")}: ${t(`app.${theme}`)}`}
        data-testid="toggle-theme"
      >
        <ThemeIcon className="size-4" aria-hidden />
        <span className="hidden sm:inline">{t("app.theme")}: {t(`app.${theme}`)}</span>
      </button>
    </header>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { t } = useI18n();
  const menuRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    // Focus moves into the menu when it opens and back to the menu button when it closes.
    if (open) closeRef.current?.focus();
    else if (wasOpen.current) menuRef.current?.focus();
    wasOpen.current = open;
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
            <button ref={closeRef} onClick={() => setOpen(false)} className="absolute end-3 top-4 flex size-8 items-center justify-center rounded-md text-fg-2 hover:bg-surface-2 pointer-coarse:size-11" aria-label={t("app.closeMenu")}>
              <X className="size-4" />
            </button>
            <Sidebar onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}
      {/* While the menu is open, the page behind it can't be reached by keyboard or screen reader. */}
      <div className="lg:ps-64" inert={open}>
        <Topbar onMenu={() => setOpen(true)} menuRef={menuRef} />
        <main id="main" className="mx-auto w-full max-w-[1400px] px-4 py-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
