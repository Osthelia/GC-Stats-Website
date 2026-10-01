/**
 * GC-Stats — unauthorized
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { Metadata } from "next";
import { LockKeyhole } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/site/error-state";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("errors.unauthorized");
  return { title: t("title") };
}

export default function Unauthorized() {
  const t = useTranslations("errors");

  return (
    <ErrorState
      code={t("unauthorized.code")}
      icon={<LockKeyhole className="size-6" />}
      title={t("unauthorized.title")}
      body={t("unauthorized.body")}
      primaryAction={<Button render={<Link href="/login" />}>{t("logIn")}</Button>}
      secondaryAction={
        <Button variant="outline" render={<Link href="/" />}>
          {t("backHome")}
        </Button>
      }
    />
  );
}
