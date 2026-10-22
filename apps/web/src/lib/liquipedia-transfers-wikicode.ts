/**
 * GC-Stats - liquipedia-transfers-wikicode
 *
 * Builds `{{Transfer Row}}` lines from roster movements and completes a
 * monthly Liquipedia transfers page with them. Pure, no DB access.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { ROSTER_SOURCE_TEXTS } from "@/lib/roster-source";

export type TransferMembership = {
  personId: number;
  handle: string;
  /** Liquipedia page name, null when none is saved. */
  liquipediaName: string | null;
  /** Flag code, only written for people without a Liquipedia page (the page carries it otherwise). */
  flag: string | null;
  hasPage: boolean;
  teamName: string;
  /** Roster role: player, sub, coach, ... */
  role: string;
  since: string | null;
  until: string | null;
  hasLeft: boolean;
  inactiveSince: string | null;
  /** Where the arrival / departure was announced: a link or a text option (see roster-source). */
  joinSource: string | null;
  leftSource: string | null;
  /** Liquipedia page of the first / last tournament the person played with the team, for the tournament sources. */
  joinTournament: string | null;
  leftTournament: string | null;
};

type TransferSide = { team: string; role: string | null };

export type TransferEntry = {
  date: string;
  person: Pick<TransferMembership, "personId" | "handle" | "liquipediaName" | "flag" | "hasPage">;
  from: TransferSide | null;
  to: TransferSide | null;
  /** `{{TRef}}` templates of the row: the departure first, then the arrival. */
  refs: string[];
  /** Position on the page for a given day: players, coaches, analysts, then the organization. */
  rank: number;
};

export type MonthRange = { year: number; month: number; start: string; end: string };

const ROLE_LABELS: Record<string, string | null> = {
  player: null,
  "player-igl": null,
  sub: "Substitute",
  coach: "Coach",
  "assistant coach": "Assistant Coach",
  "performance coach": "Performance Coach",
  analyst: "Analyst",
  manager: "Manager",
};

export const TRANSFERS_WIKICODE_MAX_LENGTH = 300_000;

const INACTIVE_ROLE = "Inactive";
const MAX_PEOPLE_PER_ROW = 5;

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function monthRange(year: number, month: number): MonthRange {
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  return { year, month, start: `${year}-${pad(month)}-01`, end: `${nextYear}-${pad(nextMonth)}-01` };
}

/** Month of a `YYYY-MM` value, null when it is not a real month. */
export function parseMonthValue(value: string): MonthRange | null {
  const match = value.trim().match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  return year >= 2000 && year <= 2100 && month >= 1 && month <= 12 ? monthRange(year, month) : null;
}

function roleRank(role: string): number {
  if (role === "analyst") return 2;
  if (role === "manager") return 3;
  if (role === "coach" || role === "assistant coach" || role === "performance coach") return 1;
  return 0;
}

function sideLabel(role: string, inactive: boolean): string | null {
  return inactive ? INACTIVE_ROLE : (ROLE_LABELS[role] ?? null);
}

type Event = { kind: "join" | "leave" | "inactive"; date: string; membership: TransferMembership };

/** One entry per movement of the month: a join, a leave, a direct team change (same person, same day) or a switch to inactive. */
export function buildTransferEntries(memberships: TransferMembership[], range: MonthRange): TransferEntry[] {
  const inMonth = (date: string | null): date is string => date !== null && date >= range.start && date < range.end;
  const events: Event[] = [];
  for (const m of memberships) {
    if (inMonth(m.since)) events.push({ kind: "join", date: m.since, membership: m });
    if (m.hasLeft && inMonth(m.until)) events.push({ kind: "leave", date: m.until, membership: m });
    if (inMonth(m.inactiveSince) && m.inactiveSince !== m.since && !(m.hasLeft && m.inactiveSince === m.until)) {
      events.push({ kind: "inactive", date: m.inactiveSince, membership: m });
    }
  }

  const byPersonDay = new Map<string, Event[]>();
  for (const event of events) {
    const key = `${event.membership.personId}|${event.date}`;
    byPersonDay.set(key, [...(byPersonDay.get(key) ?? []), event]);
  }

  const entries: TransferEntry[] = [];
  for (const dayEvents of byPersonDay.values()) {
    const leaves = dayEvents.filter((e) => e.kind === "leave");
    const joins = dayEvents.filter((e) => e.kind === "join");
    const pairCount = Math.max(leaves.length, joins.length);

    const sideOf = (event: Event | undefined): TransferSide | null => {
      if (!event) return null;
      const { membership } = event;
      const inactive = membership.inactiveSince !== null && membership.inactiveSince <= event.date;
      return { team: membership.teamName, role: sideLabel(membership.role, inactive) };
    };
    const push = (event: Event, from: TransferSide | null, to: TransferSide | null, refs: (string | null)[]) => {
      const { membership } = event;
      entries.push({ date: event.date, person: membership, from, to, refs: [...new Set(refs.filter((r): r is string => r !== null))], rank: roleRank(membership.role) });
    };

    for (let i = 0; i < pairCount; i++) {
      const leave = leaves[i];
      const join = joins[i];
      const from = sideOf(leave);
      const to = sideOf(join);
      // Closing and reopening the same entry on the same day is not a movement.
      if (from && to && from.team === to.team && from.role === to.role) continue;
      push((join ?? leave)!, from, to, [leave ? refTemplate(leave.membership.leftSource, "left", leave.membership.leftTournament) : null, join ? refTemplate(join.membership.joinSource, "join", join.membership.joinTournament) : null]);
    }
    for (const event of dayEvents.filter((e) => e.kind === "inactive")) {
      const team = event.membership.teamName;
      push(event, { team, role: sideLabel(event.membership.role, false) }, { team, role: INACTIVE_ROLE }, []);
    }
  }

  return entries.sort((a, b) => b.date.localeCompare(a.date) || a.rank - b.rank || a.person.handle.localeCompare(b.person.handle));
}

