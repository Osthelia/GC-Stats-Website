/**
 * GC-Stats - roster watch module
 *
 * X accounts followed for roster announcements and one signal per tweet
 * fetched (kept even when excluded, for audit), reviewed by an admin.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { pgTable, bigserial, bigint, text, boolean, jsonb, integer, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { teams } from "./people";
import { users } from "./auth";

export const xMonitoredAccounts = pgTable("x_monitored_accounts", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  teamId: bigint("team_id", { mode: "number" }).notNull().references(() => teams.id, { onDelete: "cascade" }),
  xHandle: text("x_handle").notNull(),
  // Resolved on the first fetch.
  xUserId: text("x_user_id"),
  enabled: boolean("enabled").notNull().default(true),
  // Tweet ids are numeric strings, compared as bigint.
  lastSeenTweetId: text("last_seen_tweet_id"),
  lastPolledAt: timestamp("last_polled_at", { withTimezone: true }),
  lastError: text("last_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("x_monitored_accounts_handle_uidx").on(t.xHandle),
  index("x_monitored_accounts_team_id_idx").on(t.teamId),
]);

export type XSignalMedia = { type: "photo" | "video"; url: string; previewUrl: string | null };

export const xRosterSignals = pgTable("x_roster_signals", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  tweetId: text("tweet_id").notNull().unique(),
  accountId: bigint("account_id", { mode: "number" }).notNull().references(() => xMonitoredAccounts.id, { onDelete: "cascade" }),
  teamId: bigint("team_id", { mode: "number" }).notNull().references(() => teams.id, { onDelete: "cascade" }),
  tweetUrl: text("tweet_url").notNull(),
  text: text("text").notNull(),
  // English translation (DeepL), null when not translated or already in English.
  textEn: text("text_en"),
  media: jsonb("media").$type<XSignalMedia[]>().notNull().default([]),
  tweetedAt: timestamp("tweeted_at", { withTimezone: true }).notNull(),
  stage: text("stage").notNull(), // 'excluded' | 'classified' | 'error'
  exclusionRuleId: text("exclusion_rule_id"),
  verdict: text("verdict"), // 'roster' | 'not_roster' | 'unsure'
  topic: text("topic"),
  players: jsonb("players").$type<string[]>().notNull().default([]),
  llmReason: text("llm_reason"),
  llmModel: text("llm_model"),
  llmInputTokens: integer("llm_input_tokens"),
  llmOutputTokens: integer("llm_output_tokens"),
  status: text("status").notNull().default("pending"), // 'pending' | 'team_edited' | 'ignored' | 'marked_not_roster' | 'reported_missed'
  reviewedBy: text("reviewed_by").references(() => users.id, { onDelete: "set null" }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  reviewTopic: text("review_topic"),
  reviewNote: text("review_note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("x_roster_signals_verdict_status_idx").on(t.verdict, t.status),
  index("x_roster_signals_stage_idx").on(t.stage),
  index("x_roster_signals_team_id_idx").on(t.teamId),
  index("x_roster_signals_tweeted_at_idx").on(t.tweetedAt),
  index("x_roster_signals_review_topic_idx").on(t.reviewTopic),
]);
