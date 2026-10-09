/**
 * GC-Stats - admin-emotes
 *
 * Admin server actions for chat/forum emotes: create, update, image upload
 * and deletion. Only images stored under the uploads prefix are ever
 * deleted from storage, never a migrated or externally hosted URL.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use server";

import { and, eq, ne } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { emotes, teams, PERMISSIONS } from "@gc-stats/db";
import { validateImageBuffer, isSupportedEmoteMime, storeEmoteImage, copyTeamLogoAsEmote, deleteEmoteImageFile, MAX_IMAGE_BYTES } from "@gc-stats/storage";
import { requireActorPermission } from "@/lib/rbac";
import { currentLogo, getEntityLogos } from "@/lib/admin-logos";
import { isValidUrl } from "@/lib/admin-validation";
import { EMOTE_SOURCE_RE } from "@/lib/emote-sources";

async function requireEmotesActor(): Promise<void> {
  // Re-checked here, not just relied on from the /admin layout guard — a
  // server action is reachable as its own POST endpoint regardless of which
  // page rendered the form that calls it.
  await requireActorPermission(PERMISSIONS.emotesManage);
}

/** Only files uploadEmoteImage produced live under this prefix — a migrated V1 key or a hand-typed external URL must never be deleted from storage. */
function uploadedEmoteKey(imagePath: string): string | null {
  const marker = "emotes/uploads/";
  const index = imagePath.indexOf(marker);
  return index === -1 ? null : imagePath.slice(index);
}

export type EmoteField = "name" | "imagePath" | "source";
export type EmoteFieldErrors = Partial<Record<EmoteField, string>>;
export type EmoteResult = { ok: true; id: number } | { ok: false; fieldErrors: EmoteFieldErrors };

export type EmoteInput = {
  name: string;
  imagePath: string;
  source: string;
  isActive: boolean;
};

async function validateEmote(input: EmoteInput, excludeId?: number): Promise<EmoteFieldErrors> {
  const fieldErrors: EmoteFieldErrors = {};

  const name = input.name.trim();
  if (!name) fieldErrors.name = "required";
  else if (name.length > 80) fieldErrors.name = "tooLong";

  const imagePath = input.imagePath.trim();
  if (!imagePath) fieldErrors.imagePath = "required";
  else if (!isValidUrl(imagePath)) fieldErrors.imagePath = "invalid";

  if (!EMOTE_SOURCE_RE.test(input.source.trim())) fieldErrors.source = "invalid";

  if (name && !fieldErrors.name) {
    const conditions = [eq(emotes.name, name)];
    if (excludeId !== undefined) conditions.push(ne(emotes.id, excludeId));
    const [existing] = await db
      .select({ id: emotes.id })
      .from(emotes)
      .where(and(...conditions))
      .limit(1);
    if (existing) fieldErrors.name = "nameTaken";
  }

  return fieldErrors;
}

export async function createEmote(input: EmoteInput): Promise<EmoteResult> {
  await requireEmotesActor();

  const fieldErrors = await validateEmote(input);
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  const [created] = await db
    .insert(emotes)
    .values({ name: input.name.trim(), imagePath: input.imagePath.trim(), source: input.source.trim(), isActive: input.isActive })
    .returning({ id: emotes.id });
  if (!created) throw new Error("Insert returned no row");

  return { ok: true, id: created.id };
}

export async function updateEmote(id: number, input: EmoteInput): Promise<EmoteResult> {
  await requireEmotesActor();

  const [existingRow] = await db.select({ id: emotes.id, imagePath: emotes.imagePath }).from(emotes).where(eq(emotes.id, id)).limit(1);
  if (!existingRow) return { ok: false, fieldErrors: { name: "notFound" } };

  const fieldErrors = await validateEmote(input, id);
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  const imagePath = input.imagePath.trim();

  await db
    .update(emotes)
    .set({ name: input.name.trim(), imagePath, source: input.source.trim(), isActive: input.isActive })
    .where(eq(emotes.id, id));

  if (imagePath !== existingRow.imagePath) {
    const oldKey = uploadedEmoteKey(existingRow.imagePath);
    if (oldKey) await deleteEmoteImageFile(oldKey).catch(() => {});
  }

  return { ok: true, id };
}

export type UploadEmoteImageResult = { ok: true; url: string } | { ok: false; error: "required" | "tooLarge" | "invalidImage" | "unsupportedType" };

export async function uploadEmoteImage(formData: FormData): Promise<UploadEmoteImageResult> {
  await requireEmotesActor();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "required" };
  if (file.size > MAX_IMAGE_BYTES) return { ok: false, error: "tooLarge" };
  if (!isSupportedEmoteMime(file.type)) return { ok: false, error: "unsupportedType" };

  const buffer = Buffer.from(await file.arrayBuffer());
  const validation = await validateImageBuffer(buffer);
  if (!validation.ok) return { ok: false, error: validation.error === "empty" ? "required" : validation.error === "processingFailed" ? "invalidImage" : validation.error };

  const stored = await storeEmoteImage(buffer, file.type);
  return { ok: true, url: stored.url };
}

export type CopyTeamLogoResult =
  | { ok: true; url: string; teamName: string }
  | { ok: false; error: "required" | "teamNotFound" | "teamNoLogo" };

/** V1 behaviour: the emote gets a frozen copy of the team's current logo, source "teams". */
export async function copyTeamLogoToEmote(teamId: number): Promise<CopyTeamLogoResult> {
  await requireEmotesActor();

  if (!Number.isInteger(teamId) || teamId <= 0) return { ok: false, error: "required" };

  const [team] = await db.select({ id: teams.id, name: teams.name }).from(teams).where(eq(teams.id, teamId)).limit(1);
  if (!team) return { ok: false, error: "teamNotFound" };

  const logo = currentLogo(await getEntityLogos("team", team.id));
  if (!logo) return { ok: false, error: "teamNoLogo" };

  const stored = await copyTeamLogoAsEmote(logo.id);
  return { ok: true, url: stored.url, teamName: team.name };
}

export type DeleteEmoteResult = { ok: true } | { ok: false; error: "notFound" };

export async function deleteEmote(id: number): Promise<DeleteEmoteResult> {
  await requireEmotesActor();

  const [existing] = await db.select({ id: emotes.id, imagePath: emotes.imagePath }).from(emotes).where(eq(emotes.id, id)).limit(1);
  if (!existing) return { ok: false, error: "notFound" };

  await db.delete(emotes).where(eq(emotes.id, id));

  const oldKey = uploadedEmoteKey(existing.imagePath);
  if (oldKey) await deleteEmoteImageFile(oldKey).catch(() => {});

  return { ok: true };
}
