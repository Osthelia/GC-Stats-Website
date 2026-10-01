/**
 * GC-Stats - admin-team-merge
 *
 * Admin server actions for merging duplicate teams: search for a merge
 * target, then selectively move roster/tournaments/news/logos from source
 * to target. Source team's profile is untouched and never deleted here.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use server";

import { and, eq, inArray, ne, notInArray, sql } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { teams, rosterMemberships, entrants, newsRelations, logos, activityLog, PERMISSIONS } from "@gc-stats/db";
import { requireActorPermission } from "@/lib/rbac";
import { rangeLower, rangeIsOpen, closeRange } from "@/lib/daterange";
import { searchTeamsQuery, type TeamPickerResult } from "@/lib/team-search";

export type { TeamPickerResult } from "@/lib/team-search";

/** Typo-tolerant team search backing the team merge target picker — excludes the source team itself from results. */
export async function searchTeamMergeTargets(sourceTeamId: number, query: string): Promise<TeamPickerResult[]> {
  await requireActorPermission(PERMISSIONS.teamsMerge);
  return searchTeamsQuery(query, sourceTeamId, "include");
}

export type TeamMergeSelection = {
  roster: number[];
  tournaments: number[];
  news: number[];
  logos: string[];
};

export type MergeTeamsResult = { ok: true } | { ok: false; error: "sameTeam" | "sourceNotFound" | "targetNotFound" };

/**
 * Merges specific items of $source's data into $target — mirrors V1's
 * TeamMergeService::merge(). $target's own profile fields are left
 * untouched, only the checked items move; $source itself is never deleted
 * here (deleteTeam, gated by the same FK-restrict check as always, handles
 * that separately once $source is empty enough).
 *
 * There's no standalone "matches" category: a map/match/veto/stat row never
 * references a team directly in this schema (see DATABASES.MD) — it always
 * hangs off an `entrants` row instead, so re-pointing that one row's
 * `team_id` (the "tournaments" category below) carries every match played
 * under it along for free.
 */
export async function mergeTeams(sourceTeamId: number, targetTeamId: number, selection: TeamMergeSelection): Promise<MergeTeamsResult> {
  const access = await requireActorPermission(PERMISSIONS.teamsMerge);

  if (sourceTeamId === targetTeamId) return { ok: false, error: "sameTeam" };

  const [source] = await db.select({ id: teams.id, name: teams.name }).from(teams).where(eq(teams.id, sourceTeamId)).limit(1);
  if (!source) return { ok: false, error: "sourceNotFound" };
  const [target] = await db.select({ id: teams.id, name: teams.name }).from(teams).where(eq(teams.id, targetTeamId)).limit(1);
  if (!target) return { ok: false, error: "targetNotFound" };

  const counts = { roster: 0, tournaments: 0, news: 0, logos: 0 };

  await db.transaction(async (tx) => {
    if (selection.roster.length) {
      const entries = await tx
        .select({ id: rosterMemberships.id, personId: rosterMemberships.personId, role: rosterMemberships.role, period: rosterMemberships.period })
        .from(rosterMemberships)
        .where(and(eq(rosterMemberships.teamId, sourceTeamId), inArray(rosterMemberships.id, selection.roster)));

      for (const entry of entries) {
        if (rangeIsOpen(entry.period)) {
          const openElsewhere = await tx
            .select({ id: rosterMemberships.id, period: rosterMemberships.period })
            .from(rosterMemberships)
            .where(
              and(
                eq(rosterMemberships.personId, entry.personId),
                eq(rosterMemberships.role, entry.role),
                ne(rosterMemberships.teamId, sourceTeamId),
                sql`${rosterMemberships.period} @> CURRENT_DATE`
              )
            );
          const from = rangeLower(entry.period) ?? "";
          for (const row of openElsewhere) {
            await tx.update(rosterMemberships).set({ period: closeRange(row.period, from) }).where(eq(rosterMemberships.id, row.id));
          }
        }

        await tx.update(rosterMemberships).set({ teamId: targetTeamId }).where(eq(rosterMemberships.id, entry.id));
        counts.roster++;
      }
    }

    if (selection.tournaments.length) {
      const items = await tx
        .select({ id: entrants.id, tournamentId: entrants.tournamentId })
        .from(entrants)
        .where(and(eq(entrants.kind, "team"), eq(entrants.teamId, sourceTeamId), inArray(entrants.id, selection.tournaments)));

      for (const item of items) {
        const [conflict] = await tx
          .select({ id: entrants.id })
          .from(entrants)
          .where(and(eq(entrants.kind, "team"), eq(entrants.teamId, targetTeamId), eq(entrants.tournamentId, item.tournamentId)))
          .limit(1);
        // $target already registered for this tournament — leave $source's entrant as-is rather than
        // create a second team-entrant for the same tournament (mirrors V1's tournament_teams dedupe).
        if (conflict) continue;

        await tx.update(entrants).set({ teamId: targetTeamId }).where(eq(entrants.id, item.id));
        counts.tournaments++;
      }
    }

    if (selection.news.length) {
      const targetNewsIds = await tx
        .select({ newsId: newsRelations.newsId })
        .from(newsRelations)
        .where(and(eq(newsRelations.relatableType, "team"), eq(newsRelations.relatableId, targetTeamId), inArray(newsRelations.newsId, selection.news)));
      const targetNewsIdList = targetNewsIds.map((r) => r.newsId);

      if (targetNewsIdList.length) {
        await tx
          .delete(newsRelations)
          .where(and(eq(newsRelations.relatableType, "team"), eq(newsRelations.relatableId, sourceTeamId), inArray(newsRelations.newsId, targetNewsIdList)));
      }

      const movable = targetNewsIdList.length ? notInArray(newsRelations.newsId, targetNewsIdList) : undefined;
      const result = await tx
        .update(newsRelations)
        .set({ relatableId: targetTeamId })
        .where(
          movable
            ? and(eq(newsRelations.relatableType, "team"), eq(newsRelations.relatableId, sourceTeamId), inArray(newsRelations.newsId, selection.news), movable)
            : and(eq(newsRelations.relatableType, "team"), eq(newsRelations.relatableId, sourceTeamId), inArray(newsRelations.newsId, selection.news))
        )
        .returning({ id: newsRelations.id });
      counts.news = result.length;
    }

    if (selection.logos.length) {
      const result = await tx
        .update(logos)
        .set({ entityId: targetTeamId })
        .where(and(eq(logos.entityType, "team"), eq(logos.entityId, sourceTeamId), inArray(logos.id, selection.logos)))
        .returning({ id: logos.id });
      counts.logos = result.length;
    }

    await tx.insert(activityLog).values({
      logName: "team",
      description: `Merged team #${sourceTeamId} (${source.name}) into #${targetTeamId} (${target.name})`,
      subjectType: "team",
      subjectId: String(targetTeamId),
      event: "team.merged",
      properties: { actorUserId: access.userId, sourceId: sourceTeamId, targetId: targetTeamId, sourceName: source.name, targetName: target.name, counts },
    });
  });

  return { ok: true };
}
