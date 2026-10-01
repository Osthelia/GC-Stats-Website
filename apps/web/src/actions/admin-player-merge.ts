/**
 * GC-Stats - admin-player-merge
 *
 * Admin server actions for merging duplicate player records: search for a
 * merge target, then selectively move history/stats/logos/account link
 * from the source person into it.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use server";

import { and, eq, inArray, notInArray, sql } from "drizzle-orm";
import { updateTag } from "next/cache";
import { adminDb as db } from "@gc-stats/db/client";
import {
  people,
  rosterMemberships,
  organizationMemberships,
  productionCredits,
  newsRelations,
  logos,
  mapPlayerStats,
  mapRoundsRaw,
  mapRoundKillsRaw,
  mapRoundDamagesRaw,
  mapRoundPlayerLoadoutsRaw,
  mapRoundPlayerPositionsRaw,
  entrantMembers,
  activityLog,
  PERMISSIONS,
} from "@gc-stats/db";
import { requireActorPermission } from "@/lib/rbac";
import { MATCH_STATS_TAG } from "@/lib/cache-tags";
import { rangeLower, rangeIsOpen, closeRange } from "@/lib/daterange";
import { searchPeopleQuery, type PersonPickerResult } from "@/lib/person-search";

export type { PersonPickerResult } from "@/lib/person-search";

/** Typo-tolerant player search backing the player merge target picker — excludes the source player itself from results. */
export async function searchPlayerMergeTargets(sourcePersonId: number, query: string): Promise<PersonPickerResult[]> {
  await requireActorPermission(PERMISSIONS.playersMerge);
  return searchPeopleQuery(query, sourcePersonId, undefined, "include");
}

export type PlayerMergeSelection = {
  teamHistory: number[];
  organizations: number[];
  productionCredits: number[];
  news: number[];
  logos: string[];
  matchStats: number[];
  linkedAccount: boolean;
};

export type MergePlayersResult = { ok: true } | { ok: false; error: "samePlayer" | "sourceNotFound" | "targetNotFound" | "targetAlreadyLinked" };

/**
 * Merges specific items of $source's data into $target — player-side mirror
 * of admin-team-merge.ts::mergeTeams (see its docblock for the general
 * shape). $target's own profile fields are left untouched, $source itself
 * is never deleted here.
 */
