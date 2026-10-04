/**
 * GC-Stats - admin-map-fetch
 *
 * Admin server actions for fetching a map's stats from Riot via RiotRelay
 * and merging/renewing the result into a match. Re-exports fetch-map types
 * so client components never import straight from lib/map-fetch, which
 * pulls in `db`.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use server";

import { and, eq, ne } from "drizzle-orm";
import { updateTag } from "next/cache";
import { adminDb as db } from "@gc-stats/db/client";
import { maps, matches, stageContainers, stages, tournaments, PERMISSIONS } from "@gc-stats/db";
import { requireActorPermission } from "@/lib/rbac";
import { matchTag } from "@/lib/cache-tags";
import { fetchMapData as runFetchMapData } from "@/lib/map-fetch/fetch-map-data";
import type { FetchMapResult } from "@/lib/map-fetch/types";
import { mergeMatch, renewMatch, RIOT_RELAY_REGIONS, type RiotRelayError, type RiotRelayRegion } from "@/lib/riot-relay-client";
import { resolveRiotRegion } from "@/lib/map-fetch/riot-region";

// Re-exported so client components only ever import fetch-map TYPES through
// this "use server" boundary (never straight from lib/map-fetch/*, which
// pulls in `db`) — same convention as MapInput/MapFieldErrors from
// admin-matches.ts. Type-only exports are erased at compile time, so they
// don't run afoul of "a 'use server' file can only export async functions"
// (RIOT_RELAY_REGIONS is a real runtime value, not a type — components
// import it straight from riot-relay-client.ts instead, which is a plain
// fetch()-only module with no `db` dependency).
export type { FetchMapResult, FetchMapError, TeamColorRoster } from "@/lib/map-fetch/types";
export type { MissingPuuidPlayer } from "@/lib/map-fetch/identity-resolution";
export type { RiotRelayError, RiotRelayRegion };

async function requireTournamentsActor(): Promise<void> {
  await requireActorPermission(PERMISSIONS.tournamentsManage);
}

async function loadMapRegionContext(mapId: number) {
  const [row] = await db
    .select({ apiMatchId: maps.apiMatchId, tournamentRegion: tournaments.region })
    .from(maps)
    .innerJoin(matches, eq(matches.id, maps.matchId))
    .innerJoin(stageContainers, eq(stageContainers.id, matches.containerId))
    .innerJoin(stages, eq(stages.id, stageContainers.stageId))
    .innerJoin(tournaments, eq(tournaments.id, stages.tournamentId))
    .where(eq(maps.id, mapId))
    .limit(1);
  return row ?? null;
}

const API_MATCH_ID_RE = /^[A-Za-z0-9_-]{1,100}$/;

/**
 * Saves the match id the admin currently has in the form when it differs
 * from the stored one, so Fetch/Renew never act on a stale, unsaved id.
 * Empty or malformed input leaves the stored id alone.
 */
async function applyFormMatchId(mapId: number, apiMatchId: string | undefined): Promise<{ ok: true } | { ok: false; error: { kind: "duplicateMatchId" } }> {
  const trimmed = apiMatchId?.trim() ?? "";
  if (!trimmed || !API_MATCH_ID_RE.test(trimmed)) return { ok: true };
  const [current] = await db.select({ apiMatchId: maps.apiMatchId, matchId: maps.matchId }).from(maps).where(eq(maps.id, mapId)).limit(1);
  if (!current || current.apiMatchId === trimmed) return { ok: true };
  const [conflict] = await db
    .select({ id: maps.id })
    .from(maps)
    .where(and(eq(maps.apiMatchId, trimmed), ne(maps.id, mapId)))
    .limit(1);
  if (conflict) return { ok: false, error: { kind: "duplicateMatchId" } };
  await db.update(maps).set({ apiMatchId: trimmed }).where(eq(maps.id, mapId));
  updateTag(matchTag(current.matchId));
  return { ok: true };
}

export type FetchMapOptions = { puuidMapping?: Record<string, number>; teamAColor?: "Red" | "Blue"; apiMatchId?: string };

export async function fetchMapData(mapId: number, options?: FetchMapOptions): Promise<FetchMapResult> {
  await requireTournamentsActor();

  const applied = await applyFormMatchId(mapId, options?.apiMatchId);
  if (!applied.ok) return applied;

  const puuidMapping = options?.puuidMapping ? new Map(Object.entries(options.puuidMapping)) : undefined;
  const result = await runFetchMapData(mapId, { puuidMapping, teamAColor: options?.teamAColor });
  if (result.ok) {
    const [map] = await db.select({ matchId: maps.matchId }).from(maps).where(eq(maps.id, mapId)).limit(1);
    if (map) updateTag(matchTag(map.matchId));
  }
  return result;
}

export type RenewMapError = RiotRelayError | { kind: "mapNotFound" } | { kind: "noMatchId" } | { kind: "regionNotConfigured" } | { kind: "duplicateMatchId" };
export type RenewMapResult = { ok: true } | { ok: false; error: RenewMapError };

export async function renewMapData(mapId: number, apiMatchId?: string): Promise<RenewMapResult> {
  await requireTournamentsActor();

  const applied = await applyFormMatchId(mapId, apiMatchId);
  if (!applied.ok) return applied;

  const row = await loadMapRegionContext(mapId);
  if (!row) return { ok: false, error: { kind: "mapNotFound" } };
  if (!row.apiMatchId) return { ok: false, error: { kind: "noMatchId" } };

  const region = resolveRiotRegion(row.tournamentRegion);
  if (!region) return { ok: false, error: { kind: "regionNotConfigured" } };

  const result = await renewMatch(region, row.apiMatchId);
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

export type MergeSegmentInput = { matchId: string; startRound: string; endRound: string };
export type MergeSegmentsInput = { region: RiotRelayRegion; segments: MergeSegmentInput[] };
export type MergeSegmentsFieldErrors = Partial<Record<"region" | "segments", string>>;
export type MergeSegmentsResult = { ok: true; apiMatchId: string } | { ok: false; fieldErrors?: MergeSegmentsFieldErrors; error?: RiotRelayError };

const MATCH_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

export async function mergeMapSegments(mapId: number, input: MergeSegmentsInput): Promise<MergeSegmentsResult> {
  await requireTournamentsActor();

  const fieldErrors: MergeSegmentsFieldErrors = {};
  if (!RIOT_RELAY_REGIONS.includes(input.region)) fieldErrors.region = "invalid";
  if (input.segments.length < 2 || input.segments.length > 5) fieldErrors.segments = "countOutOfRange";
  else {
    for (const segment of input.segments) {
      const start = Number(segment.startRound);
      const end = Number(segment.endRound);
      if (!MATCH_ID_RE.test(segment.matchId.trim())) {
        fieldErrors.segments = "invalidMatchId";
        break;
      }
      if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < 1 || start > end) {
        fieldErrors.segments = "invalidRoundRange";
        break;
      }
    }
  }
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  const [map] = await db.select({ id: maps.id }).from(maps).where(eq(maps.id, mapId)).limit(1);
  if (!map) return { ok: false, fieldErrors: { segments: "mapNotFound" } };

  const result = await mergeMatch(
    input.region,
    input.segments.map((s) => ({ matchId: s.matchId.trim(), startRound: Number(s.startRound), endRound: Number(s.endRound) }))
  );
  if (!result.ok) return { ok: false, error: result.error };

  await db.update(maps).set({ apiMatchId: result.data.matchInfo.matchId }).where(eq(maps.id, mapId));

  return { ok: true, apiMatchId: result.data.matchInfo.matchId };
}
