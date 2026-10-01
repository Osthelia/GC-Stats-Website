/**
 * GC-Stats — not-found
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { Metadata } from "next";
import { SearchX } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/site/error-state";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("errors.notFound");
  return { title: t("title") };
}

export default function DashboardNotFound() {
  const t = useTranslations("errors");

  return (
    <ErrorState
      compact
      code={t("notFound.code")}
      icon={<SearchX className="size-6" />}
      title={t("notFound.title")}
      body={t("notFound.body")}
      primaryAction={<Button render={<Link href="/dashboard" />}>{t("backToDashboard")}</Button>}
    />
  );
}
