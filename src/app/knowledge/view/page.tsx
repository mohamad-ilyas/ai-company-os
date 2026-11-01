"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { useCompany, useI18n, useRun } from "@/lib/store";
import { Badge, Button, Card, CardBody, EmptyState } from "@/components/ui/primitives";
import { useConfirm } from "@/components/ui/dialog";
import { Markdown } from "@/components/ui/markdown";
import { ActorChip, CopyButton, useQueryParam } from "@/components/common";
import { ArticleEditor } from "@/components/article-editor";
import { can, deleteArticle } from "@/lib/domain";
import { routes } from "@/lib/routes";
import { useDocumentTitle } from "@/components/shell/use-title";

function ArticleView() {
  const s = useCompany();
  const { t, dateTime } = useI18n();
  const run = useRun();
  const confirm = useConfirm();
  const router = useRouter();
  const id = useQueryParam("id");
  const [editing, setEditing] = useState(false);
  const k = s.knowledge.find((x) => x.id === id);
  useDocumentTitle(k ? k.title : t("knowledge.title"));
  if (!k) return <EmptyState title={t("errors.not_found", { id: id ?? "—" })} action={<Link className="text-accent hover:underline" href={routes.knowledge}>{t("nav.knowledge")}</Link>} />;

  return (
    <>
      <Link href={routes.knowledge} className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-fg-2 hover:text-fg">
        <ArrowLeft className="flip-rtl size-4" aria-hidden />
        {t("nav.knowledge")}
      </Link>
      <article className="mx-auto max-w-3xl">
        <header className="mb-6">
          <p className="text-xs text-muted">{t(`knowledgeCategory.${k.category}`)} · <span className="tabular">{k.id}</span></p>
          <h1 className="bidi mt-1 text-2xl font-semibold tracking-tight text-fg" data-testid="article-heading">{k.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted">
            <ActorChip actor={k.authorId} size={20} />
            <span>{t("common.updated")}: {dateTime(k.updatedAt)}</span>
            {k.tags.map((tag) => <Badge key={tag}>{tag}</Badge>)}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {k.category === "prompt" && <CopyButton text={k.body} />}
            {can(s.settings.role, "write") && <Button size="sm" onClick={() => setEditing(true)} data-testid="edit-article"><Pencil className="size-4" />{t("common.edit")}</Button>}
            {can(s.settings.role, "delete") && (
              <Button
                size="sm"
                variant="danger"
                onClick={async () => {
                  const r = await confirm({ title: t("common.delete"), body: t("knowledge.deleteConfirm", { title: k.title }), confirmLabel: t("common.delete"), cancelLabel: t("common.cancel"), danger: true });
                  if (r.ok && run((st, ctx) => deleteArticle(st, ctx, k.id)).ok) router.push(routes.knowledge);
                }}
              >
                <Trash2 className="size-4" />
                {t("common.delete")}
              </Button>
            )}
          </div>
        </header>
        <Card>
          <CardBody className="py-6">
            {/* Knowledge content is authored in English; keep it left-to-right inside Arabic layouts. */}
            <div dir="auto">
              <Markdown source={k.body} />
            </div>
          </CardBody>
        </Card>
      </article>
      {editing && <ArticleEditor article={k} onClose={() => setEditing(false)} />}
    </>
  );
}

export default function Page() {
  return (
    <Suspense>
      <ArticleView />
    </Suspense>
  );
}
