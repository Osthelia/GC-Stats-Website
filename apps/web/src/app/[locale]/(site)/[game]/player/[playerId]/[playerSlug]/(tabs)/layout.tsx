/**
 * GC-Stats - layout
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { notFound } from "next/navigation";
import { playerNotInGame, getPersonGames } from "@/lib/person-games-data";
import { parseEntityId, slugify } from "@/lib/entity-id";
import { getPlayerPageInfo, getPlayerAchievements, getPlayerTabAvailability, getPlayerTeamHistory } from "@/lib/player-page-data";
import { sortLanes } from "@gc-stats/lol-stats-engine";
import { gameHasLanes } from "@gc-stats/db/game";
import { LiquipediaSourceFooter } from "@/components/liquipedia-source-footer";
import { PlayerHeader } from "@/components/player/player-header";
import { AddGameProfileBanner } from "@/components/player/add-game-profile-banner";
import { PlayerOtherGames } from "@/components/player/player-other-games";
import { gameFromParams } from "@/lib/game";

/** Header shared by every player tab, kept across tab changes instead of being rebuilt by each page. */
export default async function PlayerTabsLayout({ children, params }: { children: React.ReactNode; params: Promise<{ playerId: string; game: string }> }) {
  const game = await gameFromParams(params);
  const { playerId } = await params;
  const id = parseEntityId(playerId);
  if (id === null) notFound();

  const [player, achievements, availability, personGames] = await Promise.all([getPlayerPageInfo(game, id), getPlayerAchievements(game, id), getPlayerTabAvailability(game, id), getPersonGames(id)]);
  if (!player) return playerNotInGame(game, id);

  // League: the lanes of the current roster entries, deduplicated with the overview's own read of the team history.
  const currentLanes = gameHasLanes(game) ? sortLanes((await getPlayerTeamHistory(game, id)).current.flatMap((entry) => entry.lanes)) : [];

  return (
    <div>
      <PlayerHeader game={game} player={player} segment={`${player.id}/${slugify(player.handle)}`} achievements={achievements} availability={availability} lanes={currentLanes} />
      <PlayerOtherGames games={(personGames?.games ?? []).filter((g) => g !== game)} segment={`${player.id}/${slugify(player.handle)}`} />
      <AddGameProfileBanner personId={player.id} segment={`${player.id}/${slugify(player.handle)}`} />
      {children}
      <LiquipediaSourceFooter sourced={player.liquipediaSourced} href={player.liquipediaLink} />
    </div>
  );
}
