/**
 * GC-Stats — 11-community-content
 *
 * Migrates V1's community/content tables (about, emotes, forum threads and
 * messages, change requests, user reports, sanctions, moderation, activity
 * log) into V2. Resolves polymorphic subject/causer references (V1 morphMap
 * aliases or Eloquent class names) through the id-map, leaving unresolvable
 * ones (e.g. User) with the raw type kept but the id left unresolved.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, eq } from "drizzle-orm";
import { db, v1 } from "./connection";
import { tryMappedId, setMappedId, preloadEntityType, batchInsert } from "./id-map";
import {
  aboutSections, aboutProjects, emotes, forumThreads, forumMessages,
  changeRequests, changeRequestItems, changeRequestMessages, userReports,
  sanctions, sanctionIdentities, moderationSuspects, activityLog,
} from "../../src/schema";

function parseJson<T>(val: unknown, fallback: T): T {
  if (val == null) return fallback;
  if (typeof val === "object") return val as T;
  try { return JSON.parse(val as string); } catch { return fallback; }
}

// Resolves a V1 polymorphic type string (Relation::morphMap alias, e.g.
// 'team', or a full Eloquent class name, e.g. 'App\Models\Matchs') to the
// migration_id_map entityType that can look up its new V2 id. Shared by
// forum_threads.subject / activity_log.subject+causer — both store the same
// kind of value. Returns null for types this migration never creates a V2
// row for (User/SocialAccount/NewsImage/AboutTeamMember/ApiKey — auth and
// file-backed data, out of scope, see README) — callers keep the log entry
// but leave its id unresolved rather than drop it.
const MORPH_TO_ENTITY_TYPE: Record<string, string> = {
  team: "team",
  player: "player",
  tournament: "tournament",
  author: "news_author",
  publisher: "news_publisher",
  "App\\Models\\Matchs": "match",
  "App\\Models\\GameMap": "map",
  "App\\Models\\News": "news",
  "App\\Models\\TournamentPhase": "phase_as_container",
  "App\\Models\\FinanceEntry": "finance_entry",
  "App\\Models\\StreamChannel": "stream_channel",
  "App\\Models\\PointType": "point_type",
  "App\\Models\\Emote": "emote",
  "App\\Models\\ChangeRequest": "change_request",
  "App\\Models\\ForumMessage": "forum_message",
  "App\\Models\\UserReport": "user_report",
  "App\\Models\\AboutSection": "about_section",
  "App\\Models\\User": "__unresolvable_user__", // never migrated, see README
};
const ALL_MORPH_ENTITY_TYPES = [...new Set(Object.values(MORPH_TO_ENTITY_TYPE))].filter((t) => !t.startsWith("__"));

function resolveMorph(type: string | null, legacyId: number | null): { type: string | null; id: string | null } {
  if (!type || legacyId == null) return { type: null, id: null };
  const entityType = MORPH_TO_ENTITY_TYPE[type];
  if (!entityType || entityType.startsWith("__")) return { type, id: null }; // keep raw type for traceability, id unresolved
  const newId = tryMappedId(entityType, legacyId);
  return { type: entityType, id: newId != null ? String(newId) : null };
}

export async function migrateAboutContent() {
  const [sections] = await v1.query<any[]>("SELECT id, `key`, `order`, title, content FROM about_sections");
  const { created: sc } = await batchInsert(
    "about_section", sections as any[], (r) => r.id,
    (r) => ({ key: r.key, order: r.order, title: parseJson(r.title, {}), content: parseJson(r.content, {}) }),
    (tx, values) => tx.insert(aboutSections).values(values as any).returning({ id: aboutSections.id }),
  );
  console.log(`about_sections: ${sc} created`);

  const [projects] = await v1.query<any[]>(
    "SELECT id, name, type, description, url, logo_url, `order`, is_active FROM about_projects"
  );
  const { created: pc } = await batchInsert(
    "about_project", projects as any[], (r) => r.id,
    (r) => ({
      name: r.name, type: r.type ?? "other", description: parseJson(r.description, {}),
      url: r.url, logoUrl: r.logo_url, order: r.order, isActive: !!r.is_active,
    }),
    (tx, values) => tx.insert(aboutProjects).values(values as any).returning({ id: aboutProjects.id }),
  );
  console.log(`about_projects: ${pc} created`);
}

export async function migrateEmotes() {
  const [rows] = await v1.query<any[]>("SELECT id, name, image_path, source, is_active FROM emotes");
  const { created, skipped } = await batchInsert(
    "emote", rows as any[], (r) => r.id,
    (r) => ({ name: r.name, imagePath: r.image_path, source: r.source, isActive: !!r.is_active }),
    (tx, values) => tx.insert(emotes).values(values as any).returning({ id: emotes.id }),
  );
  // Row data only — the actual image files aren't copied (same S3/R2 file
  // migration gap as logos/news_images, see README).
  console.log(`emotes: ${created} created, ${skipped} already migrated`);
}

export async function migrateForum() {
  // Ordered by id: V1's findOrCreateThreadFor is only guaranteed unique per
  // subject going forward, not retroactively — a few legacy threads (e.g. a
  // match thread whose subject resolves to the same tournament as another
  // thread) collide on forum_threads_subject_unique once resolved. Mirrors
  // findOrCreateThreadFor's own onConflictDoNothing + lookup (see
  // apps/web/src/lib/forum-threads.ts) so the earlier thread (by V1 id) wins
  // and every later colliding thread aliases to it instead of crashing the
  // migration.
  const [threads] = await v1.query<any[]>(
    "SELECT id, category, subject_type, subject_id, title, last_message_at FROM forum_threads ORDER BY id"
  );
  await preloadEntityType("forum_thread");
  let tc = 0, tAliased = 0;
  for (const r of threads as any[]) {
    if (tryMappedId("forum_thread", r.id)) continue;
    const subject = resolveMorph(r.subject_type, r.subject_id);
    const subjectId = subject.id != null ? Number(subject.id) : null;
    const [inserted] = await db.insert(forumThreads).values({
      category: r.category,
      subjectType: subject.type,
      subjectId,
      title: r.title,
      createdBy: null, // users not migrated, see README
      lastMessageAt: r.last_message_at,
    }).onConflictDoNothing({ target: [forumThreads.subjectType, forumThreads.subjectId] })
      .returning({ id: forumThreads.id });
    if (inserted) {
      await setMappedId("forum_thread", r.id, inserted.id);
      tc++;
    } else {
      const [existing] = await db.select({ id: forumThreads.id }).from(forumThreads)
        .where(and(eq(forumThreads.subjectType, subject.type!), eq(forumThreads.subjectId, subjectId!)))
        .limit(1);
      await setMappedId("forum_thread", r.id, existing!.id);
      tAliased++;
    }
  }
  console.log(`forum_threads: ${tc} created, ${tAliased} duplicate subject aliased to existing thread`);

  // Ordered by id: parent_id always points at an earlier row (Laravel
  // autoincrement) — each row's mapping is written before the next row
  // needs it.
  const [messages] = await v1.query<any[]>(
    "SELECT id, thread_id, parent_id, body, hidden_at, created_at, deleted_at FROM forum_messages ORDER BY id"
  );
  await preloadEntityType("forum_message");
  let mc = 0, mSkipped = 0, mInvalid = 0;
  for (const r of messages as any[]) {
    if (tryMappedId("forum_message", r.id)) { mSkipped++; continue; }
    const threadId = tryMappedId("forum_thread", r.thread_id);
    if (!threadId) { mInvalid++; continue; }
    const parentId = r.parent_id ? tryMappedId("forum_message", r.parent_id) ?? null : null;
    const [inserted] = await db.insert(forumMessages).values({
      threadId, userId: null, parentId, body: r.body,
      hiddenAt: r.hidden_at, deletedAt: r.deleted_at, createdAt: r.created_at,
    }).returning({ id: forumMessages.id });
    await setMappedId("forum_message", r.id, inserted.id);
    mc++;
  }
  console.log(`forum_messages: ${mc} created, ${mSkipped} already migrated, ${mInvalid} unresolved thread`);
}

export async function migrateChangeRequests() {
  await preloadEntityType("player");
  const [requests] = await v1.query<any[]>(
    "SELECT id, subject_type, subject_id, reason, status, closed_at, sanctioned_at, created_at FROM change_requests"
  );
  const { created: rc, invalid: ri } = await batchInsert(
    "change_request", requests as any[], (r) => r.id,
    (r) => {
      const subject = resolveMorph(r.subject_type, r.subject_id);
      if (!subject.id) return null; // real data is 100% subject_type='player' — an unresolved one is a genuine data problem, skip rather than guess
      return {
        subjectType: subject.type, subjectId: Number(subject.id),
        requestedBy: null, reason: r.reason, status: r.status,
        closedBy: null, closedAt: r.closed_at, sanctionedAt: r.sanctioned_at,
        createdAt: r.created_at,
      };
    },
    (tx, values) => tx.insert(changeRequests).values(values as any).returning({ id: changeRequests.id }),
  );
  console.log(`change_requests: ${rc} created, ${ri} invalid`);

  await preloadEntityType("change_request");
  const [items] = await v1.query<any[]>(
    `SELECT id, change_request_id, field, old_value, new_value, status,
            resolved_at, resolution_note, applied_at, apply_error
     FROM change_request_items`
  );
  const { created: ic, invalid: ii } = await batchInsert(
    "change_request_item", items as any[], (r) => r.id,
    (r) => {
      const changeRequestId = tryMappedId("change_request", r.change_request_id);
      if (!changeRequestId) return null;
      return {
        changeRequestId, field: r.field,
        oldValue: r.old_value != null ? parseJson(r.old_value, null) : null,
        newValue: r.new_value != null ? parseJson(r.new_value, null) : null,
        status: r.status, resolvedBy: null, resolvedAt: r.resolved_at,
        resolutionNote: r.resolution_note, appliedAt: r.applied_at, applyError: r.apply_error,
      };
    },
    (tx, values) => tx.insert(changeRequestItems).values(values as any).returning({ id: changeRequestItems.id }),
  );
  console.log(`change_request_items: ${ic} created, ${ii} unresolved change_request`);

  const [msgRows] = await v1.query<any[]>(
    "SELECT id, change_request_id, type, body, edited_at FROM change_request_messages"
  );
  const { created: mc, invalid: mi } = await batchInsert(
    "change_request_message", msgRows as any[], (r) => r.id,
    (r) => {
      const changeRequestId = tryMappedId("change_request", r.change_request_id);
      if (!changeRequestId) return null;
      return { changeRequestId, userId: null, type: r.type, body: r.body, editedAt: r.edited_at };
    },
    (tx, values) => tx.insert(changeRequestMessages).values(values as any).returning({ id: changeRequestMessages.id }),
  );
  console.log(`change_request_messages: ${mc} created, ${mi} unresolved change_request`);
}

export async function migrateUserReports() {
  await preloadEntityType("forum_message");
  const [rows] = await v1.query<any[]>(
    `SELECT id, category, reason, status, resolution_note, reviewed_at,
            reported_message_id, reactable_type, reactable_id, emote_id
     FROM user_reports`
  );
  const { created, skipped } = await batchInsert(
    "user_report", rows as any[], (r) => r.id,
    (r) => ({
      // reporterId/reportedUserId/reviewedBy: users not migrated, see README.
      reporterId: null, reportedUserId: null,
      reportedMessageId: r.reported_message_id ? tryMappedId("forum_message", r.reported_message_id) ?? null : null,
      // reactableType/Id: null in every real V1 row (see README) — passed
      // through as raw V1 ids if that ever changes, since `reactable` isn't
      // one of the domains this migration tracks a full id-map for.
      reactableType: r.reactable_type, reactableId: r.reactable_id,
      emoteId: r.emote_id ? tryMappedId("emote", r.emote_id) ?? null : null,
      // organizationId: V1's equivalent column is team_id, a different
      // domain concept (team, not publisher/org) — not a sound mapping, left
      // null, see README.
      organizationId: null,
      category: r.category, reason: r.reason, status: r.status,
      reviewedBy: null, reviewedAt: r.reviewed_at, resolutionNote: r.resolution_note,
    }),
    (tx, values) => tx.insert(userReports).values(values as any).returning({ id: userReports.id }),
  );
  console.log(`user_reports: ${created} created, ${skipped} already migrated`);
}

export async function migrateSanctions() {
  const [rows] = await v1.query<any[]>(
    "SELECT id, type, reason, starts_at, ends_at, revoked_at, transferred_from FROM sanctions"
  );
  const { created } = await batchInsert(
    "sanction", rows as any[], (r) => r.id,
    (r) => ({
      // userId/issuedBy/revokedBy: users not migrated, see README. teamId
      // dropped too: V1 rows are 0 today, not worth resolving speculatively.
      userId: null, teamId: null, issuedBy: null, type: r.type, reason: r.reason,
      startsAt: r.starts_at, endsAt: r.ends_at, revokedAt: r.revoked_at,
      revokedBy: null, transferredFrom: r.transferred_from ? tryMappedId("sanction", r.transferred_from) ?? null : null,
    }),
    (tx, values) => tx.insert(sanctions).values(values as any).returning({ id: sanctions.id }),
  );
  console.log(`sanctions: ${created} created (V1 has 0 rows today)`);

  await preloadEntityType("sanction");
  const [idRows] = await v1.query<any[]>("SELECT id, sanction_id, type, value FROM sanction_identities");
  const { created: ic } = await batchInsert(
    "sanction_identity", idRows as any[], (r) => r.id,
    (r) => {
      const sanctionId = tryMappedId("sanction", r.sanction_id);
      if (!sanctionId) return null;
      return { sanctionId, type: r.type, value: r.value };
    },
    (tx, values) => tx.insert(sanctionIdentities).values(values as any).returning({ id: sanctionIdentities.id }),
  );
  console.log(`sanction_identities: ${ic} created (V1 has 0 rows today)`);
}

export async function migrateModerationSuspects() {
  await preloadEntityType("forum_thread");
  // 'source' column existed briefly (0128) then got dropped (0129, current
  // V1 schema: auto-moderation is OpenAI-only, a single always-'openai'
  // value added nothing) — not selected here for that reason.
  const [rows] = await v1.query<any[]>(
    `SELECT id, subject_type, subject_id, thread_id, matched_term,
            body_snapshot, status, reviewed_at
     FROM moderation_suspects`
  );
  const { created } = await batchInsert(
    "moderation_suspect", rows as any[], (r) => r.id,
    (r) => {
      const subject = resolveMorph(r.subject_type, r.subject_id);
      return {
        source: null, subjectType: subject.type, subjectId: subject.id != null ? Number(subject.id) : null,
        threadId: r.thread_id ? tryMappedId("forum_thread", r.thread_id) ?? null : null,
        userId: null, matchedTerm: r.matched_term, bodySnapshot: r.body_snapshot,
        status: r.status, reviewedBy: null, reviewedAt: r.reviewed_at,
      };
    },
    (tx, values) => tx.insert(moderationSuspects).values(values as any).returning({ id: moderationSuspects.id }),
  );
  console.log(`moderation_suspects: ${created} created (V1 has 0 rows today)`);
}

export async function migrateActivityLog() {
  for (const t of ALL_MORPH_ENTITY_TYPES) await preloadEntityType(t);
  const [rows] = await v1.query<any[]>(
    `SELECT id, log_name, description, subject_type, subject_id, event,
            causer_type, causer_id, attribute_changes, properties, created_at
     FROM activity_log`
  );
  const { created, skipped } = await batchInsert(
    "activity_log", rows as any[], (r) => r.id,
    (r) => {
      const subject = resolveMorph(r.subject_type, r.subject_id);
      // causer is 'App\Models\User' or null in 100% of V1 rows (verified) —
      // users aren't migrated, so causerId is always unresolvable. Kept as
      // a normalized "user" label (not the raw class name) rather than
      // dropped, so a reader still knows a human did this, just not who.
      const causerType = r.causer_type ? "user" : null;
      return {
        logName: r.log_name, description: r.description,
        subjectType: subject.type, subjectId: subject.id,
        event: r.event, causerType, causerId: null,
        attributeChanges: r.attribute_changes != null ? parseJson(r.attribute_changes, null) : null,
        properties: r.properties != null ? parseJson(r.properties, null) : null,
        createdAt: r.created_at,
      };
    },
    (tx, values) => tx.insert(activityLog).values(values as any).returning({ id: activityLog.id }),
    1000,
  );
  console.log(`activity_log: ${created} created, ${skipped} already migrated`);
}
