/**
 * GC-Stats - veto-team-view
 *
 * What a team sees behind its veto link: the match being vetoed (the next
 * unfinished one unless another is asked for), its state, and the previous
 * and next matches of the team to browse.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { getMatchHeader, type MatchSide } from "@/lib/match-page-data";
import { getTeamContext, getVetoState, listTeamMatches, type VetoPublicState } from "./service";

export type VetoSideDisplay = Pick<MatchSide, "displayName" | "shortName" | "logoUrl" | "logoUrlLight">;

export type VetoMatchHeader = {
  tournamentName: string;
  label: string | null;
  scheduledAt: string | null;
  a: VetoSideDisplay;
  b: VetoSideDisplay;
};

export type TeamVetoView = {
  serverNow: string;
  tournamentName: string;
  viewerEntrantId: number;
  matchId: number | null;
  state: VetoPublicState | null;
  header: VetoMatchHeader | null;
  matches: { id: number; opponentName: string; status: "pending" | "live" | "completed"; scheduledAt: string | null }[];
  /** Neighbours of the shown match in chronological order. */
  prevMatchId: number | null;
  nextMatchId: number | null;
};

export async function getVetoMatchHeader(matchId: number): Promise<VetoMatchHeader | null> {
  const header = await getMatchHeader(matchId);
  if (!header) return null;
  const side = (s: MatchSide): VetoSideDisplay => ({ displayName: s.displayName, shortName: s.shortName, logoUrl: s.logoUrl, logoUrlLight: s.logoUrlLight });
  return { tournamentName: header.tournamentName, label: header.label, scheduledAt: header.scheduledAt?.toISOString() ?? null, a: side(header.a), b: side(header.b) };
}

export async function getTeamVetoView(token: string, requestedMatchId: number | null): Promise<TeamVetoView | null> {
  const context = await getTeamContext(token);
  if (!context) return null;

  const list = await listTeamMatches(context.entrantId);
  const chrono = [...list].sort((a, b) => (a.scheduledAt?.getTime() ?? Number.MAX_SAFE_INTEGER) - (b.scheduledAt?.getTime() ?? Number.MAX_SAFE_INTEGER) || a.id - b.id);
  // Default is the first unfinished match, or the last one when all are finished.
  const current = chrono.find((m) => m.id === requestedMatchId) ?? chrono.find((m) => m.status !== "completed") ?? chrono[chrono.length - 1] ?? null;
  const currentIndex = current ? chrono.indexOf(current) : -1;
  const prev = currentIndex > 0 ? chrono[currentIndex - 1] : null;
  const next = currentIndex >= 0 ? (chrono[currentIndex + 1] ?? null) : null;

  const [state, header] = current ? await Promise.all([getVetoState(current.id), getVetoMatchHeader(current.id)]) : [null, null];
  return {
    serverNow: new Date().toISOString(),
    tournamentName: context.tournamentName,
    viewerEntrantId: context.entrantId,
    matchId: current?.id ?? null,
    state,
    header,
    matches: chrono.map((m) => ({ id: m.id, opponentName: m.opponentName, status: m.status, scheduledAt: m.scheduledAt?.toISOString() ?? null })),
    prevMatchId: prev?.id ?? null,
    nextMatchId: next?.id ?? null,
  };
}
