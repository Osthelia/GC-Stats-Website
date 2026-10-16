import { and, eq, inArray, ne } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { gameTables } from "@gc-stats/db";
import type { GameSlug } from "@gc-stats/db/game";
import { closeRange } from "@/lib/daterange";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Closes the chosen memberships at `closeAt`, only if they are still open memberships of that person on other teams. */
export async function closeOpenMemberships(game: GameSlug, tx: Tx, ids: number[], personId: number, teamId: number, closeAt: string): Promise<void> {
  if (ids.length === 0) return;
  const { rosterMemberships } = gameTables(game);
  const rows = await tx
    .select({ id: rosterMemberships.id, period: rosterMemberships.period })
    .from(rosterMemberships)
    .where(and(inArray(rosterMemberships.id, ids), eq(rosterMemberships.personId, personId), ne(rosterMemberships.teamId, teamId), eq(rosterMemberships.hasLeft, false)));
  for (const row of rows) {
    await tx.update(rosterMemberships).set({ period: closeRange(row.period, closeAt), hasLeft: true }).where(eq(rosterMemberships.id, row.id));
  }
}
