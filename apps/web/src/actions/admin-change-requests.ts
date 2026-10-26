/**
 * GC-Stats - admin-change-requests
 *
 * Admin server actions reviewing and resolving user-submitted change
 * requests (team/person profile edits). Applying an approved item re-checks
 * that the referenced row still exists rather than trusting the submit-time
 * snapshot.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use server";

import { and, eq, ne, isNull, sql } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { changeRequests, changeRequestItems, teams, people, rosterMemberships, teamNameHistory, logos, PERMISSIONS } from "@gc-stats/db";
import { deleteLogoFiles } from "@gc-stats/storage";
import { requireActorPermission } from "@/lib/rbac";
import { openRangeFrom, closeRange } from "@/lib/daterange";
import { closeOpenMemberships } from "@/lib/roster-close";
import { ROSTER_SOURCE_TEXTS, normalizeRosterSource, validateRosterSource } from "@/lib/roster-source";
import { ROSTER_ROLES } from "@/lib/change-request-fields";
import { notify, type NotificationType } from "@/lib/notify";
import { logActivity } from "@/lib/activity-log";

type ItemStatus = "approved" | "rejected" | "failed";
export type ResolveItemResult = { ok: true; status: ItemStatus; applyError: string | null } | { ok: false; error: string };

const TEAM_COLUMNS = ["name", "shortName", "countryCode", "secondaryCountryCode", "bio", "liquipediaLink", "liquipediaSourced", "isActive", "tags"] as const;
const PERSON_COLUMNS = ["handle", "firstName", "lastName", "countryCode", "secondaryCountryCode", "bio", "liquipediaLink", "liquipediaSourced", "isActive", "aliases", "pronouns"] as const;

/**
 * Applies one already-validated change_request_items row to the live
 * tables — called only after the item is confirmed "approved" (see
 * resolveChangeRequestItem below). Re-checks existence of every row it
 * touches (a referenced person/team/membership/logo/name-history entry may
 * have been deleted between submission and review) rather than trusting the
 * snapshot taken at submit time. Throws a plain Error with a short message
 * on failure — caught by the caller and stored in applyError.
 */
type RequestContext = { id: number; requestedBy: string | null };

/** True when the request comes from the person themselves: their linked account, or a link to this person accepted in the same request. */
async function isRequestedByPerson(request: RequestContext, personId: number): Promise<boolean> {
  if (!request.requestedBy) return false;
  const [person] = await db.select({ userId: people.userId }).from(people).where(eq(people.id, personId)).limit(1);
  if (person?.userId === request.requestedBy) return true;

  const links = await db
    .select({ newValue: changeRequestItems.newValue })
    .from(changeRequestItems)
    .innerJoin(changeRequests, eq(changeRequests.id, changeRequestItems.changeRequestId))
    .where(and(eq(changeRequestItems.changeRequestId, request.id), eq(changeRequestItems.field, "user_link"), eq(changeRequestItems.status, "approved"), eq(changeRequests.subjectType, "person"), eq(changeRequests.subjectId, personId)));
  return links.some((link) => (link.newValue as { userId?: string } | null)?.userId === request.requestedBy);
}

type MembershipSources = { joinSource: string | null; leftSource: string | null };

/** The given sources, with the player declaration for an empty one when the person made the request (a left source only exists once they left). */
async function membershipSources(request: RequestContext, personId: number, given: { joinSource?: string | null; leftSource?: string | null }, hasLeft: boolean): Promise<MembershipSources> {
  const joinSource = normalizeRosterSource(given.joinSource);
  const leftSource = hasLeft ? normalizeRosterSource(given.leftSource) : null;
  if (!(await isRequestedByPerson(request, personId))) return { joinSource, leftSource };
  return { joinSource: joinSource ?? ROSTER_SOURCE_TEXTS.declaredByPlayer, leftSource: leftSource ?? (hasLeft ? ROSTER_SOURCE_TEXTS.declaredByPlayer : null) };
}

