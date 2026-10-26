/**
 * GC-Stats - liquipedia-broadcast-import
 *
 * Admin server actions that turn the Talent section of a Liquipedia
 * tournament page into production credits on the tournament.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use server";

import { and, eq, inArray, sql } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { liquipediaPersonNames, organizations, people, productionCredits, tournaments, PERMISSIONS } from "@gc-stats/db";
import { requireActorPermission } from "@/lib/rbac";
import { logActivity } from "@/lib/activity-log";
import { parseBroadcasterCards, type BroadcastCredit } from "@/lib/liquipedia-broadcast-wikicode";
import { validateLiquipediaName } from "@/lib/liquipedia-name-validation";

const MAX_WIKICODE_LENGTH = 200_000;
const MAX_ROWS = 300;
const MAX_CREDITS_PER_ROW = 30;

export type BroadcastPreviewRow = {
  name: string;
  handle: string;
  credits: BroadcastCredit[];
  /** Person found by Liquipedia name, else by an unambiguous handle. */
  person: { id: number; handle: string } | null;
  /** Credits already on the tournament for the matched person. */
  alreadyCredited: number;
};

export type BroadcastPreviewResult = { ok: true; rows: BroadcastPreviewRow[] } | { ok: false; error: "invalid" | "tooLong" | "noCards" };

export async function previewBroadcastImport(tournamentId: number, wikicode: string): Promise<BroadcastPreviewResult> {
  await requireActorPermission(PERMISSIONS.tournamentsManage);
  if (!Number.isInteger(tournamentId) || typeof wikicode !== "string") return { ok: false, error: "invalid" };
  if (wikicode.length > MAX_WIKICODE_LENGTH) return { ok: false, error: "tooLong" };

  const talents = parseBroadcasterCards(wikicode).slice(0, MAX_ROWS);
  if (talents.length === 0) return { ok: false, error: "noCards" };

  const names = talents.map((t) => t.name.toLowerCase());
  const handles = talents.map((t) => t.handle.toLowerCase());
  const [mapped, byHandle] = await Promise.all([
    db
      .select({ id: people.id, handle: people.handle, name: liquipediaPersonNames.name })
      .from(liquipediaPersonNames)
      .innerJoin(people, eq(people.id, liquipediaPersonNames.personId))
      .where(inArray(sql`lower(${liquipediaPersonNames.name})`, names)),
    db.select({ id: people.id, handle: people.handle }).from(people).where(inArray(sql`lower(${people.handle})`, handles)),
  ]);

  const personByName = new Map(mapped.map((r) => [r.name.toLowerCase(), { id: r.id, handle: r.handle }]));
  const handleGroups = new Map<string, { id: number; handle: string }[]>();
  for (const row of byHandle) {
    const key = row.handle.toLowerCase();
    handleGroups.set(key, [...(handleGroups.get(key) ?? []), row]);
  }

  const resolved = talents.map((talent) => {
    const candidates = handleGroups.get(talent.handle.toLowerCase()) ?? [];
    return personByName.get(talent.name.toLowerCase()) ?? (candidates.length === 1 ? candidates[0]! : null);
  });

  const personIds = resolved.filter((p): p is { id: number; handle: string } => p !== null).map((p) => p.id);
  const existing = personIds.length
    ? await db
        .select({ personId: productionCredits.personId })
        .from(productionCredits)
        .where(and(eq(productionCredits.tournamentId, tournamentId), inArray(productionCredits.personId, personIds)))
    : [];
  const creditCount = new Map<number, number>();
  for (const row of existing) creditCount.set(row.personId, (creditCount.get(row.personId) ?? 0) + 1);

  return {
    ok: true,
    rows: talents.map((talent, index) => ({
      ...talent,
      person: resolved[index] ?? null,
      alreadyCredited: resolved[index] ? (creditCount.get(resolved[index]!.id) ?? 0) : 0,
    })),
  };
}

export type BroadcastImportRow = { name: string; personId: number | null; organizationId: number | null; credits: BroadcastCredit[] };

export type BroadcastRowError = "personRequired" | "personNotFound" | "organizationRequired" | "organizationNotFound" | "invalidName" | "invalidCredits";

export type BroadcastImportResult =
  | { ok: true; created: number; skipped: number; mapped: number }
  | { ok: false; error?: "empty" | "tooMany" | "tournamentNotFound"; rowErrors: Record<string, BroadcastRowError> };

