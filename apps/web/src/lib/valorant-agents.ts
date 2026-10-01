/**
 * GC-Stats - valorant-agents
 *
 * Canonical agent roster (V1 config/valorant.php `agents`) — every playable
 * agent, not just ones already played in stored data. Also provides agent
 * icon slugs and win type icon URLs.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */
export const VALORANT_AGENTS = [
  "Astra", "Breach", "Brimstone", "Chamber", "Clove", "Cypher", "Deadlock", "Fade",
  "Gekko", "Harbor", "Iso", "Jett", "KAY/O", "Killjoy", "Neon",
  "Omen", "Phoenix", "Raze", "Reyna", "Sage", "Skye", "Sova", "Tejo",
  "Viper", "Vyse", "Waylay", "Yoru",
] as const;

/** Mirrors V1 App\Helpers\AgentRoles::slug() — agent display name to icon filename slug. */
export function agentSlug(agentName: string): string {
  return agentName.toLowerCase().replace(/\//g, "");
}

export function agentIconUrl(agentName: string): string {
  return `/valorant/agents/${agentSlug(agentName)}.webp`;
}

/** Mirrors V1's storage/icons/wins/{win_type}.webp naming (spaces to underscores, lowercased). */
export function winTypeIconUrl(winType: string | null): string {
  const key = winType ? winType.replace(/ /g, "_").toLowerCase() : "round_timer_expired";
  return `/valorant/wins/${key}.webp`;
}
