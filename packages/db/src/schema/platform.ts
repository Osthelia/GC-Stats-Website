/**
 * GC-Stats — platform module
 *
 * Stream/VOD tables (stream_channels, match_streams, vods, match player
 * POVs), finance entries, the About page tables (sections, projects, team
 * categories/settings), activity log, and page view tracking.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { pgTable, bigserial, bigint, text, char, boolean, integer, numeric, date, timestamp, jsonb, primaryKey, unique, index } from "drizzle-orm/pg-core";
import { matches } from "./bracket";
import { maps } from "./stats";
import { people, organizations } from "./people";
import { users } from "./auth";

export const streamChannels = pgTable("stream_channels", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  organizationId: bigint("organization_id", { mode: "number" }).references(() => organizations.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  platform: text("platform").notNull(), // 'youtube' | 'twitch' | 'tiktok' | 'kick'
  type: text("type").notNull().default("official"), // 'official' | 'watchparty'
  url: text("url").notNull(),
  languageCode: char("language_code", { length: 5 }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
});

export const matchStreams = pgTable(
  "match_streams",
  {
    matchId: bigint("match_id", { mode: "number" }).notNull().references(() => matches.id, { onDelete: "cascade" }),
    streamChannelId: bigint("stream_channel_id", { mode: "number" }).notNull().references(() => streamChannels.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.matchId, t.streamChannelId] })]
);

export const vods = pgTable("vods", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  matchId: bigint("match_id", { mode: "number" }).notNull().references(() => matches.id, { onDelete: "cascade" }),
  mapId: bigint("map_id", { mode: "number" }).references(() => maps.id, { onDelete: "set null" }), // null = whole-match VOD
  organizationId: bigint("organization_id", { mode: "number" }).references(() => organizations.id, { onDelete: "set null" }),
  url: text("url").notNull(),
  languageCode: char("language_code", { length: 5 }).notNull(),
}, (t) => [
  index("vods_match_id_idx").on(t.matchId),
]);

export const matchPlayerPovs = pgTable("match_player_povs", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  matchId: bigint("match_id", { mode: "number" }).notNull().references(() => matches.id, { onDelete: "cascade" }),
  entrantId: bigint("entrant_id", { mode: "number" }).notNull(),
  personId: bigint("person_id", { mode: "number" }).references(() => people.id, { onDelete: "cascade" }), // null = the team's own channel
  twitchLogin: text("twitch_login").notNull(),
  title: text("title"),
  url: text("url").notNull(),
  lastSeenLiveAt: timestamp("last_seen_live_at", { withTimezone: true }),
}, (t) => [
  unique("match_player_povs_match_login_unique").on(t.matchId, t.twitchLogin),
]);

export const financeEntries = pgTable("finance_entries", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  entryDate: date("entry_date").notNull(),
  type: text("type").notNull(), // 'income' | 'expense'
  category: text("category").notNull(),
  label: text("label").notNull(),
  description: text("description"),
  amountUsd: numeric("amount_usd", { precision: 10, scale: 2 }).notNull(),
  amountEur: numeric("amount_eur", { precision: 10, scale: 2 }).notNull(),
  sourceUrl: text("source_url"),
});

export const aboutSections = pgTable("about_sections", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  key: text("key").notNull().unique(),
  title: jsonb("title").notNull(), // i18n {"fr": "...", "en": "..."}
  content: jsonb("content").notNull(),
  order: integer("order").notNull().default(0),
});

export const aboutProjects = pgTable("about_projects", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  description: jsonb("description").notNull(),
  url: text("url"),
  logoUrl: text("logo_url"),
  order: integer("order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
});

export const aboutTeamCategories = pgTable("about_team_categories", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  key: text("key").notNull().unique(),
  label: jsonb("label").notNull(), // i18n {"fr": "...", "en": "..."}
  order: integer("order").notNull().default(0),
});

// Overrides the automatic /about team population (every user holding a
// global role, cf. getAboutTeam()) without duplicating user data — a row
// only exists once an admin has customized visibility/role/category for
// that user, absence of a row means "visible, uncategorized, default role".
export const aboutTeamMemberSettings = pgTable("about_team_member_settings", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  categoryId: bigint("category_id", { mode: "number" }).references(() => aboutTeamCategories.id, { onDelete: "set null" }),
  displayRole: jsonb("display_role"), // i18n {"fr": "...", "en": "..."} override; null = fall back to actual RBAC role names
  isVisible: boolean("is_visible").notNull().default(true),
  order: integer("order").notNull().default(0),
});

export const activityLog = pgTable("activity_log", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  logName: text("log_name"),
  description: text("description").notNull(),
  subjectType: text("subject_type"),
  subjectId: text("subject_id"), // text, not bigint — some subjects are UUID-keyed
  event: text("event"),
  causerType: text("causer_type"),
  causerId: bigint("causer_id", { mode: "number" }),
  attributeChanges: jsonb("attribute_changes"),
  properties: jsonb("properties"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const pageViews = pgTable("page_views", {
  uri: text("uri").notNull(),
  viewedAt: date("viewed_at").notNull(),
  count: integer("count").notNull().default(0),
  countryCode: char("country_code", { length: 3 }).notNull().default(""),
  regionCode: char("region_code", { length: 4 }).notNull().default(""),
}, (t) => [
  primaryKey({ columns: [t.uri, t.viewedAt, t.regionCode, t.countryCode] }),
  index("page_views_viewed_at_idx").on(t.viewedAt),
]);
