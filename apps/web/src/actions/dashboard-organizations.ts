/**
 * GC-Stats - dashboard-organizations
 *
 * Dashboard server actions for organization self-management: profile,
 * logo, roles, member roster and access grants for the org's own admins.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

"use server";

import { and, eq, isNull, ne, sql } from "drizzle-orm";
import { updateTag } from "next/cache";
import { adminDb as db } from "@gc-stats/db/client";
import { isPersonOrganizationMember } from "@/lib/organization-membership-service";
import { organizations, organizationAccessRoles, organizationRoles, organizationRolePermissions, organizationMemberships, organizationMemberRoleLinks, users, people, logos, ORGANIZATION_PERMISSIONS, ALL_ORGANIZATION_PERMISSIONS } from "@gc-stats/db";
import { tryStoreLogoPair, deleteLogoFiles, validateImageBuffer, MAX_IMAGE_BYTES } from "@gc-stats/storage";
import { requireDashboardOrgActorPermission, requireDashboardOrgOwnerActor } from "@/lib/dashboard-rbac";
import { MATCH_STATS_TAG } from "@/lib/cache-tags";
import { openRangeFrom, closeRange } from "@/lib/daterange";
import { validateOrganizationProfileInput, type OrganizationProfileInput, type OrganizationProfileFieldErrors } from "@/lib/organization-profile-validation";
import { searchUsersQuery, type UserPickerResult } from "@/lib/user-search";
import { searchPeopleQuery, type PersonPickerResult } from "@/lib/person-search";
import { isValidCountryCode } from "@/lib/countries";
import { isValidUrl } from "@/lib/admin-validation";
import { PERSON_SOCIAL_KEYS, personSocialError, type PersonSocialKey } from "@/lib/person-social-keys";
import { linkUserToPersonEntry, unlinkUserFromPersonEntry, type LinkUserResult } from "@/lib/person-link-service";
import { listOrganizationRoles } from "@/lib/organization-roles-data";
import { logActivity, diffChanges } from "@/lib/activity-log";
import { getEntityLogos, currentLogo, displayLogoUrl } from "@/lib/admin-logos";
import { ORGANIZATION_MEMBER_ROLES } from "@/lib/organization-roles";
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
import {
  addOrganizationMemberEntry,
  updateOrganizationMemberEntry,
  deleteOrganizationMembershipEntry,
  type AddMemberResult,
  type MemberEntryResult,
  type MembershipActionResult,
} from "@/lib/organization-membership-service";

export type { OrganizationProfileInput, OrganizationProfileField, OrganizationProfileFieldErrors } from "@/lib/organization-profile-validation";
export type OrganizationProfileResult = { ok: true } | { ok: false; fieldErrors: OrganizationProfileFieldErrors };

export type {
  AddMemberField,
  AddMemberFieldErrors,
  AddMemberResult,
  MemberEntryField,
  MemberEntryFieldErrors,
  MemberEntryResult,
  MembershipActionResult,
} from "@/lib/organization-membership-service";

export async function updateDashboardOrganizationProfile(organizationId: number, input: OrganizationProfileInput): Promise<OrganizationProfileResult> {
  const { userId: actorUserId } = await requireDashboardOrgActorPermission(organizationId, ORGANIZATION_PERMISSIONS.profileEdit);

  const { fieldErrors, name, slug, countryCode, secondaryCountryCode, bio, socials, tags } = validateOrganizationProfileInput(input);

  if (!fieldErrors.slug) {
    const [slugTaken] = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(and(eq(organizations.slug, slug), ne(organizations.id, organizationId)))
      .limit(1);
    if (slugTaken) fieldErrors.slug = "slugTaken";
  }

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  const [existing] = await db.select().from(organizations).where(eq(organizations.id, organizationId)).limit(1);
  const values = { name, slug, countryCode: countryCode || null, secondaryCountryCode: secondaryCountryCode || null, bio: bio || null, socials, tags };
  await db.transaction(async (tx) => {
    await tx.update(organizations).set(values).where(eq(organizations.id, organizationId));
    const changes = existing ? diffChanges(existing, values) : {};
    if (Object.keys(changes).length > 0) {
      await logActivity({ subject: "organization", subjectId: organizationId, event: "updated", description: `Updated organization #${organizationId} (${name})`, actorUserId, changes }, tx);
    }
  });

  return { ok: true };
}

/** Same search as admin's UserPicker, gated by this organization's own membersManage permission instead of admin.access. */
export async function searchUsersForOrganization(organizationId: number, query: string): Promise<UserPickerResult[]> {
  await requireDashboardOrgActorPermission(organizationId, ORGANIZATION_PERMISSIONS.membersManage);
  return searchUsersQuery(query);
}

