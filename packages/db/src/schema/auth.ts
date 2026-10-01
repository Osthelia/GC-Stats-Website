/**
 * GC-Stats — auth module
 *
 * Auth.js (next-auth) tables (users, accounts, sessions, verification
 * tokens, WebAuthn authenticators), the RBAC tables (roles, permissions,
 * role_permissions, user_roles), and API key management (api_key, key
 * reveal history, rate limit counters, request log).
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { pgTable, bigserial, bigint, text, varchar, jsonb, boolean, smallint, integer, timestamp, primaryKey, char, unique } from "drizzle-orm/pg-core";

// Mirrors next-auth's AdapterAccountType — kept as a plain literal union
// instead of importing next-auth here so this package (consumed outside
// apps/web too, e.g. scripts/) doesn't need it as a dependency.
type AdapterAccountType = "oauth" | "oidc" | "email" | "webauthn";

// users.id is `text` (UUID), not bigserial — required by Auth.js's Drizzle
// adapter (DefaultPostgresUsersTable expects a string PK). Every other
// table in this schema keeps bigserial/bigint ids; only FKs pointing at
// users.id follow suit (see people.ts `people.userId`, content.ts).
export const users = pgTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  // Nullable at the DB level: Auth.js's adapter `createUser` (OAuth/WebAuthn
  // first sign-in) only ever inserts id/name/email/emailVerified/image — a
  // NOT NULL here would make every social/passkey signup fail. Backfilled
  // right after by the `createUser` event in apps/web/src/auth.ts (mirrors
  // V1's UsernameGenerator, used for the same "no username collected" flows).
  username: varchar("username", { length: 32 }).unique(),
  email: text("email").unique(),
  emailVerified: timestamp("email_verified", { withTimezone: true }),
  image: text("image"),
  passwordHash: text("password_hash"),
  preferences: jsonb("preferences").notNull().default({}),
  pronouns: smallint("pronouns").default(2),
  bio: text("bio"),
  socials: jsonb("socials").notNull().default({}),
  teamTag: text("team_tag"),
  dataExplorerEnabled: boolean("data_explorer_enabled").notNull().default(false),
  // Individual news-authoring grant, independent of any organization — see
  // organization_access/ORGANIZATION_PERMISSIONS.newsEdit in schema/people.ts
  // for the other way to get it (through an organization's own role). Set
  // from /admin/users/[userId] (AuthorAccessPanel).
  isAuthor: boolean("is_author").notNull().default(false),
  discordSyncedAt: timestamp("discord_synced_at", { withTimezone: true }),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  // Gates posting on the public forum (actions/forum.ts, lib/forum-guards.ts)
  // until accepted once — mirrors V1's same-named column.
  forumRulesAcceptedAt: timestamp("forum_rules_accepted_at", { withTimezone: true }),
  // TOTP 2FA — gates the Credentials (email/password) provider only, see
  // apps/web/src/auth.ts. Both encrypted at rest (apps/web/src/lib/encryption.ts)
  // like V1's Eloquent `encrypted` cast on the same two columns.
  // `twoFactorSecret` is set as soon as setup starts but only takes effect
  // once `twoFactorConfirmedAt` is set (mirrors Laravel Fortify: a pending,
  // unconfirmed secret must never gate login).
  twoFactorSecret: text("two_factor_secret"),
  twoFactorRecoveryCodes: text("two_factor_recovery_codes"),
  twoFactorConfirmedAt: timestamp("two_factor_confirmed_at", { withTimezone: true }),
  // Bumped on password change, 2FA disable, and the admin "sign out
  // everywhere" action — the `jwt()` callback in apps/web/src/auth.ts
  // rejects any token minted before this timestamp, since the app runs
  // `session: { strategy: "jwt" }` and the adapter's `sessions` table is
  // never populated (no server side session to actually delete).
  sessionsInvalidatedAt: timestamp("sessions_invalidated_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  // team_id (fan-of, not roster membership) is added in people.ts once `teams` exists,
  // via a separate ALTER — see drizzle/0000_squashed_baseline.sql.
});

// Standard Auth.js adapter tables (shape required by @auth/drizzle-adapter's
// PostgresDrizzleAdapter — see node_modules/@auth/drizzle-adapter/lib/pg.d.ts).
// Discord/Twitch OAuth link into `accounts`; email+password never creates a
// row here (passwordHash lives on `users` directly, checked by the
// Credentials provider in apps/web/src/auth.ts).
export const accounts = pgTable(
  "accounts",
  {
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })]
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { withTimezone: true }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })]
);

// WebAuthn/passkeys — shape required by Auth.js's `authenticatorsTable`
// adapter option, used by next-auth/providers/webauthn.
export const authenticators = pgTable(
  "authenticators",
  {
    credentialID: text("credential_id").notNull().unique(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    providerAccountId: text("provider_account_id").notNull(),
    credentialPublicKey: text("credential_public_key").notNull(),
    counter: integer("counter").notNull(),
    credentialDeviceType: text("credential_device_type").notNull(),
    credentialBackedUp: boolean("credential_backed_up").notNull(),
    transports: text("transports"),
    name: text("name"), // user-facing label ("iPhone de Lacy") — not read by the adapter
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.credentialID] })]
);

// --- RBAC ---------------------------------------------------------------
// Replaces Spatie Permission's team-scoped model + its `GLOBAL_ID` sentinel
// with an explicit scope_type/scope_id pair (see DATABASES.MD §5).
export const roles = pgTable("roles", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  name: text("name").notNull(),
  scopeType: text("scope_type").notNull().default("global"), // 'global' | 'team' | 'publisher'
  isSuperAdmin: boolean("is_super_admin").notNull().default(false),
});

export const permissions = pgTable("permissions", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  name: text("name").notNull().unique(),
  guard: text("guard").notNull().default("web"),
});

export const rolePermissions = pgTable("role_permissions", {
  roleId: bigint("role_id", { mode: "number" }).notNull().references(() => roles.id, { onDelete: "cascade" }),
  permissionId: bigint("permission_id", { mode: "number" }).notNull().references(() => permissions.id, { onDelete: "cascade" }),
}, (t) => [primaryKey({ columns: [t.roleId, t.permissionId] })]);

export const userRoles = pgTable("user_roles", {
  // Plain bigserial PK instead of a (userId, roleId, scopeId) composite:
  // Postgres implicitly forces NOT NULL on every column of a primary key,
  // which would make scopeId=null (the global-role case) impossible to
  // store. Dedup is enforced instead by the unique index below, which uses
  // NULLS NOT DISTINCT so two global (scopeId=null) rows for the same
  // user+role still collide like a normal composite PK would.
  id: bigserial("id", { mode: "number" }).primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  roleId: bigint("role_id", { mode: "number" }).notNull().references(() => roles.id, { onDelete: "cascade" }),
  scopeId: bigint("scope_id", { mode: "number" }), // team_id or publisher_id per roles.scopeType; null when scopeType='global'
}, (t) => [unique("user_roles_user_role_scope_unique").on(t.userId, t.roleId, t.scopeId).nullsNotDistinct()]);

// Owner is exactly one of userId (a personal key, /admin/api-keys) or
// organizationId (an org-scoped key, /dashboard/{id}/api-keys) — CHECK
// (num_nonnulls(...) = 1) added in the migration, same pattern as
// production_credits (see schema/people.ts). organizationId has no
// .references() here: it would need importing `organizations` from
// people.ts, which already imports `users` from this file — same circular
// import this avoids for users.team_id, see drizzle/0000_squashed_baseline.sql.
// FK + CHECK added as raw SQL in the migration that introduces this column.
export const apiKeys = pgTable("api_key", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
  organizationId: bigint("organization_id", { mode: "number" }),
  clientName: text("client_name").notNull(),
  keyHash: char("key_hash", { length: 64 }).notNull().unique(), // sha256, plaintext never stored
  rateLimit: bigint("rate_limit", { mode: "number" }),
  isActive: boolean("is_active").notNull().default(true),
});

export const apiKeyReveals = pgTable("api_key_reveals", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  apiKeyId: bigint("api_key_id", { mode: "number" }).notNull().references(() => apiKeys.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  keyValueEncrypted: text("key_value_encrypted").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  viewedAt: timestamp("viewed_at", { withTimezone: true }),
  supersededAt: timestamp("superseded_at", { withTimezone: true }),
});

// Fixed-window counter backing lib/auth-throttle.ts and lib/api/v1/rate-limit.ts
// on Cloudflare Workers (Docker keeps the in-memory Map, single process).
// One row per throttle key (e.g. "login:email:x@y.com"), reset once `windowStart`
// is older than the caller's window — see lib/rate-limit-db.ts.
export const rateLimitCounters = pgTable("rate_limit_counters", {
  key: varchar("key", { length: 255 }).primaryKey(),
  count: integer("count").notNull().default(0),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull().defaultNow(),
});

export const apiRequestLog = pgTable("api_request_log", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  apiKeyId: bigint("api_key_id", { mode: "number" }).references(() => apiKeys.id, { onDelete: "set null" }),
  method: text("method").notNull(),
  endpoint: text("endpoint").notNull(),
  statusCode: smallint("status_code").notNull(),
  durationMs: bigint("duration_ms", { mode: "number" }).notNull(),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