export async function mergePlayers(sourcePersonId: number, targetPersonId: number, selection: PlayerMergeSelection): Promise<MergePlayersResult> {
  const access = await requireActorPermission(PERMISSIONS.playersMerge);

  if (sourcePersonId === targetPersonId) return { ok: false, error: "samePlayer" };

  const [source] = await db.select({ id: people.id, handle: people.handle, userId: people.userId }).from(people).where(eq(people.id, sourcePersonId)).limit(1);
  if (!source) return { ok: false, error: "sourceNotFound" };
  const [target] = await db.select({ id: people.id, handle: people.handle, userId: people.userId }).from(people).where(eq(people.id, targetPersonId)).limit(1);
  if (!target) return { ok: false, error: "targetNotFound" };

  // Checked up front (not silently skipped mid-transaction like the other categories' dedupe) — the
  // admin explicitly asked to move this one item, so a conflict here is worth a clear rejection.
  if (selection.linkedAccount && source.userId && target.userId) return { ok: false, error: "targetAlreadyLinked" };

  const counts = { teamHistory: 0, organizations: 0, productionCredits: 0, news: 0, logos: 0, matchStats: 0, linkedAccount: false };

  await db.transaction(async (tx) => {
    if (selection.teamHistory.length) {
      const entries = await tx
        .select({ id: rosterMemberships.id, role: rosterMemberships.role, period: rosterMemberships.period })
        .from(rosterMemberships)
        .where(and(eq(rosterMemberships.personId, sourcePersonId), inArray(rosterMemberships.id, selection.teamHistory)));

      for (const entry of entries) {
        if (rangeIsOpen(entry.period)) {
          const openElsewhere = await tx
            .select({ id: rosterMemberships.id, period: rosterMemberships.period })
            .from(rosterMemberships)
            .where(and(eq(rosterMemberships.personId, targetPersonId), eq(rosterMemberships.role, entry.role), sql`${rosterMemberships.period} @> CURRENT_DATE`));
          const from = rangeLower(entry.period) ?? "";
          for (const row of openElsewhere) {
            await tx.update(rosterMemberships).set({ period: closeRange(row.period, from) }).where(eq(rosterMemberships.id, row.id));
          }
        }

        await tx.update(rosterMemberships).set({ personId: targetPersonId }).where(eq(rosterMemberships.id, entry.id));
        counts.teamHistory++;
      }
    }

    if (selection.organizations.length) {
      const entries = await tx
        .select({ id: organizationMemberships.id, organizationId: organizationMemberships.organizationId, role: organizationMemberships.role, period: organizationMemberships.period })
        .from(organizationMemberships)
        .where(and(eq(organizationMemberships.personId, sourcePersonId), inArray(organizationMemberships.id, selection.organizations)));

      for (const entry of entries) {
        const [conflict] = await tx
          .select({ id: organizationMemberships.id })
          .from(organizationMemberships)
          .where(
            and(
              eq(organizationMemberships.personId, targetPersonId),
              eq(organizationMemberships.organizationId, entry.organizationId),
              eq(organizationMemberships.role, entry.role),
              sql`${organizationMemberships.period} && ${entry.period}::daterange`
            )
          )
          .limit(1);
        // Overlapping (org, role, period) already held by $target — skip rather than violate the
        // EXCLUDE constraint, leaving this credit on $source for manual resolution.
        if (conflict) continue;

        await tx.update(organizationMemberships).set({ personId: targetPersonId }).where(eq(organizationMemberships.id, entry.id));
        counts.organizations++;
      }
    }

    if (selection.productionCredits.length) {
      const result = await tx
        .update(productionCredits)
        .set({ personId: targetPersonId })
        .where(and(eq(productionCredits.personId, sourcePersonId), inArray(productionCredits.id, selection.productionCredits)))
        .returning({ id: productionCredits.id });
      counts.productionCredits = result.length;
    }

    if (selection.news.length) {
      const targetNewsIds = await tx
        .select({ newsId: newsRelations.newsId })
        .from(newsRelations)
        .where(and(eq(newsRelations.relatableType, "person"), eq(newsRelations.relatableId, targetPersonId), inArray(newsRelations.newsId, selection.news)));
      const targetNewsIdList = targetNewsIds.map((r) => r.newsId);

      if (targetNewsIdList.length) {
        await tx
          .delete(newsRelations)
          .where(and(eq(newsRelations.relatableType, "person"), eq(newsRelations.relatableId, sourcePersonId), inArray(newsRelations.newsId, targetNewsIdList)));
      }

      const movable = targetNewsIdList.length ? notInArray(newsRelations.newsId, targetNewsIdList) : undefined;
      const result = await tx
        .update(newsRelations)
        .set({ relatableId: targetPersonId })
        .where(
          movable
            ? and(eq(newsRelations.relatableType, "person"), eq(newsRelations.relatableId, sourcePersonId), inArray(newsRelations.newsId, selection.news), movable)
            : and(eq(newsRelations.relatableType, "person"), eq(newsRelations.relatableId, sourcePersonId), inArray(newsRelations.newsId, selection.news))
        )
        .returning({ id: newsRelations.id });
      counts.news = result.length;
    }

    if (selection.logos.length) {
      const result = await tx
        .update(logos)
        .set({ entityId: targetPersonId })
        .where(and(eq(logos.entityType, "person"), eq(logos.entityId, sourcePersonId), inArray(logos.id, selection.logos)))
        .returning({ id: logos.id });
      counts.logos = result.length;
    }

    if (selection.matchStats.length) {
      const rows = await tx
        .select({ id: mapPlayerStats.id, mapId: mapPlayerStats.mapId, entrantId: mapPlayerStats.entrantId })
        .from(mapPlayerStats)
        .where(and(eq(mapPlayerStats.personId, sourcePersonId), inArray(mapPlayerStats.id, selection.matchStats)));

      const entrantIds = [...new Set(rows.map((r) => r.entrantId))];
      // The locked roster credit (entrant_members) only follows the merge once every map stat this
      // person has under that entrant is moved — a partial selection would otherwise credit $target
      // with the whole entrant while most of the individual map stats stay on $source.
      const entrantTotals = new Map<number, number>();
      if (entrantIds.length) {
        const totals = await tx
          .select({ entrantId: mapPlayerStats.entrantId, count: sql<number>`count(*)::int` })
          .from(mapPlayerStats)
          .where(and(eq(mapPlayerStats.personId, sourcePersonId), inArray(mapPlayerStats.entrantId, entrantIds)))
          .groupBy(mapPlayerStats.entrantId);
        for (const t of totals) entrantTotals.set(t.entrantId, t.count);
      }
      const entrantMovedCounts = new Map<number, number>();

      for (const row of rows) {
        const [conflict] = await tx
          .select({ id: mapPlayerStats.id })
          .from(mapPlayerStats)
          .where(and(eq(mapPlayerStats.personId, targetPersonId), eq(mapPlayerStats.mapId, row.mapId)))
          .limit(1);
        // $target already has stats recorded for this exact map — skip (leaves it on $source), same
        // per-map dedupe spirit as V1's PlayerMergeService::mergeStats (there, per map+agent).
        if (conflict) continue;

        await tx.update(mapPlayerStats).set({ personId: targetPersonId }).where(eq(mapPlayerStats.id, row.id));
        counts.matchStats++;

        const roundRows = await tx.select({ id: mapRoundsRaw.id }).from(mapRoundsRaw).where(eq(mapRoundsRaw.mapId, row.mapId));
        const roundIds = roundRows.map((r) => r.id);

        if (roundIds.length) {
          await tx
            .update(mapRoundPlayerLoadoutsRaw)
            .set({ personId: targetPersonId })
            .where(and(eq(mapRoundPlayerLoadoutsRaw.personId, sourcePersonId), inArray(mapRoundPlayerLoadoutsRaw.mapRoundId, roundIds)));

          await tx
            .update(mapRoundKillsRaw)
            .set({ killerPersonId: targetPersonId })
            .where(and(eq(mapRoundKillsRaw.killerPersonId, sourcePersonId), inArray(mapRoundKillsRaw.mapRoundId, roundIds)));
          await tx
            .update(mapRoundKillsRaw)
            .set({ victimPersonId: targetPersonId })
            .where(and(eq(mapRoundKillsRaw.victimPersonId, sourcePersonId), inArray(mapRoundKillsRaw.mapRoundId, roundIds)));

          const assistRows = await tx
            .select({ id: mapRoundKillsRaw.id, assistantPersonIds: mapRoundKillsRaw.assistantPersonIds })
            .from(mapRoundKillsRaw)
            .where(and(inArray(mapRoundKillsRaw.mapRoundId, roundIds), sql`${sourcePersonId} = ANY(${mapRoundKillsRaw.assistantPersonIds})`));
          for (const assistRow of assistRows) {
            const updated = [...new Set((assistRow.assistantPersonIds ?? []).map((id) => (id === sourcePersonId ? targetPersonId : id)))];
            await tx.update(mapRoundKillsRaw).set({ assistantPersonIds: updated }).where(eq(mapRoundKillsRaw.id, assistRow.id));
          }

          await tx
            .update(mapRoundDamagesRaw)
            .set({ attackerPersonId: targetPersonId })
            .where(and(eq(mapRoundDamagesRaw.attackerPersonId, sourcePersonId), inArray(mapRoundDamagesRaw.mapRoundId, roundIds)));
          await tx
            .update(mapRoundDamagesRaw)
            .set({ receiverPersonId: targetPersonId })
            .where(and(eq(mapRoundDamagesRaw.receiverPersonId, sourcePersonId), inArray(mapRoundDamagesRaw.mapRoundId, roundIds)));
        }

        await tx
          .update(mapRoundPlayerPositionsRaw)
          .set({ personId: targetPersonId })
          .where(and(eq(mapRoundPlayerPositionsRaw.personId, sourcePersonId), eq(mapRoundPlayerPositionsRaw.mapId, row.mapId)));

        entrantMovedCounts.set(row.entrantId, (entrantMovedCounts.get(row.entrantId) ?? 0) + 1);
      }

      for (const entrantId of entrantIds) {
        if (entrantMovedCounts.get(entrantId) !== entrantTotals.get(entrantId)) continue;

        const memberRows = await tx
          .select({ id: entrantMembers.id, role: entrantMembers.role })
          .from(entrantMembers)
          .where(and(eq(entrantMembers.entrantId, entrantId), eq(entrantMembers.personId, sourcePersonId)));

        for (const member of memberRows) {
          const [memberConflict] = await tx
            .select({ id: entrantMembers.id })
            .from(entrantMembers)
            .where(and(eq(entrantMembers.entrantId, entrantId), eq(entrantMembers.personId, targetPersonId), eq(entrantMembers.role, member.role)))
            .limit(1);
          // $target is already a locked-roster member of this entrant with the same role — skip
          // (the unique (entrant, person, role) constraint would reject a duplicate anyway).
          if (memberConflict) continue;

          await tx.update(entrantMembers).set({ personId: targetPersonId }).where(eq(entrantMembers.id, member.id));
        }
      }
    }

    if (selection.linkedAccount && source.userId && !target.userId) {
      // people.userId is unique, so the account has to be freed from $source before it can be set
      // on $target — doing it in the other order would collide with itself mid-transaction.
      const linkedUserId = source.userId;
      await tx.update(people).set({ userId: null }).where(eq(people.id, sourcePersonId));
      await tx.update(people).set({ userId: linkedUserId }).where(eq(people.id, targetPersonId));
      counts.linkedAccount = true;
    }

    await tx.insert(activityLog).values({
      logName: "player",
      description: `Merged player #${sourcePersonId} (${source.handle}) into #${targetPersonId} (${target.handle})`,
      subjectType: "person",
      subjectId: String(targetPersonId),
      event: "player.merged",
      properties: { actorUserId: access.userId, sourceId: sourcePersonId, targetId: targetPersonId, sourceHandle: source.handle, targetHandle: target.handle, counts },
    });
  });
  if (counts.matchStats > 0) updateTag(MATCH_STATS_TAG);

  return { ok: true };
}