// --- Organization roster (organization_memberships) -------------------------
// Public credit roster (people, not accounts — mirrors a team roster), see
// schema/people.ts. Same table/business logic as the admin panel
// (components/admin/organization-members-panel.tsx), shared via
// lib/organization-membership-service.ts — this file only adds the
// dashboard-scoped permission check and the expectedOrganizationId guard so
// one organization's membersManage holder can't touch another org's roster.

/**
 * Same search as admin's PersonPicker, gated by this organization's own
 * staffManage permission instead of admin.access — restricted to this
 * organization's own roster (organization_memberships, current or former)
 * rather than every person on the site, since production credits only make
 * sense for someone actually affiliated with this organization.
 */
export async function searchPeopleForOrganization(organizationId: number, query: string): Promise<PersonPickerResult[]> {
  await requireDashboardOrgActorPermission(organizationId, ORGANIZATION_PERMISSIONS.staffManage);
  const memberRows = await db.selectDistinct({ personId: organizationMemberships.personId }).from(organizationMemberships).where(eq(organizationMemberships.organizationId, organizationId));
  return searchPeopleQuery(query, undefined, memberRows.map((r) => r.personId));
}

/**
 * Unrestricted people search for the "add a new member" picker below —
 * unlike searchPeopleForOrganization above (production credits, scoped to
 * this org's existing roster on purpose), this one has to find people who
 * aren't affiliated with the organization yet, since that's the whole point
 * of adding a new member. Same membersManage permission gate.
 */
export async function searchPeopleForNewOrganizationMember(organizationId: number, query: string): Promise<PersonPickerResult[]> {
  await requireDashboardOrgActorPermission(organizationId, ORGANIZATION_PERMISSIONS.membersManage);
  return searchPeopleQuery(query);
}

export async function addDashboardOrganizationMember(organizationId: number, personId: number | null, role: string, from: string, until: string): Promise<AddMemberResult> {
  const { userId } = await requireDashboardOrgActorPermission(organizationId, ORGANIZATION_PERMISSIONS.membersManage);
  return addOrganizationMemberEntry(organizationId, personId, role, from, until, userId);
}

export type CreatePersonField = "handle" | "countryCode";
export type CreatePersonFieldErrors = Partial<Record<CreatePersonField, string>>;
export type CreatePersonResult = { ok: true; id: number; handle: string } | { ok: false; fieldErrors: CreatePersonFieldErrors };

/**
 * Lets an organization with the separate peopleCreate permission (distinct
 * from membersManage, which only manages existing roster stints) add a brand
 * new person to the site — mirrors admin's createPlayer, trimmed to the two
 * fields relevant here (no team assignment, this isn't a roster).
 */
export async function createPersonForOrganization(organizationId: number, handle: string, countryCode: string): Promise<CreatePersonResult> {
  const { userId: actorUserId } = await requireDashboardOrgActorPermission(organizationId, ORGANIZATION_PERMISSIONS.peopleCreate);

  const fieldErrors: CreatePersonFieldErrors = {};
  const trimmedHandle = handle.trim();
  const trimmedCountry = countryCode.trim();

  if (!trimmedHandle) fieldErrors.handle = "required";
  else if (trimmedHandle.length > 255) fieldErrors.handle = "tooLong";

  if (trimmedCountry && !isValidCountryCode(trimmedCountry)) fieldErrors.countryCode = "invalid";

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  const created = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(people)
      .values({ handle: trimmedHandle, countryCode: trimmedCountry || null, isActive: true })
      .returning({ id: people.id, handle: people.handle });
    if (!row) throw new Error("Insert returned no row");
    await logActivity({ subject: "player", subjectId: row.id, event: "created", description: `Created player #${row.id} (${row.handle})`, actorUserId, properties: { organizationId } }, tx);
    return row;
  });

  return { ok: true, id: created.id, handle: created.handle };
}

