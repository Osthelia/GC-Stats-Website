/**
 * GC-Stats - liquipedia-import
 *
 * Compares the Liquipedia page of each mapped team and person of a tournament
 * with our own data and turns the gaps into change request proposals. Only
 * empty fields are proposed, nothing we already hold is overwritten.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { and, eq, inArray, like } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { gameTables } from "@gc-stats/db";
import { fetchLiquipediaPages } from "@/lib/liquipedia-api";
import { getTournamentLiquipediaPeople, getTournamentLiquipediaStages } from "@/lib/admin-liquipedia";
import { IMPORT_SOCIAL_KEYS, liquipediaPageUrl, parsePlayerInfobox, parseTeamInfobox } from "@/lib/liquipedia-import-parse";
import type { GameSlug } from "@gc-stats/db/game";

/** Start of every reason written by the import, used to spot requests still waiting for review. */
export const LIQUIPEDIA_IMPORT_REASON = "Liquipedia import";
const SEVERAL_ACCOUNTS_NOTE = "Several accounts found on Liquipedia for the same network, keep only one.";
const SOURCE_WARNING = "⚠️ If any field (except the Liquipedia URL) is accepted, the Liquipedia source must be accepted too.";

function buildReason(note?: string): string {
  const head = note ? `${LIQUIPEDIA_IMPORT_REASON}. ${note}` : LIQUIPEDIA_IMPORT_REASON;
  return `${head}\n${SOURCE_WARNING}`;
}

export type ImportItem = { field: string; oldValue: unknown; newValue: unknown };

export type ImportProposal = {
  subjectType: "team" | "person";
  subjectId: number;
  label: string;
  reason: string;
  items: ImportItem[];
};

export type ImportPlan = {
  proposals: ImportProposal[];
  /** Subjects with nothing to propose. */
  upToDate: number;
  /** Subjects that already have an import request waiting for review. */
  alreadyPending: number;
  /** Labels of subjects whose Liquipedia page is missing or has no infobox. */
  noPage: string[];
};

type Socials = Record<string, string | null | undefined>;

function isEmpty(value: string | null | undefined): boolean {
  return !value || !value.trim();
}

async function pendingImportSubjects(game: GameSlug, subjectType: "team" | "person", ids: number[]): Promise<Set<number>> {
  const { changeRequests } = gameTables(game);
  if (ids.length === 0) return new Set();
  const rows = await db
    .select({ subjectId: changeRequests.subjectId })
    .from(changeRequests)
    .where(and(eq(changeRequests.subjectType, subjectType), inArray(changeRequests.subjectId, ids), eq(changeRequests.status, "pending"), like(changeRequests.reason, `${LIQUIPEDIA_IMPORT_REASON}%`)));
  return new Set(rows.map((r) => r.subjectId));
}

/** Adds the "sourced" marker when something besides the link was taken from the page. */
function withSourcedMarker(items: ImportItem[], current: boolean): ImportItem[] {
  const tookData = items.some((item) => item.field !== "liquipediaLink");
  return tookData && !current ? [...items, { field: "liquipediaSourced", oldValue: false, newValue: true }] : items;
}

