/**
 * GC-Stats — index
 *
 * Runs every structural migration phase in dependency order. Safe to
 * re-run: each phase skips rows already recorded in migration_id_map.
 * Does NOT run 00-reset-demo-data.ts (destructive, run manually once) and
 * does NOT touch game stats (out of scope for this pass, see README.md).
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { closeConnections } from "./connection";
import { migrateOrganizations, migratePointTypes, migrateNewsPublishers } from "./01-organizations";
import { migrateTeams, migratePeople } from "./02-people-teams";
import { migrateRoster } from "./03-roster";
import { migrateTournaments, migrateStages } from "./04-tournaments";
import { migrateEntrants, migrateMatches } from "./05-entrants-matches";
import { migrateMatchVetos, pruneVetosWithoutBans, migrateStreamsAndVods } from "./06-vetos-streams";
import { migrateNewsAuthors, migrateNews, migrateNewsRelations } from "./07-news";
import { migrateFinance, migrateQualifications, migratePointEntries } from "./08-finance-qualifications";
import {
  migrateMaps, migrateMapRounds, migrateMapRoundKills,
  migrateMapRoundDamages, migrateMapRoundAliveStates, migrateMapRoundPlayerPositions,
  migrateMapRoundPlayerLoadouts,
} from "./09-game-maps-rounds";
import { migrateMapPlayerStats, migrateMapTeamRoundSummary } from "./10-game-stats-aggregated";
import {
  migrateAboutContent, migrateEmotes, migrateForum, migrateChangeRequests,
  migrateUserReports, migrateSanctions, migrateModerationSuspects, migrateActivityLog,
} from "./11-community-content";
import { migrateLogos } from "./12-logos";
import { generateBracketEdges } from "./13-bracket-edges";
import { backfillGroupEntries } from "./14-group-entries";

const phases: [string, () => Promise<void>][] = [
  ["organizations", migrateOrganizations],
  ["news_publishers_as_organizations", migrateNewsPublishers],
  ["point_types", migratePointTypes],
  ["teams", migrateTeams],
  ["people", migratePeople],
  ["roster_memberships", migrateRoster],
  ["tournaments", migrateTournaments],
  ["stages+containers", migrateStages],
  ["entrants", migrateEntrants],
  ["matches", migrateMatches],
  ["bracket_edges", generateBracketEdges],
  ["group_entries", backfillGroupEntries],
  ["match_vetos", migrateMatchVetos],
  ["match_vetos_prune_no_ban", pruneVetosWithoutBans],
  ["streams+vods", migrateStreamsAndVods],
  ["news_authors", migrateNewsAuthors],
  ["news", migrateNews],
  ["news_relations", migrateNewsRelations],
  ["finance_entries", migrateFinance],
  ["qualifications", migrateQualifications],
  ["point_entries", migratePointEntries],
  ["maps", migrateMaps],
  ["map_rounds_raw", migrateMapRounds],
  ["map_round_kills_raw", migrateMapRoundKills],
  ["map_round_damages_raw", migrateMapRoundDamages],
  ["map_round_alive_states_raw", migrateMapRoundAliveStates],
  ["map_round_player_positions_raw", migrateMapRoundPlayerPositions],
  ["map_round_player_loadouts_raw", migrateMapRoundPlayerLoadouts],
  ["map_player_stats", migrateMapPlayerStats],
  ["map_team_round_summary", migrateMapTeamRoundSummary],
  ["about_content", migrateAboutContent],
  ["emotes", migrateEmotes],
  ["forum", migrateForum],
  ["change_requests", migrateChangeRequests],
  ["user_reports", migrateUserReports],
  ["sanctions", migrateSanctions],
  ["moderation_suspects", migrateModerationSuspects],
  ["activity_log", migrateActivityLog],
  ["logos", migrateLogos],
];

async function main() {
  for (const [name, fn] of phases) {
    console.log(`\n=== ${name} ===`);
    const start = Date.now();
    await fn();
    console.log(`(${((Date.now() - start) / 1000).toFixed(1)}s)`);
  }
  await closeConnections();
}

main().catch((e) => { console.error(e); process.exit(1); });
