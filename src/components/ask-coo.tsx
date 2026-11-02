"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { useCompany, useI18n, useRun } from "@/lib/store";
import { Button, Notice, Textarea } from "./ui/primitives";
import { postMessage } from "@/lib/domain";

const REPO = "mohamad-ilyas/agency-projects";

/** Claude Code on the web, pre-filled with /ask-coo and the projects repository. */
export function askCooUrl(message: string): string {
  const prompt = `/ask-coo ${message.trim()}`;
  return `https://claude.ai/code?prompt=${encodeURIComponent(prompt)}&repositories=${encodeURIComponent(REPO)}`;
}

/**
 * The CEO's line to Charlotte (COO). The dashboard can't start a Claude session by itself
 * (that would need a paid API), so this records the message and opens Claude with it ready;
 * the CEO presses send and Charlotte answers in that chat.
 */
export function AskCoo({ compact = false }: { compact?: boolean }) {
  const s = useCompany();
  const { t } = useI18n();
  const run = useRun();
  const [text, setText] = useState("");
  const [fallback, setFallback] = useState<string | null>(null);
  const [opened, setOpened] = useState(false);
  if (s.settings.role !== "ceo") return null;

  const send = () => {
    const message = text.trim();
    if (!message) return;
    const url = askCooUrl(message);
    // Open first (synchronously, inside the click) so the browser allows the new tab.
    const win = window.open(url, "_blank", "noopener");
    run((st, ctx) => postMessage(st, ctx, { kind: "direct", refId: null, body: message, authorId: "ceo" }));
    setText("");
    setOpened(!!win);
    setFallback(win ? null : url);
  };

  return (
    <div className="space-y-2.5">
      <label className="sr-only" htmlFor="ask-coo">{t("communication.askTitle")}</label>
      <Textarea
        id="ask-coo"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t("communication.askPlaceholder")}
        className={compact ? "min-h-[64px]" : "min-h-[88px]"}
        data-testid="ask-coo-text"
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" onClick={send} disabled={!text.trim()} data-testid="ask-coo-send">
          <Send className="flip-rtl size-4" />
          {t("communication.askSend")}
        </Button>
        {!compact && <p className="flex-1 text-xs text-muted">{t("communication.askHow")}</p>}
      </div>
      {opened && <Notice>{t("communication.askOpened")}</Notice>}
      {fallback && (
        <Notice tone="warning">
          {t("communication.askPopupBlocked")}{" "}
          <a href={fallback} target="_blank" rel="noopener noreferrer" className="font-medium text-accent underline" data-testid="ask-coo-link">
            claude.ai/code
          </a>
        </Notice>
      )}
    </div>
  );
}
