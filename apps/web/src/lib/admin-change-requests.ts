/**
 * GC-Stats - admin-change-requests
 *
 * Admin queries for reviewing change requests: counts, paginated search,
 * and per-request detail with resolved display context (names, logo
 * previews) for each item.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, asc, desc, eq, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { changeRequests, changeRequestItems, teams, people, rosterMemberships, users } from "@gc-stats/db";
import { logoUrl } from "@gc-stats/storage";
import { typoVariants } from "@/lib/search-typo";
import { foldedIlike } from "@/lib/db-search";
import type { ChangeRequestSubjectType } from "@/lib/change-request-fields";

export const CHANGE_REQUESTS_PAGE_SIZE = 30;

// "withdrawn" is never produced by this admin tool (see resolveChangeRequestItem)
// — it's set directly in the DB by the external roster-mismatch detector
// (the "roster" field producer, cf. change-request-item-card.tsx) when it
// auto-retracts its own stale suggestion. Read-only here, just displayed.
export type ChangeRequestStatus = "pending" | "approved" | "rejected" | "partial" | "withdrawn";
export type ChangeRequestSort = "createdAt" | "status";
// System requests (roster-mismatch detector, V1 import) have no requester.
export type ChangeRequestOrigin = "user" | "system";
export type SortDirection = "asc" | "desc";

export type AdminChangeRequestRow = {
  id: number;
  subjectType: ChangeRequestSubjectType;
  subjectId: number;
  subjectLabel: string | null;
  requestedByUsername: string | null;
  reason: string | null;
  status: ChangeRequestStatus;
  createdAt: string;
  totalItems: number;
  pendingItems: number;
  approvedItems: number;
  rejectedItems: number;
};

function originCondition(origin: ChangeRequestOrigin) {
  return origin === "system" ? isNull(changeRequests.requestedBy) : isNotNull(changeRequests.requestedBy);
}

export async function getAdminChangeRequestCounts(origin: ChangeRequestOrigin | "" = ""): Promise<{ pending: number; approved: number; rejected: number }> {
  const rows = await db
    .select({ status: changeRequests.status, count: sql<number>`count(*)::int` })
    .from(changeRequests)
    .where(origin ? originCondition(origin) : undefined)
    .groupBy(changeRequests.status);
  const result = { pending: 0, approved: 0, rejected: 0 };
  for (const row of rows) {
    if (row.status === "pending") result.pending = row.count;
    else if (row.status === "approved") result.approved = row.count;
    else if (row.status === "rejected") result.rejected = row.count;
  }
  return result;
}

export async function subjectLabels(subjectType: ChangeRequestSubjectType, ids: number[]): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  if (ids.length === 0) return map;
  if (subjectType === "team") {
    const rows = await db.select({ id: teams.id, name: teams.name }).from(teams).where(inArray(teams.id, ids));
    for (const r of rows) map.set(r.id, r.name);
  } else {
    const rows = await db.select({ id: people.id, handle: people.handle }).from(people).where(inArray(people.id, ids));
    for (const r of rows) map.set(r.id, r.handle);
  }
  return map;
}

export async function listAdminChangeRequests(opts: {
  q: string;
  status: ChangeRequestStatus | "";
  origin: ChangeRequestOrigin | "";
  sort: ChangeRequestSort;
  direction: SortDirection;
  page: number;
}): Promise<{ rows: AdminChangeRequestRow[]; total: number }> {
  const { q, status, origin, sort, direction, page } = opts;

  // Search matches the subject's current name/handle or the requester's
  // username — resolved via two extra lookups rather than a join, since
  // subjectId is polymorphic (no single FK to join against).
  let matchingIds: { subjectType: ChangeRequestSubjectType; subjectId: number }[] | null = null;
  if (q) {
    const numeric = /^\d+$/.test(q);
    const variants = typoVariants(q.toLowerCase());
    const teamClauses = variants.map((v) => foldedIlike(teams.name, v));
    const personClauses = variants.map((v) => foldedIlike(people.handle, v));
    if (numeric) {
      teamClauses.push(eq(teams.id, Number(q)));
      personClauses.push(eq(people.id, Number(q)));
    }
    const [teamRows, personRows] = await Promise.all([
      db.select({ id: teams.id }).from(teams).where(or(...teamClauses)),
      db.select({ id: people.id }).from(people).where(or(...personClauses)),
    ]);
    matchingIds = [
      ...teamRows.map((r) => ({ subjectType: "team" as const, subjectId: r.id })),
      ...personRows.map((r) => ({ subjectType: "person" as const, subjectId: r.id })),
    ];
  }

  const conditions = [];
  if (status) conditions.push(eq(changeRequests.status, status));
  if (origin) conditions.push(originCondition(origin));
  if (matchingIds !== null) {
    const usernameVariants = q ? typoVariants(q.toLowerCase()) : [];
    const [byUsername] = usernameVariants.length ? [await db.select({ id: users.id }).from(users).where(or(...usernameVariants.map((v) => foldedIlike(users.username, v))))] : [[]];
    const userIds = byUsername.map((r) => r.id);
    const subjectMatch = matchingIds.length
      ? or(...matchingIds.map((m) => and(eq(changeRequests.subjectType, m.subjectType), eq(changeRequests.subjectId, m.subjectId))))
      : undefined;
    const requesterMatch = userIds.length ? inArray(changeRequests.requestedBy, userIds) : undefined;
    if (subjectMatch && requesterMatch) conditions.push(or(subjectMatch, requesterMatch));
    else if (subjectMatch) conditions.push(subjectMatch);
    else if (requesterMatch) conditions.push(requesterMatch);
    else conditions.push(sql`false`); // search term matched nothing
  }

  const where = conditions.length ? and(...conditions) : undefined;

  const sortCol = sort === "status" ? changeRequests.status : changeRequests.createdAt;
  const orderBy = direction === "desc" ? desc(sortCol) : asc(sortCol);

  const [rows, countRows] = await Promise.all([
    db
      .select({
        id: changeRequests.id,
        subjectType: changeRequests.subjectType,
        subjectId: changeRequests.subjectId,
        requestedByUsername: users.username,
        reason: changeRequests.reason,
        status: changeRequests.status,
        createdAt: changeRequests.createdAt,
      })
      .from(changeRequests)
      .leftJoin(users, eq(users.id, changeRequests.requestedBy))
      .where(where)
      .orderBy(orderBy, desc(changeRequests.id))
      .limit(CHANGE_REQUESTS_PAGE_SIZE)
      .offset((page - 1) * CHANGE_REQUESTS_PAGE_SIZE),
    db.select({ count: sql<number>`count(*)::int` }).from(changeRequests).where(where),
  ]);
  const count = countRows[0]?.count ?? 0;

  const teamIds = rows.filter((r) => r.subjectType === "team").map((r) => r.subjectId);
  const personIds = rows.filter((r) => r.subjectType === "person").map((r) => r.subjectId);
  const [teamLabels, personLabels] = await Promise.all([subjectLabels("team", teamIds), subjectLabels("person", personIds)]);

  const itemCounts = rows.length
    ? await db
        .select({ changeRequestId: changeRequestItems.changeRequestId, status: changeRequestItems.status, count: sql<number>`count(*)::int` })
        .from(changeRequestItems)
        .where(
          inArray(
            changeRequestItems.changeRequestId,
            rows.map((r) => r.id)
          )
        )
        .groupBy(changeRequestItems.changeRequestId, changeRequestItems.status)
    : [];

  const countsByRequest = new Map<number, { total: number; pending: number; approved: number; rejected: number }>();
  for (const row of itemCounts) {
    const bucket = countsByRequest.get(row.changeRequestId) ?? { total: 0, pending: 0, approved: 0, rejected: 0 };
    bucket.total += row.count;
    if (row.status === "pending") bucket.pending += row.count;
    else if (row.status === "approved") bucket.approved += row.count;
    else if (row.status === "rejected" || row.status === "failed") bucket.rejected += row.count;
    countsByRequest.set(row.changeRequestId, bucket);
  }

  return {
    rows: rows.map((r) => {
      const counts = countsByRequest.get(r.id) ?? { total: 0, pending: 0, approved: 0, rejected: 0 };
      return {
        id: r.id,
        subjectType: r.subjectType as ChangeRequestSubjectType,
        subjectId: r.subjectId,
        subjectLabel: (r.subjectType === "team" ? teamLabels : personLabels).get(r.subjectId) ?? null,
        requestedByUsername: r.requestedByUsername,
        reason: r.reason,
        status: r.status as ChangeRequestStatus,
        createdAt: r.createdAt.toISOString(),
        totalItems: counts.total,
        pendingItems: counts.pending,
        approvedItems: counts.approved,
        rejectedItems: counts.rejected,
      };
    }),
    total: count,
  };
}

export type AdminChangeRequestItem = {
  id: number;
  field: string;
  oldValue: unknown;
  newValue: unknown;
  status: "pending" | "approved" | "rejected" | "failed";
  resolvedByUsername: string | null;
  resolvedAt: string | null;
  resolutionNote: string | null;
  applyError: string | null;
  /** Extra display-only context resolved server-side — the "other side" name for a roster op, or a preview URL for a logo op. Never used to apply the change (see actions/admin-change-requests.ts, which re-resolves everything itself). */
  display: { personName?: string; teamName?: string; logoPreviewUrl?: string | null; username?: string };
};

