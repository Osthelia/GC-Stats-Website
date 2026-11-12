/**
 * GC-Stats - admin-team-requests
 *
 * Admin queries for /admin/team-requests: recommended teams, tracked
 * requests, and the context (data held, roster, contacts) used to prepare
 * a request.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, count, countDistinct, desc, eq, gte, inArray, isNotNull, isNull, lte, notExists, or, sql } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { aboutTeamMemberSettings, organizations, roles, teamInfoRequests, teamPrivateContacts, userRoles, users, valorantTables } from "@gc-stats/db";
import { getCurrentLogoUrls } from "@/lib/admin-logos";
import { getAdminTeamRoster } from "@/lib/admin-teams";
import {
  RECOMMENDED_WINDOW_DAYS,
  ROSTER_CHECK_MATCH_COUNT,
  TEAM_REQUEST_CONTACT_CHANNELS,
  TEAM_REQUEST_PAGE_SIZE,
  TEAM_REQUEST_SOCIAL_KEYS,
  type TeamRequestContactChannel,
  type TeamRequestContactKind,
  type TeamRequestItem,
  type TeamRequestScope,
  type TeamRequestSocialKey,
  type TeamRequestTab,
} from "@/lib/team-requests/constants";

const { entrants, mapPlayerStats, maps, matches, people, rosterMemberships, teams, tournaments } = valorantTables;

const PLAYER_ROLES = ["player", "player-igl", "sub"];
const MANAGER_ROLES = ["manager"];
const COACH_ROLES = ["coach", "assistant coach", "performance coach"];

export type RecommendedTeamRow = {
  teamId: number;
  teamName: string;
  teamLogoUrl: string | null;
  lastTournamentName: string;
  lastPlayedAt: string;
};

export type TeamRequestRow = {
  id: number;
  teamId: number;
  teamName: string;
  teamLogoUrl: string | null;
  status: "pending" | "done";
  items: TeamRequestItem[];
  message: string;
  contactKind: TeamRequestContactKind;
  contactChannel: TeamRequestContactChannel;
  contactValue: string;
  contactLabel: string;
  createdByUsername: string | null;
  createdAt: string;
  completedAt: string | null;
};

export type TeamRequestCounts = { recommended: number; pending: number; done: number };

export type ContactSuggestion = {
  kind: TeamRequestContactKind;
  channel: TeamRequestContactChannel;
  value: string;
  label: string;
};

export type RequestRosterLine = { personId: number; handle: string; role: string; since: string | null; until: string | null };
export type UnlistedPlayer = { personId: number; handle: string; matches: number };

export type RequesterSignature = { name: string; role: string | null };

export type TeamRequestContext = {
  teamId: number;
  teamName: string;
  logoUrl: string | null;
  socials: Record<TeamRequestSocialKey, string | null>;
  currentRoster: RequestRosterLine[];
  pastRoster: RequestRosterLine[];
  unlistedPlayers: UnlistedPlayer[];
  contacts: ContactSuggestion[];
  lastContact: { kind: TeamRequestContactKind; channel: TeamRequestContactChannel; value: string } | null;
  pendingRequestId: number | null;
  /** Who signs the message: the staff member preparing the request. */
  signature: RequesterSignature;
};

function windowStart(): Date {
  return new Date(Date.now() - RECOMMENDED_WINDOW_DAYS * 24 * 60 * 60 * 1000);
}

function noRequestYet() {
  return notExists(db.select({ one: sql`1` }).from(teamInfoRequests).where(eq(teamInfoRequests.teamId, teams.id)));
}

function recommendedConditions() {
  return and(
    eq(teams.isGhost, false),
    eq(matches.status, "completed"),
    isNotNull(matches.scheduledAt),
    gte(matches.scheduledAt, windowStart()),
    lte(matches.scheduledAt, new Date()),
    noRequestYet()
  );
}

