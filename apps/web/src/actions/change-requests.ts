/**
 * GC-Stats - change-requests
 *
 * Public-facing server actions for submitting profile edit proposals on a
 * team or person. Nothing is written directly to the live tables, only a
 * diff stored as change_requests/change_request_items for staff to review.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use server";

import { and, eq } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { teams, people, rosterMemberships, teamNameHistory, changeRequests, changeRequestItems, changeRequestMessages, PERMISSIONS } from "@gc-stats/db";
import { storeLogoPair, validateImageBuffer, MAX_IMAGE_BYTES, deleteLogoFiles } from "@gc-stats/storage";
import { auth } from "@/auth";
import { INTERNATIONAL_CODE } from "@/lib/countries";
import { rangeIsOpen, rangeLower, rangeUpper } from "@/lib/daterange";
import { getEntityLogos, currentLogo } from "@/lib/admin-logos";
import { getGlobalAccess, hasAccess } from "@/lib/rbac";
import { notify } from "@/lib/notify";
import {
  fieldsForSubject,
  readFieldValue,
  ROSTER_ROLES,
  MAX_MEMBERSHIP_ADDITIONS,
  type ChangeRequestSubjectType,
  type MembershipOperation,
  type NameHistoryOperation,
  type LogoOperation,
} from "@/lib/change-request-fields";
import { getUserLinkStatus, buildUserLinkItem, type UserLinkStatus } from "@/lib/user-link-request";

export type ChangeRequestFieldErrors = Record<string, string>;
export type SubmitChangeRequestResult =
  | { ok: true; changeRequestId: number }
  | { ok: false; fieldErrors: ChangeRequestFieldErrors; formError?: string };

const URL_RE = /^https?:\/\/.+/i;
const COUNTRY_RE = /^[A-Z]{3}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type Item = { field: string; oldValue: unknown; newValue: unknown };

const USER_LINK_ERRORS: Record<Exclude<UserLinkStatus["state"], "available">, string> = {
  linkedToYou: "userLinkAlreadyYours",
  linkedToOther: "userLinkTaken",
  pending: "userLinkPending",
  notFound: "notFound",
};

/**
 * Proposes edits to a team or person profile — simple fields, logo history,
 * (team) name history, and roster/team-history membership rows — all
 * bundled into one moderated proposal. Mirrors V1's
 * TeamChangeRequestController/PlayerChangeRequestController: nothing is
 * written directly to `teams`/`people`/`roster_memberships`/`team_name_history`/`logos`
 * here, only a diff stored as change_requests + change_request_items for
 * staff to review (cf. SUIVI.MD "/admin" inventory, "Demandes de modification").
 * Takes FormData (not a plain object) so a File can travel alongside the
 * text fields in one submission, same convention as actions/admin-logos.ts.
 */
