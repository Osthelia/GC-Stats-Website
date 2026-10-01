/**
 * GC-Stats - admin-organizations
 *
 * Admin server actions for organizations: profile edits, member roster,
 * and access grants (which admin users can manage which organization).
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use server";

import { and, eq, ne } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { organizations, users, PERMISSIONS, ALL_ORGANIZATION_PERMISSIONS } from "@gc-stats/db";
import { requireActorPermission } from "@/lib/rbac";
import { validateOrganizationProfileInput, type OrganizationProfileInput, type OrganizationProfileFieldErrors } from "@/lib/organization-profile-validation";
import {
  addOrganizationAccessEntry,
  updateOrganizationAccessRolesEntry,
  removeOrganizationAccessEntry,
  type AccessRoleSelection,
  type AddAccessFieldErrors,
  type AddAccessResult,
  type AccessEntryFieldErrors,
  type AccessEntryResult,
  type AccessActionResult,
} from "@/lib/organization-access-service";
import { addOrganizationMemberEntry, updateOrganizationMemberEntry, deleteOrganizationMembershipEntry, type AddMemberResult, type MemberEntryResult, type MembershipActionResult } from "@/lib/organization-membership-service";

// Re-checked here, not just relied on from the /admin layout guard — server
// actions are reachable directly (as their own POST endpoint) regardless of
// which page rendered the form that calls them.
async function requireOrgActorId(permission: string = PERMISSIONS.organizationsEdit): Promise<string> {
  const access = await requireActorPermission(permission);
  return access.userId;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function uniqueSlugFrom(name: string): Promise<string> {
  const base = slugify(name) || "organization";
  let candidate = base;
  let suffix = 2;
  // Small dataset (a handful of organizations today) — a loop is simpler and
  // just as correct as a single clever query here.
  while (true) {
    const [existing] = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.slug, candidate)).limit(1);
    if (!existing) return candidate;
    candidate = `${base}-${suffix++}`;
  }
}

export type CreateOrganizationInput = { name: string };
export type CreateOrganizationField = "name";
export type CreateOrganizationFieldErrors = Partial<Record<CreateOrganizationField, string>>;
export type CreateOrganizationResult = { ok: true; id: number } | { ok: false; fieldErrors: CreateOrganizationFieldErrors };

/** Quick-create from the admin organizations list — mirrors createTeam's shape (name required, everything else editable afterwards). */
export async function createOrganization(input: CreateOrganizationInput): Promise<CreateOrganizationResult> {
  await requireOrgActorId(PERMISSIONS.organizationsEdit);

  const fieldErrors: CreateOrganizationFieldErrors = {};
  const name = input.name.trim();
  if (!name) fieldErrors.name = "required";
  else if (name.length > 255) fieldErrors.name = "tooLong";

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  const slug = await uniqueSlugFrom(name);

  const [created] = await db
    .insert(organizations)
    .values({ name, slug, tags: [], socials: {}, maxPermissions: [] })
    .returning({ id: organizations.id });
  if (!created) throw new Error("Insert returned no row");

  return { ok: true, id: created.id };
}

export type { OrganizationProfileInput, OrganizationProfileField, OrganizationProfileFieldErrors } from "@/lib/organization-profile-validation";
export type OrganizationProfileResult = { ok: true } | { ok: false; fieldErrors: OrganizationProfileFieldErrors };

export async function updateOrganizationProfile(organizationId: number, input: OrganizationProfileInput): Promise<OrganizationProfileResult> {
  await requireOrgActorId();

  const validated = validateOrganizationProfileInput(input);
  const { fieldErrors, name, slug, countryCode, secondaryCountryCode, socials, tags } = validated;

  const [existing] = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.id, organizationId)).limit(1);
  if (!existing) return { ok: false, fieldErrors: { name: "notFound" } };

  if (!fieldErrors.slug) {
    const [slugTaken] = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(and(eq(organizations.slug, slug), ne(organizations.id, organizationId)))
      .limit(1);
    if (slugTaken) fieldErrors.slug = "slugTaken";
  }

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  await db
    .update(organizations)
    .set({ name, slug, countryCode: countryCode || null, secondaryCountryCode: secondaryCountryCode || null, socials, tags })
    .where(eq(organizations.id, organizationId));

  return { ok: true };
}

export type UpdateMaxPermissionsResult = { ok: true } | { ok: false; error: "notFound" };