export type AdminChangeRequestDetail = {
  id: number;
  subjectType: ChangeRequestSubjectType;
  subjectId: number;
  subjectLabel: string | null;
  requestedByUsername: string | null;
  reason: string | null;
  status: ChangeRequestStatus;
  createdAt: string;
  items: AdminChangeRequestItem[];
};

export async function getAdminChangeRequestDetail(id: number): Promise<AdminChangeRequestDetail | null> {
  const [row] = await db
    .select({
      id: changeRequests.id,
      subjectType: changeRequests.subjectType,
      subjectId: changeRequests.subjectId,
      requestedByUsername: users.username,
      reason: changeRequests.reason,
      status: changeRequests.status,
      createdAt: changeRequests.createdAt,
    })
    .from(changeRequests)
    .leftJoin(users, eq(users.id, changeRequests.requestedBy))
    .where(eq(changeRequests.id, id))
    .limit(1);
  if (!row) return null;

  const resolvedByAlias = users;
  const items = await db
    .select({
      id: changeRequestItems.id,
      field: changeRequestItems.field,
      oldValue: changeRequestItems.oldValue,
      newValue: changeRequestItems.newValue,
      status: changeRequestItems.status,
      resolvedByUsername: resolvedByAlias.username,
      resolvedAt: changeRequestItems.resolvedAt,
      resolutionNote: changeRequestItems.resolutionNote,
      applyError: changeRequestItems.applyError,
    })
    .from(changeRequestItems)
    .leftJoin(resolvedByAlias, eq(resolvedByAlias.id, changeRequestItems.resolvedBy))
    .where(eq(changeRequestItems.changeRequestId, id))
    .orderBy(asc(changeRequestItems.id));

  const subjectType = row.subjectType as ChangeRequestSubjectType;
  const label = (await subjectLabels(subjectType, [row.subjectId])).get(row.subjectId) ?? null;

  // --- Resolve "other side" names for roster ops + membership row fallback (delete ops only carry a membershipId) ---
  const otherPersonIds = new Set<number>();
  const otherTeamIds = new Set<number>();
  const membershipIdsNeedingLookup = new Set<number>();
  const linkUserIds = new Set<string>();
  for (const it of items) {
    if (it.field === "membership_add") {
      const v = it.newValue as { personId: number; teamId: number };
      otherPersonIds.add(v.personId);
      otherTeamIds.add(v.teamId);
    } else if (it.field === "membership_edit" || it.field === "membership_delete") {
      const v = (it.field === "membership_edit" ? it.newValue : it.oldValue) as { membershipId: number };
      membershipIdsNeedingLookup.add(v.membershipId);
    } else if (it.field === "user_link") {
      const v = it.newValue as { userId: string; previousPersonId: number | null };
      linkUserIds.add(v.userId);
      if (v.previousPersonId) otherPersonIds.add(v.previousPersonId);
    }
  }
  const membershipLookup = new Map<number, { personId: number; teamId: number }>();
  if (membershipIdsNeedingLookup.size > 0) {
    const rows = await db
      .select({ id: rosterMemberships.id, personId: rosterMemberships.personId, teamId: rosterMemberships.teamId })
      .from(rosterMemberships)
      .where(inArray(rosterMemberships.id, [...membershipIdsNeedingLookup]));
    for (const r of rows) {
      otherPersonIds.add(r.personId);
      otherTeamIds.add(r.teamId);
      membershipLookup.set(r.id, r);
    }
  }
  const [personNames, teamNames, linkUsernames] = await Promise.all([
    subjectLabels("person", [...otherPersonIds]),
    subjectLabels("team", [...otherTeamIds]),
    linkUserIds.size > 0 ? db.select({ id: users.id, username: users.username }).from(users).where(inArray(users.id, [...linkUserIds])) : Promise.resolve([]),
  ]);
  const usernameById = new Map(linkUsernames.map((u) => [u.id, u.username]));

  return {
    id: row.id,
    subjectType,
    subjectId: row.subjectId,
    subjectLabel: label,
    requestedByUsername: row.requestedByUsername,
    reason: row.reason,
    status: row.status as ChangeRequestStatus,
    createdAt: row.createdAt.toISOString(),
    items: items.map((it) => {
      const display: AdminChangeRequestItem["display"] = {};
      if (it.field === "membership_add") {
        const v = it.newValue as { personId: number; teamId: number };
        display.personName = personNames.get(v.personId) ?? `#${v.personId}`;
        display.teamName = teamNames.get(v.teamId) ?? `#${v.teamId}`;
      } else if (it.field === "membership_edit" || it.field === "membership_delete") {
        const v = (it.field === "membership_edit" ? it.newValue : it.oldValue) as { membershipId: number };
        const membership = membershipLookup.get(v.membershipId);
        if (membership) {
          display.personName = personNames.get(membership.personId) ?? `#${membership.personId}`;
          display.teamName = teamNames.get(membership.teamId) ?? `#${membership.teamId}`;
        }
      } else if (it.field === "logo") {
        const v = it.newValue as { logoId: string };
        display.logoPreviewUrl = logoUrl(subjectType, v.logoId, "200x200");
      } else if (it.field === "logo_edit") {
        const v = it.newValue as { logoId: string };
        display.logoPreviewUrl = logoUrl(subjectType, v.logoId, "200x200");
      } else if (it.field === "logo_delete") {
        const v = it.oldValue as { logoId: string };
        display.logoPreviewUrl = logoUrl(subjectType, v.logoId, "200x200");
      } else if (it.field === "user_link") {
        const v = it.newValue as { userId: string; previousPersonId: number | null };
        display.username = usernameById.get(v.userId) ?? `#${v.userId}`;
        if (v.previousPersonId) display.personName = personNames.get(v.previousPersonId) ?? `#${v.previousPersonId}`;
      }
      return {
        id: it.id,
        field: it.field,
        oldValue: it.oldValue,
        newValue: it.newValue,
        status: it.status as AdminChangeRequestItem["status"],
        resolvedByUsername: it.resolvedByUsername,
        resolvedAt: it.resolvedAt ? it.resolvedAt.toISOString() : null,
        resolutionNote: it.resolutionNote,
        applyError: it.applyError,
        display,
      };
    }),
  };
}
