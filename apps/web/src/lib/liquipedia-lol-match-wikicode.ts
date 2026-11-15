/**
 * GC-Stats - liquipedia-lol-match-wikicode
 *
 * Liquipedia match wikicode for League of Legends: reads a pasted `{{Match}}`
 * and builds one from our data. League has no veto, the games sit in
 * `|map1={{Map|...}}` params inside the match. Pure, no DB access.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { LEAGUE_DRAFT_STEPS, LEAGUE_ROLES, draftStep, type DraftTurn, type LeagueSide } from "@gc-stats/lol-stats-engine";
import { extractAllTemplates, parseTemplateParams } from "@/lib/wikicode-import";
import { buildChannels, formatLiquipediaDate } from "@/lib/liquipedia-match-wikicode";
import { formatGameDuration } from "@/lib/league-scoreboard";

/** Liquipedia lists five champions and five bans per team. */
export const TEAM_SLOTS = 5;
/** The most games a series can have; `map1` to `map9` are read, as for Valorant. */
const MAX_GAMES = 9;
const INDENT = "    ";

// --- Draft steps of the ban slots --------------------------------------------------------

/**
 * The draft steps of the five ban slots of a team, in slot order: `b1`–`b3` are its bans of ban phase 1 and `b4`–`b5`
 * those of ban phase 2. The team of the "first" turn has the first ban, so it is steps 1, 3, 5, 14, 16; the other one
 * 2, 4, 6, 13, 15.
 */
export function banStepsOfTurn(turn: DraftTurn): number[] {
  return LEAGUE_DRAFT_STEPS.filter((step) => step.type === "ban" && step.turn === turn).map((step) => step.step);
}

/** Which ban slot (1–5) a draft step is for that team, null when the step is not a ban. */
export function banSlotOfStep(step: number): number | null {
  const info = draftStep(step);
  if (!info || info.type !== "ban") return null;
  return banStepsOfTurn(info.turn).indexOf(step) + 1;
}

// --- Reading ------------------------------------------------------------------------------

export type WikicodeTeamSide = {
  /** Champions in the order of the params, `""` for an empty slot. Liquipedia lists them in lane order. */
  champions: string[];
  /** Bans in ban order, `""` for a missed ban. */
  bans: string[];
};

export type WikicodeLolGame = {
  /** 1-based, the N of `mapN`. */
  order: number;
  /** The side team 1 played, null when the wikicode doesn't say. */
  team1Side: LeagueSide | null;
  /** 1 or 2, null when nobody won (yet). */
  winner: 1 | 2 | null;
  lengthSeconds: number | null;
  team1: WikicodeTeamSide;
  team2: WikicodeTeamSide;
};

export type WikicodeLolMatch = {
  bestOf: number | null;
  patch: string | null;
  /** `score=FF` or `score=W` on an opponent: the series was decided without playing. */
  forfeit: boolean;
  /** The games that were played, in order. A skipped game or one without any data is left out. */
  games: WikicodeLolGame[];
};

export type ParseLolMatchResult = { ok: true; match: WikicodeLolMatch } | { ok: false; error: "oneMatchOnly" };

/** "36:41" → 2201, "1:02:03" → 3723. Null for anything else. */
export function parseGameLength(raw: string | undefined): number | null {
  const parts = (raw ?? "").trim().split(":");
  if (parts.length < 2 || parts.length > 3 || parts.some((part) => !/^\d{1,2}$/.test(part))) return null;
  return parts.reduce((total, part) => total * 60 + Number(part), 0);
}

/** Every champion and ban of a game, empty slots included. */
export function wikicodeChampionNames(game: WikicodeLolGame): string[] {
  return [...game.team1.champions, ...game.team1.bans, ...game.team2.champions, ...game.team2.bans];
}

function readSide(params: Record<string, string>, team: 1 | 2): WikicodeTeamSide {
  const slots = (prefix: "c" | "b") => Array.from({ length: TEAM_SLOTS }, (_, i) => (params[`t${team}${prefix}${i + 1}`] ?? "").trim());
  return { champions: slots("c"), bans: slots("b") };
}

function readGame(order: number, template: string): WikicodeLolGame | null {
  const params = parseTemplateParams(template);
  if ((params["finished"] ?? "").trim().toLowerCase() === "skip") return null;

  const side = (params["team1side"] ?? "").trim().toLowerCase();
  const winner = (params["winner"] ?? "").trim();
  const game: WikicodeLolGame = {
    order,
    team1Side: side === "blue" || side === "red" ? side : null,
    winner: winner === "1" ? 1 : winner === "2" ? 2 : null,
    lengthSeconds: parseGameLength(params["length"]),
    team1: readSide(params, 1),
    team2: readSide(params, 2),
  };
  // An empty `{{Map}}` is a game still to be played.
  const hasData = game.winner !== null || game.lengthSeconds !== null || wikicodeChampionNames(game).some((name) => name !== "");
  return hasData ? game : null;
}

