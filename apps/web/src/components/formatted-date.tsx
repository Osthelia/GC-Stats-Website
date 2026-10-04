/**
 * GC-Stats — Formatted date/time component
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useLocale, useTranslations } from "next-intl";
import { useDisplayTimezone, useSiteSettings } from "@/lib/site-settings";

type Mode = "date" | "time" | "datetime";

const DATE_OPTS: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "short",
  year: "numeric",
};
const TIME_OPTS: Intl.DateTimeFormatOptions = {
  hour: "2-digit",
  minute: "2-digit",
};

// Anything older is a placeholder (the 1900 "unknown" sentinel, an epoch fallback), never a real esports date.
const PLACEHOLDER_BEFORE = Date.UTC(2000, 0, 1);

/**
 * Renders a date/time honoring the display timezone (admin one under /admin) + 12h/24h preference
 * (site settings, see src/lib/site-settings.tsx) — client-only since that
 * preference lives in localStorage, unknown to the server. Prefer this over
 * a raw `.toLocaleDateString()` call anywhere a match/entry date is shown.
 */
export function FormattedDate({
  date,
  mode = "date",
  className,
  style,
  dateOptions,
}: {
  date: Date | string | null | undefined;
  mode?: Mode;
  className?: string;
  style?: React.CSSProperties;
  /** Overrides the default day/month/year options (mode "date"/"datetime" only). */
  dateOptions?: Intl.DateTimeFormatOptions;
}) {
  const locale = useLocale();
  const t = useTranslations("formattedDate");
  const { clock24 } = useSiteSettings();
  const timezone = useDisplayTimezone();

  if (!date) return null;
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return null;
  if (d.getTime() < PLACEHOLDER_BEFORE) {
    if (mode === "time") return null;
    return (
      <span className={className} style={style}>
        {t("unknown")}
      </span>
    );
  }

  const options: Intl.DateTimeFormatOptions = {
    ...(mode !== "time" ? (dateOptions ?? DATE_OPTS) : {}),
    ...(mode !== "date" ? { ...TIME_OPTS, hour12: !clock24 } : {}),
    timeZone: timezone,
  };

  const formatted = new Intl.DateTimeFormat(locale, options).format(d);
  return (
    <span className={className} style={style}>
      {formatted}
    </span>
  );
}
