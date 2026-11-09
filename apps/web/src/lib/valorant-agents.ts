/**
 * GC-Stats - valorant-agents
 *
 * Canonical agent roster (V1 config/valorant.php `agents`) — every playable
 * agent, not just ones already played in stored data. Also provides agent
 * icon slugs and win type icon URLs.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */
export const VALORANT_AGENTS = [
  "Astra", "Breach", "Brimstone", "Chamber", "Clove", "Cypher", "Deadlock", "Fade",
  "Gekko", "Harbor", "Iso", "Jett", "KAY/O", "Killjoy", "Neon",
  "Omen", "Phoenix", "Raze", "Reyna", "Sage", "Skye", "Sova", "Tejo",
  "Viper", "Vyse", "Waylay", "Yoru",
] as const;

export const AGENT_ROLES = ["duelist", "initiator", "controller", "sentinel"] as const;
export type AgentRole = (typeof AGENT_ROLES)[number];

const ROLE_AGENTS: Record<AgentRole, string[]> = {
  duelist: ["Jett", "Phoenix", "Raze", "Reyna", "Yoru", "Neon", "Iso", "Waylay"],
  initiator: ["Breach", "Skye", "Sova", "Fade", "Gekko", "KAY/O", "Tejo"],
  controller: ["Astra", "Brimstone", "Clove", "Harbor", "Omen", "Viper"],
  sentinel: ["Chamber", "Cypher", "Deadlock", "Killjoy", "Sage", "Vyse"],
};

export const AGENT_ROLE_BY_AGENT: Record<string, AgentRole> = Object.fromEntries(
  AGENT_ROLES.flatMap((role) => ROLE_AGENTS[role].map((agent) => [agent, role] as const)),
);

/** Mirrors V1 App\Helpers\AgentRoles::slug() — agent display name to icon filename slug. */
export function agentSlug(agentName: string): string {
  return agentName.toLowerCase().replace(/\//g, "");
}

export function agentIconUrl(agentName: string): string {
  return `/valorant/agents/${agentSlug(agentName)}.webp`;
}

// Rounds fetched before the V1 naming fix stored Riot's `roundResultCode` instead of its label.
const LEGACY_WIN_TYPE_KEYS: Record<string, string> = { elimination: "eliminated", defuse: "bomb_defused", detonate: "bomb_detonated", time: "round_timer_expired" };

/** Mirrors V1's storage/icons/wins/{win_type}.webp naming (spaces to underscores, lowercased). */
export function winTypeIconUrl(winType: string | null): string {
  const raw = winType ? winType.replace(/ /g, "_").toLowerCase() : "round_timer_expired";
  const key = LEGACY_WIN_TYPE_KEYS[raw] ?? raw;
  return `/valorant/wins/${key}.webp`;
}
