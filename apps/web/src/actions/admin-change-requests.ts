/**
 * GC-Stats - admin-change-requests
 *
 * Admin server actions reviewing and resolving user-submitted change
 * requests (team/person profile edits). Applying an approved item re-checks
 * that the referenced row still exists rather than trusting the submit-time
 * snapshot.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use server";

import { and, eq, ne, isNull, sql } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { changeRequests, changeRequestItems, teams, people, rosterMemberships, teamNameHistory, logos, PERMISSIONS } from "@gc-stats/db";
import { deleteLogoFiles } from "@gc-stats/storage";
import { requireActorPermission } from "@/lib/rbac";
import { openRangeFrom, closeRange } from "@/lib/daterange";
import { ROSTER_ROLES } from "@/lib/change-request-fields";
import { notify, type NotificationType } from "@/lib/notify";

type ItemStatus = "approved" | "rejected" | "failed";
export type ResolveItemResult = { ok: true; status: ItemStatus; applyError: string | null } | { ok: false; error: string };

const TEAM_COLUMNS = ["name", "shortName", "countryCode", "secondaryCountryCode", "bio", "liquipediaLink", "isActive", "tags"] as const;
const PERSON_COLUMNS = ["handle", "firstName", "lastName", "countryCode", "secondaryCountryCode", "bio", "liquipediaLink", "isActive", "aliases", "pronouns"] as const;

/**
 * Applies one already-validated change_request_items row to the live
 * tables — called only after the item is confirmed "approved" (see
 * resolveChangeRequestItem below). Re-checks existence of every row it
 * touches (a referenced person/team/membership/logo/name-history entry may
 * have been deleted between submission and review) rather than trusting the
 * snapshot taken at submit time. Throws a plain Error with a short message
 * on failure — caught by the caller and stored in applyError.
 */
