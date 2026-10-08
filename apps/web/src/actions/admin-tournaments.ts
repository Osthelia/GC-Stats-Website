/**
 * GC-Stats - admin-tournaments
 *
 * Admin server actions for tournament profiles: name, region, category,
 * dates, status, point type, prize pool and socials.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use server";

import { eq } from "drizzle-orm";
import { updateTag } from "next/cache";
import { adminDb as db } from "@gc-stats/db/client";
import { tournaments, pointTypes, PERMISSIONS } from "@gc-stats/db";
import { requireActorPermission } from "@/lib/rbac";
import { HOME_TOURNAMENTS_TAG, TOURNAMENT_FACETS_TAG } from "@/lib/cache-tags";
import { logActivity, diffChanges } from "@/lib/activity-log";

async function requireTournamentsActor(): Promise<string> {
  const access = await requireActorPermission(PERMISSIONS.tournamentsManage);
  return access.userId;
}

const SOCIAL_KEYS = ["twitter", "twitch", "instagram", "youtube", "tiktok", "discord", "website"] as const;

export type TournamentField =
  | "name"
  | "region"
  | "category"
  | "startDate"
  | "endDate"
  | "status"
  | "pointTypeId"
  | "location"
  | "prizePool"
  | "description"
  | "keywords"
  | "liquipediaLink"
  | "playerPovPhrase";
export type TournamentFieldErrors = Partial<Record<TournamentField, string>> & {
  socials?: Partial<Record<(typeof SOCIAL_KEYS)[number], string>>;
};
export type TournamentResult = { ok: true; id: number } | { ok: false; fieldErrors: TournamentFieldErrors };

export type TournamentInput = {
  name: string;
  region: string;
  category: string;
  startDate: string;
  endDate: string;
  status: string;
  active: boolean;
  pointTypeId: number | null;
  location: string;
  prizePool: string;
  description: string;
  keywords: string[];
  liquipediaLink: string;
  socials: Partial<Record<(typeof SOCIAL_KEYS)[number], string>>;
  playerPovPhrase: string;
};

const STATUS_VALUES = ["upcoming", "live", "finished"];
const KEYWORDS_MAX_COUNT = 20;
const KEYWORD_MAX_LENGTH = 50;

function normalizeKeywords(keywords: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of keywords) {
    const keyword = raw.trim();
    const key = keyword.toLowerCase();
    if (!keyword || seen.has(key)) continue;
    seen.add(key);
    result.push(keyword);
  }
  return result;
}

function isValidDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(value).getTime());
}

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

async function validateTournament(input: TournamentInput): Promise<TournamentFieldErrors> {
  const fieldErrors: TournamentFieldErrors = {};

  const name = input.name.trim();
  if (!name) fieldErrors.name = "required";
  else if (name.length > 255) fieldErrors.name = "tooLong";

  if (!input.startDate) fieldErrors.startDate = "required";
  else if (!isValidDate(input.startDate)) fieldErrors.startDate = "invalid";

  if (!input.endDate) fieldErrors.endDate = "required";
  else if (!isValidDate(input.endDate)) fieldErrors.endDate = "invalid";

  if (!fieldErrors.startDate && !fieldErrors.endDate && input.endDate < input.startDate) {
    fieldErrors.endDate = "beforeStart";
  }

  if (!STATUS_VALUES.includes(input.status)) fieldErrors.status = "invalid";

  if (input.pointTypeId !== null) {
    const [existing] = await db.select({ id: pointTypes.id }).from(pointTypes).where(eq(pointTypes.id, input.pointTypeId)).limit(1);
    if (!existing) fieldErrors.pointTypeId = "notFound";
  }

  if (input.location.trim().length > 255) fieldErrors.location = "tooLong";
  if (input.prizePool.trim().length > 100) fieldErrors.prizePool = "tooLong";
  if (input.playerPovPhrase.trim().length > 255) fieldErrors.playerPovPhrase = "tooLong";

  if (!Array.isArray(input.keywords) || input.keywords.some((k) => typeof k !== "string")) fieldErrors.keywords = "invalid";
  else {
    const keywords = normalizeKeywords(input.keywords);
    if (keywords.length > KEYWORDS_MAX_COUNT) fieldErrors.keywords = "tooMany";
    else if (keywords.some((k) => k.length > KEYWORD_MAX_LENGTH)) fieldErrors.keywords = "tooLong";
  }

  const liquipediaLink = input.liquipediaLink.trim();
  if (liquipediaLink && !isValidUrl(liquipediaLink)) fieldErrors.liquipediaLink = "invalid";

  const socialErrors: Partial<Record<(typeof SOCIAL_KEYS)[number], string>> = {};
  for (const key of SOCIAL_KEYS) {
    const value = input.socials[key]?.trim();
    if (!value) continue;
    if (value.length > 2000) socialErrors[key] = "tooLong";
    else if (!isValidUrl(value)) socialErrors[key] = "invalid";
  }
  if (Object.keys(socialErrors).length > 0) fieldErrors.socials = socialErrors;

  return fieldErrors;
}

function coreColumns(input: TournamentInput) {
  const socials: Record<string, string> = {};
  for (const key of SOCIAL_KEYS) {
    const value = input.socials[key]?.trim();
    if (value) socials[key] = value;
  }

  return {
    name: input.name.trim(),
    region: input.region.trim() || null,
    category: input.category.trim() || null,
    startDate: input.startDate,
    endDate: input.endDate,
    status: input.status,
    active: input.active,
    pointTypeId: input.pointTypeId,
    location: input.location.trim() || null,
    prizePool: input.prizePool.trim() || null,
    description: input.description.trim() || null,
    keywords: normalizeKeywords(input.keywords),
    liquipediaLink: input.liquipediaLink.trim() || null,
    socials,
    playerPovPhrase: input.playerPovPhrase.trim() || null,
  };
}

export async function createTournament(input: TournamentInput): Promise<TournamentResult> {
  const actorUserId = await requireTournamentsActor();

  const fieldErrors = await validateTournament(input);
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  const values = coreColumns(input);
  const created = await db.transaction(async (tx) => {
    const [row] = await tx.insert(tournaments).values(values).returning({ id: tournaments.id });
    if (!row) throw new Error("Insert returned no row");
    await logActivity({ subject: "tournament", subjectId: row.id, event: "created", description: `Created tournament #${row.id} (${values.name})`, actorUserId }, tx);
    return row;
  });
  updateTag(HOME_TOURNAMENTS_TAG);
  updateTag(TOURNAMENT_FACETS_TAG);

  return { ok: true, id: created.id };
}

export async function updateTournament(id: number, input: TournamentInput): Promise<TournamentResult> {
  const actorUserId = await requireTournamentsActor();

  const [existingRow] = await db.select().from(tournaments).where(eq(tournaments.id, id)).limit(1);
  if (!existingRow) return { ok: false, fieldErrors: { name: "notFound" } };

  const fieldErrors = await validateTournament(input);
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  const values = coreColumns(input);
  await db.transaction(async (tx) => {
    await tx.update(tournaments).set(values).where(eq(tournaments.id, id));
    const changes = diffChanges(existingRow, values);
    if (Object.keys(changes).length > 0) {
      await logActivity({ subject: "tournament", subjectId: id, event: "updated", description: `Updated tournament #${id} (${values.name})`, actorUserId, changes }, tx);
    }
  });
  updateTag(HOME_TOURNAMENTS_TAG);
  updateTag(TOURNAMENT_FACETS_TAG);

  return { ok: true, id };
}

export type ToggleActiveResult = { ok: true; active: boolean } | { ok: false; error: "notFound" };

export async function toggleTournamentActive(id: number): Promise<ToggleActiveResult> {
  const actorUserId = await requireTournamentsActor();

  const [existing] = await db.select({ id: tournaments.id, active: tournaments.active }).from(tournaments).where(eq(tournaments.id, id)).limit(1);
  if (!existing) return { ok: false, error: "notFound" };

  const active = !existing.active;
  await db.transaction(async (tx) => {
    await tx.update(tournaments).set({ active }).where(eq(tournaments.id, id));
    await logActivity(
      { subject: "tournament", subjectId: id, event: "updated", description: `${active ? "Activated" : "Deactivated"} tournament #${id}`, actorUserId, changes: { active: { old: existing.active, new: active } } },
      tx
    );
  });
  updateTag(HOME_TOURNAMENTS_TAG);
  updateTag(TOURNAMENT_FACETS_TAG);

  return { ok: true, active };
}

export type DeleteTournamentResult = { ok: true } | { ok: false; error: "notFound" | "hasPlayedMatches" };

export async function deleteTournament(id: number): Promise<DeleteTournamentResult> {
  const actorUserId = await requireTournamentsActor();

  const [existing] = await db.select({ id: tournaments.id, name: tournaments.name }).from(tournaments).where(eq(tournaments.id, id)).limit(1);
  if (!existing) return { ok: false, error: "notFound" };

  try {
    await db.transaction(async (tx) => {
      await tx.delete(tournaments).where(eq(tournaments.id, id));
      await logActivity({ subject: "tournament", subjectId: id, event: "deleted", description: `Deleted tournament #${id} (${existing.name})`, actorUserId }, tx);
    });
  } catch (err) {
    // Known schema gap (documented in SUIVI.md): matches.entrant_*_id has no
    // ON DELETE, so a tournament with matches that reference real entrants
    // can't cascade-delete cleanly — surface a precise error instead of a
    // raw Postgres FK violation reaching the UI.
    const code = (err as { cause?: { code?: string } }).cause?.code;
    if (code === "23503") return { ok: false, error: "hasPlayedMatches" };
    throw err;
  }
  updateTag(HOME_TOURNAMENTS_TAG);
  updateTag(TOURNAMENT_FACETS_TAG);
  return { ok: true };
}
