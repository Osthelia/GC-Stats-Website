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

export const news = pgTable("news", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  authorId: bigint("author_id", { mode: "number" }).references(() => newsAuthors.id),
  // Organizations replace V1's news_publishers (same real ids already) — an
  // org with the 'media'/'production' tag doubles as an outlet, no separate
  // publisher entity needed.
  organizationId: bigint("organization_id", { mode: "number" }).references(() => organizations.id, { onDelete: "set null" }),
  lang: varchar("lang", { length: 10 }).notNull().default("en").references(() => newsLanguages.code),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  excerpt: text("excerpt"),
  content: text("content").notNull(),
  imageCover: text("image_cover"),
  // 'draft' | 'in_review' | 'changes_requested' | 'approved' | 'published' | 'archived'.
  // The review states only ever apply to an organization-scoped article
  // (organization.news.edit submits, organization.news.review approves or
  // requests changes, organization.news.publish puts an approved article
  // live) — an individual /dashboard/author article has a single trusted
  // actor and always goes straight draft -> published, see resolveScope in
  // actions/dashboard-news.ts.
  status: text("status").notNull().default("draft"),
  isFeatured: boolean("is_featured").notNull().default(false),
  showOnHome: boolean("show_on_home").notNull().default(true),
  // A future publishedAt is how "schedule this for later" is represented —
  // status flips to 'published' immediately once approved, but every public
  // read site also requires publishedAt <= now() (see news-page-data.ts and
  // friends), so a future timestamp keeps it invisible until due without
  // needing any background job to flip a status flag.
  publishedAt: timestamp("published_at", { withTimezone: true }),
  submittedBy: text("submitted_by").references(() => users.id, { onDelete: "set null" }),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  reviewedBy: text("reviewed_by").references(() => users.id, { onDelete: "set null" }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("news_home_idx").on(t.showOnHome, t.status, t.publishedAt),
]);

// Private conversation attached to one article — visible only to whoever can
// reach its /dashboard editor (never public). Doubles as the audit trail for
// the approval workflow: a status transition (submit/approve/request
// changes/publish) posts a system row here alongside free-text comments,
// distinguished by `type`, mirroring change_request_messages' own
// comment/system split above.
export const newsMessages = pgTable("news_messages", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  newsId: bigint("news_id", { mode: "number" }).notNull().references(() => news.id, { onDelete: "cascade" }),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  type: text("type").notNull().default("comment"), // 'comment' | 'submitted' | 'approved' | 'changes_requested' | 'published' | 'scheduled' | 'unpublished'
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const newsRelations = pgTable("news_relations", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  newsId: bigint("news_id", { mode: "number" }).notNull().references(() => news.id, { onDelete: "cascade" }),
  relatableType: text("relatable_type").notNull(), // 'team' | 'person' | 'tournament'
  relatableId: bigint("relatable_id", { mode: "number" }).notNull(),
}, (t) => [
  index("news_relations_relatable_idx").on(t.relatableType, t.relatableId),
]);

export const newsImages = pgTable("news_images", {
  id: uuid("id").primaryKey().defaultRandom(),
  newsId: bigint("news_id", { mode: "number" }).references(() => news.id, { onDelete: "set null" }),
  authorId: bigint("author_id", { mode: "number" }).references(() => newsAuthors.id, { onDelete: "set null" }),
});

// --- Forum -----------------------------------------------------------------
export const forumThreads = pgTable("forum_threads", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  category: text("category").notNull(), // 'tournament' | 'match' | 'news' | 'general'
  subjectType: text("subject_type"),
  subjectId: bigint("subject_id", { mode: "number" }),
  title: text("title"),
  createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
  lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
}, (t) => [
  // One thread per subject (mirrors V1 findOrCreateThreadFor's firstOrCreate)
  // — NULLs (general category, no subject) are never considered equal by
  // Postgres, so this never limits how many general threads can exist.
  unique("forum_threads_subject_unique").on(t.subjectType, t.subjectId),
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

// --- Change requests (crowdsourced edits) -----------------------------------
export const changeRequests = pgTable("change_requests", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  subjectType: text("subject_type").notNull(),
  subjectId: bigint("subject_id", { mode: "number" }).notNull(),
  requestedBy: text("requested_by").references(() => users.id, { onDelete: "set null" }),
  reason: text("reason"),
  status: text("status").notNull().default("pending"),
  closedBy: text("closed_by").references(() => users.id, { onDelete: "set null" }),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  sanctionedAt: timestamp("sanctioned_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const changeRequestItems = pgTable("change_request_items", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  changeRequestId: bigint("change_request_id", { mode: "number" }).notNull().references(() => changeRequests.id, { onDelete: "cascade" }),
  field: text("field").notNull(),
  oldValue: jsonb("old_value"),
  newValue: jsonb("new_value"),
  status: text("status").notNull().default("pending"),
  resolvedBy: text("resolved_by").references(() => users.id, { onDelete: "set null" }),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  resolutionNote: text("resolution_note"),
  appliedAt: timestamp("applied_at", { withTimezone: true }),
  applyError: text("apply_error"),
});

export const changeRequestMessages = pgTable("change_request_messages", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  changeRequestId: bigint("change_request_id", { mode: "number" }).notNull().references(() => changeRequests.id, { onDelete: "cascade" }),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  type: text("type").notNull().default("comment"),
  body: text("body").notNull(),
  editedAt: timestamp("edited_at", { withTimezone: true }),
});

// One row per change request awaiting its Discord decision notice. Every
// item resolution that closes the request upserts this (pushing scheduledAt
// forward), so several items resolved close together coalesce into a single
// Discord message instead of one per item — see lib/notify.ts and
// scheduled-jobs/jobs/flush-change-request-discord-notices.ts.
export const changeRequestDiscordNotices = pgTable("change_request_discord_notices", {
  changeRequestId: bigint("change_request_id", { mode: "number" })
    .primaryKey()
    .references(() => changeRequests.id, { onDelete: "cascade" }),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
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
