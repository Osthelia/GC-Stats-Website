/**
 * GC-Stats - roster-activity-log
 *
 * Activity log entry for a team roster edit, shared by the team side and the
 * player side (same roster_memberships row).
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { logActivity, type ActivityChanges, type ActivityLogClient } from "@/lib/activity-log";

type RosterChangeInput = {
  teamId: number;
  personId: number;
  role: string;
  actorUserId: string;
  action: "Added" | "Updated" | "Removed";
  changes?: ActivityChanges;
};

/** Logged on the team and on the player, so both histories show the edit. */
export async function logRosterChange(client: ActivityLogClient, input: RosterChangeInput): Promise<void> {
  const { teamId, personId, role, actorUserId, action, changes } = input;
  const description = `${action} roster entry (${role}) of player #${personId} on team #${teamId}`;
  const properties = { section: "roster", teamId, personId, role };
  await logActivity({ subject: "team", subjectId: teamId, event: "updated", description, actorUserId, changes, properties }, client);
  await logActivity({ subject: "player", subjectId: personId, event: "updated", description, actorUserId, changes, properties }, client);
}
