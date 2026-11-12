/**
 * GC-Stats - team requests module
 *
 * Information requests sent to teams (logo, socials, roster check), tracked
 * from the moment the message is prepared until the team answered.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { sql } from "drizzle-orm";
import { pgTable, bigserial, bigint, text, jsonb, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { valTeams } from "./game-tables";
import { users } from "./auth";

export const teamInfoRequests = pgTable("team_info_requests", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  teamId: bigint("team_id", { mode: "number" }).notNull().references(() => valTeams.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("pending"), // 'pending' | 'done'
  // Items flagged red when the message was prepared: 'logo', a social key, 'roster'.
  items: jsonb("items").$type<string[]>().notNull().default([]),
  message: text("message").notNull(),
  contactKind: text("contact_kind").notNull(), // 'organization' | 'manager' | 'coach'
  contactChannel: text("contact_channel").notNull(), // 'twitter' | 'website' | 'discord'
  contactValue: text("contact_value").notNull(),
  contactLabel: text("contact_label").notNull(),
  createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, (t) => [
  index("team_info_requests_team_id_idx").on(t.teamId),
  index("team_info_requests_status_idx").on(t.status),
  index("team_info_requests_created_by_idx").on(t.createdBy),
  uniqueIndex("team_info_requests_one_pending_idx").on(t.teamId).where(sql`${t.status} = 'pending'`),
]);

// Private email of a team, used only to contact it. Kept apart from `teams` on purpose: that table is read
// whole by public pages and the API, so a column there could leak. Only admin code reads this table.
export const teamPrivateContacts = pgTable("team_private_contacts", {
  teamId: bigint("team_id", { mode: "number" }).primaryKey().references(() => valTeams.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