/** Search backing the per-member "link account" picker — gated by peopleLinkUser, not membersManage (roster and dashboard access grants) or staffManage (production credits). */
export async function searchUsersForPersonLink(organizationId: number, query: string): Promise<UserPickerResult[]> {
  await requireDashboardOrgActorPermission(organizationId, ORGANIZATION_PERMISSIONS.peopleLinkUser);
  return searchUsersQuery(query);
}

export type { LinkUserResult } from "@/lib/person-link-service";

export async function linkDashboardOrganizationMemberUser(organizationId: number, personId: number, userId: string): Promise<LinkUserResult> {
  const { userId: actorUserId } = await requireDashboardOrgActorPermission(organizationId, ORGANIZATION_PERMISSIONS.peopleLinkUser);
  if (!(await isPersonOrganizationMember(organizationId, personId))) return { ok: false, error: "notFound" };
  return linkUserToPersonEntry(personId, userId, actorUserId);
}

export async function unlinkDashboardOrganizationMemberUser(organizationId: number, personId: number): Promise<LinkUserResult> {
  const { userId: actorUserId } = await requireDashboardOrgActorPermission(organizationId, ORGANIZATION_PERMISSIONS.peopleLinkUser);
  if (!(await isPersonOrganizationMember(organizationId, personId))) return { ok: false, error: "notFound" };
  return unlinkUserFromPersonEntry(personId, actorUserId);
}

export type OrgPersonProfile = {
  id: number;
  handle: string;
  firstName: string;
  lastName: string;
  countryCode: string;
  pronouns: string;
  vlrId: string;
  liquipediaLink: string;
  aliases: string[];
  socials: Partial<Record<PersonSocialKey, string>>;
  photoUrl: string | null;
};

/** Neutral (no theme) photo currently in effect for a person, shown by the profile dialog. */
async function currentPersonPhotoUrl(personId: number): Promise<string | null> {
  const entries = await getEntityLogos("person", personId);
  return displayLogoUrl(currentLogo(entries.filter((e) => !e.theme)), "person");
}

/**
 * Read side of the dashboard profile-edit dialog, gated by the same
 * peopleEditProfile permission as the write below — only exposes the
 * "Basic info"/"Advanced info" fields an organization is allowed to touch
 * (handle/name/pronouns/country, VLR id/Liquipedia/socials/aliases), never
 * bio, Riot ids, or the active flag (admin-only, see updatePlayerProfile).
 */
export async function getPersonProfileForOrganization(organizationId: number, personId: number): Promise<OrgPersonProfile | null> {
  await requireDashboardOrgActorPermission(organizationId, ORGANIZATION_PERMISSIONS.peopleEditProfile);
  if (!(await isPersonOrganizationMember(organizationId, personId))) return null;

  const [row] = await db
    .select({
      id: people.id,
      handle: people.handle,
      firstName: people.firstName,
      lastName: people.lastName,
      countryCode: people.countryCode,
      pronouns: people.pronouns,
      vlrId: people.vlrId,
      liquipediaLink: people.liquipediaLink,
      aliases: people.aliases,
      socials: people.socials,
    })
    .from(people)
    .where(eq(people.id, personId))
    .limit(1);
  if (!row) return null;

  return {
    id: row.id,
    handle: row.handle,
    firstName: row.firstName ?? "",
    lastName: row.lastName ?? "",
    countryCode: row.countryCode ?? "",
    pronouns: row.pronouns !== null ? String(row.pronouns) : "",
    vlrId: row.vlrId !== null ? String(row.vlrId) : "",
    liquipediaLink: row.liquipediaLink ?? "",
    aliases: Array.isArray(row.aliases) ? (row.aliases as string[]) : [],
    socials: (row.socials as Record<string, string>) ?? {},
    photoUrl: await currentPersonPhotoUrl(personId),
  };
}

