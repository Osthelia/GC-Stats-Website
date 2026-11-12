/**
 * GC-Stats - admin-team-requests
 *
 * Admin server actions of the team requests: load the context of a team,
 * record a request and move it between pending and done. Every value is
 * validated here, not only in the form.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use server";

import { and, eq } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { teamInfoRequests, PERMISSIONS, valorantTables } from "@gc-stats/db";
import { requireActorPermission } from "@/lib/rbac";
import { logActivity } from "@/lib/activity-log";
import { searchTeamsQuery } from "@/lib/team-search";
import { isDiscordContact, isEmail, isHttpUrl } from "@/lib/team-requests/contact";
import { getTeamRequestContext, type TeamRequestContext } from "@/lib/admin-team-requests";
import {
  TEAM_REQUEST_CONTACT_CHANNELS,
  TEAM_REQUEST_CONTACT_KINDS,
  TEAM_REQUEST_CONTACT_MAX,
  TEAM_REQUEST_ITEMS,
  TEAM_REQUEST_MESSAGE_MAX,
  type TeamRequestContactChannel,
  type TeamRequestContactKind,
  type TeamRequestItem,
} from "@/lib/team-requests/constants";

const { teams } = valorantTables;

export type CreateTeamRequestInput = {
  teamId: number | null;
  items: string[];
  message: string;
  contactKind: string;
  contactChannel: string;
  contactValue: string;
  contactLabel: string;
};

export type TeamRequestField = "team" | "items" | "message" | "contact";
export type TeamRequestError = "teamRequired" | "teamNotFound" | "itemsInvalid" | "itemsRequired" | "messageRequired" | "messageTooLong" | "contactRequired" | "contactInvalid" | "contactTooLong" | "urlInvalid" | "emailInvalid" | "discordInvalid" | "alreadyPending" | "notFound" | "invalidState";

export type CreateTeamRequestResult = { ok: true; id: number } | { ok: false; error: TeamRequestError; field?: TeamRequestField };
export type SetTeamRequestStatusResult = { ok: true } | { ok: false; error: TeamRequestError };

function isUniqueViolation(error: unknown): boolean {
  const code = (error as { code?: string; cause?: { code?: string } } | null);
  return code?.code === "23505" || code?.cause?.code === "23505";
}

export async function searchRequestTeams(query: string) {
  await requireActorPermission(PERMISSIONS.teamRequestsManage);
  return searchTeamsQuery("valorant", typeof query === "string" ? query.slice(0, 100) : "");
}

export async function loadTeamRequestContext(teamId: number): Promise<TeamRequestContext | null> {
  const access = await requireActorPermission(PERMISSIONS.teamRequestsManage);
  if (!Number.isInteger(teamId) || teamId <= 0) return null;
  return getTeamRequestContext(teamId, access.userId);
}

export async function createTeamRequest(input: CreateTeamRequestInput): Promise<CreateTeamRequestResult> {
  const access = await requireActorPermission(PERMISSIONS.teamRequestsManage);

  const teamId = input.teamId;
  if (teamId === null || !Number.isInteger(teamId) || teamId <= 0) return { ok: false, error: "teamRequired", field: "team" };
  const [team] = await db.select({ id: teams.id }).from(teams).where(eq(teams.id, teamId)).limit(1);
  if (!team) return { ok: false, error: "teamNotFound", field: "team" };

  if (!Array.isArray(input.items) || input.items.some((item) => !(TEAM_REQUEST_ITEMS as readonly string[]).includes(item))) {
    return { ok: false, error: "itemsInvalid", field: "items" };
  }
  const items = [...new Set(input.items)] as TeamRequestItem[];
  if (items.length === 0) return { ok: false, error: "itemsRequired", field: "items" };

  const message = typeof input.message === "string" ? input.message.trim() : "";
  if (!message) return { ok: false, error: "messageRequired", field: "message" };
  if (message.length > TEAM_REQUEST_MESSAGE_MAX) return { ok: false, error: "messageTooLong", field: "message" };

  const contactValue = typeof input.contactValue === "string" ? input.contactValue.trim() : "";
  const contactLabel = typeof input.contactLabel === "string" ? input.contactLabel.trim() : "";
  if (!contactValue || !contactLabel) return { ok: false, error: "contactRequired", field: "contact" };
  if (contactValue.length > TEAM_REQUEST_CONTACT_MAX || contactLabel.length > TEAM_REQUEST_CONTACT_MAX) return { ok: false, error: "contactTooLong", field: "contact" };
  if (!(TEAM_REQUEST_CONTACT_KINDS as readonly string[]).includes(input.contactKind) || !(TEAM_REQUEST_CONTACT_CHANNELS as readonly string[]).includes(input.contactChannel)) {
    return { ok: false, error: "contactInvalid", field: "contact" };
  }
  if (input.contactChannel === "website" && !isHttpUrl(contactValue)) return { ok: false, error: "urlInvalid", field: "contact" };
  if (input.contactChannel === "email" && !isEmail(contactValue)) return { ok: false, error: "emailInvalid", field: "contact" };
  if (input.contactChannel === "discord" && !isDiscordContact(contactValue)) return { ok: false, error: "discordInvalid", field: "contact" };

  const [pending] = await db
    .select({ id: teamInfoRequests.id })
    .from(teamInfoRequests)
    .where(and(eq(teamInfoRequests.teamId, teamId), eq(teamInfoRequests.status, "pending")))
    .limit(1);
  if (pending) return { ok: false, error: "alreadyPending", field: "team" };

  let created: { id: number } | undefined;
  try {
    [created] = await db
      .insert(teamInfoRequests)
      .values({
        teamId,
        items,
        message,
        contactKind: input.contactKind as TeamRequestContactKind,
        contactChannel: input.contactChannel as TeamRequestContactChannel,
        contactValue,
        contactLabel,
        createdBy: access.userId,
      })
      .returning({ id: teamInfoRequests.id });
  } catch (error) {
    // The partial unique index catches a concurrent insert that passed the check above.
    if (isUniqueViolation(error)) return { ok: false, error: "alreadyPending", field: "team" };
    throw error;
  }
  if (!created) throw new Error("Team request insert returned no row");

  await logActivity({
    subject: "team",
    subjectId: teamId,
    event: "created",
    logName: "teamRequest",
    description: "team info request created",
    actorUserId: access.userId,
    properties: { requestId: created.id, items },
  });

  return { ok: true, id: created.id };
}

/** The status guard makes a double click a no-op: no row updated, no log, invalidState. */
export async function setTeamRequestStatus(requestId: number, status: "pending" | "done"): Promise<SetTeamRequestStatusResult> {
  const access = await requireActorPermission(PERMISSIONS.teamRequestsManage);

  if (!Number.isInteger(requestId) || requestId <= 0 || (status !== "pending" && status !== "done")) return { ok: false, error: "notFound" };
  const [request] = await db
    .select({ id: teamInfoRequests.id, teamId: teamInfoRequests.teamId, status: teamInfoRequests.status })
    .from(teamInfoRequests)
    .where(eq(teamInfoRequests.id, requestId))
    .limit(1);
  if (!request) return { ok: false, error: "notFound" };
  if (request.status === status) return { ok: false, error: "invalidState" };

  if (status === "pending") {
    const [other] = await db
      .select({ id: teamInfoRequests.id })
      .from(teamInfoRequests)
      .where(and(eq(teamInfoRequests.teamId, request.teamId), eq(teamInfoRequests.status, "pending")))
      .limit(1);
    if (other) return { ok: false, error: "alreadyPending" };
  }

  let updated: { id: number }[];
  try {
    updated = await db
      .update(teamInfoRequests)
      .set({ status, completedAt: status === "done" ? new Date() : null })
      .where(and(eq(teamInfoRequests.id, requestId), eq(teamInfoRequests.status, request.status)))
      .returning({ id: teamInfoRequests.id });
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, error: "alreadyPending" };
    throw error;
  }
  // Another admin changed it first: nothing to log.
  if (updated.length === 0) return { ok: false, error: "invalidState" };

  await logActivity({
    subject: "team",
    subjectId: request.teamId,
    event: "updated",
    logName: "teamRequest",
    description: `team info request ${status}`,
    actorUserId: access.userId,
    properties: { requestId, status },
  });

  return { ok: true };
}
