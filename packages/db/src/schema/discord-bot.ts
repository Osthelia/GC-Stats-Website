/**
 * GC-Stats - discord bot module
 *
 * Alert subscriptions of the Discord bot (one per server channel and event),
 * the theme of each server and the messages it already posted for each match.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { pgTable, bigserial, bigint, text, boolean, jsonb, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { matches } from "./bracket";

export const discordBotSubscriptions = pgTable("discord_bot_subscriptions", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  guildId: text("guild_id").notNull(),
  channelId: text("channel_id").notNull(),
  event: text("event").notNull(), // 'match_live' | 'match_finished' | 'map_finished'
  locale: text("locale").notNull().default("en"),
  // Empty array = no filter.
  filterRegions: text("filter_regions").array().notNull().default(sql`'{}'::text[]`),
  filterTeamIds: bigint("filter_team_ids", { mode: "number" }).array().notNull().default(sql`'{}'::bigint[]`),
  filterOfficial: text("filter_official").notNull().default("official"), // 'all' | 'official' | 'unofficial'
  // Embed color override (#rrggbb), null = the server theme.
  color: text("color"),
  isActive: boolean("is_active").notNull().default(true),
  // Set when the bot lost access to the channel and the dispatcher switched the subscription off.
  disabledReason: text("disabled_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("discord_bot_subscriptions_guild_id_idx").on(t.guildId),
]);

// Theme of a server: custom bot, message accent colors and match button. No row = the GC Stats bot with default colors.
export const discordBotGuildSettings = pgTable("discord_bot_guild_settings", {
  guildId: text("guild_id").primaryKey(),
  // Token of the server's own bot application, encrypted at rest.
  botTokenEncrypted: text("bot_token_encrypted"),
  botUserId: text("bot_user_id"),
  botName: text("bot_name"),
  botAvatarUrl: text("bot_avatar_url"),
  // Embed colors (#rrggbb), null = default.
  colorLive: text("color_live"),
  colorFinished: text("color_finished"),
  colorMap: text("color_map"),
  // Default background of the image templates (#rrggbb), null = the site's dark background.
  colorBackground: text("color_background"),
  // Link button to the match under each alert.
  matchButton: boolean("match_button").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Image template of an alert type for a server (layers as validated JSON, see lib/discord-bot/template.ts).
export const discordBotTemplates = pgTable("discord_bot_templates", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  guildId: text("guild_id").notNull(),
  event: text("event").notNull(), // 'match_live' | 'match_finished' | 'map_finished'
  template: jsonb("template").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("discord_bot_templates_unique").on(t.guildId, t.event),
]);

// One row per message posted: also the claim that keeps a match from being announced twice.
export const discordBotMessages = pgTable("discord_bot_messages", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  subscriptionId: bigint("subscription_id", { mode: "number" }).notNull().references(() => discordBotSubscriptions.id, { onDelete: "cascade" }),
  matchId: bigint("match_id", { mode: "number" }).notNull().references(() => matches.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(), // 'live' | 'finished' | 'map:<mapId>'
  // Null while the claim is held and the message is being sent.
  messageId: text("message_id"),
  contentHash: text("content_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("discord_bot_messages_unique").on(t.subscriptionId, t.matchId, t.kind),
  index("discord_bot_messages_match_id_idx").on(t.matchId),
]);
