/**
 * GC-Stats - liquipedia-participants-wikicode
 *
 * Builds a Liquipedia `{{TeamParticipants}}` block. Pure, no DB access.
 * Empty values are left out.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

export type ParticipantPerson = {
  handle: string;
  /** Liquipedia page name, null when none is saved. */
  liquipediaName: string | null;
  /** Flag code, only written for people without a Liquipedia page (the page carries it otherwise). */
  flag: string | null;
  hasPage: boolean;
  kind: "player" | "staff";
  /** Exact roster role: player, sub, stand_in, coach, manager, ... */
  role: string;
};

export type ParticipantQualification = { method: "invite" } | { method: "qual"; page: string | null; text: string | null };

export type ParticipantTeam = {
  name: string;
  people: ParticipantPerson[];
  qualification: ParticipantQualification | null;
};

const SUB_ROLES = new Set(["sub", "stand_in"]);

function personTemplate(person: ParticipantPerson): string {
  const params = [person.handle];
  if (person.liquipediaName && person.liquipediaName.toLowerCase() !== person.handle.toLowerCase()) params.push(`link=${person.liquipediaName}`);
  if (!person.hasPage && person.flag) params.push(`flag=${person.flag}`);
  if (person.kind === "player" && SUB_ROLES.has(person.role)) params.push("status=sub");
  if (person.kind === "staff") params.push(`role=${person.role.replaceAll("_", " ")}`);
  return `{{Person|${params.join("|")}}}`;
}

function qualificationTemplate(qualification: ParticipantQualification): string {
  if (qualification.method === "invite") return "{{Qualification|method=invite}}";
  const params = ["method=qual"];
  if (qualification.page) params.push(`page=${qualification.page}`);
  if (qualification.text) params.push(`text=${qualification.text}`);
  return `{{Qualification|${params.join("|")}}}`;
}

function opponentBlock(team: ParticipantTeam): string {
  const players = team.people.filter((p) => p.kind === "player").sort((a, b) => Number(SUB_ROLES.has(a.role)) - Number(SUB_ROLES.has(b.role)));
  const staff = team.people.filter((p) => p.kind === "staff");
  const lines = [`|{{Opponent|${team.name}`];

  if (players.length + staff.length > 0) {
    lines.push("  |players={{Persons");
    for (const person of players) lines.push(`    |${personTemplate(person)}`);
    if (players.length > 0 && staff.length > 0) lines.push("");
    for (const person of staff) lines.push(`    |${personTemplate(person)}`);
    lines.push("  }}");
  }
  if (team.qualification) lines.push(`  |qualification=${qualificationTemplate(team.qualification)}`);
  lines.push("}}");
  return lines.join("\n");
}

export function buildTeamParticipantsWikicode(teams: ParticipantTeam[]): string {
  return ["{{TeamParticipants", ...teams.map(opponentBlock), "}}"].join("\n");
}