export type OrgPersonProfileInput = {
  handle: string;
  firstName: string;
  lastName: string;
  countryCode: string;
  pronouns: string; // "0" | "1" | "2" | ""
  vlrId: string;
  liquipediaLink: string;
  aliases: string[];
  socials: Partial<Record<PersonSocialKey, string>>;
};

export type OrgPersonProfileField = "handle" | "photo" | "countryCode" | "pronouns" | "vlrId" | "liquipediaLink";
export type OrgPersonProfileFieldErrors = Partial<Record<OrgPersonProfileField, string>> & { socials?: Partial<Record<PersonSocialKey, string>> };
export type OrgPersonProfileResult = { ok: true } | { ok: false; fieldErrors: OrgPersonProfileFieldErrors };

const ORG_PRONOUN_OPTIONS = [0, 1, 2] as const;

/** Write side — same field scope as getPersonProfileForOrganization above, same validation rules as admin's updatePlayerProfile for the fields they share. */
export async function updatePersonProfileForOrganization(organizationId: number, personId: number, input: OrgPersonProfileInput): Promise<OrgPersonProfileResult> {
  const { userId: actorUserId } = await requireDashboardOrgActorPermission(organizationId, ORGANIZATION_PERMISSIONS.peopleEditProfile);
  if (!(await isPersonOrganizationMember(organizationId, personId))) return { ok: false, fieldErrors: { handle: "notFound" } };

  const fieldErrors: OrgPersonProfileFieldErrors = {};
  const handle = input.handle.trim();
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const countryCode = input.countryCode.trim();
  const liquipediaLink = input.liquipediaLink.trim();
  const vlrId = input.vlrId.trim();

  if (!handle) fieldErrors.handle = "required";
  else if (handle.length > 255) fieldErrors.handle = "tooLong";

  if (countryCode && !isValidCountryCode(countryCode)) fieldErrors.countryCode = "invalid";

  let pronounsValue: number | null = null;
  if (input.pronouns) {
    const n = Number(input.pronouns);
    if (!(ORG_PRONOUN_OPTIONS as readonly number[]).includes(n)) fieldErrors.pronouns = "invalid";
    else pronounsValue = n;
  }

  let vlrIdValue: number | null = null;
  if (vlrId) {
    if (!/^\d+$/.test(vlrId) || Number(vlrId) > 99_999_999) fieldErrors.vlrId = "invalid";
    else vlrIdValue = Number(vlrId);
  }

  if (liquipediaLink && !isValidUrl(liquipediaLink)) fieldErrors.liquipediaLink = "invalid";

  if (!fieldErrors.vlrId && vlrIdValue !== null) {
    const [taken] = await db.select({ id: people.id }).from(people).where(and(eq(people.vlrId, vlrIdValue), ne(people.id, personId))).limit(1);
    if (taken) fieldErrors.vlrId = "taken";
  }

  const socials: Record<string, string> = {};
  const socialErrors: Partial<Record<PersonSocialKey, string>> = {};
  for (const key of PERSON_SOCIAL_KEYS) {
    const value = input.socials[key]?.trim();
    if (!value) continue;
    const error = personSocialError(key, value);
    if (error) socialErrors[key] = error;
    else socials[key] = value;
  }
  if (Object.keys(socialErrors).length > 0) fieldErrors.socials = socialErrors;

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  const aliases = [...new Set(input.aliases.map((a) => a.trim()).filter(Boolean))];

  const [existing] = await db.select().from(people).where(eq(people.id, personId)).limit(1);
  const values = {
    handle,
    firstName: firstName || null,
    lastName: lastName || null,
    countryCode: countryCode || null,
    pronouns: pronounsValue,
    vlrId: vlrIdValue,
    liquipediaLink: liquipediaLink || null,
    aliases,
    socials,
  };
  await db.transaction(async (tx) => {
    await tx.update(people).set(values).where(eq(people.id, personId));
    const changes = existing ? diffChanges(existing, values) : {};
    if (Object.keys(changes).length > 0) {
      await logActivity({ subject: "player", subjectId: personId, event: "updated", description: `Updated player #${personId} (${handle})`, actorUserId, changes, properties: { organizationId } }, tx);
    }
  });
  // Match scoreboards show the current handle.
  updateTag(MATCH_STATS_TAG);

  return { ok: true };
}

