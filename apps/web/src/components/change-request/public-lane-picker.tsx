/**
 * GC-Stats - public-lane-picker
 *
 * Lane toggle of the suggest-edit form for a League roster entry, in the public form styling. Any number of lanes
 * can be selected, a sub is saved for the lanes they cover.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useTranslations } from "next-intl";
import { LEAGUE_ROLES, sortLanes, type LeagueRole } from "@gc-stats/lol-stats-engine/lanes";
import { laneIconUrl } from "@/components/match/lol-icon";

export function PublicLanePicker({ lanes, onChange }: { lanes: LeagueRole[]; onChange: (lanes: LeagueRole[]) => void }) {
  const t = useTranslations("lanes");

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] text-neutral-500">{t("label")}</span>
      <div role="group" aria-label={t("label")} className="flex gap-1.5">
        {LEAGUE_ROLES.map((lane) => {
          const selected = lanes.includes(lane);
          return (
            <button
              key={lane}
              type="button"
              aria-pressed={selected}
              title={t(lane)}
              onClick={() => onChange(sortLanes(selected ? lanes.filter((l) => l !== lane) : [...lanes, lane]))}
              className={`flex size-8 items-center justify-center rounded-[9px] border transition-colors ${selected ? "border-[#e4ae22]/70 bg-[#e4ae22]/15" : "border-neutral-700 bg-[var(--gcs-surface-2)] opacity-50 hover:opacity-100"}`}
            >
              <img src={laneIconUrl(lane)} alt={t(lane)} width={20} height={20} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
