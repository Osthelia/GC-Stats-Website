/**
 * GC-Stats - liquipedia-broadcast-wikicode
 *
 * Reads the `{{BroadcasterCard}}` blocks of a Liquipedia Talent section into
 * the people and the production roles they hold. Pure, no DB access.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { extractAllTemplates, parseTemplateParams } from "@/lib/wikicode-import";

export type BroadcastCredit = {
  /** Stored role (`caster`, `host`, ...). */
  role: string;
  /** Position as written on the card when it says more than the role (language, "Stats Producer"). */
  title: string | null;
};

export type BroadcastTalent = {
  /** Liquipedia page name (`blink` param when set, else the card handle). */
  name: string;
  /** Handle as displayed on the card. */
  handle: string;
  credits: BroadcastCredit[];
};

const MAX_CARD_SLOTS = 30;

function stripComments(wikicode: string): string {
  let result = wikicode;
  let previous: string;
  do {
    previous = result;
    result = result.replace(/<!--[\s\S]*?-->/g, "");
  } while (result !== previous);
  return result;
}

/** Roles a card position stands for, in the order they are credited. */
export function rolesOfPosition(position: string): string[] {
  const lower = position.toLowerCase();
  const roles: string[] = [];
  if (/commentat|caster/.test(lower)) roles.push("caster");
  if (/analyst/.test(lower)) roles.push("analyst");
  if (/\bhost/.test(lower)) roles.push("host");
  if (/observer/.test(lower)) roles.push("observer");
  if (/producer/.test(lower)) roles.push("producer");
  if (/translator/.test(lower)) roles.push("translator");
  if (/interviewer/.test(lower)) roles.push("interviewer");
  if (/guest/.test(lower)) roles.push("guest");
  return roles;
}

/** A title is kept only when the position carries more than the plain role name(s). */
function titleOfPosition(position: string, lang: string | null, roles: string[]): string | null {
  const plain = ["Host", "Commentator", "Commentator & Analyst", "Analyst", "Observer", "Producer", "Translator", "Interviewer", "Guest"];
  if (!lang && plain.some((p) => p.toLowerCase() === position.toLowerCase())) return null;
  return roles.length > 0 ? position : null;
}

/** Every talent of the wikicode with their credits, deduped by Liquipedia name. Cards without a known position are ignored. */
export function parseBroadcasterCards(wikicode: string): BroadcastTalent[] {
  const byName = new Map<string, BroadcastTalent>();

  for (const card of extractAllTemplates(stripComments(wikicode), "BroadcasterCard")) {
    const params = parseTemplateParams(card);
    const position = params["position"]?.trim() ?? "";
    const roles = rolesOfPosition(position);
    if (roles.length === 0) continue;
    const title = titleOfPosition(position, params["lang"]?.trim() || null, roles);

    for (let slot = 1; slot <= MAX_CARD_SLOTS; slot++) {
      const handle = params[`b${slot}`]?.trim();
      if (!handle) continue;
      const name = params[`b${slot}link`]?.trim() || handle;
      const key = name.toLowerCase();
      const talent = byName.get(key) ?? { name, handle, credits: [] };
      for (const role of roles) {
        if (!talent.credits.some((c) => c.role === role && c.title === title)) talent.credits.push({ role, title });
      }
      byName.set(key, talent);
    }
  }
  return [...byName.values()];
}