async function applyChangeRequestItem(request: RequestContext, subjectType: "team" | "person", subjectId: number, field: string, oldValue: unknown, newValue: unknown, closeMembershipIds: number[]): Promise<void> {
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
  // of joined_at. Other open entries are closed only when the reviewer chose to.
  if (field === "roster") {
    const v = newValue as { role: string; team_id: number; joined_at: string; team_name?: string };
    if (!(ROSTER_ROLES as readonly string[]).includes(v.role)) throw new Error("invalidRole");
    const [team] = await db.select({ id: teams.id }).from(teams).where(eq(teams.id, v.team_id)).limit(1);
    if (!team) throw new Error("entityNotFound");

    const period = openRangeFrom(v.joined_at);
    await db.transaction(async (tx) => {
      await closeOpenMemberships(tx, closeMembershipIds, subjectId, v.team_id, v.joined_at);
      await tx.insert(rosterMemberships).values({ personId: subjectId, teamId: v.team_id, role: v.role, period, inactiveSince: null, ...(await membershipSources(request, subjectId, {}, false)) });
    });
    return;
  }

  // --- Roster / team-history membership rows -------------------------------
  if (field === "membership_add") {
    const v = newValue as { personId: number; teamId: number; role: string; since: string; until: string | null; hasLeft?: boolean; inactiveSince: string | null; joinSource?: string | null; leftSource?: string | null };
    if (!(ROSTER_ROLES as readonly string[]).includes(v.role)) throw new Error("invalidRole");
    if (validateRosterSource(v.joinSource, "join", { allowSelfDeclared: true }) || validateRosterSource(v.leftSource, "left", { allowSelfDeclared: true })) throw new Error("invalidSource");
    const [person] = await db.select({ id: people.id }).from(people).where(eq(people.id, v.personId)).limit(1);
    const [team] = await db.select({ id: teams.id }).from(teams).where(eq(teams.id, v.teamId)).limit(1);
    if (!person || !team) throw new Error("entityNotFound");

    const period = v.until ? `[${v.since},${v.until})` : openRangeFrom(v.since);
    const hasLeft = v.hasLeft ?? !!v.until;
    const isOngoing = !hasLeft;
    await db.transaction(async (tx) => {
      if (isOngoing) await closeOpenMemberships(tx, closeMembershipIds, v.personId, v.teamId, v.since);
      await tx.insert(rosterMemberships).values({ personId: v.personId, teamId: v.teamId, role: v.role, period, hasLeft, inactiveSince: v.inactiveSince, ...(await membershipSources(request, v.personId, v, hasLeft)) });
    });
    return;
  }

  if (field === "membership_edit") {
    const v = newValue as { membershipId: number; role: string; since: string; until: string | null; hasLeft?: boolean; inactiveSince: string | null; joinSource?: string | null; leftSource?: string | null };
    if (!(ROSTER_ROLES as readonly string[]).includes(v.role)) throw new Error("invalidRole");
    if (validateRosterSource(v.joinSource, "join", { allowSelfDeclared: true }) || validateRosterSource(v.leftSource, "left", { allowSelfDeclared: true })) throw new Error("invalidSource");
    const [membership] = await db.select({ id: rosterMemberships.id, personId: rosterMemberships.personId, teamId: rosterMemberships.teamId, hasLeft: rosterMemberships.hasLeft }).from(rosterMemberships).where(eq(rosterMemberships.id, v.membershipId)).limit(1);
    if (!membership) throw new Error("membershipNotFound");

    const period = v.until ? `[${v.since},${v.until})` : openRangeFrom(v.since);
    const hasLeft = v.hasLeft ?? (!!v.until || membership.hasLeft);
    const isOngoing = !hasLeft;
    await db.transaction(async (tx) => {
      if (isOngoing) await closeOpenMemberships(tx, closeMembershipIds, membership.personId, membership.teamId, v.since);
      await tx.update(rosterMemberships).set({ role: v.role, period, hasLeft, inactiveSince: v.inactiveSince, ...(await membershipSources(request, membership.personId, v, hasLeft)) }).where(eq(rosterMemberships.id, v.membershipId));
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
export async function resolveChangeRequestItem(itemId: number, action: "approve" | "reject", note: string, closeMembershipIds: number[] = []): Promise<ResolveItemResult> {
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
      await applyChangeRequestItem({ id: request.id, requestedBy: request.requestedBy }, request.subjectType as "team" | "person", request.subjectId, item.field, item.oldValue, item.newValue, closeMembershipIds);
      status = "approved";
      await logActivity({
        subject: request.subjectType === "team" ? "team" : "player",
        subjectId: request.subjectId,
        event: "updated",
        description: `Applied change request #${request.id} (${item.field}) on ${request.subjectType === "team" ? "team" : "player"} #${request.subjectId}`,
        actorUserId: access.userId,
        changes: { [item.field]: { old: item.oldValue, new: item.newValue } },
        properties: { section: "changeRequest", changeRequestId: request.id, itemId, requestedBy: request.requestedBy },
      });
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

export type ItemRosterTarget = { handle: string; personId: number; teamId: number; excludeMembershipId?: number } | null;

/** Person and team an item would put on a current roster entry, to look for other current entries before approving. Null when the item doesn't open one. */
export async function getItemRosterTarget(itemId: number): Promise<ItemRosterTarget> {
  await requireActorPermission(PERMISSIONS.changeRequestsManage);

  const [row] = await db
    .select({ field: changeRequestItems.field, newValue: changeRequestItems.newValue, subjectId: changeRequests.subjectId })
    .from(changeRequestItems)
    .innerJoin(changeRequests, eq(changeRequests.id, changeRequestItems.changeRequestId))
    .where(eq(changeRequestItems.id, itemId))
    .limit(1);
  if (!row) return null;

  let personId: number;
  let teamId: number;
  let excludeMembershipId: number | undefined;
  let hasLeft = false;

  if (row.field === "roster") {
    const v = row.newValue as { team_id: number };
    personId = row.subjectId;
    teamId = v.team_id;
  } else if (row.field === "membership_add") {
    const v = row.newValue as { personId: number; teamId: number; hasLeft?: boolean; until: string | null };
    personId = v.personId;
    teamId = v.teamId;
    hasLeft = v.hasLeft ?? !!v.until;
  } else if (row.field === "membership_edit") {
    const v = row.newValue as { membershipId: number; hasLeft?: boolean; until: string | null };
    const [membership] = await db.select({ personId: rosterMemberships.personId, teamId: rosterMemberships.teamId, hasLeft: rosterMemberships.hasLeft }).from(rosterMemberships).where(eq(rosterMemberships.id, v.membershipId)).limit(1);
    if (!membership) return null;
    personId = membership.personId;
    teamId = membership.teamId;
    excludeMembershipId = v.membershipId;
    hasLeft = v.hasLeft ?? (!!v.until || membership.hasLeft);
  } else {
    return null;
  }
  if (hasLeft) return null;

  const [person] = await db.select({ handle: people.handle }).from(people).where(eq(people.id, personId)).limit(1);
  if (!person) return null;
  return { handle: person.handle, personId, teamId, excludeMembershipId };
}

export type BulkResolveResult = { itemId: number; result: ResolveItemResult }[];

/** Resolves every currently-pending item of one change request the same way — the "approve all"/"reject all" bulk action. */
export async function resolveAllPendingItems(changeRequestId: number, action: "approve" | "reject", note = ""): Promise<BulkResolveResult> {
  await requireActorPermission(PERMISSIONS.changeRequestsManage);

  const pendingItems = await db
    .select({ id: changeRequestItems.id, field: changeRequestItems.field })
    .from(changeRequestItems)
    .where(and(eq(changeRequestItems.changeRequestId, changeRequestId), eq(changeRequestItems.status, "pending")));
  // Account links first, so the roster entries of the same request see the person as linked.
  pendingItems.sort((a, b) => Number(b.field === "user_link") - Number(a.field === "user_link"));

  const results: BulkResolveResult = [];
  for (const item of pendingItems) {
    results.push({ itemId: item.id, result: await resolveChangeRequestItem(item.id, action, note) });
  }
  return results;
}
