/**
 * GC-Stats - pickem-status-message
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useTranslations } from "next-intl";
import { FormattedDate } from "@/components/formatted-date";

/** Renders the "predictions open on <date>" status honoring the viewer's timezone/clock preference, unlike a raw server-formatted string. */
export function PickemStatusMessage({ opensAt }: { opensAt: string }) {
  const t = useTranslations("pickemPage");
  return (
    <p className="rounded-lg border px-4 py-3 text-sm text-muted-foreground">
      {t.rich("statusNotOpenYet", { date: () => <FormattedDate date={opensAt} mode="datetime" /> })}
    </p>
  );
}
