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
import { organizations, gameTables, valorantTablesOf } from "@gc-stats/db";
import { buildInfoboxWikicode } from "@/lib/liquipedia-infobox-wikicode";
import { gameHasMaps, type GameSlug } from "@gc-stats/db/game";

const INFOBOX_SOCIAL_KEYS = ["twitter", "twitch", "discord", "youtube"];

export async function getTournamentInfoboxWikicode(game: GameSlug, tournamentId: number): Promise<string | null> {
  const { entrants, tournaments } = gameTables(game);
  const [row] = await db
    .select({
      name: tournaments.name,
      startDate: tournaments.startDate,
      endDate: tournaments.endDate,
      prizePool: tournaments.prizePool,
      socials: tournaments.socials,
      organizer: organizations.name,
    })
    .from(tournaments)
    .leftJoin(organizations, eq(organizations.id, tournaments.organizerOrganizationId))
    .where(eq(tournaments.id, tournamentId));
  if (!row) return null;

  // The map pool lives in the veto settings, which only games with maps have.
  let maps: string[] = [];
  if (gameHasMaps(game)) {
    const { tournamentVetoSettings } = valorantTablesOf(game);
    const [settings] = await db.select({ mapPool: tournamentVetoSettings.mapPool }).from(tournamentVetoSettings).where(eq(tournamentVetoSettings.tournamentId, tournamentId));
    maps = settings?.mapPool ?? [];
  }

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
    maps,
  });
}