export type UploadPersonPhotoResult = { ok: true } | { ok: false; error: string };

/** Replaces the person's neutral photo (their previous one is closed, not deleted, so the logo history stays intact). */
export async function uploadPersonPhotoForOrganization(organizationId: number, personId: number, formData: FormData): Promise<UploadPersonPhotoResult> {
  const { userId: actorUserId } = await requireDashboardOrgActorPermission(organizationId, ORGANIZATION_PERMISSIONS.peopleEditProfile);
  if (!(await isPersonOrganizationMember(organizationId, personId))) return { ok: false, error: "notFound" };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "required" };
  if (file.size > MAX_IMAGE_BYTES) return { ok: false, error: "tooLarge" };

  const buffer = Buffer.from(await file.arrayBuffer());
  const validation = await validateImageBuffer(buffer);
  if (!validation.ok) return { ok: false, error: validation.error };

  const storedResult = await tryStoreLogoPair("person", buffer);
  if (!storedResult.ok) return { ok: false, error: storedResult.error };
  const stored = storedResult.logo;
  const today = new Date().toISOString().slice(0, 10);

  try {
    await db.transaction(async (tx) => {
      const openNeutral = await tx
        .select({ id: logos.id, period: logos.period })
        .from(logos)
        .where(and(eq(logos.entityType, "person"), eq(logos.entityId, personId), isNull(logos.theme), sql`${logos.period} @> CURRENT_TIMESTAMP`));
      for (const row of openNeutral) {
        await tx.update(logos).set({ period: closeRange(row.period, today) }).where(eq(logos.id, row.id));
      }
      await tx.insert(logos).values({ id: stored.id, entityType: "person", entityId: personId, period: openRangeFrom(today), theme: null, isVisible: true });
      await logActivity({ subject: "player", subjectId: personId, event: "updated", description: `Added logo of player #${personId}`, actorUserId, properties: { section: "logo", logoId: stored.id, organizationId } }, tx);
    });
  } catch (error) {
    await deleteLogoFiles("person", stored.id).catch(() => {});
    throw error;
  }

  return { ok: true };
}

export async function updateDashboardOrganizationMember(organizationId: number, membershipId: number, role: string, from: string, until: string): Promise<MemberEntryResult> {
  const { userId } = await requireDashboardOrgActorPermission(organizationId, ORGANIZATION_PERMISSIONS.membersManage);
  return updateOrganizationMemberEntry(membershipId, role, from, until, userId, organizationId);
}

export async function deleteDashboardOrganizationMembership(organizationId: number, membershipId: number): Promise<MembershipActionResult> {
  const { userId } = await requireDashboardOrgActorPermission(organizationId, ORGANIZATION_PERMISSIONS.membersManage);
  return deleteOrganizationMembershipEntry(membershipId, userId, organizationId);
}

// --- Dashboard access (organization_access) --------------------------------

export type { AccessRoleSelection, AddAccessFieldErrors, AddAccessResult, AccessEntryFieldErrors, AccessEntryResult, AccessActionResult };

export async function addDashboardOrganizationAccess(organizationId: number, userId: string | null, selection: AccessRoleSelection): Promise<AddAccessResult> {
  const { membership, userId: actorUserId } = await requireDashboardOrgActorPermission(organizationId, ORGANIZATION_PERMISSIONS.membersManage);
  return addOrganizationAccessEntry(organizationId, userId, selection, membership.isOwner, actorUserId);
}

export async function updateDashboardOrganizationAccessRoles(organizationId: number, accessId: number, selection: AccessRoleSelection): Promise<AccessEntryResult> {
  const { membership, userId: actorUserId } = await requireDashboardOrgActorPermission(organizationId, ORGANIZATION_PERMISSIONS.membersManage);
  return updateOrganizationAccessRolesEntry(organizationId, accessId, selection, membership.isOwner, true, actorUserId);
}

export async function removeDashboardOrganizationAccess(organizationId: number, accessId: number): Promise<AccessActionResult> {
  const { membership, userId: actorUserId } = await requireDashboardOrgActorPermission(organizationId, ORGANIZATION_PERMISSIONS.membersManage);
  return removeOrganizationAccessEntry(organizationId, accessId, membership.isOwner, true, actorUserId);
}

