/**
 * GC-Stats — content module
 *
 * News (authors, languages, articles, messages, relations, images), forum
 * (threads, messages, moderation suspects, user reports), emotes and
 * reactions, sanctions, change requests (with items, messages, Discord
 * notices), and the Data Explorer API keys/usage/error log tables.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { pgTable, bigserial, bigint, text, varchar, jsonb, boolean, integer, timestamp, uuid, unique, type AnyPgColumn, index } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { organizations } from "./people";

// Portage direct de la V1 (pas de rework de domaine) - voir DATABASES.MD Â§6.
// Les relations polymorphes Laravel restent en discriminant type+id sans FK
// rÃ©elle, par dÃ©faut pour ces domaines pÃ©riphÃ©riques.

export const newsAuthors = pgTable("news_authors", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  userId: text("user_id").references(() => users.id),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  bio: text("bio"),
});

// Reference list of selectable article languages, editable from /admin (like
// point types/emotes) rather than hardcoded — a `code` is a natural key
// (ISO-ish, e.g. 'en'/'zh_Hans', mirrors V1's lang/*.php directories) so it
// doubles as the FK target for news.lang without a surrogate id.
export const newsLanguages = pgTable("news_languages", {
  code: varchar("code", { length: 10 }).primaryKey(),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
});

// --- Forum -----------------------------------------------------------------
export const forumThreads = pgTable("forum_threads", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  category: text("category").notNull(), // 'tournament' | 'match' | 'news' | 'general'
  // Game of the linked tournament, match or news; null for general threads.
  game: text("game"),
  subjectType: text("subject_type"),
  subjectId: bigint("subject_id", { mode: "number" }),
  title: text("title"),
  createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
  lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
}, (t) => [
  // One thread per subject (mirrors V1 findOrCreateThreadFor's firstOrCreate)
  // — NULLs (general category, no subject) are never considered equal by
  // Postgres, so this never limits how many general threads can exist.
  unique("forum_threads_subject_unique").on(t.game, t.subjectType, t.subjectId),
]);

export const forumMessages = pgTable("forum_messages", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  threadId: bigint("thread_id", { mode: "number" }).notNull().references(() => forumThreads.id, { onDelete: "cascade" }),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  parentId: bigint("parent_id", { mode: "number" }).references((): AnyPgColumn => forumMessages.id, { onDelete: "set null" }),
  body: text("body").notNull(),
  hiddenAt: timestamp("hidden_at", { withTimezone: true }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const moderationSuspects = pgTable("moderation_suspects", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  source: text("source"),
  subjectType: text("subject_type"),
  subjectId: bigint("subject_id", { mode: "number" }),
  threadId: bigint("thread_id", { mode: "number" }).references(() => forumThreads.id, { onDelete: "set null" }),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  matchedTerm: text("matched_term"),
  bodySnapshot: text("body_snapshot").notNull(),
  status: text("status").notNull().default("pending"), // 'pending' | 'dismissed' | 'actioned'
  reviewedBy: text("reviewed_by").references(() => users.id, { onDelete: "set null" }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
});

export const userReports = pgTable("user_reports", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  reporterId: text("reporter_id").references(() => users.id, { onDelete: "set null" }),
  reportedUserId: text("reported_user_id").references(() => users.id, { onDelete: "set null" }),
  reportedMessageId: bigint("reported_message_id", { mode: "number" }).references(() => forumMessages.id, { onDelete: "set null" }),
  reactableType: text("reactable_type"),
  reactableId: bigint("reactable_id", { mode: "number" }),
  emoteId: bigint("emote_id", { mode: "number" }),
  organizationId: bigint("organization_id", { mode: "number" }).references(() => organizations.id, { onDelete: "set null" }),
  category: text("category").notNull(),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("pending"),
  reviewedBy: text("reviewed_by").references(() => users.id, { onDelete: "set null" }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  resolutionNote: text("resolution_note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const emotes = pgTable("emotes", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  name: varchar("name", { length: 80 }).notNull().unique(),
  imagePath: text("image_path").notNull(),
  source: varchar("source", { length: 40 }).notNull().default("custom"),
  isActive: boolean("is_active").notNull().default(true),
});

export const reactions = pgTable("reactions", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  emoteId: bigint("emote_id", { mode: "number" }).notNull().references(() => emotes.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  reactableType: text("reactable_type").notNull(),
  reactableId: bigint("reactable_id", { mode: "number" }).notNull(),
}, (t) => [
  // One reaction per user/emote/content (mirrors V1) — toggled, never updated.
  unique("reactions_reactable_user_emote_unique").on(t.reactableType, t.reactableId, t.userId, t.emoteId),
]);

// --- Sanctions / moderation identity ----------------------------------------
export const sanctions = pgTable("sanctions", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  teamId: bigint("team_id", { mode: "number" }),
  issuedBy: text("issued_by").references(() => users.id, { onDelete: "set null" }),
  type: text("type").notNull(), // 'note' | 'warning' | 'mute' | 'suspension' | 'ban'
  reason: text("reason").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull().defaultNow(),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  revokedBy: text("revoked_by").references(() => users.id, { onDelete: "set null" }),
  transferredFrom: bigint("transferred_from", { mode: "number" }),
});

export const sanctionIdentities = pgTable("sanction_identities", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  sanctionId: bigint("sanction_id", { mode: "number" }).notNull().references(() => sanctions.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  value: text("value").notNull(),
});

// --- Data Explorer (AI/BI feature) ------------------------------------------
export const dataExplorerApiKeys = pgTable("data_explorer_api_keys", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  keyEncrypted: text("key_encrypted").notNull(),
  linkedAt: timestamp("linked_at", { withTimezone: true }).notNull().defaultNow(),
  lastValidatedAt: timestamp("last_validated_at", { withTimezone: true }),
  lastValidationStatus: text("last_validation_status"),
}, (t) => [
  unique("data_explorer_api_keys_user_provider_unique").on(t.userId, t.provider),
]);

export const dataExplorerUsages = pgTable("data_explorer_usages", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  year: integer("year").notNull(),
  month: integer("month").notNull(),
  platformRequestsCount: integer("platform_requests_count").notNull().default(0),
  personalRequestsCount: integer("personal_requests_count").notNull().default(0),
});

export const dataExplorerErrorLogs = pgTable("data_explorer_error_logs", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  requestId: uuid("request_id").notNull().unique(),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  source: text("source").notNull(),
  requestPayload: jsonb("request_payload"),
  errorCode: text("error_code"),
  errorMessage: text("error_message"),
  httpStatus: integer("http_status"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
