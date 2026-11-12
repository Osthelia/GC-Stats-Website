/**
 * GC-Stats - match-league-games
 *
 * The games of a LoL series for the public match page and the match poster: the draft, the team objectives and
 * the player scoreboard of each game. Icons are resolved to their bucket URLs here, so the components only render.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { unstable_cache } from "next/cache";
import { and, asc, eq, inArray, isNotNull } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { gameTables, leagueTablesOf } from "@gc-stats/db";
import { averageSeriesLines, blueEntrantOf, draftStep, killParticipation, LEAGUE_DRAFT_STEPS, perMinute, seriesScoreThrough, stepSide, type LeagueSide, type SeriesAverage } from "@gc-stats/lol-stats-engine";
import { MATCH_STATS_TAG, matchTag } from "@/lib/cache-tags";
import { getDisplayCatalog } from "@/lib/data-dragon-client";
import { lolIconUrl } from "@/lib/lol-icons";

export type LeagueGameObjectives = {
  entrantId: number;
  side: LeagueSide;
  kills: number;
  towers: number;
  inhibitors: number;
  dragons: number;
  dragonTypes: (string | null)[];
  barons: number;
  heralds: number;
  grubs: number;
  gold: number;
};

export type LeagueGameDraftStep = { step: number; type: "ban" | "pick"; side: LeagueSide; championName: string; iconUrl: string | null };

export type LeagueGameDraft = {
  blueEntrantId: number | null;
  steps: LeagueGameDraftStep[];
};

export type PlayerRunes = { keystoneName: string | null; keystoneIconUrl: string | null; secondaryName: string | null; secondaryIconUrl: string | null };

export type LeagueGamePlayer = {
  entrantId: number;
  personId: number | null;
  handle: string;
  championName: string;
  championIconUrl: string | null;
  role: string | null;
  kills: number;
  deaths: number;
  assists: number;
  killParticipation: number;
  /** Null for a game without a known length. */
  csPerMinute: number | null;
  goldPerMinute: number | null;
  items: { name: string; iconUrl: string | null }[];
  /** The role quest item, shown under the trinket. Null when the player has none. */
  roleItem: { name: string; iconUrl: string | null } | null;
  runes: PlayerRunes;
};

export type LeagueMatchGame = {
  id: number;
  order: number;
  isCompleted: boolean;
  isForfeit: boolean;
  durationSeconds: number | null;
  winnerEntrantId: number | null;
  scoreAfter: { a: number; b: number };
  note: string | null;
  objectives: LeagueGameObjectives[];
  draft: LeagueGameDraft | null;
  players: LeagueGamePlayer[];
};

function runesOf(runes: unknown, names: Record<string, string>): PlayerRunes {
  const page = runes as { primaryPerks?: unknown; subStyle?: unknown } | null;
  const keystone = Array.isArray(page?.primaryPerks) && typeof page.primaryPerks[0] === "number" ? page.primaryPerks[0] : null;
  const secondary = typeof page?.subStyle === "number" ? page.subStyle : null;
  return {
    keystoneName: keystone === null ? null : (names[String(keystone)] ?? null),
    keystoneIconUrl: keystone === null ? null : lolIconUrl("runes", String(keystone)),
    secondaryName: secondary === null ? null : (names[String(secondary)] ?? null),
    secondaryIconUrl: secondary === null ? null : lolIconUrl("runes", String(secondary)),
  };
}

export type LeagueSeries = { games: LeagueMatchGame[]; averages: SeriesAverage[] };

/** The dragon types a team took, as stored at import. Without a list that matches the dragon count, the types are unknown. */
function dragonTypesOf(team: { dragons: number }, stored: string[] | null): (string | null)[] {
  return stored !== null && stored.length === team.dragons ? stored : Array.from({ length: team.dragons }, (): null => null);
}

