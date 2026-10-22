/**
 * GC-Stats - public-roster-source-field
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useTranslations } from "next-intl";
import { PublicSelect } from "@/components/forms/public-select";
import { useRosterSourceMode, type RosterSourceMode } from "@/components/forms/use-roster-source-mode";
import { ROSTER_SOURCE_MAX_LENGTH, ROSTER_SOURCE_PRESETS, type RosterSourceKind } from "@/lib/roster-source";

const inputClass =
  "rounded-[9px] border border-neutral-700 bg-[var(--gcs-surface-2)] px-2.5 py-1.5 text-[12.5px] text-neutral-50 outline-none transition-colors focus:border-[#e4ae22]/60";

/** Source of a roster arrival or departure: a link to the announcement, or a text option. */
export function PublicRosterSourceField({ kind, value, onChange }: { kind: RosterSourceKind; value: string; onChange: (value: string) => void }) {
  const t = useTranslations("suggestEdit.membership");
  const { mode, select } = useRosterSourceMode(value, onChange);

  // The player declaration is only shown when it is the current value, it is never picked.
  const modes: RosterSourceMode[] = ["none", "link", ...ROSTER_SOURCE_PRESETS[kind], ...(mode === "declaredByPlayer" ? (["declaredByPlayer"] as const) : [])];
  const options = modes.map((m) => ({ value: m, label: t(`sourceOption.${m}` as "sourceOption.none") }));

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[12px] text-neutral-400">{t(kind === "join" ? "joinSourceLabel" : "leftSourceLabel")}</span>
      <PublicSelect value={mode} onChange={(v) => select(v as RosterSourceMode)} options={options} />
      {mode === "link" && (
        <input
          type="text"
          inputMode="url"
          value={value}
          maxLength={ROSTER_SOURCE_MAX_LENGTH}
          onChange={(e) => onChange(e.target.value)}
          aria-label={t("sourcePlaceholder")}
          placeholder={t("sourcePlaceholder")}
          className={inputClass}
        />
      )}
    </div>
  );
}
