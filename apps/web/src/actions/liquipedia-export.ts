/**
 * GC-Stats - liquipedia-export
 *
 * Loads one Liquipedia wikicode on demand for the tournament export page
 * modals. The data is already public on the site, so no permission is needed.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use server";

import { getLiquipediaMatchWikicode } from "@/lib/liquipedia-match-data";
import { getTournamentParticipantsWikicode } from "@/lib/liquipedia-participants-data";
import { getTournamentInfoboxWikicode } from "@/lib/liquipedia-infobox-data";
import { getPublicTournamentHeader } from "@/lib/tournament-bracket-data";

export type LiquipediaExportResult =
  | { ok: true; wikicode: string; unlinkedTeams: string[]; unlinkedPeopleCount: number }
  | { ok: false; error: "invalid" | "notFound" };

async function visibleTournament(tournamentId: number): Promise<boolean> {
  return Number.isInteger(tournamentId) && (await getPublicTournamentHeader(tournamentId)) !== null;
}

export async function loadMatchWikicode(tournamentId: number, matchId: number): Promise<LiquipediaExportResult> {
  if (!Number.isInteger(tournamentId) || !Number.isInteger(matchId)) return { ok: false, error: "invalid" };
  if (!(await visibleTournament(tournamentId))) return { ok: false, error: "notFound" };
  const match = await getLiquipediaMatchWikicode(matchId);
  // The match must belong to the tournament whose page asked for it.
  if (!match || match.tournamentId !== tournamentId || match.tournamentIsGhost) return { ok: false, error: "notFound" };
  return { ok: true, wikicode: match.wikicode, unlinkedTeams: match.unlinkedTeams, unlinkedPeopleCount: 0 };
}

export async function loadParticipantsWikicode(tournamentId: number): Promise<LiquipediaExportResult> {
  if (!(await visibleTournament(tournamentId))) return { ok: false, error: "notFound" };
  const data = await getTournamentParticipantsWikicode(tournamentId);
  return { ok: true, wikicode: data.wikicode, unlinkedTeams: data.unlinkedTeams, unlinkedPeopleCount: data.unlinkedPeopleCount };
}

export async function loadInfoboxWikicode(tournamentId: number): Promise<LiquipediaExportResult> {
  if (!(await visibleTournament(tournamentId))) return { ok: false, error: "notFound" };
  const wikicode = await getTournamentInfoboxWikicode(tournamentId);
  return wikicode ? { ok: true, wikicode, unlinkedTeams: [], unlinkedPeopleCount: 0 } : { ok: false, error: "notFound" };
}