function isForfeitScore(opponent: string | undefined): boolean {
  const score = (opponent ? parseTemplateParams(opponent)["score"] : "")?.trim().toUpperCase();
  return score === "FF" || score === "W";
}

/** Reads a pasted `{{Match}}`. The paste must hold exactly one: a rematch in two bracket places makes picking one by team names ambiguous. */
export function parseLolMatchWikicode(wikicode: string): ParseLolMatchResult {
  const templates = extractAllTemplates(wikicode, "Match");
  const [template] = templates;
  if (templates.length !== 1 || template === undefined) return { ok: false, error: "oneMatchOnly" };
  const params = parseTemplateParams(template);

  const games: WikicodeLolGame[] = [];
  for (let order = 1; order <= MAX_GAMES; order++) {
    const template = params[`map${order}`];
    if (!template?.startsWith("{{")) continue;
    const game = readGame(order, template);
    if (game) games.push(game);
  }

  const bestOf = Number(params["bestof"]);
  return {
    ok: true,
    match: {
      bestOf: Number.isInteger(bestOf) && bestOf > 0 ? bestOf : null,
      patch: params["patch"]?.trim() || null,
      forfeit: isForfeitScore(params["opponent1"]) || isForfeitScore(params["opponent2"]),
      games,
    },
  };
}

// --- Champion names -----------------------------------------------------------------------

/** Liquipedia names that are not the display name without punctuation, to the display name written the same way. */
const CHAMPION_ALIASES: Record<string, string> = {
  jarvan: "jarvaniv",
  mundo: "drmundo",
  nunu: "nunuwillump",
  renata: "renataglasc",
  oriana: "orianna",
};

