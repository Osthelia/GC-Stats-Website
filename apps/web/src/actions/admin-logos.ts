/**
 * GC-Stats - admin-logos
 *
 * Admin server actions for team/organization/player logo uploads and
 * history. Mirrors V1's dated logo history semantics: uploading opens a new
 * "current" period (closing whatever was previously open) or inserts a
 * historical entry when an "until" date is given.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use server";

import { and, eq, isNull, ne, sql } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { logos, people, teams, organizations, PERMISSIONS } from "@gc-stats/db";
import { storeLogoPair, replaceLogoFiles, deleteLogoFiles, validateImageBuffer, MAX_IMAGE_BYTES } from "@gc-stats/storage";
import { requireActorPermission } from "@/lib/rbac";
import { openRangeFrom, closeRange } from "@/lib/daterange";
import type { LogoEntityType } from "@/lib/admin-logos";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const THEMES = ["light", "dark"] as const;

// Re-checked here, not just relied on from the /admin layout guard — server
// actions are reachable directly (as their own POST endpoint) regardless of
// which page rendered the form that calls them.
function permissionFor(entityType: LogoEntityType): string {
  if (entityType === "team") return PERMISSIONS.teamsEdit;
  if (entityType === "organization") return PERMISSIONS.organizationsEdit;
  return PERMISSIONS.playersEdit;
}

async function entityExists(entityType: LogoEntityType, entityId: number): Promise<boolean> {
  if (entityType === "team") return (await db.select({ id: teams.id }).from(teams).where(eq(teams.id, entityId)).limit(1)).length > 0;
  if (entityType === "organization") return (await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.id, entityId)).limit(1)).length > 0;
  return (await db.select({ id: people.id }).from(people).where(eq(people.id, entityId)).limit(1)).length > 0;
}

export type UploadLogoField = "file" | "theme" | "from" | "until";
export type UploadLogoFieldErrors = Partial<Record<UploadLogoField, string>>;
export type UploadLogoResult = { ok: true } | { ok: false; fieldErrors: UploadLogoFieldErrors };

/**
 * Mirrors V1's LogoUploadService::storeLogoPair + HasLogo history semantics
 * (acceptWithHistory): stores a fresh full+thumbnail WebP pair under a new
 * uuid, then either opens a new "current" period (closing whatever was
 * previously open for the same entity+theme) or inserts a dated historical
 * entry when `until` is given.
 */
export async function uploadEntityLogo(entityType: LogoEntityType, entityId: number, formData: FormData): Promise<UploadLogoResult> {
  await requireActorPermission(permissionFor(entityType));

  const fieldErrors: UploadLogoFieldErrors = {};

  const file = formData.get("file");
  const themeRaw = String(formData.get("theme") ?? "").trim();
  const from = String(formData.get("from") ?? "").trim() || new Date().toISOString().slice(0, 10);
  const until = String(formData.get("until") ?? "").trim();

  if (!(file instanceof File) || file.size === 0) fieldErrors.file = "required";
  else if (file.size > MAX_IMAGE_BYTES) fieldErrors.file = "tooLarge";

  let theme: string | null = null;
  if (themeRaw) {
    if (!(THEMES as readonly string[]).includes(themeRaw)) fieldErrors.theme = "invalid";
    else theme = themeRaw;
  }

  if (!DATE_RE.test(from)) fieldErrors.from = "invalidDate";
  if (until && !DATE_RE.test(until)) fieldErrors.until = "invalidDate";
  if (!fieldErrors.from && !fieldErrors.until && until && until <= from) fieldErrors.until = "beforeStart";

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  // The page that rendered this form may be stale — confirm the entity
  // still exists before doing any real work (upload, DB write).
  if (!(await entityExists(entityType, entityId))) return { ok: false, fieldErrors: { file: "notFound" } };

  const buffer = Buffer.from(await (file as File).arrayBuffer());
  const validation = await validateImageBuffer(buffer);
  if (!validation.ok) return { ok: false, fieldErrors: { file: validation.error } };

  const stored = await storeLogoPair(entityType, buffer);

  const period = until ? `[${from},${until})` : openRangeFrom(from);
  const isOngoing = !until;

  try {
    await db.transaction(async (tx) => {
      if (isOngoing) {
        const openElsewhere = await tx
          .select({ id: logos.id, period: logos.period })
          .from(logos)
          .where(
            and(
              eq(logos.entityType, entityType),
              eq(logos.entityId, entityId),
              theme ? eq(logos.theme, theme) : isNull(logos.theme),
              sql`${logos.period} @> CURRENT_TIMESTAMP`
            )
          );
        for (const row of openElsewhere) {
          await tx.update(logos).set({ period: closeRange(row.period, from) }).where(eq(logos.id, row.id));
        }
      }

      await tx.insert(logos).values({ id: stored.id, entityType, entityId, period, theme, isVisible: true });
    });
  } catch (error) {
    // Don't leave orphaned files in the bucket if the DB write failed.
    await deleteLogoFiles(entityType, stored.id).catch(() => {});
    throw error;
  }

  return { ok: true };
}

