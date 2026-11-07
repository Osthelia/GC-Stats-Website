/**
 * GC-Stats - lol-icon
 *
 * The League icons. LolIcon is one from the public bucket: a champion, an item or a rune. Styled like AgentIcon: a thin border on the surface
 * colour, lazy loading, and the name as tooltip. A champion's artwork has a dark frame baked in, so it is cropped to hide
 * that frame and gets no border of its own. Runes are round; a rune tree's emblem is shown whole, without the frame. An
 * icon that is not stored yet (or fails to load) shows a tile with the name's first letter instead. The lane icons
 * (Top to Support) ship with the app instead, see laneIconUrl and LaneIcons. They live here and not in lol-icons because
 * that module needs the storage package, which client components must not import.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { LeagueRole } from "@gc-stats/lol-stats-engine/lanes";

type Props = {
  kind: "champion" | "item" | "rune" | "tree";
  url: string | null;
  /** The champion, item or rune name: for alt text and the hover tooltip */
  name: string;
  /** Pixels, or a CSS length such as a variable when the size changes with the breakpoint. */
  size: number | string;
};

export function LolIcon({ kind, url, name, size }: Props) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const style = { width: size, height: size };
  const px = typeof size === "number" ? size : undefined;
  const shape = kind === "rune" || kind === "tree" ? "rounded-full" : "rounded-sm";

  if (url === null || url === failedUrl) {
    return (
      <span
        role="img"
        aria-label={name}
        aria-hidden={!name}
        title={name}
        style={style}
        className={`flex flex-none items-center justify-center border border-neutral-800 bg-(--gcs-surface-2) text-[8px] font-black text-neutral-500 uppercase ${shape}`}
      >
        {name.slice(0, 1)}
      </span>
    );
  }

  const champion = kind === "champion";
  // A rune tree's emblem fills its image to the edge, so a round crop would cut its tips: it is shown whole, no frame.
  const tree = kind === "tree";
  return (
    <img
      src={url}
      alt={`${name} ${kind} image`}
      title={name}
      loading="lazy"
      width={px}
      height={px}
      style={{...style, clipPath: champion ? "inset(6% round 4px)" : ""}}
      className={champion ? "flex-none object-cover" : tree ? "flex-none object-contain" : `flex-none border border-neutral-800 bg-(--gcs-surface-2) object-cover ${shape}`}
      onError={() => setFailedUrl(url)}
    />
  );
}

const LANE_ICON_NAMES: Record<LeagueRole, string> = { TOP: "Top", JUNGLE: "Jungle", MIDDLE: "Middle", BOTTOM: "Bottom", UTILITY: "Support" };

/** The icon of a lane (TOP, JUNGLE, MIDDLE, BOTTOM, UTILITY), from public/lol/roles. */
export function laneIconUrl(lane: LeagueRole): string {
  return `/lol/roles/${LANE_ICON_NAMES[lane]}_icon.png`;
}

/** The lane icons of a League player (Top to Support), each with the lane name as tooltip. Renders nothing for a player without a lane. */
export function LaneIcons({ lanes, size = 16, className = "" }: { lanes: readonly LeagueRole[]; size?: number; className?: string }) {
  const t = useTranslations("lanes");
  if (lanes.length === 0) return null;
  return (
    <span className={`inline-flex flex-none items-center gap-0.5 ${className}`}>
      {lanes.map((lane) => (
        <img key={lane} src={laneIconUrl(lane)} alt={t(lane)} title={t(lane)} width={size} height={size} className="flex-none" style={{ width: size, height: size }} />
      ))}
    </span>
  );
}
