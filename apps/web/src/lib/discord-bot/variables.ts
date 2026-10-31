/**
 * GC-Stats - variables
 *
 * Turns a match into what an alert template can show: the texts and raw values behind
 * its text layers and conditions, and the pictures behind its image layers. Pure, so the
 * bot and the template editor build their sample from the same code.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { agentIconUrl } from "@/lib/valorant-agents";
import { mapSplashUrl } from "@/lib/valorant-maps";
import { MAP_KEYS, VETO_KEYS } from "./template";

/** Best player by ACS: of a map, or of a match (average over its maps). */
export type AlertMvp = { handle: string; acs: number; imageUrl: string | null; agentName: string | null };

// `by` is the team that made the veto, `side` the side chosen on the map (picks and decider).
export type AlertVeto = { order: number; type: string; mapName: string; by: "a" | "b" | null; side: "atk" | "def" | null };

export type AlertMap = { id: number; order: number; mapName: string | null; scoreA: number | null; scoreB: number | null; isCompleted: boolean; mvp: AlertMvp | null; mvpA: AlertMvp | null; mvpB: AlertMvp | null };

export type AlertMatch = {
  id: number;
  status: "pending" | "live" | "completed";
  nameA: string;
  nameB: string;
  // Short names, the full name when a team has none.
  shortA: string;
  shortB: string;
  scoreA: number | null;
  scoreB: number | null;
  bestOf: number;
  tournamentName: string;
  // Stage of the tournament the match belongs to.
  stageName: string;
  // ISO date, null when the match is not scheduled.
  scheduledAt: string | null;
  maps: AlertMap[];
  vetos: AlertVeto[];
  mvp: AlertMvp | null;
  mvpA: AlertMvp | null;
  mvpB: AlertMvp | null;
  // Null when the team has none, the image shows initials instead.
  logoA: string | null;
  logoB: string | null;
};

export type AlertKind = "live" | "finished" | "map";

export type Translate = (key: string, values?: Record<string, string | number>) => string;

export function formatScore(a: number | null, b: number | null): string {
  return `${a ?? 0} - ${b ?? 0}`;
}

/** The map the alert is about: the finished one of a map alert, the one being played for a live match. */
function currentMapOf(kind: AlertKind, match: AlertMatch, map?: AlertMap): AlertMap | undefined {
  if (map) return map;
  if (kind !== "live") return undefined;
  return [...match.maps].sort((a, b) => a.order - b.order).find((m) => !m.isCompleted && m.mapName);
}

function mvpOf(kind: AlertKind, match: AlertMatch, map?: AlertMap): AlertMvp | null {
  return map ? map.mvp : kind === "live" ? null : match.mvp;
}

function teamMvpOf(kind: AlertKind, match: AlertMatch, side: "a" | "b", map?: AlertMap): AlertMvp | null {
  if (map) return side === "a" ? map.mvpA : map.mvpB;
  if (kind === "live") return null;
  return side === "a" ? match.mvpA : match.mvpB;
}

/** Pictures a template can show, by image source. `baseUrl` prefixes the site assets (empty in the browser). */
export function buildAlertImages(kind: AlertKind, match: AlertMatch, map: AlertMap | undefined, baseUrl: string): Record<string, string | null> {
  const splash = (mapName: string | null | undefined) => {
    const path = mapSplashUrl(mapName ?? null);
    return path ? `${baseUrl}${path}` : null;
  };
  const sortedMaps = [...match.maps].sort((a, b) => a.order - b.order);
  const sortedVetos = [...match.vetos].sort((a, b) => a.order - b.order);
  const mvp = mvpOf(kind, match, map);
  const agent = mvp?.agentName ? `${baseUrl}${agentIconUrl(mvp.agentName)}` : null;
  return {
    teamA: match.logoA,
    teamB: match.logoB,
    // Player picture, the agent icon when the player has none.
    mvp: mvp?.imageUrl ?? agent,
    mvpAgent: agent,
    mapCurrent: splash(currentMapOf(kind, match, map)?.mapName),
    ...Object.fromEntries(MAP_KEYS.map((key, i) => [key, splash(sortedMaps[i]?.mapName)])),
    ...Object.fromEntries(VETO_KEYS.map((key, i) => [key, splash(sortedVetos[i]?.mapName)])),
  };
}

