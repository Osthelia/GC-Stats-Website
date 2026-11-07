/**
 * GC-Stats - lane-picker
 *
 * Lane toggle of a League roster entry: the five lane icons, any number selected (a flex player, or a sub saved for
 * the lanes they cover). With none selected the public pages take the lanes from the games, shown here as a hint.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useTranslations } from "next-intl";
import { LEAGUE_ROLES, sortLanes, type LeagueRole } from "@gc-stats/lol-stats-engine/lanes";
import { Label } from "@/components/ui/label";
import { LaneIcons, laneIconUrl } from "@/components/match/lol-icon";
import { cn } from "@/lib/utils";

export function LanePicker({
  lanes,
  onChange,
  gameLanes = [],
  invalid = false,
  disabled = false,
}: {
  lanes: LeagueRole[];
  onChange: (lanes: LeagueRole[]) => void;
  /** The lanes played in games, shown when none are selected. */
  gameLanes?: LeagueRole[];
  invalid?: boolean;
  disabled?: boolean;
}) {
  const t = useTranslations("lanes");

  function toggle(lane: LeagueRole) {
    onChange(sortLanes(lanes.includes(lane) ? lanes.filter((l) => l !== lane) : [...lanes, lane]));
  }

  return (
    <div className="flex flex-col gap-1">
      <Label className="text-[11px] text-muted-foreground">{t("label")}</Label>
      <div role="group" aria-label={t("label")} className="flex gap-1">
        {LEAGUE_ROLES.map((lane) => {
          const selected = lanes.includes(lane);
          return (
            <button
              key={lane}
              type="button"
              aria-pressed={selected}
              title={t(lane)}
              disabled={disabled}
              onClick={() => toggle(lane)}
              className={cn(
                "flex size-8 items-center justify-center rounded-md border transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                selected ? "border-primary bg-primary/15" : "border-input opacity-50 hover:opacity-100",
              )}
            >
              <img src={laneIconUrl(lane)} alt={t(lane)} width={20} height={20} />
            </button>
          );
        })}
      </div>
      {lanes.length === 0 && gameLanes.length > 0 && (
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          {t("fromGames")}
          <LaneIcons lanes={gameLanes} size={14} />
        </p>
      )}
      {invalid && (
        <p role="alert" className="text-xs text-destructive">
          {t("invalid")}
        </p>
      )}
    </div>
  );
}
