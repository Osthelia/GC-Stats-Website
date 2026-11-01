/**
 * GC-Stats - match-league-scoreboard
 *
 * The LoL scoreboard. On the wide layout (xl and up) every row is full width and each team takes half of it: the player on
 * the outside, the build (champion, runes and items) next to it, the stats towards the centre line. Below xl each team is
 * stacked instead, with its objectives in its own header: one full row per player from md, and two short lines per
 * player on phones. The poster has the wide layout only. Used for one game or for the averages over the series, on the
 * match page and on the match poster: the layout and colours are the same, the look (sizes, links, layouts) comes from
 * LOOKS.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use client";

import { Fragment, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { LolIcon } from "@/components/match/lol-icon";
import { LolObjectiveStrip } from "@/components/match/lol-objective-strip";
import { Link } from "@/i18n/navigation";
import { slugify } from "@/lib/entity-id";
import { formatGameDuration, type LeagueScoreRow } from "@/lib/league-scoreboard";
import type { LeagueGameObjectives } from "@/lib/match-league-games";

const LOOKS = {
  page: {
    grid: { left: "120px minmax(160px,1fr) 88px 48px 56px 64px", right: "64px 56px 48px 88px minmax(160px,1fr) 120px" },
    text: "text-[13px]",
    pad: "gap-2 px-3 py-2.5",
    icons: { champion: 44, small: 22, objective: 22 },
    interactive: true,
  },
  poster: {
    grid: { left: "200px minmax(0,1fr) 140px 80px 100px 110px", right: "110px 100px 80px 140px minmax(0,1fr) 200px" },
    text: "text-[19px]",
    pad: "gap-x-3 px-6 py-3",
    icons: { champion: 64, small: 32, objective: 32 },
    interactive: false,
  },
} as const;

/** The stacked row below xl: the player, the build, then the four stats. */
const STACK_GRID = "150px minmax(0,1fr) 88px 48px 56px 64px";
/** The phone layout's icons, in pixels. */
/** The item slots before the trinket. */
const ITEM_SLOTS = 6;
/** The secondary rune is a tree emblem that fills its whole image, so it is shown smaller than the keystone. */
const SECONDARY_SCALE = 0.6;
const PHONE_ICONS = { champion: 48, small: 28, objective: 18 };

export type ScoreboardLook = keyof typeof LOOKS;
type Look = (typeof LOOKS)[ScoreboardLook];
type Side = "left" | "right";

/** One team of a stacked layout: its name, its colour, its objectives (none for the averages) and its rows. */
type StackTeam = { name: string | undefined; tone: string; objectives: LeagueGameObjectives | undefined; rows: LeagueScoreRow[] };

const STAT = "text-center tabular-nums text-neutral-300";

function formatPerMinute(value: number | null, digits: number): string {
  return value === null ? "–" : value.toFixed(digits);
}

/** The K/D/A of one player: kills, deaths and assists, with the deaths in red. */
function Kda({ row }: { row: LeagueScoreRow }) {
  return (
    <>
      <span className="font-black text-(--gcs-text)">{row.kills}</span>
      <span className="mx-0.5 text-neutral-600">/</span>
      <span className="font-black text-red-500/70">{row.deaths}</span>
      <span className="mx-0.5 text-neutral-600">/</span>
      <span className="font-black text-neutral-400">{row.assists}</span>
    </>
  );
}

/** K/D/A, KP, CS/min and Gold/min of one player, left to right. The right side reverses them. */
function StatCells({ row, reverse = false }: { row: LeagueScoreRow | null; reverse?: boolean }) {
  if (!row) {
    return (
      <>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} aria-hidden />
        ))}
      </>
    );
  }
  const stats = [
    <div key="kda" className={`${STAT} whitespace-nowrap`}>
      <Kda row={row} />
    </div>,
    <div key="kp" className={STAT}>
      {Math.round(row.killParticipation)}%
    </div>,
    <div key="cs" className={STAT}>
      {formatPerMinute(row.csPerMinute, 1)}
    </div>,
    <div key="gpm" className={STAT}>
      {formatPerMinute(row.goldPerMinute, 0)}
    </div>,
  ];
  return <>{reverse ? [...stats].reverse() : stats}</>;
}