/** Texts and raw values of an alert: the ready made fields and the variables of custom texts and conditions. */
export function buildAlertFields(kind: AlertKind, match: AlertMatch, t: Translate, map?: AlertMap): Record<string, string> {
  const finishedMaps = match.maps.filter((m) => m.isCompleted).sort((a, b) => a.order - b.order);
  const sortedMaps = [...match.maps].sort((a, b) => a.order - b.order);
  const sortedVetos = [...match.vetos].sort((a, b) => a.order - b.order);
  const isLive = kind === "live" && match.status === "live";
  const mvp = mvpOf(kind, match, map);
  const mvpA = teamMvpOf(kind, match, "a", map);
  const mvpB = teamMvpOf(kind, match, "b", map);
  const current = currentMapOf(kind, match, map);
  const mvpFields = (prefix: string, player: AlertMvp | null) => ({
    [`${prefix}.name`]: player?.handle ?? "",
    [`${prefix}.acs`]: player ? String(player.acs) : "",
    [`${prefix}.agent`]: player?.agentName ?? "",
  });

  const mapLabel = (m: AlertMap) => `${m.mapName ?? t("map", { number: m.order })} ${formatScore(m.scoreA, m.scoreB)}`;
  const teamName = (side: "a" | "b" | null) => (side === "a" ? match.nameA : side === "b" ? match.nameB : "");
  const vetoLabel = (v: AlertVeto) => (v.type === "decider" ? t("vetoDecider", { map: v.mapName }) : t(v.type === "ban" ? "vetoBan" : "vetoPick", { team: teamName(v.by), map: v.mapName }));
  const vetoAction = (type: string) => t(type === "ban" ? "actionBan" : type === "pick" ? "actionPick" : "actionDecider");

  return {
    "alert.kind": kind,
    "currentMap.name": current?.mapName ?? "",
    "currentMap.number": current ? String(current.order) : "",
    ...mvpFields("mvp", mvp),
    ...mvpFields("mvpA", mvpA),
    ...mvpFields("mvpB", mvpB),
    ...Object.fromEntries(
      MAP_KEYS.flatMap((key, i) => {
        const m = sortedMaps[i];
        const played = !!m?.isCompleted;
        return [
          [key, m?.mapName ?? ""],
          [`${key}.name`, m?.mapName ?? ""],
          [`${key}.score`, m && played ? formatScore(m.scoreA, m.scoreB) : ""],
          [`${key}.scoreA`, m && played ? String(m.scoreA ?? 0) : ""],
          [`${key}.scoreB`, m && played ? String(m.scoreB ?? 0) : ""],
        ];
      }),
    ),
    ...Object.fromEntries(
      VETO_KEYS.flatMap((key, i) => {
        const v = sortedVetos[i];
        return [
          [`${key}.map`, v?.mapName ?? ""],
          [`${key}.action`, v ? vetoAction(v.type) : ""],
          [`${key}.team`, v ? teamName(v.by) : ""],
          [`${key}.type`, v?.type ?? ""],
          [`${key}.side`, v?.side ? t(v.side === "atk" ? "sideAttack" : "sideDefense") : ""],
        ];
      }),
    ),
    tournament: match.tournamentName,
    stage: match.stageName,
    scheduledAt: match.scheduledAt ?? "",
    teamA: match.nameA,
    teamB: match.nameB,
    teamAShort: match.shortA,
    teamBShort: match.shortB,
    scoreA: String(map ? (map.scoreA ?? 0) : (match.scoreA ?? 0)),
    scoreB: String(map ? (map.scoreB ?? 0) : (match.scoreB ?? 0)),
    score: map ? formatScore(map.scoreA, map.scoreB) : formatScore(match.scoreA, match.scoreB),
    status: kind === "map" && map ? t("mapFinished", { number: map.order }) : isLive ? t("live") : t("finished"),
    bestOf: t("bestOf", { count: match.bestOf }),
    bestOfShort: `BO${match.bestOf}`,
    map: map?.mapName ?? "",
    maps: finishedMaps.map(mapLabel).join("\n"),
    matchScore: formatScore(match.scoreA, match.scoreB),
    mapsInline: finishedMaps.map(mapLabel).join("  ·  "),
    vetos: sortedVetos.map(vetoLabel).join("  ·  "),
    mvp: mvp ? t("mvp", { name: mvp.handle, acs: mvp.acs }) : "",
    mvpA: mvpA ? t("mvp", { name: mvpA.handle, acs: mvpA.acs }) : "",
    mvpB: mvpB ? t("mvp", { name: mvpB.handle, acs: mvpB.acs }) : "",
  };
}

const NOVA: AlertMvp = { handle: "Nova", acs: 287, imageUrl: null, agentName: "Jett" };
const KAIRO: AlertMvp = { handle: "Kairo", acs: 301, imageUrl: null, agentName: "Reyna" };

// Sample match shown by the editor canvas and the server preview.
export const SAMPLE_MAPS: AlertMap[] = [
  { id: 1, order: 1, mapName: "Ascent", scoreA: 13, scoreB: 9, isCompleted: true, mvp: NOVA, mvpA: NOVA, mvpB: { handle: "Echo", acs: 241, imageUrl: null, agentName: "Omen" } },
  { id: 2, order: 2, mapName: "Haven", scoreA: 8, scoreB: 13, isCompleted: true, mvp: KAIRO, mvpA: { handle: "Nova", acs: 233, imageUrl: null, agentName: "Jett" }, mvpB: KAIRO },
  { id: 3, order: 3, mapName: "Sunset", scoreA: null, scoreB: null, isCompleted: false, mvp: null, mvpA: null, mvpB: null },
];

export const SAMPLE_VETOS: AlertVeto[] = [
  { order: 1, type: "ban", mapName: "Bind", by: "a", side: null },
  { order: 2, type: "ban", mapName: "Split", by: "b", side: null },
  { order: 3, type: "pick", mapName: "Ascent", by: "a", side: "atk" },
  { order: 4, type: "pick", mapName: "Haven", by: "b", side: "def" },
  { order: 5, type: "ban", mapName: "Lotus", by: "a", side: null },
  { order: 6, type: "ban", mapName: "Pearl", by: "b", side: null },
  { order: 7, type: "decider", mapName: "Sunset", by: null, side: "atk" },
];

export function sampleMatch(kind: AlertKind): AlertMatch {
  return {
    id: 0,
    status: kind === "live" ? "live" : "completed",
    nameA: "Team Alpha",
    nameB: "Team Beta",
    shortA: "ALP",
    shortB: "BET",
    scoreA: 1,
    scoreB: 1,
    bestOf: 3,
    tournamentName: "GC Stats Open",
    stageName: "Group Stage",
    scheduledAt: "2026-03-14T17:00:00Z",
    maps: SAMPLE_MAPS,
    vetos: SAMPLE_VETOS,
    mvp: { handle: "Kairo", acs: 274, imageUrl: null, agentName: "Reyna" },
    mvpA: { handle: "Nova", acs: 258, imageUrl: null, agentName: "Jett" },
    mvpB: { handle: "Kairo", acs: 274, imageUrl: null, agentName: "Reyna" },
    logoA: null,
    logoB: null,
  };
}
