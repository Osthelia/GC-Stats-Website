/**
 * GC-Stats — people module
 *
 * Teams (with name history), the unified `people` identity table (replaces
 * V1's separate players/staff), roster memberships, organizations and
 * their membership/roles/access/permissions tables, production credits,
 * and logos.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { sql } from "drizzle-orm";
import { pgTable, bigserial, bigint, text, varchar, jsonb, boolean, smallint, integer, char, timestamp, date, uuid, unique, uniqueIndex, index, type AnyPgColumn } from "drizzle-orm/pg-core";
import { daterange, tstzrange } from "./custom-types";
import { users } from "./auth";

export const teams = pgTable("teams", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  name: text("name").notNull(),
  shortName: varchar("short_name", { length: 10 }),
  countryCode: char("country_code", { length: 3 }),
  // Second nationality — dual citizenship, same alpha-3/"INT" vocabulary as
  // countryCode. Display fuses both flags diagonally (CountryFlag), never a
  // second independent identifier.
  secondaryCountryCode: char("secondary_country_code", { length: 3 }),
  socials: jsonb("socials").notNull().default({}),
  bio: text("bio"),
  vlrId: integer("vlr_id"),
  isActive: boolean("is_active").notNull().default(true),
  // Out-of-coverage opponent (mix tournament): shown on its matches only.
  isGhost: boolean("is_ghost").notNull().default(false),
  maxPermissions: jsonb("max_permissions"),
  tags: jsonb("tags"),
  liquipediaLink: text("liquipedia_link"),
  // Organization running this team: the org then has no public page of its own
  // (its members show as the team's staff) and gets an automatic /dashboard
  // access scoped to the streams of this team's matches. One org can own several teams.
  organizationId: bigint("organization_id", { mode: "number" }).references((): AnyPgColumn => organizations.id, { onDelete: "set null" }),
}, (t) => [
  index("teams_organization_id_idx").on(t.organizationId),
]);

// Liquipedia page name <-> GC Stats team, strictly one to one: used to write
// {{TeamOpponent|...}} in generated wikicode and to recognise teams on import.
export const liquipediaTeamNames = pgTable(
  "liquipedia_team_names",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    teamId: bigint("team_id", { mode: "number" }).notNull().unique().references(() => teams.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("liquipedia_team_names_name_lower_unique").on(sql`lower(${t.name})`)]
);

export const teamNameHistory = pgTable("team_name_history", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  teamId: bigint("team_id", { mode: "number" }).notNull().references(() => teams.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  period: daterange("period").notNull(),
  isVisible: boolean("is_visible").notNull().default(true),
}, (t) => [
  index("team_name_history_team_id_idx").on(t.teamId),
]);

// Unified identity - see DATABASES.MD Â§3.2. Replaces the separate V1
// `players`/`staff` tables: a person who competed and later casts/coaches
// stays one row, one logo/photo history, one profile.
export const people = pgTable("people", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  handle: text("handle").notNull(),
  aliases: jsonb("aliases"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  countryCode: char("country_code", { length: 3 }),
  secondaryCountryCode: char("secondary_country_code", { length: 3 }),
  pronouns: smallint("pronouns"),
  birthDate: date("birth_date"),
  bio: text("bio"),
  socials: jsonb("socials").notNull().default({}),
  valId: text("val_id").unique(), // Riot puuid - null for people who never played competitively
  esportsValId: text("esports_val_id").unique(),
  vlrId: integer("vlr_id"),
  isActive: boolean("is_active").notNull().default(true),
  // Out-of-coverage player (mix tournament): shown on its matches only.
  isGhost: boolean("is_ghost").notNull().default(false),
  userId: text("user_id").unique().references(() => users.id, { onDelete: "set null" }),
  liquipediaLink: text("liquipedia_link"),
});

// A team's real, continuous roster over time (players, but also
// coach/manager/analyst - just a different `role` value, see DATABASES.MD
// Â§3.2). NOT what determines who played a given tournament - see
// entrant_members in bracket.ts for that.
export const rosterMemberships = pgTable("roster_memberships", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  personId: bigint("person_id", { mode: "number" }).notNull().references(() => people.id, { onDelete: "cascade" }),
  teamId: bigint("team_id", { mode: "number" }).notNull().references(() => teams.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("player"), // 'player' | 'player-igl' | 'sub' | 'coach' | 'assistant coach' | 'performance coach' | 'analyst' | 'manager'
  period: daterange("period").notNull(),
  // Nullable: still on the roster (period stays open) but currently inactive
  // (injury, break, ...) as of this date. Replaces V1's role-suffix
  // convention ('player-inactive' as a distinct role value + stint-merging
  // logic to display it) with a plain column — same information, no
  // parallel role vocabulary to keep in sync.
  inactiveSince: date("inactive_since"),
  // EXCLUDE USING gist (person_id, period, role) added in drizzle/0000_squashed_baseline.sql
  // - same person can hold two DIFFERENT roles concurrently, not the same role twice overlapping.
});

export const organizations = pgTable("organizations", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  tags: text("tags").array().notNull().default([]), // e.g. {'tournament_organizer','production','media'} - GIN index in 0001
  countryCode: char("country_code", { length: 3 }),
  secondaryCountryCode: char("secondary_country_code", { length: 3 }),
  socials: jsonb("socials").notNull().default({}),
  bio: text("bio"),
  maxPermissions: jsonb("max_permissions"),
});

// Purely a public "who's part of this org" credit roster (people, not
// accounts) — mirrors a team roster, editable only from /admin. Carries NO
// access/permission meaning: a person listed here (even role='owner') may
// have no user account at all, or a user account with zero /dashboard
// access. /dashboard access is a completely separate concept, see
// organization_access below — deliberate split requested explicitly
// (2026-09-13): "les membres... sont un visuel (comme player)".
export const organizationMemberships = pgTable("organization_memberships", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  personId: bigint("person_id", { mode: "number" }).notNull().references(() => people.id, { onDelete: "cascade" }),
  organizationId: bigint("organization_id", { mode: "number" }).notNull().references(() => organizations.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // 'admin' | 'caster' | 'observer' | 'producer' | 'editor' | ...
  period: daterange("period").notNull(),
  // EXCLUDE USING gist (person_id, organization_id, role, period) added in 0000_squashed_baseline.sql
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

// Replaces staff_assignments (Laravel morph, no FK integrity). Scope
// discriminant is exactly-one-of the nullable FKs below, enforced by a
// CHECK (num_nonnulls(...) = 1) added in drizzle/0000_squashed_baseline.sql -
// same pattern as entrants.kind / stage_qualifications.
export const productionCredits = pgTable("production_credits", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  personId: bigint("person_id", { mode: "number" }).notNull().references(() => people.id, { onDelete: "cascade" }),
  organizationId: bigint("organization_id", { mode: "number" }).references(() => organizations.id, { onDelete: "set null" }),
  role: text("role").notNull(), // 'caster' | 'analyst' | 'host' | 'observer' | 'organizer' | 'producer' | 'editor' | 'photographer' | 'translator' | 'referee' | ...
  titleOverride: text("title_override"),
  tournamentId: bigint("tournament_id", { mode: "number" }), // FK added once tournaments exists (bracket.ts) - see 0000_squashed_baseline.sql
  stageId: bigint("stage_id", { mode: "number" }),
  containerId: bigint("container_id", { mode: "number" }),
  matchId: bigint("match_id", { mode: "number" }),
  mapId: bigint("map_id", { mode: "number" }),
}, (t) => [
  index("production_credits_tournament_id_idx").on(t.tournamentId),
  index("production_credits_match_id_idx").on(t.matchId),
]);

// Polymorphic logo/photo history (Team, Person, Tournament, NewsAuthor,
// NewsPublisher) - kept as type+id discriminant without a DB-level FK,
// consistent with DATABASES.MD Â§6's default for peripheral polymorphism.
export const logos = pgTable("logos", {
  id: uuid("id").primaryKey().defaultRandom(),
  entityType: text("entity_type").notNull(), // 'team' | 'person' | 'tournament' | 'news_author' | 'news_publisher'
  entityId: bigint("entity_id", { mode: "number" }).notNull(),
  period: tstzrange("period").notNull(),
  theme: text("theme"), // 'light' | 'dark' | null = theme-agnostic
  isVisible: boolean("is_visible").notNull().default(true),
}, (t) => [
  index("logos_entity_idx").on(t.entityType, t.entityId),
]);
