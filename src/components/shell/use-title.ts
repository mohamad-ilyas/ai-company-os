"use client";

import { useEffect } from "react";
import { useI18n } from "@/lib/store";

export function useDocumentTitle(title: string) {
  const { t } = useI18n();
  const app = t("app.name");
  useEffect(() => {
    document.title = `${title} · ${app}`;
  }, [title, app]);
}