async function loadLeagueMatchGames(matchId: number, patch: string | null, entrants: { entrantAId: number | null; entrantBId: number | null }): Promise<LeagueSeries> {
  const { games, gameTeamStats, gameDraft, gamePlayerStats } = leagueTablesOf("lol");
  const { people } = gameTables("lol");

  const gameRows = await db
    .select({
      id: games.id,
      order: games.order,
      isCompleted: games.isCompleted,
      isForfeit: games.isForfeit,
      durationSeconds: games.durationSeconds,
      winnerEntrantId: games.winnerEntrantId,
      note: games.note,
      source: games.source,
      draftFirstPick: games.draftFirstPick,
      draftBlueEntrantId: games.draftBlueEntrantId,
    })
    .from(games)
    .where(eq(games.matchId, matchId))
    .orderBy(asc(games.order), asc(games.id));
  if (gameRows.length === 0) return { games: [], averages: [] };
  const gameIds = gameRows.map((g) => g.id);

  const [teamRows, draftRows, playerRows, { championIconKeys: iconKeys, itemNames, runeNames }] = await Promise.all([
    db
      .select({
        gameId: gameTeamStats.gameId,
        entrantId: gameTeamStats.entrantId,
        side: gameTeamStats.side,
        kills: gameTeamStats.kills,
        towers: gameTeamStats.towers,
        inhibitors: gameTeamStats.inhibitors,
        dragons: gameTeamStats.dragons,
        barons: gameTeamStats.barons,
        heralds: gameTeamStats.heralds,
        dragonTypes: gameTeamStats.dragonTypes,
        grubs: gameTeamStats.grubs,
        gold: gameTeamStats.gold,
      })
      .from(gameTeamStats)
      .where(inArray(gameTeamStats.gameId, gameIds)),
    db
      .select({ gameId: gameDraft.gameId, entrantId: gameDraft.entrantId, championName: gameDraft.championName, type: gameDraft.type, order: gameDraft.order })
      .from(gameDraft)
      .where(and(inArray(gameDraft.gameId, gameIds), isNotNull(gameDraft.order))),
    db
      .select({
        gameId: gamePlayerStats.gameId,
        entrantId: gamePlayerStats.entrantId,
        personId: gamePlayerStats.personId,
        handle: people.handle,
        championName: gamePlayerStats.championName,
        role: gamePlayerStats.role,
        kills: gamePlayerStats.kills,
        deaths: gamePlayerStats.deaths,
        assists: gamePlayerStats.assists,
        cs: gamePlayerStats.cs,
        gold: gamePlayerStats.gold,
        items: gamePlayerStats.items,
        roleBoundItem: gamePlayerStats.roleBoundItem,
        runes: gamePlayerStats.runes,
      })
      .from(gamePlayerStats)
      .leftJoin(people, eq(people.id, gamePlayerStats.personId))
      .where(inArray(gamePlayerStats.gameId, gameIds))
      .orderBy(asc(gamePlayerStats.id)),
    getDisplayCatalog(patch),
  ]);

  const championIconUrl = (name: string): string | null => {
    const key = iconKeys[name];
    return key === undefined ? null : lolIconUrl("champions", key);
  };

  const loaded = gameRows.map((game): Omit<LeagueMatchGame, "scoreAfter"> => {
    const teams = teamRows.filter((row) => row.gameId === game.id);
    const draft = draftRows.filter((row) => row.gameId === game.id);
    const firstPick: LeagueSide = game.draftFirstPick === "red" ? "red" : "blue";
    // An import's blue team is the one the stats name; a game by hand keeps the blue entrant saved with its draft.
    const knownBlueEntrantId = game.source !== null ? (teams.find((team) => team.side === "blue")?.entrantId ?? null) : game.draftBlueEntrantId;
    const firstPlaced = draft.find((row): row is typeof row & { order: number } => row.order !== null) ?? null;
    const blueEntrantId = blueEntrantOf({ knownBlueEntrantId, firstPick, entrantAId: entrants.entrantAId, entrantBId: entrants.entrantBId, firstPlaced });

    const steps = draft.flatMap((row): LeagueGameDraftStep[] => {
      const step = row.order === null ? null : draftStep(row.order);
      return step ? [{ step: step.step, type: step.type, side: stepSide(step, firstPick), championName: row.championName, iconUrl: championIconUrl(row.championName) }] : [];
    });

    return {
      id: game.id,
      order: game.order,
      isCompleted: game.isCompleted,
      isForfeit: game.isForfeit,
      durationSeconds: game.durationSeconds,
      winnerEntrantId: game.winnerEntrantId,
      note: game.note,
      objectives: teams.map((team): LeagueGameObjectives => ({
        entrantId: team.entrantId,
        side: team.side as LeagueSide,
        kills: team.kills,
        towers: team.towers,
        inhibitors: team.inhibitors,
        dragons: team.dragons,
        dragonTypes: dragonTypesOf(team, team.dragonTypes),
        barons: team.barons,
        heralds: team.heralds,
        grubs: team.grubs,
        gold: team.gold,
      })),
      // A draft still being filled in is not shown: only a draft with every step is.
      draft: steps.length === LEAGUE_DRAFT_STEPS.length ? { blueEntrantId, steps } : null,
      players: playerRows
        .filter((row) => row.gameId === game.id)
        .map((row): LeagueGamePlayer => ({
          entrantId: row.entrantId,
          personId: row.personId,
          handle: row.handle ?? row.championName,
          championName: row.championName,
          championIconUrl: championIconUrl(row.championName),
          role: row.role,
          kills: row.kills,
          deaths: row.deaths,
          assists: row.assists,
          killParticipation: killParticipation(row.kills, row.assists, teams.find((team) => team.entrantId === row.entrantId)?.kills ?? 0),
          csPerMinute: perMinute(row.cs, game.durationSeconds),
          goldPerMinute: perMinute(row.gold, game.durationSeconds),
          items: (row.items as number[]).map((id) => ({ name: itemNames[String(id)] ?? "Item", iconUrl: lolIconUrl("items", String(id)) })),
          roleItem: row.roleBoundItem === null ? null : { name: itemNames[String(row.roleBoundItem)] ?? "Item", iconUrl: lolIconUrl("items", String(row.roleBoundItem)) },
          runes: runesOf(row.runes, runeNames),
        })),
    };
  });

  const scored = loaded.map((game): LeagueMatchGame => ({ ...game, scoreAfter: seriesScoreThrough(loaded, game.order, entrants.entrantAId, entrants.entrantBId) }));
  const averages = averageSeriesLines(scored.filter((game) => game.isCompleted).flatMap((game) => game.players));
  return { games: scored, averages };
}

/**
 * The games of a LoL series, cached a day. Invalidated with the rest of the match (`match:{id}`) by the admin game
 * actions, and by player handle edits (`match-stats`).
 */
export function getMatchLeagueGames(matchId: number, patch: string | null, entrants: { entrantAId: number | null; entrantBId: number | null }): Promise<LeagueSeries> {
  return unstable_cache(
    () => loadLeagueMatchGames(matchId, patch, entrants),
    ["match-league-series-v10",String(matchId), patch ?? "", String(entrants.entrantAId), String(entrants.entrantBId)],
    { tags: [matchTag(matchId), MATCH_STATS_TAG], revalidate: 86400 },
  )();
}