async function applyChangeRequestItem(subjectType: "team" | "person", subjectId: number, field: string, oldValue: unknown, newValue: unknown): Promise<void> {
  // --- Simple profile columns (including socials.<key>) -------------------
  if (field.startsWith("socials.")) {
    const key = field.slice("socials.".length);
    const table = subjectType === "team" ? teams : people;
    const [row] = await db.select({ socials: table.socials }).from(table).where(eq(table.id, subjectId)).limit(1);
    if (!row) throw new Error("subjectNotFound");
    const socials = { ...(row.socials as Record<string, unknown>), [key]: newValue ?? null };
    await db.update(table).set({ socials }).where(eq(table.id, subjectId));
    return;
  }

  const columns = subjectType === "team" ? (TEAM_COLUMNS as readonly string[]) : (PERSON_COLUMNS as readonly string[]);
  if (columns.includes(field)) {
    const table = subjectType === "team" ? teams : people;
    const exists = (await db.select({ id: table.id }).from(table).where(eq(table.id, subjectId)).limit(1)).length > 0;
    if (!exists) throw new Error("subjectNotFound");
    let value: unknown = newValue;
    if (field === "pronouns") value = newValue === null ? null : Number(newValue);
    await db.update(table).set({ [field]: value }).where(eq(table.id, subjectId));
    return;
  }

  // --- Roster-mismatch auto-detection (a separate producer from the public
  // suggest-edit form's membership_* ops above — see change-request-item-card.tsx
  // for how this shape was discovered in real prod data). subjectType is
  // always "person" here; moves the person onto their newly-detected team as
  // of joined_at, closing whatever else is open for that (person, role) pair.
  if (field === "roster") {
    const v = newValue as { role: string; team_id: number; joined_at: string; team_name?: string };
    if (!(ROSTER_ROLES as readonly string[]).includes(v.role)) throw new Error("invalidRole");
    const [team] = await db.select({ id: teams.id }).from(teams).where(eq(teams.id, v.team_id)).limit(1);
    if (!team) throw new Error("entityNotFound");

    const period = openRangeFrom(v.joined_at);
    await db.transaction(async (tx) => {
      const openElsewhere = await tx
        .select({ id: rosterMemberships.id, period: rosterMemberships.period })
        .from(rosterMemberships)
        .where(and(eq(rosterMemberships.personId, subjectId), eq(rosterMemberships.role, v.role), sql`${rosterMemberships.period} @> CURRENT_DATE`));
      for (const row of openElsewhere) {
        await tx.update(rosterMemberships).set({ period: closeRange(row.period, v.joined_at) }).where(eq(rosterMemberships.id, row.id));
      }
      await tx.insert(rosterMemberships).values({ personId: subjectId, teamId: v.team_id, role: v.role, period, inactiveSince: null });
    });
    return;
  }

  // --- Roster / team-history membership rows -------------------------------
  if (field === "membership_add") {
    const v = newValue as { personId: number; teamId: number; role: string; since: string; until: string | null; inactiveSince: string | null };
    if (!(ROSTER_ROLES as readonly string[]).includes(v.role)) throw new Error("invalidRole");
    const [person] = await db.select({ id: people.id }).from(people).where(eq(people.id, v.personId)).limit(1);
    const [team] = await db.select({ id: teams.id }).from(teams).where(eq(teams.id, v.teamId)).limit(1);
    if (!person || !team) throw new Error("entityNotFound");

    const period = v.until ? `[${v.since},${v.until})` : openRangeFrom(v.since);
    const isOngoing = !v.until;
    await db.transaction(async (tx) => {
      if (isOngoing) {
        const openElsewhere = await tx
          .select({ id: rosterMemberships.id, period: rosterMemberships.period })
          .from(rosterMemberships)
          .where(and(eq(rosterMemberships.personId, v.personId), eq(rosterMemberships.role, v.role), sql`${rosterMemberships.period} @> CURRENT_DATE`));
        for (const row of openElsewhere) {
          await tx.update(rosterMemberships).set({ period: closeRange(row.period, v.since) }).where(eq(rosterMemberships.id, row.id));
        }
      }
      await tx.insert(rosterMemberships).values({ personId: v.personId, teamId: v.teamId, role: v.role, period, inactiveSince: v.inactiveSince });
    });
    return;
  }

  if (field === "membership_edit") {
    const v = newValue as { membershipId: number; role: string; since: string; until: string | null; inactiveSince: string | null };
    if (!(ROSTER_ROLES as readonly string[]).includes(v.role)) throw new Error("invalidRole");
    const [membership] = await db.select({ id: rosterMemberships.id, personId: rosterMemberships.personId }).from(rosterMemberships).where(eq(rosterMemberships.id, v.membershipId)).limit(1);
    if (!membership) throw new Error("membershipNotFound");

    const period = v.until ? `[${v.since},${v.until})` : openRangeFrom(v.since);
    const isOngoing = !v.until;
    await db.transaction(async (tx) => {
      if (isOngoing) {
        const openElsewhere = await tx
          .select({ id: rosterMemberships.id, period: rosterMemberships.period })
          .from(rosterMemberships)
          .where(and(eq(rosterMemberships.personId, membership.personId), eq(rosterMemberships.role, v.role), sql`${rosterMemberships.period} @> CURRENT_DATE`, ne(rosterMemberships.id, v.membershipId)));
        for (const row of openElsewhere) {
          await tx.update(rosterMemberships).set({ period: closeRange(row.period, v.since) }).where(eq(rosterMemberships.id, row.id));
        }
      }
      await tx.update(rosterMemberships).set({ role: v.role, period, inactiveSince: v.inactiveSince }).where(eq(rosterMemberships.id, v.membershipId));
    });
    return;
  }

  if (field === "membership_delete") {
    const v = oldValue as { membershipId: number };
    const [membership] = await db.select({ id: rosterMemberships.id }).from(rosterMemberships).where(eq(rosterMemberships.id, v.membershipId)).limit(1);
    if (!membership) throw new Error("membershipNotFound");
    await db.delete(rosterMemberships).where(eq(rosterMemberships.id, v.membershipId));
    return;
  }

  // --- Team name history ----------------------------------------------------
  if (field === "name_history_add") {
    const v = newValue as { name: string; since: string; until: string | null };
    const period = v.until ? `[${v.since},${v.until})` : openRangeFrom(v.since);
    await db.insert(teamNameHistory).values({ teamId: subjectId, name: v.name, period });
    return;
  }
  if (field === "name_history_toggle") {
    const v = newValue as { id: number; isVisible: boolean };
    const [entry] = await db.select({ id: teamNameHistory.id }).from(teamNameHistory).where(and(eq(teamNameHistory.id, v.id), eq(teamNameHistory.teamId, subjectId))).limit(1);
    if (!entry) throw new Error("nameHistoryNotFound");
    await db.update(teamNameHistory).set({ isVisible: v.isVisible }).where(eq(teamNameHistory.id, v.id));
    return;
  }
  if (field === "name_history_delete") {
    const v = oldValue as { id: number };
    const [entry] = await db.select({ id: teamNameHistory.id }).from(teamNameHistory).where(and(eq(teamNameHistory.id, v.id), eq(teamNameHistory.teamId, subjectId))).limit(1);
    if (!entry) throw new Error("nameHistoryNotFound");
    await db.delete(teamNameHistory).where(eq(teamNameHistory.id, v.id));
    return;
  }

  // --- Logo history -----------------------------------------------------
  if (field === "logo") {
    const v = newValue as { logoId: string; theme: string | null; since: string; until: string | null };
    const period = v.until ? `[${v.since},${v.until})` : openRangeFrom(v.since);
    const isOngoing = !v.until;
    await db.transaction(async (tx) => {
      if (isOngoing) {
        const openElsewhere = await tx
          .select({ id: logos.id, period: logos.period })
          .from(logos)
          .where(and(eq(logos.entityType, subjectType), eq(logos.entityId, subjectId), v.theme ? eq(logos.theme, v.theme) : isNull(logos.theme), sql`${logos.period} @> CURRENT_TIMESTAMP`));
        for (const row of openElsewhere) {
          await tx.update(logos).set({ period: closeRange(row.period, v.since) }).where(eq(logos.id, row.id));
        }
      }
      await tx.insert(logos).values({ id: v.logoId, entityType: subjectType, entityId: subjectId, period, theme: v.theme, isVisible: true });
    });
    return;
  }
  if (field === "logo_edit") {
    const v = newValue as { logoId: string; theme: string | null; since: string; until: string | null };
    const [existing] = await db.select({ id: logos.id, entityId: logos.entityId }).from(logos).where(and(eq(logos.id, v.logoId), eq(logos.entityType, subjectType))).limit(1);
    if (!existing) throw new Error("logoNotFound");
    const period = v.until ? `[${v.since},${v.until})` : openRangeFrom(v.since);
    const isOngoing = !v.until;
    await db.transaction(async (tx) => {
      if (isOngoing) {
        const openElsewhere = await tx
          .select({ id: logos.id, period: logos.period })
          .from(logos)
          .where(
            and(
              eq(logos.entityType, subjectType),
              eq(logos.entityId, existing.entityId),
              v.theme ? eq(logos.theme, v.theme) : isNull(logos.theme),
              ne(logos.id, v.logoId),
              sql`${logos.period} @> CURRENT_TIMESTAMP`
            )
          );
        for (const row of openElsewhere) {
          await tx.update(logos).set({ period: closeRange(row.period, v.since) }).where(eq(logos.id, row.id));
        }
      }
      await tx.update(logos).set({ theme: v.theme, period }).where(eq(logos.id, v.logoId));
    });
    return;
  }
  if (field === "logo_delete") {
    const v = oldValue as { logoId: string };
    const [existing] = await db.select({ id: logos.id }).from(logos).where(and(eq(logos.id, v.logoId), eq(logos.entityType, subjectType))).limit(1);
    if (!existing) throw new Error("logoNotFound");
    await db.delete(logos).where(eq(logos.id, v.logoId));
    await deleteLogoFiles(subjectType, v.logoId).catch(() => {});
    return;
  }

  // --- Account <-> player link (OAuth "link_player" scope producer, see
  // app/api/oauth/link-player/route.ts) -----------------------------------
  if (field === "user_link") {
    const v = newValue as { userId: string; previousPersonId: number | null };
    await db.transaction(async (tx) => {
      const [target] = await tx.select({ id: people.id, userId: people.userId }).from(people).where(eq(people.id, subjectId)).limit(1);
      if (!target) throw new Error("subjectNotFound");
      if (target.userId && target.userId !== v.userId) throw new Error("alreadyLinked");
      if (v.previousPersonId) {
        await tx.update(people).set({ userId: null }).where(and(eq(people.id, v.previousPersonId), eq(people.userId, v.userId)));
      }
      await tx.update(people).set({ userId: v.userId }).where(eq(people.id, subjectId));
    });
    return;
  }

  throw new Error("unknownField");
}

