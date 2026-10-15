/**
 * GC-Stats — people module
 *
 * Organizations and their access/roles/permissions tables, and logos. Teams,
 * people, rosters and production credits exist once per game, see
 * game-tables.ts.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { pgTable, bigserial, bigint, text, jsonb, boolean, char, uuid, unique, index } from "drizzle-orm/pg-core";
import { tstzrange } from "./custom-types";
import { users } from "./auth";

export const organizations = pgTable("organizations", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  games: text("games").array().notNull().default([]), // game slugs the organization is listed on, see game.ts
  tags: text("tags").array().notNull().default([]), // e.g. {'tournament_organizer','production','media'} - GIN index in 0001
  countryCode: char("country_code", { length: 3 }),
  secondaryCountryCode: char("secondary_country_code", { length: 3 }),
  socials: jsonb("socials").notNull().default({}),
  bio: text("bio"),
  liquipediaLink: text("liquipedia_link"),
  maxPermissions: jsonb("max_permissions"),
});

// A custom, per-organization dashboard role — fully editable (create/rename/
// delete, own permission set) by that organization's owner, see
// apps/web/src/actions/dashboard-organizations.ts. 'owner' is NOT a row here:
// it's an immutable sentinel (organization_access.role_id = NULL) that always
// gets every permission up to organizations.max_permissions and can never be
// renamed, deleted, or have its permissions edited — see dashboard-rbac.ts.
// Deliberately NOT the generic roles/role_permissions/user_roles engine
// (roles.scope_type='publisher'): that table has no organization_id of its
// own (only user_roles.scope_id does), so a freshly created, unassigned
// custom role would belong to no organization yet — a real gap for a
// self-service editor.
export const organizationRoles = pgTable(
  "organization_roles",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    organizationId: bigint("organization_id", { mode: "number" }).notNull().references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
  },
  (t) => [unique("organization_roles_org_name_unique").on(t.organizationId, t.name)]
);

// Who can actually sign in and use /dashboard for this organization — keyed
// on the ACCOUNT (users.id), never on people/organization_memberships (that
// table is credits, not access; see its comment above). One row per (user,
// organization); is_owner means the immutable 'owner' sentinel (every
// permission up to organizations.max_permissions, never combined with real
// roles) — otherwise its roles live in organization_access_roles below
// (2026-09-17: a non-owner grant can now hold several roles at once,
// permissions = union). Managed from /admin/organizations/[id]
// (OrganizationDashboardAccessPanel) and, for non-owner roles, from
// /dashboard itself by someone holding organization.members.manage.
export const organizationAccess = pgTable(
  "organization_access",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    organizationId: bigint("organization_id", { mode: "number" }).notNull().references(() => organizations.id, { onDelete: "cascade" }),
    isOwner: boolean("is_owner").notNull().default(false),
  },
  (t) => [unique("organization_access_user_org_unique").on(t.userId, t.organizationId)]
);

// One row per extra role a non-owner organization_access grant holds — see
// its comment above. Never populated for an owner grant (is_owner=true
// already implies the whole ceiling, combining it with a role is meaningless).
export const organizationAccessRoles = pgTable(
  "organization_access_roles",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    accessId: bigint("access_id", { mode: "number" }).notNull().references(() => organizationAccess.id, { onDelete: "cascade" }),
    roleId: bigint("role_id", { mode: "number" }).notNull().references(() => organizationRoles.id, { onDelete: "cascade" }),
  },
  (t) => [unique("organization_access_roles_unique").on(t.accessId, t.roleId)]
);

// What one organization_roles row grants on /dashboard for its organization
// — see apps/web/src/lib/dashboard-rbac.ts. No organizationId of its own on
// purpose: it's always reached through role_id, which already pins the
// organization via organization_roles.
export const organizationRolePermissions = pgTable(
  "organization_role_permissions",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    roleId: bigint("role_id", { mode: "number" }).notNull().references(() => organizationRoles.id, { onDelete: "cascade" }),
    permission: text("permission").notNull(),
  },
  (t) => [unique("organization_role_permissions_unique").on(t.roleId, t.permission)]
);

// Opt-in link from a public roster role (organization_memberships.role) to a
// dashboard permission role (organization_roles), one per organization. When
// set, adding/updating a member with this role auto-grants organization_access
// at the linked role to that person's linked account (if any), see
// lib/organization-membership-service.ts. Absent by default: without a row
// here, organization_memberships stays the pure "visual" roster explicitly
// decided on 2026-09-13 (see its own comment above) — this table only
// reconnects the two when an organization owner opts in.
export const organizationMemberRoleLinks = pgTable(
  "organization_member_role_links",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    organizationId: bigint("organization_id", { mode: "number" }).notNull().references(() => organizations.id, { onDelete: "cascade" }),
    memberRole: text("member_role").notNull(), // one of ORGANIZATION_MEMBER_ROLES
    // NULL = the immutable 'owner' sentinel, same convention as organization_access.role_id.
    permissionRoleId: bigint("permission_role_id", { mode: "number" }).references(() => organizationRoles.id),
  },
  (t) => [unique("organization_member_role_links_org_role_unique").on(t.organizationId, t.memberRole)]
);

// Polymorphic logo/photo history (Team, Person, Tournament, NewsAuthor,
// NewsPublisher) - kept as type+id discriminant without a DB-level FK,
// consistent with DATABASES.MD Â§6's default for peripheral polymorphism.
export const logos = pgTable("logos", {
  id: uuid("id").primaryKey().defaultRandom(),
  entityType: text("entity_type").notNull(), // 'team' | 'person' | 'tournament' | 'news_author' | 'news_publisher'
  entityId: bigint("entity_id", { mode: "number" }).notNull(),
  // Game of a team, person or tournament logo; null for global entities (news authors, publishers).
  game: text("game"),
  period: tstzrange("period").notNull(),
  theme: text("theme"), // 'light' | 'dark' | null = theme-agnostic
  isVisible: boolean("is_visible").notNull().default(true),
}, (t) => [
  index("logos_entity_idx").on(t.game, t.entityType, t.entityId),
]);
