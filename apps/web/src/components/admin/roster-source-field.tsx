/**
 * GC-Stats - roster-source-field
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRosterSourceMode, type RosterSourceMode } from "@/components/forms/use-roster-source-mode";
import { ROSTER_SOURCE_MAX_LENGTH, ROSTER_SOURCE_PRESETS, type RosterSourceKind } from "@/lib/roster-source";

type RosterSourceFieldProps = {
  id: string;
  kind: RosterSourceKind;
  value: string;
  onChange: (value: string) => void;
  /** Error code returned by the server action. */
  error?: string;
  disabled?: boolean;
};

/** Source of a roster arrival or departure: a link to the announcement, or a text option. */
export function RosterSourceField({ id, kind, value, onChange, error, disabled }: RosterSourceFieldProps) {
  const t = useTranslations("admin.rosterSource");
  const { mode, select } = useRosterSourceMode(value, onChange);

  // The player declaration is only shown when it is the current value, it is never picked.
  const modes: RosterSourceMode[] = ["none", "link", ...ROSTER_SOURCE_PRESETS[kind], ...(mode === "declaredByPlayer" ? (["declaredByPlayer"] as const) : [])];
  const items = Object.fromEntries(modes.map((m) => [m, t(`option.${m}` as "option.none")]));
  const label = t(kind === "join" ? "joinLabel" : "leftLabel");

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-[11px] text-muted-foreground">
        {label}
      </Label>
      <Select items={items} value={mode} disabled={disabled} onValueChange={(v) => v && select(v as RosterSourceMode)}>
        <SelectTrigger id={id} aria-label={label} aria-invalid={!!error} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {modes.map((m) => (
            <SelectItem key={m} value={m}>
              {items[m]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {mode === "link" && (
        <Input
          type="text"
          inputMode="url"
          value={value}
          maxLength={ROSTER_SOURCE_MAX_LENGTH}
          placeholder={t("placeholder")}
          onChange={(e) => onChange(e.target.value)}
          aria-label={t("placeholder")}
          aria-invalid={!!error}
          disabled={disabled}
        />
      )}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {t(`error.${error}` as "error.invalidUrl")}
        </p>
      )}
    </div>
  );
}