const STATUS_NOTIFICATION_TYPE: Record<"approved" | "rejected" | "partial", NotificationType> = {
  approved: "change_request.accepted",
  rejected: "change_request.rejected",
  partial: "change_request.partial",
};

async function recomputeChangeRequestStatus(changeRequestId: number, actorUserId: string, requestedBy: string | null): Promise<void> {
  const items = await db.select({ status: changeRequestItems.status }).from(changeRequestItems).where(eq(changeRequestItems.changeRequestId, changeRequestId));
  const pending = items.some((i) => i.status === "pending");
  if (pending) return; // still awaiting review, leave changeRequests.status as "pending"

  const approvedCount = items.filter((i) => i.status === "approved").length;
  const status = approvedCount === 0 ? "rejected" : approvedCount === items.length ? "approved" : "partial";
  await db.update(changeRequests).set({ status, closedBy: actorUserId, closedAt: new Date() }).where(eq(changeRequests.id, changeRequestId));

  if (requestedBy) {
    await notify({ recipientId: requestedBy, type: STATUS_NOTIFICATION_TYPE[status], authorId: actorUserId, link: `/settings/change-requests/${changeRequestId}`, data: { changeRequestId } });
  }
}

/**
 * Approves or rejects a single change_request_items row. On approve, applies
 * the diff to the live tables inside this same call — a failed apply (e.g.
 * the referenced row was deleted since submission) marks the item "failed"
 * with the error recorded, rather than silently leaving it pending forever.
 * Recomputes the parent change_requests.status once every item is resolved.
 */