/** The player's name, linked to the player page when the look is interactive and the player is mapped. Long names end in an ellipsis; the full name is the tooltip. */
function PlayerName({ row, side, look }: { row: LeagueScoreRow | null; side: Side; look: Look }) {
  if (!row) return <div />;
  const hover = look.interactive ? "transition-colors hover:text-[#e4ae22]" : "";
  const className = `block min-w-0 truncate font-black uppercase italic ${hover} pr-1 ${side === "right" ? "text-right" : ""}`;
  if (!look.interactive || row.personId == null) return <div className={className} title={row.handle}>{row.handle}</div>;
  return (
    <Link href={`/player/${row.personId}/${slugify(row.handle)}`} className={className} title={row.handle}>
      {row.handle}
    </Link>
  );
}

/** An item slot with nothing in it: the stored items leave out the empty slots, so a build is padded back to its slots. */
function EmptySlot({ size }: { size: number }) {
  return <span className="flex-none rounded-sm border border-neutral-800/60 bg-(--gcs-surface-2)" style={{ width: size, height: size }} aria-hidden />;
}

/**
 * The runes (keystone and secondary, in one column) and the items, with the trinket last. A build always has
 * ITEM_SLOTS items and a trinket, so the trinket is in the same place on every row. The right side reverses them.
 * With `line` everything is a plain icon in the parent's row.
 */
function RunesAndItems({ row, side, size, line = false }: { row: LeagueScoreRow; side: Side; size: number; line?: boolean }) {
  const runeIcons = row.runes
    ? [
        <LolIcon key="keystone" kind="rune" url={row.runes.keystoneIconUrl} name={row.runes.keystoneName ?? ""} size={size} />,
        <LolIcon key="secondary" kind="tree" url={row.runes.secondaryIconUrl} name={row.runes.secondaryName ?? ""} size={Math.round(size * SECONDARY_SCALE)} />,
      ]
    : [];
  const itemIcons = (row.items ?? []).map((item, i) => <LolIcon key={`item-${i}`} kind="item" url={item.iconUrl} name={item.name} size={size} />);
  const trinket = itemIcons.pop() ?? (row.items ? <EmptySlot key="trinket" size={size} /> : undefined);
  if (row.items) {
    while (itemIcons.length < ITEM_SLOTS) itemIcons.push(<EmptySlot key={`empty-${itemIcons.length}`} size={size} />);
  }
  if (line) {
    return (
      <>
        {runeIcons}
        {itemIcons}
        {trinket}
      </>
    );
  }
  const runes = <div className="flex flex-col items-center justify-center">{runeIcons}</div>;
  const items = <div className="grid grid-cols-3">{itemIcons}</div>;

  return side === "left" ? (
    <>
      {runes}
      {items}
      {trinket}
    </>
  ) : (
    <>
      {trinket}
      {items}
      {runes}
    </>
  );
}

/**
 * The champion, the runes and the items of one player in one column: the champion next to the runes, the items after
 * them. The right side reverses the order, so the champion sits next to the player name on both sides.
 */
function ChampionBuild({ row, side, look }: { row: LeagueScoreRow | null; side: Side; look: Look }) {
  if (!row) return <div />;
  const champions = row.champions.map((champion) => (
    <LolIcon key={`champion-${champion.name}`} kind="champion" url={champion.iconUrl} name={champion.name} size={look.icons.champion} />
  ));
  const build = <RunesAndItems row={row} side={side} size={look.icons.small} />;

  return side === "left" ? (
    <div className="flex flex-wrap items-center gap-1.5">
      {champions}
      {build}
    </div>
  ) : (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {build}
      {champions}
    </div>
  );
}

