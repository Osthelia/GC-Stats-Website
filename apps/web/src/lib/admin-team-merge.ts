/**
 * GC-Stats - admin-team-merge
 *
 * Resolves the mergeable units (tournament entrants, tagged news) shown on
 * the team merge picker, feeding actions/admin-team-merge.ts.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, desc, eq } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { entrants, tournaments, newsRelations, news } from "@gc-stats/db";

export type MergeTournamentEntry = {
  entrantId: number;
  tournamentId: number;
  tournamentName: string;
  displayName: string;
  seed: number | null;
};

/** `entrants` rows this team is (or was) registered under — the merge unit for "tournament participation" (see mergeTeams' mergeTournaments). */
export async function getMergeableTeamTournaments(teamId: number): Promise<MergeTournamentEntry[]> {
  const rows = await db
    .select({
      entrantId: entrants.id,
      tournamentId: tournaments.id,
      tournamentName: tournaments.name,
      displayName: entrants.displayName,
      seed: entrants.seed,
    })
    .from(entrants)
    .innerJoin(tournaments, eq(tournaments.id, entrants.tournamentId))
    .where(and(eq(entrants.kind, "team"), eq(entrants.teamId, teamId)))
    .orderBy(desc(entrants.id));

  return rows;
}

export type MergeNewsEntry = { newsId: number; title: string };

/** `news_relations` rows tagging this team — merge unit keyed by `newsId` (mirrors V1's TeamMergeService::mergeNews, which moves by news id, not the pivot row id). */
export async function getMergeableTeamNews(teamId: number): Promise<MergeNewsEntry[]> {
  const rows = await db
    .select({ newsId: news.id, title: news.title })
    .from(newsRelations)
    .innerJoin(news, eq(news.id, newsRelations.newsId))
    .where(and(eq(newsRelations.relatableType, "team"), eq(newsRelations.relatableId, teamId)))
    .orderBy(desc(news.id));

  return rows;
}
