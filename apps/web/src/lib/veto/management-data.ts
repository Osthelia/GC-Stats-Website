/**
 * GC-Stats - veto-management-data
 *
 * Data behind the veto management panel (admin and organizer dashboard).
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { alias } from "drizzle-orm/pg-core";
import { and, asc, eq, inArray } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { entrants, matches, matchVetoSessions, stageContainers, stages, tournaments } from "@gc-stats/db";
import { ensureVetoTokens, getVetoSettings, type VetoSettings } from "./service";

export type VetoManagedTournament = { id: number; name: string; vetoEnabled: boolean };

export type VetoManagedEntrant = { id: number; displayName: string; vetoToken: string | null };

export type VetoManagedMatch = {
  id: number;
  label: string | null;
  stageName: string;
  status: "pending" | "live" | "completed";
  bestOf: number;
  scheduledAt: string | null;
  entrantAName: string | null;
  entrantBName: string | null;
  vetoStatus: string;
  matchPool: string[];
};

export type VetoManagementData = {
  tournament: VetoManagedTournament;
  settings: VetoSettings;
  entrants: VetoManagedEntrant[];
  matches: VetoManagedMatch[];
};

export async function getVetoManagementData(tournamentId: number): Promise<VetoManagementData | null> {
  const [tournament] = await db.select({ id: tournaments.id, name: tournaments.name, vetoEnabled: tournaments.vetoEnabled }).from(tournaments).where(eq(tournaments.id, tournamentId)).limit(1);
  if (!tournament) return null;
  // Teams added after the activation get their link here.
  if (tournament.vetoEnabled) await ensureVetoTokens(tournamentId);

  const entrantA = alias(entrants, "veto_entrant_a");
  const entrantB = alias(entrants, "veto_entrant_b");
  const [settings, entrantRows, matchRows] = await Promise.all([
    getVetoSettings(tournamentId),
    db
      .select({ id: entrants.id, displayName: entrants.displayName, vetoToken: entrants.vetoToken })
      .from(entrants)
      .where(and(eq(entrants.tournamentId, tournamentId), eq(entrants.kind, "team")))
      .orderBy(asc(entrants.displayName)),
    db
      .select({
        id: matches.id,
        label: matches.label,
        stageName: stages.name,
        status: matches.status,
        bestOf: matches.bestOf,
        scheduledAt: matches.scheduledAt,
        entrantAName: entrantA.displayName,
        entrantBName: entrantB.displayName,
      })
      .from(matches)
      .innerJoin(stageContainers, eq(stageContainers.id, matches.containerId))
      .innerJoin(stages, eq(stages.id, stageContainers.stageId))
      .leftJoin(entrantA, eq(entrantA.id, matches.entrantAId))
      .leftJoin(entrantB, eq(entrantB.id, matches.entrantBId))
      .where(eq(stages.tournamentId, tournamentId))
      .orderBy(asc(matches.scheduledAt), asc(matches.id)),
  ]);

  const sessions = matchRows.length > 0 ? await db.select().from(matchVetoSessions).where(inArray(matchVetoSessions.matchId, matchRows.map((m) => m.id))) : [];
  const sessionByMatch = new Map(sessions.map((s) => [s.matchId, s]));

  return {
    tournament,
    settings,
    entrants: entrantRows,
    matches: matchRows.map((m) => ({
      ...m,
      scheduledAt: m.scheduledAt?.toISOString() ?? null,
      vetoStatus: sessionByMatch.get(m.id)?.status ?? "waiting",
      matchPool: sessionByMatch.get(m.id)?.mapPool ?? [],
    })),
  };
}

/** Tournaments an organization organizes, to pick from in its dashboard. */
export async function listOrganizerVetoTournaments(organizationId: number): Promise<VetoManagedTournament[]> {
  return db
    .select({ id: tournaments.id, name: tournaments.name, vetoEnabled: tournaments.vetoEnabled })
    .from(tournaments)
    .where(and(eq(tournaments.organizerOrganizationId, organizationId), eq(tournaments.vetoEnabled, true)))
    .orderBy(asc(tournaments.startDate));
}
