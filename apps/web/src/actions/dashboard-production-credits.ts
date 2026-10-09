/**
 * GC-Stats - dashboard-production-credits
 *
 * Dashboard server actions for an organization to credit staff
 * (casters/production) on tournament matches, gated by staffManage.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use server";

import { and, eq, inArray } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { productionCredits, people, tournaments, matches, maps, ORGANIZATION_PERMISSIONS } from "@gc-stats/db";
import { requireDashboardOrgActorPermission } from "@/lib/dashboard-rbac";
import { logActivity, diffChanges } from "@/lib/activity-log";
import { isPersonOrganizationMember } from "@/lib/organization-membership-service";
import { searchTournamentsQuery, type TournamentPickerResult } from "@/lib/tournament-search";
import { getTournamentMatchOptionsForCredit, type CreditMatchOption } from "@/lib/production-credits-data";
import { getMatchMapOptions, type MatchMapOption } from "@/lib/dashboard-vods-data";
import { validateProductionCreditInput, validateRoleAndTitle, type ProductionCreditInput, type ProductionCreditFieldErrors, type ProductionCreditScope } from "@/lib/production-credit-validation";

export type { ProductionCreditInput, ProductionCreditField, ProductionCreditFieldErrors, ProductionCreditScope, ProductionCreditTarget } from "@/lib/production-credit-validation";
export type { CreditMatchOption } from "@/lib/production-credits-data";

/** Same search as admin's tournament picker (lib/tournament-search.ts), gated by this organization's staffManage permission instead of admin.access. */
export async function searchTournamentsForCredit(organizationId: number, query: string): Promise<TournamentPickerResult[]> {
  await requireDashboardOrgActorPermission(organizationId, ORGANIZATION_PERMISSIONS.staffManage);
  return searchTournamentsQuery(query);
}

export async function getMatchOptionsForCredit(organizationId: number, tournamentId: number): Promise<CreditMatchOption[]> {
  await requireDashboardOrgActorPermission(organizationId, ORGANIZATION_PERMISSIONS.staffManage);
  return getTournamentMatchOptionsForCredit(tournamentId);
}

export async function getMapOptionsForCredit(organizationId: number, matchId: number): Promise<MatchMapOption[]> {
  await requireDashboardOrgActorPermission(organizationId, ORGANIZATION_PERMISSIONS.staffManage);
  return getMatchMapOptions(matchId);
}

export type { MatchMapOption };

export type ProductionCreditResult = { ok: true; created: number; skipped: number } | { ok: false; fieldErrors: ProductionCreditFieldErrors };

/**
 * production_credits.organization_id is nullable in the schema (a credit can
 * exist for a freelancer with no organization) but every credit created from
 * /dashboard is necessarily "on behalf of" the organization creating it, so
 * it's always set here. One row is created per target, targets already
 * credited with the same person and role are skipped.
 */
