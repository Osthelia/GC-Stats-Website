/**
 * GC-Stats - admin-bracket-editor-data
 *
 * Loads a full stage's bracket editor data in one shape: containers,
 * matches with their seeds, bracket edges, and the stage's entrants.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { asc, eq, inArray } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { stages, stageContainers, matches, bracketEdges, matchSeeds, entrants } from "@gc-stats/db";

export type EditorMatch = {
  id: number;
  containerId: number;
  round: number;
  displayOrder: number | null;
  label: string | null;
  bestOf: number;
  status: "pending" | "live" | "completed";
  entrantAId: number | null;
  entrantBId: number | null;
  scoreA: number | null;
  scoreB: number | null;
  winnerId: number | null;
  scheduledAt: string | null;
  seeds: { slot: "a" | "b"; sourceType: string; sourceRef: unknown }[];
};

export type EditorEdge = { fromMatchId: number; fromResult: "winner" | "loser"; toMatchId: number; toSlot: "a" | "b" };

export type EditorContainer = {
  id: number;
  name: string;
  containerType: "bracket" | "group";
  config: unknown;
  status: "pending" | "active" | "completed";
};

export type StageEditorData = {
  stageId: number;
  stageName: string;
  stageStatus: "pending" | "active" | "completed";
  tournamentId: number;
  containers: EditorContainer[];
  matches: EditorMatch[];
  edges: EditorEdge[];
  entrants: { id: number; displayName: string; seed: number | null; teamId: number | null }[];
};

export async function getStageEditorData(stageId: number): Promise<StageEditorData | null> {
  // Everything keyed off the stage id through subqueries, so it all runs in one round trip.
  const stageContainerIds = db.select({ id: stageContainers.id }).from(stageContainers).where(eq(stageContainers.stageId, stageId));
  const stageMatchIds = db.select({ id: matches.id }).from(matches).where(inArray(matches.containerId, stageContainerIds));
  const stageTournamentId = db.select({ id: stages.tournamentId }).from(stages).where(eq(stages.id, stageId));

  const [[stage], containerRows, matchRows, edgeRows, seedRows, entrantRows] = await Promise.all([
    db.select().from(stages).where(eq(stages.id, stageId)),
    db.select().from(stageContainers).where(eq(stageContainers.stageId, stageId)).orderBy(asc(stageContainers.id)),
    db.select().from(matches).where(inArray(matches.containerId, stageContainerIds)).orderBy(asc(matches.round), asc(matches.id)),
    db.select().from(bracketEdges).where(inArray(bracketEdges.fromMatchId, stageMatchIds)),
    db.select().from(matchSeeds).where(inArray(matchSeeds.matchId, stageMatchIds)),
    db
      .select({ id: entrants.id, displayName: entrants.displayName, seed: entrants.seed, teamId: entrants.teamId })
      .from(entrants)
      .where(inArray(entrants.tournamentId, stageTournamentId))
      .orderBy(asc(entrants.seed)),
  ]);
  if (!stage) return null;

  const seedsByMatch = new Map<number, EditorMatch["seeds"]>();
  for (const s of seedRows) {
    const list = seedsByMatch.get(s.matchId) ?? [];
    list.push({ slot: s.slot, sourceType: s.sourceType, sourceRef: s.sourceRef });
    seedsByMatch.set(s.matchId, list);
  }

  return {
    stageId: stage.id,
    stageName: stage.name,
    stageStatus: stage.status,
    tournamentId: stage.tournamentId,
    containers: containerRows.map((c) => ({ id: c.id, name: c.name, containerType: c.containerType, config: c.config, status: c.status })),
    matches: matchRows.map((m) => ({
      id: m.id,
      containerId: m.containerId,
      round: m.round,
      displayOrder: m.displayOrder,
      label: m.label,
      bestOf: m.bestOf,
      status: m.status,
      entrantAId: m.entrantAId,
      entrantBId: m.entrantBId,
      scoreA: m.scoreA,
      scoreB: m.scoreB,
      winnerId: m.winnerId,
      scheduledAt: m.scheduledAt ? m.scheduledAt.toISOString() : null,
      seeds: seedsByMatch.get(m.id) ?? [],
    })),
    edges: edgeRows.map((e) => ({ fromMatchId: e.fromMatchId, fromResult: e.fromResult, toMatchId: e.toMatchId, toSlot: e.toSlot })),
    entrants: entrantRows,
  };
}