async function planTeams(game: GameSlug, tournamentId: number, plan: ImportPlan): Promise<void> {
  const { teams } = gameTables(game);
  const stageTeams = (await getTournamentLiquipediaStages(game, tournamentId)).flatMap((stage) => stage.teams);
  const mapped = new Map(stageTeams.filter((t) => t.liquipediaName).map((t) => [t.teamId, { label: t.displayName, name: t.liquipediaName! }]));
  if (mapped.size === 0) return;

  const ids = [...mapped.keys()];
  const [rows, pending, fetched] = await Promise.all([
    db.select().from(teams).where(inArray(teams.id, ids)),
    pendingImportSubjects(game, "team", ids),
    fetchLiquipediaPages(game, [...mapped.values()].map((m) => m.name)),
  ]);
  const pages = new Map(fetched.map((p) => [p.requested, p]));

  for (const team of rows) {
    const { label, name } = mapped.get(team.id)!;
    if (pending.has(team.id)) {
      plan.alreadyPending += 1;
      continue;
    }
    const page = pages.get(name);
    const infobox = page?.wikitext ? parseTeamInfobox(page.wikitext) : null;
    if (!page?.title || !infobox) {
      plan.noPage.push(label);
      continue;
    }

    const socials = (team.socials ?? {}) as Socials;
    const items: ImportItem[] = [];
    const link = liquipediaPageUrl(game, page.title);
    if (isEmpty(team.liquipediaLink)) items.push({ field: "liquipediaLink", oldValue: team.liquipediaLink, newValue: link });
    if (isEmpty(team.countryCode) && infobox.countryCode) items.push({ field: "countryCode", oldValue: null, newValue: infobox.countryCode });
    if (isEmpty(socials["website"]) && infobox.website) items.push({ field: "socials.website", oldValue: null, newValue: infobox.website });

    // Extra accounts of a network we have none for each get their own request, the admin keeps one.
    const extraAccounts: ImportItem[][] = [];
    for (const key of IMPORT_SOCIAL_KEYS) {
      const accounts = infobox.socials[key] ?? [];
      if (accounts.length === 0 || !isEmpty(socials[key])) continue;
      items.push({ field: `socials.${key}`, oldValue: null, newValue: accounts[0] });
      accounts.slice(1).forEach((url, index) => {
        (extraAccounts[index] ??= []).push({ field: `socials.${key}`, oldValue: null, newValue: url });
      });
    }

    const mainItems = withSourcedMarker(items, team.liquipediaSourced);
    if (mainItems.length === 0) {
      plan.upToDate += 1;
      continue;
    }
    const hasSeveral = extraAccounts.length > 0;
    const reason = buildReason(hasSeveral ? SEVERAL_ACCOUNTS_NOTE : undefined);
    plan.proposals.push({ subjectType: "team", subjectId: team.id, label, reason, items: mainItems });
    for (const extra of extraAccounts) {
      plan.proposals.push({ subjectType: "team", subjectId: team.id, label, reason, items: extra });
    }
  }
}

async function planPeople(game: GameSlug, tournamentId: number, plan: ImportPlan): Promise<void> {
  const { people } = gameTables(game);
  const mapped = new Map(
    (await getTournamentLiquipediaPeople(game, tournamentId)).filter((p) => p.liquipediaName).map((p) => [p.personId, { label: p.handle, name: p.liquipediaName! }])
  );
  if (mapped.size === 0) return;

  const ids = [...mapped.keys()];
  const [rows, pending, fetched] = await Promise.all([
    db.select().from(people).where(inArray(people.id, ids)),
    pendingImportSubjects(game, "person", ids),
    fetchLiquipediaPages(game, [...mapped.values()].map((m) => m.name)),
  ]);
  const pages = new Map(fetched.map((p) => [p.requested, p]));

  for (const person of rows) {
    const { label, name } = mapped.get(person.id)!;
    if (pending.has(person.id)) {
      plan.alreadyPending += 1;
      continue;
    }
    const page = pages.get(name);
    const infobox = page?.wikitext ? parsePlayerInfobox(page.wikitext) : null;
    if (!page?.title || !infobox) {
      plan.noPage.push(label);
      continue;
    }

    const socials = (person.socials ?? {}) as Socials;
    const items: ImportItem[] = [];
    const link = liquipediaPageUrl(game, page.title);
    if (isEmpty(person.liquipediaLink)) items.push({ field: "liquipediaLink", oldValue: person.liquipediaLink, newValue: link });
    if (isEmpty(person.firstName) && infobox.firstName) items.push({ field: "firstName", oldValue: null, newValue: infobox.firstName });
    if (isEmpty(person.lastName) && infobox.lastName) items.push({ field: "lastName", oldValue: null, newValue: infobox.lastName });
    if (isEmpty(person.countryCode) && infobox.countryCode) items.push({ field: "countryCode", oldValue: null, newValue: infobox.countryCode });
    for (const key of IMPORT_SOCIAL_KEYS) {
      const url = infobox.socials[key];
      if (url && isEmpty(socials[key])) items.push({ field: `socials.${key}`, oldValue: null, newValue: url });
    }

    const finalItems = withSourcedMarker(items, person.liquipediaSourced);
    if (finalItems.length === 0) {
      plan.upToDate += 1;
      continue;
    }
    plan.proposals.push({ subjectType: "person", subjectId: person.id, label, reason: buildReason(), items: finalItems });
  }
}

/** Reads every mapped team and person of the tournament on Liquipedia and lists the change requests worth opening. */
export async function planLiquipediaImport(game: GameSlug, tournamentId: number): Promise<ImportPlan> {
  const plan: ImportPlan = { proposals: [], upToDate: 0, alreadyPending: 0, noPage: [] };
  await planTeams(game, tournamentId, plan);
  await planPeople(game, tournamentId, plan);
  return plan;
}
