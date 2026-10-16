/**
 * GC-Stats - organization-team-link
 *
 * Helpers for organizations linked to teams (teams.organization_id): such an
 * organization has no public page, its members are its teams' staff.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, asc, eq, inArray, notExists, or } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { organizations, gameTables } from "@gc-stats/db";
import { visibleTeam } from "@/lib/ghost-visibility";
import { slugify } from "@/lib/entity-id";
import { redirect } from "@/i18n/navigation";
import type { GameSlug } from "@gc-stats/db/game";

export type OrganizationLinkedTeam = { id: number; name: string };

/** SQL condition keeping only organizations that are not linked to any team, e.g. for the public search. */
export function organizationHasNoTeam(game: GameSlug) {
  const { teams } = gameTables(game);
  return notExists(db.select({ id: teams.id }).from(teams).where(eq(teams.organizationId, organizations.id)));
}

export async function getOrganizationLinkedTeams(game: GameSlug, organizationId: number): Promise<OrganizationLinkedTeam[]> {
  const { teams } = gameTables(game);
  return db.select({ id: teams.id, name: teams.name }).from(teams).where(eq(teams.organizationId, organizationId)).orderBy(asc(teams.name));
}

/** Staff tab of the first public team linked to this organization, null when there is none (standalone, or only ghost teams). */
export async function getOrganizationStaffHref(game: GameSlug, organizationId: number): Promise<string | null> {
  const { teams } = gameTables(game);
  const [team] = await db.select({ id: teams.id, name: teams.name }).from(teams).where(and(eq(teams.organizationId, organizationId), visibleTeam(game))).orderBy(asc(teams.name)).limit(1);
  return team ? `/${game}/team/${team.id}/${slugify(team.name)}/staff` : null;
}

/** Public organization pages: a team-linked organization has none, send the visitor to its team's staff tab. */
export async function redirectIfOrganizationLinked(game: GameSlug, organizationId: number, locale: string): Promise<void> {
  const href = await getOrganizationStaffHref(game, organizationId);
  if (href) redirect({ href, locale });
}

export async function getOrganizationTeamIds(game: GameSlug, organizationId: number): Promise<number[]> {
  const { teams } = gameTables(game);
  const rows = await db.select({ id: teams.id }).from(teams).where(eq(teams.organizationId, organizationId));
  return rows.map((r) => r.id);
}

/** Subset of matchIds in which at least one of the teams plays, used to scope a linked organization's streams. */
export async function filterMatchIdsInvolvingTeams(game: GameSlug, matchIds: number[], teamIds: number[]): Promise<Set<number>> {
  const { matches, entrants } = gameTables(game);
  if (matchIds.length === 0 || teamIds.length === 0) return new Set();
  const rows = await db
    .selectDistinct({ matchId: matches.id })
    .from(matches)
    .innerJoin(entrants, or(eq(entrants.id, matches.entrantAId), eq(entrants.id, matches.entrantBId)))
    .where(and(inArray(matches.id, matchIds), inArray(entrants.teamId, teamIds)));
  return new Set(rows.map((r) => r.matchId));
}

/** Tournaments in which at least one of the teams is an entrant. */
export async function getTournamentIdsOfTeams(game: GameSlug, teamIds: number[]): Promise<number[]> {
  const { entrants } = gameTables(game);
  if (teamIds.length === 0) return [];
  const rows = await db.selectDistinct({ id: entrants.tournamentId }).from(entrants).where(inArray(entrants.teamId, teamIds));
  return rows.map((r) => r.id);
}
