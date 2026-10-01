/**
 * GC-Stats - entities
 *
 * V2 entity shapes — extend the V1 ones (snake_case contract) rather than
 * duplicating them, since the underlying columns don't change between versions.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */
import { toApiTeam, toApiPlayer, type ApiTeam, type ApiPlayer } from "../v1/entities";
import { toApiTournament, type ApiTournament, type ApiTournamentPhase } from "../v1/queries/tournaments";

export type ApiTeamV2 = ApiTeam & { liquipedia_link: string | null };

type TeamRow = Parameters<typeof toApiTeam>[0] & { liquipediaLink: string | null };

export function toApiTeamV2(row: TeamRow): ApiTeamV2 {
  return { ...toApiTeam(row), liquipedia_link: row.liquipediaLink };
}

// is_claimed: linked to a site account, the account itself is never exposed.
export type ApiPlayerV2 = ApiPlayer & { liquipedia_link: string | null; is_claimed: boolean };

type PlayerRow = Parameters<typeof toApiPlayer>[0] & { liquipediaLink: string | null; userId: string | null };

export function toApiPlayerV2(row: PlayerRow): ApiPlayerV2 {
  return { ...toApiPlayer(row), liquipedia_link: row.liquipediaLink, is_claimed: row.userId !== null };
}

export type ApiTournamentV2 = ApiTournament & { liquipedia_link: string | null };

type TournamentRow = Parameters<typeof toApiTournament>[0] & { liquipediaLink: string | null };

export function toApiTournamentV2(row: TournamentRow): ApiTournamentV2 {
  return { ...toApiTournament(row), liquipedia_link: row.liquipediaLink };
}

export type ApiTournamentPhaseV2 = ApiTournamentPhase & { liquipedia_link: string | null };
