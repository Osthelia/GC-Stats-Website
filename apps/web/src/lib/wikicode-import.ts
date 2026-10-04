/**
 * GC-Stats - wikicode-import
 *
 * Liquipedia wikicode import, port of V1's MatchController::importWikicode
 * (Website/app/Http/Controllers/Admin/MatchController.php:321-573). Pure
 * parsing only, no DB access, so it stays testable/callable from an action
 * without dragging Drizzle into this module.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

/** Extracts a top-level `{{Name|...}}` template by brace-depth scanning (handles nested `{{...}}` inside param values). */
export function extractTemplate(wikicode: string, name: string): string | null {
  const marker = `{{${name.toLowerCase()}`;
  const lower = wikicode.toLowerCase();
  const start = lower.indexOf(marker);
  if (start === -1) return null;

  let depth = 0;
  let i = start;
  for (; i < wikicode.length - 1; i++) {
    if (wikicode[i] === "{" && wikicode[i + 1] === "{") {
      depth++;
      i++;
      continue;
    }
    if (wikicode[i] === "}" && wikicode[i + 1] === "}") {
      depth--;
      i++;
      if (depth === 0) {
        i++;
        break;
      }
      continue;
    }
  }
  return wikicode.slice(start, i);
}

/** Splits `s` on `sep`, ignoring occurrences nested inside `{{...}}`. */
function splitTopLevel(s: string, sep: string): string[] {
  const result: string[] = [];
  let depth = 0;
  let current = "";
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "{" && s[i + 1] === "{") {
      depth++;
      current += s[i];
      continue;
    }
    if (s[i] === "}" && s[i + 1] === "}") {
      depth--;
      current += s[i];
      continue;
    }
    if (s[i] === sep && depth === 0) {
      result.push(current);
      current = "";
      continue;
    }
    current += s[i];
  }
  if (current.length > 0) result.push(current);
  return result;
}

/** Parses a `{{Name|key=value|...}}` template's params into a lowercase-keyed map. */
export function parseTemplateParams(template: string): Record<string, string> {
  const withoutBraces = template.replace(/^\{\{/, "").replace(/\}\}$/, "");
  const parts = splitTopLevel(withoutBraces, "|");
  const params: Record<string, string> = {};
  // parts[0] is the template name itself, skip it.
  for (const part of parts.slice(1)) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim().toLowerCase();
    const value = part.slice(eq + 1).trim();
    params[key] = value;
  }
  return params;
}

export type WikicodeVetoRow = { teamSlot: "1" | "2"; mapName: string; type: "ban" | "pick" | "decider" };

export type ParseVetoResult = { ok: true; rows: WikicodeVetoRow[] } | { ok: false; error: "empty" | "unknownMap" };

/**
 * Parses `{{MapVeto|types=ban,ban,pick,...|t1map1=...|t2map1=...|...|decider=...}}`.
 * `types[N]` is the action at step N+1, done by both teams (`t1map{N+1}` and
 * `t2map{N+1}`, `-`/empty when skipped), in `firstpick` order. The decider is
 * credited to whichever team did NOT act last.
 */
export function parseMapVeto(wikicode: string, mapPool: readonly string[]): ParseVetoResult {
  const template = extractTemplate(wikicode, "MapVeto");
  if (!template) return { ok: false, error: "empty" };
  const params = parseTemplateParams(template);

  const types = (params["types"] ?? "")
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 0);

  const rows: WikicodeVetoRow[] = [];
  let lastTeam: "1" | "2" | null = null;
  const slotOrder: ("1" | "2")[] = params["firstpick"] === "2" ? ["2", "1"] : ["1", "2"];

  types.forEach((rawType, index) => {
    const type = rawType === "ban" || rawType === "pick" ? rawType : null;
    if (!type) return;
    const step = index + 1;
    for (const teamSlot of slotOrder) {
      const mapName = params[`t${teamSlot}map${step}`];
      if (!mapName || mapName === "-") continue;
      rows.push({ teamSlot, mapName, type });
      lastTeam = teamSlot;
    }
  });

  const deciderMap = params["decider"];
  if (deciderMap && deciderMap !== "-") {
    const deciderTeam: "1" | "2" = lastTeam === "1" ? "2" : "1";
    rows.push({ teamSlot: deciderTeam, mapName: deciderMap, type: "decider" });
  }

  if (rows.length === 0) return { ok: false, error: "empty" };
  if (rows.some((r) => !mapPool.includes(r.mapName))) return { ok: false, error: "unknownMap" };

  return { ok: true, rows };
}

