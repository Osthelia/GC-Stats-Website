/**
 * GC-Stats - entrant-tournaments
 *
 * Shared builder for the API v2 "tournament played" entries (player, team
 * and staff history): tournament, logos, entrant, final placement and W/L.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, eq, inArray, isNotNull, or } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { matches, qualificationResults, stageQualifications, teams, tournaments } from "@gc-stats/db";
import { toApiTeamFromJoined, type ApiTeam } from "../../v1/entities";
import { getThemedLogoUrlsBatch, type ApiThemedLogoUrls } from "../../v1/logo-response";
import { toApiTournamentV2, type ApiTournamentV2 } from "../entities";

export type ApiTournamentEntry = {
  tournament: ApiTournamentV2;
  logos: ApiThemedLogoUrls;
  team: ApiTeam | null;
  entrant_name: string;
  placement: number | null;
  placement_label: string | null;
  wins: number;
  losses: number;
};

export type EntrantTournamentRow = {
  entrantId: number;
  entrantName: string;
  tournament: typeof tournaments.$inferSelect;
  team: typeof teams.$inferSelect | null;
};

export type WinLoss = { wins: number; losses: number };

/** Entrant W/L on decided matches (`winner_id` set), every match of the entrant counted. */
export async function getEntrantRecords(entrantIds: number[]): Promise<Map<number, WinLoss>> {
  const record = new Map<number, WinLoss>();
  if (entrantIds.length === 0) return record;

  const rows = await db
    .select({ entrantAId: matches.entrantAId, entrantBId: matches.entrantBId, winnerId: matches.winnerId })
    .from(matches)
    .where(and(isNotNull(matches.winnerId), or(inArray(matches.entrantAId, entrantIds), inArray(matches.entrantBId, entrantIds))));

  const wanted = new Set(entrantIds);
  for (const m of rows) {
    for (const entrantId of [m.entrantAId, m.entrantBId]) {
      if (entrantId == null || !wanted.has(entrantId)) continue;
      const r = record.get(entrantId) ?? { wins: 0, losses: 0 };
      if (m.winnerId === entrantId) r.wins++;
      else r.losses++;
      record.set(entrantId, r);
    }
  }
  return record;
}

/** Best final placement per entrant (`destination_type = 'placement'`). */
async function getBestPlacements(entrantIds: number[]): Promise<Map<number, { placement: number; label: string | null }>> {
  const map = new Map<number, { placement: number; label: string | null }>();
  if (entrantIds.length === 0) return map;

  const rows = await db
    .select({ entrantId: qualificationResults.entrantId, placement: stageQualifications.placement, placementLabel: stageQualifications.placementLabel })
    .from(qualificationResults)
    .innerJoin(stageQualifications, eq(stageQualifications.id, qualificationResults.qualificationId))
    .where(and(inArray(qualificationResults.entrantId, entrantIds), eq(stageQualifications.destinationType, "placement"), isNotNull(stageQualifications.placement)));

  for (const p of rows) {
    if (p.placement == null) continue;
    const current = map.get(p.entrantId);
    if (!current || p.placement < current.placement) map.set(p.entrantId, { placement: p.placement, label: p.placementLabel });
  }
  return map;
}

/** Builds the entries in `rows` order. `records` defaults to the entrant's full W/L (`getEntrantRecords`). */
export async function buildTournamentEntries(rows: EntrantTournamentRow[], records?: Map<number, WinLoss>): Promise<ApiTournamentEntry[]> {
  if (rows.length === 0) return [];
  const entrantIds = rows.map((r) => r.entrantId);

  const [recordByEntrant, placementByEntrant, logosByTournamentId] = await Promise.all([
    records ?? getEntrantRecords(entrantIds),
    getBestPlacements(entrantIds),
    getThemedLogoUrlsBatch("tournament", [...new Set(rows.map((r) => r.tournament.id))]),
  ]);

  return rows.map((r) => {
    const placement = placementByEntrant.get(r.entrantId);
    const wl = recordByEntrant.get(r.entrantId) ?? { wins: 0, losses: 0 };
    return {
      tournament: toApiTournamentV2(r.tournament),
      logos: logosByTournamentId.get(r.tournament.id) ?? { dark: null, light: null },
      team: toApiTeamFromJoined(r.team),
      entrant_name: r.entrantName,
      placement: placement?.placement ?? null,
      placement_label: placement?.label ?? null,
      wins: wl.wins,
      losses: wl.losses,
    };
  });
}
