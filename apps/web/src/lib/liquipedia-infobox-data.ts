/**
 * GC-Stats - liquipedia-infobox-data
 *
 * Loads a tournament and builds its `{{Infobox league}}` wikicode.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, eq, isNotNull } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { entrants, organizations, tournaments, tournamentVetoSettings } from "@gc-stats/db";
import { buildInfoboxWikicode } from "@/lib/liquipedia-infobox-wikicode";

const INFOBOX_SOCIAL_KEYS = ["twitter", "twitch", "discord", "youtube"];

export async function getTournamentInfoboxWikicode(tournamentId: number): Promise<string | null> {
  const [row] = await db
    .select({
      name: tournaments.name,
      startDate: tournaments.startDate,
      endDate: tournaments.endDate,
      prizePool: tournaments.prizePool,
      socials: tournaments.socials,
      organizer: organizations.name,
      maps: tournamentVetoSettings.mapPool,
    })
    .from(tournaments)
    .leftJoin(organizations, eq(organizations.id, tournaments.organizerOrganizationId))
    .leftJoin(tournamentVetoSettings, eq(tournamentVetoSettings.tournamentId, tournaments.id))
    .where(eq(tournaments.id, tournamentId));
  if (!row) return null;

  const teams = await db.select({ id: entrants.id }).from(entrants).where(and(eq(entrants.tournamentId, tournamentId), isNotNull(entrants.teamId)));
  const allSocials = (row.socials as Record<string, string>) ?? {};
  const socials = Object.fromEntries(INFOBOX_SOCIAL_KEYS.filter((key) => allSocials[key]?.trim()).map((key) => [key, allSocials[key]!]));

  return buildInfoboxWikicode({
    name: row.name,
    organizer: row.organizer,
    startDate: row.startDate,
    endDate: row.endDate,
    prizePool: row.prizePool,
    socials,
    teamCount: teams.length,
    maps: row.maps ?? [],
  });
}