// --- Custom roles (organization_roles) --------------------------------------
// Fully self-service: an organization's owner creates/renames/deletes its own
// roles and edits each one's permission set, always capped by
// organizations.max_permissions — same "no role can widen what it can do"
// rationale as /admin/roles being super-admin-only.

export type RoleField = "name";
export type RoleFieldErrors = Partial<Record<RoleField, string>>;

const RESERVED_ROLE_NAMES = new Set(["owner"]);

function validateRoleName(name: string, existingNames: string[]): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "required";
  if (trimmed.length > 100) return "tooLong";
  if (RESERVED_ROLE_NAMES.has(trimmed.toLowerCase())) return "reservedRoleName";
  if (existingNames.some((n) => n.toLowerCase() === trimmed.toLowerCase())) return "roleNameTaken";
  return null;
}

export type CreateRoleResult = { ok: true; id: number } | { ok: false; fieldErrors: RoleFieldErrors };

export async function createOrganizationRole(organizationId: number, name: string): Promise<CreateRoleResult> {
  const { userId: actorUserId } = await requireDashboardOrgOwnerActor(organizationId);

  const existing = await listOrganizationRoles(organizationId);
  const error = validateRoleName(name, existing.map((r) => r.name));
  if (error) return { ok: false, fieldErrors: { name: error } };

  const id = await db.transaction(async (tx) => {
    const [created] = await tx.insert(organizationRoles).values({ organizationId, name: name.trim() }).returning({ id: organizationRoles.id });
    if (!created) throw new Error("Insert returned no row");
    await logActivity({ subject: "organization", subjectId: organizationId, event: "updated", description: `Created role "${name.trim()}" on organization #${organizationId}`, actorUserId, properties: { section: "roles", roleId: created.id } }, tx);
    return created.id;
  });
  return { ok: true, id };
}

export type RenameRoleResult = { ok: true } | { ok: false; fieldErrors: RoleFieldErrors };

export async function renameOrganizationRole(organizationId: number, roleId: number, name: string): Promise<RenameRoleResult> {
  const { userId: actorUserId } = await requireDashboardOrgOwnerActor(organizationId);

  const [role] = await db
    .select({ id: organizationRoles.id, name: organizationRoles.name })
    .from(organizationRoles)
    .where(and(eq(organizationRoles.id, roleId), eq(organizationRoles.organizationId, organizationId)))
    .limit(1);
  if (!role) return { ok: false, fieldErrors: { name: "notFound" } };

  const existing = (await listOrganizationRoles(organizationId)).filter((r) => r.id !== roleId);
  const error = validateRoleName(name, existing.map((r) => r.name));
  if (error) return { ok: false, fieldErrors: { name: error } };

  await db.transaction(async (tx) => {
    await tx.update(organizationRoles).set({ name: name.trim() }).where(eq(organizationRoles.id, roleId));
    if (role.name !== name.trim()) {
      await logActivity({ subject: "organization", subjectId: organizationId, event: "updated", description: `Renamed role #${roleId} on organization #${organizationId}`, actorUserId, changes: { name: { old: role.name, new: name.trim() } }, properties: { section: "roles", roleId } }, tx);
    }
  });
  return { ok: true };
}

export type DeleteRoleResult = { ok: true } | { ok: false; error: string };

/** Blocked while any account still holds this role — reassign or revoke their access first (checked here, not left to the FK, so the UI gets a clear reason instead of a raw constraint error). */
export async function deleteOrganizationRole(organizationId: number, roleId: number): Promise<DeleteRoleResult> {
  const { userId: actorUserId } = await requireDashboardOrgOwnerActor(organizationId);

  const [role] = await db
    .select({ id: organizationRoles.id, name: organizationRoles.name })
    .from(organizationRoles)
    .where(and(eq(organizationRoles.id, roleId), eq(organizationRoles.organizationId, organizationId)))
    .limit(1);
  if (!role) return { ok: false, error: "notFound" };

  const [inUse] = await db.select({ id: organizationAccessRoles.id }).from(organizationAccessRoles).where(eq(organizationAccessRoles.roleId, roleId)).limit(1);
  if (inUse) return { ok: false, error: "roleInUse" };

  const [linkedToMemberRole] = await db.select({ id: organizationMemberRoleLinks.id }).from(organizationMemberRoleLinks).where(eq(organizationMemberRoleLinks.permissionRoleId, roleId)).limit(1);
  if (linkedToMemberRole) return { ok: false, error: "roleInUse" };

  await db.transaction(async (tx) => {
    await tx.delete(organizationRoles).where(eq(organizationRoles.id, roleId));
    await logActivity({ subject: "organization", subjectId: organizationId, event: "updated", description: `Deleted role "${role.name}" on organization #${organizationId}`, actorUserId, properties: { section: "roles", roleId } }, tx);
  });
  return { ok: true };
}

