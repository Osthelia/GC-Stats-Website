/**
 * GC-Stats - notification-categories
 *
 * Notification type/category constants. Neutral (no `db` import), safe to
 * import from client components: a client component must never import a
 * value from a lib/* file that touches `db`, or `pg` gets pulled into the
 * client bundle and breaks the build.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

// "change_request.withdrawn" is kept for type completeness (schema/UI switch
// statements) but is never emitted by lib/notify.ts — a withdrawal is
// user-initiated, there is no one else left to notify.
// "discord.dm_blocked" is never sent as a Discord DM itself (lib/notify.ts
// skips it explicitly) — it exists to tell the user, in-app/by email, that
// their Discord DMs are closed, sending it over Discord would just fail the
// same way and loop.
// "forum.reply"/"forum.mention"/"forum.reaction" are the "social" category's
// real triggers (réactions/réponses/mentions, see decision log) — a reply to
// a forum message, an `@username` mention in one, or a reaction added to one.
export type NotificationType =
  | "sanction.issued"
  | "change_request.comment"
  | "change_request.accepted"
  | "change_request.rejected"
  | "change_request.partial"
  | "change_request.withdrawn"
  | "report.resolved"
  | "discord.dm_blocked"
  | "forum.reply"
  | "forum.mention"
  | "forum.reaction";

export type EmailCategory = "sanction" | "change_request" | "report" | "social";

export const EMAIL_CATEGORIES: readonly EmailCategory[] = ["sanction", "change_request", "report", "social"];
