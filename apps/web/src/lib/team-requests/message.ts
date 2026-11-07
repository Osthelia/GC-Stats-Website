/**
 * GC-Stats - team-requests message
 *
 * Builds the message copied to the team from the items flagged red. It is
 * sent outside the site, so it is always written in English whatever the
 * locale of the admin.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { TEAM_REQUEST_SOCIAL_KEYS, type TeamRequestItem } from "@/lib/team-requests/constants";

export type MessageRosterLine = { handle: string; role: string };

export type MessageInput = {
  teamName: string;
  items: ReadonlySet<TeamRequestItem>;
  /** Current roster only, the history is never asked. */
  roster: MessageRosterLine[];
  unlistedPlayers: { handle: string; matches: number }[];
  /** The staff member sending the message. */
  signature: { name: string; role: string | null };
};

const SOCIAL_LABELS: Record<(typeof TEAM_REQUEST_SOCIAL_KEYS)[number], string> = {
  twitter: "Twitter",
  twitch: "Twitch",
  instagram: "Instagram",
  youtube: "YouTube",
  tiktok: "TikTok",
  discord: "Discord",
  website: "Website",
};

const PLAYER_ROLES = ["player", "player-igl"];
const SUB_ROLES = ["sub"];

export type RosterGroups = { players: string[]; subs: string[]; staff: string[] };

/** Display names split by role group: players, subs, staff (role in parentheses). */
export function groupRoster(roster: MessageRosterLine[]): RosterGroups {
  return {
    players: roster.filter((m) => PLAYER_ROLES.includes(m.role)).map((m) => (m.role === "player-igl" ? `${m.handle} (IGL)` : m.handle)),
    subs: roster.filter((m) => SUB_ROLES.includes(m.role)).map((m) => m.handle),
    staff: roster.filter((m) => ![...PLAYER_ROLES, ...SUB_ROLES].includes(m.role)).map((m) => `${m.handle} (${m.role})`),
  };
}

/** One line per role group, empty groups are skipped. */
export function rosterLines(roster: MessageRosterLine[]): string[] {
  const { players, subs, staff } = groupRoster(roster);
  const lines: string[] = [];
  if (players.length > 0) lines.push(`Players: ${players.join(", ")}`);
  if (subs.length > 0) lines.push(`Subs: ${subs.join(", ")}`);
  if (staff.length > 0) lines.push(`Staff: ${staff.join(", ")}`);
  return lines;
}

export function buildTeamRequestMessage(input: MessageInput): string {
  const blocks: string[] = [
    `Hello ${input.teamName},`,
    "I hope you are doing well. I am reaching out on behalf of GC Stats, a statistics platform dedicated to the Game Changers scene. We do our best to keep the information shown about every team accurate and up to date, and we would be grateful for your help with yours.",
  ];

  const asks: string[] = [];
  if (input.items.has("logo")) asks.push("We do not have your logo yet. If you have a preferred version, we would be happy to receive it.");
  const missingSocials = TEAM_REQUEST_SOCIAL_KEYS.filter((key) => input.items.has(key)).map((key) => SOCIAL_LABELS[key]);
  if (missingSocials.length > 0) {
    asks.push(`Are you on any of these social networks: ${missingSocials.join(", ")}? If so, we would love to add them to your team page.`);
  }
  if (asks.length > 0) blocks.push(asks.join("\n"));

  if (input.items.has("roster")) {
    const lines = rosterLines(input.roster);
    const roster = [
      lines.length > 0
        ? `Here is the roster we currently have for your team:\n${lines.join("\n")}\n\nDoes it match your current lineup? If anything needs updating, we would be happy to adjust it.`
        : "We do not have a roster listed for your team yet. Would you be able to tell us who is currently part of it?",
    ];
    if (input.unlistedPlayers.length > 0) {
      const list = input.unlistedPlayers.map((p) => `• ${p.handle} (${p.matches} ${p.matches === 1 ? "match" : "matches"})`).join("\n");
      roster.push(`We also noticed that these players took part in your recent matches without being on that roster, so we may have missed a recent change:\n${list}\nIf you have a moment, any detail you could share would be very helpful.`);
    }
    blocks.push(roster.join("\n\n"));
  }

  const { name, role } = input.signature;
  blocks.push("Thank you very much for your time, and best of luck for your upcoming matches!");
  blocks.push(["Kind regards,", name, role ? `${role}, GC Stats` : "GC Stats"].filter(Boolean).join("\n"));
  return blocks.join("\n\n");
}