export type SetMemberRoleLinkResult = { ok: true } | { ok: false; error: string };

/**
 * `target`: "none" removes the link (member role stays purely visual),
 * "owner" links to the immutable owner sentinel, a number links to one of
 * this organization's own custom roles — see autoGrantAccessForMemberRole
 * (organization-membership-service.ts) for what a link actually does.
 */
export async function setOrganizationMemberRoleLink(organizationId: number, memberRole: string, target: "none" | "owner" | number): Promise<SetMemberRoleLinkResult> {
  const { userId: actorUserId } = await requireDashboardOrgOwnerActor(organizationId);

  if (!(ORGANIZATION_MEMBER_ROLES as readonly string[]).includes(memberRole)) return { ok: false, error: "invalidRole" };

  const logLink = (tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) =>
    logActivity({ subject: "organization", subjectId: organizationId, event: "updated", description: `Set permission role of member role "${memberRole}" to ${target} on organization #${organizationId}`, actorUserId, properties: { section: "roles", memberRole, target } }, tx);

  if (target === "none") {
    await db.transaction(async (tx) => {
      await tx.delete(organizationMemberRoleLinks).where(and(eq(organizationMemberRoleLinks.organizationId, organizationId), eq(organizationMemberRoleLinks.memberRole, memberRole)));
      await logLink(tx);
    });
    return { ok: true };
  }

  let permissionRoleId: number | null = null;
  if (target !== "owner") {
    const [role] = await db.select({ id: organizationRoles.id }).from(organizationRoles).where(and(eq(organizationRoles.id, target), eq(organizationRoles.organizationId, organizationId))).limit(1);
    if (!role) return { ok: false, error: "invalidRole" };
    permissionRoleId = role.id;
  }

  await db.transaction(async (tx) => {
    await tx
      .insert(organizationMemberRoleLinks)
      .values({ organizationId, memberRole, permissionRoleId })
      .onConflictDoUpdate({ target: [organizationMemberRoleLinks.organizationId, organizationMemberRoleLinks.memberRole], set: { permissionRoleId } });
    await logLink(tx);
  });

  return { ok: true };
}

export type UpdateRolePermissionsResult = { ok: true } | { ok: false; error: "invalidRole" };

export async function updateOrganizationRolePermissions(organizationId: number, roleId: number, permissionNames: string[]): Promise<UpdateRolePermissionsResult> {
  const { membership, userId: actorUserId } = await requireDashboardOrgOwnerActor(organizationId);

  const [role] = await db
    .select({ id: organizationRoles.id })
    .from(organizationRoles)
    .where(and(eq(organizationRoles.id, roleId), eq(organizationRoles.organizationId, organizationId)))
    .limit(1);
  if (!role) return { ok: false, error: "invalidRole" };

  // The owner's own `membership.permissions` IS the org's max_permissions
  // ceiling (see dashboard-rbac.ts) — re-derive from ALL_ORGANIZATION_PERMISSIONS
  // filtered by that ceiling rather than trusting client input beyond it.
  const ceiling = membership.permissions;
  const allowed: Set<string> = new Set(ALL_ORGANIZATION_PERMISSIONS.filter((p) => ceiling.has(p)));
  const permissions = [...new Set(permissionNames)].filter((p) => allowed.has(p));

  const previous = (await db.select({ permission: organizationRolePermissions.permission }).from(organizationRolePermissions).where(eq(organizationRolePermissions.roleId, roleId))).map((r) => r.permission).sort();

  await db.transaction(async (tx) => {
    await tx.delete(organizationRolePermissions).where(eq(organizationRolePermissions.roleId, roleId));
    if (permissions.length > 0) {
      await tx.insert(organizationRolePermissions).values(permissions.map((permission) => ({ roleId, permission })));
    }
    const changes = diffChanges({ permissions: previous }, { permissions: [...permissions].sort() });
    if (Object.keys(changes).length > 0) {
      await logActivity({ subject: "organization", subjectId: organizationId, event: "updated", description: `Updated permissions of role #${roleId} on organization #${organizationId}`, actorUserId, changes, properties: { section: "roles", roleId } }, tx);
    }
  });

  return { ok: true };
}