/** Teams that played recently and were never the subject of a request, most recent first. */
export async function listRecommendedTeams(): Promise<RecommendedTeamRow[]> {
  // One row per team: its most recent match.
  const rows = await db
    .selectDistinctOn([teams.id], {
      teamId: teams.id,
      teamName: teams.name,
      tournamentName: tournaments.name,
      scheduledAt: matches.scheduledAt,
    })
    .from(entrants)
    .innerJoin(teams, eq(teams.id, entrants.teamId))
    .innerJoin(tournaments, eq(tournaments.id, entrants.tournamentId))
    .innerJoin(matches, or(eq(matches.entrantAId, entrants.id), eq(matches.entrantBId, entrants.id)))
    .where(recommendedConditions())
    .orderBy(teams.id, desc(matches.scheduledAt));

  const list: RecommendedTeamRow[] = rows
    .filter((row) => row.scheduledAt)
    .map((row) => ({
      teamId: row.teamId,
      teamName: row.teamName,
      teamLogoUrl: null,
      lastTournamentName: row.tournamentName,
      lastPlayedAt: row.scheduledAt!.toISOString(),
    }))
    .sort((x, y) => y.lastPlayedAt.localeCompare(x.lastPlayedAt));

  const logos = await getCurrentLogoUrls("team", list.map((r) => r.teamId), "valorant");
  return list.map((r) => ({ ...r, teamLogoUrl: logos.get(r.teamId) ?? null }));
}

async function countRecommendedTeams(): Promise<number> {
  const [row] = await db
    .select({ total: countDistinct(teams.id) })
    .from(entrants)
    .innerJoin(teams, eq(teams.id, entrants.teamId))
    .innerJoin(matches, or(eq(matches.entrantAId, entrants.id), eq(matches.entrantBId, entrants.id)))
    .where(recommendedConditions());
  return row?.total ?? 0;
}

export async function getTeamRequestCounts(userId: string, scope: TeamRequestScope): Promise<TeamRequestCounts> {
  const owner = scope === "mine" ? eq(teamInfoRequests.createdBy, userId) : undefined;
  const [recommended, byStatus] = await Promise.all([
    countRecommendedTeams(),
    db
      .select({ status: teamInfoRequests.status, total: count() })
      .from(teamInfoRequests)
      .where(owner)
      .groupBy(teamInfoRequests.status),
  ]);
  const get = (status: string) => byStatus.find((r) => r.status === status)?.total ?? 0;
  return { recommended, pending: get("pending"), done: get("done") };
}

export async function listTeamRequests(opts: {
  tab: Exclude<TeamRequestTab, "recommended">;
  scope: TeamRequestScope;
  userId: string;
  page: number;
}): Promise<{ rows: TeamRequestRow[]; total: number }> {
  const where = and(eq(teamInfoRequests.status, opts.tab), opts.scope === "mine" ? eq(teamInfoRequests.createdBy, opts.userId) : undefined);

  const [rows, [totalRow]] = await Promise.all([
    db
      .select({
        id: teamInfoRequests.id,
        teamId: teamInfoRequests.teamId,
        teamName: teams.name,
        status: teamInfoRequests.status,
        items: teamInfoRequests.items,
        message: teamInfoRequests.message,
        contactKind: teamInfoRequests.contactKind,
        contactChannel: teamInfoRequests.contactChannel,
        contactValue: teamInfoRequests.contactValue,
        contactLabel: teamInfoRequests.contactLabel,
        createdByUsername: users.username,
        createdAt: teamInfoRequests.createdAt,
        completedAt: teamInfoRequests.completedAt,
      })
      .from(teamInfoRequests)
      .innerJoin(teams, eq(teams.id, teamInfoRequests.teamId))
      .leftJoin(users, eq(users.id, teamInfoRequests.createdBy))
      .where(where)
      .orderBy(desc(opts.tab === "done" ? teamInfoRequests.completedAt : teamInfoRequests.createdAt), desc(teamInfoRequests.id))
      .limit(TEAM_REQUEST_PAGE_SIZE)
      .offset((opts.page - 1) * TEAM_REQUEST_PAGE_SIZE),
    db.select({ total: count() }).from(teamInfoRequests).where(where),
  ]);

  const logos = await getCurrentLogoUrls("team", [...new Set(rows.map((r) => r.teamId))], "valorant");
  return {
    total: totalRow?.total ?? 0,
    rows: rows.map((r) => ({
      ...r,
      status: r.status as TeamRequestRow["status"],
      items: r.items as TeamRequestItem[],
      contactKind: r.contactKind as TeamRequestContactKind,
      contactChannel: r.contactChannel as TeamRequestContactChannel,
      teamLogoUrl: logos.get(r.teamId) ?? null,
      createdAt: r.createdAt.toISOString(),
      completedAt: r.completedAt?.toISOString() ?? null,
    })),
  };
}

