/**
 * GC-Stats — notifications module
 *
 * The `notifications` table: user-facing notifications stored as a type +
 * jsonb payload, rendered via next-intl at read time rather than persisted
 * pre-translated.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { pgTable, bigserial, text, varchar, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { users } from "./auth";

// type + data (jsonb) plutot que du texte fige : le titre/la description
// sont rendus a l'affichage via next-intl, jamais stockes traduits (sinon
// un moderateur FR pourrait figer une notif en francais pour un user EN).
export const notifications = pgTable(
  "notifications",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    authorId: text("author_id").references(() => users.id, { onDelete: "set null" }),
    type: varchar("type", { length: 50 }).notNull(),
    data: jsonb("data").notNull().default({}),
    link: text("link"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notifications_user_read_idx").on(t.userId, t.readAt)],
);