export type UpdateLogoField = "file" | "theme" | "from" | "until";
export type UpdateLogoFieldErrors = Partial<Record<UpdateLogoField, string>>;
export type UpdateLogoResult = { ok: true } | { ok: false; fieldErrors: UpdateLogoFieldErrors };

/**
 * Edits an existing logo entry in place (theme/dates), and optionally the
 * image itself — replaced at the same uuid/keys via replaceLogoFiles, so
 * the URL never changes and nothing else needs updating. Unlike upload,
 * the file is optional here (omit it to just edit dates/theme).
 */
export async function updateEntityLogo(entityType: LogoEntityType, logoId: string, formData: FormData): Promise<UpdateLogoResult> {
  await requireActorPermission(permissionFor(entityType));

  const [existing] = await db
    .select({ id: logos.id, entityId: logos.entityId })
    .from(logos)
    .where(and(eq(logos.id, logoId), eq(logos.entityType, entityType)))
    .limit(1);
  if (!existing) return { ok: false, fieldErrors: { file: "notFound" } };

  const fieldErrors: UpdateLogoFieldErrors = {};

  const file = formData.get("file");
  const themeRaw = String(formData.get("theme") ?? "").trim();
  const from = String(formData.get("from") ?? "").trim();
  const until = String(formData.get("until") ?? "").trim();

  const hasFile = file instanceof File && file.size > 0;
  if (file instanceof File && file.size > 0 && file.size > MAX_IMAGE_BYTES) fieldErrors.file = "tooLarge";

  let theme: string | null = null;
  if (themeRaw) {
    if (!(THEMES as readonly string[]).includes(themeRaw)) fieldErrors.theme = "invalid";
    else theme = themeRaw;
  }

  if (!DATE_RE.test(from)) fieldErrors.from = "invalidDate";
  if (until && !DATE_RE.test(until)) fieldErrors.until = "invalidDate";
  if (!fieldErrors.from && !fieldErrors.until && until && until <= from) fieldErrors.until = "beforeStart";

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  let buffer: Buffer | null = null;
  if (hasFile) {
    const uploaded = Buffer.from(await (file as File).arrayBuffer());
    const validation = await validateImageBuffer(uploaded);
    if (!validation.ok) return { ok: false, fieldErrors: { file: validation.error } };
    buffer = uploaded;
  }

  const period = until ? `[${from},${until})` : openRangeFrom(from);
  const isOngoing = !until;

  await db.transaction(async (tx) => {
    if (isOngoing) {
      const openElsewhere = await tx
        .select({ id: logos.id, period: logos.period })
        .from(logos)
        .where(
          and(
            eq(logos.entityType, entityType),
            eq(logos.entityId, existing.entityId),
            theme ? eq(logos.theme, theme) : isNull(logos.theme),
            ne(logos.id, logoId),
            sql`${logos.period} @> CURRENT_TIMESTAMP`
          )
        );
      for (const row of openElsewhere) {
        await tx.update(logos).set({ period: closeRange(row.period, from) }).where(eq(logos.id, row.id));
      }
    }

    await tx.update(logos).set({ theme, period }).where(eq(logos.id, logoId));
  });

  if (buffer) await replaceLogoFiles(entityType, logoId, buffer);

  return { ok: true };
}

export type DeleteLogoResult = { ok: true } | { ok: false; error: "notFound" };

export async function deleteEntityLogo(entityType: LogoEntityType, logoId: string): Promise<DeleteLogoResult> {
  await requireActorPermission(permissionFor(entityType));

  const [row] = await db
    .select({ id: logos.id })
    .from(logos)
    .where(and(eq(logos.id, logoId), eq(logos.entityType, entityType)))
    .limit(1);
  if (!row) return { ok: false, error: "notFound" };

  await db.delete(logos).where(eq(logos.id, logoId));
  await deleteLogoFiles(entityType, logoId).catch(() => {});

  return { ok: true };
}
