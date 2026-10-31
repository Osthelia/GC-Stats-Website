/**
 * GC-Stats - liquipedia-broadcast-export
 *
 * Builds the Liquipedia Talent section (`{{BroadcasterCard}}` blocks) from
 * the production credits of a tournament. Pure, no DB access.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

export type TalentCredit = {
  handle: string;
  /** Liquipedia page name, null when none is saved. */
  liquipediaName: string | null;
  role: string;
  /** Position written on the credit, replaces the role label. */
  title: string | null;
};

const ROLE_LABELS: Record<string, string> = {
  host: "Host",
  caster: "Commentator",
  analyst: "Analyst",
  observer: "Observer",
  producer: "Producer",
  translator: "Translator",
  interviewer: "Interviewer",
  guest: "Guest",
};
const ROLE_ORDER = Object.keys(ROLE_LABELS);

/** Language prefixes a position can carry ("French Commentator"), written as the `lang` param. */
const POSITION_LANGUAGES = ["French", "Czech", "Portuguese", "Brazilian", "Spanish", "LATAM", "Chinese", "Thai", "Taiwanese", "Filipino", "Indonesian", "Vietnamese", "Japanese", "Korean", "German", "Russian", "Turkish", "Polish", "Arabic", "Italian"];
const LANG_PARAM: Record<string, string> = { Brazilian: "Portuguese", LATAM: "Spanish" };

function languageOf(position: string): string | null {
  const first = position.split(" ")[0] ?? "";
  const match = POSITION_LANGUAGES.find((l) => l.toLowerCase() === first.toLowerCase());
  return match ? (LANG_PARAM[match] ?? match) : null;
}

function labelOf(credit: TalentCredit): string {
  return credit.title ?? ROLE_LABELS[credit.role] ?? credit.role.replaceAll("_", " ").replace(/^\w/, (c) => c.toUpperCase());
}

/** Someone credited as both commentator and analyst under the plain positions gets the combined one. */
function mergeCasterAnalyst(credits: TalentCredit[]): TalentCredit[] {
  const plain = (role: string) => new Set(credits.filter((c) => c.role === role && !c.title).map((c) => c.handle.toLowerCase()));
  const both = new Set([...plain("caster")].filter((h) => plain("analyst").has(h)));
  const seen = new Set<string>();
  const result: TalentCredit[] = [];
  for (const credit of credits) {
    const key = credit.handle.toLowerCase();
    if (!credit.title && both.has(key) && (credit.role === "caster" || credit.role === "analyst")) {
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({ ...credit, role: "caster", title: "Commentator & Analyst" });
    } else {
      result.push(credit);
    }
  }
  return result;
}

function cardTemplate(position: string, credits: TalentCredit[]): string {
  const lang = languageOf(position);
  const lines = [`{{BroadcasterCard`, `|position=${position}${lang ? `|lang=${lang}` : ""}`];
  credits.forEach((credit, index) => {
    const slot = index + 1;
    const link = credit.liquipediaName && credit.liquipediaName.toLowerCase() !== credit.handle.toLowerCase() ? `|b${slot}link=${credit.liquipediaName}` : "";
    lines.push(`|b${slot}=${credit.handle}${link}`);
  });
  lines.push("}}");
  return lines.join("\n");
}

export function buildTalentWikicode(allCredits: TalentCredit[]): string {
  const groups = new Map<string, TalentCredit[]>();
  for (const credit of mergeCasterAnalyst(allCredits)) {
    const label = labelOf(credit);
    const group = groups.get(label) ?? [];
    if (!group.some((c) => c.handle.toLowerCase() === credit.handle.toLowerCase())) group.push(credit);
    groups.set(label, group);
  }

  const rank = (label: string, group: TalentCredit[]) => {
    const index = ROLE_ORDER.indexOf(group[0]!.role);
    return label === "Commentator & Analyst" ? ROLE_ORDER.indexOf("caster") : index === -1 ? ROLE_ORDER.length : index;
  };
  const cards = [...groups.entries()]
    .sort(([la, a], [lb, b]) => rank(la, a) - rank(lb, b) || la.localeCompare(lb))
    .map(([label, group]) => cardTemplate(label, group.sort((a, b) => a.handle.localeCompare(b.handle))));

  return ["===Talent===", "{{box|start|padding=1em}}", cards.join("\n{{box|break|padding=1em}}\n"), "{{box|end}}"].join("\n");
}