function cleanString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readSocials(raw: unknown): Record<string, string | null> {
  const source = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return Object.fromEntries(Object.entries(source).map(([key, value]) => [key, cleanString(value)]));
}

function channelContacts(socials: Record<string, string | null>, kind: TeamRequestContactKind, label: string): ContactSuggestion[] {
  const out: ContactSuggestion[] = [];
  for (const channel of TEAM_REQUEST_CONTACT_CHANNELS) {
    const value = socials[channel];
    if (value) out.push({ kind, channel, value, label });
  }
  return out;
}

/** Players who played one of the last matches without a roster stint covering that day. */
async function findUnlistedPlayers(teamId: number, stints: { personId: number; role: string; since: string | null; until: string | null }[]): Promise<UnlistedPlayer[]> {
  const recent = await db
    .select({ matchId: matches.id, entrantId: entrants.id, scheduledAt: matches.scheduledAt })
    .from(entrants)
    .innerJoin(matches, or(eq(matches.entrantAId, entrants.id), eq(matches.entrantBId, entrants.id)))
    .where(and(eq(entrants.teamId, teamId), eq(matches.status, "completed"), isNotNull(matches.scheduledAt)))
    .orderBy(desc(matches.scheduledAt))
    .limit(ROSTER_CHECK_MATCH_COUNT);
  if (recent.length === 0) return [];

  const played = await db
    .select({ matchId: maps.matchId, entrantId: mapPlayerStats.entrantId, personId: people.id, handle: people.handle })
    .from(mapPlayerStats)
    .innerJoin(maps, eq(maps.id, mapPlayerStats.mapId))
    .innerJoin(people, eq(people.id, mapPlayerStats.personId))
    .where(inArray(maps.matchId, recent.map((m) => m.matchId)));

  const matchById = new Map(recent.map((m) => [`${m.matchId}:${m.entrantId}`, m]));
  const found = new Map<number, UnlistedPlayer>();
  const seenInMatch = new Set<string>();

  for (const row of played) {
    const match = matchById.get(`${row.matchId}:${row.entrantId}`);
    if (!match?.scheduledAt) continue;
    const day = match.scheduledAt.toISOString().slice(0, 10);
    const covered = stints.some(
      (s) => s.personId === row.personId && PLAYER_ROLES.includes(s.role) && (!s.since || s.since.slice(0, 10) <= day) && (!s.until || s.until.slice(0, 10) >= day)
    );
    if (covered) continue;

    const entry = found.get(row.personId) ?? { personId: row.personId, handle: row.handle, matches: 0 };
    const key = `${row.matchId}:${row.personId}`;
    if (!seenInMatch.has(key)) {
      seenInMatch.add(key);
      entry.matches += 1;
    }
    found.set(row.personId, entry);
  }
  return [...found.values()].sort((a, b) => b.matches - a.matches);
}

/** Display name and role of the staff member, the role being the one shown on the About page when it has an override. */
async function getRequesterSignature(userId: string): Promise<RequesterSignature> {
  const rows = await db
    .select({ username: users.username, name: users.name, roleName: roles.name, displayRole: aboutTeamMemberSettings.displayRole })
    .from(users)
    .leftJoin(userRoles, and(eq(userRoles.userId, users.id), isNull(userRoles.scopeId)))
    .leftJoin(roles, and(eq(roles.id, userRoles.roleId), eq(roles.scopeType, "global")))
    .leftJoin(aboutTeamMemberSettings, eq(aboutTeamMemberSettings.userId, users.id))
    .where(eq(users.id, userId));

  const first = rows[0];
  const override = (first?.displayRole as Record<string, string> | null)?.en?.trim();
  return {
    name: first?.name?.trim() || first?.username || "",
    role: override || rows.find((r) => r.roleName)?.roleName || null,
  };
}

