/**
 * GC-Stats - liquipedia-mapping-table
 *
 * Review table shared by the team and person Liquipedia name panels: click a
 * row to check it (saved) or uncheck it, edit the name with the pasted
 * wikicode's names as suggestions.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { CheckIcon, XIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { RequiredMark } from "@/components/admin/required-mark";
import type { MatchConfidence } from "@/lib/liquipedia-team-match";
import { cn } from "@/lib/utils";

export type RowConfidence = MatchConfidence | "linked" | "manual" | "none";
export type RowState = { name: string; checked: boolean; confidence: RowConfidence; score: number | null };
export type MappingItem = { id: number; label: string; badge?: string; sublabel?: string; currentName: string | null };
export type MappingRowError = { error: string; teamName?: string };

const CONFIDENCE_CLASS: Record<RowConfidence, string> = {
  exact: "bg-emerald-500/15 text-emerald-400",
  confident: "bg-sky-500/15 text-sky-400",
  possible: "bg-amber-500/15 text-amber-400",
  manual: "bg-violet-500/15 text-violet-400",
  linked: "bg-muted text-muted-foreground",
  none: "bg-muted text-muted-foreground",
};

export function LiquipediaMappingTable({
  items,
  rows,
  rowErrors,
  suggestions,
  canManage,
  labelColumn,
  nameColumn,
  namePlaceholder,
  errorText,
  onToggle,
  onEditName,
}: {
  items: MappingItem[];
  rows: Record<number, RowState>;
  rowErrors: Record<number, MappingRowError>;
  suggestions: string[];
  canManage: boolean;
  labelColumn: string;
  /** Defaults to the Liquipedia name wording. */
  nameColumn?: string;
  namePlaceholder?: string;
  errorText: (error: MappingRowError) => string;
  onToggle: (id: number) => void;
  onEditName: (id: number, name: string) => void;
}) {
  const t = useTranslations("admin.tournaments.liquipedia");

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
          <tr>
            <th className="w-10 px-3 py-2" />
            <th className="px-3 py-2 font-medium">{labelColumn}</th>
            <th className="px-3 py-2 font-medium">
              {nameColumn ?? t("columnName")}
              <RequiredMark />
            </th>
            <th className="px-3 py-2 font-medium">{t("columnConfidence")}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const row = rows[item.id]!;
            const error = rowErrors[item.id];
            return (
              <tr
                key={item.id}
                onClick={() => onToggle(item.id)}
                aria-selected={row.checked}
                className={cn(
                  "border-t transition-colors select-none active:brightness-125",
                  canManage && "cursor-pointer",
                  row.checked ? "bg-emerald-500/10 hover:bg-emerald-500/15" : "bg-red-500/10 hover:bg-red-500/15"
                )}
              >
                <td className="px-3 py-2 align-top">
                  <span
                    className={cn(
                      "mt-1.5 flex size-4 items-center justify-center rounded border",
                      row.checked ? "border-emerald-500 bg-emerald-500 text-white" : "border-red-500/70 text-red-400"
                    )}
                    aria-label={row.checked ? t("rowChecked") : t("rowUnchecked")}
                  >
                    {row.checked ? <CheckIcon className="size-3" /> : <XIcon className="size-3" />}
                  </span>
                </td>
                <td className="px-3 py-2 align-top">
                  <div className="mt-1 flex items-center gap-2 font-medium">
                    {item.label}
                    {item.badge && <Badge className="bg-muted text-[10px] text-muted-foreground uppercase">{item.badge}</Badge>}
                  </div>
                  {item.sublabel && <div className="text-xs text-muted-foreground">{item.sublabel}</div>}
                  {item.currentName && row.confidence === "linked" && row.name !== item.currentName && (
                    <div className="text-xs text-muted-foreground">{t("currentName", { name: item.currentName })}</div>
                  )}
                </td>
                <td className="px-3 py-2 align-top" onClick={(e) => e.stopPropagation()}>
                  <LiquipediaNameInput
                    value={row.name}
                    suggestions={suggestions}
                    disabled={!canManage}
                    invalid={!!error}
                    placeholder={namePlaceholder ?? t("namePlaceholder")}
                    onChange={(name) => onEditName(item.id, name)}
                  />
                  {error && (
                    <p role="alert" className="mt-1 text-xs text-destructive">
                      {errorText(error)}
                    </p>
                  )}
                </td>
                <td className="px-3 py-2 align-top">
                  <Badge className={cn("mt-1", CONFIDENCE_CLASS[row.confidence])}>
                    {t(`confidence.${row.confidence}`)}
                    {row.score !== null && row.confidence !== "exact" ? ` ${row.score}%` : row.confidence === "exact" ? " 100%" : ""}
                  </Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Free text input with the pasted wikicode's names offered as suggestions. */
function LiquipediaNameInput({
  value,
  suggestions,
  disabled,
  invalid,
  placeholder,
  onChange,
}: {
  value: string;
  suggestions: string[];
  disabled: boolean;
  invalid: boolean;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const filtered = useMemo(() => {
    const term = value.trim().toLowerCase();
    return suggestions.filter((name) => name.toLowerCase() !== term && (!term || name.toLowerCase().includes(term))).slice(0, 8);
  }, [suggestions, value]);

  return (
    <div className="relative">
      <Input
        value={value}
        disabled={disabled}
        aria-invalid={invalid}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="h-8"
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border bg-popover p-1 text-sm shadow-md">
          {filtered.map((name) => (
            <li key={name}>
              <button
                type="button"
                // mousedown keeps the input focused long enough to register the pick
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(name);
                  setOpen(false);
                }}
                className="w-full rounded px-2 py-1 text-left transition-colors hover:bg-accent active:bg-accent/70"
              >
                {name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
