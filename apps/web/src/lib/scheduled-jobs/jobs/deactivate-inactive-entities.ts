/**
 * GC-Stats - deactivate-inactive-entities
 *
 * Scheduled job: flags players and teams as inactive once their last
 * completed match is older than a year. A person must also have no team or
 * organization entry and no production credit within that year.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, eq, sql } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { people, teams } from "@gc-stats/db";

const INACTIVITY_MONTHS = 12;

/** A never active entity (no completed match) has a NULL last match, so the `<` comparison leaves it untouched. */
export async function deactivateInactiveEntities(): Promise<string> {
  const cutoff = new Date();
  cutoff.setUTCMonth(cutoff.getUTCMonth() - INACTIVITY_MONTHS);
  const cutoffIso = cutoff.toISOString();
  const cutoffDate = cutoffIso.slice(0, 10);

  const deactivatedTeams = await db
    .update(teams)
    .set({ isActive: false })
    .where(
      and(
        eq(teams.isActive, true),
        sql`(
          select max(m.scheduled_at) from matches m
          join entrants e on e.id in (m.entrant_a_id, m.entrant_b_id)
          where e.team_id = ${teams.id} and m.status = 'completed'
        ) < ${cutoffIso}`
      )
    )
    .returning({ id: teams.id });

  // Date of a production credit: the end of its tournament, resolved from whichever scope the credit targets
  const creditTournamentJoins = sql`
    left join maps mp on mp.id = pc.map_id
    left join matches mt on mt.id = coalesce(pc.match_id, mp.match_id)
    left join stage_containers sc on sc.id = coalesce(pc.container_id, mt.container_id)
    left join stages st on st.id = coalesce(pc.stage_id, sc.stage_id)
    join tournaments t on t.id = coalesce(pc.tournament_id, st.tournament_id)`;
  const personMatches = sql`
    select 1 from entrant_members em
    join matches m on em.entrant_id in (m.entrant_a_id, m.entrant_b_id)
    where em.person_id = ${people.id} and m.status = 'completed'`;

  const deactivatedPeople = await db
    .update(people)
    .set({ isActive: false })
    .where(
      and(
        eq(people.isActive, true),
        // Already had some activity ever
        sql`(
          exists (${personMatches})
          or exists (select 1 from roster_memberships where person_id = ${people.id})
          or exists (select 1 from organization_memberships where person_id = ${people.id})
          or exists (select 1 from production_credits where person_id = ${people.id})
        )`,
        // No match within the year
        sql`not exists (${personMatches} and m.scheduled_at >= ${cutoffIso})`,
        // No team or organization entry within the year (period && [cutoff, ∞) : still open or ended since)
        sql`not exists (
          select 1 from roster_memberships rm
          where rm.person_id = ${people.id} and rm.period && daterange(${cutoffDate}::date, null)
        )`,
        sql`not exists (
          select 1 from organization_memberships om
          where om.person_id = ${people.id} and om.period && daterange(${cutoffDate}::date, null)
        )`,
        // No production within the year
        sql`not exists (
          select 1 from production_credits pc ${creditTournamentJoins}
          where pc.person_id = ${people.id} and t.end_date >= ${cutoffDate}::date
        )`
      )
    )
    .returning({ id: people.id });

  return `deactivated ${deactivatedTeams.length} team(s) and ${deactivatedPeople.length} player(s) with no activity in ${INACTIVITY_MONTHS} months`;
}
