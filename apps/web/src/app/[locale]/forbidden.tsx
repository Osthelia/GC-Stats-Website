/**
 * GC-Stats — forbidden
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { Metadata } from "next";
import { ShieldAlert } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/site/error-state";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("errors.forbidden");
  return { title: t("title") };
}

export default function Forbidden() {
  const t = useTranslations("errors");

  return (
    <ErrorState
      code={t("forbidden.code")}
      icon={<ShieldAlert className="size-6" />}
      title={t("forbidden.title")}
      body={t("forbidden.body")}
      primaryAction={<Button render={<Link href="/" />}>{t("backHome")}</Button>}
    />
  );
}
