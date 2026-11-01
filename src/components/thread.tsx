"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { useCompany, useI18n, useRun } from "@/lib/store";
import { Button, Textarea } from "./ui/primitives";
import { Avatar, SampleBadge } from "./common";
import { Markdown } from "./ui/markdown";
import { can, postMessage } from "@/lib/domain";
import type { ChannelKind } from "@/lib/types";

export function Thread({ kind, refId, emptyText }: { kind: ChannelKind; refId: string | null; emptyText?: string }) {
  const s = useCompany();
  const { t, dateTime, actorName } = useI18n();
  const run = useRun();
  const [body, setBody] = useState("");
  const messages = s.messages.filter((m) => m.kind === kind && (refId === null ? true : m.refId === refId));
  const canPost = can(s.settings.role, "write") && (kind !== "announcement" || s.settings.role === "ceo");

  return (
    <div className="flex flex-col gap-4">
      {messages.length === 0 ? (
        <p className="py-4 text-sm text-muted">{emptyText ?? t("communication.empty")}</p>
      ) : (
        <ol className="space-y-4" data-testid="thread">
          {messages.map((m) => (
            <li key={m.id} className="flex gap-3">
              <Avatar actor={m.authorId} size={32} />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-[13px]">
                  <span className="font-semibold text-fg">{actorName(m.authorId)}</span>
                  <span className="text-xs text-muted">{dateTime(m.at)}</span>
                  <SampleBadge show={m.sample} />
                </p>
                <div className="bidi mt-1 rounded-lg rounded-ss-sm border border-border bg-surface-2/60 px-3 py-2">
                  <Markdown source={m.body} />
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
      {canPost ? (
        <form
          className="flex flex-col gap-2 border-t border-border pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            const r = run((st, ctx) => postMessage(st, ctx, { kind, refId, body }));
            if (r.ok) setBody("");
          }}
        >
          <label className="sr-only" htmlFor={`compose-${kind}-${refId}`}>{t("communication.compose")}</label>
          <Textarea id={`compose-${kind}-${refId}`} value={body} onChange={(e) => setBody(e.target.value)} placeholder={t("communication.compose")} className="min-h-[72px]" data-testid="compose" />
          <div className="flex justify-end">
            <Button type="submit" variant="primary" size="sm" disabled={!body.trim()} data-testid="post-message">
              <Send className="flip-rtl size-4" />
              {t("communication.send")}
            </Button>
          </div>
        </form>
      ) : (
        kind === "announcement" && <p className="text-xs text-muted">{t("communication.onlyCeoAnnounce")}</p>
      )}
    </div>
  );
}
