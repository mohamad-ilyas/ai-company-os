"use client";

import { useState } from "react";
import { useI18n, useRun } from "@/lib/store";
import { Button, Field, Input, Select, Textarea } from "./ui/primitives";
import { Dialog } from "./ui/dialog";
import { Markdown } from "./ui/markdown";
import { upsertArticle } from "@/lib/domain";
import { KNOWLEDGE_CATEGORIES, type KnowledgeArticle, type KnowledgeCategory } from "@/lib/types";

export function ArticleEditor({ article, onClose, onSaved }: { article?: KnowledgeArticle; onClose: () => void; onSaved?: (id: string) => void }) {
  const { t } = useI18n();
  const run = useRun();
  const [f, setF] = useState({
    title: article?.title ?? "",
    category: article?.category ?? ("sop" as KnowledgeCategory),
    body: article?.body ?? "",
    tags: (article?.tags ?? []).join(", "),
  });
  const [preview, setPreview] = useState(false);
  return (
    <Dialog
      open
      onClose={onClose}
      title={article ? t("knowledge.edit") : t("knowledge.new")}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={() => setPreview((p) => !p)}>{preview ? t("common.edit") : t("knowledge.preview")}</Button>
          <Button onClick={onClose}>{t("common.cancel")}</Button>
          <Button
            variant="primary"
            data-testid="save-article"
            onClick={() => {
              const r = run<string>(
                (st, ctx) =>
                  upsertArticle(st, ctx, {
                    id: article?.id,
                    title: f.title,
                    category: f.category,
                    body: f.body,
                    tags: f.tags.split(",").map((x) => x.trim()).filter(Boolean),
                  }),
                t("common.saved"),
              );
              if (r.ok && r.value) {
                onClose();
                onSaved?.(r.value);
              }
            }}
          >
            {t("common.save")}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("common.title")} required className="sm:col-span-2">{(id) => <Input id={id} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} data-testid="article-title" />}</Field>
        <Field label={t("common.category")}>
          {(id) => (
            <Select id={id} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as KnowledgeCategory })}>
              {KNOWLEDGE_CATEGORIES.map((c) => <option key={c} value={c}>{t(`knowledgeCategory.${c}`)}</option>)}
            </Select>
          )}
        </Field>
        <Field label={t("common.tags")} hint={t("knowledge.tagsHint")}>{(id, hint) => <Input id={id} aria-describedby={hint} value={f.tags} onChange={(e) => setF({ ...f, tags: e.target.value })} />}</Field>
        <div className="sm:col-span-2">
          {preview ? (
            <div className="min-h-[40vh] rounded-lg border border-border p-4"><Markdown source={f.body || "—"} /></div>
          ) : (
            <Field label={t("knowledge.body")} required>
              {(id) => <Textarea id={id} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} className="min-h-[40vh] font-mono text-[13px]" data-testid="article-body" />}
            </Field>
          )}
        </div>
      </div>
    </Dialog>
  );
}
