/**
 * GC-Stats - dashboard-vods-data
 *
 * Query helpers for an organization's vods, joined with match and
 * tournament info for the dashboard listing.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { desc, eq, inArray } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { gameTables } from "@gc-stats/db";
import { normalizeScheduledAt } from "@/lib/match-schedule";
import { listMapRefs, mapLabel, selectSeriesMaps } from "@/lib/series-map-refs";
import type { GameSlug } from "@gc-stats/db/game";

export type OrganizationVodRow = {
  id: number;
  url: string;
  languageCode: string;
  matchId: number;
  matchLabel: string;
  tournamentName: string;
  mapId: number | null;
  mapLabel: string | null;
  scheduledAt: string | null;
};

export async function listOrganizationVodRows(game: GameSlug, organizationId: number): Promise<OrganizationVodRow[]> {
  const { vods, matches, entrants, stageContainers, stages, tournaments } = gameTables(game);
  const rows = await db
    .select({
      id: vods.id,
      url: vods.url,
      languageCode: vods.languageCode,
      matchId: vods.matchId,
      mapId: vods.mapId,
      round: matches.round,
      entrantAId: matches.entrantAId,
      entrantBId: matches.entrantBId,
      tournamentName: tournaments.name,
      scheduledAt: matches.scheduledAt,
    })
    .from(vods)
    .innerJoin(matches, eq(matches.id, vods.matchId))
    .innerJoin(stageContainers, eq(stageContainers.id, matches.containerId))
    .innerJoin(stages, eq(stages.id, stageContainers.stageId))
    .innerJoin(tournaments, eq(tournaments.id, stages.tournamentId))
    .where(eq(vods.organizationId, organizationId))
    .orderBy(desc(vods.id));

  if (rows.length === 0) return [];

  const entrantIds = [...new Set(rows.flatMap((r) => [r.entrantAId, r.entrantBId]).filter((id): id is number => id !== null))];
  const entrantRows = entrantIds.length ? await db.select({ id: entrants.id, displayName: entrants.displayName }).from(entrants).where(inArray(entrants.id, entrantIds)) : [];
  const entrantById = new Map(entrantRows.map((e) => [e.id, e.displayName]));

  const mapIds = rows.map((r) => r.mapId).filter((id): id is number => id !== null);
  const mapLabelById = new Map((await listMapRefs(db, game, mapIds)).map((m) => [m.id, m.label]));

  return rows.map((r) => {
    const aName = r.entrantAId !== null ? (entrantById.get(r.entrantAId) ?? "TBD") : "TBD";
    const bName = r.entrantBId !== null ? (entrantById.get(r.entrantBId) ?? "TBD") : "TBD";
    return {
      id: r.id,
      url: r.url,
      // `language_code` is a fixed-width `char(5)` column, Postgres pads it
      // on read (e.g. "fr" -> "fr   ") — see the same trim in dashboard-streams-data.ts.
      languageCode: r.languageCode.trim(),
      matchId: r.matchId,
      matchLabel: `${aName} vs ${bName} (R${r.round})`,
      tournamentName: r.tournamentName,
      mapId: r.mapId,
      mapLabel: r.mapId !== null ? (mapLabelById.get(r.mapId) ?? null) : null,
      scheduledAt: normalizeScheduledAt(r.scheduledAt),
    };
  });
}

export type MatchMapOption = { id: number; label: string };

/** Backs the "specific map" <Select> once a match is picked: its maps (Valorant) or games (LoL). */
export async function getMatchMapOptions(game: GameSlug, matchId: number): Promise<MatchMapOption[]> {
  const rows = await selectSeriesMaps(db, game, (t) => eq(t.matchId, matchId));
  return rows.map((m) => ({ id: m.id, label: mapLabel(game, m.mapName, m.order) }));
}
