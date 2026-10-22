/**
 * GC-Stats - liquipedia-participants-data
 *
 * Loads a tournament's teams, rosters and qualification sources and builds
 * its `{{TeamParticipants}}` wikicode.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { eq, inArray } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { entrants, liquipediaTeamNames, tournaments } from "@gc-stats/db";
import { getTournamentLiquipediaPeople } from "@/lib/admin-liquipedia";
import { resolveEntrantQualificationSources } from "@/lib/entrant-qualification-source";
import { liquipediaTitleFromLink } from "@/lib/liquipedia-api";
import { liquipediaFlagCode } from "@/lib/countries";
import { buildTeamParticipantsWikicode, type ParticipantQualification, type ParticipantTeam } from "@/lib/liquipedia-participants-wikicode";

export type LiquipediaParticipantsWikicode = {
  wikicode: string;
  teamCount: number;
  /** Teams written with their GC Stats name because they have no Liquipedia name yet. */
  unlinkedTeams: string[];
  /** People written with their handle because they have no Liquipedia name yet. */
  unlinkedPeopleCount: number;
};

export async function getTournamentParticipantsWikicode(tournamentId: number): Promise<LiquipediaParticipantsWikicode> {
  const entrantRows = await db
    .select({
      id: entrants.id,
      teamId: entrants.teamId,
      displayName: entrants.displayName,
      qualificationSourceManual: entrants.qualificationSourceManual,
      qualificationSourceType: entrants.qualificationSourceType,
      qualificationSourceTournamentId: entrants.qualificationSourceTournamentId,
      qualificationSourcePointTypeId: entrants.qualificationSourcePointTypeId,
    })
    .from(entrants)
    .where(eq(entrants.tournamentId, tournamentId));
  const teamEntrants = entrantRows.filter((e) => e.teamId !== null);
  if (teamEntrants.length === 0) return { wikicode: buildTeamParticipantsWikicode([]), teamCount: 0, unlinkedTeams: [], unlinkedPeopleCount: 0 };

  const teamIds = teamEntrants.map((e) => e.teamId as number);
  const [people, sources, nameRows] = await Promise.all([
    getTournamentLiquipediaPeople(tournamentId),
    resolveEntrantQualificationSources(db, tournamentId, teamEntrants),
    db.select({ teamId: liquipediaTeamNames.teamId, name: liquipediaTeamNames.name }).from(liquipediaTeamNames).where(inArray(liquipediaTeamNames.teamId, teamIds)),
  ]);

  const sourceTournamentIds = [...new Set([...sources.values()].map((s) => s.tournamentId).filter((id): id is number => id !== null))];
  const sourceTournaments = sourceTournamentIds.length
    ? await db.select({ id: tournaments.id, name: tournaments.name, liquipediaLink: tournaments.liquipediaLink }).from(tournaments).where(inArray(tournaments.id, sourceTournamentIds))
    : [];
  const sourceTournamentById = new Map(sourceTournaments.map((t) => [t.id, t]));
  const nameByTeam = new Map(nameRows.map((r) => [r.teamId, r.name]));

  const unlinkedTeams: string[] = [];
  const teams: ParticipantTeam[] = teamEntrants.map((entrant) => {
    const linkedName = nameByTeam.get(entrant.teamId as number);
    if (!linkedName) unlinkedTeams.push(entrant.displayName);

    const source = sources.get(entrant.id);
    let qualification: ParticipantQualification | null = null;
    if (source?.type === "invite") qualification = { method: "invite" };
    else if (source?.type === "tournament" && source.tournamentId !== null) {
      const origin = sourceTournamentById.get(source.tournamentId);
      qualification = {
        method: "qual",
        page: origin?.liquipediaLink ? liquipediaTitleFromLink(origin.liquipediaLink).replaceAll(" ", "_") : null,
        text: origin?.name ?? source.tournamentName,
      };
    }

    return {
      name: linkedName ?? entrant.displayName,
      qualification,
      people: people
        .filter((p) => p.entrantId === entrant.id)
        .map((p) => ({
          handle: p.handle,
          liquipediaName: p.liquipediaName,
          flag: liquipediaFlagCode(p.countryCode),
          hasPage: Boolean(p.liquipediaLink),
          kind: p.kind,
          role: p.role,
        })),
    };
  });

  // Invites first, then the qualified teams, each group alphabetical.
  const rank = (team: ParticipantTeam) => (team.qualification?.method === "invite" ? 0 : team.qualification ? 1 : 2);
  teams.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));

  return {
    wikicode: buildTeamParticipantsWikicode(teams),
    teamCount: teams.length,
    unlinkedTeams,
    unlinkedPeopleCount: people.filter((p) => p.entrantId !== null && !p.liquipediaName).length,
  };
}
