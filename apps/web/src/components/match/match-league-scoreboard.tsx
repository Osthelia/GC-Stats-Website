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

/** The champions of a row: one placeholder when a manual lineup doesn't know the champion, so the row keeps its shape. */
function ChampionIcons({ row, size }: { row: LeagueScoreRow; size: number }) {
  if (row.champions.length === 0) return <LolIcon kind="champion" url={null} name="?" size={size} />;
  return (
    <>
      {row.champions.map((champion) => (
        <LolIcon key={`champion-${champion.name}`} kind="champion" url={champion.iconUrl} name={champion.name} size={size} />
      ))}
    </>
  );
}

/** The K/D/A of one player: kills, deaths and assists, with the deaths in red. "–" without stats (a manual lineup). */
function Kda({ row }: { row: LeagueScoreRow }) {
  if (!row.hasStats) return <span className="text-neutral-500">–</span>;
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
      {row.hasStats ? `${Math.round(row.killParticipation)}%` : "–"}
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
 * The summoner spells and the runes (keystone and secondary), each in a column of their own, and the items, with the
 * trinket last, and the role quest item (if the player has one) under the trinket. A build always has
 * ITEM_SLOTS items and a trinket, so the trinket is in the same place on every row. The right side reverses them.
 * With `line` everything is a plain icon in the parent's row.
 *
 * What a game doesn't know is left out rather than drawn as a placeholder: the summoner spells and a rune without an
 * id, the item slots and the trinket when there are no items at all, and the trinket of a manual build without one.
 */
function RunesAndItems({ row, side, size, line = false }: { row: LeagueScoreRow; side: Side; size: number; line?: boolean }) {
  const spellIcons = (row.summoners ?? []).map((spell, i) => <LolIcon key={`spell-${i}`} kind="spell" url={spell.iconUrl} name={spell.name} size={size} />);
  const runeIcons: ReactNode[] = [];
  if (row.runes?.keystoneIconUrl) runeIcons.push(<LolIcon key="keystone" kind="rune" url={row.runes.keystoneIconUrl} name={row.runes.keystoneName ?? ""} size={size} />);
  if (row.runes?.secondaryIconUrl) runeIcons.push(<LolIcon key="secondary" kind="tree" url={row.runes.secondaryIconUrl} name={row.runes.secondaryName ?? ""} size={size} />);
  const hasItems = (row.items?.length ?? 0) > 0;
  // A manual build keeps its empty slots (null): an empty item slot is drawn as one, an empty trinket slot not at all.
  const slots = [...(row.items ?? [])];
  const trinketItem = slots.pop();
  const itemIcons = slots.map((item, i) => (item ? <LolIcon key={`item-${i}`} kind="item" url={item.iconUrl} name={item.name} size={size} /> : <EmptySlot key={`item-${i}`} size={size} />));
  const trinketIcon = trinketItem ? <LolIcon key="trinket" kind="item" url={trinketItem.iconUrl} name={trinketItem.name} size={size} /> : undefined;
  const roleIcon = row.roleItem ? <LolIcon key="role-item" kind="item" url={row.roleItem.iconUrl} name={row.roleItem.name} size={size} /> : undefined;
  // In a column the role quest item sits under the trinket; in a line there is no under, so it follows the trinket.
  const trinket = roleIcon && !line ? <div className="flex flex-col items-center">{trinketIcon}{roleIcon}</div> : trinketIcon;
  if (hasItems) {
    while (itemIcons.length < ITEM_SLOTS) itemIcons.push(<EmptySlot key={`empty-${itemIcons.length}`} size={size} />);
  }
  if (line) {
    return (
      <>
        {spellIcons}
        {runeIcons}
        {itemIcons}
        {trinket}
        {roleIcon}
      </>
    );
  }
  // Left out when empty, so no gap is kept for them in the row.
  const spells = spellIcons.length > 0 ? <div className="flex flex-col items-center justify-center">{spellIcons}</div> : null;
  const runes = runeIcons.length > 0 ? <div className="flex flex-col items-center justify-center">{runeIcons}</div> : null;
  const items = itemIcons.length > 0 ? <div className="grid grid-cols-3">{itemIcons}</div> : null;

  return side === "left" ? (
    <>
      {spells}
      {runes}
      {items}
      {trinket}
    </>
  ) : (
    <>
      {trinket}
      {items}
      {runes}
      {spells}
    </>
  );
}

/**
 * The champion, the runes and the items of one player in one column: the champion next to the runes, the items after
 * them. The right side reverses the order, so the champion sits next to the player name on both sides.
 */
function ChampionBuild({ row, side, look }: { row: LeagueScoreRow | null; side: Side; look: Look }) {
  if (!row) return <div />;
  const champions = <ChampionIcons row={row} size={look.icons.champion} />;
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
  const champions = <ChampionIcons row={row} size={PHONE_ICONS.champion} />;
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
      <div className="mt-2 flex items-center gap-1 empty:hidden">
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
