/**
 * GC-Stats - datetime-input
 *
 * `datetime-local` input bound to a UTC ISO instant, edited in the display
 * timezone (admin timezone under `/admin`, the viewer's elsewhere).
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import { Input } from "@/components/ui/input";
import { useDisplayTimezone } from "@/lib/site-settings";
import { isoToZonedInput, timezoneLabel, zonedInputToIso } from "@/lib/datetime-local";
import { cn } from "@/lib/utils";

export function DateTimeInput({
  value,
  onChange,
  showTimezone = true,
  className,
  ...props
}: Omit<React.ComponentProps<"input">, "type" | "value" | "onChange"> & {
  /** ISO instant, null when empty. */
  value: string | null;
  onChange: (iso: string | null) => void;
  showTimezone?: boolean;
}) {
  const locale = useLocale();
  const timeZone = useDisplayTimezone();
  const [text, setText] = useState(() => isoToZonedInput(value, timeZone));
  const [synced, setSynced] = useState({ value, timeZone });

  // Re-derive the field when the instant or the timezone changes from outside (settings load, form reset).
  if (synced.value !== value || synced.timeZone !== timeZone) {
    setSynced({ value, timeZone });
    setText(isoToZonedInput(value, timeZone));
  }

  function handleChange(next: string) {
    setText(next);
    const iso = zonedInputToIso(next, timeZone);
    setSynced({ value: iso, timeZone });
    onChange(iso);
  }

  const input = <Input type="datetime-local" value={text} onChange={(e) => handleChange(e.target.value)} className={cn(showTimezone ? "flex-1" : undefined, className)} {...props} />;
  if (!showTimezone) return input;

  return (
    <div className="flex w-full items-center gap-2">
      {input}
      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{timezoneLabel(timeZone, locale)}</span>
    </div>
  );
}
