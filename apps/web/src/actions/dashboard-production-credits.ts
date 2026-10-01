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

import { eq } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { productionCredits, people, tournaments, ORGANIZATION_PERMISSIONS } from "@gc-stats/db";
import { requireDashboardOrgActorPermission } from "@/lib/dashboard-rbac";
import { isPersonOrganizationMember } from "@/lib/organization-membership-service";
import { searchTournamentsQuery, type TournamentPickerResult } from "@/lib/tournament-search";
import { getMatchTournamentId, getTournamentMatchOptionsForCredit, type CreditMatchOption } from "@/lib/production-credits-data";
import { validateProductionCreditInput, validateRoleAndTitle, type ProductionCreditInput, type ProductionCreditFieldErrors } from "@/lib/production-credit-validation";

export type { ProductionCreditInput, ProductionCreditField, ProductionCreditFieldErrors, ProductionCreditScope } from "@/lib/production-credit-validation";
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

export type ProductionCreditResult = { ok: true; id: number } | { ok: false; fieldErrors: ProductionCreditFieldErrors };

/**
 * production_credits.organization_id is nullable in the schema (a credit can
 * exist for a freelancer with no organization) but every credit created from
 * /dashboard is necessarily "on behalf of" the organization creating it, so
 * it's always set here.
 */
export async function addProductionCredit(organizationId: number, input: ProductionCreditInput): Promise<ProductionCreditResult> {
  await requireDashboardOrgActorPermission(organizationId, ORGANIZATION_PERMISSIONS.staffManage);

  const { fieldErrors, role, titleOverride } = validateProductionCreditInput(input);
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  const [person] = await db.select({ id: people.id }).from(people).where(eq(people.id, input.personId as number)).limit(1);
  if (!person) return { ok: false, fieldErrors: { person: "personNotFound" } };
  if (!(await isPersonOrganizationMember(organizationId, person.id))) return { ok: false, fieldErrors: { person: "personNotFound" } };

  const [tournament] = await db.select({ id: tournaments.id }).from(tournaments).where(eq(tournaments.id, input.tournamentId as number)).limit(1);
  if (!tournament) return { ok: false, fieldErrors: { tournament: "tournamentNotFound" } };

  if (input.scope === "tournament") {
    const [created] = await db
      .insert(productionCredits)
      .values({ personId: input.personId as number, organizationId, role, titleOverride, tournamentId: tournament.id })
      .returning({ id: productionCredits.id });
    if (!created) throw new Error("Insert returned no row");
    return { ok: true, id: created.id };
  }

  const matchTournamentId = await getMatchTournamentId(input.matchId as number);
  if (matchTournamentId === null) return { ok: false, fieldErrors: { match: "matchNotFound" } };
  if (matchTournamentId !== tournament.id) return { ok: false, fieldErrors: { match: "matchNotInTournament" } };

  const [created] = await db
    .insert(productionCredits)
    .values({ personId: input.personId as number, organizationId, role, titleOverride, matchId: input.matchId as number })
    .returning({ id: productionCredits.id });
  if (!created) throw new Error("Insert returned no row");
  return { ok: true, id: created.id };
}

export type UpdateCreditInput = { role: string; roleOther: string; titleOverride: string };
export type UpdateCreditResult = { ok: true } | { ok: false; fieldErrors: ProductionCreditFieldErrors };

/** Only role/titleOverride are editable in place — changing what a credit is attached to (person/tournament/match) means deleting it and adding a new one, deliberately simpler than the roster panel's full inline edit. */
export async function updateProductionCredit(organizationId: number, creditId: number, input: UpdateCreditInput): Promise<UpdateCreditResult> {
  await requireDashboardOrgActorPermission(organizationId, ORGANIZATION_PERMISSIONS.staffManage);

  const { fieldErrors, role, titleOverride } = validateRoleAndTitle(input.role, input.roleOther, input.titleOverride);
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  const [existing] = await db.select({ id: productionCredits.id, organizationId: productionCredits.organizationId }).from(productionCredits).where(eq(productionCredits.id, creditId)).limit(1);
  if (!existing || existing.organizationId !== organizationId) return { ok: false, fieldErrors: { role: "notFound" } };

  await db.update(productionCredits).set({ role, titleOverride }).where(eq(productionCredits.id, creditId));
  return { ok: true };
}

export type DeleteCreditResult = { ok: true } | { ok: false; error: string };

export async function deleteProductionCredit(organizationId: number, creditId: number): Promise<DeleteCreditResult> {
  await requireDashboardOrgActorPermission(organizationId, ORGANIZATION_PERMISSIONS.staffManage);

  const [existing] = await db.select({ id: productionCredits.id, organizationId: productionCredits.organizationId }).from(productionCredits).where(eq(productionCredits.id, creditId)).limit(1);
  if (!existing || existing.organizationId !== organizationId) return { ok: false, error: "notFound" };

  await db.delete(productionCredits).where(eq(productionCredits.id, creditId));
  return { ok: true };
}
