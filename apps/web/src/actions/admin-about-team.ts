/**
 * GC-Stats - admin-about-team
 *
 * Admin server actions managing the "About" page team section: team
 * categories and member settings shown on the public about/team page.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use server";

import { eq } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { aboutTeamCategories, aboutTeamMemberSettings, users, PERMISSIONS } from "@gc-stats/db";
import { requireActorPermission } from "@/lib/rbac";

async function requireAboutActor(): Promise<void> {
  // Re-checked here, not just relied on from the /admin layout guard — a
  // server action is reachable as its own POST endpoint regardless of which
  // page rendered the form that calls it.
  await requireActorPermission(PERMISSIONS.aboutManage);
}

const KEY_RE = /^[a-z0-9][a-z0-9-]{0,49}$/;

export type CategoryField = "key" | "labelFr" | "labelEn" | "order";
export type CategoryFieldErrors = Partial<Record<CategoryField, string>>;
export type CategoryResult = { ok: true } | { ok: false; fieldErrors: CategoryFieldErrors };

export type SaveAboutTeamCategoryInput = {
  key: string;
  isNew: boolean;
  labelFr: string;
  labelEn: string;
  order: string;
};

export async function saveAboutTeamCategory(input: SaveAboutTeamCategoryInput): Promise<CategoryResult> {
  await requireAboutActor();

  const fieldErrors: CategoryFieldErrors = {};

  const key = input.key.trim();
  if (!KEY_RE.test(key)) fieldErrors.key = "invalidKey";

  const labelFr = input.labelFr.trim();
  const labelEn = input.labelEn.trim();
  if (!labelFr) fieldErrors.labelFr = "required";
  else if (labelFr.length > 100) fieldErrors.labelFr = "tooLong";
  if (!labelEn) fieldErrors.labelEn = "required";
  else if (labelEn.length > 100) fieldErrors.labelEn = "tooLong";

  const orderNum = input.order.trim() === "" ? 0 : Number(input.order);
  if (!Number.isInteger(orderNum) || orderNum < 0) fieldErrors.order = "invalid";

  if (input.isNew) {
    const [existing] = await db.select({ id: aboutTeamCategories.id }).from(aboutTeamCategories).where(eq(aboutTeamCategories.key, key)).limit(1);
    if (existing) fieldErrors.key = "keyTaken";
  }

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  const label = { fr: labelFr, en: labelEn };

  await db
    .insert(aboutTeamCategories)
    .values({ key, label, order: orderNum })
    .onConflictDoUpdate({ target: aboutTeamCategories.key, set: { label, order: orderNum } });

  return { ok: true };
}

export type DeleteCategoryResult = { ok: true } | { ok: false; error: "notFound" };

export async function deleteAboutTeamCategory(id: number): Promise<DeleteCategoryResult> {
  await requireAboutActor();

  const [existing] = await db.select({ id: aboutTeamCategories.id }).from(aboutTeamCategories).where(eq(aboutTeamCategories.id, id)).limit(1);
  if (!existing) return { ok: false, error: "notFound" };

  // Members referencing this category fall back to "uncategorized" (FK ON DELETE SET NULL), never orphaned.
  await db.delete(aboutTeamCategories).where(eq(aboutTeamCategories.id, id));
  return { ok: true };
}

export type MemberField = "displayRoleFr" | "displayRoleEn" | "order";
export type MemberFieldErrors = Partial<Record<MemberField, string>>;
export type MemberResult =
  | { ok: true }
  | { ok: false; fieldErrors: MemberFieldErrors }
  | { ok: false; error: "notFound" };

export type SaveAboutTeamMemberInput = {
  userId: string;
  categoryId: number | null;
  displayRoleFr: string;
  displayRoleEn: string;
  isVisible: boolean;
  order: string;
};

export async function saveAboutTeamMemberSettings(input: SaveAboutTeamMemberInput): Promise<MemberResult> {
  await requireAboutActor();

  const fieldErrors: MemberFieldErrors = {};

  const displayRoleFr = input.displayRoleFr.trim();
  const displayRoleEn = input.displayRoleEn.trim();
  const hasDisplayRole = displayRoleFr !== "" || displayRoleEn !== "";
  if (hasDisplayRole && !displayRoleFr) fieldErrors.displayRoleFr = "required";
  if (hasDisplayRole && !displayRoleEn) fieldErrors.displayRoleEn = "required";
  if (displayRoleFr.length > 100) fieldErrors.displayRoleFr = "tooLong";
  if (displayRoleEn.length > 100) fieldErrors.displayRoleEn = "tooLong";

  const orderNum = input.order.trim() === "" ? 0 : Number(input.order);
  if (!Number.isInteger(orderNum) || orderNum < 0) fieldErrors.order = "invalid";

  const [targetUser] = await db.select({ id: users.id }).from(users).where(eq(users.id, input.userId)).limit(1);
  if (!targetUser) return { ok: false, error: "notFound" };

  if (input.categoryId !== null) {
    const [category] = await db.select({ id: aboutTeamCategories.id }).from(aboutTeamCategories).where(eq(aboutTeamCategories.id, input.categoryId)).limit(1);
    if (!category) return { ok: false, error: "notFound" };
  }

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  const displayRole = hasDisplayRole ? { fr: displayRoleFr, en: displayRoleEn } : null;

  await db
    .insert(aboutTeamMemberSettings)
    .values({
      userId: input.userId,
      categoryId: input.categoryId,
      displayRole,
      isVisible: input.isVisible,
      order: orderNum,
    })
    .onConflictDoUpdate({
      target: aboutTeamMemberSettings.userId,
      set: { categoryId: input.categoryId, displayRole, isVisible: input.isVisible, order: orderNum },
    });

  return { ok: true };
}
