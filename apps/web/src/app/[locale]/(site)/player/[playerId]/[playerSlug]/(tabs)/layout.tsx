/**
 * GC-Stats - layout
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { notFound } from "next/navigation";
import { parseEntityId, slugify } from "@/lib/entity-id";
import { getPlayerPageInfo, getPlayerAchievements, getPlayerTabAvailability } from "@/lib/player-page-data";
import { PlayerHeader } from "@/components/player/player-header";

/** Header shared by every player tab, kept across tab changes instead of being rebuilt by each page. */
export default async function PlayerTabsLayout({ children, params }: { children: React.ReactNode; params: Promise<{ playerId: string }> }) {
  const { playerId } = await params;
  const id = parseEntityId(playerId);
  if (id === null) notFound();

  const [player, achievements, availability] = await Promise.all([getPlayerPageInfo(id), getPlayerAchievements(id), getPlayerTabAvailability(id)]);
  if (!player) notFound();

  return (
    <div>
      <PlayerHeader player={player} segment={`${player.id}/${slugify(player.handle)}`} achievements={achievements} availability={availability} />
      {children}
    </div>
  );
}
