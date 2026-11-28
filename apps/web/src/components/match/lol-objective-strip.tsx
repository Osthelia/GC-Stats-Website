/**
 * GC-Stats - lol-objective-strip
 *
 * One team's objectives in a game, in a row: the towers, barons, heralds and void grubs with their counts, and one icon
 * per dragon in the order they were taken. Shown under the team names of a game's scoreboard. The icons are the artwork
 * in public/lol/scoreboard; a dragon of unknown type shows the generic one.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { useTranslations } from "next-intl";
import type { LeagueGameObjectives } from "@/lib/match-league-games";

type CountedKind = "towers" | "barons" | "heralds" | "grubs";

const SCOREBOARD = "/lol/scoreboard";

const IMAGES: Record<CountedKind, string> = {
  towers: `${SCOREBOARD}/tower.webp`,
  barons: `${SCOREBOARD}/baronnashor.webp`,
  heralds: `${SCOREBOARD}/riftherald.webp`,
  grubs: `${SCOREBOARD}/grub.webp`,
};

/** The name and artwork of each dragon type, as Riot names them. */
const DRAGONS: Record<string, { name: string; image: string }> = {
  FIRE_DRAGON: { name: "Infernal Drake", image: `${SCOREBOARD}/infernaldrake.webp` },
  EARTH_DRAGON: { name: "Mountain Drake", image: `${SCOREBOARD}/mountaindrake.webp` },
  WATER_DRAGON: { name: "Ocean Drake", image: `${SCOREBOARD}/oceandrake.webp` },
  AIR_DRAGON: { name: "Cloud Drake", image: `${SCOREBOARD}/clouddrake.webp` },
  CHEMTECH_DRAGON: { name: "Chemtech Drake", image: `${SCOREBOARD}/chemtechdrake.webp` },
  HEXTECH_DRAGON: { name: "Hextech Drake", image: `${SCOREBOARD}/hextechdrake.webp` },
  ELDER_DRAGON: { name: "Elder Dragon", image: `${SCOREBOARD}/elderdrake.webp` },
};
const GENERIC_DRAGON = `${SCOREBOARD}/dragon.webp`;

const COUNTED: CountedKind[] = ["grubs", "heralds", "barons", "towers"];

/** Room for the most dragons a team takes in a game, so the other counts stay in place as the dragons change. */
const DRAGON_SLOTS = 6;
const DRAGON_GAP = 4;

/** The name and artwork of a dragon; a dragon of unknown type (null) gets the generic artwork and no name. */
function dragonOf(dragon: string | null): { name: string | null; image: string } {
  const known = dragon === null ? undefined : DRAGONS[dragon];
  return { name: known?.name ?? null, image: known?.image ?? GENERIC_DRAGON };
}

/** The name is the alt text and the hover tooltip, as on every LoL icon. */
function ObjectiveIcon({ src, size, name }: { src: string; size: number; name: string }) {
  return <img src={src} alt={name} title={name} width={size} height={size} className="flex-none" />;
}

/**
 * `mirrored` is the right team's strip: its items run in reverse, so the dragons sit next to the centre line, as the
 * stats do in the rows below. The strip wraps where it is narrow.
 * `split` is the strip of a stacked layout: the dragons are a line of their own, everything else is the line below.
 */
export function LolObjectiveStrip({
  objectives,
  tone,
  size,
  mirrored = false,
  split = false,
}: {
  objectives: LeagueGameObjectives | undefined;
  tone: string;
  size: number;
  mirrored?: boolean;
  split?: boolean;
}) {
  const t = useTranslations("matchPage");
  const dragons = objectives?.dragonTypes ?? [];
  const dragonsItem = (
    <div
      key="dragons"
      role={dragons.length > 0 ? "group" : undefined}
      aria-label={dragons.length > 0 ? t("dragons") : undefined}
      className={`flex flex-wrap items-center gap-1 ${split ? "w-full" : ""} ${mirrored ? "justify-end" : "justify-start"}`}
      style={{ minWidth: DRAGON_SLOTS * size + (DRAGON_SLOTS - 1) * DRAGON_GAP }}
    >
      {(mirrored ? [...dragons].reverse() : dragons).map((dragon, i) => {
        const { name, image } = dragonOf(dragon);
        const label = name ?? t("dragons");
        return <ObjectiveIcon key={i} src={image} size={size} name={label} />;
      })}
    </div>
  );
  const countedItems = COUNTED.map((kind) => (
    <div key={kind} className="flex items-center gap-2 font-mono font-bold" title={t(kind)}>
      <ObjectiveIcon src={IMAGES[kind]} size={size} name={t(kind)} />
      <span className="tabular-nums">{objectives?.[kind] ?? 0}</span>
    </div>
  ));
  // No dragons: nothing is shown. Side by side the empty slot keeps its width, so the counts stay in line with the
  // other team's; stacked it would be an empty line, so it is left out.
  const items = dragons.length === 0 && split ? countedItems : [dragonsItem, ...countedItems];
  return <div className={`flex flex-wrap items-center gap-2 ${split ? "justify-start gap-x-6" : "justify-around"} ${tone}`}>{mirrored ? items.reverse() : items}</div>;
}
