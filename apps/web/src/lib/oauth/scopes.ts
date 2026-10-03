/**
 * GC-Stats - scopes
 *
 * Server-only: builds the userinfo claims object for exactly the OAuth
 * scopes granted to a token, never more than what the user consented to.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, desc, eq, gt, isNull, ne, or, sql } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { users, accounts, people, rosterMemberships, teams, organizationMemberships, organizations, changeRequests, changeRequestItems, sanctions } from "@gc-stats/db";
import { rangeIsOpen, rangeLower, rangeUpper } from "@/lib/daterange";
import type { OAuthScope } from "@/lib/oauth/scope-list";

export { OAUTH_SCOPES, isOAuthScope, parseScopeParam, type OAuthScope } from "@/lib/oauth/scope-list";

/** Builds the userinfo claims object for exactly the scopes granted to a token — never more than what was consented to. */
export async function resolveOAuthClaims(userId: string, scopes: OAuthScope[]): Promise<Record<string, unknown>> {
  const claims: Record<string, unknown> = { sub: userId };

  if (scopes.includes("profile")) {
    const [user] = await db.select({ username: users.username, image: users.image }).from(users).where(eq(users.id, userId)).limit(1);
    claims.username = user?.username ?? null;
    claims.image = user?.image ?? null;
  }

  if (scopes.includes("email")) {
    const [user] = await db.select({ email: users.email, emailVerified: users.emailVerified }).from(users).where(eq(users.id, userId)).limit(1);
    claims.email = user?.email ?? null;
    claims.emailVerified = user?.emailVerified ?? null;
  }

  if (scopes.includes("created_at")) {
    const [user] = await db.select({ createdAt: users.createdAt }).from(users).where(eq(users.id, userId)).limit(1);
    claims.createdAt = user?.createdAt ? user.createdAt.toISOString() : null;
  }

  // Active only (not revoked, not expired), same rule as statusOf — and never
  // a "note", internal only. The reason stays out: it's moderator-written text.
  if (scopes.includes("sanctions")) {
    const rows = await db
      .select({ id: sanctions.id, type: sanctions.type, startsAt: sanctions.startsAt, endsAt: sanctions.endsAt })
      .from(sanctions)
      .where(and(eq(sanctions.userId, userId), ne(sanctions.type, "note"), isNull(sanctions.revokedAt), or(isNull(sanctions.endsAt), gt(sanctions.endsAt, sql`now()`))))
      .orderBy(desc(sanctions.id));
    claims.activeSanctions = rows.map((r) => ({
      id: r.id,
      type: r.type,
      startsAt: r.startsAt.toISOString(),
      endsAt: r.endsAt ? r.endsAt.toISOString() : null,
    }));
  }

  if (scopes.includes("linked_accounts")) {
    const linked = await db.select({ provider: accounts.provider, providerAccountId: accounts.providerAccountId }).from(accounts).where(eq(accounts.userId, userId));
    claims.linkedAccounts = linked;
  }

  // teams/org both need the linked person to resolve their history from —
  // resolved once and shared, same as `player` below (a token can hold all three).
  if (scopes.includes("player") || scopes.includes("teams") || scopes.includes("org")) {
    const [person] = await db
      .select({ id: people.id, handle: people.handle, firstName: people.firstName, lastName: people.lastName, countryCode: people.countryCode })
      .from(people)
      .where(eq(people.userId, userId))
      .limit(1);

    if (scopes.includes("player")) claims.player = person ?? null;

    if (scopes.includes("teams")) {
      const rows = person
        ? await db
            .select({ teamId: teams.id, teamName: teams.name, role: rosterMemberships.role, period: rosterMemberships.period })
            .from(rosterMemberships)
            .innerJoin(teams, eq(teams.id, rosterMemberships.teamId))
            .where(eq(rosterMemberships.personId, person.id))
        : [];
      claims.teams = rows.map((r) => ({
        teamId: r.teamId,
        teamName: r.teamName,
        role: r.role,
        since: rangeLower(r.period),
        until: rangeIsOpen(r.period) ? null : rangeUpper(r.period),
        current: rangeIsOpen(r.period),
      }));
    }

    if (scopes.includes("org")) {
      const rows = person
        ? await db
            .select({ organizationId: organizations.id, organizationName: organizations.name, role: organizationMemberships.role, period: organizationMemberships.period })
            .from(organizationMemberships)
            .innerJoin(organizations, eq(organizations.id, organizationMemberships.organizationId))
            .where(eq(organizationMemberships.personId, person.id))
        : [];
      claims.organizations = rows.map((r) => ({
        organizationId: r.organizationId,
        organizationName: r.organizationName,
        role: r.role,
        since: rangeLower(r.period),
        until: rangeIsOpen(r.period) ? null : rangeUpper(r.period),
        current: rangeIsOpen(r.period),
      }));
    }
  }

  // Latest link request sent by this account, so an app can see a refusal
  // (userinfo.player only ever shows an approved link).
  if (scopes.includes("link_player")) {
    const [request] = await db
      .select({ changeRequestId: changeRequests.id, personId: changeRequests.subjectId, status: changeRequestItems.status, resolvedAt: changeRequestItems.resolvedAt })
      .from(changeRequests)
      .innerJoin(changeRequestItems, eq(changeRequestItems.changeRequestId, changeRequests.id))
      .where(and(eq(changeRequests.subjectType, "person"), eq(changeRequests.requestedBy, userId), eq(changeRequestItems.field, "user_link")))
      .orderBy(desc(changeRequests.id))
      .limit(1);

    claims.playerLinkRequest = request
      ? { changeRequestId: request.changeRequestId, personId: request.personId, status: request.status, resolvedAt: request.resolvedAt ? request.resolvedAt.toISOString() : null }
      : null;
  }

  return claims;
}
