/**
 * GC-Stats — oauth module
 *
 * "Login with GC Stats" OAuth 2.0 provider tables: oauth_clients,
 * authorization codes, access/refresh tokens, and user consents.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { pgTable, bigserial, bigint, text, char, boolean, timestamp, unique } from "drizzle-orm/pg-core";
import { users } from "./auth";

// "Login with GC Stats" OAuth 2.0 provider (Authorization Code + PKCE).
// Admin-managed clients only for now (/admin/oauth-clients, mirrors api_key) —
// no per-organization self-service yet, kept possible later via the same
// owner-discriminant pattern as apiKeys if third-party clients are opened up.
export const oauthClients = pgTable("oauth_clients", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  name: text("name").notNull(),
  clientId: text("client_id").notNull().unique(),
  // Hash only (sha256, mirrors apiKeys.keyHash) — plaintext returned once at
  // creation/regeneration, never stored. Null for a public client (mobile/SPA,
  // relies on PKCE alone) — isConfidential distinguishes the two.
  clientSecretHash: char("client_secret_hash", { length: 64 }),
  isConfidential: boolean("is_confidential").notNull().default(true),
  // Exact string match required at /oauth/authorize — never a prefix/wildcard match.
  redirectUris: text("redirect_uris").array().notNull().default([]),
  // Subset of OAUTH_SCOPES (apps/web/src/lib/oauth/scopes.ts) this client may request.
  allowedScopes: text("allowed_scopes").array().notNull().default([]),
  logoUrl: text("logo_url"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Single-use, short-lived (~60s) — PKCE code_verifier is checked against
// codeChallenge at exchange time, never stored in plaintext form itself.
export const oauthAuthorizationCodes = pgTable("oauth_authorization_codes", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  codeHash: char("code_hash", { length: 64 }).notNull().unique(),
  clientId: bigint("client_id", { mode: "number" }).notNull().references(() => oauthClients.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  redirectUri: text("redirect_uri").notNull(),
  scopes: text("scopes").array().notNull().default([]),
  codeChallenge: text("code_challenge").notNull(),
  codeChallengeMethod: text("code_challenge_method").notNull().default("S256"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const oauthAccessTokens = pgTable("oauth_access_tokens", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  tokenHash: char("token_hash", { length: 64 }).notNull().unique(),
  clientId: bigint("client_id", { mode: "number" }).notNull().references(() => oauthClients.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  scopes: text("scopes").array().notNull().default([]),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// rotatedToId lets the /oauth/token refresh_token grant detect reuse of an
// already-rotated token (a sign of theft) and revoke the whole family — the
// FK has no .references() here to avoid a self-referential circular type,
// enforced instead in the migration's raw SQL (mirrors organizationId on
// apiKeys, schema/auth.ts).
export const oauthRefreshTokens = pgTable("oauth_refresh_tokens", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  tokenHash: char("token_hash", { length: 64 }).notNull().unique(),
  clientId: bigint("client_id", { mode: "number" }).notNull().references(() => oauthClients.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  scopes: text("scopes").array().notNull().default([]),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  rotatedToId: bigint("rotated_to_id", { mode: "number" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// One row per (user, client) once consent is granted — lets /oauth/authorize
// skip the consent screen on a later login covering the same or a smaller
// scope set, and backs "Connected apps" (/settings/connections) + revocation.
export const oauthConsents = pgTable(
  "oauth_consents",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    clientId: bigint("client_id", { mode: "number" }).notNull().references(() => oauthClients.id, { onDelete: "cascade" }),
    scopes: text("scopes").array().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("oauth_consents_user_client_unique").on(t.userId, t.clientId)]
);
