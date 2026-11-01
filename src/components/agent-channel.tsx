"use client";

import { useCallback, useEffect, useState } from "react";
import { KeyRound, RefreshCw, RotateCcw, ShieldCheck } from "lucide-react";
import { applyReportToStore, useI18n } from "@/lib/store";
import { cloudConfigured, loadSync, useCloud } from "@/lib/cloud/status";
import type { InboxReport } from "@/lib/cloud/sync";
import { Badge, Button, Card, CardBody, CardHeader, Notice, Textarea, type Tone } from "./ui/primitives";
import { Dialog, useConfirm } from "./ui/dialog";
import { useToast } from "./ui/toast";
import { CopyButton } from "./common";

const MAC_COMMAND = `security add-generic-password -U -s aicos-agent-key -a "$USER" -w`;

const OUTCOME_TONE: Record<string, Tone> = { applied: "success", partial: "warning", rejected: "danger", pending: "neutral" };

export function AgentChannel() {
  const { t, dateTime } = useI18n();
  const cloud = useCloud();
  const confirm = useConfirm();
  const toast = useToast();
  const [info, setInfo] = useState<{ hint: string; createdAt: string } | null | undefined>(undefined);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [reports, setReports] = useState<InboxReport[]>([]);
  const signedIn = !!cloud.email;

  const refresh = useCallback(async () => {
    if (!signedIn) return;
    try {
      const m = await loadSync();
      const [k, r] = await Promise.all([m.getAgentKeyInfo(), m.listReports()]);
      setInfo(k);
      setReports(r);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  }, [signedIn, toast]);

  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    void loadSync()
      .then((m) => Promise.all([m.getAgentKeyInfo(), m.listReports()]))
      .then(([k, r]) => {
        if (!live) return;
        setInfo(k);
        setReports(r);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [signedIn, cloud.lastSyncedAt]);

  if (!cloudConfigured) return null;

  const create = async () => {
    if (info) {
      const r = await confirm({ title: t("agent.replace"), body: t("agent.replaceConfirm"), confirmLabel: t("agent.replace"), cancelLabel: t("common.cancel"), danger: true });
      if (!r.ok) return;
    }
    try {
      const key = await (await loadSync()).createAgentKey();
      setNewKey(key);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Card id="agent-channel">
      <CardHeader title={<span className="flex items-center gap-2"><ShieldCheck className="size-4 text-accent" />{t("agent.title")}</span>} description={t("agent.subtitle")} />
      <CardBody className="space-y-4">
        {!signedIn ? (
          <p className="text-sm text-muted">{t("agent.signInFirst")}</p>
        ) : (
          <>
            <p className="text-sm text-fg" data-testid="agent-key-status">
              {info === undefined ? "…" : info ? t("agent.keyActive", { hint: info.hint, date: dateTime(info.createdAt) }) : t("agent.noKey")}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant={info ? "secondary" : "primary"} onClick={create}>
                <KeyRound className="size-4" />
                {info ? t("agent.replace") : t("agent.create")}
              </Button>
              {info && (
                <Button
                  variant="danger"
                  onClick={async () => {
                    const r = await confirm({ title: t("agent.revoke"), body: t("agent.revokeConfirm"), confirmLabel: t("agent.revoke"), cancelLabel: t("common.cancel"), danger: true });
                    if (!r.ok) return;
                    await (await loadSync()).revokeAgentKey();
                    await refresh();
                  }}
                >
                  {t("agent.revoke")}
                </Button>
              )}
            </div>

            <div className="border-t border-border pt-4">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-fg">{t("agent.inbox")}</h3>
                <Button size="sm" variant="ghost" onClick={refresh}><RefreshCw className="size-4" />{t("agent.refresh")}</Button>
              </div>
              {reports.length === 0 ? (
                <p className="text-sm text-muted">{t("agent.inboxEmpty")}</p>
              ) : (
                <ul className="space-y-2" data-testid="agent-inbox">
                  {reports.map((r) => {
                    const outcome = r.outcome ?? "pending";
                    return (
                      <li key={r.id} className="rounded-lg border border-border px-3 py-2.5 text-[13px]">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={OUTCOME_TONE[outcome]}>{t(`agent.outcome.${outcome as "applied"}`)}</Badge>
                          <span className="text-muted">{dateTime(r.received_at)}</span>
                          <span className="text-muted">· {t("agent.actionCount", { count: Array.isArray(r.payload.actions) ? r.payload.actions.length : 0 })}</span>
                          {r.outcome && r.outcome !== "applied" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="ms-auto"
                              onClick={async () => {
                                await (await loadSync()).reapplyReport(r);
                                await refresh();
                              }}
                            >
                              <RotateCcw className="size-3.5" />
                              {t("agent.reapply")}
                            </Button>
                          )}
                        </div>
                        {r.payload.summary && <p className="bidi mt-1 text-fg">{String(r.payload.summary)}</p>}
                        {r.outcome_detail && <p className="bidi mt-1 text-xs text-fg-2">{r.outcome_detail}</p>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </>
        )}
      </CardBody>

      <Dialog open={!!newKey} onClose={() => setNewKey(null)} title={t("agent.title")} size="lg" footer={<Button variant="primary" onClick={() => setNewKey(null)}>{t("common.close")}</Button>}>
        {newKey && (
          <div className="space-y-4 text-sm">
            <Notice tone="warning">{t("agent.showOnce")}</Notice>
            <div className="flex items-center gap-2">
              <code dir="ltr" className="flex-1 break-all rounded-md bg-surface-2 px-3 py-2 font-mono text-xs text-fg" data-testid="agent-key">{newKey}</code>
              <CopyButton text={newKey} />
            </div>
            <p className="text-fg-2">{t("agent.whereMac")}</p>
            <div className="flex items-center gap-2">
              <code dir="ltr" className="flex-1 overflow-x-auto whitespace-nowrap rounded-md bg-surface-2 px-3 py-2 font-mono text-xs text-fg">{MAC_COMMAND}</code>
              <CopyButton text={MAC_COMMAND} />
            </div>
            <p className="text-fg-2">{t("agent.whereWeb")}</p>
          </div>
        )}
      </Dialog>
    </Card>
  );
}

/** Manual fallback: paste a team report produced by a session without the agent key. */
export function ImportReportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const [text, setText] = useState("");
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("agent.importTitle")}
      description={t("agent.importHint")}
      size="lg"
      footer={
        <>
          <Button onClick={onClose}>{t("common.cancel")}</Button>
          <Button
            variant="primary"
            disabled={!text.trim()}
            data-testid="apply-report"
            onClick={() => {
              const raw = text.trim();
              const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
              let data: unknown;
              try {
                data = JSON.parse(fenced ? fenced[1] : raw);
              } catch {
                toast.error(t("errors.not_json"));
                return;
              }
              const r = applyReportToStore(data);
              if (r.outcome === "rejected") toast.error(t("agent.received", { detail: r.detail }));
              else {
                toast.success(t("agent.received", { detail: r.detail }));
                setText("");
                onClose();
              }
            }}
          >
            {t("agent.importButton")}
          </Button>
        </>
      }
    >
      <Textarea dir="ltr" value={text} onChange={(e) => setText(e.target.value)} className="min-h-[40vh] font-mono text-xs" data-testid="report-paste" />
    </Dialog>
  );
}