/** "K'Sante" → "ksante", "Nunu & Willump" → "nunuwillump". Letters and digits only, lower case. */
export function championKey(name: string): string {
  return name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export type ChampionResolution = { ok: true; byWikicodeName: Map<string, string> } | { ok: false; unknown: string[] };

/**
 * Matches the champion names of a wikicode to the display names of the match's patch. Every name has to match: one
 * unknown name returns all the unknown ones, so the admin can fix them in one go. Empty names are ignored.
 */
export function resolveChampionNames(wikicodeNames: Iterable<string>, displayNames: readonly string[]): ChampionResolution {
  const displayByKey = new Map(displayNames.map((name) => [championKey(name), name]));
  const byWikicodeName = new Map<string, string>();
  const unknown = new Set<string>();
  for (const name of wikicodeNames) {
    if (name === "" || byWikicodeName.has(name)) continue;
    const key = championKey(name);
    const display = displayByKey.get(key) ?? displayByKey.get(CHAMPION_ALIASES[key] ?? "");
    if (display) byWikicodeName.set(name, display);
    else unknown.add(name);
  }
  return unknown.size > 0 ? { ok: false, unknown: [...unknown] } : { ok: true, byWikicodeName };
}

// --- Draft from the wikicode --------------------------------------------------------------

export type WikicodeDraft = {
  /** Bans on their exact steps, with the display name of the champion. */
  steps: { step: number; side: LeagueSide; championName: string }[];
  /** Picks have no order in the wikicode: they wait to be placed. */
  unplacedPicks: { side: LeagueSide; championName: string }[];
};

/**
 * The draft of one game. `team1Side` is the side of team 1 (so the other team has the other side) and `firstPick` the
 * side with the first ban and first pick, which decides which team has the odd ban steps. The wikicode gives no first
 * pick, so the caller assumes one.
 */
export function draftFromWikicode(game: WikicodeLolGame, names: ReadonlyMap<string, string>, team1Side: LeagueSide, firstPick: LeagueSide): WikicodeDraft {
  const teams = [
    { side: team1Side, team: game.team1 },
    { side: team1Side === "blue" ? ("red" as const) : ("blue" as const), team: game.team2 },
  ];
  const display = (name: string) => names.get(name) ?? name;

  const steps: WikicodeDraft["steps"] = [];
  const unplacedPicks: WikicodeDraft["unplacedPicks"] = [];
  for (const { side, team } of teams) {
    const stepsOfTeam = banStepsOfTurn(side === firstPick ? "first" : "second");
    team.bans.forEach((name, slot) => {
      const step = stepsOfTeam[slot];
      if (name !== "" && step !== undefined) steps.push({ step, side, championName: display(name) });
    });
    for (const name of team.champions) if (name !== "") unplacedPicks.push({ side, championName: display(name) });
  }
  steps.sort((a, b) => a.step - b.step);
  return { steps, unplacedPicks };
}

// --- Writing ------------------------------------------------------------------------------

export type WikicodeLolBuildGame = {
  /** Team 1 is entrant A. Null when the side is unknown. */
  team1Side: LeagueSide | null;
  /** 1 or 2, null when nobody won. */
  winner: 1 | 2 | null;
  durationSeconds: number | null;
  /** Champions per team from the player data, in lane order. Empty (all `""`) when the roles aren't complete. */
  team1Champions: string[];
  team2Champions: string[];
  /** Bans per team in slot order, `""` for an empty slot. */
  team1Bans: string[];
  team2Bans: string[];
};

export type LolMatchWikicodeInput = {
  scheduledAt: Date | null;
  bestOf: number;
  /** Whether the series is over, which turns unplayed games into skipped ones. */
  completed: boolean;
  /** `score=FF` is written on the loser, nothing else of the games. */
  forfeitWinner: 1 | 2 | null;
  /** The reported score, used as `score=` when a completed match has no games (the result was entered by hand). */
  score: { 1: number; 2: number } | null;
  opponent1: string;
  opponent2: string;
  twitch: string[];
  youtube: string[];
  patch: string | null;
  games: WikicodeLolBuildGame[];
};

/** The champions of a team in lane order, from the player rows. Only when the five lanes are each there once. */
export function championsInLaneOrder(players: { role: string | null; championName: string }[]): string[] {
  const byRole = LEAGUE_ROLES.map((role) => players.filter((player) => player.role === role));
  return players.length === LEAGUE_ROLES.length && byRole.every((matching) => matching.length === 1) ? byRole.flatMap(([player]) => (player ? [player.championName] : [])) : [];
}

function buildGame(index: number, game: WikicodeLolBuildGame): string {
  const params: string[] = [];
  if (game.team1Side) {
    params.push(`team1side=${game.team1Side}`);
    params.push(`team2side=${game.team1Side === "blue" ? "red" : "blue"}`);
  }
  for (const [team, champions, bans] of [[1, game.team1Champions, game.team1Bans], [2, game.team2Champions, game.team2Bans]] as const) {
    champions.forEach((name, slot) => {
      if (name !== "") params.push(`t${team}c${slot + 1}=${championKey(name)}`);
    });
    // A missed ban stays in the code as an empty slot, so the later bans keep their number.
    const banCount = bans.reduce((count, name, slot) => (name !== "" ? slot + 1 : count), 0);
    for (let slot = 0; slot < banCount; slot++) params.push(`t${team}b${slot + 1}=${championKey(bans[slot] ?? "")}`);
  }
  if (game.durationSeconds !== null) params.push(`length=${formatGameDuration(game.durationSeconds)}`);
  if (game.winner !== null) params.push(`winner=${game.winner}`);
  return `|map${index}={{Map${params.map((param) => `\n${INDENT}${INDENT}|${param}`).join("")}\n${INDENT}}}`;
}

/** The `{{Match}}` of a series. */
export function buildLolMatchWikicode(input: LolMatchWikicodeInput): string {
  const scoreOnly = input.forfeitWinner === null && input.completed && input.games.length === 0 && input.score !== null;
  const score = (slot: 1 | 2) => (input.forfeitWinner !== null ? `|score=${input.forfeitWinner === slot ? "W" : "FF"}` : scoreOnly && input.score ? `|score=${input.score[slot]}` : "");
  const lines = ["{{Match", `|bestof=${input.bestOf}`];
  lines.push(`|opponent1={{TeamOpponent|${input.opponent1}${score(1)}}}`);
  lines.push(`|opponent2={{TeamOpponent|${input.opponent2}${score(2)}}}`);
  lines.push(`|date=${input.scheduledAt ? formatLiquipediaDate(input.scheduledAt) : ""}`);
  const channels = [buildChannels("twitch", input.twitch), buildChannels("youtube", input.youtube)].filter((c) => c !== null);
  if (channels.length > 0) lines.push(`|${channels.join("|")}`);
  if (input.patch) lines.push(`|patch=${input.patch}`);

  if (input.forfeitWinner === null && !scoreOnly) {
    for (let index = 1; index <= Math.max(input.bestOf, input.games.length); index++) {
      const game = input.games[index - 1];
      if (game) lines.push(buildGame(index, game));
      else lines.push(input.completed ? `|map${index}={{Map|finished=skip}}` : `|map${index}={{Map}}`);
    }
  }

  return [lines[0], ...lines.slice(1).map((line) => `${INDENT}${line}`), "}}"].join("\n");
}