export async function resolveChangeRequestItem(itemId: number, action: "approve" | "reject", note: string): Promise<ResolveItemResult> {
  const access = await requireActorPermission(PERMISSIONS.changeRequestsManage);

  const [item] = await db.select().from(changeRequestItems).where(eq(changeRequestItems.id, itemId)).limit(1);
  if (!item) return { ok: false, error: "notFound" };
  if (item.status !== "pending") return { ok: false, error: "alreadyResolved" };

  const [request] = await db.select().from(changeRequests).where(eq(changeRequests.id, item.changeRequestId)).limit(1);
  if (!request) return { ok: false, error: "notFound" };
  // The requester can withdraw a still-pending request (see actions/change-requests.ts)
  // between item submission and review — a withdrawn request has nothing left to approve.
  if (request.status !== "pending") return { ok: false, error: "alreadyResolved" };

  const trimmedNote = note.trim().slice(0, 500) || null;

  let status: ItemStatus = "rejected";
  let applyError: string | null = null;

  if (action === "approve") {
    try {
      await applyChangeRequestItem(request.subjectType as "team" | "person", request.subjectId, item.field, item.oldValue, item.newValue);
      status = "approved";
    } catch (error) {
      status = "failed";
      applyError = error instanceof Error ? error.message : "unknown";
    }
  }

  await db
    .update(changeRequestItems)
    .set({
      status,
      resolvedBy: access.userId,
      resolvedAt: new Date(),
      resolutionNote: trimmedNote,
      appliedAt: status === "approved" ? new Date() : null,
      applyError,
    })
    .where(eq(changeRequestItems.id, itemId));

  await recomputeChangeRequestStatus(item.changeRequestId, access.userId, request.requestedBy);

  return { ok: true, status, applyError };
}

export type BulkResolveResult = { itemId: number; result: ResolveItemResult }[];

/** Resolves every currently-pending item of one change request the same way — the "approve all"/"reject all" bulk action. */
export async function resolveAllPendingItems(changeRequestId: number, action: "approve" | "reject", note = ""): Promise<BulkResolveResult> {
  await requireActorPermission(PERMISSIONS.changeRequestsManage);

  const pendingItems = await db
    .select({ id: changeRequestItems.id })
    .from(changeRequestItems)
    .where(and(eq(changeRequestItems.changeRequestId, changeRequestId), eq(changeRequestItems.status, "pending")));

  const results: BulkResolveResult = [];
  for (const item of pendingItems) {
    results.push({ itemId: item.id, result: await resolveChangeRequestItem(item.id, action, note) });
  }
  return results;
}