export async function submitChangeRequest(
  subjectType: ChangeRequestSubjectType,
  subjectId: number,
  formData: FormData
): Promise<SubmitChangeRequestResult> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, fieldErrors: {}, formError: "unauthenticated" };

  const current =
    subjectType === "team"
      ? (await db.select().from(teams).where(eq(teams.id, subjectId)).limit(1))[0]
      : (await db.select().from(people).where(eq(people.id, subjectId)).limit(1))[0];
  if (!current) return { ok: false, fieldErrors: {}, formError: "notFound" };

  const fields = fieldsForSubject(subjectType);
  const fieldErrors: ChangeRequestFieldErrors = {};
  const items: Item[] = [];
  const currentRow = current as unknown as Record<string, unknown>;

  for (const def of fields) {
    const raw = formData.get(def.key);
    if (raw === null) continue;

    if (def.type === "boolean") {
      const newBool = raw.toString() === "true";
      const oldBool = Boolean(currentRow[def.key]);
      if (newBool !== oldBool) items.push({ field: def.key, oldValue: oldBool, newValue: newBool });
      continue;
    }

    if (def.type === "tags") {
      let arr: unknown;
      try {
        arr = JSON.parse(raw.toString());
      } catch {
        fieldErrors[def.key] = "invalid";
        continue;
      }
      if (!Array.isArray(arr) || !arr.every((v) => typeof v === "string")) {
        fieldErrors[def.key] = "invalid";
        continue;
      }
      const cleaned = [...new Set(arr.map((v) => v.trim()).filter(Boolean))];
      if (cleaned.length > (def.maxItems ?? Infinity)) {
        fieldErrors[def.key] = "tooMany";
        continue;
      }
      if (cleaned.some((v) => v.length > def.maxLength)) {
        fieldErrors[def.key] = "tooLong";
        continue;
      }
      const oldArr = Array.isArray(currentRow[def.key]) ? (currentRow[def.key] as string[]) : [];
      const same = oldArr.length === cleaned.length && [...oldArr].sort().join(" ") === [...cleaned].sort().join(" ");
      if (!same) items.push({ field: def.key, oldValue: oldArr, newValue: cleaned });
      continue;
    }

    if (def.type === "select") {
      const val = raw.toString();
      if (val && !(def.options ?? []).includes(val)) {
        fieldErrors[def.key] = "invalid";
        continue;
      }
      const oldRaw = currentRow[def.key];
      const oldVal = oldRaw === null || oldRaw === undefined ? "" : String(oldRaw);
      if (val === oldVal) continue;
      items.push({ field: def.key, oldValue: oldVal || null, newValue: val || null });
      continue;
    }

    const trimmed = raw.toString().trim();

    if (def.required && trimmed.length === 0) {
      fieldErrors[def.key] = "required";
      continue;
    }
    if (trimmed.length > def.maxLength) {
      fieldErrors[def.key] = "tooLong";
      continue;
    }
    if (trimmed.length > 0 && def.type === "url" && !URL_RE.test(trimmed)) {
      fieldErrors[def.key] = "invalidUrl";
      continue;
    }
    if (trimmed.length > 0 && def.type === "country" && trimmed !== INTERNATIONAL_CODE && !COUNTRY_RE.test(trimmed)) {
      fieldErrors[def.key] = "invalidCountry";
      continue;
    }

    const oldValue = readFieldValue(currentRow, def.key);
    if (oldValue === trimmed) continue; // no actual change proposed for this field
    items.push({ field: def.key, oldValue: oldValue || null, newValue: trimmed || null });
  }

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  // --- Roster / team history (roster_memberships, both subject types) --
  const membershipItems: Item[] = [];
  const rawMembership = formData.get("membershipOperations");
  if (typeof rawMembership === "string" && rawMembership.trim()) {
    let ops: MembershipOperation[];
    try {
      ops = JSON.parse(rawMembership);
    } catch {
      return { ok: false, fieldErrors: {}, formError: "invalidMembership" };
    }

    const additions = ops.filter((op) => op.type === "add");
    if (additions.length > MAX_MEMBERSHIP_ADDITIONS) return { ok: false, fieldErrors: {}, formError: "tooManyAdditions" };

    for (const op of ops) {
      if (op.type === "add") {
        if (!(ROSTER_ROLES as readonly string[]).includes(op.role)) return { ok: false, fieldErrors: {}, formError: "invalidMembership" };
        if (!DATE_RE.test(op.since)) return { ok: false, fieldErrors: {}, formError: "invalidMembership" };
        if (op.until && !DATE_RE.test(op.until)) return { ok: false, fieldErrors: {}, formError: "invalidMembership" };
        if (op.inactiveSince && !DATE_RE.test(op.inactiveSince)) return { ok: false, fieldErrors: {}, formError: "invalidMembership" };
        // The fixed side (subject) must match this suggest-edit page — the picked side is trusted to exist (picker only offers real rows) but re-checked anyway.
        const fixedOk = subjectType === "team" ? op.teamId === subjectId : op.personId === subjectId;
        if (!fixedOk) return { ok: false, fieldErrors: {}, formError: "invalidMembership" };
        const pickedExists =
          subjectType === "team"
            ? (await db.select({ id: people.id }).from(people).where(eq(people.id, op.personId)).limit(1)).length > 0
            : (await db.select({ id: teams.id }).from(teams).where(eq(teams.id, op.teamId)).limit(1)).length > 0;
        if (!pickedExists) return { ok: false, fieldErrors: {}, formError: "invalidMembership" };
        membershipItems.push({
          field: "membership_add",
          oldValue: null,
          newValue: { personId: op.personId, teamId: op.teamId, role: op.role, since: op.since, until: op.until, inactiveSince: op.inactiveSince },
        });
      } else if (op.type === "edit" || op.type === "delete") {
        const [membership] = await db
          .select({ id: rosterMemberships.id, personId: rosterMemberships.personId, teamId: rosterMemberships.teamId, role: rosterMemberships.role, period: rosterMemberships.period, inactiveSince: rosterMemberships.inactiveSince })
          .from(rosterMemberships)
          .where(eq(rosterMemberships.id, op.membershipId))
          .limit(1);
        const belongsToSubject = membership && (subjectType === "team" ? membership.teamId === subjectId : membership.personId === subjectId);
        if (!belongsToSubject) return { ok: false, fieldErrors: {}, formError: "invalidMembership" };

        if (op.type === "delete") {
          membershipItems.push({ field: "membership_delete", oldValue: { membershipId: op.membershipId }, newValue: null });
        } else {
          if (!(ROSTER_ROLES as readonly string[]).includes(op.role)) return { ok: false, fieldErrors: {}, formError: "invalidMembership" };
          if (!DATE_RE.test(op.since)) return { ok: false, fieldErrors: {}, formError: "invalidMembership" };
          if (op.until && !DATE_RE.test(op.until)) return { ok: false, fieldErrors: {}, formError: "invalidMembership" };
          if (op.inactiveSince && !DATE_RE.test(op.inactiveSince)) return { ok: false, fieldErrors: {}, formError: "invalidMembership" };
          membershipItems.push({
            field: "membership_edit",
            oldValue: {
              membershipId: op.membershipId,
              role: membership.role,
              since: rangeLower(membership.period),
              until: rangeIsOpen(membership.period) ? null : rangeUpper(membership.period),
              inactiveSince: membership.inactiveSince,
            },
            newValue: { membershipId: op.membershipId, role: op.role, since: op.since, until: op.until, inactiveSince: op.inactiveSince },
          });
        }
      }
    }
  }

  // --- Team name history (team subjects only) ---------------------------
  const nameHistoryItems: Item[] = [];
  if (subjectType === "team") {
    const raw = formData.get("nameHistoryOperations");
    if (typeof raw === "string" && raw.trim()) {
      let ops: NameHistoryOperation[];
      try {
        ops = JSON.parse(raw);
      } catch {
        return { ok: false, fieldErrors: {}, formError: "invalidNameHistory" };
      }
      for (const op of ops) {
        if (op.type === "add") {
          if (!op.name.trim() || op.name.length > 200) return { ok: false, fieldErrors: {}, formError: "invalidNameHistory" };
          if (!DATE_RE.test(op.since)) return { ok: false, fieldErrors: {}, formError: "invalidNameHistory" };
          if (op.until && !DATE_RE.test(op.until)) return { ok: false, fieldErrors: {}, formError: "invalidNameHistory" };
          nameHistoryItems.push({ field: "name_history_add", oldValue: null, newValue: { name: op.name.trim(), since: op.since, until: op.until } });
        } else {
          const [entry] = await db.select({ id: teamNameHistory.id }).from(teamNameHistory).where(and(eq(teamNameHistory.id, op.id), eq(teamNameHistory.teamId, subjectId))).limit(1);
          if (!entry) return { ok: false, fieldErrors: {}, formError: "invalidNameHistory" };
          if (op.type === "toggle") nameHistoryItems.push({ field: "name_history_toggle", oldValue: { id: op.id }, newValue: { id: op.id, isVisible: op.isVisible } });
          else nameHistoryItems.push({ field: "name_history_delete", oldValue: { id: op.id }, newValue: null });
        }
      }
    }
  }

  // --- Logo history edits/deletes (existing entries) ---------------------
  const logoHistoryItems: Item[] = [];
  const rawLogoOps = formData.get("logoOperations");
  if (typeof rawLogoOps === "string" && rawLogoOps.trim()) {
    let ops: LogoOperation[];
    try {
      ops = JSON.parse(rawLogoOps);
    } catch {
      return { ok: false, fieldErrors: {}, formError: "invalidLogo" };
    }
    const existingLogos = await getEntityLogos(subjectType, subjectId);
    for (const op of ops) {
      const exists = existingLogos.some((l) => l.id === op.logoId);
      if (!exists) return { ok: false, fieldErrors: {}, formError: "invalidLogo" };
      if (op.type === "delete") {
        logoHistoryItems.push({ field: "logo_delete", oldValue: { logoId: op.logoId }, newValue: null });
      } else {
        if (!DATE_RE.test(op.since)) return { ok: false, fieldErrors: {}, formError: "invalidLogo" };
        if (op.until && !DATE_RE.test(op.until)) return { ok: false, fieldErrors: {}, formError: "invalidLogo" };
        logoHistoryItems.push({ field: "logo_edit", oldValue: { logoId: op.logoId }, newValue: { logoId: op.logoId, theme: op.theme, since: op.since, until: op.until } });
      }
    }
  }

  // --- New logo upload ----------------------------------------------------
  const logoFile = formData.get("logoFile");
  let logoBuffer: Buffer | null = null;
  if (logoFile instanceof File && logoFile.size > 0) {
    if (logoFile.size > MAX_IMAGE_BYTES) return { ok: false, fieldErrors: { logo: "tooLarge" } };
    const uploaded = Buffer.from(await logoFile.arrayBuffer());
    const validation = await validateImageBuffer(uploaded);
    if (!validation.ok) return { ok: false, fieldErrors: { logo: validation.error } };
    logoBuffer = uploaded;
  }
  const newLogoTheme = (formData.get("logoTheme")?.toString() ?? "") || null;
  const newLogoSince = formData.get("logoSince")?.toString() || new Date().toISOString().slice(0, 10);
  const newLogoUntil = formData.get("logoUntil")?.toString() || null;
  if (logoBuffer && newLogoUntil && !DATE_RE.test(newLogoUntil)) return { ok: false, fieldErrors: { logo: "invalid" } };

  const reason = (formData.get("reason")?.toString() ?? "").trim();
  if (reason.length > 500) return { ok: false, fieldErrors: { reason: "tooLong" } };

  // --- Account link (person subjects only) -------------------------------
  const userLinkItems: Item[] = [];
  const linkUser = formData.get("linkUser");
  if (linkUser !== null && linkUser !== "true" && linkUser !== "false") return { ok: false, fieldErrors: { linkUser: "invalid" } };
  if (linkUser === "true") {
    if (subjectType !== "person") return { ok: false, fieldErrors: { linkUser: "invalid" } };
    const status = await getUserLinkStatus(userId, subjectId);
    if (status.state !== "available") return { ok: false, fieldErrors: { linkUser: USER_LINK_ERRORS[status.state] } };
    userLinkItems.push(buildUserLinkItem(userId, status.previousPersonId));
  }

  const allItems = [...items, ...membershipItems, ...nameHistoryItems, ...logoHistoryItems, ...userLinkItems];
  if (allItems.length === 0 && !logoBuffer) {
    return { ok: false, fieldErrors: {}, formError: "noChanges" };
  }

  // Uploaded only once every other validation has passed, so a rejected
  // submission never leaves an orphaned file in the bucket.
  let storedLogoId: string | null = null;
  if (logoBuffer) {
    const stored = await storeLogoPair(subjectType, logoBuffer);
    storedLogoId = stored.id;
    const liveLogo = currentLogo(await getEntityLogos(subjectType, subjectId));
    allItems.push({
      field: "logo",
      oldValue: liveLogo?.id ?? null,
      newValue: { logoId: storedLogoId, theme: newLogoTheme, since: newLogoSince, until: newLogoUntil },
    });
  }

  try {
    const changeRequestId = await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(changeRequests)
        .values({ subjectType, subjectId, requestedBy: userId, reason: reason || null, status: "pending" })
        .returning({ id: changeRequests.id });
      const row = inserted[0]!;

      await tx.insert(changeRequestItems).values(
        allItems.map((item) => ({
          changeRequestId: row.id,
          field: item.field,
          oldValue: item.oldValue,
          newValue: item.newValue,
          status: "pending",
        }))
      );

      return row.id;
    });

    return { ok: true, changeRequestId };
  } catch (error) {
    if (storedLogoId) await deleteLogoFiles(subjectType, storedLogoId).catch(() => {});
    throw error;
  }
}

