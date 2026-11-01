"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { BookOpen, Plus, Search, UserCog } from "lucide-react";
import { useCompany, useI18n } from "@/lib/store";
import { Button, Card, CardBody, CardHeader, EmptyState, Input, PageHeader } from "@/components/ui/primitives";
import { Avatar } from "@/components/common";
import { ArticleEditor } from "@/components/article-editor";
import { can } from "@/lib/domain";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/cn";
import { useDocumentTitle } from "@/components/shell/use-title";
import { KNOWLEDGE_CATEGORIES, type KnowledgeCategory } from "@/lib/types";

export default function KnowledgePage() {
  const s = useCompany();
  const { t, l, date } = useI18n();
  const router = useRouter();
  useDocumentTitle(t("knowledge.title"));
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<KnowledgeCategory | "">("");
  const [creating, setCreating] = useState(false);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return s.knowledge.filter((k) => (!cat || k.category === cat) && (!needle || `${k.title} ${k.body} ${k.tags.join(" ")}`.toLowerCase().includes(needle)));
  }, [s.knowledge, q, cat]);

  return (
    <>
      <PageHeader
        title={t("knowledge.title")}
        subtitle={t("knowledge.subtitle")}
        actions={can(s.settings.role, "write") && <Button variant="primary" onClick={() => setCreating(true)} data-testid="new-article"><Plus className="size-4" />{t("knowledge.new")}</Button>}
      />
      <div className="grid gap-6 lg:grid-cols-[15rem_1fr]">
        <div className="space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute start-3 top-2.5 size-4 text-muted" aria-hidden />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("knowledge.search")} aria-label={t("knowledge.search")} className="ps-9" data-testid="kb-search" />
          </div>
          <nav aria-label={t("common.category")}>
            <ul className="space-y-0.5">
              {[{ id: "" as const, label: t("common.all"), n: s.knowledge.length }, ...KNOWLEDGE_CATEGORIES.map((c) => ({ id: c, label: t(`knowledgeCategory.${c}`), n: s.knowledge.filter((k) => k.category === c).length }))].map((c) => (
                <li key={c.id || "all"}>
                  <button
                    onClick={() => setCat(c.id)}
                    aria-current={cat === c.id ? "true" : undefined}
                    className={cn("flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-start text-[13px]", cat === c.id ? "bg-surface font-medium text-fg shadow-card ring-1 ring-border" : "text-fg-2 hover:bg-surface-2")}
                  >
                    {c.label}
                    <span className="tabular text-xs text-muted">{c.n}</span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <div className="space-y-6">
          {rows.length === 0 ? <EmptyState icon={<BookOpen className="size-6" />} title={t("knowledge.none")} /> : (
            <div className="grid gap-3 md:grid-cols-2" data-testid="kb-list">
              {rows.map((k) => (
                <Link key={k.id} href={routes.article(k.id)} className="rounded-xl border border-border bg-surface p-4 shadow-card transition-colors hover:border-border-strong">
                  <p className="text-xs text-muted">{t(`knowledgeCategory.${k.category}`)} · <span className="tabular">{k.id}</span></p>
                  <p className="bidi mt-1 font-semibold text-fg">{k.title}</p>
                  <p className="mt-1 line-clamp-2 text-[13px] text-fg-2">{k.body.replace(/[#*`>|_-]/g, " ").replace(/\s+/g, " ").slice(0, 180)}</p>
                  <p className="mt-2 text-xs text-muted">{date(k.updatedAt)}</p>
                </Link>
              ))}
            </div>
          )}
          {(!cat || cat === "prompt") && !q && (
            <Card>
              <CardHeader title={<span className="flex items-center gap-2"><UserCog className="size-4 text-muted" />{t("knowledge.employeeInstructions")}</span>} description={t("knowledge.employeeInstructionsHint")} />
              <CardBody>
                <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {s.employees.map((e) => (
                    <li key={e.id}>
                      <Link href={routes.employee(e.id)} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] hover:bg-surface-2">
                        <Avatar actor={e.id} size={24} />
                        <span className="min-w-0"><span className="block truncate text-fg">{l(e.name)}</span><span className="block truncate text-xs text-muted">{l(e.title)}</span></span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          )}
        </div>
      </div>
      {creating && <ArticleEditor onClose={() => setCreating(false)} onSaved={(id) => router.push(routes.article(id))} />}
    </>
  );
}
