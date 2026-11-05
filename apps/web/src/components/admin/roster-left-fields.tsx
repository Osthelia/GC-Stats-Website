/**
 * GC-Stats - roster-left-fields
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useTranslations } from "next-intl";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type RosterLeftFieldsProps = {
  idPrefix: string;
  hasLeft: boolean;
  until: string;
  onChange: (hasLeft: boolean, until: string) => void;
  error?: string;
  disabled?: boolean;
};

/** "Has left" checkbox plus the leave date. Left checked with an empty date means the end date is unknown. */
export function RosterLeftFields({ idPrefix, hasLeft, until, onChange, error, disabled }: RosterLeftFieldsProps) {
  const t = useTranslations("admin.rosterLeft");

  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={hasLeft} disabled={disabled} onCheckedChange={(checked) => onChange(checked === true, checked === true ? until : "")} />
        {t("hasLeft")}
      </label>
      <Label htmlFor={`${idPrefix}-until`} className="text-[11px] text-muted-foreground">
        {t("untilLabel")}
      </Label>
      <Input
        id={`${idPrefix}-until`}
        type="date"
        value={until}
        disabled={disabled || !hasLeft}
        onChange={(e) => onChange(e.target.value !== "" || hasLeft, e.target.value)}
        aria-invalid={!!error}
      />
      {hasLeft && !until && <p className="text-xs text-muted-foreground">{t("unknownHint")}</p>}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
