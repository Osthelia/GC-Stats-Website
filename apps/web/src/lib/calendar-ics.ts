/**
 * GC-Stats - calendar-ics
 *
 * Match calendar feeds (iCalendar, RFC 5545): all matches, one team's matches
 * or one tournament's matches, subscribable from Google/Apple/Outlook.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, asc, eq, gte, inArray, isNotNull, or, type SQL } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { db } from "@gc-stats/db/client";
import { entrants, matches, stageContainers, stages, teams, tournaments } from "@gc-stats/db";
import { visibleTeam, visibleTournament } from "@/lib/ghost-visibility";
import { buildTeamDisplayResolver } from "@/lib/historical-team-display";
import { routing, type AppLocale } from "@/i18n/routing";

export type CalendarScope = { kind: "all" } | { kind: "team"; teamId: number } | { kind: "tournament"; tournamentId: number };

// The global feed keeps recent results only, the per team/tournament feeds keep everything.
const ALL_FEED_DAYS_PAST = 60;
const MAX_EVENTS = 3000;

/** Text escaping for TEXT values (RFC 5545 §3.3.11). */
function escapeText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Folds a content line at 75 octets (RFC 5545 §3.1), without splitting a UTF-8 character. */
function foldLine(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  let size = 0;
  for (const char of line) {
    const charSize = encoder.encode(char).length;
    const limit = parts.length === 0 ? 75 : 74;
    if (size + charSize > limit) {
      parts.push(current);
      current = "";
      size = 0;
    }
    current += char;
    size += charSize;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

function formatUtc(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export function parseLocale(value: string | null): AppLocale {
  return (routing.locales as readonly string[]).includes(value ?? "") ? (value as AppLocale) : routing.defaultLocale;
}

/** Parses a route id like "42" or "42.ics", null when invalid. */
export function parseCalendarId(value: string): number | null {
  const match = /^(\d{1,15})(\.ics)?$/.exec(value);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

/** Builds the feed, null when the team/tournament doesn't exist (or isn't public). */
export async function buildMatchCalendar(scope: CalendarScope, locale: AppLocale, origin: string): Promise<string | null> {
  const t = await getTranslations({ locale, namespace: "calendar" });

  const conditions: SQL[] = [isNotNull(matches.scheduledAt), eq(tournaments.active, true), eq(stages.active, true)];
  let calendarName: string;

  if (scope.kind === "team") {
    const [team] = await db.select({ name: teams.name }).from(teams).where(and(eq(teams.id, scope.teamId), visibleTeam)).limit(1);
    if (!team) return null;
    calendarName = t("teamName", { team: team.name });
    const teamEntrants = db.select({ id: entrants.id }).from(entrants).where(eq(entrants.teamId, scope.teamId));
    conditions.push(or(inArray(matches.entrantAId, teamEntrants), inArray(matches.entrantBId, teamEntrants))!);
  } else if (scope.kind === "tournament") {
    const [tournament] = await db
      .select({ name: tournaments.name })
      .from(tournaments)
      .where(and(eq(tournaments.id, scope.tournamentId), eq(tournaments.active, true), visibleTournament))
      .limit(1);
    if (!tournament) return null;
    calendarName = t("tournamentName", { tournament: tournament.name });
    conditions.push(eq(tournaments.id, scope.tournamentId));
  } else {
    calendarName = t("allName");
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - ALL_FEED_DAYS_PAST);
    conditions.push(gte(matches.scheduledAt, since), visibleTournament);
  }

  const rows = await db
    .select({
      id: matches.id,
      status: matches.status,
      scheduledAt: matches.scheduledAt,
      bestOf: matches.bestOf,
      scoreA: matches.scoreA,
      scoreB: matches.scoreB,
      entrantAId: matches.entrantAId,
      entrantBId: matches.entrantBId,
      stageName: stages.name,
      tournamentName: tournaments.name,
    })
    .from(matches)
    .innerJoin(stageContainers, eq(stageContainers.id, matches.containerId))
    .innerJoin(stages, eq(stages.id, stageContainers.stageId))
    .innerJoin(tournaments, eq(tournaments.id, stages.tournamentId))
    .where(and(...conditions))
    .orderBy(asc(matches.scheduledAt), asc(matches.id))
    .limit(MAX_EVENTS);

  const entrantIds = [...new Set(rows.flatMap((r) => [r.entrantAId, r.entrantBId]).filter((id): id is number => id !== null))];
  const entrantRows = entrantIds.length
    ? await db.select({ id: entrants.id, displayName: entrants.displayName, teamId: entrants.teamId }).from(entrants).where(inArray(entrants.id, entrantIds))
    : [];
  const entrantById = new Map(entrantRows.map((e) => [e.id, e]));
  const resolver = await buildTeamDisplayResolver(entrantRows.map((e) => e.teamId).filter((id): id is number => id !== null));

  const tbd = t("tbd");
  const sideName = (entrantId: number | null, at: Date) => {
    const entrant = entrantId !== null ? entrantById.get(entrantId) : undefined;
    if (!entrant) return tbd;
    return entrant.teamId ? resolver.nameAt(entrant.teamId, at, entrant.displayName) : entrant.displayName;
  };
  // -1 is the forfeit sentinel.
  const scoreLabel = (score: number | null) => (score === -1 ? "FF" : String(score ?? 0));

  const stamp = formatUtc(new Date());
  const host = new URL(origin).host;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//GC Stats//Match calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(calendarName)}`,
    "X-WR-TIMEZONE:UTC",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];

  for (const row of rows) {
    const start = row.scheduledAt!;
    const nameA = sideName(row.entrantAId, start);
    const nameB = sideName(row.entrantBId, start);
    const summary =
      row.status === "completed" && row.scoreA !== null && row.scoreB !== null
        ? `${nameA} ${scoreLabel(row.scoreA)} - ${scoreLabel(row.scoreB)} ${nameB}`
        : `${nameA} vs ${nameB}`;
    const url = `${origin}/${locale}/match/${row.id}`;
    const description = [`${row.tournamentName} (${row.stageName})`, t("bestOf", { count: row.bestOf }), url].join("\n");

    lines.push(
      "BEGIN:VEVENT",
      `UID:match-${row.id}@${host}`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${formatUtc(start)}`,
      // Roughly one hour per map.
      `DURATION:PT${Math.max(1, row.bestOf)}H`,
      `SUMMARY:${escapeText(`${summary} | ${row.tournamentName}`)}`,
      `DESCRIPTION:${escapeText(description)}`,
      `URL:${url}`,
      "STATUS:CONFIRMED",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");

  return lines.map(foldLine).join("\r\n") + "\r\n";
}

/** Shared GET handler of the calendar routes. */
export async function calendarResponse(request: Request, scope: CalendarScope | null): Promise<Response> {
  if (!scope) return NextResponse.json({ error: "Invalid id, expected a positive number (optionally followed by .ics)." }, { status: 400 });
  const url = new URL(request.url);
  const body = await buildMatchCalendar(scope, parseLocale(url.searchParams.get("lang")), url.origin);
  if (body === null) return NextResponse.json({ error: `${scope.kind === "team" ? "Team" : "Tournament"} not found.` }, { status: 404 });
  const filename = scope.kind === "all" ? "gc-stats-matches" : `gc-stats-${scope.kind}-${scope.kind === "team" ? scope.teamId : scope.tournamentId}`;
  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="${filename}.ics"`,
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=900",
    },
  });
}