export type WikicodeMapInfo = { finishedSkip: boolean; apiMatchId: string | null };

/** The `{{...}}` value of a `|mapN={{ApiMap|...}}` param, or a legacy `{{mapN|...}}` template. */
function findMapTemplate(wikicode: string, n: number): string | null {
  const param = new RegExp(`\\|\\s*map${n}\\s*=\\s*(?=\\{\\{)`, "i").exec(wikicode);
  if (param) return templateAt(wikicode, param.index + param[0].length);
  const legacy = new RegExp(`\\{\\{\\s*map${n}\\s*(?=[|}])`, "i").exec(wikicode);
  return legacy ? templateAt(wikicode, legacy.index) : null;
}

/** Parses each map's `finished=skip|matchid=...` params (`|mapN={{ApiMap|...}}`), N = 1..9. */
export function parseMapTemplates(wikicode: string): Map<number, WikicodeMapInfo> {
  const result = new Map<number, WikicodeMapInfo>();
  for (let n = 1; n <= 9; n++) {
    const template = findMapTemplate(wikicode, n);
    if (!template) continue;
    const params = parseTemplateParams(template);
    result.set(n, {
      finishedSkip: (params["finished"] ?? "").trim().toLowerCase() === "skip",
      apiMatchId: params["matchid"]?.trim() || null,
    });
  }
  return result;
}

/** Returns the full `{{...}}` template starting at `start` (which must point at its opening braces). */
function templateAt(wikicode: string, start: number): string {
  let depth = 0;
  for (let i = start; i < wikicode.length - 1; i++) {
    if (wikicode[i] === "{" && wikicode[i + 1] === "{") {
      depth++;
      i++;
    } else if (wikicode[i] === "}" && wikicode[i + 1] === "}") {
      depth--;
      i++;
      if (depth === 0) return wikicode.slice(start, i + 1);
    }
  }
  return wikicode.slice(start);
}

/** Every `{{Name|...}}` occurrence (exact name, case-insensitive), nested ones included. */
export function extractAllTemplates(wikicode: string, name: string): string[] {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`\\{\\{\\s*${escaped}\\s*(?=[|}])`, "gi");
  return [...wikicode.matchAll(re)].map((m) => templateAt(wikicode, m.index));
}

/** Unnamed params of a template, in order (`{{Opponent|Name|x=y}}` gives `["Name"]`). */
export function parseTemplatePositional(template: string): string[] {
  const withoutBraces = template.replace(/^\{\{/, "").replace(/\}\}$/, "");
  return splitTopLevel(withoutBraces, "|")
    .slice(1)
    .filter((part) => !topLevelHasEquals(part))
    .map((part) => part.trim());
}

function topLevelHasEquals(part: string): boolean {
  let depth = 0;
  for (let i = 0; i < part.length; i++) {
    if (part[i] === "{" && part[i + 1] === "{") depth++;
    else if (part[i] === "}" && part[i + 1] === "}") depth--;
    else if (part[i] === "=" && depth === 0) return true;
  }
  return false;
}

/** Team page name of a `{{TeamOpponent|Name}}`/`{{Opponent|Name}}` template, `template=` taking precedence. */
export function opponentTemplateName(template: string): string | null {
  const named = parseTemplateParams(template)["template"]?.trim();
  const name = named || parseTemplatePositional(template)[0] || "";
  return name.length > 0 && name.toLowerCase() !== "tbd" ? name : null;
}

/** Opponent names of a match block (`|opponent1={{TeamOpponent|...}}`), null when absent or TBD. */
export function parseMatchOpponentNames(wikicode: string): { 1: string | null; 2: string | null } {
  const read = (n: 1 | 2): string | null => {
    const match = new RegExp(`\\|\\s*opponent${n}\\s*=\\s*(?=\\{\\{)`, "i").exec(wikicode);
    if (!match) return null;
    return opponentTemplateName(templateAt(wikicode, match.index + match[0].length));
  };
  return { 1: read(1), 2: read(2) };
}
