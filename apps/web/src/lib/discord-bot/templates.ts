/**
 * GC-Stats - templates
 *
 * Stored image templates of the Discord bot alerts, one per server and alert type.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { inArray } from "drizzle-orm";
import { db } from "@gc-stats/db/client";
import { discordBotTemplates } from "@gc-stats/db";
import { templateSchema, type AlertTemplate } from "./template";
import type { DiscordBotEvent } from "./shared";

export type StoredTemplate = { template: AlertTemplate; updatedAt: Date };

/** Templates per server then alert type, rows that no longer validate are ignored. */
export async function listTemplates(guildIds: string[]): Promise<Map<string, Map<DiscordBotEvent, StoredTemplate>>> {
  const result = new Map<string, Map<DiscordBotEvent, StoredTemplate>>();
  if (guildIds.length === 0) return result;
  const rows = await db.select().from(discordBotTemplates).where(inArray(discordBotTemplates.guildId, guildIds));
  for (const row of rows) {
    const parsed = templateSchema.safeParse(row.template);
    if (!parsed.success) continue;
    if (!result.has(row.guildId)) result.set(row.guildId, new Map());
    result.get(row.guildId)?.set(row.event as DiscordBotEvent, { template: parsed.data, updatedAt: row.updatedAt });
  }
  return result;
}

export async function getGuildTemplates(guildId: string): Promise<Map<DiscordBotEvent, StoredTemplate>> {
  return (await listTemplates([guildId])).get(guildId) ?? new Map();
}
