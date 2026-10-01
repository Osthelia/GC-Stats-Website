/**
 * GC-Stats - detect-player-pov-streams
 *
 * Scheduled job: for matches approaching or live, checks Twitch for
 * entrants' channels and records a player POV stream whenever one is live
 * with the tournament's configured player_pov_phrase in its title.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, eq, gte, inArray, isNotNull, lte, or } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { matches, entrants, entrantMembers, stageContainers, stages, tournaments, teams, people, matchPlayerPovs } from "@gc-stats/db";
import { getLiveStreams, type LiveStream } from "@/lib/twitch-client";

/** Start checking this long before the scheduled kickoff. */
const PRE_MATCH_WINDOW_MINUTES = 20;
/** Safety net: stop checking a still-`pending` match this stale — covers stuck/bad data, not a real delay. */
const MAX_PENDING_AGE_HOURS = 6;

type Candidate = { login: string; entrantId: number; personId: number | null };

/**
 * For every match approaching or currently live, checks Twitch for the
 * relevant entrants' channels and records a match_player_povs row for any
 * channel found live with a title containing the tournament's
 * player_pov_phrase (case-insensitive).
 *
 * Simplified from V1's matches:detect-player-povs: candidates are the
 * roster locked for this match (entrant_members), not a mix of the team's
 * current roster and whoever played its last 5 matches — V2 has no
 * populated per-player game stats yet to mine that from (cf. SUIVI.md,
 * "Fetch map" not built), and entrant_members is already the source of
 * truth for "who played for this entrant in this tournament".
 */
export async function detectPlayerPovStreams(): Promise<string> {
  const now = new Date();
  const preMatchCutoff = new Date(now.getTime() + PRE_MATCH_WINDOW_MINUTES * 60 * 1000);
  const stalePendingCutoff = new Date(now.getTime() - MAX_PENDING_AGE_HOURS * 60 * 60 * 1000);

  const eligibleMatches = await db
    .select({
      id: matches.id,
      containerId: matches.containerId,
      entrantAId: matches.entrantAId,
      entrantBId: matches.entrantBId,
    })
    .from(matches)
    .where(
      or(
        eq(matches.status, "live"),
        and(
          eq(matches.status, "pending"),
          isNotNull(matches.entrantAId),
          isNotNull(matches.entrantBId),
          isNotNull(matches.scheduledAt),
          lte(matches.scheduledAt, preMatchCutoff),
          gte(matches.scheduledAt, stalePendingCutoff)
        )
      )
    );

  if (eligibleMatches.length === 0) return "no match to check";

  const containerIds = [...new Set(eligibleMatches.map((m) => m.containerId))];
  const tournamentByContainer = await getTournamentsByContainer(containerIds);

  const checkableMatches = eligibleMatches
    .map((match) => ({ match, tournament: tournamentByContainer.get(match.containerId) }))
    .filter((m): m is { match: (typeof eligibleMatches)[number]; tournament: NonNullable<ReturnType<typeof tournamentByContainer.get>> } => !!m.tournament?.active && !!m.tournament.playerPovPhrase);

  if (checkableMatches.length === 0) return "checked 0 match(es), recorded/updated 0 POV stream(s)";

  const entrantIds = [...new Set(checkableMatches.flatMap((m) => [m.match.entrantAId, m.match.entrantBId]).filter((id): id is number => id !== null))];
  const candidatesByEntrant = await candidatesForEntrants(entrantIds);
  const allLogins = [...new Set([...candidatesByEntrant.values()].flat().map((c) => c.login))];
  const liveStreams = allLogins.length ? await getLiveStreams(allLogins) : new Map<string, LiveStream>();

  let recorded = 0;

  for (const { match, tournament } of checkableMatches) {
    const candidates = [match.entrantAId, match.entrantBId].filter((id): id is number => id !== null).flatMap((id) => candidatesByEntrant.get(id) ?? []);
    recorded += await recordLiveCandidates(match.id, candidates, liveStreams, tournament.playerPovPhrase as string);
  }

  return `checked ${checkableMatches.length} match(es), recorded/updated ${recorded} POV stream(s)`;
}

