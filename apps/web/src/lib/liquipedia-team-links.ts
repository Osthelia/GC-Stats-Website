/**
 * GC-Stats - liquipedia-team-links
 *
 * Links the opponent names of a pasted Liquipedia match to our teams. Shared by
 * the Valorant and the League match wikicode imports: both compare the names
 * with the Liquipedia name table, ask for a decision on a conflict and then
 * write the accepted links.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { eq, inArray, or, sql } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { gameTables } from "@gc-stats/db";
import { findLiquipediaMappings } from "@/lib/admin-liquipedia";
import { validateLiquipediaName } from "@/lib/liquipedia-name-validation";
import { parseMatchOpponentNames } from "@/lib/wikicode-import";
import type { GameSlug } from "@gc-stats/db/game";

/**
 * The wikicode's opponent name disagrees with the Liquipedia table: either
 * this team is already linked to another name, or this name to another team.
 */
export type LiquipediaImportConflict = {
  slot: 1 | 2;
  teamId: number;
  teamName: string;
  importName: string;
  currentNameForTeam: string | null;
  currentTeamForName: { teamId: number; teamName: string } | null;
};

/** Per slot: keep the table as is, or relink according to the wikicode. */
export type LiquipediaConflictResolution = "keep" | "import";

export type LiquipediaLinkResolutions = Partial<Record<"1" | "2", LiquipediaConflictResolution>>;

export type LiquipediaLinkPlan = { teamId: number; name: string; conflict: LiquipediaImportConflict | null };

/** Compares the wikicode's opponents with the Liquipedia table, one plan per slot that has both a team and a name. */
export async function planLiquipediaLinks(game: GameSlug, wikicode: string, entrantIds: [number, number]): Promise<LiquipediaLinkPlan[]> {
  const { entrants, teams } = gameTables(game);
  const names = parseMatchOpponentNames(wikicode);
  const entrantRows = await db
    .select({ id: entrants.id, teamId: entrants.teamId, teamName: teams.name })
    .from(entrants)
    .innerJoin(teams, eq(teams.id, entrants.teamId))
    .where(inArray(entrants.id, entrantIds));

  const slots: { slot: 1 | 2; teamId: number; teamName: string; name: string }[] = [];
  for (const slot of [1, 2] as const) {
    const name = names[slot];
    const entrant = entrantRows.find((e) => e.id === entrantIds[slot - 1]);
    if (!name || !entrant?.teamId || validateLiquipediaName(name)) continue;
    // Same name on both sides can't be one to one, leave the table alone.
    if (slots.some((s) => s.name.toLowerCase() === name.toLowerCase() || s.teamId === entrant.teamId)) return [];
    slots.push({ slot, teamId: entrant.teamId, teamName: entrant.teamName, name });
  }
  if (slots.length === 0) return [];

  const mappings = await findLiquipediaMappings(
    game, slots.map((s) => s.teamId),
    slots.map((s) => s.name)
  );
  const plans: LiquipediaLinkPlan[] = [];
  for (const s of slots) {
    const byName = mappings.find((m) => m.name.toLowerCase() === s.name.toLowerCase()) ?? null;
    const byTeam = mappings.find((m) => m.teamId === s.teamId) ?? null;
    if (byName?.teamId === s.teamId) continue;
    const conflict =
      byName || byTeam
        ? {
            slot: s.slot,
            teamId: s.teamId,
            teamName: s.teamName,
            importName: s.name,
            currentNameForTeam: byTeam?.name ?? null,
            currentTeamForName: byName ? { teamId: byName.teamId, teamName: byName.teamName } : null,
          }
        : null;
    plans.push({ teamId: s.teamId, name: s.name, conflict });
  }
  return plans;
}

export type LinkDecision =
  | { ok: true; linksToWrite: LiquipediaLinkPlan[] }
  | { ok: false; error: "invalidResolution" }
  | { ok: false; error: "liquipediaConflict"; conflicts: LiquipediaImportConflict[] };

/** Applies the admin's choices to the plans: every conflict needs one, and only the accepted links are left to write. */
export function decideLiquipediaLinks(plans: LiquipediaLinkPlan[], resolutions: LiquipediaLinkResolutions): LinkDecision {
  const conflicts = plans.map((p) => p.conflict).filter((c): c is LiquipediaImportConflict => c !== null);
  for (const conflict of conflicts) {
    const resolution = resolutions[String(conflict.slot) as "1" | "2"];
    if (resolution === undefined) return { ok: false, error: "liquipediaConflict", conflicts };
    if (resolution !== "keep" && resolution !== "import") return { ok: false, error: "invalidResolution" };
  }
  const linksToWrite = plans.filter((p) => !p.conflict || resolutions[String(p.conflict.slot) as "1" | "2"] === "import");
  return { ok: true, linksToWrite };
}

/** Replaces whatever the teams or the names were linked to by the accepted links. Call it inside the import's transaction. */
export async function writeLiquipediaLinks(tx: Pick<typeof db, "insert" | "delete">, game: GameSlug, links: LiquipediaLinkPlan[]): Promise<void> {
  if (links.length === 0) return;
  const { liquipediaTeamNames } = gameTables(game);
  await tx
    .delete(liquipediaTeamNames)
    .where(
      or(
        inArray(liquipediaTeamNames.teamId, links.map((l) => l.teamId)),
        inArray(sql`lower(${liquipediaTeamNames.name})`, links.map((l) => l.name.toLowerCase()))
      )
    );
  await tx.insert(liquipediaTeamNames).values(links.map((l) => ({ teamId: l.teamId, name: l.name })));
}
