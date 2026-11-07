/**
 * GC-Stats - subscriptions
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { discordBotSubscriptions, valorantTables } from "@gc-stats/db";
import type { DiscordBotEvent, DiscordBotOfficialFilter, DiscordBotSubscriptionView } from "./shared";

const { teams } = valorantTables;

export async function listGuildSubscriptions(guildId: string): Promise<DiscordBotSubscriptionView[]> {
  const rows = await db.select().from(discordBotSubscriptions).where(eq(discordBotSubscriptions.guildId, guildId)).orderBy(asc(discordBotSubscriptions.createdAt));
  const teamIds = [...new Set(rows.flatMap((r) => r.filterTeamIds))];
  const teamRows = teamIds.length ? await db.select({ id: teams.id, name: teams.name }).from(teams).where(inArray(teams.id, teamIds)) : [];
  const teamName = new Map(teamRows.map((t) => [t.id, t.name]));

  return rows.map((r) => ({
    id: r.id,
    channelId: r.channelId,
    event: r.event as DiscordBotEvent,
    locale: r.locale,
    filterRegions: r.filterRegions,
    filterTeams: r.filterTeamIds.map((id) => ({ id, name: teamName.get(id) ?? `#${id}` })),
    filterOfficial: r.filterOfficial as DiscordBotOfficialFilter,
    color: r.color,
    isActive: r.isActive,
    disabledReason: r.disabledReason,
  }));
}

/** Number of subscriptions per guild, for the server list. */
export async function countSubscriptionsByGuild(guildIds: string[]): Promise<Map<string, number>> {
  if (guildIds.length === 0) return new Map();
  const rows = await db
    .select({ guildId: discordBotSubscriptions.guildId, total: sql<number>`count(*)::int` })
    .from(discordBotSubscriptions)
    .where(inArray(discordBotSubscriptions.guildId, guildIds))
    .groupBy(discordBotSubscriptions.guildId);
  return new Map(rows.map((r) => [r.guildId, r.total]));
}