/** `|` ends a template parameter, `{{!}}` writes it literally. */
function escapeParam(value: string): string {
  return value.replaceAll("|", "{{!}}");
}

function sideKey(side: TransferSide | null): string {
  return side ? `${side.team}|${side.role ?? ""}` : "";
}

function personParams(person: TransferEntry["person"], index: number): string[] {
  const suffix = index === 0 ? "" : String(index + 1);
  const params = [`name${suffix}=${escapeParam(person.handle)}`];
  if (person.liquipediaName && person.liquipediaName.toLowerCase() !== person.handle.toLowerCase()) params.push(`link${suffix}=${escapeParam(person.liquipediaName)}`);
  if (!person.hasPage && person.flag) params.push(`flag${suffix}=${person.flag}`);
  return params;
}

function sideParams(side: TransferSide | null, number: 1 | 2): string[] {
  if (!side) return [];
  return [`team${number}=${escapeParam(side.team)}`, ...(side.role ? [`role${number}=${escapeParam(side.role)}`] : [])];
}

/**
 * Liquipedia reference of a stored source, null when it has none: a link is a web source, a tournament
 * option points to the tournament found for it, and the other texts have no equivalent (no free text on Liquipedia).
 */
function refTemplate(source: string | null, kind: "join" | "left", tournament: string | null): string | null {
  if (!source) return null;
  if (/^https?:\/\//i.test(source)) return `{{TRef|url=${escapeParam(source)}}}`;
  switch (source) {
    case ROSTER_SOURCE_TEXTS.startedTournament:
    case ROSTER_SOURCE_TEXTS.stoppedTournament:
      return tournament ? `{{TRef|type=tournament ${kind === "join" ? "source" : "leave source"}|url=${escapeParam(tournament)}}}` : null;
    case ROSTER_SOURCE_TEXTS.insideSource:
      return "{{TRef|type=inside source}}";
    default:
      return null;
  }
}

/** Rows of the page: people who made the same move on the same day with the same source share one row. */
export function buildTransferRows(entries: TransferEntry[]): { date: string; text: string; people: TransferEntry["person"][] }[] {
  const groups = new Map<string, TransferEntry[]>();
  for (const entry of entries) {
    const base = `${entry.date}|${sideKey(entry.from)}|${sideKey(entry.to)}|${entry.refs.join("")}|${entry.rank}`;
    let key = base;
    for (let n = 1; (groups.get(key)?.length ?? 0) >= MAX_PEOPLE_PER_ROW; n++) key = `${base}#${n}`;
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }

  return [...groups.values()].map((group) => {
    const first = group[0]!;
    const params = [
      `date=${first.date}`,
      ...group.flatMap((entry, index) => personParams(entry.person, index)),
      ...sideParams(first.from, 1),
      ...sideParams(first.to, 2),
      ...(first.refs.length > 0 ? [`ref=${first.refs.join("")}`] : []),
    ];
    return { date: first.date, text: `{{Transfer Row|${params.join("|")}}}`, people: group.map((e) => e.person) };
  });
}

const START_RE = /\{\{\s*Transfer Start[^}]*\}\}/i;
const END_RE = /\{\{\s*Transfer End\s*\}\}/i;
const ROW_START_RE = /^\{\{\s*Transfer Row\b/gim;

export type TransferPageError = "missingStart" | "missingEnd" | "endBeforeStart";

type ExistingRow = { raw: string; date: string | null; names: Set<string> };

type ParsedPage = { head: string; rows: ExistingRow[]; tail: string; leading: string; newline: string };

function parseRow(raw: string): ExistingRow {
  const date = raw.match(/\|\s*date\s*=\s*(\d{4}-\d{2}-\d{2})/i)?.[1] ?? null;
  const names = new Set<string>();
  for (const match of raw.matchAll(/\|\s*(?:name|link)\d?\s*=\s*([^|}\n]+)/gi)) names.add(match[1]!.trim().toLowerCase());
  return { raw, date, names };
}

/** Splits a transfers page into what comes before the rows, the rows and what comes after. */
function parsePage(wikicode: string): ParsedPage | TransferPageError {
  const start = START_RE.exec(wikicode);
  if (!start) return "missingStart";
  const end = END_RE.exec(wikicode.slice(start.index + start[0].length));
  if (!end) return "missingEnd";
  const bodyStart = start.index + start[0].length;
  const bodyEnd = bodyStart + end.index;

  const body = wikicode.slice(bodyStart, bodyEnd);
  const starts = [...body.matchAll(ROW_START_RE)].map((m) => m.index!);
  const rows = starts.map((from, i) => parseRow(body.slice(from, starts[i + 1] ?? body.length).trimEnd()));

  return {
    head: wikicode.slice(0, bodyStart),
    leading: starts.length > 0 ? body.slice(0, starts[0]).trim() : body.trim(),
    rows,
    tail: wikicode.slice(bodyEnd),
    newline: wikicode.includes("\r\n") ? "\r\n" : "\n",
  };
}

/** Month a transfers page covers: its title ("Transfers 2026 June"), else the month most of its rows are dated in. */
export function detectPageMonth(wikicode: string): MonthRange | null {
  const title = wikicode.match(/\{\{\s*DISPLAYTITLE\s*:[^}]*?(\d{4})\s+([A-Za-z]+)/i);
  if (title) {
    const month = MONTH_NAMES.findIndex((name) => name.toLowerCase() === title[2]!.toLowerCase()) + 1;
    if (month > 0) return monthRange(Number(title[1]), month);
  }

  const counts = new Map<string, number>();
  for (const match of wikicode.matchAll(/\|\s*date\s*=\s*(\d{4}-\d{2})-\d{2}/gi)) counts.set(match[1]!, (counts.get(match[1]!) ?? 0) + 1);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return top ? parseMonthValue(top[0]) : null;
}

export function validateTransferPage(wikicode: string): TransferPageError | null {
  const start = START_RE.exec(wikicode);
  if (!start) return "missingStart";
  return END_RE.test(wikicode.slice(start.index + start[0].length)) ? null : "missingEnd";
}

export type CompletedTransfers = {
  wikicode: string;
  /** Rows added to the page. */
  addedRows: number;
  /** People already on the page that day, left untouched. */
  alreadyListed: string[];
};

/** Adds the entries missing from the page, each row placed by date (newest first) among the existing ones. */
export function completeTransferPage(wikicode: string, entries: TransferEntry[]): CompletedTransfers | TransferPageError {
  const page = parsePage(wikicode);
  if (typeof page === "string") return page;

  const alreadyListed: string[] = [];
  const missing = entries.filter((entry) => {
    const listed = page.rows.some((row) => {
      if (row.date !== entry.date) return false;
      return row.names.has(entry.person.handle.toLowerCase()) || (entry.person.liquipediaName !== null && row.names.has(entry.person.liquipediaName.toLowerCase()));
    });
    if (listed && !alreadyListed.includes(entry.person.handle)) alreadyListed.push(entry.person.handle);
    return !listed;
  });

  const rows = page.rows.map((row) => row.raw);
  const dates = page.rows.map((row) => row.date);
  const newRows = buildTransferRows(missing);
  for (const row of newRows) {
    const index = dates.findIndex((date) => date !== null && date < row.date);
    const at = index === -1 ? rows.length : index;
    rows.splice(at, 0, row.text);
    dates.splice(at, 0, row.date);
  }

  const { newline } = page;
  const body = [...(page.leading ? [page.leading] : []), ...rows].join(newline);
  return { wikicode: `${page.head}${newline}${body}${newline}${page.tail.replace(/^\s+/, "")}`, addedRows: newRows.length, alreadyListed };
}