export async function addProductionCredits(organizationId: number, input: ProductionCreditInput): Promise<ProductionCreditResult> {
  const { userId: actorUserId } = await requireDashboardOrgActorPermission(organizationId, ORGANIZATION_PERMISSIONS.staffManage);

  const { fieldErrors, role, titleOverride } = validateProductionCreditInput(input);
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  const personId = input.personId as number;
  const [person] = await db.select({ id: people.id }).from(people).where(eq(people.id, personId)).limit(1);
  if (!person) return { ok: false, fieldErrors: { person: "personNotFound" } };
  if (!(await isPersonOrganizationMember(organizationId, person.id))) return { ok: false, fieldErrors: { person: "personNotFound" } };

  const idsOf = (scope: ProductionCreditScope) => [...new Set(input.targets.filter((t) => t.scope === scope).map((t) => t.id))];
  const tournamentIds = idsOf("tournament");
  const matchIds = idsOf("match");
  const mapIds = idsOf("map");

  const [tournamentRows, matchRows, mapRows] = await Promise.all([
    tournamentIds.length ? db.select({ id: tournaments.id }).from(tournaments).where(inArray(tournaments.id, tournamentIds)) : [],
    matchIds.length ? db.select({ id: matches.id }).from(matches).where(inArray(matches.id, matchIds)) : [],
    mapIds.length ? db.select({ id: maps.id }).from(maps).where(inArray(maps.id, mapIds)) : [],
  ]);
  if (tournamentRows.length !== tournamentIds.length || matchRows.length !== matchIds.length || mapRows.length !== mapIds.length) {
    return { ok: false, fieldErrors: { targets: "targetNotFound" } };
  }

  const existing = await db
    .select({ tournamentId: productionCredits.tournamentId, matchId: productionCredits.matchId, mapId: productionCredits.mapId })
    .from(productionCredits)
    .where(and(eq(productionCredits.personId, personId), eq(productionCredits.organizationId, organizationId), eq(productionCredits.role, role)));
  const alreadyCredited = new Set(existing.flatMap((c) => [c.tournamentId && `tournament:${c.tournamentId}`, c.matchId && `match:${c.matchId}`, c.mapId && `map:${c.mapId}`]).filter(Boolean));

  const toInsert = [
    ...tournamentIds.filter((id) => !alreadyCredited.has(`tournament:${id}`)).map((id) => ({ tournamentId: id })),
    ...matchIds.filter((id) => !alreadyCredited.has(`match:${id}`)).map((id) => ({ matchId: id })),
    ...mapIds.filter((id) => !alreadyCredited.has(`map:${id}`)).map((id) => ({ mapId: id })),
  ];
  const total = tournamentIds.length + matchIds.length + mapIds.length;

  if (toInsert.length > 0) {
    await db.transaction(async (tx) => {
      await tx.insert(productionCredits).values(toInsert.map((target) => ({ personId, organizationId, role, titleOverride, ...target })));
      await logActivity({ subject: "credit", subjectId: null, event: "created", description: `Created ${toInsert.length} production credit(s) (${role}) for player #${personId}`, actorUserId, properties: { organizationId, personId, role, targets: toInsert } }, tx);
    });
  }
  return { ok: true, created: toInsert.length, skipped: total - toInsert.length };
}

export type UpdateCreditInput = { role: string; roleOther: string; titleOverride: string };
export type UpdateCreditResult = { ok: true } | { ok: false; fieldErrors: ProductionCreditFieldErrors };

/** Only role/titleOverride are editable in place — changing what a credit is attached to (person or target) means deleting it and adding a new one, deliberately simpler than the roster panel's full inline edit. */
export async function updateProductionCredit(organizationId: number, creditId: number, input: UpdateCreditInput): Promise<UpdateCreditResult> {
  const { userId: actorUserId } = await requireDashboardOrgActorPermission(organizationId, ORGANIZATION_PERMISSIONS.staffManage);

  const { fieldErrors, role, titleOverride } = validateRoleAndTitle(input.role, input.roleOther, input.titleOverride);
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  const [existing] = await db.select().from(productionCredits).where(eq(productionCredits.id, creditId)).limit(1);
  if (!existing || existing.organizationId !== organizationId) return { ok: false, fieldErrors: { role: "notFound" } };

  const values = { role, titleOverride };
  await db.transaction(async (tx) => {
    await tx.update(productionCredits).set(values).where(eq(productionCredits.id, creditId));
    const changes = diffChanges(existing, values);
    if (Object.keys(changes).length > 0) {
      await logActivity({ subject: "credit", subjectId: creditId, event: "updated", description: `Updated production credit #${creditId} of player #${existing.personId}`, actorUserId, changes, properties: { organizationId, personId: existing.personId } }, tx);
    }
  });
  return { ok: true };
}

export type DeleteCreditResult = { ok: true } | { ok: false; error: string };

export async function deleteProductionCredit(organizationId: number, creditId: number): Promise<DeleteCreditResult> {
  const { userId: actorUserId } = await requireDashboardOrgActorPermission(organizationId, ORGANIZATION_PERMISSIONS.staffManage);

  const [existing] = await db.select({ id: productionCredits.id, organizationId: productionCredits.organizationId, personId: productionCredits.personId, role: productionCredits.role }).from(productionCredits).where(eq(productionCredits.id, creditId)).limit(1);
  if (!existing || existing.organizationId !== organizationId) return { ok: false, error: "notFound" };

  await db.transaction(async (tx) => {
    await tx.delete(productionCredits).where(eq(productionCredits.id, creditId));
    await logActivity({ subject: "credit", subjectId: creditId, event: "deleted", description: `Deleted production credit #${creditId} (${existing.role}) of player #${existing.personId}`, actorUserId, properties: { organizationId, personId: existing.personId } }, tx);
  });
  return { ok: true };
}