/** The "access" side of the 2-level org edit (content vs. access) — sets the ceiling /dashboard's per-organization role system (organization_role_permissions) can ever grant this organization's own members. */
export async function updateOrganizationMaxPermissions(organizationId: number, maxPermissions: string[]): Promise<UpdateMaxPermissionsResult> {
  await requireActorPermission(PERMISSIONS.organizationsManageAccess);

  const [existing] = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.id, organizationId)).limit(1);
  if (!existing) return { ok: false, error: "notFound" };

  const allowed = new Set<string>(ALL_ORGANIZATION_PERMISSIONS);
  const ceiling = [...new Set(maxPermissions)].filter((p) => allowed.has(p));

  await db.update(organizations).set({ maxPermissions: ceiling }).where(eq(organizations.id, organizationId));
  return { ok: true };
}

export type DeleteOrganizationResult = { ok: true } | { ok: false; error: "notFound" };

/** Hard-deletes an organization. `organization_memberships` cascades and `production_credits.organization_id` is set null (schema) — no FK violation is expected here, unlike deleteTeam. */
export async function deleteOrganization(organizationId: number): Promise<DeleteOrganizationResult> {
  await requireActorPermission(PERMISSIONS.organizationsDelete);

  const [existing] = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.id, organizationId)).limit(1);
  if (!existing) return { ok: false, error: "notFound" };

  await db.delete(organizations).where(eq(organizations.id, organizationId));
  return { ok: true };
}

export type {
  MembershipActionResult,
  AddMemberField,
  AddMemberFieldErrors,
  AddMemberResult,
  MemberEntryField,
  MemberEntryFieldErrors,
  MemberEntryResult,
} from "@/lib/organization-membership-service";

/** "Owner" (V1's Publisher owner) is just a membership row with role='owner' — no separate table, see packages/db/src/schema/people.ts::organizationMemberships. Business logic lives in organization-membership-service.ts, shared with /dashboard's own member actions (actions/dashboard-organizations.ts) — this wrapper only owns the admin permission check. */
export async function addOrganizationMember(organizationId: number, personId: number | null, role: string, from: string, until: string): Promise<AddMemberResult> {
  await requireActorPermission(PERMISSIONS.organizationsManageAccess);
  return addOrganizationMemberEntry(organizationId, personId, role, from, until);
}

export async function updateOrganizationMember(membershipId: number, role: string, from: string, until: string): Promise<MemberEntryResult> {
  await requireActorPermission(PERMISSIONS.organizationsManageAccess);
  return updateOrganizationMemberEntry(membershipId, role, from, until);
}

export async function deleteOrganizationMembership(membershipId: number): Promise<MembershipActionResult> {
  await requireActorPermission(PERMISSIONS.organizationsManageAccess);
  return deleteOrganizationMembershipEntry(membershipId);
}

// --- Dashboard access (organization_access) --------------------------------
// Who can sign in to /dashboard for this organization, and with what role —
// a completely separate concept from the organization_memberships panel
// above (that one is a public credit roster, see schema/people.ts). Managed
// here from /admin (any organizationsManageAccess holder can grant/revoke,
// including 'owner') and, for non-owner roles only, from /dashboard itself
// (actions/dashboard-organizations.ts) by an org's own owner or a
// members.manage holder.

export type { AccessRoleSelection, AddAccessFieldErrors as AddOrgAccessFieldErrors, AddAccessResult as AddOrgAccessResult, AccessEntryFieldErrors as OrgAccessEntryFieldErrors, AccessEntryResult as OrgAccessEntryResult };

// An admin granting/editing access is trusted with the 'owner' role too
// (actorIsOwner: true) and never subject to assertCanModifyGrant
// (checkCanModify: false) — this isn't a per-organization actor whose own
// power could be inflated by it, unlike the /dashboard equivalent in
// actions/dashboard-organizations.ts.
export async function addOrganizationAccess(organizationId: number, userId: string | null, selection: AccessRoleSelection): Promise<AddAccessResult> {
  await requireActorPermission(PERMISSIONS.organizationsManageAccess);
  return addOrganizationAccessEntry(organizationId, userId, selection, true);
}

export async function updateOrganizationAccessRoles(organizationId: number, accessId: number, selection: AccessRoleSelection): Promise<AccessEntryResult> {
  await requireActorPermission(PERMISSIONS.organizationsManageAccess);
  return updateOrganizationAccessRolesEntry(organizationId, accessId, selection, true, false);
}

export async function removeOrganizationAccess(organizationId: number, accessId: number): Promise<AccessActionResult> {
  await requireActorPermission(PERMISSIONS.organizationsManageAccess);
  return removeOrganizationAccessEntry(organizationId, accessId, true, false);
}
