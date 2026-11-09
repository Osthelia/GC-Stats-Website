/**
 * GC-Stats - agent roles
 *
 * Agent display name to role. Riot content does not carry roles, and roles
 * almost never change, so a static table is the most reliable source. An
 * agent missing here is rated with the average weights and global baseline.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import type { AgentRole } from "./types";

const ROLE_BY_AGENT: Record<string, AgentRole> = {
  jett: "duelist",
  raze: "duelist",
  reyna: "duelist",
  phoenix: "duelist",
  yoru: "duelist",
  neon: "duelist",
  iso: "duelist",
  waylay: "duelist",
  sova: "initiator",
  breach: "initiator",
  skye: "initiator",
  kayo: "initiator",
  fade: "initiator",
  gekko: "initiator",
  tejo: "initiator",
  omen: "controller",
  viper: "controller",
  brimstone: "controller",
  astra: "controller",
  harbor: "controller",
  clove: "controller",
  miks: "controller",
  killjoy: "sentinel",
  cypher: "sentinel",
  sage: "sentinel",
  chamber: "sentinel",
  deadlock: "sentinel",
  vyse: "sentinel",
  veto: "sentinel",
};

/** "KAY/O", "Kayo" and "kayo" all give "kayo". */
export function agentKey(agentName: string | null | undefined): string | null {
  const key = (agentName ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return key || null;
}

export function agentRole(agentName: string | null | undefined): AgentRole | null {
  const key = agentKey(agentName);
  return key ? (ROLE_BY_AGENT[key] ?? null) : null;
}
