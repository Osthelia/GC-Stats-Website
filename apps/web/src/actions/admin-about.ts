/**
 * GC-Stats - admin-about
 *
 * Admin server actions managing the public "About" page content: sections
 * and projects, each with FR/EN text fields.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use server";

import { eq } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { aboutSections, aboutProjects, PERMISSIONS } from "@gc-stats/db";
import { requireActorPermission } from "@/lib/rbac";
import { ABOUT_PROJECT_TYPES } from "@/lib/admin-about";
import { isValidUrl } from "@/lib/admin-validation";

async function requireAboutActor(): Promise<void> {
  // Re-checked here, not just relied on from the /admin layout guard — a
  // server action is reachable as its own POST endpoint regardless of which
  // page rendered the form that calls it.
  await requireActorPermission(PERMISSIONS.aboutManage);
}

const KEY_RE = /^[a-z0-9][a-z0-9-]{0,49}$/;

export type SectionField = "key" | "titleFr" | "titleEn" | "contentFr" | "contentEn" | "order";
export type SectionFieldErrors = Partial<Record<SectionField, string>>;
export type SectionResult = { ok: true } | { ok: false; fieldErrors: SectionFieldErrors };

export type SaveAboutSectionInput = {
  key: string;
  isNew: boolean;
  titleFr: string;
  titleEn: string;
  contentFr: string;
  contentEn: string;
  order: string;
};

export async function saveAboutSection(input: SaveAboutSectionInput): Promise<SectionResult> {
  await requireAboutActor();

  const fieldErrors: SectionFieldErrors = {};

  const key = input.key.trim();
  if (!KEY_RE.test(key)) fieldErrors.key = "invalidKey";

  const titleFr = input.titleFr.trim();
  const titleEn = input.titleEn.trim();
  if (!titleFr) fieldErrors.titleFr = "required";
  if (!titleEn) fieldErrors.titleEn = "required";
  if (titleFr.length > 255) fieldErrors.titleFr = "tooLong";
  if (titleEn.length > 255) fieldErrors.titleEn = "tooLong";

  const contentFr = input.contentFr.trim();
  const contentEn = input.contentEn.trim();
  if (contentFr.length > 5000) fieldErrors.contentFr = "tooLong";
  if (contentEn.length > 5000) fieldErrors.contentEn = "tooLong";

  const orderNum = input.order.trim() === "" ? 0 : Number(input.order);
  if (!Number.isInteger(orderNum) || orderNum < 0) fieldErrors.order = "invalid";

  if (input.isNew) {
    const [existing] = await db.select({ id: aboutSections.id }).from(aboutSections).where(eq(aboutSections.key, key)).limit(1);
    if (existing) fieldErrors.key = "keyTaken";
  }

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  const title = { fr: titleFr, en: titleEn };
  const content = { fr: contentFr, en: contentEn };

  await db
    .insert(aboutSections)
    .values({ key, title, content, order: orderNum })
    .onConflictDoUpdate({ target: aboutSections.key, set: { title, content, order: orderNum } });

  return { ok: true };
}

export type DeleteSectionResult = { ok: true } | { ok: false; error: "notFound" };

export async function deleteAboutSection(id: number): Promise<DeleteSectionResult> {
  await requireAboutActor();

  const [existing] = await db.select({ id: aboutSections.id }).from(aboutSections).where(eq(aboutSections.id, id)).limit(1);
  if (!existing) return { ok: false, error: "notFound" };

  await db.delete(aboutSections).where(eq(aboutSections.id, id));
  return { ok: true };
}

export type ProjectField = "name" | "type" | "descriptionFr" | "descriptionEn" | "url" | "logoUrl" | "order";
export type ProjectFieldErrors = Partial<Record<ProjectField, string>>;
export type ProjectResult = { ok: true; id: number } | { ok: false; fieldErrors: ProjectFieldErrors };

export type ProjectInput = {
  name: string;
  type: string;
  descriptionFr: string;
  descriptionEn: string;
  url: string;
  logoUrl: string;
  order: string;
  isActive: boolean;
};

function validateProject(input: ProjectInput): { fieldErrors: ProjectFieldErrors; orderNum: number } {
  const fieldErrors: ProjectFieldErrors = {};

  const name = input.name.trim();
  if (!name) fieldErrors.name = "required";
  else if (name.length > 100) fieldErrors.name = "tooLong";

  if (!(ABOUT_PROJECT_TYPES as readonly string[]).includes(input.type)) fieldErrors.type = "invalid";

  const descriptionFr = input.descriptionFr.trim();
  const descriptionEn = input.descriptionEn.trim();
  if (descriptionFr.length > 2000) fieldErrors.descriptionFr = "tooLong";
  if (descriptionEn.length > 2000) fieldErrors.descriptionEn = "tooLong";

  const url = input.url.trim();
  if (url && !isValidUrl(url)) fieldErrors.url = "invalid";
  else if (url.length > 255) fieldErrors.url = "tooLong";

  const logoUrl = input.logoUrl.trim();
  if (logoUrl && !isValidUrl(logoUrl)) fieldErrors.logoUrl = "invalid";
  else if (logoUrl.length > 255) fieldErrors.logoUrl = "tooLong";

  const orderNum = input.order.trim() === "" ? 0 : Number(input.order);
  if (!Number.isInteger(orderNum) || orderNum < 0) fieldErrors.order = "invalid";

  return { fieldErrors, orderNum };
}

export async function createAboutProject(input: ProjectInput): Promise<ProjectResult> {
  await requireAboutActor();

  const { fieldErrors, orderNum } = validateProject(input);
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  const [created] = await db
    .insert(aboutProjects)
    .values({
      name: input.name.trim(),
      type: input.type,
      description: { fr: input.descriptionFr.trim(), en: input.descriptionEn.trim() },
      url: input.url.trim() || null,
      logoUrl: input.logoUrl.trim() || null,
      order: orderNum,
      isActive: input.isActive,
    })
    .returning({ id: aboutProjects.id });
  if (!created) throw new Error("Insert returned no row");

  return { ok: true, id: created.id };
}

export async function updateAboutProject(id: number, input: ProjectInput): Promise<ProjectResult> {
  await requireAboutActor();

  const { fieldErrors, orderNum } = validateProject(input);

  const [existing] = await db.select({ id: aboutProjects.id }).from(aboutProjects).where(eq(aboutProjects.id, id)).limit(1);
  if (!existing) return { ok: false, fieldErrors: { name: "notFound" } };

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  await db
    .update(aboutProjects)
    .set({
      name: input.name.trim(),
      type: input.type,
      description: { fr: input.descriptionFr.trim(), en: input.descriptionEn.trim() },
      url: input.url.trim() || null,
      logoUrl: input.logoUrl.trim() || null,
      order: orderNum,
      isActive: input.isActive,
    })
    .where(eq(aboutProjects.id, id));

  return { ok: true, id };
}

export type DeleteProjectResult = { ok: true } | { ok: false; error: "notFound" };

export async function deleteAboutProject(id: number): Promise<DeleteProjectResult> {
  await requireAboutActor();

  const [existing] = await db.select({ id: aboutProjects.id }).from(aboutProjects).where(eq(aboutProjects.id, id)).limit(1);
  if (!existing) return { ok: false, error: "notFound" };

  await db.delete(aboutProjects).where(eq(aboutProjects.id, id));
  return { ok: true };
}
