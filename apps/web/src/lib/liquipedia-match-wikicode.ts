/**
 * GC-Stats - liquipedia-match-wikicode
 *
 * Builds a Liquipedia `{{MatchPage}}` block from a match's data. Pure, no DB
 * access. Team 1 is always entrant A, dates are always UTC.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

export type WikicodeVetoStep = { slot: 1 | 2; mapName: string; type: "ban" | "pick" | "decider" };

export type WikicodeMap = {
  mapName: string;
  apiMatchId: string | null;
  skipped: boolean;
  /** true when team 1 started on defense, null when unknown. */
  team1StartedDefense: boolean | null;
};

export type MatchWikicodeInput = {
  scheduledAt: Date | null;
  online: boolean;
  bestOf: number;
  opponent1: string;
  opponent2: string;
  veto: WikicodeVetoStep[];
  maps: WikicodeMap[];
};

const INDENT = "    ";

/** "September 9, 2026 - 19:20 {{Abbr/UTC}}" */
export function formatLiquipediaDate(date: Date): string {
  const day = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(date);
  const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "UTC" }).format(date);
  return `${day} - ${time} {{Abbr/UTC}}`;
}

function buildMapVeto(veto: WikicodeVetoStep[]): string | null {
  const actions = veto.filter((step) => step.type !== "decider");
  const decider = veto.find((step) => step.type === "decider");
  if (actions.length === 0 && !decider) return null;

  // A Liquipedia veto step holds at most one action per team, both of the same type.
  const steps: { type: string; t1?: string; t2?: string }[] = [];
  for (const action of actions) {
    const key = action.slot === 1 ? "t1" : "t2";
    const current = steps[steps.length - 1];
    if (current && current.type === action.type && !current[key]) current[key] = action.mapName;
    else steps.push({ type: action.type, [key]: action.mapName });
  }
  const types: string[] = steps.map((s) => s.type);
  const cells = steps.map((s, i) => `|t1map${i + 1}=${s.t1 ?? "-"}|t2map${i + 1}=${s.t2 ?? "-"}`);
  if (decider) types.push("decider");

  const firstpick = (actions[0] ?? decider)!.slot;
  const lines = [`{{MapVeto`, `${INDENT}|firstpick=${firstpick}`, `${INDENT}|types=${types.join(",")}`];
  for (const cell of cells) lines.push(`${INDENT}${cell}`);
  if (decider) lines.push(`${INDENT}|decider=${decider.mapName}`);
  lines.push("}}");
  return lines.join(`\n${INDENT}`);
}

export function buildMatchPageWikicode(input: MatchWikicodeInput): string {
  const winsNeeded = Math.ceil(input.bestOf / 2);
  const lines = [`{{MatchPage|type=${input.online ? "Online" : "Offline"}`];
  lines.push(`|date=${input.scheduledAt ? formatLiquipediaDate(input.scheduledAt) : ""}`);
  lines.push(`|opponent1={{TeamOpponent|${input.opponent1}}}`);
  lines.push(`|opponent2={{TeamOpponent|${input.opponent2}}}`);

  const veto = buildMapVeto(input.veto);
  if (veto) lines.push(`|mapveto=${veto}`);

  input.maps.forEach((map, index) => {
    const params = [`map=${map.mapName}`];
    // Maps past the minimum needed to win may never be played.
    if (map.skipped || index + 1 > winsNeeded) params.push(`finished=${map.skipped ? "skip" : ""}`);
    params.push(`matchid=${map.apiMatchId ?? ""}`);
    params.push(`reversed=${map.team1StartedDefense ? "y" : ""}`);
    lines.push(`|map${index + 1}={{ApiMap|${params.join("|")}}}`);
  });

  return [lines[0], ...lines.slice(1).map((line) => `${INDENT}${line}`), "}}"].join("\n");
}