/** One team's half of a row. */
function ScoreHalf({ row, side, look, className = "" }: { row: LeagueScoreRow | null; side: Side; look: Look; className?: string }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <div className={`grid items-center ${look.pad}`} style={{ gridTemplateColumns: look.grid[side] }}>
        {side === "left" ? (
          <>
            <PlayerName row={row} side={side} look={look} />
            <ChampionBuild row={row} side={side} look={look} />
            <StatCells row={row} />
          </>
        ) : (
          <>
            <StatCells row={row} reverse />
            <ChampionBuild row={row} side={side} look={look} />
            <PlayerName row={row} side={side} look={look} />
          </>
        )}
      </div>
    </div>
  );
}

function ColumnLabels({ side, grid, look, className = "" }: { side: Side; grid: string; look: Look; className?: string }) {
  const t = useTranslations("matchPage");
  // Same order as the cells in ScoreHalf: player, build (no title), then the stats.
  const labels = [
    <div key="player" className={side === "right" ? "pr-1 text-right" : ""}>{t("colPlayer")}</div>,
    <div key="build" aria-hidden />,
    <div key="kda" className="text-center">K/D/A</div>,
    <div key="kp" className="text-center">KP</div>,
    <div key="cs" className="text-center">CS/min</div>,
    <div key="gpm" className="text-center">Gold/min</div>,
  ];
  // The right half mirrors the left, so its columns read from the centre outwards.
  const ordered = side === "left" ? labels : [...labels].reverse();
  return (
    <div className={`grid min-w-0 items-center text-[0.75em] font-black tracking-wide text-neutral-500 uppercase ${look.pad} ${className}`} style={{ gridTemplateColumns: grid }}>
      {ordered}
    </div>
  );
}

/** A team's name with its objectives, in the stacked layouts: the strip sits under the name, in the team's own header. */
function TeamHeader({ team, size }: { team: StackTeam; size: number }) {
  return (
    <div className="flex flex-col gap-2 border-b border-neutral-800 px-3 py-2">
      <span className={`text-sm font-black tracking-wide uppercase italic ${team.tone}`}>{team.name}</span>
      {team.objectives && <LolObjectiveStrip objectives={team.objectives} tone={team.tone} size={size} split />}
    </div>
  );
}

/** A player on a phone: the champion, the name and the K/D/A, then the runes and items in a row of their own. */
function PhonePlayer({ row, look }: { row: LeagueScoreRow; look: Look }) {
  const champions = row.champions.map((champion) => (
    <LolIcon key={`champion-${champion.name}`} kind="champion" url={champion.iconUrl} name={champion.name} size={PHONE_ICONS.champion} />
  ));
  return (
    <div className="px-3 py-2">
      <div className="flex items-center gap-2">
        <div className="flex max-w-28 flex-none flex-wrap gap-1">{champions}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <PlayerName row={row} side="left" look={look} />
            <div className={`${STAT} whitespace-nowrap`}>
              <Kda row={row} />
            </div>
          </div>
          <div className="truncate text-[11px] text-neutral-500">{row.champions.map((champion) => champion.name).join(", ")}</div>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-1">
        <RunesAndItems row={row} side="left" size={PHONE_ICONS.small} line />
      </div>
    </div>
  );
}

/**
 * The layout below xl: each team in turn under its own header. A player is a full row from md and two short lines on
 * phones.
 */
function StackedTeams({ teams, look }: { teams: StackTeam[]; look: Look }) {
  return teams.map((team, i) => (
    <div key={i} className={i === 0 ? "border-b border-neutral-800" : ""}>
      <TeamHeader team={team} size={look.icons.objective} />
      <ColumnLabels side="left" grid={STACK_GRID} look={look} className="hidden border-b border-neutral-800 md:grid" />
      <div className="divide-y divide-neutral-900">
        {team.rows.map((row, j) => (
          <Fragment key={j}>
            <div className={`hidden items-center transition-colors hover:bg-white/6 md:grid ${look.pad}`} style={{ gridTemplateColumns: STACK_GRID }}>
              <PlayerName row={row} side="left" look={look} />
              <ChampionBuild row={row} side="left" look={look} />
              <StatCells row={row} />
            </div>
            <div className="md:hidden">
              <PhonePlayer row={row} look={look} />
            </div>
          </Fragment>
        ))}
      </div>
    </div>
  ));
}