export type ChangeRequestMessageActionResult = { ok: true } | { ok: false; error: string };

const MESSAGE_MAX_LENGTH = 2000;

async function requireUserId(): Promise<string> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Not authenticated");
  return userId;
}

/**
 * Net-new both sides: change_request_messages had no writer or reader in V2
 * before this (schema-only table). Authorized for the request's own author
 * or anyone with change-requests.manage — mirrors the same two-sided
 * conversation as news_messages, just without the approval workflow.
 */
export async function postChangeRequestMessage(changeRequestId: number, body: string): Promise<ChangeRequestMessageActionResult> {
  const userId = await requireUserId();

  const trimmed = body.trim();
  if (!trimmed) return { ok: false, error: "bodyRequired" };
  if (trimmed.length > MESSAGE_MAX_LENGTH) return { ok: false, error: "bodyTooLong" };

  const [request] = await db.select({ requestedBy: changeRequests.requestedBy, status: changeRequests.status }).from(changeRequests).where(eq(changeRequests.id, changeRequestId)).limit(1);
  if (!request) return { ok: false, error: "notFound" };

  const access = await getGlobalAccess(userId);
  const isOwner = request.requestedBy === userId;
  const isManager = hasAccess(access, PERMISSIONS.changeRequestsManage);
  if (!isOwner && !isManager) return { ok: false, error: "notAuthorized" };
  if (request.status !== "pending") return { ok: false, error: "resolved" };

  await db.insert(changeRequestMessages).values({ changeRequestId, userId, type: "comment", body: trimmed });

  if (isManager && !isOwner && request.requestedBy) {
    await notify({ recipientId: request.requestedBy, type: "change_request.comment", authorId: userId, link: `/settings/change-requests/${changeRequestId}`, data: { changeRequestId } });
  }

  return { ok: true };
}

/** Only the request's own author can withdraw, and only while still pending — mirrors the pending-only edit window everywhere else in this flow. */
export async function withdrawChangeRequest(changeRequestId: number): Promise<ChangeRequestMessageActionResult> {
  const userId = await requireUserId();

  const [request] = await db.select({ requestedBy: changeRequests.requestedBy, status: changeRequests.status }).from(changeRequests).where(eq(changeRequests.id, changeRequestId)).limit(1);
  if (!request) return { ok: false, error: "notFound" };
  if (request.requestedBy !== userId) return { ok: false, error: "notAuthorized" };
  if (request.status !== "pending") return { ok: false, error: "notPending" };

  await db.update(changeRequests).set({ status: "withdrawn", closedBy: userId, closedAt: new Date() }).where(eq(changeRequests.id, changeRequestId));
  return { ok: true };
}
