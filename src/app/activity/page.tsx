"use client";

import { useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
import { useCompany, useI18n } from "@/lib/store";
import { Button, Card, CardBody, Input, PageHeader, Select } from "@/components/ui/primitives";
import { ActivityList, downloadFile, useActivityText } from "@/components/common";
import { useDocumentTitle } from "@/components/shell/use-title";
import { ACTIVITY_TYPES, type ActivityType, type ActorId } from "@/lib/types";

const PAGE = 50;

export default function ActivityPage() {
  const s = useCompany();
  const { t, l } = useI18n();
  const text = useActivityText();
  useDocumentTitle(t("activityPage.title"));
  const [q, setQ] = useState("");
  const [type, setType] = useState<ActivityType | "">("");
  const [actor, setActor] = useState<ActorId | "">("");
  const [limit, setLimit] = useState(PAGE);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return s.activity.filter((e) => (!type || e.type === type) && (!actor || e.actor === actor) && (!needle || `${text(e)} ${e.refId ?? ""}`.toLowerCase().includes(needle)));
  }, [s.activity, q, type, actor, text]);

  return (
    <>
      <PageHeader
        title={t("activityPage.title")}
        subtitle={t("activityPage.subtitle")}
        actions={
          <Button onClick={() => downloadFile(`activity-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(s.activity, null, 2))}>
            <Download className="size-4" />
            {t("activityPage.exportLog")}
          </Button>
        }
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="relative">
          <Search className="pointer-events-none absolute start-3 top-2.5 size-4 text-muted" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("activityPage.search")} aria-label={t("activityPage.search")} className="ps-9" data-testid="activity-search" />
        </div>
        <Select value={type} onChange={(e) => setType(e.target.value as ActivityType | "")} aria-label={t("common.type")}>
          <option value="">{t("common.type")}: {t("common.all")}</option>
          {ACTIVITY_TYPES.map((x) => <option key={x} value={x}>{t(`activityType.${x}`)}</option>)}
        </Select>
        <Select value={actor} onChange={(e) => setActor(e.target.value as ActorId | "")} aria-label={t("common.actor")}>
          <option value="">{t("common.actor")}: {t("common.all")}</option>
          <option value="ceo">{t("common.ceo")}</option>
          <option value="system">{t("common.system")}</option>
          {s.employees.map((e) => <option key={e.id} value={e.id}>{l(e.name)}</option>)}
        </Select>
      </div>
      <Card>
        <CardBody className="py-1" >
          <div data-testid="activity-list"><ActivityList events={rows.slice(0, limit)} /></div>
        </CardBody>
      </Card>
      {rows.length > limit && (
        <div className="mt-4 flex justify-center">
          <Button onClick={() => setLimit((n) => n + PAGE)}>{t("common.viewAll")} ({rows.length - limit})</Button>
        </div>
      )}
    </>
  );
}