// --- Organization logo (dashboard-scoped) -----------------------------------
// Deliberately simpler than the admin EntityLogoPanel flow (no dated
// history, always the current logo for a given theme) — an org's own team
// just needs to set/replace its light/dark logo. Full history management
// (dated periods) stays an /admin-only capability.

const DASHBOARD_LOGO_THEMES = ["light", "dark"] as const;

export type UploadOrgLogoResult = { ok: true } | { ok: false; error: string };

export async function uploadDashboardOrganizationLogo(organizationId: number, formData: FormData): Promise<UploadOrgLogoResult> {
  const { userId: actorUserId } = await requireDashboardOrgActorPermission(organizationId, ORGANIZATION_PERMISSIONS.logoUpload);

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "required" };
  if (file.size > MAX_IMAGE_BYTES) return { ok: false, error: "tooLarge" };

  const themeRaw = String(formData.get("theme") ?? "").trim();
  const theme: string | null = themeRaw && (DASHBOARD_LOGO_THEMES as readonly string[]).includes(themeRaw) ? themeRaw : null;
  if (themeRaw && theme === null) return { ok: false, error: "invalidTheme" };

  const buffer = Buffer.from(await file.arrayBuffer());
  const validation = await validateImageBuffer(buffer);
  if (!validation.ok) return { ok: false, error: validation.error };

  const storedResult = await tryStoreLogoPair("organization", buffer);
  if (!storedResult.ok) return { ok: false, error: storedResult.error };
  const stored = storedResult.logo;
  const today = new Date().toISOString().slice(0, 10);

  try {
    await db.transaction(async (tx) => {
      const openExisting = await tx
        .select({ id: logos.id, period: logos.period })
        .from(logos)
        .where(and(eq(logos.entityType, "organization"), eq(logos.entityId, organizationId), theme ? eq(logos.theme, theme) : isNull(logos.theme)));
      for (const row of openExisting) {
        await tx.update(logos).set({ period: closeRange(row.period, today) }).where(eq(logos.id, row.id));
      }
      await tx.insert(logos).values({ id: stored.id, entityType: "organization", entityId: organizationId, period: openRangeFrom(today), theme, isVisible: true });
      await logActivity({ subject: "organization", subjectId: organizationId, event: "updated", description: `Added logo of organization #${organizationId}`, actorUserId, properties: { section: "logo", logoId: stored.id } }, tx);
    });
  } catch (error) {
    await deleteLogoFiles("organization", stored.id).catch(() => {});
    throw error;
  }

  return { ok: true };
}

export async function deleteDashboardOrganizationLogo(organizationId: number, logoId: string): Promise<UploadOrgLogoResult> {
  const { userId: actorUserId } = await requireDashboardOrgActorPermission(organizationId, ORGANIZATION_PERMISSIONS.logoUpload);

  const [row] = await db
    .select({ id: logos.id })
    .from(logos)
    .where(and(eq(logos.id, logoId), eq(logos.entityType, "organization"), eq(logos.entityId, organizationId)))
    .limit(1);
  if (!row) return { ok: false, error: "notFound" };

  await db.transaction(async (tx) => {
    await tx.delete(logos).where(eq(logos.id, logoId));
    await logActivity({ subject: "organization", subjectId: organizationId, event: "updated", description: `Deleted logo of organization #${organizationId}`, actorUserId, properties: { section: "logo", logoId } }, tx);
  });
  await deleteLogoFiles("organization", logoId).catch(() => {});

  return { ok: true };
}
