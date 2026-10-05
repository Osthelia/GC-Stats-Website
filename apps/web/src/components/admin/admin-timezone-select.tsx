/**
 * GC-Stats - admin-timezone-select
 *
 * Picks the timezone every `/admin` date is displayed and edited in.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { GlobeIcon } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSiteSettings } from "@/lib/site-settings";
import { TIMEZONES } from "@/lib/timezones";
import { isValidTimezone, timezoneLabel } from "@/lib/datetime-local";

export function AdminTimezoneSelect() {
  const t = useTranslations("admin.timezone");
  const locale = useLocale();
  const { adminTimezone, setAdminTimezone } = useSiteSettings();

  const items = useMemo(() => {
    const ids = TIMEZONES.map((z) => z.id);
    if (!ids.includes(adminTimezone)) ids.unshift(adminTimezone);
    return Object.fromEntries(ids.map((id) => [id, timezoneLabel(id, locale)]));
  }, [adminTimezone, locale]);

  function handleChange(value: string | null) {
    if (!value || value === adminTimezone || !isValidTimezone(value)) return;
    setAdminTimezone(value);
    toast.success(t("changed", { timezone: items[value] ?? value }));
  }

  return (
    <Select items={items} value={adminTimezone} onValueChange={handleChange}>
      <SelectTrigger size="sm" className="max-w-56" aria-label={t("label")} title={t("hint")}>
        <GlobeIcon className="size-3.5 text-muted-foreground" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(items).map(([id, label]) => (
          <SelectItem key={id} value={id}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
