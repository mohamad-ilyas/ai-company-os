"use client";

import { useState } from "react";
import { Cloud, CloudOff, LogOut, Mail, RefreshCw } from "lucide-react";
import { replaceState, useCompany, useI18n } from "@/lib/store";
import { cloudConfigured, loadSync, useCloud, type CloudStatus } from "@/lib/cloud/status";
import { Badge, Button, Card, CardBody, CardHeader, Input, Notice, type Tone } from "./ui/primitives";
import { useConfirm } from "./ui/dialog";
import { useToast } from "./ui/toast";
import { createSeed } from "@/data/seed";

const TONE: Record<CloudStatus, Tone> = {
  disabled: "neutral",
  signed_out: "neutral",
  link_sent: "info",
  syncing: "info",
  synced: "success",
  offline: "warning",
  error: "danger",
};

export function CloudStatusBadge() {
  const { t } = useI18n();
  const cloud = useCloud();
  return (
    <Badge tone={TONE[cloud.status]} dot>
      {t(`cloud.status.${cloud.status}`)}
    </Badge>
  );
}

export function CloudSection() {
  const s = useCompany();
  const { t, dateTime } = useI18n();
  const cloud = useCloud();
  const toast = useToast();
  const confirm = useConfirm();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const signedIn = !!cloud.email;

  return (
    <Card id="cloud">
      <CardHeader
        title={<span className="flex items-center gap-2">{cloudConfigured ? <Cloud className="size-4 text-accent" /> : <CloudOff className="size-4 text-muted" />}{t("cloud.title")}</span>}
        description={t("cloud.subtitle")}
        actions={<CloudStatusBadge />}
      />
      <CardBody className="space-y-4">
        {!cloudConfigured ? (
          <p className="text-sm text-fg-2">{t("cloud.notConfigured")}</p>
        ) : signedIn ? (
          <>
            <p className="text-sm text-fg" data-testid="cloud-account">{t("cloud.signedInAs", { email: cloud.email! })}</p>
            {cloud.lastSyncedAt && <p className="text-xs text-muted">{t("cloud.lastSynced")}: {dateTime(cloud.lastSyncedAt)}</p>}
            {(cloud.status === "offline" || cloud.status === "error") && (
              <Notice tone="warning">
                {t("cloud.offlineHint")}
                {cloud.error && <span dir="ltr" className="mt-1 block font-mono text-xs text-fg-2">{cloud.error}</span>}
              </Notice>
            )}
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void loadSync().then((m) => m.syncNow())} disabled={cloud.status === "syncing"}>
                <RefreshCw className="size-4" />
                {t("cloud.syncNow")}
              </Button>
              <Button variant="ghost" onClick={() => void loadSync().then((m) => m.signOut())}>
                <LogOut className="size-4" />
                {t("cloud.signOut")}
              </Button>
              <Button
                variant="danger"
                onClick={async () => {
                  const r = await confirm({ title: t("cloud.signOutClear"), body: t("cloud.signOutClearConfirm"), confirmLabel: t("cloud.signOutClear"), cancelLabel: t("common.cancel"), danger: true });
                  if (!r.ok) return;
                  const m = await loadSync();
                  await m.signOut();
                  const seed = createSeed();
                  seed.settings = { ...seed.settings, locale: s.settings.locale, theme: s.settings.theme };
                  replaceState(seed, "data_reset");
                }}
              >
                {t("cloud.signOutClear")}
              </Button>
            </div>
          </>
        ) : (
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setSending(true);
              const m = await loadSync();
              const r = await m.sendSignInLink(email);
              setSending(false);
              if (!r.ok) toast.error(r.error ?? t("common.error"));
            }}
          >
            <label className="block text-[13px] font-medium text-fg">
              {t("cloud.email")}
              <Input type="email" required dir="ltr" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5" data-testid="cloud-email" />
            </label>
            <Button type="submit" variant="primary" disabled={sending || !email.trim()}>
              <Mail className="size-4" />
              {t("cloud.sendLink")}
            </Button>
            {cloud.status === "link_sent" && <Notice>{t("cloud.linkSent")}</Notice>}
          </form>
        )}
        <p className="text-xs text-muted">{t("cloud.deviceNote")}</p>
      </CardBody>
    </Card>
  );
}
