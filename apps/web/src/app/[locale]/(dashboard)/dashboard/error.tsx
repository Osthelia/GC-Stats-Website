/**
 * GC-Stats — error
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useEffect } from "react";
import { ServerCrash } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/site/error-state";

export default function DashboardError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const t = useTranslations("errors");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorState
      compact
      code={t("serverError.code")}
      icon={<ServerCrash className="size-6" />}
      title={t("serverError.title")}
      body={t("serverError.body")}
      primaryAction={
        <Button variant="outline" onClick={() => retry()}>
          {t("retry")}
        </Button>
      }
      secondaryAction={<Button render={<Link href="/dashboard" />}>{t("backToDashboard")}</Button>}
    />
  );
}