export async function getTeamRequestContext(teamId: number, userId: string): Promise<TeamRequestContext | null> {
  const [team] = await db
    .select({ id: teams.id, name: teams.name, socials: teams.socials, organizationId: teams.organizationId })
    .from(teams)
    .where(eq(teams.id, teamId))
    .limit(1);
  if (!team) return null;

  const [logos, roster, orgRow, lastRequest, pending, privateContact, signature] = await Promise.all([
    getCurrentLogoUrls("team", [teamId], "valorant"),
    getAdminTeamRoster("valorant", teamId),
    team.organizationId
      ? db.select({ name: organizations.name, socials: organizations.socials }).from(organizations).where(eq(organizations.id, team.organizationId)).limit(1)
      : Promise.resolve([]),
    db
      .select({ kind: teamInfoRequests.contactKind, channel: teamInfoRequests.contactChannel, value: teamInfoRequests.contactValue })
      .from(teamInfoRequests)
      .where(eq(teamInfoRequests.teamId, teamId))
      .orderBy(desc(teamInfoRequests.createdAt))
      .limit(1),
    db
      .select({ id: teamInfoRequests.id })
      .from(teamInfoRequests)
      .where(and(eq(teamInfoRequests.teamId, teamId), eq(teamInfoRequests.status, "pending")))
      .limit(1),
    db.select({ email: teamPrivateContacts.email }).from(teamPrivateContacts).where(eq(teamPrivateContacts.teamId, teamId)).limit(1),
    getRequesterSignature(userId),
  ]);

  const teamSocials = readSocials(team.socials);
  const socials = Object.fromEntries(TEAM_REQUEST_SOCIAL_KEYS.map((key) => [key, teamSocials[key] ?? null])) as Record<TeamRequestSocialKey, string | null>;

  const toLine = (m: (typeof roster)[number]): RequestRosterLine => ({ personId: m.personId, handle: m.handle, role: m.role, since: m.since, until: m.until });
  const currentRoster = roster.filter((m) => m.isCurrent).map(toLine);
  const pastRoster = roster.filter((m) => !m.isCurrent).map(toLine);

  const staffIds = currentRoster.filter((m) => [...MANAGER_ROLES, ...COACH_ROLES].includes(m.role)).map((m) => m.personId);
  const staffRows = staffIds.length > 0 ? await db.select({ id: people.id, socials: people.socials }).from(people).where(inArray(people.id, staffIds)) : [];
  const staffSocials = new Map(staffRows.map((p) => [p.id, readSocials(p.socials)]));

  const contacts: ContactSuggestion[] = [
    ...(privateContact[0] ? [{ kind: "organization" as const, channel: "email" as const, value: privateContact[0].email, label: team.name }] : []),
    ...channelContacts(teamSocials, "organization", team.name),
    ...(orgRow[0] ? channelContacts(readSocials(orgRow[0].socials), "organization", orgRow[0].name) : []),
  ];
  for (const member of currentRoster) {
    const kind = MANAGER_ROLES.includes(member.role) ? "manager" : COACH_ROLES.includes(member.role) ? "coach" : null;
    if (kind) contacts.push(...channelContacts(staffSocials.get(member.personId) ?? {}, kind, member.handle));
  }
  const seen = new Set<string>();
  const uniqueContacts = contacts.filter((c) => {
    const key = `${c.channel}:${c.value.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const last = lastRequest[0];
  return {
    teamId,
    teamName: team.name,
    logoUrl: logos.get(teamId) ?? null,
    socials,
    currentRoster,
    pastRoster,
    unlistedPlayers: await findUnlistedPlayers(teamId, roster.map((m) => ({ personId: m.personId, role: m.role, since: m.since, until: m.until }))),
    contacts: uniqueContacts,
    lastContact: last ? { kind: last.kind as TeamRequestContactKind, channel: last.channel as TeamRequestContactChannel, value: last.value } : null,
    pendingRequestId: pending[0]?.id ?? null,
    signature,
  };
}
