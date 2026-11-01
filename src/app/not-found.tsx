"use client";

import Link from "next/link";
import { useI18n } from "@/lib/store";
import { EmptyState } from "@/components/ui/primitives";

export default function NotFound() {
  const { t } = useI18n();
  return (
    <EmptyState title={t("notFound.title")} action={<Link href="/" className="text-accent hover:underline">{t("notFound.home")}</Link>}>
      {t("notFound.body")}
    </EmptyState>
  );
}