export function LeagueScoreboard({
  header,
  nameA,
  nameB,
  rowsA,
  rowsB,
  objectivesA,
  objectivesB,
  durationSeconds,
  look: lookName = "page",
}: {
  /** The team names above the rows: MatchScoreboardHeader on the page, a plain name bar on the poster. */
  header: ReactNode;
  /** The team names over each team's block in the stacked layouts, which the page has and the poster does not. */
  nameA?: string;
  nameB?: string;
  rowsA: LeagueScoreRow[];
  rowsB: LeagueScoreRow[];
  /** A game's objectives, shown under the header. Left out for the averages. */
  objectivesA?: LeagueGameObjectives;
  objectivesB?: LeagueGameObjectives;
  /** Shown between the two objective strips, or above the stacked teams. */
  durationSeconds?: number | null;
  look?: ScoreboardLook;
}) {
  const t = useTranslations("matchPage");
  const look = LOOKS[lookName];
  const rowCount = Math.max(rowsA.length, rowsB.length);
  const showObjectives = objectivesA !== undefined || objectivesB !== undefined;
  const teams: StackTeam[] = [
    { name: nameA, tone: "text-blue-400", objectives: objectivesA, rows: rowsA },
    { name: nameB, tone: "text-red-400", objectives: objectivesB, rows: rowsB },
  ];
  const duration =
    showObjectives && durationSeconds != null ? (
      <p className="border-b border-neutral-800 px-3 py-2 text-center font-mono text-[0.9em] text-neutral-400">
        {t("duration")} <span className="text-neutral-200">{formatGameDuration(durationSeconds)}</span>
      </p>
    ) : null;

  const wide = (
    <>
      {showObjectives && (
        <div className={`grid grid-cols-[1fr_auto_1fr] items-center border-b border-neutral-800 ${look.pad}`}>
          <LolObjectiveStrip objectives={objectivesA} tone="text-blue-400" size={look.icons.objective} />
          <div className="px-2 text-center font-mono text-[0.9em] whitespace-nowrap text-neutral-400">
            {durationSeconds != null && (
              <>
                {t("duration")} <span className="text-neutral-200">{formatGameDuration(durationSeconds)}</span>
              </>
            )}
          </div>
          <LolObjectiveStrip objectives={objectivesB} tone="text-red-400" size={look.icons.objective} mirrored />
        </div>
      )}

      <div className="grid grid-cols-2 border-b border-neutral-800">
        <ColumnLabels side="left" grid={look.grid.left} look={look} />
        <ColumnLabels side="right" grid={look.grid.right} look={look} className="border-l border-neutral-800" />
      </div>

      <div className="divide-y divide-neutral-900">
        {Array.from({ length: rowCount }).map((_, i) => (
          <div key={i} className={`grid grid-cols-2 ${look.interactive ? "transition-colors hover:bg-white/6" : ""} ${i % 2 === 1 ? "bg-white/2" : ""}`}>
            <ScoreHalf row={rowsA[i] ?? null} side="left" look={look} />
            <ScoreHalf row={rowsB[i] ?? null} side="right" look={look} className="border-l border-white/5" />
          </div>
        ))}
      </div>
    </>
  );

  const body = look.interactive ? (
    <>
      <div className="no-scrollbar hidden w-full overflow-x-auto xl:block">
        <div className="min-w-[1200px]">{wide}</div>
      </div>
      <div className="xl:hidden">
        {duration}
        <StackedTeams teams={teams} look={look} />
      </div>
    </>
  ) : (
    wide
  );

  return (
    <div className={`w-full overflow-hidden rounded-2xl border border-neutral-800 bg-(--gcs-surface-2) ${look.text}`}>
      {header}
      {rowCount === 0 ? <p className="px-4 py-6 text-center text-neutral-400">{t("noGameData")}</p> : body}
    </div>
  );
}