export async function importBroadcastCredits(tournamentId: number, rows: BroadcastImportRow[]): Promise<BroadcastImportResult> {
  const { userId } = await requireActorPermission(PERMISSIONS.tournamentsManage);

  if (!Number.isInteger(tournamentId) || !Array.isArray(rows) || rows.length === 0) return { ok: false, error: "empty", rowErrors: {} };
  if (rows.length > MAX_ROWS) return { ok: false, error: "tooMany", rowErrors: {} };

  const [tournament] = await db.select({ id: tournaments.id }).from(tournaments).where(eq(tournaments.id, tournamentId)).limit(1);
  if (!tournament) return { ok: false, error: "tournamentNotFound", rowErrors: {} };

  const rowErrors: Record<string, BroadcastRowError> = {};
  const cleaned: { name: string; personId: number; organizationId: number; credits: BroadcastCredit[] }[] = [];
  for (const row of rows) {
    const name = typeof row?.name === "string" ? row.name.trim() : "";
    if (!name) continue;
    if (validateLiquipediaName(name)) {
      rowErrors[name] = "invalidName";
      continue;
    }
    if (!Number.isInteger(row.personId)) {
      rowErrors[name] = "personRequired";
      continue;
    }
    if (!Number.isInteger(row.organizationId)) {
      rowErrors[name] = "organizationRequired";
      continue;
    }
    const credits = Array.isArray(row.credits) ? row.credits : [];
    const valid = credits.length > 0 && credits.length <= MAX_CREDITS_PER_ROW && credits.every((c) => typeof c?.role === "string" && c.role.trim() !== "" && c.role.length <= 100 && (c.title === null || (typeof c.title === "string" && c.title.length <= 150)));
    if (!valid) {
      rowErrors[name] = "invalidCredits";
      continue;
    }
    cleaned.push({ name, personId: row.personId as number, organizationId: row.organizationId as number, credits: credits.map((c) => ({ role: c.role.trim(), title: c.title?.trim() || null })) });
  }

  const personIds = [...new Set(cleaned.map((r) => r.personId))];
  const found = new Set(personIds.length ? (await db.select({ id: people.id }).from(people).where(inArray(people.id, personIds))).map((p) => p.id) : []);
  for (const row of cleaned) if (!found.has(row.personId)) rowErrors[row.name] = "personNotFound";
  const organizationIds = [...new Set(cleaned.map((r) => r.organizationId))];
  const foundOrganizations = new Set(organizationIds.length ? (await db.select({ id: organizations.id }).from(organizations).where(inArray(organizations.id, organizationIds))).map((o) => o.id) : []);
  for (const row of cleaned) if (!rowErrors[row.name] && !foundOrganizations.has(row.organizationId)) rowErrors[row.name] = "organizationNotFound";
  if (Object.keys(rowErrors).length > 0) return { ok: false, rowErrors };
  if (cleaned.length === 0) return { ok: false, error: "empty", rowErrors: {} };

  return db.transaction(async (tx) => {
    const existing = await tx
      .select({ personId: productionCredits.personId, organizationId: productionCredits.organizationId, role: productionCredits.role, title: productionCredits.titleOverride })
      .from(productionCredits)
      .where(and(eq(productionCredits.tournamentId, tournamentId), inArray(productionCredits.personId, personIds)));
    const known = new Set(existing.map((c) => `${c.personId}:${c.organizationId}:${c.role}:${c.title ?? ""}`));

    const toInsert: (typeof productionCredits.$inferInsert)[] = [];
    let skipped = 0;
    for (const row of cleaned) {
      for (const credit of row.credits) {
        const key = `${row.personId}:${row.organizationId}:${credit.role}:${credit.title ?? ""}`;
        if (known.has(key)) {
          skipped += 1;
          continue;
        }
        known.add(key);
        toInsert.push({ personId: row.personId, organizationId: row.organizationId, role: credit.role, titleOverride: credit.title, tournamentId });
      }
    }
    if (toInsert.length > 0) {
      await tx.insert(productionCredits).values(toInsert);
      await logActivity({ subject: "credit", subjectId: null, event: "created", description: `Imported ${toInsert.length} production credit(s) from Liquipedia on tournament #${tournamentId}`, actorUserId: userId, properties: { tournamentId, personIds, organizationIds } }, tx);
    }

    // Remember the Liquipedia page so the info import reads the profile, never taking a name or a person already mapped.
    const mappedPeople = new Set((await tx.select({ personId: liquipediaPersonNames.personId }).from(liquipediaPersonNames).where(inArray(liquipediaPersonNames.personId, personIds))).map((r) => r.personId));
    const takenNames = new Set((await tx.select({ name: liquipediaPersonNames.name }).from(liquipediaPersonNames).where(inArray(sql`lower(${liquipediaPersonNames.name})`, cleaned.map((r) => r.name.toLowerCase())))).map((r) => r.name.toLowerCase()));
    const newMappings: { personId: number; name: string }[] = [];
    for (const row of cleaned) {
      if (mappedPeople.has(row.personId) || takenNames.has(row.name.toLowerCase())) continue;
      mappedPeople.add(row.personId);
      takenNames.add(row.name.toLowerCase());
      newMappings.push({ personId: row.personId, name: row.name });
    }
    if (newMappings.length > 0) await tx.insert(liquipediaPersonNames).values(newMappings);

    return { ok: true as const, created: toInsert.length, skipped, mapped: newMappings.length };
  });
}