async function getTournamentsByContainer(containerIds: number[]) {
  const rows = await db
    .select({ containerId: stageContainers.id, active: tournaments.active, playerPovPhrase: tournaments.playerPovPhrase })
    .from(stageContainers)
    .innerJoin(stages, eq(stages.id, stageContainers.stageId))
    .innerJoin(tournaments, eq(tournaments.id, stages.tournamentId))
    .where(inArray(stageContainers.id, containerIds));

  return new Map(rows.map((r) => [r.containerId, r]));
}

async function recordLiveCandidates(matchId: number, candidates: Candidate[], liveStreams: Map<string, LiveStream>, phrase: string): Promise<number> {
  if (candidates.length === 0 || liveStreams.size === 0) return 0;

  const lowerPhrase = phrase.toLowerCase();
  let recorded = 0;

  for (const candidate of candidates) {
    const stream = liveStreams.get(candidate.login);
    if (!stream || !stream.title.toLowerCase().includes(lowerPhrase)) continue;

    await db
      .insert(matchPlayerPovs)
      .values({
        matchId,
        entrantId: candidate.entrantId,
        personId: candidate.personId,
        twitchLogin: candidate.login,
        title: stream.title,
        url: stream.url,
        lastSeenLiveAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [matchPlayerPovs.matchId, matchPlayerPovs.twitchLogin],
        set: { title: stream.title, url: stream.url, lastSeenLiveAt: new Date() },
      });

    recorded++;
  }

  return recorded;
}

/** Batches Twitch login lookup across every entrant of every checkable match in this tick, keyed by entrant id. */
async function candidatesForEntrants(entrantIds: number[]): Promise<Map<number, Candidate[]>> {
  const candidatesByEntrant = new Map<number, Candidate[]>();
  const seenLoginByEntrant = new Map<number, Set<string>>();
  const push = (entrantId: number, candidate: Candidate) => {
    const seen = seenLoginByEntrant.get(entrantId) ?? new Set<string>();
    if (seen.has(candidate.login)) return;
    seen.add(candidate.login);
    seenLoginByEntrant.set(entrantId, seen);
    candidatesByEntrant.set(entrantId, [...(candidatesByEntrant.get(entrantId) ?? []), candidate]);
  };

  if (entrantIds.length === 0) return candidatesByEntrant;

  const entrantRows = await db.select({ id: entrants.id, teamId: entrants.teamId }).from(entrants).where(inArray(entrants.id, entrantIds));
  const teamIds = entrantRows.map((e) => e.teamId).filter((id): id is number => id !== null);

  if (teamIds.length > 0) {
    const teamRows = await db.select({ id: teams.id, socials: teams.socials }).from(teams).where(inArray(teams.id, teamIds));
    const entrantByTeamId = new Map(entrantRows.filter((e) => e.teamId !== null).map((e) => [e.teamId as number, e.id]));
    for (const team of teamRows) {
      const login = (team.socials as Record<string, string>)?.twitch;
      const entrantId = entrantByTeamId.get(team.id);
      if (login && entrantId) push(entrantId, { login: login.toLowerCase(), entrantId, personId: null });
    }
  }

  const memberRows = await db
    .select({ entrantId: entrantMembers.entrantId, personId: entrantMembers.personId })
    .from(entrantMembers)
    .where(and(inArray(entrantMembers.entrantId, entrantIds), inArray(entrantMembers.role, ["player", "stand_in"])));

  const personIds = [...new Set(memberRows.map((m) => m.personId))];
  if (personIds.length > 0) {
    const personRows = await db.select({ id: people.id, socials: people.socials }).from(people).where(inArray(people.id, personIds));
    const socialsByPersonId = new Map(personRows.map((p) => [p.id, (p.socials as Record<string, string>)?.twitch]));

    for (const member of memberRows) {
      const login = socialsByPersonId.get(member.personId);
      if (login) push(member.entrantId, { login: login.toLowerCase(), entrantId: member.entrantId, personId: member.personId });
    }
  }

  return candidatesByEntrant;
}
