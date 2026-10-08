/**
 * GC-Stats - widget-params
 *
 * Parses and builds the query string params for the OBS overlay widget
 * URLs (heatmap, head to head). Invalid values are silently dropped rather
 * than rejected, since these URLs are pasted into a Browser Source, not
 * submitted as a form.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { VALORANT_AGENTS } from "@/lib/valorant-agents";
import { isValorantMapKey } from "@/lib/valorant-minimaps";

/** Base URL of the hosted Widgets front (separate repo), no trailing slash. */
export const WIDGETS_URL = (process.env.NEXT_PUBLIC_WIDGETS_URL ?? "http://localhost:5173").replace(/\/$/, "");

function widgetUrl(path: string, query: URLSearchParams): string {
  return `${WIDGETS_URL}${path}?${query.toString()}`;
}

export type WidgetSearchParams = Record<string, string | string[] | undefined>;

const EVENT_TYPES = ["kill", "plant", "defuse"] as const;
type EventType = (typeof EVENT_TYPES)[number];

function str(params: WidgetSearchParams, key: string): string | null {
  const value = params[key];
  const v = Array.isArray(value) ? value[0] : value;
  return v && v.length > 0 ? v : null;
}

function flag(params: WidgetSearchParams, key: string): boolean {
  return str(params, key) === "1";
}

function int(params: WidgetSearchParams, key: string): number | null {
  const v = str(params, key);
  if (v == null) return null;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * Both widget pages are GET/query-string driven (an OBS Browser Source URL,
 * not a mutating form) — an invalid or missing value is dropped rather than
 * rejected with an error, same as V1's overlay degrading gracefully instead
 * of ever showing a validation error to a broadcast scene.
 */
export type HeatmapWidgetParams = {
  map: string | null;
  tournamentId: number | null;
  startDate: string | null;
  endDate: string | null;
  side: "atk" | "def" | null;
  teamId: number | null;
  playerId: number | null;
  eventTypes: EventType[];
  agent: string | null;
  color: string | null;
  timeStart: number | null;
  timeEnd: number | null;
  timeReference: "round" | "plant";
  rotation: "atk" | "def";
  credit: boolean;
};

export function parseHeatmapWidgetParams(params: WidgetSearchParams): HeatmapWidgetParams {
  const mapRaw = str(params, "map");
  const map = mapRaw && isValorantMapKey(mapRaw.toLowerCase()) ? mapRaw.toLowerCase() : null;

  const sideRaw = str(params, "side");
  const side = sideRaw === "atk" || sideRaw === "def" ? sideRaw : null;

  const eventTypeRaw = str(params, "event_type");
  const eventTypes = eventTypeRaw
    ? (eventTypeRaw.split(",").map((s) => s.trim()) as EventType[]).filter((t) => (EVENT_TYPES as readonly string[]).includes(t))
    : [];

  const agentRaw = str(params, "agent");
  const agent = agentRaw && (VALORANT_AGENTS as readonly string[]).includes(agentRaw) ? agentRaw : null;

  const colorRaw = str(params, "color");
  const color = colorRaw && /^#?[0-9a-fA-F]{6}$/.test(colorRaw) ? colorRaw.replace("#", "") : null;

  let timeStart = int(params, "time_start");
  if (timeStart != null && timeStart < 0) timeStart = null;
  let timeEnd = int(params, "time_end");
  if (timeEnd != null && (timeEnd < 0 || (timeStart != null && timeEnd < timeStart))) timeEnd = null;

  const timeReferenceRaw = str(params, "time_reference");
  const timeReference = timeReferenceRaw === "plant" ? "plant" : "round";

  return {
    map,
    tournamentId: int(params, "tournament_id"),
    startDate: str(params, "start_date"),
    endDate: str(params, "end_date"),
    side,
    teamId: int(params, "team_id"),
    playerId: int(params, "player_id"),
    eventTypes,
    agent,
    color,
    timeStart,
    timeEnd,
    timeReference,
    rotation: str(params, "rotation") === "def" ? "def" : "atk",
    credit: flag(params, "credit"),
  };
}

export function buildHeatmapWidgetUrl(p: Partial<HeatmapWidgetParams>): string | null {
  if (!p.map) return null;
  const q = new URLSearchParams();
  q.set("map", p.map);
  if (p.tournamentId != null) q.set("tournament_id", String(p.tournamentId));
  if (p.startDate) q.set("start_date", p.startDate);
  if (p.endDate) q.set("end_date", p.endDate);
  if (p.side) q.set("side", p.side);
  if (p.teamId != null) q.set("team_id", String(p.teamId));
  if (p.playerId != null) q.set("player_id", String(p.playerId));
  if (p.eventTypes && p.eventTypes.length > 0) q.set("event_type", p.eventTypes.join(","));
  if (p.agent) q.set("agent", p.agent);
  if (p.color) q.set("color", p.color);
  if (p.timeStart != null) q.set("time_start", String(p.timeStart));
  if (p.timeEnd != null) q.set("time_end", String(p.timeEnd));
  if (p.timeReference && p.timeReference !== "round") q.set("time_reference", p.timeReference);
  if (p.rotation === "def") q.set("rotation", "def");
  if (p.credit) q.set("credit", "1");
  return widgetUrl("/heatmap", q);
}

export type HeadToHeadWidgetParams = {
  teamA: number | null;
  teamB: number | null;
  tournamentId: number | null;
  startDate: string | null;
  endDate: string | null;
  patch: string | null;
  mapPool: string[];
  credit: boolean;
};

/** Accepts `mappool=Ascent,Bind` or `mappool=[Ascent,Bind]` — matches V1's WidgetController::parseMapPool(), easier to paste into an OBS Browser Source URL than array query syntax. */
function parseMapPool(raw: string | null): string[] {
  if (!raw) return [];
  const trimmed = raw.trim().replace(/^\[/, "").replace(/\]$/, "");
  if (!trimmed) return [];
  return trimmed
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
}

export function parseHeadToHeadWidgetParams(params: WidgetSearchParams): HeadToHeadWidgetParams {
  return {
    teamA: int(params, "team_a"),
    teamB: int(params, "team_b"),
    tournamentId: int(params, "tournament_id"),
    startDate: str(params, "start_date"),
    endDate: str(params, "end_date"),
    patch: str(params, "patch"),
    mapPool: parseMapPool(str(params, "mappool")),
    credit: flag(params, "credit"),
  };
}

export function buildHeadToHeadWidgetUrl(p: Partial<HeadToHeadWidgetParams>): string | null {
  if (p.teamA == null || p.teamB == null) return null;
  const q = new URLSearchParams();
  q.set("team_a", String(p.teamA));
  q.set("team_b", String(p.teamB));
  if (p.tournamentId != null) q.set("tournament_id", String(p.tournamentId));
  if (p.startDate) q.set("start_date", p.startDate);
  if (p.endDate) q.set("end_date", p.endDate);
  if (p.patch) q.set("patch", p.patch);
  if (p.mapPool && p.mapPool.length > 0) q.set("mappool", p.mapPool.join(","));
  if (p.credit) q.set("credit", "1");
  return widgetUrl("/head-to-head", q);
}
